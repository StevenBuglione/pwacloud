import { useEffect, useState } from 'react';
import { connectPlugin } from '../../sdk/src/index.ts';
import type { PluginClient } from '../../sdk/src/index.ts';
import { z } from 'zod';
const contextSchema=z.object({type:z.literal('host.context'),theme:z.enum(['system','light','dark']).optional(),textScale:z.number().min(1).max(2).optional(),models:z.array(z.strictObject({slug:z.string().max(240),displayName:z.string().max(240)})).max(100).optional()}).passthrough();
export type HostContext=z.infer<typeof contextSchema>;

export function usePluginClient(): { client: PluginClient | null; error: string; context:HostContext|null;navigation:string|null } {
  const [client, setClient] = useState<PluginClient | null>(null);
  const [error, setError] = useState('');
  const [context,setContext]=useState<HostContext|null>(null);
  const [navigation,setNavigation]=useState<string|null>(null);
  useEffect(() => {
    let stopped = false;
    let connection: PluginClient | null = null;
    void connectPlugin().then(value => {
      connection = value;
      if (stopped) value.dispose(); else {
        value.subscribe(event=>{
          const route=z.strictObject({type:z.literal('host.navigation'),route:z.string().regex(/^[a-z0-9/-]{1,120}$/)}).safeParse(event);if(route.success){setNavigation(route.data.route);return;}
          const parsed=contextSchema.safeParse(event);if(!parsed.success)return;
          const data=parsed.data;setContext(data);
          if(data.theme)document.documentElement.dataset.theme=data.theme;
          if(data.textScale){document.documentElement.style.fontSize=`${16*data.textScale}px`;document.documentElement.style.setProperty('--text-scale',String(data.textScale));}
        });
        setClient(value);
      }
    }).catch(reason => { if (!stopped) setError(reason instanceof Error ? reason.message : 'Connection failed'); });
    return () => { stopped = true; connection?.dispose(); };
  }, []);
  return { client, error, context,navigation };
}
