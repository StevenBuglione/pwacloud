import { z } from 'zod';
import { PluginStorage } from '@pwacloud/storage';
import { createPluginHost } from '@pwacloud/controller';
import { loadFixture } from '@pwacloud/registry-client';
import type { VerifiedPackage } from '@pwacloud/package-verifier';

const rootSchema=z.array(z.strictObject({keyId:z.string(),publicKey:z.object({kty:z.literal('EC'),crv:z.literal('P-256'),x:z.string(),y:z.string()}).passthrough(),publisherIdentity:z.string(),policyVersion:z.string(),demoOnly:z.boolean().optional()}));
const library=document.getElementById('library');
const viewport=document.getElementById('viewport');
const status=document.getElementById('status');
const permissions=document.getElementById('permissions');
const review=document.getElementById('review');
if(!library||!viewport||!status||!permissions||!review)throw new Error('Missing host markup');
const storage=await PluginStorage.open('pwacloud-minimal');
const host=createPluginHost({storage});
let pkg:VerifiedPackage|null=null;
let grants:string[]=[];
async function list():Promise<void>{
  if(!library)return;library.replaceChildren();
  const installed=await host.list();
  for(const item of installed){const open=document.createElement('button');open.type='button';open.textContent=`Open ${item.manifest.name}`;open.onclick=()=>{if(viewport)void host.mount(viewport,item.manifest.id).catch(fail);};library.append(open);}
  const add=document.createElement('button');add.type='button';add.textContent='Review Notebook';add.onclick=()=>void resolve();library.append(add);
}
function fail(error:unknown):void{if(status)status.textContent=error instanceof Error?error.message:'Operation failed';}
async function resolve():Promise<void>{
  if(!status||!review||!permissions)return;
  status.textContent='Verifying fixture package signatures…';
  try{
    let response=await fetch('/v1/trust');if(response.status===401){const bootstrap=await fetch('/v1/session/local',{method:'POST',headers:{'content-type':'application/json'},body:'{}',credentials:'same-origin'});if(bootstrap.ok)response=await fetch('/v1/trust');}if(!response.ok)throw new Error('No trust metadata');
    const raw:unknown=await response.json();const roots=rootSchema.parse(raw);
    pkg=await loadFixture('notebook',roots);
    grants=pkg.manifest.permissions.filter(permission=>permission.required).map(permission=>permission.id);
    const detail=document.getElementById('package-detail');if(detail)detail.textContent=`Local signed fixture · ${pkg.manifest.name} ${pkg.manifest.version} · ${pkg.manifest.license} · ${pkg.envelope.archive.sha256}`;
    permissions.replaceChildren();
    for(const permission of pkg.manifest.permissions){const label=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.checked=permission.required;check.disabled=permission.required;check.onchange=()=>{grants=check.checked?[...grants,permission.id]:grants.filter(id=>id!==permission.id);};label.append(check,document.createTextNode(`${permission.required?'Required':'Optional'}: ${permission.capability==='storage.kv'?'Save local app data':'Send explicit AI prompts (not connected in this minimal host)'}`));permissions.append(label);}
    review.hidden=false;status.textContent='Review exact capabilities before installing. Fixture signatures do not certify app safety.';
  }catch(error){fail(error);}
}
document.getElementById('install')?.addEventListener('click',()=>{
  if(!pkg)return;void host.install(pkg,grants).then(async()=>{if(review)review.hidden=true;if(status)status.textContent='Notebook installed through reusable controller.';await list();}).catch(fail);
});
document.getElementById('cancel')?.addEventListener('click',()=>{if(review)review.hidden=true;pkg=null;grants=[];});
document.getElementById('close')?.addEventListener('click',()=>{host.suspend();if(status)status.textContent='App closed; local data retained.';});
await host.recover();await list();status.textContent='Minimal host ready. No account or provider credentials are required for local tools.';
