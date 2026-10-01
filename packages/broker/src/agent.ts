import Ajv2020 from 'ajv/dist/2020.js';
import {PlatformError,validateRequest,type Principal} from '../../contracts/src/index.ts';
import type {PluginStorage} from '../../storage/src/index.ts';
import type {CapabilityBroker} from './index.ts';

export type Tool={id:string;write:boolean;validate:(input:unknown)=>boolean;validateOutput?:(output:unknown)=>boolean;execute:(input:unknown,signal:AbortSignal)=>Promise<unknown>};
export type AgentCall=Readonly<{id:string;tool:string;input:unknown}>;
export type AgentApproval=(tool:Readonly<Tool>,input:unknown,signal:AbortSignal)=>Promise<boolean>;
export type WriteAdmission=(call:AgentCall,perform:()=>Promise<unknown>,signal:AbortSignal)=>Promise<unknown>;
export type AgentOptions={admitWrite?:WriteAdmission;timeoutMs?:number};
export type AgentTurn=Readonly<{calls:readonly AgentCall[];results:readonly unknown[]}>;
export type AgentSelector=(history:readonly AgentTurn[],signal:AbortSignal)=>Promise<unknown>;
const ajv=new Ajv2020({strict:true,ownProperties:true});
const identifier={type:'string',minLength:1,maxLength:120,pattern:'^[A-Za-z0-9._:-]+$'};
const callsValid=ajv.compile<AgentCall[]>({type:'array',maxItems:64,items:{type:'object',additionalProperties:false,required:['id','tool','input'],properties:{id:identifier,tool:identifier,input:{}}}});
const registrationValid=ajv.compile<{id:string;write:boolean}>({type:'object',additionalProperties:false,required:['id','write'],properties:{id:identifier,write:{type:'boolean'}}});
const decisionValid=ajv.compile<{type:'done';output:unknown}|{type:'calls';calls:AgentCall[]}>({oneOf:[{type:'object',additionalProperties:false,required:['type','output'],properties:{type:{const:'done'},output:{}}},{type:'object',additionalProperties:false,required:['type','calls'],properties:{type:{const:'calls'},calls:{type:'array',minItems:1,maxItems:64,items:{type:'object',additionalProperties:false,required:['id','tool','input'],properties:{id:identifier,tool:identifier,input:{}}}}}}]});
function active(signal:AbortSignal):void{if(signal.aborted)throw new PlatformError('cancelled');}
function jsonSnapshot(value:unknown):unknown{
  const seen=new WeakSet<object>();let count=0,budget=0;const reserve=(bytes:number)=>{budget+=bytes;if(budget>262144)throw new PlatformError('tool-budget');};
  function inspect(item:unknown,depth:number):void{
    if(++count>4096||depth>24)throw new PlatformError('tool-budget');
    reserve(4);if(typeof item==='string'){if(item.length>262144)throw new PlatformError('tool-budget');reserve(new TextEncoder().encode(item).length);return;}
    if(item===null||typeof item==='boolean'||typeof item==='number'&&Number.isFinite(item))return;
    if(typeof item!=='object'||seen.has(item)||Object.getOwnPropertySymbols(item).length)throw new PlatformError('invalid-tool-call');
    const prototype=Object.getPrototypeOf(item);if(!Array.isArray(item)&&prototype!==Object.prototype&&prototype!==null)throw new PlatformError('invalid-tool-call');seen.add(item);
    for(const [key,descriptor]of Object.entries(Object.getOwnPropertyDescriptors(item))){if(Array.isArray(item)&&key==='length')continue;if(key.length>262144)throw new PlatformError('tool-budget');reserve(new TextEncoder().encode(key).length);if(!descriptor.enumerable||!('value'in descriptor))throw new PlatformError('invalid-tool-call');inspect(descriptor.value,depth+1);}
  }
  inspect(value,0);const text=JSON.stringify(value);if(text===undefined||new TextEncoder().encode(text).length>262144)throw new PlatformError('tool-budget');const snapshot:unknown=JSON.parse(text);
  function freeze(item:unknown):void{if(typeof item==='object'&&item!==null){for(const child of Object.values(item))freeze(child);Object.freeze(item);}}
  freeze(snapshot);return snapshot;
}
function abortable<T>(perform:()=>Promise<T>,signal:AbortSignal):Promise<T>{
  active(signal);return new Promise<T>((resolve,reject)=>{const cancelled=()=>reject(new PlatformError('cancelled'));signal.addEventListener('abort',cancelled,{once:true});Promise.resolve().then(()=>{active(signal);return perform();}).then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancelled));});
}
/** Runs a bounded list of host-approved calls. It does not interpret model text or create grants. */
export class ScopedAgent{
  private readonly tools:Readonly<Tool>[];private readonly used=new Set<string>();private running=false;private readonly timeoutMs:number;private readonly options:Readonly<AgentOptions>;
  constructor(tools:readonly Tool[],private readonly maxSteps=6,options:AgentOptions={}){
    this.options=Object.freeze({...options});
    this.timeoutMs=options.timeoutMs??30000;
    if(!Number.isSafeInteger(maxSteps)||maxSteps<1||maxSteps>64||!Number.isSafeInteger(this.timeoutMs)||this.timeoutMs<1||this.timeoutMs>120000||tools.length>64)throw new PlatformError('invalid-agent-limit');
    this.tools=tools.map(tool=>{if(!registrationValid({id:tool.id,write:tool.write})||typeof tool.validate!=='function'||typeof tool.execute!=='function'||tool.validateOutput!==undefined&&typeof tool.validateOutput!=='function')throw new PlatformError('invalid-tool');return Object.freeze({...tool});});
    if(new Set(this.tools.map(tool=>tool.id)).size!==this.tools.length)throw new PlatformError('duplicate-tool');
  }
  get stepLimit():number{return this.maxSteps;}
  async run(calls:unknown,approve:AgentApproval,signal:AbortSignal=new AbortController().signal):Promise<unknown[]>{
    active(signal);if(this.running)throw new PlatformError('busy');if(Array.isArray(calls)&&calls.length>this.maxSteps)throw new PlatformError('step-limit');
    const snapshot=jsonSnapshot(calls);if(!callsValid(snapshot))throw new PlatformError('invalid-tool-call');
    if(new Set(snapshot.map(call=>call.id)).size!==snapshot.length)throw new PlatformError('replay');
    const prepared=snapshot.map(call=>{const tool=this.tools.find(candidate=>candidate.id===call.tool);if(!tool||!tool.validate(call.input))throw new PlatformError('permission-denied');if(this.used.has(call.id))throw new PlatformError('replay');return{call,tool};});
    if(this.used.size+prepared.length>10000)throw new PlatformError('tool-budget');
    const bounded=AbortSignal.any([signal,AbortSignal.timeout(this.timeoutMs)]);active(bounded);this.running=true;const results:unknown[]=[];
    try{
      for(const {call,tool}of prepared){
        active(bounded);if(tool.write){const approved=await abortable(()=>approve(tool,call.input,bounded),bounded);active(bounded);if(approved!==true)throw new PlatformError('permission-denied');}
        this.used.add(call.id);
        let entered=false;const execute=async()=>{active(bounded);if(entered)throw new PlatformError('replay');entered=true;return tool.execute(call.input,bounded);};
        const result=await abortable(()=>tool.write&&this.options.admitWrite?this.options.admitWrite(call,execute,bounded):execute(),bounded);
        active(bounded);if(tool.validateOutput&&!tool.validateOutput(result))throw new PlatformError('invalid-tool-result');results.push(jsonSnapshot(result));
      }
      return results;
    }finally{this.running=false;}
  }
}

