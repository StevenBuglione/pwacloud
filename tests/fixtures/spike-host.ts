import {mountIsolatedUI} from '../../packages/runtime-ui/src/index.ts';
import {GuestWorker} from '../../packages/runtime-web/src/index.ts';
const area=document.getElementById('frame')!;const store=new Map<string,unknown>();
const principal={workspace:'spike',plugin:'spike',digest:'a'.repeat(64),generation:1,instance:crypto.randomUUID(),connection:crypto.randomUUID()};
for(const name of ['react','lit'])document.getElementById(name)?.addEventListener('click',async()=>{
  mountIsolatedUI(area,{bundle:await(await fetch(`/spikes/${name}.js`)).text(),css:'body{font:16px system-ui}button{min-height:48px}',principal,title:`${name} spike`,dispatch:async r=>{
    if(r.method==='storage.put'){store.set(String(r.params.key),r.params.value);return null;}
    return store.get(String(r.params.key));
  },onClose:()=>{document.getElementById('status')!.textContent='Session revoked';}});
});
document.getElementById('wasm')?.addEventListener('click',async()=>{
 const guest=new GuestWorker('/guest/worker.js');const result=await guest.call('handle',{tag:'action',val:{action:'analyze',bodyJson:'{"text":"one two three"}'}});
 if(!Array.isArray(result)||typeof result[0]?.val?.bodyJson!=='string')throw new Error('Invalid guest effect');
 document.getElementById('status')!.textContent=JSON.stringify(JSON.parse(result[0].val.bodyJson));guest.close();
});
document.getElementById('hang')?.addEventListener('click',async()=>{
 const guest=new GuestWorker('/guest/worker.js',500);try{await guest.call('handle',{tag:'action',val:{action:'hang',bodyJson:'{}'}});}catch(e){document.getElementById('status')!.textContent=String(e);}finally{guest.close();}
});
