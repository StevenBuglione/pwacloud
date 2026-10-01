import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile,rename,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {sha256,type VerifiedPackage} from '../../package-verifier/src/index.ts';
import {PlatformError} from '../../contracts/src/errors.ts';
import {z} from 'zod';
const reportSchema=z.strictObject({pipelineSha256:z.string().regex(/^[a-f0-9]{64}$/),profile:z.literal('pwacloud.guest-profile.v2'),witContractSha256:z.string().regex(/^[a-f0-9]{64}$/),toolchain:z.literal('jco@1.34.0'),componentSha256:z.string().regex(/^[a-f0-9]{64}$/),imports:z.array(z.string()).max(0),exports:z.array(z.tuple([z.string(),z.string()])),maxDeclaredLinearBytes:z.number().int().min(0).max(268435456),files:z.array(z.strictObject({path:z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/).refine(path=>!path.split('/').some(part=>part==='..'||part==='.'||!part)),sha256:z.string().regex(/^[a-f0-9]{64}$/)})).min(1).max(64)});
import {pipelineSha256} from './pipeline.ts';
const execute=promisify(execFile);
let preparation=Promise.resolve();
export function prepareGuestComponent(pkg:VerifiedPackage,root='artifacts/guest/browser'):Promise<void>{
  const task=preparation.then(async()=>{
    if(!pkg.manifest.service)return;const bytes=pkg.files[pkg.manifest.service.entry];if(!bytes||bytes.length>20971520)throw new PlatformError('component-budget');
    const digest=await sha256(bytes),directory=join(resolve(root),digest);await mkdir(directory,{recursive:true});
    const componentPath=join(directory,'component.wasm');await writeFile(componentPath,bytes);
    let cached=false;try{await access(join(directory,'verified.json'));cached=true;}catch{}
    if(cached){const previous=reportSchema.safeParse(JSON.parse(await readFile(join(directory,'verified.json'),'utf8')));if(!previous.success)throw new PlatformError('component-rejected');for(const file of previous.data.files)if(await sha256(new Uint8Array(await readFile(join(directory,file.path))))!==file.sha256)throw new PlatformError('corrupt-transform');cached=previous.data.pipelineSha256===await pipelineSha256();}
    if(!cached){
      try{await execute(process.execPath,['--import','tsx',resolve('packages/runtime-web/src/transform-cli.ts'),componentPath,directory,String(pkg.manifest.service.maxLinearMemoryMiB)],{timeout:30000,maxBuffer:1048576,windowsHide:true});}
      catch{throw new PlatformError('component-rejected','Trusted component transformation failed or exceeded its deadline');}
    }
    const report=reportSchema.safeParse(JSON.parse(await readFile(join(directory,'verified.json'),'utf8')));
    if(!report.success||report.data.pipelineSha256!==await pipelineSha256()||report.data.witContractSha256!==await sha256(new Uint8Array(await readFile(resolve('contracts/plugin.wit'))))||report.data.componentSha256!==digest||report.data.maxDeclaredLinearBytes>pkg.manifest.service.maxLinearMemoryMiB*1048576||report.data.exports.some(([name])=>name!=='lifecycle'&&name!=='pwacloud:plugin/lifecycle@0.1.0')||!report.data.exports.length||new Set(report.data.files.map(f=>f.path)).size!==report.data.files.length||!report.data.files.some(f=>f.path==='worker.js'))throw new PlatformError('component-rejected');
    for(const file of report.data.files)if(await sha256(new Uint8Array(await readFile(join(directory,file.path))))!==file.sha256)throw new PlatformError('corrupt-transform');
    const manifestPath=join(resolve(root),'allowed.json');let components:Record<string,string>={};
    try{const existing:unknown=JSON.parse(await readFile(manifestPath,'utf8'));if(typeof existing==='object'&&existing&&'components'in existing&&typeof existing.components==='object'&&existing.components){for(const [key,value]of Object.entries(existing.components))if(/^[a-f0-9]{64}$/.test(key)&&typeof value==='string'&&/^\/guest\/[a-f0-9]{64}\/worker\.js\?v=[a-f0-9]{64}$/.test(value)&&!value.includes('..'))components[key]=value;}}catch{}
    const workerDigest=report.data.files.find(file=>file.path==='worker.js')!.sha256;
    components[digest]=`/guest/${digest}/worker.js?v=${workerDigest}`;const temporary=manifestPath+'.'+randomUUID();await writeFile(temporary,JSON.stringify({format:'pwacloud.loader.v1',components}));await rename(temporary,manifestPath);
  });preparation=task.catch(()=>{});return task;
}

