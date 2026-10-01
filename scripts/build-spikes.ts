import { build } from 'esbuild';
import {mkdir,writeFile,copyFile,readdir} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('artifacts/spikes',{recursive:true});await mkdir('artifacts/guest/browser',{recursive:true});
for(const [name,entry] of [['react','tests/fixtures/spike-react.tsx'],['lit','tests/fixtures/spike-lit.ts'],['host','tests/fixtures/spike-host.ts']]){
  await build({entryPoints:[entry!],outfile:`artifacts/spikes/${name}.js`,bundle:true,format:name==='host'?'esm':'iife',target:'es2022'});
}
await build({entryPoints:['packages/runtime-web/src/worker.ts'],outfile:'artifacts/guest/browser/worker.js',bundle:true,format:'esm',target:'es2022'});
for(const file of await readdir('artifacts/guest/generated'))if(file.endsWith('.wasm'))await copyFile(`artifacts/guest/generated/${file}`,`artifacts/guest/browser/${file}`);
await writeFile('artifacts/guest/browser/allowed.json',JSON.stringify({format:'pwacloud.loader.v1',components:{[createHash('sha256').update(await readFile('artifacts/guest/component.wasm')).digest('hex')]:'/guest/worker.js'}}));
await writeFile('artifacts/spikes/index.html','<!doctype html><html lang="en"><meta charset="UTF-8"><title>PWACloud feasibility</title><button id="react">React</button><button id="lit">Lit</button><button id="wasm">Wasm</button><button id="hang">Hang</button><output id="status"></output><div id="frame" style="height:600px"></div><script type="module" src="/spikes/host.js"></script></html>');
