#!/usr/bin/env node
/** Conservative first-publication helper. Never changes existing repo visibility/history; no force push. */
import {spawnSync} from 'node:child_process';
import {readFileSync,existsSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const owner='StevenBuglione';const repo=owner+'/pwacloud';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function run(program:string,args:string[],required=true):string {
 const result=spawnSync(program,args,{cwd:root,encoding:'utf8',shell:false});
 if(required && (result.error||result.status!==0))throw new Error(`${program} ${args[0]} failed. Authenticate/configure the local CLI and inspect its non-secret diagnostics. No force actions attempted.`);
 return result.stdout?.trim()||'';
}
function main():void {
 if(!process.argv.includes('--publish')){
  console.log(`Dry run only. From this extracted handoff, an authenticated ${owner} environment may run:\nnode --experimental-strip-types scripts/publish-github.ts --publish\nThis creates ${repo} PUBLIC only when absent. It refuses an existing repo and never force-pushes.`);return;
 }
 run('git',['--version']);run('gh',['--version']);
 const login=run('gh',['api','user','--jq','.login']);
 if(login!==owner)throw new Error(`Refusing wrong GitHub identity. Expected ${owner}.`);
 const probe=spawnSync('gh',['api',`repos/${repo}`],{cwd:root,encoding:'utf8',shell:false});
 if(probe.error)throw new Error('GitHub probe failed; no publication attempted.');
 if(probe.status===0)throw new Error('Repository already exists. Inspect it and use an ordinary branch/PR. This helper will not modify it.');
 if(!/HTTP 404|"status"\s*:\s*"?404"?/.test(probe.stderr||''))throw new Error('Repository lookup was not a definitive 404. No publication attempted.');
 const outer=run('git',['rev-parse','--show-toplevel'],false);
 if(outer && realpathSync(outer)!==realpathSync(root))throw new Error('Extract into a standalone directory, not inside another Git checkout.');
 if(existsSync(resolve(root,'.git'))){
  if(run('git',['remote'],false))throw new Error('Existing remote found. Use a reviewed branch/PR workflow instead.');
  if(run('git',['rev-parse','--verify','HEAD'],false))throw new Error('Existing commit history found. Use a reviewed branch/PR workflow instead.');
  if(run('git',['diff','--cached','--name-only'],false))throw new Error('Pre-staged changes found. Refusing to publish them implicitly.');
 }
 if(!run('git',['config','user.name'],false)||!run('git',['config','user.email'],false))throw new Error('Configure your own Git author name/email before publication.');
 const inventory=JSON.parse(readFileSync(resolve(root,'HANDOFF_FILES.json'),'utf8')) as {files:{path:string;sha256:string}[]};
 if(!Array.isArray(inventory.files)||inventory.files.length<10)throw new Error('Missing handoff inventory.');
 const paths:string[]=[];const seen=new Set<string>();
 for(const file of inventory.files){
  if(typeof file.path!=='string'||file.path.startsWith('/')||file.path.split('/').some(p=>p==='..'||p==='.git')||/[\\\x00-\x1f]/.test(file.path))throw new Error('Unsafe inventory path.');
  if((file.path.split('/').pop()?.startsWith('.env')&&file.path!=='.env.example')||/\.(pem|key|p12|sqlite|db)$/i.test(file.path))throw new Error('Sensitive file type in inventory.');
  if(seen.has(file.path))throw new Error('Duplicate inventory entry.');seen.add(file.path);
  const full=resolve(root,file.path);if(lstatSync(full).isSymbolicLink())throw new Error('Symlink in handoff.');
  const rel=relative(root,realpathSync(full));if(rel==='..'||rel.startsWith('..'+sep))throw new Error('Path escapes handoff.');
  const digest=createHash('sha256').update(readFileSync(full)).digest('hex');
  if(digest!==file.sha256)throw new Error(`Handoff changed before first publication: ${file.path}. Review manually instead of overriding checks.`);
  paths.push(file.path);
 }
 if(!existsSync(resolve(root,'.git')))run('git',['init','-b','main']);
 else run('git',['symbolic-ref','HEAD','refs/heads/main']);
 // Stage only inventoried, checked files, never the whole working directory.
 for(let n=0;n<paths.length;n+=50)run('git',['add','--',...paths.slice(n,n+50)]);
 run('git',['add','--','HANDOFF_FILES.json']);
 run('git',['commit','-m','docs: mobile-first PWACloud implementation handoff and reference tests']);
 run('gh',['repo','create',repo,'--public','--source',root,'--remote','origin','--push','--description','Mobile-first PWA plugin platform: isolated expressive UIs, Wasm services, scoped AI and declarative lifecycle. Implementation in progress.']);
 const verified=JSON.parse(run('gh',['repo','view',repo,'--json','nameWithOwner,visibility,url']));
 if(verified.nameWithOwner!==repo||verified.visibility!=='PUBLIC')throw new Error('Publication command ran but public verification failed. Inspect remote state; do not retry blindly.');
 console.log(JSON.stringify({status:'published',repository:verified.url,visibility:verified.visibility,commit:run('git',['rev-parse','HEAD'])},null,2));
}
try{main();}catch(error){console.error(error instanceof Error?error.message:'Publication failed');process.exitCode=1;}
