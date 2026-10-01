import {transpile} from '@bytecodealliance/jco';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {coreMemoryMaximum} from './memory.ts';
import {PlatformError} from '../../contracts/src/errors.ts';
import {createHash} from 'node:crypto';
import {canonicalBindings} from './bindings.ts';
import {pipelineSha256} from './pipeline.ts';
import {gzipSync,brotliCompressSync} from 'node:zlib';
const componentPath=process.argv[2],directory=process.argv[3],limit=Number(process.argv[4]);
if(!componentPath||!directory||!Number.isSafeInteger(limit)||limit<1||limit>256)throw new PlatformError('invalid-transform');
const component=new Uint8Array(await readFile(componentPath));
const result=await transpile(component,{name:'guest',nodejsCompat:false,base64Cutoff:0,quiet:true,wasiShim:false});
if(result.imports.length!==0||result.exports.some(([name])=>name!=='lifecycle'&&name!=='pwacloud:plugin/lifecycle@0.1.0')||!result.exports.some(([name])=>name==='lifecycle'||name==='pwacloud:plugin/lifecycle@0.1.0'))throw new PlatformError('unknown-world');
// Pinned wasm-tools/Jco derive these declarations from actual component types, not publisher metadata.
for(const name of ['pwacloud-plugin-lifecycle.d.ts','pwacloud-plugin-types.d.ts']){const actual=result.files[`interfaces/${name}`],expected=await readFile(resolve('contracts/bindings',name),'utf8');if(!actual||canonicalBindings(new TextDecoder().decode(actual))!==canonicalBindings(expected))throw new PlatformError('unknown-world','Component types do not match the pinned WIT lifecycle');}
let aggregate=0;const files:{path:string;sha256:string}[]=[];
for(const [name,bytes]of Object.entries(result.files)){if(!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(name)||name.split('/').some(part=>part==='..'||part==='.'||!part))throw new PlatformError('invalid-transform');if(name.endsWith('.wasm')){new WebAssembly.Module(Uint8Array.from(bytes).buffer);aggregate+=coreMemoryMaximum(bytes);}await mkdir(dirname(join(directory,name)),{recursive:true});await writeFile(join(directory,name),bytes);files.push({path:name,sha256:createHash('sha256').update(bytes).digest('hex')});}
if(aggregate>limit*1048576)throw new PlatformError('memory-budget');
await build({entryPoints:[resolve('packages/runtime-web/src/worker.ts')],outfile:join(directory,'worker.js'),bundle:true,format:'esm',target:'es2022',plugins:[{name:'trusted-jco-output',setup(builder){builder.onResolve({filter:/artifacts\/guest\/generated\/guest\.js$/},()=>({path:resolve(directory,'guest.js')}));}}]});
files.push({path:'worker.js',sha256:createHash('sha256').update(await readFile(join(directory,'worker.js'))).digest('hex')});
// Alternate HTTP encodings are execution inputs too: bind them to the same report.
for(const file of [...files]){const bytes=await readFile(join(directory,file.path));if(bytes.length<1024)continue;for(const [suffix,compressed]of [['gz',gzipSync(bytes)],['br',brotliCompressSync(bytes)]] as const){const path=file.path+'.'+suffix;await writeFile(join(directory,path),compressed);files.push({path,sha256:createHash('sha256').update(compressed).digest('hex')});}}
await writeFile(join(directory,'verified.json'),JSON.stringify({profile:'pwacloud.guest-profile.v2',pipelineSha256:await pipelineSha256(),witContractSha256:createHash('sha256').update(await readFile(resolve('contracts/plugin.wit'))).digest('hex'),toolchain:'jco@1.34.0',componentSha256:createHash('sha256').update(component).digest('hex'),imports:result.imports,exports:result.exports,maxDeclaredLinearBytes:aggregate,files}));
