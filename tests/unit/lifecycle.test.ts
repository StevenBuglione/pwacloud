import test from 'node:test';import assert from 'node:assert/strict';
import {nextAction} from '../../src/reference/lifecycle.ts';import type {Snapshot,Action} from '../../src/reference/lifecycle.ts';
const base:Snapshot={enabled:true,quarantined:false,demand:true,online:true,desiredDigest:'a',activeDigest:'a',runningDigest:null,staged:'verified',needsNewConsent:false,dependenciesReady:true,uncommittedWrite:false,now:10,retryAt:0};
const cases:[string,Partial<Snapshot>,Action][]=[
 ['start on demand',{},'start'],['idle without demand',{demand:false},'idle'],
 ['suspend invisible',{demand:false,runningDigest:'a'},'stop'],['running healthy',{runningDigest:'a'},'healthy'],
 ['disabled running',{enabled:false,runningDigest:'a'},'revoke-and-stop'],['disabled absent',{enabled:false},'idle'],
 ['quarantined overrides all',{quarantined:true,enabled:false},'revoke-and-stop'],
 ['consent before download',{desiredDigest:'b',staged:'missing',needsNewConsent:true},'request-consent'],
 ['download stage',{desiredDigest:'b',staged:'missing'},'fetch-stage'],
 ['offline stage waits',{desiredDigest:'b',staged:'missing',online:false},'wait-network'],
 ['verify before activation',{desiredDigest:'b',staged:'unverified'},'verify-stage'],
 ['dependency before activation',{desiredDigest:'b',dependenciesReady:false},'wait-dependencies'],
 ['safe write before activation',{desiredDigest:'b',uncommittedWrite:true},'wait-safe-checkpoint'],
 ['verified swap',{desiredDigest:'b'},'activate-atomically'],
 ['stop stale runtime',{runningDigest:'old'},'stop'],
 ['restart backoff',{retryAt:20},'backoff'],['dependency before starting',{dependenciesReady:false},'wait-dependencies'],
 ['missing dependency stops running',{dependenciesReady:false,runningDigest:'a'},'stop']
];
for(const [name,patch,expected]of cases)test(name,()=>assert.equal(nextAction({...base,...patch}),expected));
test('invalid clock refused',()=>assert.throws(()=>nextAction({...base,now:NaN}),/INVALID_CLOCK/));
