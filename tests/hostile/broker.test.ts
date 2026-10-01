import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateRequest} from '../../packages/contracts/src/index.ts';
test('boundary schema refuses authority fields at every packet position',()=>{
 const packet={v:1,id:'one',type:'request',method:'storage.get',params:{key:'notes/selected'}};
 for(const key of ['principal','plugin','account','accessToken','connection','generation']){assert.throws(()=>validateRequest({...packet,[key]:'forged'}));assert.throws(()=>validateRequest({...packet,params:{...packet.params,[key]:'forged'}}));}
});
test('malformed, oversized and unexpected-method corpus is rejected',()=>{
 for(const value of [null,[],true,42,'packet',{v:2,id:'x',type:'request',method:'storage.get',params:{key:'x'}},{v:1,id:'../key',type:'request',method:'storage.get',params:{key:'x'}},{v:1,id:'x',type:'request',method:'network.request',params:{url:'https://example.com',method:'TRACE'}}])assert.throws(()=>validateRequest(value));
});
