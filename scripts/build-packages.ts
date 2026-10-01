import { build,version as esbuildVersion } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFile,mkdir,writeFile,access } from 'node:fs/promises';
import { createEnvelope,exactBuffer,type TrustRoot } from '../packages/package-verifier/src/index';
import { validateManifest,type Receipt } from '../packages/contracts/src/index';
import type { Catalogue,CatalogueEntry } from '../apps/catalogue/src/index';
const ids=['notebook','feed-reader','canvas-board'];
const release=process.argv.includes('--release'),base=release?'artifacts/release-packages':'artifacts/packages';
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const publicKey=await crypto.subtle.exportKey('jwk',key.publicKey);
const root:TrustRoot={keyId:'local-demo-fixture-v1',publicKey,publisherIdentity:'DEMO ONLY: local PWACloud fixture builder',policyVersion:'demo-fixture-v1',demoOnly:true};
const entries:CatalogueEntry[]=[];
const now=new Date(),expires=new Date(now.getTime()+7*86400000);
await mkdir(base,{recursive:true});
if(!release) await writeFile(`${base}/trust.json`,JSON.stringify([root],null,2));
for(const id of ids) {
  const directory=`examples/plugins/${id}`,output=`${base}/${id}`;
  await mkdir(output,{recursive:true});
  let entry=`${directory}/src/index.tsx`;try {await access(entry);} catch {entry=`${directory}/src/index.ts`;}
  const bundled=await build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true,legalComments:'inline',jsx:'automatic',metafile:true});
  const js=bundled.outputFiles[0];if(!js) throw new Error('bundle missing');
  const manifest=validateManifest(JSON.parse(await readFile(`examples/manifests/${id}.json`,'utf8')) as unknown);
  const files:Record<string,Uint8Array>={'manifest.json':new TextEncoder().encode(JSON.stringify(manifest)),'ui/app.js':js.contents,'ui/style.css':new Uint8Array(await readFile(`${directory}/src/style.css`)),'LICENSE.txt':new Uint8Array(await readFile('LICENSE'))};
  const report={format:'pwacloud.build-report.v1',sourceCommit,toolchain:{esbuild:esbuildVersion,jco:'1.34.0'},demoOnly:!release,provenance:release?'Pending protected workflow attestation':'unattested local build',uiProfile:'isolated-web',bundledInputs:Object.keys(bundled.metafile?.inputs??{}).sort(),uploadedGlueAllowed:false};
  files['build-report.json']=new TextEncoder().encode(JSON.stringify(report));
  if(manifest.service) files[manifest.service.entry]=new Uint8Array(await readFile('artifacts/guest/component.wasm'));
  const result=await createEnvelope(files,sourceCommit);
  await writeFile(`${output}/archive.zip`,result.archiveBytes);await writeFile(`${output}/envelope.json`,result.envelopeBytes);
  if(release) {console.log(JSON.stringify({id,archiveBytes:result.archiveBytes.length,sha256:result.envelope.archive.sha256,trust:'Unsigned; protected workflow must sign and attest before trust'}));continue;}
  const receipt:Receipt={format:'pwacloud.verification.v1',keyId:root.keyId,pluginId:manifest.id,version:manifest.version,archiveSha256:result.envelope.archive.sha256,manifestSha256:result.envelope.manifestSha256,publisherIdentity:root.publisherIdentity,policyVersion:root.policyVersion,verifiedAt:now.toISOString(),expiresAt:expires.toISOString(),revocationSequence:0};
  const receiptBytes=new TextEncoder().encode(JSON.stringify(receipt));
  const sign=async (bytes:Uint8Array)=>new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key.privateKey,exactBuffer(bytes)));
  await writeFile(`${output}/receipt.json`,receiptBytes);await writeFile(`${output}/receipt.sig`,await sign(receiptBytes));await writeFile(`${output}/envelope.sig`,await sign(result.envelopeBytes));
  entries.push({id:manifest.id,title:manifest.name,description:manifest.description,publisherIdentity:root.publisherIdentity,repository:manifest.source.repository,version:manifest.version,digest:result.envelope.archive.sha256,hostApi:manifest.hostApi,profile:manifest.ui?.profile??'host-rendered',capabilities:[...new Set(manifest.permissions.map(p=>p.capability))],provides:manifest.provides,categories:['local-demo'],offline:id!=='feed-reader',language:'en',accessibility:'not-reviewed',moderation:'approved',screenshots:[],verification:{attested:false,reproduced:false}});
  console.log(JSON.stringify({id,archiveBytes:result.archiveBytes.length,sha256:result.envelope.archive.sha256,trust:'DEMO ONLY - no Sigstore attestation'}));
}
if(!release) {const catalogue:Catalogue={format:'pwacloud.catalogue.v1',keyId:root.keyId,sequence:0,issuedAt:now.toISOString(),expiresAt:expires.toISOString(),revokedDigests:[],entries};const catalogueBytes=new TextEncoder().encode(JSON.stringify(catalogue));await writeFile(`${base}/catalogue.json`,catalogueBytes);await writeFile(`${base}/catalogue.sig`,new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key.privateKey,exactBuffer(catalogueBytes))));}
