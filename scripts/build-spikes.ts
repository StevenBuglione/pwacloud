import { build } from 'esbuild';
import {mkdir,writeFile,copyFile,readdir} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
await mkdir('artifacts/spikes',{recursive:true});await mkdir('artifacts/guest/browser',{recursive:true});
for(const [name,entry] of [['react','tests/fixtures/spike-react.tsx'],['lit','tests/fixtures/spike-lit.ts'],['host','tests/fixtures/spike-host.ts']]){
  await build({entryPoints:[entry!],outfile:`artifacts/spikes/${name}.js`,bundle:true,format:name==='host'?'esm':'iife',target:'es2022'});
}
await build({entryPoints:['tests/fixtures/storage-host.ts'],outfile:'artifacts/spikes/storage.js',bundle:true,format:'esm',target:'es2022'});
await build({entryPoints:['tests/fixtures/lifecycle-host.ts'],outfile:'artifacts/spikes/lifecycle.js',bundle:true,format:'esm',target:'es2022'});
await writeFile('artifacts/spikes/lifecycle.html','<!doctype html><html lang="en"><meta charset="UTF-8"><title>Lifecycle recovery</title><button id="run">Run lifecycle recovery</button><output id="status"></output><script type="module" src="/spikes/lifecycle.js"></script></html>');
await writeFile('artifacts/spikes/storage.html','<!doctype html><html lang="en"><meta charset="UTF-8"><title>Boundary tests</title><button id="run">Run storage boundaries</button><output id="status"></output><script type="module" src="/spikes/storage.js"></script></html>');
await build({entryPoints:['tests/fixtures/hostile-ui.ts'],outfile:'artifacts/spikes/hostile.js',bundle:true,format:'iife',target:'es2022'});
await build({entryPoints:['tests/fixtures/hostile-host.ts'],outfile:'artifacts/spikes/hostile-host.js',bundle:true,format:'esm',target:'es2022'});
await writeFile('artifacts/spikes/hostile.html','<!doctype html><html lang="en"><meta charset="UTF-8"><title>Hostile boundary</title><button id="mount">Mount hostile fixture</button><output id="status"></output><div id="frame"></div><script type="module" src="/spikes/hostile-host.js"></script></html>');
await build({entryPoints:['packages/runtime-web/src/worker.ts'],outfile:'artifacts/guest/browser/worker.js',bundle:true,format:'esm',target:'es2022'});
for(const file of await readdir('artifacts/guest/generated'))if(file.endsWith('.wasm'))await copyFile(`artifacts/guest/generated/${file}`,`artifacts/guest/browser/${file}`);
const guestDigest=createHash('sha256').update(await readFile('artifacts/guest/component.wasm')).digest('hex');await mkdir(`artifacts/guest/browser/${guestDigest}`,{recursive:true});
execFileSync(process.execPath,['--import','tsx','packages/runtime-web/src/transform-cli.ts','artifacts/guest/component.wasm',`artifacts/guest/browser/${guestDigest}`,'64'],{stdio:'inherit',timeout:30000,windowsHide:true});
const workerDigest=createHash('sha256').update(await readFile(`artifacts/guest/browser/${guestDigest}/worker.js`)).digest('hex');
const hangDigest=createHash('sha256').update(await readFile('artifacts/guest/hang-component.wasm')).digest('hex');await mkdir(`artifacts/guest/browser/${hangDigest}`,{recursive:true});
execFileSync(process.execPath,['--import','tsx','packages/runtime-web/src/transform-cli.ts','artifacts/guest/hang-component.wasm',`artifacts/guest/browser/${hangDigest}`,'64'],{stdio:'inherit',timeout:30000,windowsHide:true});
const hangWorkerDigest=createHash('sha256').update(await readFile(`artifacts/guest/browser/${hangDigest}/worker.js`)).digest('hex');
await copyFile('artifacts/guest/hang-component.wasm','artifacts/spikes/hang-component.wasm');
await writeFile('artifacts/guest/browser/allowed.json',JSON.stringify({format:'pwacloud.loader.v1',components:{[guestDigest]:`/guest/${guestDigest}/worker.js?v=${workerDigest}`,[hangDigest]:`/guest/${hangDigest}/worker.js?v=${hangWorkerDigest}`}}));
await writeFile('artifacts/spikes/index.html','<!doctype html><html lang="en"><meta charset="UTF-8"><title>PWACloud feasibility</title><button id="react">React</button><button id="lit">Lit</button><button id="wasm">Wasm</button><button id="hang">Hang</button><output id="status"></output><div id="frame" style="height:600px"></div><script type="module" src="/spikes/host.js"></script></html>');
