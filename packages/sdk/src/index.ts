import { PlatformError } from '../../contracts/src/errors.ts';
import type { Reply } from '../../contracts/src/index.ts';
declare global { interface Window { __pwacloudPort?:MessagePort } }
export type PluginClient = {call:<T=unknown>(method:string,params:Record<string,unknown>)=>Promise<T>;dispose:()=>void;subscribe:(listener:(event:unknown)=>void)=>()=>void};
export async function connectPlugin():Promise<PluginClient> {
  if(!window.__pwacloudPort) await new Promise<void>((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new PlatformError('timeout')),5000);
    window.addEventListener('pwacloud-ready',()=>{clearTimeout(timeout);resolve();},{once:true});
  });
  const port=window.__pwacloudPort;if(!port)throw new PlatformError('disconnected');
  const pending=new Map<string,{resolve:(data:unknown)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  const listeners=new Set<(event:unknown)=>void>();
  port.onmessage=(event:MessageEvent<unknown>)=>{
    const data=event.data;
    if(typeof data!=='object'||!data)return;
    if(!('type' in data)||data.type!=='response'){for(const listener of listeners)listener(data);return;}
    const reply=data as Reply;
    if(typeof reply.id!=='string'||typeof reply.ok!=='boolean')return;
    const p=pending.get(reply.id);if(!p)return;pending.delete(reply.id);clearTimeout(p.timer);
    if(reply.ok)p.resolve(reply.data);else p.reject(new PlatformError(reply.error?.code??'internal',reply.error?.message));
  };
  port.start();
  return {call:<T>(method:string,params:Record<string,unknown>)=>new Promise<T>((resolve,reject)=>{
    if(pending.size>=64){reject(new PlatformError('protocol-limit'));return;}
    const id=crypto.randomUUID();const timer=setTimeout(()=>{pending.delete(id);reject(new PlatformError('timeout'));},30000);
    pending.set(id,{resolve:data=>resolve(data as T),reject,timer});port.postMessage({v:1,id,type:'request',method,params});
  }),subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},dispose:()=>{
    for(const p of pending.values()){clearTimeout(p.timer);p.reject(new PlatformError('cancelled'));}pending.clear();listeners.clear();port.close();
  }};
}
