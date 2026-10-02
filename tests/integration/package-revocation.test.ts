import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRuntime} from '../../apps/personal-runtime/src/index';
import {SignedCataloguePolicySource} from '../../apps/personal-runtime/src/receipt-authority';
import {signedFixture} from '../production/package-fixture';
import {createEnvelope,encodeInstallPacket,verifyPackage,type RevocationPolicy} from '../../packages/package-verifier/src/index';
import type {Catalogue} from '../../apps/catalogue/src/index';

const origin='http://127.0.0.1:4173';
async function owner(runtime:Awaited<ReturnType<typeof createRuntime>>){const response=await runtime.app.inject({method:'POST',url:'/v1/session/local',headers:{origin},payload:{}});assert.equal(response.statusCode,200);const value:unknown=JSON.parse(response.body);assert.ok(typeof value==='object'&&value!==null&&'csrfToken'in value&&typeof value.csrfToken==='string');const cookie=response.cookies[0];assert.ok(cookie);return{origin,cookie:`${cookie.name}=${cookie.value}`,'x-csrf-token':value.csrfToken};}
async function sourceFixture(){const directory=await mkdtemp(join(tmpdir(),'pwacloud-signed-catalogue-')),fixture=await signedFixture();const options={bytesPath:join(directory,'catalogue.json'),signaturePath:join(directory,'catalogue.sig'),cachePath:join(directory,'signed-cache.json'),roots:[fixture.root],allowDemo:true};const source=new SignedCataloguePolicySource(options);
  const publish=async(sequence:number,revokedDigests:string[]=[],expiresAt='2027-01-01T00:00:00Z')=>{const catalogue:Catalogue={format:'pwacloud.catalogue.v1',keyId:fixture.root.keyId,sequence,issuedAt:'2026-01-01T00:00:00Z',expiresAt,revokedDigests,entries:[]};const bytes=new TextEncoder().encode(JSON.stringify(catalogue));await writeFile(options.bytesPath,bytes);await writeFile(options.signaturePath,await fixture.sign(bytes));};return{directory,fixture,options,source,publish};}

test('runtime independently authenticates catalogue and rejects stale revoked and expired signed install packets',async()=>{
  const f=await sourceFixture();await f.publish(4);const runtime=await createRuntime({trustRoots:[f.fixture.root],revocationPolicy:()=>f.source.current()});
  try{const headers=await owner(runtime),packet=encodeInstallPacket(f.fixture.input);const initial=await runtime.app.inject({method:'POST',url:'/v1/installs',headers,payload:{packet,grants:[]}});assert.equal(initial.statusCode,200,initial.body);const before=runtime.database.prepare('SELECT * FROM installs').get();
    for(const [sequence,revoked,expiry,code] of [[5,[],'2027-01-01T00:00:00Z','stale-revocation'],[6,[f.fixture.envelope.archive.sha256],'2027-01-01T00:00:00Z','revoked-package'],[7,[],'2026-02-01T00:00:00Z','expired-revocation']] as const){await f.publish(sequence,[...revoked],expiry);const response=await runtime.app.inject({method:'POST',url:'/v1/installs',headers,payload:{packet,grants:[],expectedGeneration:1}});assert.equal(response.statusCode,403,response.body);assert.equal(JSON.parse(response.body).code,code);assert.deepEqual(runtime.database.prepare('SELECT * FROM installs').get(),before);}
  }finally{await runtime.close();await rm(f.directory,{recursive:true,force:true});}
});

test('signed catalogue sequence survives source recreation and concurrent refresh; expired cache cannot disappear',async()=>{
  const f=await sourceFixture();try{await f.publish(8,['b'.repeat(64)]);const observed=await Promise.all(Array.from({length:8},()=>f.source.current()));assert.ok(observed.every(policy=>policy.sequence===8));const restarted=new SignedCataloguePolicySource(f.options);await f.publish(7);await assert.rejects(()=>restarted.current(),/stale-catalogue/);await f.publish(9,[],'2026-02-01T00:00:00Z');assert.equal((await restarted.current()).sequence,9);await rm(f.options.bytesPath);await rm(f.options.signaturePath);const retained=await new SignedCataloguePolicySource(f.options).current();assert.equal(retained.sequence,9);assert.equal(retained.expiresAt,'2026-02-01T00:00:00Z');}finally{await rm(f.directory,{recursive:true,force:true});}
});

test('runtime rechecks revocation after real-component preparation and before durable registration',async()=>{
  const f=await signedFixture(),files={...f.files,'service/component.wasm':new Uint8Array(await readFile('artifacts/guest/component.wasm')),'build-report.json':new TextEncoder().encode('{"fixture":"actual-component-revocation-race","jco":"1.34.0"}')};files['manifest.json']=new TextEncoder().encode(JSON.stringify({...f.manifest,service:{entry:'service/component.wasm',world:'pwacloud:plugin/guest@0.1.0',maxLinearMemoryMiB:64}}));const built=await createEnvelope(files,'a'.repeat(40));const receiptBytes=new TextEncoder().encode(JSON.stringify({...f.receipt,archiveSha256:built.envelope.archive.sha256,manifestSha256:built.envelope.manifestSha256}));const packet=encodeInstallPacket({archiveBytes:built.archiveBytes,envelopeBytes:built.envelopeBytes,receiptBytes,signature:await f.sign(receiptBytes),envelopeSignature:await f.sign(built.envelopeBytes)});await verifyPackage({archiveBytes:built.archiveBytes,envelopeBytes:built.envelopeBytes,receiptBytes,signature:await f.sign(receiptBytes),envelopeSignature:await f.sign(built.envelopeBytes)},[f.root],{allowDemo:true});
  let policy:RevocationPolicy={sequence:4,issuedAt:'2026-01-01T00:00:00Z',expiresAt:'2027-01-01T00:00:00Z',revokedDigests:[]},release:()=>void=()=>{},arrived:()=>void=()=>{};const barrier=new Promise<void>(resolve=>{release=resolve;}),entered=new Promise<void>(resolve=>{arrived=resolve;});const runtime=await createRuntime({trustRoots:[f.root],revocationPolicy:()=>policy,prepareGuest:async()=>{arrived();await barrier;}});
  try{const headers=await owner(runtime);const pending=runtime.app.inject({method:'POST',url:'/v1/installs',headers,payload:{packet,grants:[]}}).then(response=>response);await entered;policy={...policy,sequence:5,revokedDigests:[built.envelope.archive.sha256]};release();const response=await pending;assert.equal(response.statusCode,403,response.body);assert.equal(JSON.parse(response.body).code,'revoked-package');assert.equal(runtime.database.prepare('SELECT count(*) AS count FROM installs').get()?.count,0);assert.equal(runtime.database.prepare('SELECT count(*) AS count FROM grants').get()?.count,0);}finally{release();await runtime.close();}
});

test('runtime exposes absent trusted catalogue as unknown instead of inventing revocation assurance',async()=>{
  const runtime=await createRuntime();try{const headers=await owner(runtime);const response=await runtime.app.inject({url:'/v1/catalogue/policy',headers});assert.equal(response.statusCode,200);assert.deepEqual(JSON.parse(response.body),{state:'unknown'});}finally{await runtime.close();}
});
