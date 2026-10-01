import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm,writeFile,readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { generateKeyPair,exportJWK,createLocalJWKSet,SignJWT } from 'jose';
import { LocalChatGptOAuth,ChatGptPlanProvider,ProtectedFileCredentialStore,ProviderError,buildPlanRequest,visibleModels,SseParser,OPENAI_ISSUER,OPENAI_TOKEN,OPENAI_RESOURCE,registrationId,type CredentialRecord,type CredentialStore,type ProviderEvent } from '../../packages/provider-chatgpt/src/index.ts';

class SyntheticStore implements CredentialStore {
  records=new Map<string,CredentialRecord>();writes=0;
  async read(id:string){return this.records.get(id)??null;}
  async write(id:string,value:CredentialRecord){this.writes++;this.records.set(id,value);}
  async remove(id:string){this.records.delete(id);}
}
async function fixture(){
  const keys=await generateKeyPair('RS256',{extractable:true});const jwk=await exportJWK(keys.publicKey);jwk.kid='synthetic-key';
  const store=new SyntheticStore();let clock=Date.now();let nonce='',subject='synthetic-subject',issuer=OPENAI_ISSUER,audience='synthetic-issued-client',scope='openid resource.invoke chatgpt.tokens.use.direct offline_access';let tokenCalls=0,apiCalls=0,modelStatus=200,streamStatus=200,refreshDelay=0;let expiration:'normal'|'expired'|'missing'='normal',corruptSignature=false;
  let stream='event: response.output_text.delta\r\ndata: {"type":"response.output_text.delta","delta":"héllo 🌞"}\r\n\r\nevent: response.completed\r\ndata: {"type":"response.completed"}\r\n\r\n';
  const calls:{url:string;body:URLSearchParams|unknown}[]=[];
  const request:typeof fetch=async(input,init)=>{
    const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
    if(url===OPENAI_TOKEN){
      tokenCalls++;const body=new URLSearchParams(typeof init?.body==='string'?init.body:init?.body instanceof URLSearchParams?init.body.toString():'');calls.push({url,body});if(body.get('grant_type')==='refresh_token'&&refreshDelay)await setTimeout(refreshDelay);
      let jwt=new SignJWT({nonce}).setProtectedHeader({alg:'RS256',kid:'synthetic-key'}).setIssuer(issuer).setSubject(subject).setAudience(audience).setIssuedAt(Math.floor(clock/1000));if(expiration!=='missing')jwt=jwt.setExpirationTime(Math.floor(clock/1000)+(expiration==='expired'?-1:3600));let idToken=await jwt.sign(keys.privateKey);if(corruptSignature){const parts=idToken.split('.'),signature=parts[2]??'';parts[2]=(signature.startsWith('a')?'b':'a')+signature.slice(1);idToken=parts.join('.');}
      return Response.json({access_token:'synthetic-access-'+tokenCalls,refresh_token:'synthetic-refresh-'+tokenCalls,id_token:idToken,token_type:'Bearer',expires_in:3600,scope});
    }
    apiCalls++;calls.push({url,body:typeof init?.body==='string'?JSON.parse(init.body):null});
    if(url===OPENAI_RESOURCE+'/models')return modelStatus===200?Response.json({models:[{slug:'synthetic-model',display_name:'Fixture model',visibility:'list'},{slug:'hidden-model',display_name:'Hidden',visibility:'hidden'}]}):new Response('private raw provider error',{status:modelStatus});
    if(url===OPENAI_RESOURCE+'/responses'){
      if(streamStatus!==200)return new Response('private raw provider error',{status:streamStatus});
      const bytes=new TextEncoder().encode(stream);let cursor=0;return new Response(new ReadableStream<Uint8Array>({pull(controller){if(cursor>=bytes.length){controller.close();return;}controller.enqueue(bytes.slice(cursor,cursor+3));cursor+=3;}}),{headers:{'content-type':'text/event-stream'}});
    }
    if(url.endsWith('/.well-known/openid-configuration'))return Response.json({issuer:OPENAI_ISSUER,revocation_endpoint:OPENAI_ISSUER+'/synthetic-revoke'});
    if(url.endsWith('/synthetic-revoke'))return new Response(null,{status:200});
    throw new Error('Unexpected fixture endpoint');
  };
  const oauth=new LocalChatGptOAuth({hostId:'urn:uuid:11111111-1111-4111-8111-111111111111',store,fetch:request,verificationKey:createLocalJWKSet({keys:[jwk]}),now:()=>clock});
  const begin=async(selected?:string)=>{const result=await oauth.begin('http://127.0.0.1:14561/auth/callback',selected);const url=new URL(result.authorizationUrl);nonce=url.searchParams.get('nonce')??'';return url;};
  const login=async()=>{const url=await begin();return oauth.complete({state:url.searchParams.get('state'),code:'synthetic-code',client_id:audience});};
  return {oauth,store,request,calls,begin,login,get tokenCalls(){return tokenCalls;},get apiCalls(){return apiCalls;},set nonce(value:string){nonce=value;},set subject(value:string){subject=value;},set issuer(value:string){issuer=value;},set audience(value:string){audience=value;},set scope(value:string){scope=value;},set clock(value:number){clock=value;},get clock(){return clock;},set modelStatus(value:number){modelStatus=value;},set streamStatus(value:number){streamStatus=value;},set stream(value:string){stream=value;},set refreshDelay(value:number){refreshDelay=value;},set expiration(value:'normal'|'expired'|'missing'){expiration=value;},set corruptSignature(value:boolean){corruptSignature=value;}};
}
function code(value:string){return (error:unknown)=>error instanceof ProviderError&&error.code===value;}

