import { Ajv, type ValidateFunction } from 'ajv';

const ajv = new Ajv({allErrors:true,strict:true});
export function schema<T>(definition: object): (value:unknown)=>T {
  const validate:ValidateFunction<T> = ajv.compile<T>(definition);
  return (value:unknown):T => {
    if (!validate(value)) throw new ProviderError('invalid-request','Invalid data at provider boundary.');
    return value;
  };
}
export class ProviderError extends Error {
  constructor(readonly code:string, message:string, readonly retryable=false, readonly status=400) { super(message); }
}
export type ProviderState='disconnected'|'identity-only'|'needs-consent'|'connecting'|'ready'|'refreshing'|'reauth-required'|'temporarily-unavailable'|'policy-blocked'|'disabled';
export type ModelChoice=Readonly<{slug:string;displayName:string}>;
export type AiInput=Readonly<{model:string;prompt:string;instructions?:string}>;
export type ProviderEvent=Readonly<{type:'delta'|'completed'|'failed'|'interrupted';data:Readonly<{text?:string;code?:string;message?:string}>}>;
export interface InferenceProvider {
  readonly mode:'demo'|'chatgpt-plan-local';
  status():Readonly<{mode:string;state:ProviderState;label:string;remainingAllowance:null}>;
  models(signal?:AbortSignal):Promise<ModelChoice[]>;
  execute(input:AiInput,signal:AbortSignal,emit:(event:ProviderEvent)=>void):Promise<void>;
}
export const parseAiInput=schema<AiInput>({type:'object',additionalProperties:false,required:['model','prompt'],properties:{model:{type:'string',minLength:1,maxLength:256},prompt:{type:'string',minLength:1,maxLength:262144},instructions:{type:'string',maxLength:16384}}});