/** Selectors supply untrusted decisions; execution always stays inside the existing scoped runner. */
export async function runAgentLoop(agent:ScopedAgent,selectNext:AgentSelector,approve:AgentApproval,options:{signal?:AbortSignal;timeoutMs?:number}={}):Promise<{output:unknown;history:readonly AgentTurn[]}>{
  const timeoutMs=options.timeoutMs??30000;if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000)throw new PlatformError('invalid-agent-limit');
  const signal=AbortSignal.any([options.signal??new AbortController().signal,AbortSignal.timeout(timeoutMs)]);const history:AgentTurn[]=[];let steps=0;
  for(let turn=0;turn<=agent.stepLimit;turn++){
    active(signal);const safeHistory=jsonSnapshot(history) as readonly AgentTurn[];
    const decision=jsonSnapshot(await abortable(()=>selectNext(safeHistory,signal),signal));active(signal);
    if(!decisionValid(decision))throw new PlatformError('invalid-tool-call');
    if(decision.type==='done')return{output:decision.output,history:safeHistory};
    if(steps+decision.calls.length>agent.stepLimit)throw new PlatformError('step-limit');
    const results=await agent.run(decision.calls,approve,signal);steps+=decision.calls.length;
    history.push({calls:decision.calls,results});
  }
  throw new PlatformError('step-limit');
}

