import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transpile,parse} from '@bytecodealliance/jco';
import {coreMemoryMaximum} from '../../packages/runtime-web/src/memory.ts';
import {canonicalBindings} from '../../packages/runtime-web/src/bindings.ts';
test('RUN-05 actual component transformation has no host imports and bounded real core memories',async()=>{
 const result=await transpile(new Uint8Array(await readFile('artifacts/guest/component.wasm')),{name:'guest',nodejsCompat:false,quiet:true});assert.deepEqual(result.imports,[]);
 for(const name of ['pwacloud-plugin-lifecycle.d.ts','pwacloud-plugin-types.d.ts'])assert.equal(canonicalBindings(new TextDecoder().decode(result.files[`interfaces/${name}`])),canonicalBindings(await readFile(`contracts/bindings/${name}`,'utf8')));
 const modules=Object.entries(result.files).filter(([name])=>name.endsWith('.wasm'));assert.ok(modules.length>0);let total=0;for(const [,bytes]of modules){assert.ok(new WebAssembly.Module(Uint8Array.from(bytes).buffer));total+=coreMemoryMaximum(bytes);}assert.ok(total<=64*1048576);assert.ok(total>0);
});
test('RUN-05 real unknown-import component is detected before worker execution',async()=>{
 const bytes=await parse(`(component
 (type $f (func)) (import "evil" (func $evil (type $f)))
 (core func $lower (canon lower (func $evil)))
 (core module $m (import "env" "evil" (func $f)) (func (export "invoke") (call $f)))
 (core instance $i (instantiate $m (with "env" (instance (export "evil" (func $lower))))))
 (alias core export $i "invoke" (core func $invoke))
 (func $proxy (type $f) (canon lift (core func $invoke)))
 (export "invoke" (func $proxy)))`);const result=await transpile(bytes,{name:'guest',quiet:true});assert.ok(result.imports.includes('evil'));
});
