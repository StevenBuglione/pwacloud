import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm,mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { createServer } from 'node:net';
import { parse as parseComponent } from '@bytecodealliance/jco';
import { createRuntime } from '../../apps/personal-runtime/src/index.ts';
import { createEnvelope,encodeInstallPacket,exactBuffer,sha256,type TrustRoot } from '../../packages/package-verifier/src/index.ts';
import { validateManifest,type Receipt } from '../../packages/contracts/src/index.ts';
import { schema } from '../../packages/provider-chatgpt/src/schema.ts';
import { prepareGuestComponent } from '../../packages/runtime-web/src/transform.ts';

async function availablePort():Promise<number>{const listener=createServer();await new Promise<void>(resolve=>listener.listen(0,'127.0.0.1',resolve));const address=listener.address();assert.ok(address&&typeof address!=='string');await new Promise<void>((resolve,reject)=>listener.close(error=>error?reject(error):resolve()));return address.port;}
async function publisher(){
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const root:TrustRoot={keyId:'synthetic-loader-publisher',publisherIdentity:'synthetic-loader-fixture',policyVersion:'synthetic-v1',demoOnly:true,publicKey:await crypto.subtle.exportKey('jwk',keys.publicKey)};
  return {root,async packet(component:Uint8Array,maximumMemory:number){
    const manifest=validateManifest(JSON.parse(await readFile('examples/manifests/notebook.json','utf8')));assert.ok(manifest.service);manifest.service.maxLinearMemoryMiB=maximumMemory;
    const files={'manifest.json':new TextEncoder().encode(JSON.stringify(manifest)),[manifest.service.entry]:component,'ui/app.js':new TextEncoder().encode('// Synthetic package UI; never loaded by this transport test.'),'ui/style.css':new TextEncoder().encode('body{font:16px system-ui}'),'build-report.json':new TextEncoder().encode('{"kind":"synthetic-loader-test","jco":"1.34.0"}')};
    const built=await createEnvelope(files,'b'.repeat(40));const receipt:Receipt={format:'pwacloud.verification.v1',keyId:root.keyId,pluginId:manifest.id,version:manifest.version,archiveSha256:built.envelope.archive.sha256,manifestSha256:built.envelope.manifestSha256,publisherIdentity:root.publisherIdentity,policyVersion:root.policyVersion,verifiedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),revocationSequence:0};const receiptBytes=new TextEncoder().encode(JSON.stringify(receipt));
    return encodeInstallPacket({...built,receiptBytes,signature:new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,exactBuffer(receiptBytes))),envelopeSignature:new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,exactBuffer(built.envelopeBytes)))});
  }};
}
function tlsFetch(url:string,certificate:string,method='GET',headers:Record<string,string>={},body?:unknown):Promise<{status:number;headers:Record<string,string|string[]|undefined>;body:string;bytes:Uint8Array}>{
  return new Promise((resolve,reject)=>{
    const request=httpsRequest(url,{ca:certificate,method,headers:{...headers,...(body===undefined?{}:{'content-type':'application/json'})}},response=>{const chunks:Buffer[]=[];response.on('data',(chunk:Buffer)=>{chunks.push(chunk);});response.on('end',()=>{const bytes=Buffer.concat(chunks);resolve({status:response.statusCode??0,headers:response.headers,body:bytes.toString('utf8'),bytes});});});request.on('error',reject);request.end(body===undefined?undefined:JSON.stringify(body));
  });
}
test('HTTPS signed installation prepares a real component using trusted Jco and refuses cached weaker limits or host imports',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pwacloud-real-loader-'));const artifactRoot=join(directory,'artifacts'),browserRoot=join(artifactRoot,'guest','browser');await mkdir(browserRoot,{recursive:true});const key=join(directory,'synthetic.key'),cert=join(directory,'synthetic.crt'),openssl=process.platform==='win32'?'C:/Program Files/Git/usr/bin/openssl.exe':'openssl';
  execFileSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore',windowsHide:true});
  const certificate=await readFile(cert,'utf8'),port=await availablePort(),origin=`https://127.0.0.1:${port}`,signer=await publisher(),runtime=await createRuntime({origin,port,artifactRoot,trustRoots:[signer.root],tls:{cert:certificate,key:await readFile(key,'utf8')},prepareGuest:pkg=>prepareGuestComponent(pkg,browserRoot)});
  try{
    await runtime.listen();const session=await tlsFetch(origin+'/v1/session/local',certificate,'POST',{origin},{});assert.equal(session.status,200,session.body);const parsed=schema<{csrfToken:string}>({type:'object',additionalProperties:true,required:['csrfToken'],properties:{csrfToken:{type:'string'}}})(JSON.parse(session.body));const cookies=session.headers['set-cookie'];assert.ok(cookies);const cookie=(Array.isArray(cookies)?cookies[0]:cookies)?.split(';')[0];assert.ok(cookie);const headers={origin,cookie,'x-csrf-token':parsed.csrfToken};
    const component=new Uint8Array(await readFile('artifacts/guest/component.wasm')),packet=await signer.packet(component,64);
    assert.equal((await tlsFetch(origin+'/v1/installs',certificate,'POST',{...headers,origin:'null'},{packet,grants:['notes']})).status,403);
    assert.equal((await tlsFetch(origin+'/v1/installs',certificate,'POST',{origin,cookie},{packet,grants:['notes']})).status,403);
    const installed=await tlsFetch(origin+'/v1/installs',certificate,'POST',headers,{packet,grants:['notes']});assert.equal(installed.status,200,installed.body);
    const allowed=await tlsFetch(origin+'/guest/allowed.json',certificate);assert.equal(allowed.status,200);const catalog=schema<{format:string;components:Record<string,string>}>({type:'object',additionalProperties:false,required:['format','components'],properties:{format:{const:'pwacloud.loader.v1'},components:{type:'object',propertyNames:{pattern:'^[a-f0-9]{64}$'},additionalProperties:{type:'string',pattern:'^/guest/[a-f0-9]{64}/worker\\.js\\?v=[a-f0-9]{64}$'}}}})(JSON.parse(allowed.body));const digest=await sha256(component),workerUrl=catalog.components[digest];assert.ok(workerUrl);const worker=await tlsFetch(origin+workerUrl,certificate);assert.equal(worker.status,200);assert.match(worker.body,/WebAssembly/u);assert.equal(await sha256(worker.bytes),new URL(workerUrl,origin).searchParams.get('v'));
    const generated=await readFile(join(browserRoot,digest,'verified.json'),'utf8');assert.match(generated,/maxDeclaredLinearBytes/u);assert.match(generated,/lifecycle/u);
    const lower=await tlsFetch(origin+'/v1/installs',certificate,'POST',headers,{packet:await signer.packet(component,1),grants:['notes']});assert.equal(lower.status,403,lower.body);
    const imported=await parseComponent('(component (type $f (func)) (import "evil" (func (type $f))))');const denied=await tlsFetch(origin+'/v1/installs',certificate,'POST',headers,{packet:await signer.packet(imported,64),grants:['notes']});assert.equal(denied.status,403,denied.body);
    const missingToken=await tlsFetch(origin+'/v1/network/request',certificate,'POST',{origin},{installId:'dev.stevenbuglione.notebook',generation:1,grantId:'feed',url:'https://example.com',method:'GET'});assert.equal(missingToken.status,401);assert.equal((await tlsFetch(origin+'/v1/network/request',certificate,'POST',{...headers,origin:'null'},{installId:'dev.stevenbuglione.notebook',generation:1,grantId:'feed',url:'https://example.com',method:'GET'})).status,403);
  }finally{await runtime.close();await rm(directory,{recursive:true,force:true});}
});
