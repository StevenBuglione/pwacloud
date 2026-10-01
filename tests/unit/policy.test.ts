import test from 'node:test';import assert from 'node:assert/strict';
import {networkAllowed,hasCapability} from '../../src/reference/policy.ts';
const rules=[{origin:'https://api.example.com',methods:['GET'],pathPrefixes:['/v1/public']}];
for(const [label,url,method,expected] of [
 ['exact path','https://api.example.com/v1/public','GET',true],
 ['child path','https://api.example.com/v1/public/items?q=one','GET',true],
 ['prefix lookalike','https://api.example.com/v1/publicity','GET',false],
 ['default HTTPS port','https://api.example.com:443/v1/public','GET',true],
 ['unapproved port','https://api.example.com:8443/v1/public','GET',false],
 ['lookalike host','https://api.example.com.evil.test/v1/public','GET',false],
 ['HTTP denied','http://api.example.com/v1/public','GET',false],
 ['credentials denied','https://user:pass@api.example.com/v1/public','GET',false],
 ['write denied','https://api.example.com/v1/public','POST',false],
 ['lowercase method denied','https://api.example.com/v1/public','get',false],
 ['raw dot traversal','https://api.example.com/v1/public/../private','GET',false],
 ['encoded dot traversal','https://api.example.com/v1/public/%2e%2e/private','GET',false],
 ['encoded separator','https://api.example.com/v1/public%2Fprivate','GET',false],
 ['double encoding','https://api.example.com/v1/public/%252e','GET',false],
 ['backslash','https://api.example.com\\evil.test/v1/public','GET',false],
 ['fragment','https://api.example.com/v1/public#x','GET',false],
 ['line break','https://api.example.com/v1/\npublic','GET',false],
 ['invalid URL','not-a-url','GET',false],
] as const)test('network '+label,()=>assert.equal(networkAllowed(url,method,rules),expected));
for(const host of ['127.0.0.1','2130706433','[::1]','localhost','host.local','10.0.0.1'])test('literal/private name denied '+host,()=>{
 assert.equal(networkAllowed(`https://${host}/`,'GET',[{origin:`https://${host}`,methods:['GET'],pathPrefixes:['/']}]),false);
});
test('canonical origin required in rule',()=>assert.equal(networkAllowed('https://api.example.com/v1/public','GET',[{...rules[0]!,origin:'https://api.example.com/'}]),false));
test('root prefix is allowed',()=>assert.equal(networkAllowed('https://api.example.com/any','GET',[{...rules[0]!,pathPrefixes:['/']}]),true));
const principal={workspace:'w',plugin:'p',digest:'d',generation:1,instance:'i'};
const grant={principal,capability:'storage.kv',revoked:false,expiresAt:100};
test('matching live grant',()=>assert.equal(hasCapability(principal,grant,'storage.kv',1),true));
for(const key of ['workspace','plugin','digest','instance'] as const)test('principal mismatch '+key,()=>assert.equal(hasCapability({...principal,[key]:'other'},grant,'storage.kv',1),false));
test('stale generation',()=>assert.equal(hasCapability({...principal,generation:2},grant,'storage.kv',1),false));
test('expiry boundary',()=>assert.equal(hasCapability(principal,grant,'storage.kv',100),false));
test('revoke',()=>assert.equal(hasCapability(principal,{...grant,revoked:true},'storage.kv',1),false));
test('capability mismatch',()=>assert.equal(hasCapability(principal,grant,'ai.respond',1),false));
test('invalid clock fails closed',()=>assert.equal(hasCapability(principal,grant,'storage.kv',NaN),false));
