import { LitElement, html, nothing } from 'lit';
import { z } from 'zod';
import { PluginConnection } from '../../../../packages/sdk-lit/src/index.ts';

type Article = {id:string;title:string;summary:string;published:string};
type Snapshot = {savedAt:string;articles:Article[]};
const snapshotSchema=z.strictObject({savedAt:z.string(),articles:z.array(z.strictObject({id:z.string().max(1000),title:z.string().max(1000),summary:z.string().max(20000),published:z.string().max(100)})).max(1000)});
function validSnapshot(value:unknown):value is Snapshot{return snapshotSchema.safeParse(value).success;}
const FEED='https://www.nasa.gov/feed/';
function plain(source:string):string {const parsed=new DOMParser().parseFromString(source,'text/html');return parsed.body.textContent?.trim()??'';}
function parseArticles(xml:string):Article[] {
  if(xml.length>2_097_152) throw new Error('Feed exceeds the download limit');
  const document=new DOMParser().parseFromString(xml,'application/xml');
  if(document.querySelector('parsererror')) throw new Error('The feed returned invalid XML');
  return [...document.querySelectorAll('item,entry')].slice(0,1000).map((item,index)=>({id:item.querySelector('guid,id')?.textContent?.slice(0,1000)||`article-${index}`,title:plain(item.querySelector('title')?.textContent??'Untitled article').slice(0,1000),summary:plain(item.querySelector('description,summary,content')?.textContent??'').slice(0,20000),published:item.querySelector('pubDate,published,updated')?.textContent?.slice(0,100)??''}));
}
class FeedReader extends LitElement {
  static override properties={articles:{state:true},selected:{state:true},status:{state:true},savedAt:{state:true},start:{state:true},query:{state:true},busy:{state:true}};
  private connection=new PluginConnection(this);
  private loaded=false;
  private restoredRoute:string|null=null;
  declare articles:Article[];
  declare selected:Article|null;
  declare status:string;
  declare savedAt:string;
  declare start:number;
  declare query:string;
  declare busy:boolean;
  constructor(){super();this.articles=[];this.selected=null;this.status='Opening cached feed…';this.savedAt='';this.start=0;this.query='';this.busy=false;}
  protected override createRenderRoot():HTMLElement { return this; }
  protected override updated():void {
    if(this.connection.client&&!this.loaded){this.loaded=true;void this.load();}
    if(this.connection.navigation!==this.restoredRoute){this.restoredRoute=this.connection.navigation;const match=this.restoredRoute?.match(/^article\/([0-9]+)$/);this.selected=match?this.articles[Number(match[1])]??null:null;}
  }
  private async navigate(article:Article|null):Promise<void> {try{const client=this.connection.client;if(!client)throw new Error('Plugin connection unavailable');const index=article?this.articles.indexOf(article):-1;await client.call('ui.navigate',{route:index<0?'feed':`article/${index}`});this.selected=article;}catch(reason){this.status=`Navigation unavailable: ${reason instanceof Error?reason.message:'host unavailable'}`;}}
  private async load():Promise<void> {
    try {
      const value=await this.connection.client?.call('storage.get',{key:'feed/snapshot'});
      if(validSnapshot(value)){this.articles=value.articles;this.savedAt=value.savedAt;this.restoredRoute=null;this.status='Showing the last saved feed. Refresh requires the granted NASA network permission.';}
      else this.status='No saved articles yet. Grant NASA feed access in host settings, then refresh.';
    } catch(reason){this.status=`Cache unavailable: ${reason instanceof Error?reason.message:'permission denied'}`;}
  }
  private async refresh():Promise<void> {
    if(!this.connection.client||this.busy)return;
    this.busy=true;this.status='Requesting the NASA feed through the host broker…';
    try {
      const result=await this.connection.client.call('network.request',{url:FEED,method:'GET'});
      if(typeof result!=='object'||result===null||!('status' in result)||typeof result.status!=='number'||!('body' in result)||typeof result.body!=='string')throw new Error('Invalid broker response');
      if(result.status<200||result.status>=300)throw new Error(`Feed server returned ${result.status}`);
      const articles=parseArticles(result.body);
      if(!articles.length) throw new Error('No articles found in the feed');
      const snapshot={savedAt:new Date().toISOString(),articles};
      if(!validSnapshot(snapshot)) throw new Error('Invalid feed records');
      await this.connection.client.call('storage.put',{key:'feed/snapshot',value:snapshot});
      this.articles=articles;this.savedAt=snapshot.savedAt;this.start=0;this.status=`Saved ${articles.length} articles for offline reading`;
    } catch(reason){this.status=`Refresh failed: ${reason instanceof Error?reason.message:'network unavailable'}. Saved articles remain available.`;}
    finally {this.busy=false;}
  }
  private get rowHeight():number {return 112*Math.min(2,Math.max(1,parseFloat(getComputedStyle(document.documentElement).fontSize)/16));}
  private scrollList(event:Event):void {if(event.target instanceof HTMLElement)this.start=Math.max(0,Math.floor(event.target.scrollTop/this.rowHeight)-2);}
  override render() {
    const filtered=this.articles.filter(article=>`${article.title} ${article.summary}`.toLowerCase().includes(this.query.toLowerCase()));
    const first=Math.min(this.start,Math.max(0,filtered.length-1));
    const visible=filtered.slice(first,first+12);
    return html`<main aria-label="Feed Reader app"><h1>Feed Reader</h1><p class="muted">NASA news · reads only the permitted feed through the host</p>${this.selected?html`<article><button @click=${()=>this.navigate(null)}>Back to articles</button><h2>${this.selected.title}</h2><p class="muted">${this.selected.published}</p><p class="article-body">${this.selected.summary||'This article has no feed summary.'}</p></article>`:html`<div class="toolbar"><button ?disabled=${this.busy} @click=${()=>void this.refresh()}>${this.busy?'Refreshing…':'Refresh feed'}</button><span class="muted">${this.savedAt?`Saved ${new Date(this.savedAt).toLocaleString()}`:'No snapshot yet'}</span></div><label>Search articles<input type="search" .value=${this.query} @input=${(event:Event)=>{if(event.target instanceof HTMLInputElement){this.query=event.target.value;this.start=0;}}}></label><p>${filtered.length} saved articles</p>${filtered.length?html`<div class="feed-scroll" role="region" aria-label="Saved articles" tabindex="0" @scroll=${this.scrollList}><div style=${`height:${first*this.rowHeight}px`} aria-hidden="true"></div>${visible.map(article=>html`<button class="article-row" @click=${()=>this.navigate(article)}><strong>${article.title}</strong><span>${article.summary.slice(0,110)}</span></button>`)}<div style=${`height:${Math.max(0,filtered.length-first-visible.length)*this.rowHeight}px`} aria-hidden="true"></div></div><div class="toolbar"><button ?disabled=${first===0} @click=${()=>{this.start=Math.max(0,first-10);}}>Previous articles</button><button ?disabled=${first+12>=filtered.length} @click=${()=>{this.start=Math.min(filtered.length-1,first+10);}}>Next articles</button></div>`:nothing}` }<p class="status" role="status">${this.connection.error||this.status}</p></main>`;
  }
}
customElements.define('pwacloud-feed',FeedReader);
document.getElementById('root')?.append(document.createElement('pwacloud-feed'));
