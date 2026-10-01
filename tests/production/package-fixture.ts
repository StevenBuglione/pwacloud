import { readFile } from 'node:fs/promises';
import { validateManifest,type Receipt,type Manifest } from '../../packages/contracts/src/index';
import { createEnvelope,exactBuffer,type PackageInput,type TrustRoot } from '../../packages/package-verifier/src/index';
export async function signedFixture(overrides:Partial<Manifest>={}) {
  const original=validateManifest(JSON.parse(await readFile('examples/manifests/feed-reader.json','utf8')) as unknown);const manifest=validateManifest({...original,...overrides});
  const files={'manifest.json':new TextEncoder().encode(JSON.stringify(manifest)),'ui/app.js':new TextEncoder().encode('(()=>{document.body.textContent="Synthetic test plugin"})()'),'ui/style.css':new TextEncoder().encode('body{font:16px system-ui}')};
  const envelope=await createEnvelope(files,'a'.repeat(40));
  const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const root:TrustRoot={keyId:'TEST KEY ONLY',publicKey:await crypto.subtle.exportKey('jwk',key.publicKey),publisherIdentity:'TEST SIGNATURE: not attested',policyVersion:'fixture-policy',demoOnly:true};
  const sign=async(bytes:Uint8Array)=>new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key.privateKey,exactBuffer(bytes)));
  const receipt:Receipt={format:'pwacloud.verification.v1',keyId:root.keyId,pluginId:manifest.id,version:manifest.version,archiveSha256:envelope.envelope.archive.sha256,manifestSha256:envelope.envelope.manifestSha256,publisherIdentity:root.publisherIdentity,policyVersion:root.policyVersion,verifiedAt:'2026-01-01T00:00:00Z',expiresAt:'2027-01-01T00:00:00Z',revocationSequence:4};
  const receiptBytes=new TextEncoder().encode(JSON.stringify(receipt));
  const input:PackageInput={archiveBytes:envelope.archiveBytes,envelopeBytes:envelope.envelopeBytes,receiptBytes,signature:await sign(receiptBytes),envelopeSignature:await sign(envelope.envelopeBytes)};
  return {input,root,files,envelope:envelope.envelope,receipt,sign,manifest};
}
