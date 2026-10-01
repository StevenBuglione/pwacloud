import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createEnvelope,type TrustRoot } from '../../packages/package-verifier/src/index.ts';
import { validateManifest,PlatformError } from '../../packages/contracts/src/index.ts';
import { LocalReceiptAuthority } from '../../apps/personal-runtime/src/receipt-authority.ts';
import { createRuntime } from '../../apps/personal-runtime/src/index.ts';
import { ProviderError,type InferenceProvider } from '../../packages/provider-chatgpt/src/index.ts';

test('local receipt issuer protects and reuses its own key but never admits missing public Sigstore evidence',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pwacloud-receipt-authority-'));try{
    const keyPath=join(directory,'separate-local-protection-key');await writeFile(keyPath,randomBytes(32),{mode:0o600});const roots:TrustRoot[]=[];
    const trustLoader=async()=>({certificateAuthorities:[],timestampAuthorities:[],tlogs:[],ctlogs:[],publicKey(){throw new Error('No synthetic trust authority');}});
    const options={directory,roots,encryptionKeyPath:process.platform==='win32'?undefined:keyPath,trustLoader};const issuer=new LocalReceiptAuthority(options);await issuer.loadRoots();
    const manifest=validateManifest(JSON.parse(await readFile('examples/manifests/notebook.json','utf8')));assert.ok(manifest.service);const built=await createEnvelope({'manifest.json':new TextEncoder().encode(JSON.stringify(manifest)),[manifest.service.entry]:new Uint8Array(await readFile('artifacts/guest/component.wasm')),'ui/app.js':new TextEncoder().encode('// Synthetic attestation-negative fixture'),'ui/style.css':new TextEncoder().encode('body{}'),'build-report.json':new TextEncoder().encode('{"synthetic":true}')},'c'.repeat(40));
    const release={input:{archiveBytes:built.archiveBytes,envelopeBytes:built.envelopeBytes,archiveBundle:{},envelopeBundle:{},provenanceBundle:{}},sourceCommit:'c'.repeat(40),sourceRef:'refs/tags/fixture-only'};
    await assert.rejects(issuer.issue(release),error=>error instanceof PlatformError&&error.code==='invalid-sigstore-signature');assert.deepEqual(roots,[]);const encrypted=await readFile(join(directory,'receipt-private-key.encrypted'));assert.equal(encrypted.toString().includes('"kty"'),false);assert.equal(encrypted.toString().includes('"d"'),false);
    const restarted=new LocalReceiptAuthority(options);await restarted.loadRoots();await assert.rejects(restarted.issue(release),error=>error instanceof PlatformError&&error.code==='invalid-sigstore-signature');assert.deepEqual(await readFile(join(directory,'receipt-private-key.encrypted')),encrypted);assert.deepEqual(roots,[]);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('runtime-owned trust endpoint requires app session and rejects null Origin',async()=>{
  const runtime=await createRuntime();try{
    assert.equal((await runtime.app.inject({url:'/v1/trust'})).statusCode,401);const owner=await runtime.app.inject({method:'POST',url:'/v1/session/local',headers:{origin:'http://127.0.0.1:4173'},payload:{}});const issued=owner.cookies[0];assert.ok(issued);const cookie=`${issued.name}=${issued.value}`;assert.equal((await runtime.app.inject({url:'/v1/trust',headers:{cookie,origin:'null'}})).statusCode,403);const response=await runtime.app.inject({url:'/v1/trust',headers:{cookie}});assert.equal(response.statusCode,200);assert.deepEqual(JSON.parse(response.body),[]);
  }finally{await runtime.close();}
});
test('personal-mode public trust excludes demo authority and rejects private key material',async()=>{
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),publicKey=await crypto.subtle.exportKey('jwk',keys.publicKey);
  const demo:TrustRoot={keyId:'synthetic-demo-root',publicKey,publisherIdentity:'synthetic test publisher',policyVersion:'synthetic-v1',demoOnly:true};
  const local:TrustRoot={keyId:'synthetic-local-root',publicKey,publisherIdentity:'synthetic boundary fixture',policyVersion:'synthetic-v1'};
  const provider:InferenceProvider={mode:'chatgpt-plan-local',status:()=>({mode:'chatgpt-plan-local',state:'identity-only',label:'Synthetic personal-mode boundary fixture',remainingAllowance:null}),models:async()=>[],execute:async()=>{throw new ProviderError('policy-blocked','No real provider is connected in this synthetic fixture.');}};
  const runtime=await createRuntime({mode:'chatgpt-plan-local',provider,trustRoots:[demo,local]});
  try{
    const session=await runtime.app.inject({method:'POST',url:'/v1/session/local',headers:{origin:'http://127.0.0.1:4173'},payload:{}}),issued=session.cookies[0];assert.equal(session.statusCode,200);assert.ok(issued);const cookie=`${issued.name}=${issued.value}`;
    const response=await runtime.app.inject({url:'/v1/trust',headers:{cookie}});assert.equal(response.statusCode,200);assert.deepEqual(JSON.parse(response.body),[local]);
    local.publicKey=await crypto.subtle.exportKey('jwk',keys.privateKey);
    const rejected=await runtime.app.inject({url:'/v1/trust',headers:{cookie}});assert.equal(rejected.statusCode,403);assert.equal(rejected.body.includes('"d"'),false);
  }finally{await runtime.close();}
});
