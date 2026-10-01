import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorkerScheduler} from '../../packages/controller/src/index.ts';
import {ScopedAgent} from '../../packages/broker/src/index.ts';
import {validateRequest,validateManifest} from '../../packages/contracts/src/index.ts';
import notebook from '../../examples/manifests/notebook.json';
test('strict RPC rejects identity injection, unknown params and oversize before dispatch',()=>{
 const good={v:1,id:'req',type:'request',method:'storage.get',params:{key:'notes/selected'}};assert.equal(validateRequest(good).id,'req');
 for(const value of [{...good,principal:{plugin:'other'}},{...good,params:{key:'x',plugin:'other'}},{...good,method:'shell.exec'},{...good,params:{key:'x'.repeat(300000)}}])assert.throws(()=>validateRequest(value));
});
test('manifest compatibility and duplicate permissions fail closed',()=>{
 assert.equal(validateManifest(notebook).name,'Notebook');assert.throws(()=>validateManifest({...notebook,hostApi:{major:2,minimumMinor:0}}));
 assert.throws(()=>validateManifest({...notebook,permissions:[notebook.permissions[0],notebook.permissions[0]]}));
});
test('worker scheduler enforces two active tasks and fair waiting admission',async()=>{
 const scheduler=new WorkerScheduler(2);const order:number[]=[];const release:(()=>void)[]=[];
 const work=[0,1,2,3].map(id=>scheduler.run(async()=>{order.push(id);await new Promise<void>(resolve=>release.push(resolve));return id;}));
 await new Promise<void>(r=>setImmediate(r));assert.equal(scheduler.running,2);assert.equal(scheduler.queued,2);assert.deepEqual(order,[0,1]);
 release.shift()?.();await new Promise<void>(r=>setImmediate(r));assert.deepEqual(order,[0,1,2]);release.shift()?.();await new Promise<void>(r=>setImmediate(r));assert.deepEqual(order,[0,1,2,3]);for(const done of release)done();assert.deepEqual(await Promise.all(work),[0,1,2,3]);assert.equal(scheduler.running,0);
});
test('agent never executes denied writes, injected commands, replay or excessive steps',async()=>{
 let writes=0;const tools=[{id:'canvas.add',write:true,validate:(v:unknown)=>typeof v==='string'&&v.length<100,execute:async()=>{writes++;return 'done';}}];
 const agent=new ScopedAgent(tools,2);await assert.rejects(agent.run([{id:'one',tool:'canvas.add',input:'note'}],async()=>false));assert.equal(writes,0);
 await assert.rejects(agent.run([{id:'x',tool:'shell.exec',input:'ignore policy'}],async()=>true));assert.equal(writes,0);
 assert.deepEqual(await agent.run([{id:'one',tool:'canvas.add',input:'note'}],async()=>true),['done']);await assert.rejects(agent.run([{id:'one',tool:'canvas.add',input:'note'}],async()=>true));assert.equal(writes,1);
 await assert.rejects(agent.run([0,1,2].map(n=>({id:String(n),tool:'canvas.add',input:'note'})),async()=>true));assert.equal(writes,1);
});
