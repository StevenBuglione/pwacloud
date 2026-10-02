import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,sep} from 'node:path';
import {tsImport} from 'tsx/esm/api';
import type {PackageInput,TrustRoot} from '../../packages/package-verifier/src/index.ts';
import type {Catalogue} from '../../apps/catalogue/src/index.ts';

// Synthetic signing keys authenticate controlled negative cases, not public Sigstore provenance.
async function revocationServer(){
  const {isReceipt}:typeof import('../../packages/contracts/src/index.ts')=await tsImport('../../packages/contracts/src/index.ts',import.meta.url);
  const {encodeInstallPacket,exactBuffer,verifyPackage}:typeof import('../../packages/package-verifier/src/index.ts')=await tsImport('../../packages/package-verifier/src/index.ts',import.meta.url);
  const {verifyCatalogue}:typeof import('../../apps/catalogue/src/index.ts')=await tsImport('../../apps/catalogue/src/index.ts',import.meta.url);
  const root=resolve('dist/shell'),guestRoot=resolve('artifacts/guest/browser'),fixtureRoot=resolve('artifacts/packages');
  const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const trust:TrustRoot={keyId:'synthetic-browser-revocation',publicKey:await crypto.subtle.exportKey('jwk',key.publicKey),publisherIdentity:'SYNTHETIC browser revocation fixture; no public provenance',policyVersion:'synthetic-browser-v1'};
  const sign=async(bytes:Uint8Array)=>new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key.privateKey,exactBuffer(bytes)));
  const sourceReceipt:unknown=JSON.parse(await readFile(resolve(fixtureRoot,'notebook/receipt.json'),'utf8'));
  if(!isReceipt(sourceReceipt))throw new Error('Invalid built Notebook receipt');
  const now=Date.now(),receiptBytes=new TextEncoder().encode(JSON.stringify({...sourceReceipt,keyId:trust.keyId,publisherIdentity:trust.publisherIdentity,policyVersion:trust.policyVersion,verifiedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+86400000).toISOString(),revocationSequence:7}));
  const envelopeBytes=new Uint8Array(await readFile(resolve(fixtureRoot,'notebook/envelope.json')));
  const packet:PackageInput={archiveBytes:new Uint8Array(await readFile(resolve(fixtureRoot,'notebook/archive.zip'))),envelopeBytes,receiptBytes,signature:await sign(receiptBytes),envelopeSignature:await sign(envelopeBytes)};
  const pkg=await verifyPackage(packet,[trust]),digest=pkg.envelope.archive.sha256;
  const initial:Catalogue={format:'pwacloud.catalogue.v1',keyId:trust.keyId,sequence:7,issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+86400000).toISOString(),revokedDigests:[],entries:[{id:pkg.manifest.id,title:pkg.manifest.name,description:pkg.manifest.description,publisherIdentity:trust.publisherIdentity,repository:pkg.manifest.source.repository,version:pkg.manifest.version,digest,hostApi:pkg.manifest.hostApi,profile:'isolated-web',capabilities:['storage.kv','ai.respond'],provides:[],categories:['synthetic-test'],offline:true,language:'en',accessibility:'not-reviewed',moderation:'approved',screenshots:[],verification:{attested:false,reproduced:false}}]};
  let bytes=new TextEncoder().encode(JSON.stringify(initial)),signature=await sign(bytes),resolutions=0,stopped=false;
  await verifyCatalogue(bytes,signature,[trust]);
  const files:Record<string,Uint8Array>={'archive.zip':packet.archiveBytes,'envelope.json':packet.envelopeBytes,'receipt.json':packet.receiptBytes,'receipt.sig':packet.signature,'envelope.sig':packet.envelopeSignature};
  const server=createServer((request,response)=>{void(async()=>{
    const path=new URL(request.url??'/','http://localhost').pathname;
    const reply=(data:Uint8Array|string,type='application/json')=>{response.writeHead(200,{'content-type':type,'cache-control':'no-store'});response.end(data);};
    if(path==='/health'){reply('{"status":"synthetic-revocation-test"}');return;}
    if(path==='/v1/trust'){reply(JSON.stringify([trust]));return;}
    if(path==='/fixtures/catalogue.json'){reply(bytes);return;}
    if(path==='/fixtures/catalogue.sig'){reply(signature,'application/octet-stream');return;}
    if(path==='/v1/registry/resolve'){resolutions++;reply(JSON.stringify(encodeInstallPacket(packet)));return;}
    if(path.startsWith('/fixtures/notebook/')){const file=files[path.slice('/fixtures/notebook/'.length)];if(file){reply(file,path.endsWith('.json')?'application/json':'application/octet-stream');return;}}
    if(path.startsWith('/v1/')||path.startsWith('/fixtures/')){response.writeHead(404);response.end();return;}
    const base=path.startsWith('/guest/')?guestRoot:root,file=resolve(base,path==='/'?'index.html':path.startsWith('/guest/')?path.slice('/guest/'.length):path.slice(1));
    if(!file.startsWith(`${base}${sep}`)){response.writeHead(400);response.end();return;}
    reply(await readFile(file),file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.wasm')?'application/wasm':file.endsWith('.json')?'application/json':file.endsWith('.svg')?'image/svg+xml':'text/html');
  })().catch(error=>{response.writeHead(500);response.end(error instanceof Error?error.message:'Synthetic fixture failed');});});
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));const address=server.address();if(!address||typeof address==='string')throw new Error('No synthetic listener');
  return {origin:`http://127.0.0.1:${address.port}`,repository:pkg.manifest.source.repository,resolutions:()=>resolutions,
    publish:async(sequence:number,revoked:boolean,expired=false)=>{
      // A catalogue card advertises new bytes while the downloader returns old revoked bytes.
      const catalogue:Catalogue={...initial,sequence,issuedAt:new Date(Date.now()-(expired?120000:1000)).toISOString(),expiresAt:new Date(Date.now()+(expired?-60000:86400000)).toISOString(),revokedDigests:revoked?[digest]:[],entries:initial.entries.map(entry=>({...entry,digest:revoked?'f'.repeat(64):digest}))};
      bytes=new TextEncoder().encode(JSON.stringify(catalogue));signature=await sign(bytes);await verifyCatalogue(bytes,signature,[trust],{allowExpiredForCache:expired});
    },stop:async()=>{if(stopped)return;stopped=true;const closing=new Promise<void>((done,fail)=>server.close(error=>error?fail(error):done()));server.closeAllConnections();await closing;}};
}
async function tab(page:Page,name:'Library'|'Discover'){await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true}).click();}
async function installNote(page:Page,origin:string){
  await page.goto(origin);await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await tab(page,'Discover');await page.getByRole('button',{name:'Review Notebook',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Install reviewed app',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Notebook is ready',exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Open Notebook',exact:true}).click();
  const frame=page.frameLocator('iframe');await expect(frame.getByText('Local notes ready',{exact:true})).toBeVisible();await frame.getByLabel('Note text',{exact:true}).fill('Synthetic note preserved after a revoked update');await expect(frame.getByText('Saved on this device',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Back to Library',exact:true}).click();
}
async function reviewUpdate(page:Page){await tab(page,'Discover');await page.getByRole('button',{name:'Review Notebook',exact:true}).click();await expect(page.getByRole('dialog').getByRole('button',{name:'Apply reviewed update',exact:true})).toBeVisible();}
async function resolveRepository(page:Page,repository:string){await tab(page,'Discover');await page.getByLabel('GitHub repository URL').fill(repository);await page.getByRole('button',{name:'Resolve repository',exact:true}).click();}
async function openSavedNote(page:Page){await tab(page,'Library');await page.getByRole('button',{name:/Notebook Rich local/}).click();await expect(page.frameLocator('iframe').getByLabel('Note text',{exact:true})).toHaveValue('Synthetic note preserved after a revoked update');}

test.describe('UPD-03 signed revocation enforcement in the actual shell',()=>{
  test.use({serviceWorkers:'block'});
  test('a reviewed update, fixture bytes and pasted repository cannot bypass a retained revoked digest',async({page})=>{
    const server=await revocationServer();try{
      await installNote(page,server.origin);await reviewUpdate(page);await server.publish(8,true);
      await page.getByRole('dialog').getByRole('button',{name:'Apply reviewed update',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Install failed: revoked-package');await expect(page.getByRole('heading',{name:'Notebook is ready',exact:true})).toHaveCount(0);await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
      await page.getByRole('button',{name:'Review Notebook',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Resolve failed: revoked-package');await expect(page.getByRole('dialog')).toHaveCount(0);
      await resolveRepository(page,server.repository);await expect(page.getByRole('alert')).toContainText('Resolve failed: revoked-package');expect(server.resolutions()).toBe(1);await expect(page.getByRole('dialog')).toHaveCount(0);
      await tab(page,'Library');await page.getByRole('button',{name:'Manage Notebook',exact:true}).click();await expect(page.getByRole('region',{name:'Package verification freshness'})).toContainText('Saved signed catalogue sequence 8');await expect(page.getByRole('region',{name:'Package verification freshness'})).toContainText('This package is listed as revoked');await page.getByRole('button',{name:'Close app management',exact:true}).click();
      await server.publish(7,false);await page.reload();await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await expect(page.getByRole('alert')).toContainText('Catalogue verification failed: stale-catalogue');
      await resolveRepository(page,server.repository);await expect(page.getByRole('alert')).toContainText('Resolve failed: stale-catalogue');expect(server.resolutions()).toBe(1);await expect(page.getByRole('dialog')).toHaveCount(0);await openSavedNote(page);
    }finally{await server.stop();}
  });
  test('expired signed metadata survives reload and blocks new installs while existing notes remain editable offline',async({page,context})=>{
    const server=await revocationServer();try{
      await installNote(page,server.origin);await reviewUpdate(page);await server.publish(9,false,true);
      await page.getByRole('dialog').getByRole('button',{name:'Apply reviewed update',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Signed catalogue metadata has expired');await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
      await page.reload();await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await resolveRepository(page,server.repository);await expect(page.getByRole('alert')).toContainText('Resolve failed: Signed catalogue metadata has expired. New installs and updates need fresh verification.');expect(server.resolutions()).toBe(0);await expect(page.getByRole('dialog')).toHaveCount(0);
      await openSavedNote(page);await context.setOffline(true);const frame=page.frameLocator('iframe');await frame.getByLabel('Note text',{exact:true}).fill('Synthetic offline edit with expired catalogue');await expect(frame.getByText('Saved on this device',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Back to Library',exact:true}).click();await page.getByRole('button',{name:'Manage Notebook',exact:true}).click();
      const freshness=page.getByRole('region',{name:'Package verification freshness'});await expect(freshness).toContainText('Saved signed catalogue sequence 9');await expect(freshness).toContainText('This snapshot has expired');await expect(freshness).toContainText('Offline: current revocation status is unknown');
    }finally{await server.stop();}
  });
});
