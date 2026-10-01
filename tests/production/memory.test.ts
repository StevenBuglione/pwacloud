import {test} from 'node:test';import assert from 'node:assert/strict';import {coreMemoryMaximum} from '../../packages/runtime-web/src/memory.ts';
const header=[0,97,115,109,1,0,0,0];
test('core memory validation requires declared finite maximum and refuses unsupported profiles',()=>{
 assert.equal(coreMemoryMaximum(new Uint8Array([...header,5,4,1,1,1,10])),655360);
 for(const body of [[5,3,1,0,1],[5,4,1,3,1,10],[5,4,1,5,1,10],[5,4,1,1,10,1],[5,100,1,1,1,10]])assert.throws(()=>coreMemoryMaximum(new Uint8Array([...header,...body])));
});
