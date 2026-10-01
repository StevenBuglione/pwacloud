import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { createServer } from 'node:net';
import { execFileSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { createRuntime } from '../../apps/personal-runtime/src/index.ts';
import { createEnvelope,encodeInstallPacket,exactBuffer,type TrustRoot,type PackageInput } from '../../packages/package-verifier/src/index.ts';
import { DemoProvider,ProviderError,SseParser,schema,type AiInput,type ProviderEvent } from '../../packages/provider-chatgpt/src/index.ts';
import { type Manifest,type Receipt } from '../../packages/contracts/src/index.ts';

const origin='http://127.0.0.1:4173';
const parseSession=schema<{workspaceId:string;generation:number;csrfToken:string}>({type:'object',additionalProperties:true,required:['workspaceId','generation','csrfToken'],properties:{workspaceId:{type:'string'},generation:{type:'integer'},csrfToken:{type:'string'}}});
const parseAdmission=schema<{runId:string;state:string}>({type:'object',additionalProperties:true,required:['runId','state'],properties:{runId:{type:'string'},state:{type:'string'}}});
const parseRegistered=schema<{installId:string;generation:number}>({type:'object',additionalProperties:true,required:['installId','generation'],properties:{installId:{type:'string'},generation:{type:'integer'}}});
const parseRegistration=schema<{installId:string;generation:number;state:string;digest:string;grants:string[]}>({type:'object',additionalProperties:false,required:['installId','generation','state','digest','grants'],properties:{installId:{type:'string'},generation:{type:'integer'},state:{type:'string'},digest:{type:'string',pattern:'^[a-f0-9]{64}$'},grants:{type:'array',items:{type:'string'}}}});
type Runtime=Awaited<ReturnType<typeof createRuntime>>;
async function owner(runtime:Runtime,customOrigin=origin){const response=await runtime.app.inject({method:'POST',url:'/v1/session/local',headers:{origin:customOrigin},payload:{}});assert.equal(response.statusCode,200,response.body);const parsed=parseSession(JSON.parse(response.body));const value=response.cookies[0];assert.ok(value);return {session:parsed,headers:{cookie:`${value.name}=${value.value}`,origin:customOrigin,'x-csrf-token':parsed.csrfToken},cookie:`${value.name}=${value.value}`};}
async function fixture(requestsPerHour=20,concurrency=1,withService=false){
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const manifest:Manifest={apiVersion:'pwacloud.dev/v0.1',kind:'Plugin',id:'dev.synthetic.runtime-fixture',name:'Runtime protocol fixture',version:'0.1.0',description:'Synthetic test package',license:'MIT',hostApi:{major:1,minimumMinor:0},source:{repository:'https://github.com/StevenBuglione/pwacloud',directory:'tests/fixtures'},ui:{profile:'host-rendered',entry:'ui/view.json',minWidthCssPx:360,contributes:[{type:'library-entry',id:'runtime-fixture',title:'Synthetic runtime fixture'}]},permissions:[{id:'summary',capability:'ai.respond',required:false,scope:{context:'selected-resources',requestsPerHour,concurrency,background:false}},{id:'feed',capability:'network.http',required:false,scope:{rules:[{origin:'https://example.com',methods:['GET'],pathPrefixes:['/feeds/']} ]}}],provides:[],requires:[]};
  if(withService)manifest.service={entry:'service/component.wasm',world:'pwacloud:plugin/guest@0.1.0',maxLinearMemoryMiB:64};
  const files:Record<string,Uint8Array>={'manifest.json':new TextEncoder().encode(JSON.stringify(manifest)),'ui/view.json':new TextEncoder().encode('{"kind":"text","text":"Synthetic"}')};
  if(withService){files['service/component.wasm']=new Uint8Array(await readFile('artifacts/guest/component.wasm'));files['build-report.json']=new TextEncoder().encode('{"kind":"synthetic-runtime-race-fixture","jco":"1.34.0"}');}
  const built=await createEnvelope(files,'a'.repeat(40));
  const publicKey=await crypto.subtle.exportKey('jwk',keys.publicKey);const root:TrustRoot={keyId:'synthetic-runtime-key',publisherIdentity:'synthetic-runtime-publisher',policyVersion:'synthetic-v1',publicKey,demoOnly:true};
  const receipt:Receipt={format:'pwacloud.verification.v1',keyId:root.keyId,pluginId:manifest.id,version:manifest.version,archiveSha256:built.envelope.archive.sha256,manifestSha256:built.envelope.manifestSha256,publisherIdentity:root.publisherIdentity,policyVersion:root.policyVersion,verifiedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),revocationSequence:0};
  const receiptBytes=new TextEncoder().encode(JSON.stringify(receipt));const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,exactBuffer(receiptBytes)));const envelopeSignature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,exactBuffer(built.envelopeBytes)));
  const packet:PackageInput={archiveBytes:built.archiveBytes,envelopeBytes:built.envelopeBytes,receiptBytes,signature,envelopeSignature};return {manifest,roots:[root],packet:encodeInstallPacket(packet)};
}
async function install(runtime:Runtime,credentials:Awaited<ReturnType<typeof owner>>,packet:unknown){const response=await runtime.app.inject({method:'POST',url:'/v1/installs',headers:credentials.headers,payload:{packet,grants:['summary','feed']}});assert.equal(response.statusCode,200,response.body);return parseRegistered(JSON.parse(response.body));}
function runInput(installId:string,generation:number,idempotencyKey:string){return {installId,generation,idempotencyKey,model:'demo-synthetic',input:'Synthetic test document.',selectedDocumentHandles:[]};}
async function waitTerminal(runtime:Runtime,credentials:Awaited<ReturnType<typeof owner>>,runId:string){for(let i=0;i<100;i++){const result=await runtime.app.inject({url:`/v1/runs/${runId}`,headers:credentials.headers});assert.equal(result.statusCode,200,result.body);const data=parseAdmission(JSON.parse(result.body));if(['completed','failed','interrupted','cancelled'].includes(data.state))return data;await setTimeout(15);}throw new Error('Run did not terminate');}
class CountingProvider extends DemoProvider {
  calls=0;constructor(private readonly delay=8){super();}
  override async execute(_input:AiInput,signal:AbortSignal,emit:(event:ProviderEvent)=>void){this.calls++;for(let i=0;i<8;i++){await setTimeout(this.delay,undefined,{signal});emit({type:'delta',data:{text:`synthetic-${i} `}});}emit({type:'completed',data:{}});}
}
async function freePort():Promise<number>{const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');const port=address.port;await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));return port;}

test('runtime session enforces exact Origin, CSRF, null-origin denial and host-only HttpOnly cookie',async()=>{
  const runtime=await createRuntime();try{
    assert.equal((await runtime.app.inject({url:'/v1/session'})).statusCode,401);
    assert.equal((await runtime.app.inject({method:'POST',url:'/v1/session/local',headers:{origin:'https://attacker.invalid'},payload:{}})).statusCode,403);
    const credentials=await owner(runtime);assert.match(String((await runtime.app.inject({method:'POST',url:'/v1/session/local',headers:{origin},payload:{}})).headers['set-cookie']??''),/__Host-pwacloud-session=.*HttpOnly.*Secure.*SameSite=Strict/u);
    assert.equal((await runtime.app.inject({url:'/v1/provider/status',headers:{cookie:credentials.cookie,origin:'null'}})).statusCode,403);
    assert.equal((await runtime.app.inject({method:'DELETE',url:'/v1/session',headers:{cookie:credentials.cookie,origin}})).statusCode,403);
    assert.equal((await runtime.app.inject({method:'DELETE',url:'/v1/session',headers:credentials.headers})).statusCode,200);
    assert.equal((await runtime.app.inject({url:'/v1/session',headers:credentials.headers})).statusCode,401);
  }finally{await runtime.close();}
});
test('runtime verifies signed package bytes before granting declared permission and rejects forged principal',async()=>{
  const f=await fixture(),runtime=await createRuntime({trustRoots:f.roots});try{
    const credentials=await owner(runtime);const good=await install(runtime,credentials,f.packet);
    const expanded=await runtime.app.inject({method:'PUT',url:`/v1/installs/${good.installId}/grants`,headers:credentials.headers,payload:{generation:good.generation,grants:['invented-admin']}});assert.equal(expanded.statusCode,403);
    const mutated={...f.packet,signature:Buffer.alloc(64).toString('base64')};assert.equal((await runtime.app.inject({method:'POST',url:'/v1/installs',headers:credentials.headers,payload:{packet:mutated,grants:['summary']}})).statusCode,403);
    assert.equal((await runtime.app.inject({method:'POST',url:'/v1/runs',headers:credentials.headers,payload:{...runInput(good.installId,good.generation,'forged'),principal:'other-user'}})).statusCode,400);
    assert.equal((await runtime.app.inject({method:'POST',url:'/v1/network/request',headers:credentials.headers,payload:{installId:good.installId,generation:good.generation,grantId:'feed',url:'http://127.0.0.1/private',method:'GET'}})).statusCode,403);
    assert.equal((await runtime.app.inject({method:'POST',url:'/v1/runs',headers:credentials.headers,payload:runInput('missing-install',1,'missing')})).statusCode,403);
  }finally{await runtime.close();}
});
test('AI-06 durable admission deduplicates concurrent submits and never refunds a cancelled request',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pwacloud-runtime-budget-')),f=await fixture(2,1),provider=new CountingProvider(20),databasePath=join(directory,'runtime.sqlite');let runtime=await createRuntime({trustRoots:f.roots,provider,databasePath});
  try{
    let credentials=await owner(runtime);const registered=await install(runtime,credentials,f.packet);const request={method:'POST' as const,url:'/v1/runs',headers:credentials.headers,payload:runInput(registered.installId,registered.generation,'same-key')};
    const responses=await Promise.all(Array.from({length:10},()=>runtime.app.inject(request)));assert.equal(responses.filter(response=>response.statusCode===201).length,1);assert.equal(responses.filter(response=>response.statusCode===200).length,9);const runIds=new Set(responses.map(response=>parseAdmission(JSON.parse(response.body)).runId));assert.equal(runIds.size,1);assert.equal(provider.calls,1);const runId=[...runIds][0];assert.ok(runId);
    assert.equal((await runtime.app.inject({...request,payload:runInput(registered.installId,registered.generation,'concurrency-denied')})).statusCode,429);
    assert.equal((await runtime.app.inject({...request,payload:{...request.payload,input:'Changed data'}})).statusCode,409);
    assert.equal((await runtime.app.inject({method:'POST',url:`/v1/runs/${runId}/cancel`,headers:credentials.headers,payload:{}})).statusCode,200);
    await runtime.close();runtime=await createRuntime({trustRoots:f.roots,provider,databasePath});credentials=await owner(runtime);
    const replay=await runtime.app.inject({...request,headers:credentials.headers});assert.equal(replay.statusCode,200);assert.equal(parseAdmission(JSON.parse(replay.body)).runId,runId);assert.equal(provider.calls,1);
    const second=await runtime.app.inject({...request,headers:credentials.headers,payload:runInput(registered.installId,registered.generation,'second')});assert.equal(second.statusCode,201);await waitTerminal(runtime,credentials,parseAdmission(JSON.parse(second.body)).runId);
    const budget=await runtime.app.inject({...request,headers:credentials.headers,payload:runInput(registered.installId,registered.generation,'third')});assert.equal(budget.statusCode,429);assert.equal(provider.calls,2);
  }finally{await runtime.close();await rm(directory,{recursive:true,force:true});}
});
test('AI-07 FND-04 real HTTP synthetic SSE reconnect replays journal without duplicate provider execution',async()=>{
  const f=await fixture(),provider=new CountingProvider(25),port=await freePort(),base=`http://127.0.0.1:${port}`,runtime=await createRuntime({trustRoots:f.roots,provider,port,origin:base,demoInsecureCookie:true});
  try{
    await runtime.listen();const credentials=await owner(runtime,base),registered=await install(runtime,credentials,f.packet);
    const admission=await fetch(base+'/v1/runs',{method:'POST',headers:{...credentials.headers,'content-type':'application/json'},body:JSON.stringify(runInput(registered.installId,registered.generation,'http-stream'))});assert.equal(admission.status,201);const run=parseAdmission(await admission.json());
    const first=await fetch(base+`/v1/runs/${run.runId}/events`,{headers:{cookie:credentials.cookie,origin:base}});assert.equal(first.headers.get('content-type'),'text/event-stream');const reader=first.body?.getReader();assert.ok(reader);const parser=new SseParser();let last=0,firstText='';
    while(last<2){const chunk:ReadableStreamReadResult<Uint8Array>=await reader.read();assert.equal(chunk.done,false);assert.ok(chunk.value);for(const frame of parser.push(chunk.value)){const event=schema<{sequence:number;type:string;data:{text?:string}}>({type:'object',additionalProperties:true,required:['sequence','type','data'],properties:{sequence:{type:'integer'},type:{type:'string'},data:{type:'object',additionalProperties:true,properties:{text:{type:'string'}}}}})(JSON.parse(frame.data));last=event.sequence;firstText+=event.data.text??'';}}
    await reader.cancel();await waitTerminal(runtime,credentials,run.runId);
    const resumed=await fetch(base+`/v1/runs/${run.runId}/events`,{headers:{cookie:credentials.cookie,origin:base,'last-event-id':String(last)}});const replay=await resumed.text();const replayParser=new SseParser();const frames=[...replayParser.push(new TextEncoder().encode(replay)),...replayParser.finish()];assert.ok(frames.length>1);assert.ok(frames.every(frame=>Number(frame.id)>last));assert.equal(frames.at(-1)?.event,'completed');assert.equal(provider.calls,1);assert.ok(firstText.includes('synthetic-0'));assert.equal(replay.includes('synthetic-0 '),false);assert.ok(replay.includes('synthetic-7 '));
    const status=await runtime.app.inject({url:'/v1/provider/status',headers:credentials.headers});assert.match(status.body,/Synthetic demo AI/u);assert.equal(status.body.includes('access_token'),false);
  }finally{await runtime.close();}
});
test('last SSE disconnect cancels after bounded grace and retains journal plus admitted usage',async()=>{
  const f=await fixture(),provider=new CountingProvider(50),port=await freePort(),base=`http://127.0.0.1:${port}`,runtime=await createRuntime({trustRoots:f.roots,provider,port,origin:base,demoInsecureCookie:true,disconnectGraceMs:20});
  try{
    await runtime.listen();const credentials=await owner(runtime,base),registered=await install(runtime,credentials,f.packet);const admitted=await runtime.app.inject({method:'POST',url:'/v1/runs',headers:credentials.headers,payload:runInput(registered.installId,registered.generation,'disconnect-grace')});assert.equal(admitted.statusCode,201);const run=parseAdmission(JSON.parse(admitted.body));
    const stream=await fetch(base+`/v1/runs/${run.runId}/events`,{headers:credentials.headers}),reader=stream.body?.getReader();assert.ok(reader);const first=await reader.read();assert.equal(first.done,false);await reader.cancel();assert.equal((await waitTerminal(runtime,credentials,run.runId)).state,'cancelled');
    assert.match(String(runtime.database.prepare("SELECT payload_json FROM run_events WHERE run_id=? AND kind='cancelled'").get(run.runId)?.payload_json),/disconnected/u);assert.equal(runtime.database.prepare('SELECT count(*) AS count FROM usage_reservations').get()?.count,1);assert.equal(provider.calls,1);
    const replay=await fetch(base+`/v1/runs/${run.runId}/events`,{headers:credentials.headers});assert.equal(replay.status,200);assert.match(await replay.text(),/event: cancelled/u);assert.equal(provider.calls,1);
  }finally{await runtime.close();}
});
test('AI revocation stops delivery, stale generation, subscription and subsequent inference',async()=>{
  const f=await fixture(),provider=new CountingProvider(25),runtime=await createRuntime({trustRoots:f.roots,provider});try{
    const credentials=await owner(runtime),registered=await install(runtime,credentials,f.packet);const admitted=await runtime.app.inject({method:'POST',url:'/v1/runs',headers:credentials.headers,payload:runInput(registered.installId,registered.generation,'revocation')});const run=parseAdmission(JSON.parse(admitted.body));
    const revoked=await runtime.app.inject({method:'PUT',url:`/v1/installs/${registered.installId}/grants`,headers:credentials.headers,payload:{generation:registered.generation,grants:['feed']}});assert.equal(revoked.statusCode,200);assert.equal((await runtime.app.inject({url:`/v1/runs/${run.runId}/events`,headers:credentials.headers})).statusCode,403);
    const newGeneration=parseRegistered(JSON.parse(revoked.body)).generation;assert.equal((await runtime.app.inject({method:'POST',url:'/v1/runs',headers:credentials.headers,payload:runInput(registered.installId,newGeneration,'after-revoke')})).statusCode,403);
    const observed=runtime.database.prepare('SELECT state FROM runs WHERE id=?').get(run.runId);assert.deepEqual({...observed},{state:'cancelled'});assert.equal(provider.calls,1);
  }finally{await runtime.close();}
});
test('delayed signed registration cannot restore AI consent after a concurrent revocation',async()=>{
  const f=await fixture(20,1,true),provider=new CountingProvider();let hold=false,release:()=>void=()=>{},entered:()=>void=()=>{};
  const barrier=new Promise<void>(resolve=>{release=resolve;}),arrived=new Promise<void>(resolve=>{entered=resolve;});
  const runtime=await createRuntime({trustRoots:f.roots,provider,prepareGuest:async()=>{if(hold){entered();await barrier;}}});
  try{
    const credentials=await owner(runtime),registered=await install(runtime,credentials,f.packet);hold=true;
    const pending=runtime.app.inject({method:'POST',url:'/v1/installs',headers:credentials.headers,payload:{packet:f.packet,grants:['summary','feed'],expectedGeneration:registered.generation}}).then(response=>response);
    await arrived;
    const revoked=await runtime.app.inject({method:'PUT',url:`/v1/installs/${registered.installId}/grants`,headers:credentials.headers,payload:{generation:registered.generation,grants:['feed']}});assert.equal(revoked.statusCode,200,revoked.body);const current=parseRegistered(JSON.parse(revoked.body));
    release();assert.equal((await pending).statusCode,409);
    assert.equal((await runtime.app.inject({method:'POST',url:'/v1/installs',headers:credentials.headers,payload:{packet:f.packet,grants:['summary','feed']}})).statusCode,409);
    const registration=await runtime.app.inject({url:`/v1/installs/${registered.installId}/registration`,headers:credentials.headers});assert.equal(registration.statusCode,200);const actual=parseRegistration(JSON.parse(registration.body));assert.deepEqual(actual,{installId:registered.installId,generation:current.generation,state:'active',digest:actual.digest,grants:['feed']});
    assert.equal((await runtime.app.inject({method:'POST',url:'/v1/runs',headers:credentials.headers,payload:runInput(registered.installId,current.generation,'cannot-restore')})).statusCode,403);assert.equal(provider.calls,0);
    const unchanged=await runtime.app.inject({method:'POST',url:'/v1/installs',headers:credentials.headers,payload:{packet:f.packet,grants:['feed'],expectedGeneration:current.generation}});assert.equal(unchanged.statusCode,200);assert.equal(parseRegistered(JSON.parse(unchanged.body)).generation,current.generation);
  }finally{release();await runtime.close();}
});
test('registration CAS preserves uninstall tombstones and serializes competing consent approvals',async()=>{
  const f=await fixture(),provider=new CountingProvider(),runtime=await createRuntime({trustRoots:f.roots,provider});
  try{
    const credentials=await owner(runtime),registrationUrl=`/v1/installs/${f.manifest.id}/registration`;
    assert.equal((await runtime.app.inject({url:registrationUrl,headers:credentials.headers})).statusCode,404);
    assert.equal((await runtime.app.inject({method:'POST',url:'/v1/installs',headers:credentials.headers,payload:{packet:f.packet,grants:['summary'],expectedGeneration:1}})).statusCode,409);
    const registered=await install(runtime,credentials,f.packet);assert.equal((await runtime.app.inject({method:'DELETE',url:`/v1/installs/${registered.installId}`,headers:credentials.headers})).statusCode,400);assert.equal((await runtime.app.inject({method:'DELETE',url:`/v1/installs/${registered.installId}`,headers:credentials.headers,payload:{expectedGeneration:registered.generation}})).statusCode,200);
    const tombstone=await runtime.app.inject({url:registrationUrl,headers:credentials.headers});assert.equal(tombstone.statusCode,200);const parsed=parseRegistration(JSON.parse(tombstone.body));assert.equal(parsed.state,'uninstalled');assert.ok(parsed.generation>registered.generation);assert.deepEqual(parsed.grants,[]);
    for(const expectedGeneration of [undefined,0,registered.generation]){const response=await runtime.app.inject({method:'POST',url:'/v1/installs',headers:credentials.headers,payload:{packet:f.packet,grants:['summary','feed'],...(expectedGeneration===undefined?{}:{expectedGeneration})}});assert.equal(response.statusCode,409,response.body);}
    const reinstall=await runtime.app.inject({method:'POST',url:'/v1/installs',headers:credentials.headers,payload:{packet:f.packet,grants:['summary','feed'],expectedGeneration:parsed.generation}});assert.equal(reinstall.statusCode,200,reinstall.body);const restored=parseRegistered(JSON.parse(reinstall.body));assert.ok(restored.generation>parsed.generation);
    const staleDelete=await runtime.app.inject({method:'DELETE',url:`/v1/installs/${registered.installId}`,headers:credentials.headers,payload:{expectedGeneration:parsed.generation}});assert.equal(staleDelete.statusCode,409);assert.equal(parseRegistration(JSON.parse((await runtime.app.inject({url:registrationUrl,headers:credentials.headers})).body)).generation,restored.generation);
    for(const generation of [registered.generation,parsed.generation])assert.equal((await runtime.app.inject({method:'POST',url:'/v1/runs',headers:credentials.headers,payload:runInput(registered.installId,generation,'old-generation-'+generation)})).statusCode,403);
    const competing=await Promise.all([['summary'],['feed']].map(grants=>runtime.app.inject({method:'POST',url:'/v1/installs',headers:credentials.headers,payload:{packet:f.packet,grants,expectedGeneration:restored.generation}})));assert.deepEqual(competing.map(response=>response.statusCode).sort(),[200,409]);
    const successful=competing.find(response=>response.statusCode===200);assert.ok(successful);const final=parseRegistered(JSON.parse(successful.body));assert.equal(final.generation,restored.generation+1);
    const state=await runtime.app.inject({url:registrationUrl,headers:credentials.headers});assert.equal(parseRegistered(JSON.parse(state.body)).generation,final.generation);assert.equal(runtime.database.prepare('SELECT count(*) AS count FROM grants WHERE generation<>?').get(final.generation)?.count,0);assert.equal(provider.calls,0);
    assert.equal((await runtime.app.inject({url:registrationUrl,headers:{...credentials.headers,origin:'null'}})).statusCode,403);
    runtime.database.prepare('UPDATE installs SET receipt_expires_at=0 WHERE id=?').run(registered.installId);
    assert.equal((await runtime.app.inject({method:'DELETE',url:`/v1/installs/${registered.installId}`,headers:credentials.headers,payload:{expectedGeneration:final.generation}})).statusCode,200);
    const removed=await runtime.app.inject({url:registrationUrl,headers:credentials.headers});assert.equal(parseRegistration(JSON.parse(removed.body)).generation,final.generation+1);assert.equal(parseRegistration(JSON.parse(removed.body)).state,'uninstalled');
  }finally{await runtime.close();}
});
test('local output delivery and elapsed limits retain durable admitted usage without claiming refunds',async()=>{
  const f=await fixture(),provider=new CountingProvider(10),runtime=await createRuntime({trustRoots:f.roots,provider,maximumOutputBytes:10});try{
    const credentials=await owner(runtime),registered=await install(runtime,credentials,f.packet);const admitted=await runtime.app.inject({method:'POST',url:'/v1/runs',headers:credentials.headers,payload:runInput(registered.installId,registered.generation,'output-limit')});const run=parseAdmission(JSON.parse(admitted.body));assert.equal((await waitTerminal(runtime,credentials,run.runId)).state,'failed');const emitted=runtime.database.prepare("SELECT count(*) AS count FROM run_events WHERE run_id=? AND kind='delta'").get(run.runId);assert.deepEqual({...emitted},{count:0});assert.equal(runtime.database.prepare('SELECT count(*) AS count FROM usage_reservations WHERE run_id=?').get(run.runId)?.count,1);
    const tooLarge=await runtime.app.inject({method:'POST',url:'/v1/runs',headers:credentials.headers,payload:{...runInput(registered.installId,registered.generation,'oversize'),input:'x'.repeat(300000)}});assert.equal(tooLarge.statusCode,413);
  }finally{await runtime.close();}
  const timed=await createRuntime({trustRoots:f.roots,provider:new CountingProvider(100),maximumElapsedMs:20});try{const credentials=await owner(timed),registered=await install(timed,credentials,f.packet);const response=await timed.app.inject({method:'POST',url:'/v1/runs',headers:credentials.headers,payload:runInput(registered.installId,registered.generation,'deadline')});const run=parseAdmission(JSON.parse(response.body));assert.equal((await waitTerminal(timed,credentials,run.runId)).state,'cancelled');assert.match(String(timed.database.prepare("SELECT payload_json FROM run_events WHERE run_id=? AND kind='cancelled'").get(run.runId)?.payload_json),/timeout/u);}finally{await timed.close();}
});
test('runtime restart preserves interrupted journal and refuses automatic resubmission',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pwacloud-runtime-interrupted-')),f=await fixture(),databasePath=join(directory,'runtime.sqlite');let runtime=await createRuntime({trustRoots:f.roots,databasePath});try{
    const credentials=await owner(runtime),registered=await install(runtime,credentials,f.packet);const admitted=await runtime.app.inject({method:'POST',url:'/v1/runs',headers:credentials.headers,payload:runInput(registered.installId,registered.generation,'restart-key')});const run=parseAdmission(JSON.parse(admitted.body));await runtime.close();runtime=await createRuntime({trustRoots:f.roots,databasePath});const resumed=await owner(runtime);const replay=await runtime.app.inject({method:'POST',url:'/v1/runs',headers:resumed.headers,payload:runInput(registered.installId,registered.generation,'restart-key')});assert.equal(replay.statusCode,200);assert.equal(parseAdmission(JSON.parse(replay.body)).runId,run.runId);assert.equal(parseAdmission(JSON.parse(replay.body)).state,'interrupted');
  }finally{await runtime.close();await rm(directory,{recursive:true,force:true});}
});
test('AI-10 hosted, VM, insecure phone and flag-only HTTPS modes fail closed',async()=>{
  await assert.rejects(createRuntime({mode:'approved-hosted'}),error=>error instanceof ProviderError&&error.code==='policy-blocked');await assert.rejects(createRuntime({mode:'self-hosted-vm'}),error=>error instanceof ProviderError&&error.code==='policy-blocked');await assert.rejects(createRuntime({host:'0.0.0.0',origin:'http://phone.example'}),error=>error instanceof ProviderError&&error.code==='policy-blocked');await assert.rejects(createRuntime({origin:'https://127.0.0.1:4173'}),error=>error instanceof ProviderError&&error.code==='policy-blocked');
});
test('pairing uses real TLS listener, one-use expiry, attempt limits and only app session authority',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pwacloud-runtime-tls-'));let runtime:Runtime|undefined;try{
    const openssl=process.platform==='win32'?'C:/Program Files/Git/usr/bin/openssl.exe':'openssl',key=join(directory,'synthetic.key'),cert=join(directory,'synthetic.crt');execFileSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore',windowsHide:true});
    let clock=Date.now();const port=await freePort(),base=`https://127.0.0.1:${port}`,certificate=await readFile(cert,'utf8');runtime=await createRuntime({port,origin:base,tls:{cert:certificate,key:await readFile(key,'utf8')},now:()=>clock});await runtime.listen();const credentials=await owner(runtime,base);
    const health=await new Promise<string>((resolve,reject)=>{httpsRequest(base+'/health',{ca:certificate},response=>{let body='';response.on('data',(chunk:Buffer)=>{body+=chunk.toString();});response.on('end',()=>resolve(body));}).on('error',reject).end();});assert.match(health,/"ok":true/u);
    const invitation=await runtime.app.inject({method:'POST',url:'/v1/pairing/invitations',headers:credentials.headers,payload:{confirmAccountGeneration:credentials.session.generation}});assert.equal(invitation.statusCode,200);const parse=schema<{code:string;expiresAt:number}>({type:'object',additionalProperties:true,required:['code','expiresAt'],properties:{code:{type:'string'},expiresAt:{type:'integer'}}});const issued=parse(JSON.parse(invitation.body));assert.ok(issued.code.length>=43);
    const claimed=await runtime.app.inject({method:'POST',url:'/v1/pairing/claim',headers:{origin:base},payload:{code:issued.code}});assert.equal(claimed.statusCode,200);assert.match(String(claimed.headers['set-cookie']??''),/__Host-pwacloud-session/u);assert.equal(claimed.body.includes('token'),false);assert.equal(claimed.body.includes(issued.code),false);
    assert.equal((await runtime.app.inject({method:'POST',url:'/v1/pairing/claim',headers:{origin:base},payload:{code:issued.code}})).statusCode,403);
    const expired=await runtime.app.inject({method:'POST',url:'/v1/pairing/invitations',headers:credentials.headers,payload:{confirmAccountGeneration:credentials.session.generation}});clock+=120001;assert.equal((await runtime.app.inject({method:'POST',url:'/v1/pairing/claim',headers:{origin:base},payload:{code:parse(JSON.parse(expired.body)).code}})).statusCode,403);
    for(let attempt=0;attempt<5;attempt++)await runtime.app.inject({method:'POST',url:'/v1/pairing/claim',headers:{origin:base},payload:{code:'synthetic-invalid'}});assert.equal((await runtime.app.inject({method:'POST',url:'/v1/pairing/claim',headers:{origin:base},payload:{code:'synthetic-invalid'}})).statusCode,429);
  }finally{await runtime?.close();await rm(directory,{recursive:true,force:true});}
});
