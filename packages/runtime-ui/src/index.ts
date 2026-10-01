import type { Principal, Reply, Request } from '../../contracts/src/index.ts';
import { PlatformError, validateRequest } from '../../contracts/src/index.ts';
export type FrameSession = {frame:HTMLIFrameElement;principal:Principal;close:()=>void;send:(value:unknown)=>void};
function base64(text:string):string {
  return btoa(Array.from(new TextEncoder().encode(text),b=>String.fromCharCode(b)).join(''));
}
export function mountIsolatedUI(container:HTMLElement,options:{bundle:string;css:string;principal:Principal;title:string;
  dispatch:(request:Request,signal:AbortSignal)=>Promise<unknown>;onClose?:()=>void}):FrameSession {
  const frame=document.createElement('iframe');const nonce=crypto.randomUUID();const boot=crypto.randomUUID();
  const controller=new AbortController();const channel=new MessageChannel();let closed=false,connected=false,loads=0,inflight=0;
  const seen=new Set<string>();
  frame.title=options.title;frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('referrerpolicy','no-referrer');
  frame.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
  const close=()=>{if(closed)return;closed=true;controller.abort();window.removeEventListener('message',handshake);channel.port1.close();channel.port2.close();frame.remove();options.onClose?.();};
  const handshake=(event:MessageEvent<unknown>)=>{
    if(closed || connected || event.source!==frame.contentWindow || typeof event.data!=='object' || event.data===null || !('boot' in event.data) || event.data.boot!==boot) return;
    connected=true;window.removeEventListener('message',handshake);
    frame.contentWindow?.postMessage({type:'pwacloud:init',boot},'*',[channel.port2]);
  };
  channel.port1.onmessage=async(event:MessageEvent<unknown>)=>{
    if(closed)return;let request:Request;
    try {request=validateRequest(event.data);if(seen.has(request.id)||seen.size>=10000||inflight>=64)throw new PlatformError('protocol-limit');seen.add(request.id);}
    catch {close();return;}
    inflight++;
    let reply:Reply;
    try {const data=await options.dispatch(request,controller.signal);reply={v:1,id:request.id,type:'response',ok:true,data};}
    catch(e){reply={v:1,id:request.id,type:'response',ok:false,error:{code:e instanceof PlatformError?e.code:'internal',message:e instanceof PlatformError?e.message:'Operation failed'}};}
    finally {inflight--;}
    if(!closed)channel.port1.postMessage(reply);
  };
  frame.addEventListener('load',()=>{loads++;if(loads>1)close();});
  window.addEventListener('message',handshake);
  const csp=`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src data: blob:; font-src data: blob:; media-src blob:; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  const bootstrap=`(()=>{const boot=${JSON.stringify(boot)};window.addEventListener('message',function init(e){if(e.source!==parent||e.data?.type!=='pwacloud:init'||e.data.boot!==boot||e.ports.length!==1)return;window.removeEventListener('message',init);window.__pwacloudPort=e.ports[0];window.dispatchEvent(new Event('pwacloud-ready'));});parent.postMessage({boot},'*');const s=document.createElement('script');s.nonce=${JSON.stringify(nonce)};s.textContent=new TextDecoder().decode(Uint8Array.from(atob(${JSON.stringify(base64(options.bundle))}),c=>c.charCodeAt(0)));document.body.append(s);})();`;
  const styleBootstrap=`const t=document.createElement('style');t.nonce=${JSON.stringify(nonce)};t.textContent=new TextDecoder().decode(Uint8Array.from(atob(${JSON.stringify(base64(options.css))}),c=>c.charCodeAt(0)));document.head.append(t);`;
  frame.srcdoc=`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>Plugin</title></head><body><div id="root"></div><script nonce="${nonce}">${styleBootstrap}${bootstrap}</script></body></html>`;
  container.replaceChildren(frame);
  return {frame,principal:options.principal,close,send:value=>{if(!closed)channel.port1.postMessage(value);}};
}
