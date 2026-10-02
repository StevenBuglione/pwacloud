import {PlatformError,validateManifest,validateRequest,isEnvelope,isReceipt,type Principal,type Request} from '../../contracts/src/index.ts';
import {sha256,encodeInstallPacket,assertRevocationPolicy,validateRevocationPolicy,type VerifiedPackage,type RevocationPolicy} from '../../package-verifier/src/index.ts';
import {mountIsolatedUI,type FrameSession} from '../../runtime-ui/src/index.ts';
import {GuestWorker} from '../../runtime-web/src/index.ts';
import {processGuestEvent} from '../../runtime-web/src/bridge.ts';
import {CapabilityBroker,type AiTransport} from '../../broker/src/index.ts';
import {PluginStorage,type InstalledPlugin} from '../../storage/src/index.ts';
import {SseParser} from '../../../src/reference/sse.ts';
import {resolveDependencyGraph,validateDependencyBindings} from '../../registry-client/src/dependencies.ts';
import {z} from 'zod';
export type HostOptions={storage:PluginStorage;registries?:{resolve:(repository:string,signal?:AbortSignal)=>Promise<VerifiedPackage>};
  migrate?:(previous:InstalledPlugin,next:VerifiedPackage,backup:string,signal:AbortSignal)=>Promise<string>;
  onInstallStage?:(stage:'staging'|'artifact'|'snapshot'|'migration'|'commit',id:string)=>Promise<void>;
  onNavigate?:(pluginId:string,route:string)=>void;
  aiTransport?:AiTransport;diagnostics?:(event:{type:string;plugin?:string;message:string})=>void;dependencySelections?:ReadonlyMap<string,string>;
  revocationPolicy?:()=>RevocationPolicy|undefined;
  onBindingRequest?:(consumerId:string,providerId:string,key:string)=>Promise<boolean>;network?:(install:InstalledPlugin,url:string,method:string,signal:AbortSignal)=>Promise<unknown>};
