import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import manifestSchema from '../../../contracts/plugin-manifest.schema.json';
import requestSchema from '../../../contracts/rpc-request.schema.json';
import envelopeSchema from '../../../contracts/release-envelope.schema.json';
import receiptSchema from '../../../contracts/verification-receipt.schema.json';
export type NetworkRule = {origin:string;methods:string[];pathPrefixes:string[]};
export type Permission =
  | {id:string;capability:'storage.kv';required:boolean;scope:{quotaBytes:number}}
  | {id:string;capability:'network.http';required:boolean;scope:{rules:NetworkRule[]}}
  | {id:string;capability:'ai.respond';required:boolean;scope:{context:string;requestsPerHour:number;concurrency:number;background:boolean}}
  | {id:string;capability:'services.invoke';required:boolean;scope:{interfaces:string[];methods?:string[]}};
export type Manifest = {apiVersion:'pwacloud.dev/v0.1';kind:'Plugin';id:string;name:string;version:string;description:string;license:string;
  hostApi:{major:number;minimumMinor:number};source:{repository:string;directory:string};permissions:Permission[];provides:string[];
  requires:{interface:string;optional:boolean}[];
  ui?:{profile:'isolated-web'|'host-rendered';entry:string;style?:string;minWidthCssPx:number;contributes:{type:string;id:string;title:string}[]};
  service?:{entry:string;world:string;maxLinearMemoryMiB:number}};
export type ReleaseEnvelope = {format:'pwacloud.release.v1';pluginId:string;version:string;sourceCommit:string;sourceRepository:string;
  archive:{sha256:string;bytes:number};manifestSha256:string;files:{path:string;sha256:string;bytes:number}[];
  componentWorld:string|null;browserTransform:{name:'jco';version:string;buildReportSha256:string}|null};
export type Receipt = {format:'pwacloud.verification.v1';keyId:string;pluginId:string;version:string;archiveSha256:string;manifestSha256:string;
  publisherIdentity:string;policyVersion:string;verifiedAt:string;expiresAt:string;revocationSequence:number};
export type Principal = Readonly<{workspace:string;plugin:string;digest:string;generation:number;instance:string;connection:string}>;
export type Request = {v:1;id:string;type:'request';method:string;params:Record<string,unknown>};
export type Reply = {v:1;id:string;type:'response';ok:boolean;data?:unknown;error?:{code:string;message:string}};
import {PlatformError} from './errors.ts';
export {PlatformError} from './errors.ts';
const ajv = new Ajv2020({allErrors:true,strict:true,strictRequired:false});
addFormats(ajv);
export const isManifest = ajv.compile<Manifest>(manifestSchema);
export const isRequest = ajv.compile<Request>(requestSchema);
export const isEnvelope = ajv.compile<ReleaseEnvelope>(envelopeSchema);
export const isReceipt = ajv.compile<Receipt>(receiptSchema);
export function validateManifest(value:unknown):Manifest {
  if(!isManifest(value)) throw new PlatformError('invalid-manifest',ajv.errorsText(isManifest.errors));
  if(value.hostApi.major!==1 || value.hostApi.minimumMinor>0) throw new PlatformError('incompatible');
  if(new Set(value.permissions.map(p=>p.id)).size!==value.permissions.length) throw new PlatformError('duplicate-permission');
  return value;
}
export function objectSchema(properties:Record<string,unknown>,required=Object.keys(properties)) {
  return {type:'object',additionalProperties:false,properties,required};
}
const key = {type:'string',minLength:1,maxLength:240,pattern:'^[a-zA-Z0-9._/-]+$'};
const text = {type:'string',maxLength:131072};
const params:Record<string,object> = {
  'storage.get':objectSchema({key}), 'storage.put':objectSchema({key,value:{}}), 'storage.delete':objectSchema({key}),
  'network.request':objectSchema({url:{type:'string',maxLength:8192},method:{enum:['GET','HEAD']} }),
  'commands.invoke':objectSchema({command:{enum:['analyze']},text}),
  'services.invoke':objectSchema({bindingId:key,method:key,args:{type:'object'}}),
  'ai.start':objectSchema({model:key,prompt:text,requestId:key,documentHandles:{type:'array',maxItems:8,items:key}}),
  'ai.cancel':objectSchema({runId:key}), 'ai.subscribe':objectSchema({runId:key,after:{type:'integer',minimum:0}}),
  'ai.unsubscribe':objectSchema({runId:key}), 'ui.navigate':objectSchema({route:key}),
  'ui.announce':objectSchema({message:text}), 'ui.setTitle':objectSchema({title:{type:'string',maxLength:80}}),
  'ui.checkpoint':objectSchema({value:{}})
};
const paramValidators = new Map(Object.entries(params).map(([k,v])=>[k,ajv.compile(v)]));
export function validateRequest(value:unknown):Request {
  let bytes:number;
  try { bytes=new TextEncoder().encode(JSON.stringify(value)).length; } catch { throw new PlatformError('invalid-request'); }
  if(bytes>262144 || !isRequest(value) || !paramValidators.get(value.method)?.(value.params)) throw new PlatformError('invalid-request');
  return value;
}
export function stringParam(p:Record<string,unknown>,key:string):string {
  const value=p[key]; if(typeof value!=='string') throw new PlatformError('invalid-request'); return value;
}
