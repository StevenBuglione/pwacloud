import {z} from 'zod';
import {PlatformError} from '../../contracts/src/errors.ts';
import type {GuestWorker} from './index.ts';
const id=z.string().min(1).max(80),bytes=z.instanceof(Uint8Array).refine(v=>v.length<=262144);
const effectSchema=z.discriminatedUnion('tag',[
  z.strictObject({tag:z.literal('read'),val:z.strictObject({requestId:id,key:z.string().max(240)})}),
  z.strictObject({tag:z.literal('write'),val:z.strictObject({requestId:id,key:z.string().max(240),value:bytes})}),
  z.strictObject({tag:z.literal('network'),val:z.strictObject({requestId:id,url:z.string().max(8192),method:z.enum(['GET','HEAD']),body:bytes.optional()})}),
  z.strictObject({tag:z.literal('ai'),val:z.strictObject({requestId:id,model:id,prompt:z.string().max(131072),documentHandles:z.array(id).max(8)})}),
  z.strictObject({tag:z.literal('service'),val:z.strictObject({requestId:id,bindingId:id,method:id,argsJson:z.string().max(131072)})}),
  z.strictObject({tag:z.literal('render'),val:z.strictObject({channel:id,bodyJson:z.string().max(131072)})})
]);
export type GuestEffect=z.infer<typeof effectSchema>;
const effectsSchema=z.array(effectSchema).max(64);
export async function processGuestEvent(guest:GuestWorker,event:unknown,perform:(effect:Exclude<GuestEffect,{tag:'render'}>)=>Promise<Uint8Array>,signal:AbortSignal,maxTurns=8):Promise<Extract<GuestEffect,{tag:'render'}>[]> {
  const events:unknown[]=[event],renders:Extract<GuestEffect,{tag:'render'}>[]=[];const admitted=new Set<string>();let turns=0,totalEffects=0,totalBytes=0;
  while(events.length){if(signal.aborted)throw new PlatformError('cancelled');if(++turns>maxTurns)throw new PlatformError('effect-limit');
    const raw=await guest.call('handle',events.shift());const parsed=effectsSchema.safeParse(raw);totalBytes+=new TextEncoder().encode(JSON.stringify(raw)).length;if(!parsed.success||totalBytes>262144||(totalEffects+=parsed.data.length)>64)throw new PlatformError('invalid-effect');
    for(const effect of parsed.data){if(effect.tag==='render'){renders.push(effect);continue;}
      if(admitted.has(effect.val.requestId))throw new PlatformError('effect-replay');admitted.add(effect.val.requestId);
      let body:{tag:'ok';val:Uint8Array}|{tag:'err';val:{code:string;message:string}};
      try{const value=await perform(effect);if(value.length>262144)throw new PlatformError('quota-exceeded');body={tag:'ok',val:value};}
      catch(error){body={tag:'err',val:{code:error instanceof PlatformError?error.code:'internal',message:'Host effect did not complete'}};}
      if(signal.aborted)throw new PlatformError('cancelled');events.push({tag:'completed',val:{requestId:effect.val.requestId,body}});
    }
  }
  return renders;
}
