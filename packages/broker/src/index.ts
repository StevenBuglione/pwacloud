import {PlatformError,stringParam,type Principal,type Request,type Permission} from '../../contracts/src/index.ts';
import {networkAllowed} from '../../../src/reference/policy.ts';
import {valueBytes,type PluginStorage,type InstalledPlugin} from '../../storage/src/index.ts';
export type AiTransport = {start:(install:InstalledPlugin,params:Record<string,unknown>,signal:AbortSignal)=>Promise<unknown>;
  cancel:(install:InstalledPlugin,runId:string)=>Promise<unknown>;subscribe?:(install:InstalledPlugin,runId:string,after:number,emit:(event:unknown)=>void,signal:AbortSignal)=>Promise<unknown>;
  network?:(install:InstalledPlugin,url:string,method:string,signal:AbortSignal)=>Promise<unknown>;
  register?:(install:InstalledPlugin,pkg:unknown,reviewed?:boolean)=>Promise<void>;revoke?:(install:InstalledPlugin,permissionId?:string)=>Promise<void>;uninstall?:(id:string)=>Promise<void>};
type Binding = {consumer:string;provider:string;key:string;consumerGeneration:number;providerGeneration:number;expires:number;used:boolean};
export class CapabilityBroker {
  private bindings=new Map<string,Binding>();private connections=new Map<string,Principal>();
  private streams=new Map<string,AbortController>();
  constructor(private storage:PluginStorage,private options:{aiTransport?:AiTransport;analyze?:(install:InstalledPlugin,text:string,signal:AbortSignal)=>Promise<unknown>;
    onBindingRequest?:(consumerId:string,providerId:string,key:string)=>Promise<boolean>;onNavigate?:(pluginId:string,route:string)=>void;network?:(install:InstalledPlugin,url:string,method:string,signal:AbortSignal)=>Promise<unknown>;announce?:(message:string)=>void}){}
  bind(principal:Principal){this.connections.set(principal.connection,principal);return()=>{this.connections.delete(principal.connection);this.closeStreams(principal.connection);};}
  private closeStreams(connection:string){for(const [id,stream]of this.streams)if(id.startsWith(connection+'/')){stream.abort();this.streams.delete(id);}}
  private async current(p:Principal):Promise<InstalledPlugin>{
    const bound=this.connections.get(p.connection);const install=await this.storage.getInstall(p.plugin);
    if(bound!==p||!install||!install.enabled||install.digest!==p.digest||install.generation!==p.generation||p.workspace!=='local')throw new PlatformError('revoked');return install;
  }
  private grant(install:InstalledPlugin,capability:string):Permission{
    const permission=install.manifest.permissions.find(p=>p.capability===capability&&install.grants.includes(p.id));if(!permission)throw new PlatformError('permission-denied');return permission;
  }
  async selectDocument(consumer:string,provider:string,key:string):Promise<string>{
    const c=await this.storage.getInstall(consumer),p=await this.storage.getInstall(provider);if(!c||!p||!c.enabled||!p.enabled)throw new PlatformError('revoked');
    const permission=this.grant(c,'services.invoke');this.grant(p,'storage.kv');
    if(permission.capability!=='services.invoke'||!permission.scope.interfaces.includes('pwacloud:documents/selected@1.0.0'))throw new PlatformError('permission-denied');
    if(!p.manifest.provides.includes('pwacloud:documents/selected@1.0.0')||key!=='notes/selected')throw new PlatformError('permission-denied');
    const id='selected-note';this.bindings.set(`${consumer}/${id}`,{consumer,provider,key,consumerGeneration:c.generation,providerGeneration:p.generation,expires:Date.now()+60000,used:false});return id;
  }
  invalidate(plugin:string){for(const [id,b]of this.bindings)if(b.consumer===plugin||b.provider===plugin)this.bindings.delete(id);for(const [id,p]of this.connections)if(p.plugin===plugin){this.closeStreams(id);this.connections.delete(id);}}
  async dispatch(p:Principal,r:Request,signal:AbortSignal,emit:(event:unknown)=>void):Promise<unknown>{
    if(signal.aborted)throw new PlatformError('cancelled');const install=await this.current(p);
    switch(r.method){
      case 'storage.get':{this.grant(install,'storage.kv');const value=await this.storage.get(p.plugin,stringParam(r.params,'key'));await this.current(p);if(signal.aborted)throw new PlatformError('cancelled');return value;}
      case 'storage.put':{const permission=this.grant(install,'storage.kv');if(permission.capability!=='storage.kv')throw new PlatformError('permission-denied');await this.storage.put(p.plugin,stringParam(r.params,'key'),r.params.value,permission.scope.quotaBytes,{principal:p,capability:'storage.kv'});return null;}
      case 'storage.delete':this.grant(install,'storage.kv');await this.storage.delete(p.plugin,stringParam(r.params,'key'),{principal:p,capability:'storage.kv'});return null;
      case 'network.request':{const permission=this.grant(install,'network.http');const url=stringParam(r.params,'url'),method=stringParam(r.params,'method');
        if(permission.capability!=='network.http'||!networkAllowed(url,method,permission.scope.rules))throw new PlatformError('permission-denied');
        if(!navigator.onLine)throw new PlatformError('offline');await this.current(p);
        if(this.options.network){const result=await this.options.network(install,url,method,signal);await this.current(p);if(signal.aborted)throw new PlatformError('cancelled');return result;}
        const response=await fetch(url,{method,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
        if(!response.ok)throw new PlatformError('network-failed');if(Number(response.headers.get('content-length')??0)>1048576)throw new PlatformError('quota-exceeded');
        const reader=response.body?.getReader();const chunks:Uint8Array[]=[];let size=0;if(reader)try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1048576)throw new PlatformError('quota-exceeded');chunks.push(value);}}finally{await reader.cancel();}
        await this.current(p);const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return {status:response.status,body:new TextDecoder().decode(bytes)};}
      case 'commands.invoke':if(!install.manifest.service||!this.options.analyze)throw new PlatformError('unsupported-capability');return this.options.analyze(install,stringParam(r.params,'text'),signal);
      case 'services.invoke':{this.grant(install,'services.invoke');const bindingId=stringParam(r.params,'bindingId');if(bindingId!=='selected-note'||r.params.method!=='read')throw new PlatformError('permission-denied');
        const key=`${p.plugin}/${bindingId}`;let binding=this.bindings.get(key);
        if(!binding||binding.used||binding.expires<=Date.now()){
          const provider=(await this.storage.listInstalls()).find(i=>i.manifest.provides.includes('pwacloud:documents/selected@1.0.0'));
          if(!provider||!this.options.onBindingRequest||!await this.options.onBindingRequest(p.plugin,provider.manifest.id,'notes/selected'))throw new PlatformError('permission-denied');
          await this.current(p);await this.selectDocument(p.plugin,provider.manifest.id,'notes/selected');binding=this.bindings.get(key);
        }
        if(!binding||binding.used||binding.expires<=Date.now()||binding.consumerGeneration!==install.generation)throw new PlatformError('revoked');
        const provider=await this.storage.getInstall(binding.provider);if(!provider||provider.generation!==binding.providerGeneration||!provider.enabled)throw new PlatformError('revoked');this.grant(provider,'storage.kv');
        binding.used=true;const value=await this.storage.get(binding.provider,binding.key);const latestProvider=await this.storage.getInstall(binding.provider);if(!latestProvider||latestProvider.generation!==binding.providerGeneration||!latestProvider.enabled)throw new PlatformError('revoked');this.grant(latestProvider,'storage.kv');await this.current(p);if(signal.aborted)throw new PlatformError('cancelled');if(typeof value!=='object'||!value||!('text'in value)||typeof value.text!=='string'||value.text.length>32000)throw new PlatformError('invalid-document');return {title:'title'in value&&typeof value.title==='string'?value.title:'Selected note',text:value.text};}
      case 'ai.start':this.grant(install,'ai.respond');if(!this.options.aiTransport)throw new PlatformError('provider-unavailable');return this.options.aiTransport.start(install,r.params,signal);
      case 'ai.cancel':this.grant(install,'ai.respond');return this.options.aiTransport?.cancel(install,stringParam(r.params,'runId'));
      case 'ai.subscribe':{this.grant(install,'ai.respond');if(!this.options.aiTransport?.subscribe)throw new PlatformError('provider-unavailable');
        const runId=stringParam(r.params,'runId'),key=p.connection+'/'+runId;if(this.streams.size>=64)throw new PlatformError('quota-exceeded');this.streams.get(key)?.abort();
        const stream=new AbortController();this.streams.set(key,stream);
        let delivery=Promise.resolve(),queued=0,queuedBytes=0;void this.options.aiTransport.subscribe(install,runId,Number(r.params.after),event=>{if(stream.signal.aborted||signal.aborted)return;let bytes:number;try{bytes=valueBytes(event);}catch{stream.abort();return;}if(queued>=64||queuedBytes+bytes>262144){stream.abort();emit({type:'ai.transport-error',runId,code:'quota-exceeded'});return;}queued++;queuedBytes+=bytes;delivery=delivery.then(async()=>{if(stream.signal.aborted||signal.aborted)return;const current=await this.current(p);this.grant(current,'ai.respond');if(!stream.signal.aborted&&!signal.aborted)emit(event);}).catch(()=>{stream.abort();}).finally(()=>{queued--;queuedBytes-=bytes;});},AbortSignal.any([signal,stream.signal])).catch(error=>{if(!stream.signal.aborted&&!signal.aborted)emit({type:'ai.transport-error',runId,code:error instanceof PlatformError?error.code:'provider-unavailable'});}).finally(()=>{void delivery.finally(()=>{if(this.streams.get(key)===stream)this.streams.delete(key);});});
        return {runId,subscribed:true};}
      case 'ai.unsubscribe':{const key=p.connection+'/'+stringParam(r.params,'runId');this.streams.get(key)?.abort();this.streams.delete(key);return null;}
      case 'ui.announce':this.options.announce?.(stringParam(r.params,'message'));return null;
      case 'ui.setTitle':return null;
      case 'ui.navigate':{const route=stringParam(r.params,'route');if(!/^[a-z0-9/-]{1,120}$/.test(route))throw new PlatformError('invalid-request');this.options.onNavigate?.(p.plugin,route);return null;}
      case 'ui.checkpoint':{if(valueBytes(r.params.value)>262144)throw new PlatformError('quota-exceeded');const storage=install.manifest.permissions.find(permission=>permission.capability==='storage.kv'&&install.grants.includes(permission.id));await this.storage.put(p.plugin,'host/checkpoint',r.params.value,storage?.capability==='storage.kv'?storage.scope.quotaBytes:262144,{principal:p});return null;}
      default:throw new PlatformError('invalid-request');
    }
  }
}
export {ScopedAgent,createSelectedDocumentAgent} from './agent.ts';
export type {Tool,AgentCall,AgentApproval,AgentOptions,WriteAdmission} from './agent.ts';

