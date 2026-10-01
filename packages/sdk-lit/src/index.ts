import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { connectPlugin } from '../../sdk/src/index.ts';
import type { PluginClient } from '../../sdk/src/index.ts';

export class PluginConnection implements ReactiveController {
  client: PluginClient | null = null;
  error = '';
  navigation:string|null=null;
  private generation = 0;
  constructor(private host: ReactiveControllerHost) { host.addController(this); }
  hostConnected(): void {
    const generation = ++this.generation;
    void connectPlugin().then(client => {
      if (generation !== this.generation) { client.dispose(); return; }
      this.client = client;
      client.subscribe(event=>{
        if(typeof event!=='object'||event===null||!('type' in event))return;
        if(event.type==='host.navigation'&&'route' in event&&typeof event.route==='string'&&/^[a-z0-9/-]{1,120}$/.test(event.route)){this.navigation=event.route;this.host.requestUpdate();return;}
        if(event.type!=='host.context')return;
        if('theme' in event&&(event.theme==='light'||event.theme==='dark'||event.theme==='system'))document.documentElement.dataset.theme=event.theme;
        if('textScale' in event&&typeof event.textScale==='number'&&event.textScale>=1&&event.textScale<=2){document.documentElement.style.fontSize=`${16*event.textScale}px`;document.documentElement.style.setProperty('--text-scale',String(event.textScale));}
      });
      this.host.requestUpdate();
    }).catch(reason => { this.error = reason instanceof Error ? reason.message : 'Connection failed'; this.host.requestUpdate(); });
  }
  hostDisconnected(): void { this.generation++; this.client?.dispose(); this.client = null; }
}
