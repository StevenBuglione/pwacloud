/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;
declare const SW_VERSION:string;
declare const SW_STATIC:string[];
const VERSION=SW_VERSION;
const STATIC=SW_STATIC;
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(STATIC)));});
self.addEventListener('message',event=>{const data:unknown=event.data;if(typeof data==='object'&&data!==null&&'type' in data&&data.type==='apply-update')void self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)))),self.clients.claim()]));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||event.request.method!=='GET'||url.pathname.startsWith('/v1/')||url.pathname==='/health')return;
  if(url.pathname==='/guest/allowed.json'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(async response=>{if(response.ok){const cache=await caches.open(VERSION);await cache.put(event.request,response.clone());}return response;}).catch(async()=>await caches.match(event.request)??new Response('Offline guest catalogue unavailable',{status:503})));return;
  }
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(async response=>{if(response.ok){const cache=await caches.open(VERSION);await cache.put('/index.html',response.clone());}return response;}).catch(async()=>{const cached=await caches.match('/index.html');return cached??new Response('Offline shell unavailable',{status:503});}));
    return;
  }
  if(url.pathname.startsWith('/assets/')||STATIC.includes(url.pathname)||url.pathname.startsWith('/guest/'))event.respondWith(caches.match(event.request).then(cached=>cached??fetch(event.request).then(async response=>{if(response.ok){const cache=await caches.open(VERSION);await cache.put(event.request,response.clone());}return response;})));
});
export {};
