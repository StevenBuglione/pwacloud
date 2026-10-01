import {lifecycle} from '../../../artifacts/guest/generated/guest.js';
type GuestMessage = {id:number;method:'handle'|'snapshot'|'activate';payload:unknown};
const context=globalThis as unknown as {onmessage:(e:MessageEvent<GuestMessage>)=>void;postMessage:(v:unknown)=>void};
lifecycle.activate('{}',undefined);
context.onmessage=e=>{const {id,method,payload}=e.data;try{
  const result=method==='snapshot'?lifecycle.snapshot():method==='activate'?lifecycle.activate('{}',undefined):lifecycle.handle(payload as Parameters<typeof lifecycle.handle>[0]);
  context.postMessage({id,result});
}catch{context.postMessage({id,error:'guest-failed'});}};
context.postMessage({ready:true});