test('AI-01 synthetic OAuth fixture binds issued ID, PKCE, nonce and one-use state',async()=>{
  const f=await fixture(),url=await f.begin();assert.equal(url.origin,OPENAI_ISSUER);assert.equal(url.pathname,'/api/accounts/authorize');assert.equal(url.searchParams.get('client_id'),'dynamic_agent_client');assert.equal(url.searchParams.get('agent_name_hint'),'PWACloud');assert.equal(url.searchParams.get('resource'),OPENAI_RESOURCE);assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok((url.searchParams.get('code_challenge')??'').length>=43);
  const callback={state:url.searchParams.get('state'),code:'synthetic-code',client_id:'synthetic-issued-client'};
  await assert.rejects(f.oauth.complete({...callback,state:'wrong'}),code('invalid-request'));
  const result=await f.oauth.complete(callback);assert.equal(result.state,'ready');assert.equal(result.clientId,'synthetic-issued-client');assert.equal(f.tokenCalls,1);
  const body=f.calls[0]?.body;assert.ok(body instanceof URLSearchParams);assert.equal(body.get('client_id'),'synthetic-issued-client');assert.equal(body.get('redirect_uri'),'http://127.0.0.1:14561/auth/callback');assert.ok((body.get('code_verifier')??'').length>=43);assert.equal(body.get('resource'),OPENAI_RESOURCE);assert.equal(body.get('client_secret'),null);
  await assert.rejects(f.oauth.complete(callback),code('invalid-request'));assert.equal(f.tokenCalls,1);
});
test('AI-01 missing issued client ID, expired state and denial consume no provider request',async()=>{
  const f=await fixture(),a=await f.begin();await assert.rejects(f.oauth.complete({state:a.searchParams.get('state'),code:'synthetic-code'}),code('invalid-request'));
  const b=await f.begin();f.clock+=300001;await assert.rejects(f.oauth.complete({state:b.searchParams.get('state'),code:'synthetic-code',client_id:'synthetic-issued-client'}),code('invalid-request'));
  const c=await f.begin();await assert.rejects(f.oauth.complete({state:c.searchParams.get('state'),error:'access_denied'}),code('needs-consent'));assert.equal(f.tokenCalls,0);
});
for(const mismatch of ['nonce','issuer','audience'] as const)test(`AI-01 signed synthetic token with wrong ${mismatch} is rejected`,async()=>{
  const f=await fixture(),url=await f.begin();if(mismatch==='nonce')f.nonce='wrong';else if(mismatch==='issuer')f.issuer='https://wrong.example';else f.audience='wrong-client';
  await assert.rejects(f.oauth.complete({state:url.searchParams.get('state'),code:'synthetic-code',client_id:'synthetic-issued-client'}),code('invalid-request'));assert.equal(f.store.writes,0);
});
test('AI-01 expired, missing-expiration and invalid-signature synthetic ID tokens are rejected',async()=>{
  for(const mismatch of ['expired','missing','signature'] as const){const f=await fixture(),url=await f.begin();if(mismatch==='signature')f.corruptSignature=true;else f.expiration=mismatch;await assert.rejects(f.oauth.complete({state:url.searchParams.get('state'),code:'synthetic-code',client_id:'synthetic-issued-client'}),code('invalid-request'));assert.equal(f.store.writes,0);}
});
test('AI-01 returning registration rejects different issued ID and verified account',async()=>{
  const f=await fixture(),registered=await f.login(),url=await f.begin(registered.id);assert.equal(url.searchParams.get('client_id'),registered.clientId);assert.equal(url.searchParams.has('agent_name_hint'),false);
  await assert.rejects(f.oauth.complete({state:url.searchParams.get('state'),code:'synthetic-code',client_id:'different-issued-id'}),code('invalid-request'));
  const again=await f.begin(registered.id);f.subject='different-subject';await assert.rejects(f.oauth.complete({state:again.searchParams.get('state'),code:'synthetic-code'}),code('invalid-request'));assert.equal(f.store.writes,1);
});
test('AI-02 protected local store encrypts synthetic credentials and round-trips via actual OS protection',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pwacloud-credential-fixture-'));try{
    const keyPath=join(directory,'separate-key');await writeFile(keyPath,randomBytes(32),{mode:0o600});const store=new ProtectedFileCredentialStore(join(directory,'records'),process.platform==='win32'?undefined:keyPath);
    const record:CredentialRecord={issuer:OPENAI_ISSUER,subject:'synthetic-subject',clientId:'synthetic-client',hostId:'urn:uuid:11111111-1111-4111-8111-111111111111',accessToken:'synthetic-private-access-value',refreshToken:'synthetic-private-refresh-value',idToken:'synthetic-private-id-value',scopes:[],expiresAt:Date.now()+10000,savedAt:Date.now()};
    const id=registrationId(record);await store.write(id,record);const name=(await readdir(join(directory,'records')))[0];assert.ok(name);const encrypted=await readFile(join(directory,'records',name));assert.equal(encrypted.includes(Buffer.from(record.accessToken)),false);assert.equal(encrypted.includes(Buffer.from(record.refreshToken??'')),false);assert.deepEqual(await store.read(id),record);await store.remove(id);assert.equal(await store.read(id),null);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('AI-02 concurrent synthetic refreshes serialize and atomically retain rotating credentials',async()=>{
  const f=await fixture(),registration=await f.login();const saved=await f.store.read(registration.id);assert.ok(saved);await f.store.write(registration.id,{...saved,expiresAt:f.clock-1});f.refreshDelay=40;
  const records=await Promise.all(Array.from({length:12},()=>f.oauth.credential(registration.id)));assert.equal(f.tokenCalls,2);assert.equal(new Set(records.map(record=>record.refreshToken)).size,1);assert.equal((await f.store.read(registration.id))?.refreshToken,'synthetic-refresh-2');
  const refresh=f.calls[1]?.body;assert.ok(refresh instanceof URLSearchParams);assert.equal(refresh.get('scope'),null);assert.equal(refresh.get('client_id'),saved.clientId);
});
test('AI-02 disconnect during a synthetic refresh cannot restore cleared credentials',async()=>{
  const f=await fixture(),registration=await f.login(),saved=await f.store.read(registration.id);assert.ok(saved);await f.store.write(registration.id,{...saved,expiresAt:f.clock-1});f.refreshDelay=50;
  const refresh=f.oauth.credential(registration.id);const rejected=assert.rejects(refresh,code('revoked'));await setTimeout(5);const result=await f.oauth.disconnect(registration.id);await rejected;assert.equal(result.remoteRevocationConfirmed,true);assert.equal(await f.store.read(registration.id),null);
});
test('AI-02 changed identity on synthetic refresh cannot replace the selected credential record',async()=>{
  const f=await fixture(),registration=await f.login(),saved=await f.store.read(registration.id);assert.ok(saved);await f.store.write(registration.id,{...saved,expiresAt:f.clock-1});f.subject='wrong-account';await assert.rejects(f.oauth.credential(registration.id),code('policy-blocked'));assert.equal((await f.store.read(registration.id))?.accessToken,saved.accessToken);
});
test('AI-03 catalog preserves visible slugs and request shaper omits unsupported plan parameters',()=>{
  assert.deepEqual(visibleModels({models:[{slug:'a',display_name:'A',visibility:'list'},{slug:'b',display_name:'B',visibility:'hidden'}]}),[{slug:'a',displayName:'A'}]);assert.throws(()=>visibleModels({data:[]}),code('invalid-request'));assert.throws(()=>visibleModels({models:[{slug:'a',display_name:'A',visibility:'list'},{slug:'a',display_name:'Duplicate',visibility:'list'}]}),code('provider-unavailable'));
  const body=buildPlanRequest({model:'a',prompt:'Synthetic input'},[{slug:'a',displayName:'A'}],['resource.invoke','chatgpt.tokens.use.direct']);assert.equal(body.stream,true);assert.equal(body.store,false);assert.deepEqual(Object.keys(body).sort(),['input','model','store','stream']);assert.throws(()=>buildPlanRequest({model:'a',prompt:'Synthetic',max_output_tokens:42},[{slug:'a',displayName:'A'}],['resource.invoke','chatgpt.tokens.use.direct']),code('invalid-request'));assert.throws(()=>buildPlanRequest({model:'unknown',prompt:'Synthetic'},[{slug:'a',displayName:'A'}],['resource.invoke','chatgpt.tokens.use.direct']),code('unsupported-capability'));
});
test('AI-08 identity-only token cannot enumerate inference models or silently select billing fallback',async()=>{
  const f=await fixture();f.scope='openid profile email';const registration=await f.login();assert.equal(registration.state,'identity-only');const provider=new ChatGptPlanProvider(f.oauth,f.request);provider.select(registration.id,registration.state);await assert.rejects(provider.models(),code('needs-consent'));assert.equal(f.apiCalls,0);assert.equal(provider.status().state,'identity-only');
});
test('AI-07 provider fixtures decode UTF-8 fragmented SSE and require terminal completion',async()=>{
  const f=await fixture(),registration=await f.login(),provider=new ChatGptPlanProvider(f.oauth,f.request);provider.select(registration.id,registration.state);const events:ProviderEvent[]=[];await provider.execute({model:'synthetic-model',prompt:'Synthetic test'},new AbortController().signal,event=>events.push(event));assert.equal(events.map(event=>event.data.text??'').join(''),'héllo 🌞');assert.equal(events.at(-1)?.type,'completed');
  f.stream='data: {"type":"response.output_text.delta","delta":"partial"}\n\n';await assert.rejects(provider.execute({model:'synthetic-model',prompt:'Synthetic'},new AbortController().signal,()=>undefined),code('interrupted'));
  f.stream='data: {"type":"response.completed"}\n\ndata: {"type":"response.failed"}\n\n';await assert.rejects(provider.execute({model:'synthetic-model',prompt:'Synthetic'},new AbortController().signal,()=>undefined),code('interrupted'));
});
test('synthetic provider stream cancellation aborts before a completed event',async()=>{
  const f=await fixture(),registration=await f.login(),provider=new ChatGptPlanProvider(f.oauth,f.request);provider.select(registration.id,registration.state);const controller=new AbortController(),events:ProviderEvent[]=[];
  await assert.rejects(provider.execute({model:'synthetic-model',prompt:'Synthetic'},controller.signal,event=>{events.push(event);controller.abort();}),error=>error instanceof DOMException&&error.name==='AbortError');assert.equal(events.length,1);assert.equal(events[0]?.type,'delta');
});
test('AI-08 provider denial, revoked token, quota and routing failure remain typed with no other endpoint',async()=>{
  for(const [status,expected]of [[403,'permission-denied'],[401,'reauth-required'],[429,'quota-exceeded'],[503,'provider-unavailable']] as const){const f=await fixture(),registration=await f.login(),provider=new ChatGptPlanProvider(f.oauth,f.request);provider.select(registration.id,registration.state);f.streamStatus=status;await assert.rejects(provider.execute({model:'synthetic-model',prompt:'Synthetic'},new AbortController().signal,()=>undefined),error=>error instanceof ProviderError&&error.code===expected&&!error.message.includes('private raw'));assert.equal(f.apiCalls,2);assert.equal(f.calls.every(call=>call.url.startsWith(OPENAI_ISSUER)||call.url.startsWith(OPENAI_RESOURCE)),true);}
});
test('provider SSE parser rejects invalid UTF-8, overlong and truncated events',()=>{
  assert.throws(()=>new SseParser().push(new Uint8Array([0xff])),code('interrupted'));assert.throws(()=>new SseParser(8).push(new TextEncoder().encode('data: too long')),code('interrupted'));const parser=new SseParser();parser.push(new TextEncoder().encode('data: {'));assert.throws(()=>parser.finish(),code('interrupted'));
});