type Board={zoom:number;panX:number;panY:number;objects:{id:string;x:number;y:number;text:string;color:'mint'|'sand'|'blue'}[]};
const selectedInput=ajv.compile<{handle:'selected-note'}>({type:'object',additionalProperties:false,required:['handle'],properties:{handle:{const:'selected-note'}}});
const cardInput=ajv.compile<{text:string}>({type:'object',additionalProperties:false,required:['text'],properties:{text:{type:'string',maxLength:150}}});
const documentOutput=ajv.compile<{title:string;text:string}>({type:'object',additionalProperties:false,required:['title','text'],properties:{title:{type:'string',maxLength:1000},text:{type:'string',maxLength:32000}}});
const boardValid=ajv.compile<Board>({type:'object',additionalProperties:false,required:['zoom','panX','panY','objects'],properties:{zoom:{type:'number',minimum:.5,maximum:2},panX:{type:'number',minimum:-1000,maximum:1000},panY:{type:'number',minimum:-1000,maximum:1000},objects:{type:'array',maxItems:100,items:{type:'object',additionalProperties:false,required:['id','x','y','text','color'],properties:{id:{type:'string',maxLength:120},x:{type:'number',minimum:0,maximum:640},y:{type:'number',minimum:0,maximum:720},text:{type:'string',maxLength:150},color:{enum:['mint','sand','blue']}}}}}});
/** The caller supplies the actual bound principal and already selected document handle. */
export function createSelectedDocumentAgent(options:{broker:Pick<CapabilityBroker,'dispatch'>;storage:Pick<PluginStorage,'operationOnce'>;principal:Principal;runId:string;maxSteps?:number;timeoutMs?:number}):ScopedAgent{
  if(!registrationValid({id:options.runId,write:false}))throw new PlatformError('invalid-run-id');
  const principal=options.principal,runId=options.runId,broker=options.broker,storage=options.storage;
  const dispatch=(method:string,params:Record<string,unknown>,signal:AbortSignal)=>broker.dispatch(principal,validateRequest({v:1,id:crypto.randomUUID(),type:'request',method,params}),signal,()=>{});
  const tools:Tool[]=[{id:'documents.read-selected',write:false,validate:selectedInput,validateOutput:documentOutput,execute:async(input,signal)=>{if(!selectedInput(input))throw new PlatformError('permission-denied');return dispatch('services.invoke',{bindingId:input.handle,method:'read',args:{}},signal);}},
    {id:'canvas.add-card',write:true,validate:cardInput,execute:async(input,signal)=>{
      if(!cardInput(input))throw new PlatformError('permission-denied');const prior=await dispatch('storage.get',{key:'board/current'},signal);active(signal);
      const board=prior===null?{zoom:1,panX:0,panY:0,objects:[]}:prior;if(!boardValid(board))throw new PlatformError('invalid-board');if(board.objects.length>=100)throw new PlatformError('tool-budget');
      const id=crypto.randomUUID(),count=board.objects.length;const next:Board={...board,objects:[...board.objects,{id,x:24+count%3*80,y:24+Math.floor(count/3)*80%600,text:input.text,color:'mint'}]};
      active(signal);await dispatch('storage.put',{key:'board/current',value:next},signal);return{id};}}];
  return new ScopedAgent(tools,options.maxSteps??6,{timeoutMs:options.timeoutMs,admitWrite:async(call,perform,signal)=>{active(signal);const key='agent/'+JSON.stringify([principal.workspace,principal.plugin,principal.digest,principal.generation,runId,call.id]);try{return await storage.operationOnce(key,perform);}catch(error){if(error instanceof PlatformError&&error.code==='operation-already-admitted')throw new PlatformError('replay');throw error;}}});
}
