import {test,expect} from '@playwright/test';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join,sep} from 'node:path';
import {build} from 'esbuild';
import {tsImport} from 'tsx/esm/api';
import type {TrustRoot} from '../../packages/package-verifier/src/index';
import type {Receipt} from '../../packages/contracts/src/index';

for(const framework of ['react','lit'] as const){
  test(`CLI ${framework} scaffold installs and renders through the actual opaque loader at 360px`,async({page},testInfo)=>{
    const {createPlugin,buildPlugin,readPackageDirectory}:typeof import('../../packages/cli/src/index')=await tsImport('../../packages/cli/src/index.ts',import.meta.url);
    const {startDevelopmentServer}:typeof import('../../packages/cli/src/dev')=await tsImport('../../packages/cli/src/dev.ts',import.meta.url);
    const {createEnvelope,exactBuffer,encodeInstallPacket}:typeof import('../../packages/package-verifier/src/index')=await tsImport('../../packages/package-verifier/src/index.ts',import.meta.url);
    const {validateManifest}:typeof import('../../packages/contracts/src/index')=await tsImport('../../packages/contracts/src/index.ts',import.meta.url);
    await mkdir('artifacts',{recursive:true});const temporary=await mkdtemp(resolve('artifacts/scaffold-browser-'));
    const directory=join(temporary,'plugin');let development:Awaited<ReturnType<typeof startDevelopmentServer>>|undefined;
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    const server=createServer();
    try{
      await createPlugin(directory,`dev.tests.scaffold.${framework}`,framework);await buildPlugin(directory);
      const files=await readPackageDirectory(join(directory,'package')),manifest=validateManifest(JSON.parse(await readFile(join(directory,'manifest.json'),'utf8')) as unknown);
      const envelope=await createEnvelope(files,'a'.repeat(40));
      const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
      const root:TrustRoot={keyId:'SYNTHETIC SCAFFOLD BROWSER TEST',publicKey:await crypto.subtle.exportKey('jwk',key.publicKey),publisherIdentity:'SYNTHETIC LOCAL TEST: no publisher attestation',policyVersion:'browser-test',demoOnly:true};
      const receipt:Receipt={format:'pwacloud.verification.v1',keyId:root.keyId,pluginId:manifest.id,version:manifest.version,archiveSha256:envelope.envelope.archive.sha256,manifestSha256:envelope.envelope.manifestSha256,publisherIdentity:root.publisherIdentity,policyVersion:root.policyVersion,verifiedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),revocationSequence:0};
      const receiptBytes=new TextEncoder().encode(JSON.stringify(receipt));
      const sign=async(bytes:Uint8Array)=>new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key.privateKey,exactBuffer(bytes)));
      const packet=encodeInstallPacket({archiveBytes:envelope.archiveBytes,envelopeBytes:envelope.envelopeBytes,receiptBytes,signature:await sign(receiptBytes),envelopeSignature:await sign(envelope.envelopeBytes)});
      const hostSource=`import {PluginStorage} from ${JSON.stringify(resolve('packages/storage/src/index.ts'))};import {createPluginHost} from ${JSON.stringify(resolve('packages/controller/src/index.ts'))};import {verifyInstallPacket,validateTrustRoots} from ${JSON.stringify(resolve('packages/package-verifier/src/index.ts'))};const roots=validateTrustRoots(${JSON.stringify([root])});const status=document.getElementById('status');const container=document.getElementById('frame');if(!status||!container)throw new Error('Missing test mount');const response=await fetch('/packet');if(!response.ok)throw new Error('Missing test packet');const packet:unknown=await response.json();const pkg=await verifyInstallPacket(packet,roots,{allowDemo:true});const storage=await PluginStorage.open('scaffold-browser-'+crypto.randomUUID());const host=createPluginHost({storage});await host.install(pkg,['data']);await host.mount(container,pkg.manifest.id);status.textContent='Installed from exact signed synthetic bytes';window.addEventListener('pagehide',()=>{host.dispose();storage.close();});`;
      const built=await build({stdin:{contents:hostSource,loader:'ts',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});const hostBytes=built.outputFiles[0]?.contents;if(!hostBytes)throw new Error('Missing compiled test host');
      server.on('request',(req,res)=>{res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signed scaffold integration</title><style>body{margin:0}#frame{width:100%;height:600px}iframe{width:100%;height:100%;border:0}</style><output id="status"></output><div id="frame"></div><script type="module" src="/host.js"></script></html>');}else if(req.url==='/host.js'){res.setHeader('content-type','text/javascript');res.end(hostBytes);}else if(req.url==='/packet'){res.setHeader('content-type','application/json');res.end(JSON.stringify(packet));}else{res.writeHead(404);res.end();}});
      await new Promise<void>((ready,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',ready);});const address=server.address();if(!address||typeof address==='string')throw new Error('Missing bound test port');
      await page.goto(`http://127.0.0.1:${address.port}`);await expect(page.locator('#status')).toHaveText('Installed from exact signed synthetic bytes');
      const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading',{name:'New plugin'})).toBeVisible();await frame.getByRole('textbox',{name:'Text',exact:true}).fill('Actual generated scaffold');await expect(frame.getByRole('textbox',{name:'Text',exact:true})).toHaveValue('Actual generated scaffold');
      await expect(page.locator('iframe')).toHaveAttribute('sandbox','allow-scripts');
      expect(await page.evaluate(()=>{try{return document.querySelector('iframe')?.contentWindow?.document!==undefined;}catch{return false;}})).toBe(false);
      expect(await frame.locator('body').evaluate(body=>body.scrollWidth<=360)).toBe(true);
      const editor=await frame.getByRole('textbox',{name:'Text',exact:true}).boundingBox();expect(editor?.width).toBeGreaterThan(280);expect(editor?.height).toBeGreaterThanOrEqual(160);
      expect(await frame.getByRole('heading',{name:'New plugin'}).evaluate(heading=>getComputedStyle(heading).fontFamily)).toContain('system-ui');
      await page.screenshot({path:`evidence/package-verifier/scaffold-${framework}-${testInfo.project.name}.png`,fullPage:true});
      development=await startDevelopmentServer(directory);await page.goto(development.url);await expect(page.frameLocator('iframe').getByRole('heading',{name:'New plugin'})).toBeVisible();await expect(page.locator('#state')).toHaveText('Unsigned source preview. Host capabilities are disabled.');
      const entry=join(directory,`src/index.${framework==='react'?'tsx':'ts'}`);await writeFile(entry,(await readFile(entry,'utf8')).replace('New plugin','Updated scaffold'));
      await expect(page.frameLocator('iframe').getByRole('heading',{name:'Updated scaffold'})).toBeVisible();
      expect(errors).toEqual([]);
    }finally{
      await development?.close();if(server.listening)await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));
      if(!temporary.startsWith(resolve('artifacts')+sep))throw new Error('Unexpected test directory');await rm(temporary,{recursive:true,force:true});
    }
  });
}
