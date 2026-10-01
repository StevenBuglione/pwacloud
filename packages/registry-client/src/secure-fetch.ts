import { lookup } from 'node:dns/promises';
import { request,Agent } from 'node:https';
import { isIP } from 'node:net';
import { PlatformError } from '../../contracts/src/index';
export function isPublicAddress(address:string):boolean {
  const family=isIP(address);
  if(family===4) {const parts=address.split('.').map(Number),a=parts[0]??0,b=parts[1]??0,c=parts[2]??0;
    return !(a===0 || a===10 || a===127 || a>=224 || a===169&&b===254 || a===172&&b>=16&&b<=31 || a===192&&(b===168 || b===0 || b===2) || a===100&&b>=64&&b<=127 || a===198&&(b===18 || b===19 || b===51&&c===100) || a===203&&b===0&&c===113);
  }
  if(family===6) {const normalized=address.toLowerCase();return /^[23][0-9a-f]{3}:/.test(normalized) && !normalized.startsWith('2001:') && !normalized.startsWith('2002:') && !normalized.startsWith('3fff:');} return false;
}
export type SecureFetchOptions={signal?:AbortSignal;maximumBytes?:number;allowedOrigins?:readonly string[];maximumRedirects?:number;method?:'GET'|'HEAD';headers?:Readonly<Record<string,string>>};
export type SecureResponse={status:number;headers:Readonly<Record<string,string>>;bytes:Uint8Array;url:string};
export async function secureFetch(input:string,options:SecureFetchOptions={}):Promise<SecureResponse> {
  let url=new URL(input),headers={...options.headers};const maximum=options.maximumBytes??64*1024*1024;
  for(let hop=0;hop<=(options.maximumRedirects??5);hop++) {
    if(url.protocol!=='https:' || url.username || url.password || url.hash || url.port && url.port!=='443' || options.allowedOrigins && !options.allowedOrigins.includes(url.origin)) throw new PlatformError('blocked-destination');
    const host=url.hostname.replace(/^\[|\]$/g,'');const addresses=await lookup(host,{all:true,verbatim:true});
    if(addresses.length===0 || addresses.some(a=>!isPublicAddress(a.address))) throw new PlatformError('blocked-destination');
    const pinned=addresses[0];if(!pinned) throw new PlatformError('blocked-destination');
    const response=await new Promise<SecureResponse>((resolve,reject)=>{
      const agent=new Agent({autoSelectFamily:false,family:pinned.family,lookup:(_hostname,_opts,cb)=>cb(null,pinned.address,pinned.family)});
      const req=request(url,{method:options.method??'GET',headers:{'User-Agent':'PWACloud/0.1',...headers},signal:options.signal,agent},res=>{
        const remote=res.socket.remoteAddress;
        if(!remote || !isPublicAddress(remote) || remote!==pinned.address) {res.destroy();reject(new PlatformError('blocked-peer'));return;}
        const chunks:Buffer[]=[];let bytes=0;const declared=Number(res.headers['content-length']);if(Number.isFinite(declared)&&declared>maximum) {res.destroy();reject(new PlatformError('response-budget'));return;}
        res.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>maximum) {res.destroy(new PlatformError('response-budget'));return;}chunks.push(chunk);});res.on('error',reject);res.on('end',()=>{const headers:Record<string,string>={};for(const [key,value] of Object.entries(res.headers)) if(typeof value==='string') headers[key]=value;resolve({status:res.statusCode??0,headers,bytes:new Uint8Array(Buffer.concat(chunks)),url:url.href});});
      });req.setTimeout(15000,()=>req.destroy(new PlatformError('network-timeout')));req.on('error',reject);req.on('close',()=>agent.destroy());req.end();
    });
    if([301,302,303,307,308].includes(response.status)) {const location=response.headers['location'];if(!location) throw new PlatformError('invalid-redirect');const next=new URL(location,url);if(next.origin!==url.origin)headers=Object.fromEntries(Object.entries(headers).filter(([key])=>['accept','user-agent'].includes(key.toLowerCase())));url=next;continue;} return response;
  }
  throw new PlatformError('redirect-budget');
}
