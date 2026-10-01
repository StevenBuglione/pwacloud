import { LocalChatGptOAuth,boundedJson,OPENAI_RESOURCE } from './oauth.ts';
import { ProviderError,parseAiInput,schema,type AiInput,type ModelChoice,type InferenceProvider,type ProviderEvent,type ProviderState } from './schema.ts';
import { SseParser } from './sse.ts';
export * from './schema.ts';
export * from './oauth.ts';
export * from './credentials.ts';
export * from './demo.ts';
export * from './sse.ts';

const parseCatalog=schema<{models:{slug:string;display_name:string;visibility:string}[]}>({type:'object',additionalProperties:true,required:['models'],properties:{models:{type:'array',maxItems:1000,items:{type:'object',additionalProperties:true,required:['slug','display_name','visibility'],properties:{slug:{type:'string',minLength:1,maxLength:256},display_name:{type:'string',minLength:1,maxLength:512},visibility:{type:'string'}}}}}});
const parseEvent=schema<{type:string;delta?:string}>({type:'object',additionalProperties:true,required:['type'],properties:{type:{type:'string',maxLength:256},delta:{type:'string',maxLength:262144}}});
export function visibleModels(value:unknown):ModelChoice[]{
  const catalog=parseCatalog(value);const seen=new Set<string>();const result:ModelChoice[]=[];
  for(const row of catalog.models){if(row.visibility!=='list')continue;if(seen.has(row.slug))throw new ProviderError('provider-unavailable','Provider model catalogue contains duplicate slugs.',false,502);seen.add(row.slug);result.push({slug:row.slug,displayName:row.display_name});}
  return result;
}
export function buildPlanRequest(value:unknown,catalog:readonly ModelChoice[],scopes:readonly string[]){
  const input=parseAiInput(value);if(!scopes.includes('chatgpt.tokens.use.direct')||!scopes.includes('resource.invoke'))throw new ProviderError('needs-consent','ChatGPT plan permission has not been granted.',false,403);
  if(!catalog.some(model=>model.slug===input.model))throw new ProviderError('unsupported-capability','Selected model is unavailable.',false,400);
  if(!input.prompt.trim()||Buffer.byteLength(input.prompt)+(input.instructions?Buffer.byteLength(input.instructions):0)>262144)throw new ProviderError('invalid-request','Input exceeds the local text boundary.');
  return {model:input.model,input:[{role:'user',content:input.prompt}],store:false,stream:true,...(input.instructions===undefined?{}:{instructions:input.instructions})};
}
/** Official public transport only. The selected registration owns each request. No paid fallback exists. */
export class ChatGptPlanProvider implements InferenceProvider {
  readonly mode='chatgpt-plan-local';
  private state:ProviderState='disconnected';
  private selectedId:string|null=null;
  constructor(readonly oauth:LocalChatGptOAuth,private readonly request:typeof fetch=fetch) {}
  status(){return {mode:this.mode,state:this.state,label:'ChatGPT plan on your personal runtime',remainingAllowance:null};}
  select(id:string,state:ProviderState='identity-only'):void{this.selectedId=id;this.state=state;}
  selectedRegistration():string|null{return this.selectedId;}
  clear():void{this.selectedId=null;this.state='disconnected';}
  async models(signal?:AbortSignal):Promise<ModelChoice[]>{
    const credential=await this.authorize(signal);
    const response=await this.request(OPENAI_RESOURCE+'/models',{redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),headers:{authorization:'Bearer '+credential.accessToken}});
    if(!response.ok)throw this.failure(response.status);
    return visibleModels(await boundedJson(response));
  }
  private async authorize(signal?:AbortSignal){
    if(!this.selectedId)throw new ProviderError('reauth-required','Continue with ChatGPT on this runtime.',false,401);
    try{const credential=await this.oauth.credential(this.selectedId,signal);if(!credential.scopes.includes('chatgpt.tokens.use.direct')||!credential.scopes.includes('resource.invoke')){this.state='identity-only';throw new ProviderError('needs-consent','ChatGPT plan permission has not been granted.',false,403);}this.state='ready';return credential;}
    catch(error){if(error instanceof ProviderError&&error.code!=='needs-consent')this.state=error.code==='provider-unavailable'?'temporarily-unavailable':'reauth-required';throw error;}
  }
  private failure(status:number):ProviderError{
    if(status===401){this.state='reauth-required';return new ProviderError('reauth-required','ChatGPT authorization expired or was revoked.',false,401);}
    if(status===403){this.state='policy-blocked';return new ProviderError('permission-denied','ChatGPT plan request was denied.',false,403);}
    if(status===429)return new ProviderError('quota-exceeded','Provider allowance or admission limit reached.',true,429);
    this.state='temporarily-unavailable';return new ProviderError('provider-unavailable','ChatGPT inference is temporarily unavailable.',status>=500,502);
  }
  async execute(value:AiInput,signal:AbortSignal,emit:(event:ProviderEvent)=>void):Promise<void>{
    signal.throwIfAborted();
    const selected=this.selectedId;const credential=await this.authorize(signal);const catalog=await this.models(signal);
    if(selected!==this.selectedId)throw new ProviderError('revoked','Selected registration changed.',false,403);
    const body=buildPlanRequest(value,catalog,credential.scopes);
    const response=await this.request(OPENAI_RESOURCE+'/responses',{method:'POST',redirect:'error',signal,headers:{authorization:'Bearer '+credential.accessToken,'content-type':'application/json',accept:'text/event-stream'},body:JSON.stringify(body)});
    if(!response.ok)throw this.failure(response.status);
    if(!response.headers.get('content-type')?.startsWith('text/event-stream')||!response.body)throw new ProviderError('interrupted','Provider did not return an event stream.',false,502);
    const reader=response.body.getReader();const parser=new SseParser();let terminal:'completed'|'failed'|'interrupted'|null=null;
    const consume=(data:string):void=>{
      if(data==='[DONE]')return;
      let payload:unknown;try{payload=JSON.parse(data);}catch{throw new ProviderError('interrupted','Provider event was malformed.',false,502);}
      const event=parseEvent(payload);
      if(event.type==='response.output_text.delta'){if(terminal||event.delta===undefined)throw new ProviderError('interrupted','Provider stream order was invalid.',false,502);emit({type:'delta',data:{text:event.delta}});}
      if(['response.completed','response.failed','response.incomplete','error'].includes(event.type)){if(terminal)throw new ProviderError('interrupted','Provider returned conflicting terminal events.',false,502);terminal=event.type==='response.completed'?'completed':event.type==='response.incomplete'?'interrupted':'failed';}
    };
    try{while(true){signal.throwIfAborted();const chunk=await reader.read();if(chunk.done)break;for(const event of parser.push(chunk.value)){signal.throwIfAborted();consume(event.data);}}for(const event of parser.finish())consume(event.data);}
    finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
    if(!terminal)throw new ProviderError('interrupted','Provider stream ended before a terminal event.',false,502);
    if(selected!==this.selectedId)throw new ProviderError('revoked','Selected registration changed.',false,403);
    if(terminal==='completed')emit({type:'completed',data:{}});else emit({type:terminal,data:{code:terminal==='failed'?'provider-unavailable':'interrupted',message:'Provider did not complete inference.'}});
  }
}
