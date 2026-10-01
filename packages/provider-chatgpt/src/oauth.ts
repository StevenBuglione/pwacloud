import { createHash,randomBytes } from 'node:crypto';
import { createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey } from 'jose';
import { ProviderError,schema,type ProviderState } from './schema.ts';
import { type CredentialRecord,type CredentialStore,parseCredential } from './credentials.ts';

export const OPENAI_ISSUER='https://auth.openai.com';
export const OPENAI_RESOURCE='https://api.openai.com/v1';
export const OPENAI_AUTHORIZE=OPENAI_ISSUER+'/api/accounts/authorize';
export const OPENAI_TOKEN=OPENAI_ISSUER+'/api/accounts/oauth/token';
export const OPENAI_SCOPES=['openid','profile','email','offline_access','resource.invoke','chatgpt.tokens.use.direct'];
const parseCallback=schema<{state:string;code?:string;client_id?:string;error?:string;scope?:string}>({type:'object',additionalProperties:false,required:['state'],properties:{state:{type:'string',minLength:1,maxLength:512},code:{type:'string',minLength:1,maxLength:8192},client_id:{type:'string',minLength:1,maxLength:512},error:{type:'string',maxLength:256},scope:{type:'string',maxLength:4096}}});
const parseTokens=schema<{access_token:string;refresh_token?:string;id_token:string;token_type:string;expires_in:number;scope?:string;earliest_refresh_at?:string|number}>({type:'object',additionalProperties:true,required:['access_token','id_token','token_type','expires_in'],properties:{access_token:{type:'string',minLength:1,maxLength:131072},refresh_token:{type:'string',minLength:1,maxLength:131072},id_token:{type:'string',minLength:1,maxLength:131072},token_type:{const:'Bearer'},expires_in:{type:'integer',minimum:1,maximum:86400},scope:{type:'string',maxLength:4096},earliest_refresh_at:{anyOf:[{type:'string'},{type:'number'}]}}});
type Transaction={state:string;nonce:string;verifier:string;redirectUri:string;expiresAt:number;selected:CredentialRecord|null;epoch:number};
export type Registration=Readonly<{id:string;issuer:string;subject:string;clientId:string;state:ProviderState}>;
export type OAuthOptions=Readonly<{hostId:string;store:CredentialStore;fetch?:typeof fetch;verificationKey?:JWTVerifyGetKey;now?:()=>number}>;
export async function boundedJson(response:Response):Promise<unknown>{
  const reader=response.body?.getReader();if(!reader)throw new ProviderError('provider-unavailable','Provider returned no response body.',true,502);
  let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>524288){await reader.cancel();throw new ProviderError('provider-unavailable','Provider response exceeded the boundary.',false,502);}chunks.push(item.value);}}
  finally{reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ProviderError('provider-unavailable','Provider returned invalid JSON.',false,502);}
}
export function registrationId(record:Pick<CredentialRecord,'issuer'|'subject'|'clientId'>):string{return createHash('sha256').update(JSON.stringify([record.issuer,record.subject,record.clientId])).digest('hex');}
function ready(scopes:readonly string[]):ProviderState{return scopes.includes('chatgpt.tokens.use.direct')&&scopes.includes('resource.invoke')?'ready':'identity-only';}
/** Single-use local transactions; the issued ID, verified subject and scopes remain independent. */
export class LocalChatGptOAuth {
  private readonly transactions=new Map<string,Transaction>();
  private readonly refreshes=new Map<string,Promise<CredentialRecord>>();
  private readonly credentialEpochs=new Map<string,number>();
  private readonly mutations=new Map<string,Promise<void>>();
  private transactionEpoch=0;
  private readonly request:typeof fetch;
  private readonly key:JWTVerifyGetKey;
  private readonly now:()=>number;
  constructor(private readonly options:OAuthOptions){
    this.request=options.fetch??fetch;this.key=options.verificationKey??createRemoteJWKSet(new URL(OPENAI_ISSUER+'/.well-known/jwks.json'));this.now=options.now??Date.now;
    if(!/^urn:uuid:[0-9a-f-]{36}$/u.test(options.hostId)&&!options.hostId.startsWith('urn:ietf:params:oauth:jwk-thumbprint:'))throw new ProviderError('policy-blocked','Invalid stable host identifier.');
  }
  async begin(redirectUri:string,selectedId?:string):Promise<{authorizationUrl:string;expiresAt:number}>{
    const redirect=new URL(redirectUri);
    if(redirect.protocol!=='http:'||redirect.hostname!=='127.0.0.1'||redirect.pathname!=='/auth/callback'||redirect.username||redirect.password||redirect.search||redirect.hash)throw new ProviderError('invalid-request','OAuth requires the exact local /auth/callback URI.');
    for(const [state,tx]of this.transactions)if(tx.expiresAt<=this.now())this.transactions.delete(state);
    if(this.transactions.size>=8)throw new ProviderError('quota-exceeded','Too many pending sign-in attempts.',false,429);
    const selected=selectedId?await this.options.store.read(selectedId):null;
    if(selectedId&&!selected)throw new ProviderError('reauth-required','Selected registration has no renewable local credentials.');
    const state=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(64).toString('base64url');
    const expiresAt=this.now()+300000;
    this.transactions.set(state,{state,nonce,verifier,redirectUri,expiresAt,selected,epoch:this.transactionEpoch});
    const url=new URL(OPENAI_AUTHORIZE);const clientId=selected?.clientId??'dynamic_agent_client';
    for(const [name,value]of Object.entries({client_id:clientId,ext_agent_host_id:this.options.hostId,response_type:'code',redirect_uri:redirectUri,scope:OPENAI_SCOPES.join(' '),resource:OPENAI_RESOURCE,state,nonce,code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url')}))url.searchParams.set(name,value);
    if(!selected)url.searchParams.set('agent_name_hint','PWACloud');
    return {authorizationUrl:url.toString(),expiresAt};
  }
  async complete(value:unknown):Promise<Registration>{
    const callback=parseCallback(value);const tx=this.transactions.get(callback.state);
    if(!tx)throw new ProviderError('invalid-request','Unknown or consumed sign-in transaction.');
    this.transactions.delete(callback.state);
    if(tx.expiresAt<=this.now())throw new ProviderError('invalid-request','Sign-in transaction expired.');
    if(callback.error)throw new ProviderError(callback.error==='access_denied'?'needs-consent':'reauth-required','Sign-in was not authorized.',false,403);
    if(!callback.code)throw new ProviderError('invalid-request','Sign-in callback is incomplete.');
    const clientId=tx.selected?.clientId??callback.client_id;
    if(!clientId||clientId==='dynamic_agent_client'||(tx.selected&&callback.client_id&&callback.client_id!==tx.selected.clientId))throw new ProviderError('invalid-request','Issued registration did not match the sign-in transaction.');
    const response=await this.request(OPENAI_TOKEN,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,code:callback.code,code_verifier:tx.verifier,redirect_uri:tx.redirectUri,resource:OPENAI_RESOURCE})});
    if(!response.ok)throw new ProviderError('reauth-required','Authorization code exchange failed.',false,401);
    const tokens=parseTokens(await boundedJson(response));
    let subject:string;
    try{const verified=await jwtVerify(tokens.id_token,this.key,{issuer:OPENAI_ISSUER,audience:clientId,algorithms:['RS256'],requiredClaims:['sub','exp','iat','nonce'],currentDate:new Date(this.now())});if(verified.payload.nonce!==tx.nonce||typeof verified.payload.sub!=='string'||!verified.payload.sub)throw new Error('identity');subject=verified.payload.sub;}
    catch{throw new ProviderError('invalid-request','Provider identity verification failed.',false,403);}
    if(tx.selected&&(tx.selected.subject!==subject||tx.selected.issuer!==OPENAI_ISSUER))throw new ProviderError('invalid-request','Returning sign-in used a different account.',false,403);
    const scopes=[...new Set((tokens.scope??'').split(/\s+/u).filter(Boolean))];
    const record=parseCredential({issuer:OPENAI_ISSUER,subject,clientId,hostId:this.options.hostId,accessToken:tokens.access_token,idToken:tokens.id_token,...(tokens.refresh_token?{refreshToken:tokens.refresh_token}:{}),scopes,expiresAt:this.now()+tokens.expires_in*1000,savedAt:this.now()});
    const id=registrationId(record);
    await this.exclusive(id,async()=>{
      if(tx.epoch!==this.transactionEpoch)throw new ProviderError('revoked','Sign-in was cancelled before credentials were selected.',false,403);
      await this.options.store.write(id,record);
      if(tx.epoch!==this.transactionEpoch){await this.options.store.remove(id);throw new ProviderError('revoked','Sign-in was cancelled before credentials were selected.',false,403);}
      this.credentialEpochs.set(id,(this.credentialEpochs.get(id)??0)+1);
    });
    return {id,issuer:record.issuer,subject,clientId,state:ready(scopes)};
  }
  async credential(id:string,signal?:AbortSignal):Promise<CredentialRecord>{
    const existing=await this.options.store.read(id);if(!existing)throw new ProviderError('reauth-required','Sign in to the selected ChatGPT registration.',false,401);
    if(existing.hostId!==this.options.hostId||registrationId(existing)!==id)throw new ProviderError('policy-blocked','Stored registration binding is invalid.',false,403);
    if(existing.expiresAt>this.now()+60000)return existing;
    const active=this.refreshes.get(id);if(active)return active;
    const refresh=this.refresh(id,existing,signal);this.refreshes.set(id,refresh);
    try{return await refresh;}finally{if(this.refreshes.get(id)===refresh)this.refreshes.delete(id);}
  }
  private async refresh(id:string,previous:CredentialRecord,signal?:AbortSignal):Promise<CredentialRecord>{
    const epoch=this.credentialEpochs.get(id)??0;
    if(!previous.refreshToken)throw new ProviderError('reauth-required','Registration has no renewable consent.',false,401);
    const response=await this.request(OPENAI_TOKEN,{method:'POST',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:previous.clientId,refresh_token:previous.refreshToken,resource:OPENAI_RESOURCE})});
    if(!response.ok)throw new ProviderError(response.status>=500?'provider-unavailable':'reauth-required','Renewing selected registration failed.',response.status>=500,response.status>=500?502:401);
    const tokens=parseTokens(await boundedJson(response));
    try{const verified=await jwtVerify(tokens.id_token,this.key,{issuer:OPENAI_ISSUER,audience:previous.clientId,algorithms:['RS256'],requiredClaims:['sub','exp','iat'],currentDate:new Date(this.now())});if(verified.payload.sub!==previous.subject)throw new Error('account');}
    catch{throw new ProviderError('policy-blocked','Renewed registration identity did not match.',false,403);}
    if(!tokens.refresh_token)throw new ProviderError('reauth-required','Provider did not return a rotating refresh token.',false,401);
    const updated=parseCredential({...previous,accessToken:tokens.access_token,idToken:tokens.id_token,refreshToken:tokens.refresh_token,scopes:tokens.scope===undefined?previous.scopes:[...new Set(tokens.scope.split(/\s+/u).filter(Boolean))],expiresAt:this.now()+tokens.expires_in*1000,savedAt:this.now()});
    return this.exclusive(id,async()=>{
      if((this.credentialEpochs.get(id)??0)!==epoch)throw new ProviderError('revoked','Registration was disconnected during refresh.',false,403);
      await this.options.store.write(id,updated);
      if((this.credentialEpochs.get(id)??0)!==epoch){await this.options.store.remove(id);throw new ProviderError('revoked','Registration was disconnected during refresh.',false,403);}
      return updated;
    });
  }
  private async exclusive<T>(id:string,operation:()=>Promise<T>):Promise<T>{
    const previous=this.mutations.get(id)??Promise.resolve();const task=previous.catch(()=>undefined).then(operation);const settled=task.then(()=>undefined,()=>undefined);this.mutations.set(id,settled);
    try{return await task;}finally{if(this.mutations.get(id)===settled)this.mutations.delete(id);}
  }
  cancelPending():void{this.transactionEpoch++;this.transactions.clear();}
  async disconnect(id:string):Promise<{remoteRevocationConfirmed:boolean}>{
    this.cancelPending();this.credentialEpochs.set(id,(this.credentialEpochs.get(id)??0)+1);
    await this.refreshes.get(id)?.catch(()=>undefined);
    return this.exclusive(id,async()=>{
      const record=await this.options.store.read(id);let confirmed=false;
      try{if(record?.refreshToken){
      const discovery=await this.request(OPENAI_ISSUER+'/.well-known/openid-configuration',{redirect:'error',signal:AbortSignal.timeout(10000)});
      if(discovery.ok){const parseDiscovery=schema<{issuer:string;revocation_endpoint:string}>({type:'object',additionalProperties:true,required:['issuer','revocation_endpoint'],properties:{issuer:{const:OPENAI_ISSUER},revocation_endpoint:{type:'string'}}});const data=parseDiscovery(await boundedJson(discovery));const endpoint=new URL(data.revocation_endpoint);if(endpoint.origin===OPENAI_ISSUER&&endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password){const result=await this.request(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:record.refreshToken,token_type_hint:'refresh_token',client_id:record.clientId})});confirmed=result.status===200;}}
      }}catch{confirmed=false;}finally{await this.options.store.remove(id);}
      return {remoteRevocationConfirmed:confirmed};
    });
  }
}
