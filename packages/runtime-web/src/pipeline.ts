import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
// Cached publisher components must be rebuilt when any trusted loader input changes.
export async function pipelineSha256():Promise<string>{
 const hash=createHash('sha256');
 for(const path of ['pnpm-lock.yaml','contracts/plugin.wit','contracts/bindings/pwacloud-plugin-lifecycle.d.ts','contracts/bindings/pwacloud-plugin-types.d.ts','packages/runtime-web/src/worker.ts','packages/runtime-web/src/memory.ts','packages/runtime-web/src/bindings.ts','packages/runtime-web/src/transform-cli.ts','packages/runtime-web/src/pipeline.ts']){hash.update(path);hash.update(await readFile(resolve(path)));}
 return hash.digest('hex');
}
