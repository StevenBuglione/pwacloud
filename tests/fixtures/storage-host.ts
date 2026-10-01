import {PluginStorage} from '../../packages/storage/src/index.ts';
import {CapabilityBroker} from '../../packages/broker/src/index.ts';
import {GuestWorker} from '../../packages/runtime-web/src/index.ts';
import {processGuestEvent} from '../../packages/runtime-web/src/bridge.ts';
import {validateManifest,validateRequest,PlatformError,type Principal} from '../../packages/contracts/src/index.ts';
import {createPluginHost,WorkerScheduler} from '../../packages/controller/src/index.ts';
import {z} from 'zod';
import notebook from '../../examples/manifests/notebook.json';
import canvas from '../../examples/manifests/canvas-board.json';
const status=document.getElementById('status')!;
function gate(){let release!:()=>void;const promise=new Promise<void>(resolve=>{release=resolve;});return {promise,release};}
async function until(check:()=>boolean){const deadline=Date.now()+10000;while(!check()){if(Date.now()>=deadline)throw new Error('Real Worker scheduler observation timed out');await new Promise(resolve=>setTimeout(resolve,10));}}
async function schedulerBoundaries(storage:PluginStorage){
 const NativeWorker=globalThis.Worker,nativeFetch=globalThis.fetch;let created=0,peak=0,idleFetches=0;const live=new Set<Worker>();
 class ObservedWorker extends NativeWorker{
  constructor(url:string|URL,options?:WorkerOptions){super(url,options);created++;live.add(this);peak=Math.max(peak,live.size);}
  override terminate(){live.delete(this);super.terminate();}
 }
 globalThis.Worker=ObservedWorker;globalThis.fetch=(input,init)=>{idleFetches++;return nativeFetch.call(globalThis,input,init);};
 const inactive=createPluginHost({storage});
 try{
  const installs=await storage.listInstalls();if(installs.length!==1||!installs[0]?.enabled||!installs[0].manifest.service)throw new Error('No installed inactive guest');
  status.dataset.phase='inactive';const idleStart=Date.now();await new Promise(resolve=>setTimeout(resolve,750));const idleEnd=Date.now();
  if(created!==0||idleFetches!==0||document.querySelectorAll('iframe').length!==0)throw new Error('Inactive host polled, created a Worker or mounted UI');
  globalThis.fetch=nativeFetch;status.dataset.phase='scheduled';
  const scheduler=new WorkerScheduler(),gates=[gate(),gate(),gate(),gate()],called:number[]=[],started:number[]=[];
  const observed=()=>({created,live:live.size,peak,running:scheduler.running,queued:scheduler.queued});
  if(scheduler.limit!==2)throw new Error('Production scheduler default is not two');
  const effectsSchema=z.array(z.strictObject({tag:z.literal('render'),val:z.strictObject({channel:z.literal('analysis'),bodyJson:z.string()})})).length(1);
  const analysisSchema=z.strictObject({words:z.literal(3),characters:z.number().int().positive(),source:z.literal('Rust Component Model Wasm')});
  const run=(index:number,signal?:AbortSignal)=>scheduler.run(async()=>{
   const worker=new GuestWorker('/guest/worker.js',5000);started.push(index);
   try{const effects=effectsSchema.parse(await worker.call('handle',{tag:'action',val:{action:'analyze',bodyJson:JSON.stringify({text:`scheduler job ${index}`})}}));analysisSchema.parse(JSON.parse(effects[0]!.val.bodyJson));called.push(index);await gates[index]!.promise;}finally{worker.close();}
  },signal);
  const first=run(0),second=run(1),third=run(2),cancel=new AbortController();
  const cancelled=run(3,cancel.signal).then(()=>{throw new Error('Cancelled queued job executed');},error=>{if(!(error instanceof PlatformError)||error.code!=='cancelled')throw error;});cancel.abort();
  await until(()=>called.length===2);
  const initial=observed();if(initial.created!==2||initial.live!==2||initial.running!==2||initial.queued!==2||started.join(',')!=='0,1')throw new Error('Queued jobs exceeded two real Workers');
  gates[0]!.release();await first;await until(()=>called.includes(2));
  const admitted=observed();if(admitted.created!==3||admitted.live!==2||admitted.peak!==2||admitted.running!==2||admitted.queued!==1||started.join(',')!=='0,1,2')throw new Error('Releasing first Worker did not fairly admit third');
  gates[2]!.release();await third;await cancelled;
  const removed=observed();if(removed.created!==3||removed.live!==1||removed.queued!==0||started.includes(3))throw new Error('Queued cancellation constructed a Worker');
  gates[1]!.release();await second;
  const final=observed();if(final.live!==0||final.running!==0||final.queued!==0)throw new Error('Worker scheduler retained idle execution');
  status.dataset.observation=JSON.stringify({idleStart,idleEnd,idleFetches,idleWorkers:0,peakWorkers:peak,createdWorkers:created,completedGuestCalls:called.length,started,cancelledWorkerCreated:false});
 }finally{inactive.dispose();globalThis.fetch=nativeFetch;globalThis.Worker=NativeWorker;for(const worker of live)worker.terminate();}
}
const checkpointText='checkpoint survives leader replacement';
const checkpointSchema=z.strictObject({words:z.literal(4),characters:z.literal(checkpointText.length)});
async function snapshot(worker:GuestWorker){const raw=await worker.call('snapshot',null);if(!(raw instanceof Uint8Array))throw new Error('Real guest did not return checkpoint bytes');checkpointSchema.parse(JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(raw)));return raw;}
async function leaderBoundary(storage:PluginStorage,id:string){
 const worker=new GuestWorker('/guest/worker.js',5000);
 try{await worker.call('handle',{tag:'action',val:{action:'analyze',bodyJson:JSON.stringify({text:checkpointText})}});await storage.put('host','leader-checkpoint',Array.from(await snapshot(worker)),67108864);}finally{worker.close();}
 await storage.operationOnce('leader-external-write',async()=>{await storage.put('host','external-write-count',1,67108864);return 1;});
 const lease=await storage.acquireLease('install/'+id,'page-one',Date.now(),1500);
 const resume=new Promise<void>(resolve=>window.addEventListener('verify-stale-leader',()=>resolve(),{once:true}));
 status.dataset.expires=String(lease.expires);status.textContent='WAITING: actual page-one leader and persisted real guest checkpoint';await resume;
 const replacement=z.strictObject({owner:z.literal('page-two'),fence:z.number().int().positive(),expires:z.number()}).parse(await storage.get('host','replacement-lease'));
 if(replacement.fence<=lease.fence)throw new Error('Second page did not increase leader fence');
 const current=await storage.getInstall(id);if(!current||current.generation!==2)throw new Error('Replacement page did not commit');
 let denied=false;try{await storage.commitInstall(id,{...current,generation:current.generation+1,revision:current.revision+1},{name:'install/'+id,owner:'page-one',fence:lease.fence},current.revision);}catch(error){if(!(error instanceof PlatformError)||error.code!=='stale-fence')throw error;denied=true;}
 if(!denied||(await storage.getInstall(id))?.generation!==2)throw new Error('Old page leader committed after replacement');
 status.dataset.observation=JSON.stringify({oldFence:lease.fence,newFence:replacement.fence,staleCommitDenied:true,generation:2});status.textContent='PASS: actual second-page leader replacement increased fence and blocked stale page commit';
}
async function replacementBoundary(storage:PluginStorage,id:string){
 const lease=await storage.acquireLease('install/'+id,'page-two'),current=await storage.getInstall(id);if(!current)throw new Error('Leader installation missing');
 await storage.commitInstall(id,{...current,generation:current.generation+1,revision:current.revision+1},{name:'install/'+id,owner:'page-two',fence:lease.fence},current.revision);
 await storage.put('host','replacement-lease',lease,67108864);
 const bytes=z.array(z.number().int().min(0).max(255)).max(262144).parse(await storage.get('host','leader-checkpoint'));
 const worker=new GuestWorker('/guest/worker.js',5000);let restored:Uint8Array;
 try{await worker.call('activate',{configJson:'{}',checkpoint:Uint8Array.from(bytes)});restored=await snapshot(worker);}finally{worker.close();}
 if(JSON.stringify(Array.from(restored))!==JSON.stringify(bytes))throw new Error('Fresh real guest failed exact checkpoint restoration');
 let replayed=false,denied=false;try{await storage.operationOnce('leader-external-write',async()=>{replayed=true;await storage.put('host','external-write-count',2,67108864);return 2;});}catch(error){if(!(error instanceof PlatformError)||error.code!=='operation-already-admitted')throw error;denied=true;}
 if(!denied||replayed||await storage.get('host','external-write-count')!==1)throw new Error('Replacement page repeated an admitted write');
 status.dataset.observation=JSON.stringify({words:4,characters:checkpointText.length,externalWrites:1,restoredBytes:restored.length});status.textContent='PASS: fresh real Wasm Worker restored persisted words and characters; replacement page did not repeat admitted write';
}
document.getElementById('run')!.addEventListener('click',async()=>{
 try{
 const query=new URLSearchParams(location.search),database=query.get('database')??'boundary-'+crypto.randomUUID();const storage=await PluginStorage.open(database);
 if(query.get('mode')==='lease-replacement'){await replacementBoundary(storage,notebook.id);storage.close();return;}
 await Promise.allSettled([storage.put('quota','a','x'.repeat(800),1024),storage.put('quota','b','y'.repeat(800),1024)]);
 if((await storage.list('quota')).length!==1)throw new Error('Quota transaction not atomic');
 const manifest=validateManifest({...notebook,permissions:[...notebook.permissions,{id:'http-fixture',capability:'network.http',required:false,scope:{rules:[{origin:'https://effects.pwacloud.test',methods:['GET','HEAD'],pathPrefixes:['/allowed/']}]}}]});const principal:Principal=Object.freeze({workspace:'local',plugin:manifest.id,digest:'a'.repeat(64),generation:1,instance:'one',connection:'one'});
 await storage.mutateInstall(manifest.id,()=>({manifest,digest:principal.digest,generation:1,revision:1,enabled:true,grants:['notes','http-fixture'],state:'ready',receipt:{format:'pwacloud.verification.v1',keyId:'test',pluginId:manifest.id,version:'0.1.0',archiveSha256:principal.digest,manifestSha256:principal.digest,publisherIdentity:'test',policyVersion:'test',verifiedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+10000).toISOString(),revocationSequence:0}}));
 if(query.get('mode')==='lease-leader'){await leaderBoundary(storage,manifest.id);storage.close();return;}
 if(new URLSearchParams(location.search).get('mode')==='scheduler'){await schedulerBoundaries(storage);storage.close();status.dataset.phase='done';status.textContent='PASS: inactive installed host made zero requests and Workers; production scheduler held two real Wasm Workers, admitted third fairly and cancelled queued job without a Worker';return;}
 const broker=new CapabilityBroker(storage,{});broker.bind(principal);const signal=new AbortController().signal;
 const get=validateRequest({v:1,id:'get',type:'request',method:'storage.get',params:{key:'secret'}});
 await storage.put(manifest.id,'secret','selected-data',1024);
 let forged=false;try{await broker.dispatch({...principal,plugin:'other'},get,signal,()=>{});}catch{forged=true;}if(!forged)throw new Error('Forged principal worked');
 const secondManifest=validateManifest(canvas),secondPrincipal:Principal=Object.freeze({...principal,plugin:secondManifest.id,digest:'b'.repeat(64),instance:'two',connection:'two'});
 const firstInstall=await storage.getInstall(manifest.id);if(!firstInstall)throw new Error('Plugin A installation missing');
 await storage.mutateInstall(secondManifest.id,()=>({...firstInstall,manifest:secondManifest,digest:secondPrincipal.digest,grants:['boards','selected-note'],receipt:{...firstInstall.receipt,pluginId:secondManifest.id,archiveSha256:secondPrincipal.digest,manifestSha256:secondPrincipal.digest}}));broker.bind(secondPrincipal);
 if(await broker.dispatch(secondPrincipal,get,signal,()=>{})!==null)throw new Error('Legitimate Plugin B read Plugin A secret');
 await broker.dispatch(secondPrincipal,validateRequest({v:1,id:'put-b',type:'request',method:'storage.put',params:{key:'secret',value:'plugin-b-only'}}),signal,()=>{});
 if(await broker.dispatch(secondPrincipal,get,signal,()=>{})!=='plugin-b-only'||await broker.dispatch(principal,get,signal,()=>{})!=='selected-data')throw new Error('Installed plugin namespaces were not isolated');
 await storage.put(manifest.id,'notes/selected',{title:'Synthetic selected note',text:'only selected shared text'},1024);
 const serviceRequest=(bindingId:string)=>validateRequest({v:1,id:'selected-read',type:'request',method:'services.invoke',params:{bindingId,method:'read',args:{}}});
 let unselectedDenied=false;try{await broker.dispatch(secondPrincipal,serviceRequest('selected-note'),signal,()=>{});}catch(error){if(!(error instanceof PlatformError)||error.code!=='permission-denied')throw error;unselectedDenied=true;}if(!unselectedDenied)throw new Error('Plugin B guessed an unselected document handle');
 const selected=await broker.selectDocument(secondManifest.id,manifest.id,'notes/selected');
 const document=z.strictObject({title:z.literal('Synthetic selected note'),text:z.literal('only selected shared text')}).parse(await broker.dispatch(secondPrincipal,serviceRequest(selected),signal,()=>{}));if(!document.text)throw new Error('Authorized selected handle returned no document');
 let usedDenied=false;try{await broker.dispatch(secondPrincipal,serviceRequest(selected),signal,()=>{});}catch(error){if(!(error instanceof PlatformError)||error.code!=='permission-denied')throw error;usedDenied=true;}if(!usedDenied)throw new Error('One-use selected handle was replayed');
 const pendingSelected=await broker.selectDocument(secondManifest.id,manifest.id,'notes/selected');
 const guest=new GuestWorker('/guest/worker.js');
 const effects=await processGuestEvent(guest,{tag:'action',val:{action:'read',bodyJson:'secret'}},async effect=>{
  if(effect.tag!=='read')throw new Error('Unexpected effect');const value=await broker.dispatch(principal,validateRequest({v:1,id:effect.val.requestId,type:'request',method:'storage.get',params:{key:effect.val.key}}),signal,()=>{});return new TextEncoder().encode(JSON.stringify(value));
 },signal);
 const completion=z.strictObject({requestId:z.string(),ok:z.boolean(),bodyJson:z.string().optional(),errorCode:z.string().optional()});
 if(effects[0]?.val.channel!=='completed')throw new Error('No actual effect completion');
 const read=completion.parse(JSON.parse(effects[0].val.bodyJson));if(read.requestId!=='guest-read'||!read.ok||read.bodyJson!==JSON.stringify('selected-data'))throw new Error('Storage completion was not correlated');
 // Playwright fulfills this reserved HTTPS origin; the real broker still performs browser fetch.
 const http=async(url:string)=>{
  const renders=await processGuestEvent(guest,{tag:'action',val:{action:'http',bodyJson:JSON.stringify({url,method:'GET'})}},async effect=>{
   if(effect.tag!=='network')throw new Error('Expected real guest HTTP effect');
   const value=await broker.dispatch(principal,validateRequest({v:1,id:effect.val.requestId,type:'request',method:'network.request',params:{url:effect.val.url,method:effect.val.method}}),signal,()=>{});
   return new TextEncoder().encode(JSON.stringify(value));
  },signal);
  if(renders.length!==1||renders[0]?.val.channel!=='completed')throw new Error('Missing HTTP completion');
  const result=completion.parse(JSON.parse(renders[0].val.bodyJson));if(result.requestId!=='guest-http')throw new Error('HTTP completion ID was not correlated');return result;
 };
 const response=await http('https://effects.pwacloud.test/allowed/data');
 if(!response.ok||!response.bodyJson)throw new Error('Allowed guest HTTP effect failed');
 const delivered=z.strictObject({status:z.literal(200),body:z.string()}).parse(JSON.parse(response.bodyJson));if(delivered.body!==JSON.stringify({source:'controlled-https-fixture',value:'guest-http-result'}))throw new Error('HTTP response did not reach guest completion');
 for(const url of ['https://denied.pwacloud.test/allowed/data','https://effects.pwacloud.test/private/data']){const denied=await http(url);if(denied.ok||denied.errorCode!=='permission-denied')throw new Error('Guest HTTP origin/path denial did not reach correlated completion');}
 const other=await PluginStorage.open(database);try{await other.mutateInstall(manifest.id,old=>old?{...old,generation:2,grants:['notes']}:undefined);}finally{other.close();}
 const revokedHttp=await http('https://effects.pwacloud.test/allowed/revoked');if(revokedHttp.ok||revokedHttp.errorCode!=='revoked')throw new Error('Guest HTTP stale grant worked after cross-instance revocation');
 let staleDocumentDenied=false;try{await broker.dispatch(secondPrincipal,serviceRequest(pendingSelected),signal,()=>{});}catch(error){if(!(error instanceof PlatformError)||error.code!=='revoked')throw error;staleDocumentDenied=true;}if(!staleDocumentDenied)throw new Error('Selected document handle survived provider generation revocation');
 await storage.mutateInstall(secondManifest.id,old=>old?{...old,generation:2,revision:old.revision+1,grants:['boards']}:undefined);broker.invalidate(secondManifest.id);
 let consumerRevoked=false;try{await broker.dispatch(secondPrincipal,serviceRequest(pendingSelected),signal,()=>{});}catch(error){if(!(error instanceof PlatformError)||error.code!=='revoked')throw error;consumerRevoked=true;}if(!consumerRevoked)throw new Error('Revoked Plugin B principal retained document handle');
 const refreshedSecond:Principal=Object.freeze({...secondPrincipal,generation:2,instance:'two-new',connection:'two-new'});broker.bind(refreshedSecond);
 let revokedPermissionDenied=false;try{await broker.dispatch(refreshedSecond,serviceRequest(pendingSelected),signal,()=>{});}catch(error){if(!(error instanceof PlatformError)||error.code!=='permission-denied')throw error;revokedPermissionDenied=true;}if(!revokedPermissionDenied)throw new Error('Fresh Plugin B principal retained revoked service permission');
 const memory=await guest.call('handle',{tag:'action',val:{action:'grow',bodyJson:'{}'}});if(!JSON.stringify(memory).includes('growthDenied\\\":true'))throw new Error('Memory maximum not enforced');guest.close();
 const old=await storage.acquireLease('install','old',Date.now()-20000,10),newer=await storage.acquireLease('install','new');
 let fenced=false;try{const installed=await storage.getInstall(manifest.id);if(!installed)throw new Error('No install');await storage.commitInstall(manifest.id,installed,{name:'install',owner:'old',fence:old.fence},1);}catch{fenced=true;}if(!fenced||newer.fence<=old.fence)throw new Error('Stale fence worked');
 await storage.mutateInstall(manifest.id,old=>old?{...old,generation:3,grants:[]}:undefined);
 let revoked=false;try{await broker.dispatch(principal,get,signal,()=>{});}catch{revoked=true;}if(!revoked)throw new Error('Revoked principal worked');
 storage.close();status.textContent='PASS: IndexedDB atomic quota, principal binding, real guest storage and HTTP effect completions, HTTP origin/path denial, cross-instance revocation, memory max and stale fencing; APP-04 installed plugin namespace isolation and selected-handle revocation';
 }catch(error){status.textContent='FAIL: '+String(error);}
});
