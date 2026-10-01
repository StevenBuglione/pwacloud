import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {IncomingMessage} from 'node:http';
import {createServer,request,Agent,type RequestOptions} from 'node:https';
import {Socket} from 'node:net';
import {createSecureFetch,type SecureFetchDependencies} from '../../packages/registry-client/src/secure-fetch';

type Hop={peer:string;status:number;location?:string;body?:string};
/** These HTTP responses and peer addresses are explicit synthetic transport fixtures. */
function syntheticTransport(hops:Hop[],calls:{url:string;options:RequestOptions}[]):SecureFetchDependencies['request']{
  return(url,options,onResponse)=>{
    const hop=hops.shift();assert.ok(hop,'Unexpected HTTP request');calls.push({url:url.href,options});
    class FixtureRequest extends EventEmitter{
      end(){queueMicrotask(()=>{const socket=new Socket();Object.defineProperty(socket,'remoteAddress',{value:hop?.peer});const response=new IncomingMessage(socket);response.statusCode=hop?.status;response.headers=hop?.location?{location:hop.location}:{};onResponse(response);response.push(Buffer.from(hop?.body??''));response.push(null);this.emit('close');});return this;}
      setTimeout(){return this;}
      destroy(error?:Error){if(error)this.emit('error',error);this.emit('close');return this;}
    }
    return new FixtureRequest();
  };
}

test('PKG-05 controlled redirect to a private target is denied before a second transport call',async()=>{
  const calls:{url:string;options:RequestOptions}[]=[],lookups:string[]=[];
  const fetch=createSecureFetch({resolveAddresses:async host=>{lookups.push(host);return[{address:host==='127.0.0.1'?'127.0.0.1':'1.1.1.1',family:4}];},request:syntheticTransport([{peer:'1.1.1.1',status:302,location:'https://127.0.0.1/private'}],calls)});
  await assert.rejects(()=>fetch('https://allowed.example/start'),/blocked-destination/);assert.deepEqual(lookups,['allowed.example','127.0.0.1']);assert.equal(calls.length,1);
});

test('PKG-05 a same-origin redirect repeats DNS admission and blocks a rebound private answer',async()=>{
  const calls:{url:string;options:RequestOptions}[]=[];let resolutions=0;
  const fetch=createSecureFetch({resolveAddresses:async()=>[{address:++resolutions===1?'1.1.1.1':'127.0.0.1',family:4}],request:syntheticTransport([{peer:'1.1.1.1',status:307,location:'/rebound'}],calls)});
  await assert.rejects(()=>fetch('https://allowed.example/start'),/blocked-destination/);assert.equal(resolutions,2);assert.equal(calls.length,1);
  const mixed=createSecureFetch({resolveAddresses:async()=>[{address:'1.1.1.1',family:4},{address:'10.0.0.1',family:4}],request:syntheticTransport([],calls)});await assert.rejects(()=>mixed('https://allowed.example/start'),/blocked-destination/);assert.equal(calls.length,1);
});

test('PKG-05 public redirects recheck origin and drop cross-origin credential headers',async()=>{
  const calls:{url:string;options:RequestOptions}[]=[],lookups:string[]=[];
  const fetch=createSecureFetch({resolveAddresses:async host=>{lookups.push(host);return[{address:host==='allowed.example'?'1.1.1.1':'8.8.8.8',family:4}];},request:syntheticTransport([{peer:'1.1.1.1',status:302,location:'https://assets.example/package'},{peer:'8.8.8.8',status:200,body:'public package bytes'}],calls)});
  const response=await fetch('https://allowed.example/start',{allowedOrigins:['https://allowed.example','https://assets.example'],headers:{Authorization:'synthetic-test-only',Cookie:'synthetic=test-only',Accept:'application/zip'}});assert.equal(response.status,200);assert.equal(Buffer.from(response.bytes).toString(),'public package bytes');assert.deepEqual(lookups,['allowed.example','assets.example']);assert.equal(calls.length,2);assert.deepEqual(calls[1]?.options.headers,{'User-Agent':'PWACloud/0.1',Accept:'application/zip'});
  const blockedCalls:{url:string;options:RequestOptions}[]=[];const restricted=createSecureFetch({resolveAddresses:async()=>[{address:'1.1.1.1',family:4}],request:syntheticTransport([{peer:'1.1.1.1',status:302,location:'https://assets.example/package'}],blockedCalls)});await assert.rejects(()=>restricted('https://allowed.example/start',{allowedOrigins:['https://allowed.example']}),/blocked-destination/);assert.equal(blockedCalls.length,1);
});

test('PKG-05 a different public response peer is rejected despite a public DNS answer',async()=>{
  const calls:{url:string;options:RequestOptions}[]=[];const fetch=createSecureFetch({resolveAddresses:async()=>[{address:'1.1.1.1',family:4}],request:syntheticTransport([{peer:'8.8.8.8',status:200,body:'must not be consumed'}],calls)});
  await assert.rejects(()=>fetch('https://allowed.example/start'),/blocked-peer/);assert.equal(calls.length,1);
});

test('PKG-05 native TLS observes an actual loopback socket and rejects it after synthetic public DNS',async()=>{
  // A known synthetic PSK avoids committing keys or trusting a test certificate. This is actual
  // TCP/TLS peer enforcement, not public DNS/TLS certificate qualification or a live attacker.
  const psk=Buffer.alloc(32,1),cipher='PSK-AES128-CBC-SHA';let serverRequests=0;
  const listener=createServer({ciphers:cipher,minVersion:'TLSv1.2',maxVersion:'TLSv1.2',pskCallback:()=>psk},(_request,response)=>{serverRequests++;response.end('private socket body');});
  await new Promise<void>(resolve=>listener.listen(0,'127.0.0.1',resolve));const address=listener.address();assert.ok(address&&typeof address!=='string');
  const fixtureAgent=new Agent({ciphers:cipher,minVersion:'TLSv1.2',maxVersion:'TLSv1.2',rejectUnauthorized:false,pskCallback:()=>({identity:'synthetic-public-fixture',psk})});let lookups=0,pinnedAddress:unknown,observedPeer:string|undefined;
  const fetch=createSecureFetch({resolveAddresses:async()=>{lookups++;return[{address:'1.1.1.1',family:4}];},request:(url,options,onResponse)=>{
    assert.equal(url.hostname,'allowed.example');assert.ok(options.agent instanceof Agent);assert.equal(options.agent.options.autoSelectFamily,false);const pinnedLookup=options.agent.options.lookup;assert.ok(pinnedLookup);pinnedLookup('allowed.example',{family:4,hints:0,all:false},(error,resolved)=>{assert.equal(error,null);pinnedAddress=resolved;});
    return request(`https://127.0.0.1:${address.port}/`,{...options,agent:fixtureAgent},response=>{observedPeer=response.socket.remoteAddress;onResponse(response);});
  }});
  try{await assert.rejects(()=>fetch('https://allowed.example/start'),/blocked-peer/);assert.equal(pinnedAddress,'1.1.1.1');assert.equal(lookups,1);assert.equal(observedPeer,'127.0.0.1');assert.equal(serverRequests,1);}finally{fixtureAgent.destroy();listener.closeAllConnections();await new Promise<void>((resolve,reject)=>listener.close(error=>error?reject(error):resolve()));}
});
