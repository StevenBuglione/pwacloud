import test from 'node:test';import assert from 'node:assert/strict';
import {visibleModels,buildPlanRequest,terminalStatus} from '../../src/reference/ai.ts';
const catalog=[{slug:'fixture-model',displayName:'Test fixture, not a real model'}];const scopes=['chatgpt.tokens.use.direct'];
test('catalog preserves listed order and actual fields',()=>assert.deepEqual(visibleModels({models:[{slug:'b',display_name:'B',visibility:'list'},{slug:'hidden',visibility:'hidden'},{slug:'a',display_name:'A',visibility:'list'}]}),[{slug:'b',displayName:'B'},{slug:'a',displayName:'A'}]));
test('generic API data shape is not plan catalog',()=>assert.throws(()=>visibleModels({data:[]}),/INVALID_CATALOG/));
test('duplicate catalog identity',()=>assert.throws(()=>visibleModels({models:[{slug:'a',display_name:'A',visibility:'list'},{slug:'a',display_name:'A2',visibility:'list'}]}),/DUPLICATE/));
test('invalid visible model',()=>assert.throws(()=>visibleModels({models:[{visibility:'list'}]}),/INVALID_MODEL/));
test('correct plan-only text shape',()=>assert.deepEqual(buildPlanRequest({model:'fixture-model',prompt:'Hello',instructions:'Be clear'},catalog,scopes),{model:'fixture-model',input:[{role:'user',content:'Hello'}],instructions:'Be clear',stream:true,store:false}));
for(const field of ['max_output_tokens','temperature','background','previous_response_id','tools','store','stream','metadata','apiKey','endpoint'])test('reject passthrough '+field,()=>assert.throws(()=>buildPlanRequest({model:'fixture-model',prompt:'Hi',[field]:'bad'},catalog,scopes),/UNSUPPORTED/));
test('missing direct plan scope',()=>assert.throws(()=>buildPlanRequest({model:'fixture-model',prompt:'Hi'},catalog,['openid']),/SCOPE/));
test('unavailable model',()=>assert.throws(()=>buildPlanRequest({model:'not-in-account',prompt:'Hi'},catalog,scopes),/MODEL/));
test('blank input',()=>assert.throws(()=>buildPlanRequest({model:'fixture-model',prompt:'  '},catalog,scopes),/EMPTY/));
test('input byte bound',()=>assert.throws(()=>buildPlanRequest({model:'fixture-model',prompt:'é'.repeat(140000)},catalog,scopes),/INPUT_LIMIT/));
for(const [name,events,expected]of [
 ['completed',['response.output_text.delta','response.completed'],'completed'],
 ['disconnect',['response.output_text.delta'],'interrupted'],
 ['failed',['response.failed'],'failed'],['incomplete',['response.incomplete'],'incomplete'],
 ['conflicting terminals',['response.completed','response.failed'],'failed']
] as const)test('terminal '+name,()=>assert.equal(terminalStatus(events),expected));
