import {build as viteBuild} from 'vite';
import {build as esbuild} from 'esbuild';
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
await import('./build-guest.ts');await import('./build-spikes.ts');await import('./build-packages.ts');
await viteBuild({root:'apps/shell',build:{outDir:'../../dist/shell',emptyOutDir:true,chunkSizeWarningLimit:1000}});
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const changedSource=execFileSync('git',['diff','--name-only','HEAD','--','apps','packages','scripts','tests','examples','contracts','schemas','src','package.json','pnpm-lock.yaml'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
await writeFile('dist/shell/build-info.json',JSON.stringify({format:'pwacloud.build.v1',sourceCommit,changedSource,node:process.version,builtAt:new Date().toISOString()}));
const assets=await readdir('dist/shell/assets');const guest=(await readdir('artifacts/guest/browser',{recursive:true,withFileTypes:true})).filter(file=>file.isFile()&&/\.(?:js|wasm|json)$/.test(file.name)).map(file=>`${file.parentPath.replaceAll('\\','/')}/${file.name}`.replace(/^artifacts\/guest\/browser\//,''));
const paths=['/','/index.html','/manifest.webmanifest','/icon.svg',...assets.map(name=>`/assets/${name}`),'/guest/allowed.json',...guest.filter(name=>/^[a-f0-9]{64}\/guest\.core[0-9]*\.wasm$/.test(name)).map(name=>`/guest/${name}`)];
const loaderMap:unknown=JSON.parse(await readFile('artifacts/guest/browser/allowed.json','utf8'));if(typeof loaderMap==='object'&&loaderMap&&'components'in loaderMap&&typeof loaderMap.components==='object'&&loaderMap.components)for(const path of Object.values(loaderMap.components))if(typeof path==='string')paths.push(path);
const revision=createHash('sha256').update(await readFile('dist/shell/index.html')).update(await readFile('artifacts/guest/component.wasm')).update(JSON.stringify(loaderMap)).digest('hex').slice(0,16);
await esbuild({entryPoints:['apps/shell/src/sw.ts'],outfile:'dist/shell/sw.js',bundle:true,format:'iife',target:'es2022',define:{SW_VERSION:JSON.stringify(`pwacloud-${revision}`),SW_STATIC:JSON.stringify(paths)}});
await mkdir('dist/minimal',{recursive:true});
await esbuild({entryPoints:['examples/minimal-host/src/main.ts'],outfile:'dist/minimal/main.js',bundle:true,format:'esm',target:'es2022'});
await writeFile('dist/minimal/index.html',await readFile('examples/minimal-host/index.html'));
for(const root of ['dist/shell','dist/minimal','artifacts/guest/browser','artifacts/spikes'])for(const file of await readdir(root,{recursive:true,withFileTypes:true})){
 if(!file.isFile()||! /\.(?:html|js|css|json|wasm|svg|webmanifest)$/.test(file.name))continue;
 const path=`${file.parentPath}/${file.name}`,bytes=await readFile(path);
 if(bytes.length<1024)continue;for(const [suffix,compressed]of [['gz',gzipSync(bytes)],['br',brotliCompressSync(bytes)]] as const)if(compressed.length<bytes.length)await writeFile(path+'.'+suffix,compressed);
}
console.log(JSON.stringify({status:'built',shell:'dist/shell',minimalHost:'dist/minimal',guest:'artifacts/guest/browser',fixtures:'artifacts/packages',shellRevision:revision}));
