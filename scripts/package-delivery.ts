/** Assemble a local runnable development build from clean source and allowlisted public assets. */
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
import {zipSync,strToU8} from 'fflate';
import {z} from 'zod';

const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const build=z.strictObject({format:z.literal('pwacloud.build.v1'),sourceCommit:z.string().regex(/^[a-f0-9]{40}$/),changedSource:z.array(z.string()),node:z.string(),builtAt:z.string()}).parse(JSON.parse(await readFile('dist/shell/build-info.json','utf8')));
const sourcePaths=['apps','packages','scripts','tests','examples','contracts','schemas','src','package.json','pnpm-lock.yaml'];
if(build.sourceCommit!==commit||build.changedSource.length||execFileSync('git',['status','--porcelain','--untracked-files=normal','--',...sourcePaths],{encoding:'utf8'}).trim())throw new Error('Delivery requires a matching clean production source build.');
const files:Record<string,Uint8Array>={};
const add=async(path:string)=>{if(!/^[A-Za-z0-9._/ -]+$/.test(path)||path.split('/').some(part=>part==='..'||part==='.'||!part)||/(?:^|\/)(?:credentials|runtime-data|node_modules|\.auth|\.storage-state)(?:\/|$)/.test(path)||/\.(?:pem|key|p12|pfx|sqlite|db)(?:$|-)/.test(path))throw new Error('Unsafe delivery path: '+path);files[path]=new Uint8Array(await readFile(path));};
for(const path of execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))await add(path);
for(const path of ['evidence/M10/local-verification.json','evidence/M10/ci-current.json','evidence/M3/public-install-results.json','evidence/VERIFICATION.md','evidence/ACCEPTANCE-DISPOSITION.md','evidence/release.current.json'])await add(path);
for(const root of ['dist/shell','dist/minimal','artifacts/guest/browser','artifacts/packages'])for(const entry of await readdir(root,{recursive:true,withFileTypes:true})){if(entry.isSymbolicLink())throw new Error('Delivery assets cannot be symlinks');if(entry.isFile())await add(relative(process.cwd(),resolve(entry.parentPath,entry.name)).replaceAll('\\','/'));}
files['RUN-THIS-BUILD.txt']=strToU8(`PWACloud development build ${commit}\n\nRequires Node 24.19.0 and pnpm 11.19.0. Extract this ZIP to a new directory.\nRun: pnpm install --frozen-lockfile\nThen: pnpm start\nOpen http://127.0.0.1:4173 (Windows may also use Start-Demo.ps1).\n\nThe production shell, plugins and real Rust Component Model assets are already built.\nRust is required only to rebuild. No node_modules, credentials or runtime databases are included.\nAI is visibly SYNTHETIC. Real ChatGPT, physical-phone and hosted acceptance remain deferred.\nPlugin notes use this browser's IndexedDB; runtime metadata defaults to ~/.pwacloud.\nThis local ZIP is unsigned; public reference plugin attestations are a separate release.\n`);
files['DELIVERY-MANIFEST.json']=strToU8(JSON.stringify({format:'pwacloud.development-delivery.v1',commit,builtAt:build.builtAt,node:build.node,mode:'synthetic-demo',signed:false,files:Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([path,bytes])=>({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}))},null,2));
await mkdir('artifacts/delivery',{recursive:true});const path=`artifacts/delivery/pwacloud-development-${commit.slice(0,12)}.zip`,bytes=zipSync(files,{level:6});await writeFile(path,bytes);
const result={path,commit,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),files:Object.keys(files).length,mode:'synthetic-demo',signed:false};await mkdir('evidence/M10',{recursive:true});await writeFile('evidence/M10/delivery.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
