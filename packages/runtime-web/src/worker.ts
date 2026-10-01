import {lifecycle} from '../../../artifacts/guest/generated/guest.js';
import {z} from 'zod';
const boundedBytes=z.instanceof(Uint8Array).refine(value=>value.length<=262144);
const eventSchema=z.discriminatedUnion('tag',[
 z.strictObject({tag:z.literal('action'),val:z.strictObject({action:z.string().max(80),bodyJson:z.string().max(131072)})}),
 z.strictObject({tag:z.literal('completed'),val:z.strictObject({requestId:z.string().max(80),body:z.discriminatedUnion('tag',[z.strictObject({tag:z.literal('ok'),val:boundedBytes}),z.strictObject({tag:z.literal('err'),val:z.strictObject({code:z.string().max(80),message:z.string().max(280)})})])})}),
 z.strictObject({tag:z.literal('resumed')}),z.strictObject({tag:z.literal('suspend')})
]);
const messageSchema=z.strictObject({id:z.number().int().positive(),method:z.enum(['handle','snapshot','activate']),payload:z.unknown()});
const activationSchema=z.strictObject({configJson:z.string().max(8192),checkpoint:boundedBytes.optional()});
const context=globalThis as unknown as {onmessage:(e:MessageEvent<unknown>)=>void;postMessage:(v:unknown)=>void};
lifecycle.activate('{}',undefined);
context.onmessage=e=>{const parsed=messageSchema.safeParse(e.data);if(!parsed.success)return;const {id,method,payload}=parsed.data;try{
  let result:unknown;if(method==='snapshot')result=lifecycle.snapshot();else if(method==='activate'){const activation=activationSchema.parse(payload);result=lifecycle.activate(activation.configJson,activation.checkpoint);}else result=lifecycle.handle(eventSchema.parse(payload));
  context.postMessage({id,result});
}catch{context.postMessage({id,error:'guest-failed'});}};
context.postMessage({ready:true});
