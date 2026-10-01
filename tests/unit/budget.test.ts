import test from 'node:test';import assert from 'node:assert/strict';import {RequestBudget} from '../../src/reference/budget.ts';
test('admit and release concurrency',()=>{const b=new RequestBudget(3,1,0);assert.equal(b.admit('a',0).kind,'admitted');assert.throws(()=>b.admit('b',1),/CONCURRENCY/);b.complete('a');assert.equal(b.admit('b',2).kind,'admitted');});
test('idempotency does not spend again',()=>{const b=new RequestBudget(1,1,0);b.admit('a',0);assert.equal(b.admit('a',1).kind,'existing');assert.equal(b.snapshot().count,1);});
test('completion not a budget refund',()=>{const b=new RequestBudget(1,1,0);b.admit('a',0);b.complete('a');assert.throws(()=>b.admit('b',1),/REQUEST_LIMIT/);});
test('new window resets count, retains active limit',()=>{const b=new RequestBudget(1,1,0,10);b.admit('a',0);assert.throws(()=>b.admit('b',10),/CONCURRENCY/);b.complete('a');assert.equal(b.admit('b',11).kind,'admitted');});
test('completed duplicate is not resubmitted',()=>{const b=new RequestBudget(1,1,0);b.admit('a',0);b.complete('a');assert.equal(b.admit('a',1).kind,'existing');});
test('clock rollback denied',()=>{const b=new RequestBudget(3,1,10);assert.throws(()=>b.admit('a',9),/CLOCK/);});
test('invalid limits denied',()=>assert.throws(()=>new RequestBudget(0,1,0),/INVALID/));
test('unknown completion does not corrupt counts',()=>{const b=new RequestBudget(1,1,0);assert.equal(b.complete('never'),false);assert.equal(b.snapshot().active,0);});
