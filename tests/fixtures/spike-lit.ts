import {LitElement,html} from 'lit';
import { connectPlugin } from '../../packages/sdk/src/index.ts';
async function main(){const client=await connectPlugin();
class SpikeLit extends LitElement{static properties={result:{state:true}};declare result:string;constructor(){super();this.result='';}render(){return html`<h1>Lit isolated UI</h1><button @click=${async()=>{await client.call('storage.put',{key:'lit',value:'saved'});this.result=String(await client.call('storage.get',{key:'lit'}));}}>Save</button><output>${this.result}</output>`;}}
customElements.define('spike-lit',SpikeLit);document.getElementById('root')?.append(document.createElement('spike-lit'));
} void main();
