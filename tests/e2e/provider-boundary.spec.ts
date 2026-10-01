import {test,expect} from '@playwright/test';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {setTimeout} from 'node:timers/promises';
import {tsImport} from 'tsx/esm/api';
import type {ChatGptPlanProvider,CredentialRecord,AiInput,ProviderEvent} from '../../packages/provider-chatgpt/src/index.ts';

class SyntheticCredentialProvider{
 readonly mode='demo';
 constructor(private readonly adapter:ChatGptPlanProvider){}
 select(id:string){this.adapter.select(id,'ready');}
 status(){return{...this.adapter.status(),mode:this.mode,label:'SYNTHETIC credential-custody protocol fixture; no ChatGPT account'};}
 models(signal?:AbortSignal){return this.adapter.models(signal);}
 execute(input:AiInput,signal:AbortSignal,emit:(event:ProviderEvent)=>void){return this.adapter.execute(input,signal,emit);}
}
async function freePort(){const socket=createServer();await new Promise<void>(resolve=>socket.listen(0,'127.0.0.1',resolve));const address=socket.address();if(!address||typeof address==='string')throw new Error('No fixture port');await new Promise<void>((resolve,reject)=>socket.close(error=>error?reject(error):resolve()));return address.port;}

test('AI-02 AI-07 synthetic private credentials stay server-side while an existing Notebook run resumes without another model call',async({page})=>{
 const {createRuntime}:typeof import('../../apps/personal-runtime/src/index.ts')=await tsImport('../../apps/personal-runtime/src/index.ts',import.meta.url);
 const {prepareGuestComponent}:typeof import('../../packages/runtime-web/src/transform.ts')=await tsImport('../../packages/runtime-web/src/transform.ts',import.meta.url);
 const {validateTrustRoots}:typeof import('../../packages/package-verifier/src/index.ts')=await tsImport('../../packages/package-verifier/src/index.ts',import.meta.url);
 const {ChatGptPlanProvider,LocalChatGptOAuth,ProtectedFileCredentialStore,OPENAI_ISSUER,OPENAI_RESOURCE,registrationId}:typeof import('../../packages/provider-chatgpt/src/index.ts')=await tsImport('../../packages/provider-chatgpt/src/index.ts',import.meta.url);
 const directory=await mkdtemp(join(tmpdir(),'pwacloud-browser-custody-')),port=await freePort(),origin=`http://127.0.0.1:${port}`;
 const canaries=['access','refresh','id'].map(kind=>`SYNTHETIC_PRIVATE_${kind.toUpperCase()}_${randomUUID()}`);
 const keyPath=join(directory,'separate-key');await writeFile(keyPath,randomBytes(32),{mode:0o600});
 const store=new ProtectedFileCredentialStore(join(directory,'protected'),process.platform==='win32'?undefined:keyPath);
 const record:CredentialRecord={issuer:OPENAI_ISSUER,subject:'synthetic-custody-subject',clientId:'synthetic-issued-client',hostId:'urn:uuid:11111111-1111-4111-8111-111111111111',accessToken:canaries[0]!,refreshToken:canaries[1]!,idToken:canaries[2]!,scopes:['resource.invoke','chatgpt.tokens.use.direct'],expiresAt:Date.now()+3600000,savedAt:Date.now()};
 const id=registrationId(record);await store.write(id,record);let providerCalls=0;
 const chunks=Array.from({length:20},(_,index)=>`synthetic-${index} `),expected=chunks.join('');
 const transport:typeof fetch=async(input,init)=>{const url=String(input);expect(new Headers(init?.headers).get('authorization')).toBe('Bearer '+record.accessToken);if(url===OPENAI_RESOURCE+'/models')return Response.json({models:[{slug:'synthetic-custody',display_name:'SYNTHETIC custody fixture',visibility:'list'}]});if(url!==OPENAI_RESOURCE+'/responses')throw new Error('Unexpected synthetic provider route');providerCalls++;
  const stream=new ReadableStream<Uint8Array>({start(controller){void(async()=>{try{for(const chunk of chunks){await setTimeout(100,undefined,{signal:init?.signal??undefined});controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify({type:'response.output_text.delta',delta:chunk})+'\n\n'));}controller.enqueue(new TextEncoder().encode('data: {"type":"response.completed"}\n\n'));controller.close();}catch(error){controller.error(error);}})();}});return new Response(stream,{headers:{'content-type':'text/event-stream'}});
 };
 const oauth=new LocalChatGptOAuth({hostId:record.hostId,store,fetch:transport}),provider=new SyntheticCredentialProvider(new ChatGptPlanProvider(oauth,transport));provider.select(id);
 const roots=validateTrustRoots(JSON.parse(await readFile('artifacts/packages/trust.json','utf8')));
 const runtime=await createRuntime({mode:'demo',port,origin,demoInsecureCookie:true,databasePath:join(directory,'metadata.sqlite'),provider,trustRoots:roots,prepareGuest:prepareGuestComponent});
 const browserObserved:string[]=[],responses:Promise<void>[]=[];page.on('console',message=>browserObserved.push(message.text()));page.on('request',request=>{browserObserved.push(request.url(),request.postData()??'',JSON.stringify(request.headers()));});page.on('response',response=>{if(new URL(response.url()).pathname.startsWith('/v1/'))responses.push(response.text().then(body=>{browserObserved.push(body);}).catch(()=>{}));});
 try{
  await runtime.listen();await page.goto(origin);await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Discover',exact:true}).click();await page.getByRole('button',{name:'Review Notebook',exact:true}).click();for(const box of await page.getByRole('dialog').getByRole('checkbox').all())if(await box.isEnabled())await box.check();await page.getByRole('button',{name:'Install reviewed app',exact:true}).click();await page.getByRole('button',{name:'Open Notebook',exact:true}).click();
  const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'AI composer',exact:true}).click();await expect(frame.getByLabel('Model')).toHaveValue('synthetic-custody');await frame.getByLabel('Prompt').fill('Synthetic custody and replay check');await frame.getByRole('button',{name:'Send',exact:true}).click();await expect(frame.locator('.answer')).toContainText('synthetic-0 ');
  await page.getByRole('button',{name:'Back to Library',exact:true}).click();await expect(page.locator('iframe')).toHaveCount(0);expect(providerCalls).toBe(1);
  await page.getByRole('button',{name:/Notebook Rich local/}).click();await frame.getByRole('button',{name:'AI composer',exact:true}).click();await frame.getByRole('button',{name:'Resume existing run',exact:true}).click();await expect(frame.locator('.answer')).toHaveText(expected);await expect(frame.locator('p[role=status]')).toContainText('AI completed');expect(providerCalls).toBe(1);
  await page.getByRole('button',{name:'Back to Library',exact:true}).click();await page.getByRole('button',{name:'Manage Notebook',exact:true}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export data',exact:true}).click();const download=await downloadPromise,exportPath=await download.path();if(!exportPath)throw new Error('No real export');browserObserved.push(await readFile(exportPath,'utf8'));await page.getByRole('button',{name:'Close app management',exact:true}).click();
  browserObserved.push(await page.evaluate(async()=>{
   const values:unknown[]=[document.documentElement.outerHTML,Object.entries(localStorage),Object.entries(sessionStorage)];
   for(const info of await indexedDB.databases()){if(!info.name)continue;const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(info.name!);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});try{for(const name of database.objectStoreNames){const records=await new Promise<unknown[]>((resolve,reject)=>{const request=database.transaction(name).objectStore(name).getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});values.push({database:info.name,store:name,records});}}finally{database.close();}}
   for(const name of await caches.keys()){const cache=await caches.open(name);for(const request of await cache.keys()){const response=await cache.match(request);if(response)values.push(await response.text());}}
   return JSON.stringify(values);
  }));
  for(const child of page.frames())browserObserved.push(await child.evaluate(()=>JSON.stringify({html:document.documentElement.outerHTML,url:location.href})));await Promise.all(responses);
  const tables=runtime.database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();const sqlRows=tables.map(table=>{const name=String(table.name);if(!/^[a-z_]+$/.test(name))throw new Error('Unexpected metadata table');return{name,rows:runtime.database.prepare(`SELECT * FROM ${name}`).all()};});const exposed=browserObserved.join('\n')+'\n'+JSON.stringify(sqlRows);for(const canary of canaries)expect(exposed.includes(canary)).toBe(false);
  await mkdir('evidence/M6',{recursive:true});await writeFile(`evidence/M6/${test.info().project.name}-credential-custody-and-replay.json`,JSON.stringify({status:'passed',provider:'synthetic transport and protected synthetic credential record; no authorized account',surfaces:['browser requests/responses/console','host and frames','IndexedDB','CacheStorage','actual downloaded export','SQLite metadata'],providerRequests:providerCalls,exactReplayedText:true,canaryValuesPublished:false},null,2));
 }finally{await runtime.close();await rm(directory,{recursive:true,force:true});}
});


