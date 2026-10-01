import {connectPlugin} from '../../packages/sdk/src/index.ts';
async function main(){await connectPlugin();document.getElementById('root')!.innerHTML='<main><h1>Hostile protocol fixture</h1><button id="forge">Forge principal</button><button id="replay">Replay request</button><button id="oversize">Oversized packet</button></main>';
 document.getElementById('forge')!.onclick=()=>window.__pwacloudPort?.postMessage({v:1,id:'forge',type:'request',method:'storage.put',params:{key:'x',value:'stolen'},principal:{plugin:'victim'}});
 document.getElementById('replay')!.onclick=()=>{const packet={v:1,id:'repeat',type:'request',method:'storage.put',params:{key:'x',value:'one'}};window.__pwacloudPort?.postMessage(packet);window.__pwacloudPort?.postMessage(packet);};
 document.getElementById('oversize')!.onclick=()=>window.__pwacloudPort?.postMessage({v:1,id:'large',type:'request',method:'storage.put',params:{key:'x',value:'x'.repeat(300000)}});
}void main();
