import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {mkdtemp,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {zipSync} from 'fflate';

async function toolchainExtractor(){
 const jco=realpathSync(resolve('node_modules/@bytecodealliance/jco/dist/jco.js'));
 const componentize=createRequire(realpathSync(resolve(dirname(jco),'..','..','componentize-js','src','componentize.js')));
 const weval=createRequire(componentize.resolve('@bytecodealliance/weval'));
 const path=weval.resolve('decompress');assert.match(path.replaceAll('\\','/'),/@xhmikosr\/decompress\/index\.js$/);
 const extractor:unknown=await import(pathToFileURL(path).href),plugin:unknown=await import(pathToFileURL(weval.resolve('decompress-unzip')).href);
 if(typeof extractor!=='object'||!extractor||!('default'in extractor)||typeof extractor.default!=='function'||typeof plugin!=='object'||!plugin||!('default'in plugin)||typeof plugin.default!=='function')throw new Error('Toolchain archive API unavailable');
 return{extract:extractor.default,unzip:plugin.default()};
}
test('patched toolchain extractor preserves actual weval ZIP plugin strip/filter and exact bytes',async()=>{
 const {extract,unzip}=await toolchainExtractor(),directory=await mkdtemp(join(tmpdir(),'pwacloud-toolchain-safe-'));
 try{const bytes=Buffer.from('synthetic executable bytes'),archive=zipSync({'release/weval.exe':bytes,'release/ignored.txt':Buffer.from('not selected')});await extract(Buffer.from(archive),directory,{strip:1,plugins:[unzip],filter:(file:{path:string})=>file.path.endsWith('weval.exe')});assert.deepEqual(await readFile(join(directory,'weval.exe')),bytes);await assert.rejects(access(join(directory,'ignored.txt')));}finally{await rm(directory,{recursive:true,force:true});}
});
test('patched toolchain extractor rejects actual traversal ZIP before writing outside its output',async()=>{
 const {extract,unzip}=await toolchainExtractor(),directory=await mkdtemp(join(tmpdir(),'pwacloud-toolchain-traversal-'));
 try{const archive=zipSync({'release/../../outside/weval.exe':Buffer.from('synthetic hostile archive')});await assert.rejects(extract(Buffer.from(archive),join(directory,'output'),{strip:1,plugins:[unzip]}),/outside|escape|traversal/i);await assert.rejects(access(join(directory,'outside','weval.exe')));}finally{await rm(directory,{recursive:true,force:true});}
});
test('patched toolchain extractor rejects a plugin-provided escaping symlink before a later write',async()=>{
 const {extract}=await toolchainExtractor(),directory=await mkdtemp(join(tmpdir(),'pwacloud-toolchain-link-'));
 try{const plugin=()=>Promise.resolve([{path:'escape',type:'symlink',linkname:'../outside',mode:0o777,data:Buffer.alloc(0)},{path:'escape/weval.exe',type:'file',mode:0o644,data:Buffer.from('synthetic hostile link')}]);await assert.rejects(extract(Buffer.from('synthetic parser input'),join(directory,'output'),{plugins:[plugin]}),/outside|escape|symlink/i);await assert.rejects(access(join(directory,'outside','weval.exe')));}finally{await rm(directory,{recursive:true,force:true});}
});
