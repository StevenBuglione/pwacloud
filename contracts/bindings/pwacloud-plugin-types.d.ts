/** @module Interface pwacloud:plugin/types@0.1.0 **/
export interface ErrorInfo {
  code: string,
  message: string,
}
export interface UserAction {
  action: string,
  bodyJson: string,
}
export interface EffectResult {
  requestId: string,
  body: Result<Uint8Array, ErrorInfo>,
}
export type Event = EventAction | EventCompleted | EventResumed | EventSuspend;
export interface EventAction {
  tag: 'action',
  val: UserAction,
}
export interface EventCompleted {
  tag: 'completed',
  val: EffectResult,
}
export interface EventResumed {
  tag: 'resumed',
}
export interface EventSuspend {
  tag: 'suspend',
}
export interface KvRead {
  requestId: string,
  key: string,
}
export interface KvWrite {
  requestId: string,
  key: string,
  value: Uint8Array,
}
export interface NetworkRequest {
  requestId: string,
  url: string,
  method: string,
  body?: Uint8Array,
}
export interface AiRequest {
  requestId: string,
  model: string,
  prompt: string,
  documentHandles: Array<string>,
}
export interface ServiceCall {
  requestId: string,
  bindingId: string,
  method: string,
  argsJson: string,
}
export interface UiUpdate {
  channel: string,
  bodyJson: string,
}
export type Effect = EffectRead | EffectWrite | EffectNetwork | EffectAi | EffectService | EffectRender;
export interface EffectRead {
  tag: 'read',
  val: KvRead,
}
export interface EffectWrite {
  tag: 'write',
  val: KvWrite,
}
export interface EffectNetwork {
  tag: 'network',
  val: NetworkRequest,
}
export interface EffectAi {
  tag: 'ai',
  val: AiRequest,
}
export interface EffectService {
  tag: 'service',
  val: ServiceCall,
}
export interface EffectRender {
  tag: 'render',
  val: UiUpdate,
}
export type Result<T, E> = { tag: 'ok', val: T } | { tag: 'err', val: E };
