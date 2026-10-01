import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createHttpAiTransport} from '../../packages/controller/src/index.ts';
import {PlatformError,type Permission} from '../../packages/contracts/src/index.ts';
import type {InstalledPlugin} from '../../packages/storage/src/index.ts';
import {signedFixture} from './package-fixture.ts';

type TransportStorage=Parameters<typeof createHttpAiTransport>[1];
class SyntheticStorage implements TransportStorage {
  private values=new Map<string,unknown>();private generation:number;
  constructor(public installation:InstalledPlugin|undefined){this.generation=installation?.generation??0;}
  async getInstall(){return this.installation?structuredClone(this.installation):undefined;}
  async lastGeneration(){return this.generation;}
  async get(namespace:string,key:string){return this.values.get(namespace+'\0'+key)??null;}
  async list(namespace:string){return [...this.values].filter(([key])=>key.startsWith(namespace+'\0')).map(([key,value])=>({key:key.slice(namespace.length+1),value}));}
  async put(namespace:string,key:string,value:unknown){this.values.set(namespace+'\0'+key,structuredClone(value));}
  async delete(namespace:string,key:string){this.values.delete(namespace+'\0'+key);}
  change(grants:string[]){assert.ok(this.installation);this.generation++;this.installation={...this.installation,generation:this.generation,revision:this.installation.revision+1,grants};return structuredClone(this.installation);}
  remove(){assert.ok(this.installation);this.generation=this.installation.generation+1;this.installation=undefined;}
  reinstall(previous:InstalledPlugin){this.generation++;this.installation={...previous,generation:this.generation,revision:previous.revision+1};return structuredClone(this.installation);}
}
const permissions:Permission[]=[{id:'cache',capability:'storage.kv',required:true,scope:{quotaBytes:1048576}},{id:'summary',capability:'ai.respond',required:false,scope:{context:'selected-resources',requestsPerHour:20,concurrency:1,background:false}},{id:'secondary',capability:'network.http',required:false,scope:{rules:[{origin:'https://example.com',methods:['GET'],pathPrefixes:['/feed/']}]}}];
async function protocolFixture(){
  const f=await signedFixture({id:'dev.synthetic.removal-intent',permissions});const pkg={manifest:f.manifest,envelope:f.envelope,receipt:f.receipt,files:f.files,packet:f.input};
  const local:InstalledPlugin={manifest:f.manifest,digest:f.envelope.archive.sha256,generation:1,revision:1,grants:['cache','summary','secondary'],enabled:true,state:'ready',receipt:f.receipt};
  const storage=new SyntheticStorage(local),originalFetch=globalThis.fetch;let offline=false,csrf='synthetic-session-one';let remote={installId:local.manifest.id,digest:local.digest,generation:1,state:'active',grants:[...local.grants]};const calls:{method:string;path:string;body:unknown}[]=[];
  const bodySchema=z.strictObject({generation:z.number().int().positive(),grants:z.array(z.string())}),deleteSchema=z.strictObject({expectedGeneration:z.number().int().positive()}),approvalSchema=z.object({expectedGeneration:z.number().int().nonnegative(),grants:z.array(z.string())});
  globalThis.fetch=async(input,init)=>{const path=typeof input==='string'?input:input instanceof URL?input.pathname:input.url,method=init?.method??'GET',body:unknown=typeof init?.body==='string'?JSON.parse(init.body):null;calls.push({method,path,body});if(offline)throw new TypeError('Synthetic offline protocol fixture');
    if(method==='GET'&&path.endsWith('/registration'))return Response.json(remote);
    if(method==='PUT'&&path.endsWith('/grants')){const value=bodySchema.parse(body);if(value.generation!==remote.generation)return Response.json({code:'conflict'},{status:409});remote={...remote,generation:remote.generation+1,grants:value.grants};return Response.json({installId:remote.installId,generation:remote.generation,grants:remote.grants});}
    if(method==='DELETE'){const value=deleteSchema.parse(body);if(value.expectedGeneration!==remote.generation)return Response.json({code:'conflict'},{status:409});remote={...remote,generation:remote.generation+1,state:'uninstalled',grants:[]};return Response.json({uninstalled:true,generation:remote.generation});}
    if(path==='/v1/installs'){const value=approvalSchema.parse(body);if(value.expectedGeneration!==remote.generation)return Response.json({code:'conflict'},{status:409});if(JSON.stringify([...value.grants].sort())!==JSON.stringify([...remote.grants].sort()))remote={...remote,generation:remote.generation+1,grants:value.grants};return Response.json({installId:remote.installId,generation:remote.generation,grants:remote.grants});}
    if(path==='/v1/runs')return remote.grants.includes('summary')?Response.json({runId:'synthetic-run',state:'reserved'}):Response.json({code:'permission-denied'},{status:403});throw new Error('Unexpected synthetic transport endpoint');
  };
  const transport=createHttpAiTransport(async()=>csrf,storage),start=(client=transport,install=storage.installation)=>{assert.ok(install);return client.start(install,{requestId:'synthetic-request',model:'demo-synthetic',prompt:'Synthetic removal protocol check.'},new AbortController().signal);};
  return {pkg,local,storage,transport,calls,start,get remote(){return remote;},set remote(value:typeof remote){remote=value;},set offline(value:boolean){offline=value;},set csrf(value:string){csrf=value;},fresh:()=>createHttpAiTransport(async()=>csrf,storage),async seed(){await transport.register?.(local,pkg,true);await start();calls.length=0;},async queued(){return(await storage.list('host')).filter(record=>record.key.startsWith('runtime-removal/'));},restore(){globalThis.fetch=originalFetch;}};
}
const consent=(error:unknown)=>error instanceof PlatformError&&error.code==='consent-required';
test('transport persists a known offline revocation and never restores the removed AI grant',async()=>{
  const f=await protocolFixture();try{await f.seed();const revoked=f.storage.change(['cache','secondary']);f.offline=true;await f.transport.revoke?.(revoked,'summary');assert.equal((await f.queued()).length,1);f.offline=false;const fresh=f.fresh();await fresh.register?.(revoked,f.pkg,false);assert.equal((await f.queued()).length,0);assert.deepEqual(f.remote.grants,['cache','secondary']);await assert.rejects(f.start(fresh,revoked),error=>error instanceof PlatformError&&error.code==='permission-denied');assert.equal(f.calls.filter(call=>call.method==='PUT').length,1);assert.ok(f.calls.filter(call=>call.path==='/v1/installs').every(call=>!approvalGrants(call.body).includes('summary')));}finally{f.restore();}
});
function approvalGrants(value:unknown){return z.object({grants:z.array(z.string())}).parse(value).grants;}
test('transport discards an offline uninstall after a later local reinstall',async()=>{
  const f=await protocolFixture();try{await f.seed();f.offline=true;await f.transport.uninstall?.(f.local.manifest.id);f.storage.remove();const reinstalled=f.storage.reinstall(f.local);f.remote={...f.remote,generation:3};f.offline=false;const fresh=f.fresh();await fresh.register?.(reinstalled,f.pkg,false);assert.equal((await f.queued()).length,0);assert.equal(f.calls.filter(call=>call.method==='DELETE').length,0);assert.equal(f.remote.state,'active');assert.equal(f.remote.generation,3);}finally{f.restore();}
});
test('transport retains a stale offline uninstall without targeting a newer remote approval',async()=>{
  const f=await protocolFixture();try{await f.seed();f.offline=true;await f.transport.uninstall?.(f.local.manifest.id);f.storage.remove();f.remote={...f.remote,generation:4};f.offline=false;await f.fresh().uninstall?.(f.local.manifest.id);assert.equal((await f.queued()).length,1);assert.equal(f.calls.filter(call=>call.method==='DELETE').length,0);assert.equal(f.remote.state,'active');assert.equal(f.remote.generation,4);}finally{f.restore();}
});
test('transport cannot apply queued consent to a different runtime session or account fence',async()=>{
  const f=await protocolFixture();try{await f.seed();const revoked=f.storage.change(['cache','secondary']);f.offline=true;await f.transport.revoke?.(revoked,'summary');f.csrf='synthetic-session-two';f.offline=false;const fresh=f.fresh();await fresh.register?.(revoked,f.pkg,false);await assert.rejects(f.start(fresh,revoked),consent);assert.equal((await f.queued()).length,0);assert.equal(f.calls.filter(call=>call.method==='PUT').length,0);assert.equal(f.calls.filter(call=>call.path==='/v1/installs').length,0);assert.ok(f.remote.grants.includes('summary'));assert.equal(f.storage.installation?.grants.includes('summary'),false);}finally{f.restore();}
});
test('transport with no observed remote baseline stays revoked until a later explicit permission review',async()=>{
  const f=await protocolFixture();try{await f.transport.register?.(f.local,f.pkg,false);const revoked=f.storage.change(['cache','secondary']);f.offline=true;await f.transport.revoke?.(revoked,'summary');f.offline=false;await f.transport.register?.(revoked,f.pkg,false);await assert.rejects(f.start(f.transport,revoked),consent);assert.equal((await f.queued()).length,1);assert.equal(f.calls.filter(call=>call.method==='PUT'||call.path==='/v1/installs').length,0);const reviewed=f.storage.change(['cache','secondary']);await f.transport.register?.(reviewed,f.pkg,true);await assert.rejects(f.start(f.transport,reviewed),error=>error instanceof PlatformError&&error.code==='permission-denied');assert.equal((await f.queued()).length,0);assert.equal(f.remote.grants.includes('summary'),false);}finally{f.restore();}
});
test('transport replays multiple restrictive intents using only generations returned by its own CAS',async()=>{
  const f=await protocolFixture();try{await f.seed();f.offline=true;await f.transport.revoke?.(f.storage.change(['cache','secondary']),'summary');const revoked=f.storage.change(['cache']);await f.transport.revoke?.(revoked,'secondary');assert.equal((await f.queued()).length,2);f.offline=false;await f.fresh().register?.(revoked,f.pkg,false);assert.equal((await f.queued()).length,0);assert.deepEqual(f.remote.grants,['cache']);assert.deepEqual(f.calls.filter(call=>call.method==='PUT').map(call=>z.object({generation:z.number()}).parse(call.body).generation),[1,2]);}finally{f.restore();}
});
test('transport requires a fresh review when the runtime session changes before pending approval',async()=>{
  const f=await protocolFixture();try{f.local.grants=['cache','summary'];f.remote={...f.remote,grants:['cache','summary']};await f.seed();const reviewed=f.storage.change(['cache','summary','secondary']);await f.transport.register?.(reviewed,f.pkg,true);f.csrf='synthetic-changed-account-session';await assert.rejects(f.start(f.transport,reviewed),consent);assert.equal(f.calls.filter(call=>call.path==='/v1/installs').length,0);assert.deepEqual(f.remote.grants,['cache','summary']);}finally{f.restore();}
});
