import {PluginStorage} from '../../packages/storage/src/index.ts';
import {CapabilityBroker} from '../../packages/broker/src/index.ts';
import {GuestWorker} from '../../packages/runtime-web/src/index.ts';
import {processGuestEvent} from '../../packages/runtime-web/src/bridge.ts';
import {validateManifest,validateRequest,type Principal} from '../../packages/contracts/src/index.ts';
import notebook from '../../examples/manifests/notebook.json';
const status=document.getElementById('status')!;
document.getElementById('run')!.addEventListener('click',async()=>{
 try{
 const storage=await PluginStorage.open('boundary-'+crypto.randomUUID());
 await Promise.allSettled([storage.put('quota','a','x'.repeat(800),1024),storage.put('quota','b','y'.repeat(800),1024)]);
 if((await storage.list('quota')).length!==1)throw new Error('Quota transaction not atomic');
 const manifest=validateManifest(notebook);const principal:Principal=Object.freeze({workspace:'local',plugin:manifest.id,digest:'a'.repeat(64),generation:1,instance:'one',connection:'one'});
 await storage.mutateInstall(manifest.id,()=>({manifest,digest:principal.digest,generation:1,revision:1,enabled:true,grants:['notes'],state:'ready',receipt:{format:'pwacloud.verification.v1',keyId:'test',pluginId:manifest.id,version:'0.1.0',archiveSha256:principal.digest,manifestSha256:principal.digest,publisherIdentity:'test',policyVersion:'test',verifiedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+10000).toISOString(),revocationSequence:0}}));
 const broker=new CapabilityBroker(storage,{});broker.bind(principal);const signal=new AbortController().signal;
 const get=validateRequest({v:1,id:'get',type:'request',method:'storage.get',params:{key:'secret'}});
 await storage.put(manifest.id,'secret','selected-data',1024);
 let forged=false;try{await broker.dispatch({...principal,plugin:'other'},get,signal,()=>{});}catch{forged=true;}if(!forged)throw new Error('Forged principal worked');
 const guest=new GuestWorker('/guest/worker.js');
 const effects=await processGuestEvent(guest,{tag:'action',val:{action:'read',bodyJson:'secret'}},async effect=>{
  if(effect.tag!=='read')throw new Error('Unexpected effect');const value=await broker.dispatch(principal,validateRequest({v:1,id:effect.val.requestId,type:'request',method:'storage.get',params:{key:effect.val.key}}),signal,()=>{});return new TextEncoder().encode(JSON.stringify(value));
 },signal);
 if(effects[0]?.val.channel!=='completed'||!effects[0].val.bodyJson.includes('"ok":true'))throw new Error('No actual effect completion');
 const memory=await guest.call('handle',{tag:'action',val:{action:'grow',bodyJson:'{}'}});if(!JSON.stringify(memory).includes('growthDenied\\\":true'))throw new Error('Memory maximum not enforced');guest.close();
 const old=await storage.acquireLease('install','old',Date.now()-20000,10),newer=await storage.acquireLease('install','new');
 let fenced=false;try{const installed=await storage.getInstall(manifest.id);if(!installed)throw new Error('No install');await storage.commitInstall(manifest.id,installed,{name:'install',owner:'old',fence:old.fence},1);}catch{fenced=true;}if(!fenced||newer.fence<=old.fence)throw new Error('Stale fence worked');
 await storage.mutateInstall(manifest.id,old=>old?{...old,generation:2,grants:[]}:undefined);
 let revoked=false;try{await broker.dispatch(principal,get,signal,()=>{});}catch{revoked=true;}if(!revoked)throw new Error('Revoked principal worked');
 storage.close();status.textContent='PASS: IndexedDB atomic quota, principal binding, real guest effect completion, memory max, stale fencing and revocation';
 }catch(error){status.textContent='FAIL: '+String(error);}
});
