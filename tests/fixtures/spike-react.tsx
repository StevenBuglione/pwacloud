import React from 'react';
import { createRoot } from 'react-dom/client';
import { connectPlugin } from '../../packages/sdk/src/index.ts';
async function main(){const client=await connectPlugin();
function Spike(){const [result,setResult]=React.useState('');return <main><h1>React isolated UI</h1><button onClick={async()=>{await client.call('storage.put',{key:'spike',value:'saved'});setResult(String(await client.call('storage.get',{key:'spike'})));}}>Save</button><output>{result}</output><button onClick={()=>{try{void parent.document.body;setResult('host accessible');}catch{setResult('host denied');}}}>Host check</button><button onClick={()=>{fetch('/probe/fetch').catch(()=>{});const img=new Image();img.src='http://127.0.0.1:4173/probe/image';try{new WebSocket('ws://127.0.0.1:4173/probe/socket');}catch{}}}>Egress check</button><button onClick={()=>{location.href='http://127.0.0.1:4173/probe/navigation';}}>Navigate</button></main>}
createRoot(document.getElementById('root')!).render(<Spike/>);
} void main();