export class WorkerScheduler {
  private active=0;private queue:(()=>void)[]=[];
  constructor(readonly limit=2){if(!Number.isSafeInteger(limit)||limit<1||limit>8)throw new PlatformError('invalid-limit');}
  get running(){return this.active;}get queued(){return this.queue.length;}
  async run<T>(task:()=>Promise<T>,signal?:AbortSignal):Promise<T>{
    if(this.queue.length>=64)throw new PlatformError('quota-exceeded');
    await new Promise<void>((resolve,reject)=>{const start=()=>{if(signal?.aborted){reject(new PlatformError('cancelled'));this.next();return;}this.active++;resolve();};if(this.active<this.limit)start();else this.queue.push(start);});
    try{return await task();}finally{this.active--;this.next();}
  }
  private next(){if(this.active<this.limit)this.queue.shift()?.();}
}
function persistedPackage(value:unknown):VerifiedPackage{
  if(typeof value!=='object'||!value||!('manifest'in value)||!('envelope'in value)||!isEnvelope(value.envelope)||!('receipt'in value)||!isReceipt(value.receipt)||!('files'in value)||typeof value.files!=='object'||!value.files)throw new PlatformError('corrupt-cache');
  validateManifest(value.manifest);for(const data of Object.values(value.files))if(!(data instanceof Uint8Array))throw new PlatformError('corrupt-cache');
  // Rehash every asset before execution; a stored install pointer is insufficient evidence.
  return value as VerifiedPackage;
}
async function checkAssets(pkg:VerifiedPackage){for(const file of pkg.envelope.files){const bytes=pkg.files[file.path];if(!bytes||bytes.length!==file.bytes||await sha256(bytes)!==file.sha256)throw new PlatformError('corrupt-cache');}}
function checkGrants(pkg:VerifiedPackage,grants:string[]){const allowed=new Set(pkg.manifest.permissions.map(p=>p.id));if(new Set(grants).size!==grants.length||grants.some(id=>!allowed.has(id))||pkg.manifest.permissions.some(p=>p.required&&!grants.includes(p.id)))throw new PlatformError('consent-required');}
export function createPluginHost(options:HostOptions){
  const {storage}=options;const owner=crypto.randomUUID();const scheduler=new WorkerScheduler();
  let knownRevocation:RevocationPolicy|undefined;
  function checkRevocation(pkg:VerifiedPackage){const incoming=options.revocationPolicy?.();if(incoming){const policy=validateRevocationPolicy(incoming);if(knownRevocation&&policy.sequence<knownRevocation.sequence)throw new PlatformError('stale-revocation');knownRevocation={...policy,revokedDigests:[...policy.revokedDigests]};}if(knownRevocation)assertRevocationPolicy(pkg,knownRevocation);}
  let active:FrameSession|undefined;const guests=new Map<string,GuestWorker>();const crashes=new Map<string,{count:number;until:number}>();
  const diagnose=(type:string,plugin:string,message:string)=>options.diagnostics?.({type,plugin,message});
  let broker:CapabilityBroker;
  async function analyze(install:InstalledPlugin,text:string,signal:AbortSignal){
    if(!install.manifest.service)throw new PlatformError('unsupported-capability');
    const prior=crashes.get(install.manifest.id);if(prior&&prior.until>Date.now())throw new PlatformError('backoff');
    return scheduler.run(async()=>{
      const pkg=persistedPackage(await storage.getArtifact(install.digest));const component=pkg.files[install.manifest.service!.entry];if(!component)throw new PlatformError('missing-component');
      const digest=await sha256(component);const response=await fetch('/guest/allowed.json',{signal});const raw:unknown=await response.json();
      if(!response.ok||typeof raw!=='object'||!raw||!('components'in raw)||typeof raw.components!=='object'||!raw.components||!(digest in raw.components))throw new PlatformError('untrusted-transform');
      const url=Reflect.get(raw.components,digest);if(typeof url!=='string'||!/^\/guest\/[a-f0-9]{64}\/worker\.js\?v=[a-f0-9]{64}$/.test(url)||!url.startsWith(`/guest/${digest}/worker.js?v=`))throw new PlatformError('untrusted-transform');
      const guest=new GuestWorker(url);guests.set(install.manifest.id,guest);const abort=()=>guest.close();signal.addEventListener('abort',abort,{once:true});
      const principal:Principal=Object.freeze({workspace:'local',plugin:install.manifest.id,digest:install.digest,generation:install.generation,instance:crypto.randomUUID(),connection:crypto.randomUUID()});const unbind=broker.bind(principal);
      try{
        const saved=await storage.get('host',`service-checkpoint/${install.manifest.id}`);let checkpoint:Uint8Array|undefined;
        if(Array.isArray(saved)&&saved.length<=262144&&saved.every(value=>Number.isInteger(value)&&value>=0&&value<=255))checkpoint=Uint8Array.from(saved);
        await guest.call('activate',{configJson:'{}',checkpoint});
        const effects=await processGuestEvent(guest,{tag:'action',val:{action:'analyze',bodyJson:JSON.stringify({text})}},async effect=>{
          let method:string,params:Record<string,unknown>;switch(effect.tag){
            case 'read':method='storage.get';params={key:effect.val.key};break;
            case 'write':method='storage.put';params={key:effect.val.key,value:JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(effect.val.value))};break;
            case 'network':method='network.request';if(effect.val.body?.length)throw new PlatformError('unsupported-capability');params={url:effect.val.url,method:effect.val.method};break;
            case 'ai':method='ai.start';if(effect.val.documentHandles.length)throw new PlatformError('permission-denied');params={requestId:effect.val.requestId,model:effect.val.model,prompt:effect.val.prompt};break;
            case 'service':method='services.invoke';params={bindingId:effect.val.bindingId,method:effect.val.method,args:JSON.parse(effect.val.argsJson)};break;
          }
          const result=await broker.dispatch(principal,validateRequest({v:1,id:effect.val.requestId,type:'request',method,params}),signal,()=>{});return new TextEncoder().encode(JSON.stringify(result));
        },signal);
        if(!Array.isArray(effects)||effects.length>64||new TextEncoder().encode(JSON.stringify(effects)).length>262144)throw new PlatformError('invalid-effect');
        for(const effect of effects){if(typeof effect!=='object'||!effect||effect.tag!=='render'||typeof effect.val!=='object'||!effect.val||typeof effect.val.bodyJson!=='string'||effect.val.channel!=='analysis')throw new PlatformError('invalid-effect');
          const value:unknown=JSON.parse(effect.val.bodyJson);if(typeof value!=='object'||!value||!('words'in value)||!Number.isSafeInteger(value.words)||!('characters'in value)||!Number.isSafeInteger(value.characters))throw new PlatformError('invalid-effect');
          const current=await storage.getInstall(install.manifest.id);if(!current||current.generation!==install.generation||!current.enabled||signal.aborted)throw new PlatformError('revoked');
          const checkpoint=await guest.call('snapshot',null);if(checkpoint instanceof Uint8Array)await storage.put('host',`service-checkpoint/${install.manifest.id}`,Array.from(checkpoint),67108864);
          diagnose('guest-completed',install.manifest.id,'Rust Component Model analysis completed');return value;
        }
        throw new PlatformError('invalid-effect');
      }catch(error){const failure={count:(prior?.count??0)+1,until:Date.now()+Math.min(30000,1000*2**(prior?.count??0))};crashes.set(install.manifest.id,failure);diagnose('guest-failed',install.manifest.id,'Worker stopped; bounded retry backoff');if(failure.count>=3)await quarantine(install.manifest.id);throw error;}
      finally{unbind();signal.removeEventListener('abort',abort);guest.close();guests.delete(install.manifest.id);}
    },signal);
  }
  broker=new CapabilityBroker(storage,{...options,analyze});
  async function install(pkg:VerifiedPackage,grants:string[],signal?:AbortSignal,recoverySnapshot?:string){
    validateManifest(pkg.manifest);checkGrants(pkg,grants);checkRevocation(pkg);await checkAssets(pkg);if(Date.parse(pkg.receipt.expiresAt)<=Date.now())throw new PlatformError('expired-receipt');
    const installed=await storage.listInstalls(),selections=new Map<string,string>();for(const item of installed.filter(entry=>entry.enabled)){const bindings=validateDependencyBindings(item.dependencyBindings??[]);if(item.manifest.requires.length!==bindings.length)throw new PlatformError('dependency-lock-missing');for(const binding of bindings){if(!item.manifest.requires.includes(binding.interface)||!installed.some(provider=>provider.enabled&&provider.manifest.id===binding.provider&&provider.digest===binding.providerDigest))throw new PlatformError('stale-dependency-lock');selections.set(`${item.manifest.id}:${binding.interface}`,binding.provider);}}for(const [key,provider] of options.dependencySelections??[])selections.set(key,provider);
    if(installed.some(item=>item.enabled&&item.manifest.id!==pkg.manifest.id&&item.dependencyBindings?.some(binding=>binding.provider===pkg.manifest.id&&binding.providerDigest!==pkg.envelope.archive.sha256)))throw new PlatformError('dependency-provider-changed');
    const graph=resolveDependencyGraph([...installed.filter(item=>item.enabled&&item.manifest.id!==pkg.manifest.id).map(item=>({digest:item.digest,manifest:item.manifest})),{digest:pkg.envelope.archive.sha256,manifest:pkg.manifest}],selections);
    const id=pkg.manifest.id;const name=`install/${id}`;const lease=await storage.acquireLease(name,owner);let old=await storage.getInstall(id),frozen=false;let migrated:string|undefined=recoverySnapshot;
    try{
      await storage.putJournal(id,{stage:'staging',digest:pkg.envelope.archive.sha256,previous:old?.digest??null,fence:lease.fence},{name,owner,fence:lease.fence});
      await options.onInstallStage?.('staging',id);
      if(signal?.aborted)throw new PlatformError('cancelled');
      await storage.putArtifact(pkg.envelope.archive.sha256,pkg);
      await options.onInstallStage?.('artifact',id);
      if(old){const previous=old;old=await storage.freezeInstall(id,{name,owner,fence:lease.fence},previous.revision);frozen=true;broker.invalidate(id);guests.get(id)?.close();if(active?.principal.plugin===id)active.close();
        const snapshot=await storage.exportNamespace(id);await storage.put('host',`snapshot/${id}/${pkg.envelope.archive.sha256}`,snapshot,67108864);await options.onInstallStage?.('snapshot',id);
        if(recoverySnapshot)await storage.put('host',`recovery/${id}/${Date.now()}`,snapshot,67108864);
        else if(options.migrate)migrated=await options.migrate(previous,pkg,snapshot,signal??new AbortController().signal);
        else if(previous.manifest.version.split('.')[0]!==pkg.manifest.version.split('.')[0])throw new PlatformError('migration-required');
        await options.onInstallStage?.('migration',id);
      }
      const next:InstalledPlugin={manifest:pkg.manifest,digest:pkg.envelope.archive.sha256,generation:Math.max(old?.generation??0,await storage.lastGeneration(id))+1,revision:(old?.revision??0)+1,grants:[...grants],enabled:true,state:'ready',receipt:pkg.receipt,dependencyBindings:graph.bindings.filter(binding=>binding.consumer===pkg.manifest.id).map(({interface:requiredInterface,provider,providerDigest})=>({interface:requiredInterface,provider,providerDigest})),...(old?{previousDigest:old.digest}:{})};
      if(signal?.aborted)throw new PlatformError('cancelled');
      await options.aiTransport?.register?.(next,pkg,true);
      if(signal?.aborted)throw new PlatformError('cancelled');
      await options.onInstallStage?.('commit',id);if(signal?.aborted)throw new PlatformError('cancelled');
      checkRevocation(pkg);
      await storage.commitInstall(id,next,{name,owner,fence:lease.fence},old?.revision??0,migrated?{namespace:id,backup:migrated,quota:pkg.manifest.permissions.find(p=>p.capability==='storage.kv')?.scope.quotaBytes??1048576}:undefined);
      broker.invalidate(id);if(active?.principal.plugin===id){active.close();active=undefined;}
      diagnose(old?'updated':'installed',id,`${pkg.manifest.name} ${pkg.manifest.version} ready`);return next;
    }catch(error){await storage.failInstall(id,{name,owner,fence:lease.fence},frozen?old?.revision:undefined);throw error;}
    finally{await storage.releaseLease(name,owner,lease.fence);}
  }
  async function mount(container:HTMLElement,id:string):Promise<FrameSession>{
    const install=await storage.getInstall(id);if(!install?.enabled||install.state==='quarantined')throw new PlatformError('disabled');
    const bindings=validateDependencyBindings(install.dependencyBindings??[]);if(install.manifest.requires.length!==bindings.length)throw new PlatformError('dependency-lock-missing');const providers=await storage.listInstalls();for(const binding of bindings){const provider=providers.find(item=>item.enabled&&item.manifest.id===binding.provider&&item.digest===binding.providerDigest);if(!install.manifest.requires.includes(binding.interface)||!provider||!validateManifest(provider.manifest).provides.includes(binding.interface))throw new PlatformError('stale-dependency-lock');}
    const pkg=persistedPackage(await storage.getArtifact(install.digest));await checkAssets(pkg);await options.aiTransport?.register?.(install,pkg);
    if(!pkg.manifest.ui||pkg.manifest.ui.profile!=='isolated-web')throw new PlatformError('unsupported-ui');
    active?.close();
    const principal:Principal=Object.freeze({workspace:'local',plugin:id,digest:install.digest,generation:install.generation,instance:crypto.randomUUID(),connection:crypto.randomUUID()});
    const unbind=broker.bind(principal);const bundle=pkg.files[pkg.manifest.ui.entry],css=pkg.manifest.ui.style?pkg.files[pkg.manifest.ui.style]:undefined;
    if(!bundle){unbind();throw new PlatformError('missing-entry');}
    let session:FrameSession;
    session=mountIsolatedUI(container,{bundle:new TextDecoder('utf8',{fatal:true}).decode(bundle),css:css?new TextDecoder('utf8',{fatal:true}).decode(css):'',title:pkg.manifest.name,principal,
      dispatch:(r:Request,signal)=>broker.dispatch(principal,r,signal,event=>session.send(event)),onClose:()=>{unbind();if(active===session)active=undefined;diagnose('ui-closed',id,'UI session authority revoked');}});
    active=session;return session;
  }
  async function revoke(id:string,permissionId:string){
    const next=await storage.mutateInstall(id,old=>{if(!old)throw new PlatformError('absent');return {...old,generation:old.generation+1,revision:old.revision+1,grants:old.grants.filter(g=>g!==permissionId)};});
    broker.invalidate(id);guests.get(id)?.close();if(active?.principal.plugin===id)active.close();if(next)await options.aiTransport?.revoke?.(next,permissionId);diagnose('grant-revoked',id,'Local permission revoked and session closed; runtime synchronization is queued if unreachable');
  }
  async function quarantine(id:string){await storage.mutateInstall(id,old=>old?{...old,enabled:false,state:'quarantined',generation:old.generation+1,revision:old.revision+1}:undefined);broker.invalidate(id);guests.get(id)?.close();if(active?.principal.plugin===id)active.close();diagnose('quarantined',id,'Repeated worker failure; reset required');}
  async function uninstall(id:string,deleteData=false){const installations=await storage.listInstalls();for(const item of installations.filter(entry=>entry.enabled&&entry.manifest.id!==id)){const bindings=validateDependencyBindings(item.dependencyBindings??[]);if(item.manifest.requires.length!==bindings.length)throw new PlatformError('dependency-lock-missing');if(bindings.some(binding=>binding.provider===id)||item.manifest.requires.some(required=>options.dependencySelections?.get(`${item.manifest.id}:${required}`)===id))throw new PlatformError('dependency-in-use');}const expected=installations.find(item=>item.manifest.id===id);if(!expected)throw new PlatformError('absent');const name='install/'+id,lease=await storage.acquireLease(name,owner);try{broker.invalidate(id);guests.get(id)?.close();if(active?.principal.plugin===id)active.close();await options.aiTransport?.uninstall?.(id);await storage.removeInstall(id,expected,{name,owner,fence:lease.fence},deleteData);diagnose('uninstalled',id,deleteData?'Application and data removed':'Application removed; data retained');}finally{await storage.releaseLease(name,owner,lease.fence);}}
  async function rollback(id:string){
    const current=await storage.getInstall(id);if(!current?.previousDigest)throw new PlatformError('rollback-unavailable');const pkg=persistedPackage(await storage.getArtifact(current.previousDigest));
    const snapshot=await storage.get('host',`snapshot/${id}/${current.digest}`);if(typeof snapshot!=='string')throw new PlatformError('recovery-required');
    try{return await install(pkg,current.grants.filter(g=>pkg.manifest.permissions.some(p=>p.id===g)),undefined,snapshot);}catch(error){await storage.mutateInstall(id,old=>old?{...old,state:'recovery-required',enabled:false}:undefined);throw error;}
  }
  return {list:()=>storage.listInstalls(),resolve:(repo:string,signal?:AbortSignal)=>{if(!options.registries)throw new PlatformError('registry-unavailable');return options.registries.resolve(repo,signal);},install,mount,revoke,uninstall,update:install,rollback,
    exportData:(id:string)=>storage.exportNamespace(id),bindSelectedDocument:(consumer:string,provider:string,key='notes/selected')=>broker.selectDocument(consumer,provider,key),
    recover:()=>storage.recoverJournals(),
    suspend:()=>{active?.close();for(const guest of guests.values())guest.close();guests.clear();},
    reset:async(id:string)=>{crashes.delete(id);await storage.mutateInstall(id,old=>old?{...old,enabled:true,state:'ready',generation:old.generation+1,revision:old.revision+1}:undefined);},
    dispose:()=>{active?.close();for(const guest of guests.values())guest.close();guests.clear();},scheduler};
}
type RuntimeTransportStorage=Pick<PluginStorage,'getInstall'|'lastGeneration'|'get'|'list'|'put'|'delete'>;
export function createHttpAiTransport(getCsrf:()=>Promise<string>,storage:RuntimeTransportStorage):AiTransport{
  const pending=new Map<string,{install:InstalledPlugin;pkg:VerifiedPackage;reviewed:boolean}>();const registered=new Map<string,number>();const generations=new Map<string,number>();
  let session='';async function sessionToken(){const csrf=await getCsrf();if(session!==csrf){registered.clear();generations.clear();if(session)for(const saved of pending.values())saved.reviewed=false;session=csrf;}return csrf;}
  const remoteSchema=z.strictObject({installId:z.string(),generation:z.number().int().positive(),state:z.string(),digest:z.string().regex(/^[a-f0-9]{64}$/),grants:z.array(z.string()).max(64)});
  const bindingSchema=z.strictObject({id:z.string(),localGeneration:z.number().int().positive(),digest:z.string().regex(/^[a-f0-9]{64}$/),remoteGeneration:z.number().int().positive(),sessionFence:z.string().regex(/^[a-f0-9]{64}$/)});
  const removalSchema=z.strictObject({id:z.string(),kind:z.enum(['revoke','uninstall']),permissionId:z.string().optional(),localGeneration:z.number().int().positive(),digest:z.string().regex(/^[a-f0-9]{64}$/),remoteGeneration:z.number().int().positive().nullable(),sessionFence:z.string().regex(/^[a-f0-9]{64}$/).nullable()}).refine(operation=>operation.kind==='uninstall'||Boolean(operation.permissionId));
  const removals=new Map<string,Promise<void>>();
  const bindingKey=(id:string)=>`runtime-registration/${id}`;
  const sessionFence=async()=>sha256(new TextEncoder().encode(await sessionToken()));
  async function remoteRegistration(id:string){const csrf=await sessionToken();const response=await fetch(`/v1/installs/${encodeURIComponent(id)}/registration`,{credentials:'same-origin',headers:{'x-csrf-token':csrf},signal:AbortSignal.timeout(5000)});if(response.status===404)return undefined;if(!response.ok)throw new PlatformError('runtime-sync-failed');const parsed=remoteSchema.safeParse(await response.json());if(!parsed.success||parsed.data.installId!==id)throw new PlatformError('runtime-sync-failed');return parsed.data;}
  async function obsolete(operation:z.infer<typeof removalSchema>):Promise<boolean>{const local=await storage.getInstall(operation.id);if(operation.kind==='revoke')return !local||local.digest!==operation.digest||local.generation<operation.localGeneration||local.grants.includes(operation.permissionId??'');if(local)return local.digest!==operation.digest||local.generation!==operation.localGeneration;return await storage.lastGeneration(operation.id)!==operation.localGeneration+1;}
  async function flushRemovals(id:string):Promise<void>{
    const previous=removals.get(id)??Promise.resolve();const task=previous.catch(()=>undefined).then(async()=>{
      const records=(await storage.list('host')).filter(record=>record.key.startsWith(`runtime-removal/${id}/`));if(records.length>32)throw new PlatformError('quota-exceeded');
      for(const record of records){const parsed=removalSchema.safeParse(await storage.get('host',record.key));if(!parsed.success||parsed.data.id!==id)throw new PlatformError('consent-required');const operation=parsed.data;
        if(await obsolete(operation)){await storage.delete('host',record.key);continue;}
        const fence=await sessionFence();if(operation.sessionFence===null)throw new PlatformError('consent-required');if(operation.sessionFence!==fence){await storage.delete('host',record.key);continue;}
        const remote=await remoteRegistration(id);if(!remote||remote.state==='uninstalled'||(operation.kind==='revoke'&&remote.digest===operation.digest&&!remote.grants.includes(operation.permissionId??''))){await storage.delete('host',record.key);continue;}
        // A deferred removal binds the authority observed when consent was withdrawn, never the newest row.
        if(remote.digest!==operation.digest||operation.remoteGeneration===null||remote.generation!==operation.remoteGeneration)throw new PlatformError('consent-required');
        if(await obsolete(operation)){await storage.delete('host',record.key);continue;}if(await sessionFence()!==fence)throw new PlatformError('revoked');
        const csrf=await sessionToken();const response=await fetch(`/v1/installs/${encodeURIComponent(id)}${operation.kind==='revoke'?'/grants':''}`,{method:operation.kind==='revoke'?'PUT':'DELETE',credentials:'same-origin',signal:AbortSignal.timeout(5000),headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify(operation.kind==='revoke'?{generation:operation.remoteGeneration,grants:remote.grants.filter(grant=>grant!==operation.permissionId)}:{expectedGeneration:operation.remoteGeneration})});if(!response.ok)throw new PlatformError('runtime-sync-failed');
        const result=z.object({generation:z.number().int().positive()}).safeParse(await response.json());if(!result.success)throw new PlatformError('runtime-sync-failed');
        await storage.delete('host',record.key);registered.delete(id);generations.delete(id);
        if(operation.kind==='uninstall')await storage.delete('host',bindingKey(id));else{const local=await storage.getInstall(id);if(local&&local.digest===operation.digest)await storage.put('host',bindingKey(id),{id,localGeneration:local.generation,digest:local.digest,remoteGeneration:result.data.generation,sessionFence:fence},67108864);
          // Only our successful restrictive CAS can advance another queued removal's baseline.
          for(const pending of(await storage.list('host')).filter(item=>item.key.startsWith(`runtime-removal/${id}/`))){const value=removalSchema.safeParse(pending.value);if(value.success&&value.data.sessionFence===fence&&value.data.digest===operation.digest&&value.data.remoteGeneration===operation.remoteGeneration)await storage.put('host',pending.key,{...value.data,remoteGeneration:result.data.generation},67108864);}}
      }
    });removals.set(id,task);try{await task;}finally{if(removals.get(id)===task)removals.delete(id);}
  }
  async function queueRemoval(id:string,kind:'revoke'|'uninstall',permissionId?:string){const local=await storage.getInstall(id);if(!local){await flushRemovals(id).catch(()=>undefined);return;}const parsed=bindingSchema.safeParse(await storage.get('host',bindingKey(id))),known=parsed.success&&parsed.data.id===id?parsed.data:undefined;let fence=known?.sessionFence??null;try{fence=await sessionFence();}catch{}const remoteGeneration=known&&known.digest===local.digest&&known.localGeneration<=local.generation&&known.sessionFence===fence?known.remoteGeneration:null;await storage.put('host',`runtime-removal/${id}/${crypto.randomUUID()}`,{id,kind,...(permissionId?{permissionId}:{}),localGeneration:local.generation,digest:local.digest,remoteGeneration,sessionFence:fence},67108864);registered.delete(id);generations.delete(id);await flushRemovals(id).catch(()=>undefined);}
  async function api(path:string,body?:unknown,signal?:AbortSignal){const csrf=await sessionToken();const response=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',signal,headers:{'content-type':'application/json','x-csrf-token':csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const value:unknown=await response.json();if(!response.ok){const error=typeof value==='object'&&value&&'error'in value?value.error:value;throw new PlatformError(typeof error==='object'&&error&&'code'in error?String(error.code):'provider-unavailable');}return value;}
  async function ensureRegistration(install:InstalledPlugin):Promise<number>{
    const current=async()=>{const value=await storage.getInstall(install.manifest.id);if(!value||!value.enabled||value.generation!==install.generation||value.digest!==install.digest||JSON.stringify(value.grants)!==JSON.stringify(install.grants))throw new PlatformError('revoked');};
    await sessionToken();await current();const id=install.manifest.id;if(pending.get(id)?.reviewed)for(const record of(await storage.list('host')).filter(item=>item.key.startsWith(`runtime-removal/${id}/`))){const operation=removalSchema.safeParse(record.value);if(operation.success&&operation.data.id===id&&operation.data.localGeneration<install.generation)await storage.delete('host',record.key);}await flushRemovals(id);if(registered.get(id)!==install.generation){const saved=pending.get(id);if(!saved?.pkg.packet||saved.install.digest!==install.digest||saved.install.generation!==install.generation||saved.pkg.envelope.archive.sha256!==install.digest)throw new PlatformError('missing-signature');
      const registration=await remoteRegistration(id);const expectedGeneration=registration?.generation??0;
      if(registration&&(registration.digest!==install.digest||JSON.stringify([...registration.grants].sort())!==JSON.stringify([...install.grants].sort())||registration.state!=='active')&&!saved.reviewed)throw new PlatformError('consent-required');
      await current();const fence=await sessionFence(),result=await api('/v1/installs',{packet:encodeInstallPacket(saved.pkg.packet),grants:install.grants,expectedGeneration});if(typeof result!=='object'||!result||!('generation'in result)||typeof result.generation!=='number'||!Number.isSafeInteger(result.generation))throw new PlatformError('runtime-sync-failed');if(await sessionFence()!==fence)throw new PlatformError('revoked');await storage.put('host',bindingKey(id),{id,localGeneration:install.generation,digest:install.digest,remoteGeneration:result.generation,sessionFence:fence},67108864);await current();generations.set(id,result.generation);registered.set(id,install.generation);saved.reviewed=false;}
    const generation=generations.get(id);if(!generation)throw new PlatformError('runtime-sync-failed');return generation;
  }
  return {register:async(install,pkg,reviewed=false)=>{const verified=persistedPackage(pkg),old=pending.get(install.manifest.id);pending.set(install.manifest.id,{install,pkg:verified,reviewed:reviewed||(old?.install.generation===install.generation&&old.reviewed===true)});if(registered.get(install.manifest.id)!==install.generation)registered.delete(install.manifest.id);await flushRemovals(install.manifest.id).catch(()=>undefined);},
    start:async(install,p,signal)=>{if(signal.aborted)throw new PlatformError('cancelled');
      const generation=await ensureRegistration(install);return api('/v1/runs',{installId:install.manifest.id,generation,idempotencyKey:p.requestId,model:p.model,prompt:p.prompt},signal);},
    network:async(install,url,method,signal)=>{const generation=await ensureRegistration(install);const permission=install.manifest.permissions.find(p=>p.capability==='network.http'&&install.grants.includes(p.id));if(!permission)throw new PlatformError('permission-denied');if(signal.aborted)throw new PlatformError('cancelled');return api('/v1/network/request',{installId:install.manifest.id,generation,grantId:permission.id,url,method},signal);},
    cancel:(_install,runId)=>api(`/v1/runs/${encodeURIComponent(runId)}/cancel`,{}),
    revoke:async(install,permissionId)=>{const saved=pending.get(install.manifest.id);if(saved){saved.install=install;saved.reviewed=false;}if(permissionId)await queueRemoval(install.manifest.id,'revoke',permissionId);registered.delete(install.manifest.id);},
    uninstall:async id=>{pending.delete(id);await queueRemoval(id,'uninstall');registered.delete(id);},
    subscribe:async(_install,runId,after,emit,signal)=>{
      const response=await fetch(`/v1/runs/${encodeURIComponent(runId)}/events?after=${after}`,{credentials:'same-origin',signal});if(!response.ok||!response.body)throw new PlatformError('provider-unavailable');
      const reader=response.body.getReader(),parser=new SseParser();
      for(;;){const {value,done}=await reader.read();if(done)break;for(const event of parser.push(value)){let data:unknown;try{data=JSON.parse(event.data);}catch{throw new PlatformError('invalid-stream');}emit({type:'ai.event',event:data});}}
      parser.finish();return {runId};
    }};
}


