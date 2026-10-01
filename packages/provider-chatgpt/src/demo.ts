import { setTimeout } from 'node:timers/promises';
import { ProviderError,parseAiInput,type AiInput,type InferenceProvider,type ProviderEvent } from './schema.ts';

export class DemoProvider implements InferenceProvider {
  readonly mode='demo';
  status(){return {mode:this.mode,state:'ready' as const,label:'Synthetic demo AI — no ChatGPT account or provider inference',remainingAllowance:null};}
  async models(){return [{slug:'demo-synthetic',displayName:'Synthetic demo AI'}];}
  async execute(value:AiInput,signal:AbortSignal,emit:(event:ProviderEvent)=>void):Promise<void>{
    const input=parseAiInput(value);if(input.model!=='demo-synthetic')throw new ProviderError('unsupported-capability','Selected model is unavailable.');
    const text=`[Synthetic demo AI] Your document contains ${input.prompt.trim().split(/\s+/u).length} words. This deterministic development response did not use ChatGPT. Review your notes, choose a concise title, and keep the next action explicit.`;
    for(const token of text.match(/.{1,18}/gu)??[]){await setTimeout(8,undefined,{signal});if(signal.aborted)throw new ProviderError('cancelled','Run cancelled.');emit({type:'delta',data:{text:token}});}
    emit({type:'completed',data:{}});
  }
}
