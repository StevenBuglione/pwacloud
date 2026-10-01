import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout} from 'node:timers/promises';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {createRuntime} from '../../apps/personal-runtime/src/index.ts';
import {ChatGptPlanProvider,LocalChatGptOAuth,OPENAI_ISSUER,OPENAI_TOKEN,OPENAI_RESOURCE,registrationId,schema,type CredentialStore,type CredentialRecord} from '../../packages/provider-chatgpt/src/index.ts';
import {encodeInstallPacket} from '../../packages/package-verifier/src/index.ts';
import {signedFixture} from '../production/package-fixture.ts';

type Runtime=Awaited<ReturnType<typeof createRuntime>>;
const origin='http://127.0.0.1:4173';
const parseSession=schema<{generation:number;csrfToken:string}>({type:'object',additionalProperties:true,required:['generation','csrfToken'],properties:{generation:{type:'integer'},csrfToken:{type:'string'}}});
const parseRegistration=schema<{installId:string;generation:number}>({type:'object',additionalProperties:true,required:['installId','generation'],properties:{installId:{type:'string'},generation:{type:'integer'}}});
const parseAdmission=schema<{runId:string;state:string}>({type:'object',additionalProperties:true,required:['runId','state'],properties:{runId:{type:'string'},state:{type:'string'}}});
async function credentials(runtime:Runtime,cookie?:string){
  const response=cookie?await runtime.app.inject({url:'/v1/session',headers:{cookie}}):await runtime.app.inject({method:'POST',url:'/v1/session/local',headers:{origin},payload:{}});assert.equal(response.statusCode,200,response.body);
  const parsed=parseSession(JSON.parse(response.body)),issued=response.cookies[0];const authority=cookie??(issued?`${issued.name}=${issued.value}`:'');assert.ok(authority);
  return {generation:parsed.generation,headers:{origin,cookie:authority,'x-csrf-token':parsed.csrfToken}};
}
class SyntheticStore implements CredentialStore {
  private records=new Map<string,CredentialRecord>();private pause:((value:CredentialRecord|null)=>Promise<CredentialRecord|null>)|null=null;
  async read(id:string){const value=this.records.get(id)??null,pause=this.pause;this.pause=null;return pause?pause(value):value;}
  async write(id:string,value:CredentialRecord){this.records.set(id,value);}
  async remove(id:string){this.records.delete(id);}
  pauseNextRead(){let release:()=>void=()=>{},entered:()=>void=()=>{};const barrier=new Promise<void>(resolve=>{release=resolve;}),arrived=new Promise<void>(resolve=>{entered=resolve;});this.pause=async value=>{entered();await barrier;return value;};return {arrived,release};}
}
async function syntheticProvider(){
  const keys=await generateKeyPair('RS256',{extractable:true}),jwk=await exportJWK(keys.publicKey);jwk.kid='synthetic-runtime-account-key';const store=new SyntheticStore();let nonce='',clientId='synthetic-client-one',responseCalls=0;
  const request:typeof fetch=async(input,init)=>{
    const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
    if(url===OPENAI_TOKEN){const issued=await new SignJWT({nonce}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer(OPENAI_ISSUER).setSubject('synthetic-stable-account').setAudience(clientId).setIssuedAt().setExpirationTime('1h').sign(keys.privateKey);return Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',id_token:issued,token_type:'Bearer',expires_in:3600,scope:'openid offline_access resource.invoke chatgpt.tokens.use.direct'});}
    if(url===OPENAI_RESOURCE+'/models')return Response.json({models:[{slug:'synthetic-account-model',display_name:'Synthetic account fixture',visibility:'list'}]});
    if(url===OPENAI_RESOURCE+'/responses'){assert.equal(init?.method,'POST');responseCalls++;return new Response('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Synthetic budget fixture"}\n\nevent: response.completed\ndata: {"type":"response.completed"}\n\n',{headers:{'content-type':'text/event-stream'}});}
    if(url===OPENAI_ISSUER+'/.well-known/openid-configuration')return Response.json({issuer:OPENAI_ISSUER,revocation_endpoint:OPENAI_ISSUER+'/synthetic-revocation'});
    if(url===OPENAI_ISSUER+'/synthetic-revocation')return new Response(null,{status:200});throw new Error('Unexpected synthetic fixture endpoint');
  };
  const oauth=new LocalChatGptOAuth({hostId:'urn:uuid:22222222-2222-4222-8222-222222222222',store,fetch:request,verificationKey:createLocalJWKSet({keys:[jwk]})}),provider=new ChatGptPlanProvider(oauth,request);
  return {provider,store,get responseCalls(){return responseCalls;},async login(runtime:Runtime,owner:Awaited<ReturnType<typeof credentials>>,issuedClient=clientId){clientId=issuedClient;const begin=await runtime.app.inject({method:'POST',url:'/v1/provider/connect',headers:owner.headers,payload:{}});assert.equal(begin.statusCode,200,begin.body);const parsed=schema<{authorizationUrl:string}>({type:'object',additionalProperties:true,required:['authorizationUrl'],properties:{authorizationUrl:{type:'string'}}})(JSON.parse(begin.body)),url=new URL(parsed.authorizationUrl);nonce=url.searchParams.get('nonce')??'';const query=new URLSearchParams({state:url.searchParams.get('state')??'',code:'synthetic-code',client_id:clientId});const callback=await runtime.app.inject({url:'/auth/callback?'+query.toString()});assert.equal(callback.statusCode,302,callback.body);const issued=callback.cookies[0];assert.ok(issued);return {owner:await credentials(runtime,`${issued.name}=${issued.value}`),registrationId:registrationId({issuer:OPENAI_ISSUER,subject:'synthetic-stable-account',clientId})};}};
}
test('verified same-account selection and new registration cannot reset durable account admission or revive disconnected selection',async()=>{
  const f=await signedFixture({id:'dev.synthetic.account-budget',permissions:[{id:'summary',capability:'ai.respond',required:false,scope:{context:'selected-resources',requestsPerHour:20,concurrency:1,background:false}}]}),protocol=await syntheticProvider();
  const directory=await mkdtemp(join(tmpdir(),'pwacloud-synthetic-account-budget-'));
  const config={mode:'chatgpt-plan-local' as const,provider:protocol.provider,trustRoots:[{...f.root,demoOnly:false}],databasePath:join(directory,'runtime.sqlite'),requestLimitPerHour:1,pluginScopeAuthorization:async()=>true};let runtime=await createRuntime(config);
  try{
    let login=await protocol.login(runtime,await credentials(runtime));const packet=encodeInstallPacket(f.input);
    const approve=async(expectedGeneration:number)=>{const response=await runtime.app.inject({method:'POST',url:'/v1/installs',headers:login.owner.headers,payload:{packet,grants:['summary'],expectedGeneration}});assert.equal(response.statusCode,200,response.body);return parseRegistration(JSON.parse(response.body));};
    let install=await approve(0);const submit=(key:string)=>runtime.app.inject({method:'POST',url:'/v1/runs',headers:login.owner.headers,payload:{installId:install.installId,generation:install.generation,idempotencyKey:key,model:'synthetic-account-model',input:'Synthetic account quota check.'}});
    const admitted=await submit('first-account-request');assert.equal(admitted.statusCode,201,admitted.body);const run=parseAdmission(JSON.parse(admitted.body));let state=run.state;for(let i=0;i<30&&state!=='completed';i++){await setTimeout(10);const response=await runtime.app.inject({url:`/v1/runs/${run.runId}`,headers:login.owner.headers});state=parseAdmission(JSON.parse(response.body)).state;}assert.equal(state,'completed');assert.equal(protocol.responseCalls,1);
    const oldGeneration=login.owner.generation,select=await runtime.app.inject({method:'POST',url:'/v1/provider/select',headers:login.owner.headers,payload:{registrationId:login.registrationId}});assert.equal(select.statusCode,200,select.body);const selectedCookie=select.cookies[0];assert.ok(selectedCookie);login.owner=await credentials(runtime,`${selectedCookie.name}=${selectedCookie.value}`);assert.ok(login.owner.generation>oldGeneration);install=await approve(install.generation);assert.equal((await submit('after-same-identity-selection')).statusCode,429);
    assert.equal((await runtime.app.inject({method:'DELETE',url:'/v1/provider',headers:login.owner.headers})).statusCode,200);login=await protocol.login(runtime,login.owner,'synthetic-client-two');install=await approve(install.generation);assert.equal((await submit('after-new-client-same-identity')).statusCode,429);assert.equal(protocol.responseCalls,1);
    await runtime.close();runtime=await createRuntime(config);login.owner=await credentials(runtime);assert.equal((await submit('after-durable-account-restart')).statusCode,429);assert.equal(protocol.responseCalls,1);
    const rows=runtime.database.prepare('SELECT account_key,account_generation FROM runs').all();assert.equal(rows.length,1);const budget=schema<{account_key:string;account_generation:number}>({type:'object',additionalProperties:false,required:['account_key','account_generation'],properties:{account_key:{type:'string',pattern:'^[a-f0-9]{64}$'},account_generation:{type:'integer'}}})(rows[0]);assert.ok(budget.account_generation<login.owner.generation);
    const delayed=protocol.store.pauseNextRead(),pending=runtime.app.inject({method:'POST',url:'/v1/provider/select',headers:login.owner.headers,payload:{registrationId:login.registrationId}}).then(response=>response);await delayed.arrived;
    try{assert.equal((await runtime.app.inject({method:'DELETE',url:'/v1/provider',headers:login.owner.headers})).statusCode,200);}finally{delayed.release();}
    assert.equal((await pending).statusCode,403);assert.equal(protocol.provider.selectedRegistration(),null);assert.equal(protocol.provider.status().state,'disconnected');assert.equal(runtime.database.prepare("SELECT count(*) AS count FROM runtime_metadata WHERE key='selected_registration'").get()?.count,0);assert.equal(runtime.database.prepare('SELECT count(*) AS count FROM usage_reservations').get()?.count,1);assert.equal(protocol.responseCalls,1);
  }finally{await runtime.close();await rm(directory,{recursive:true,force:true});}
});
