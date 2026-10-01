/** Text-only reference request shaper, not an OAuth client or completed provider adapter. See docs/06-OPENAI.md. */
export type ModelChoice = Readonly<{slug:string; displayName:string}>;
function record(value: unknown): value is Record<string,unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function visibleModels(payload: unknown): ModelChoice[] {
  if (!record(payload) || !Array.isArray(payload.models)) throw new Error('INVALID_CATALOG');
  const seen = new Set<string>(); const choices: ModelChoice[] = [];
  for (const row of payload.models) {
    if (!record(row)) throw new Error('INVALID_MODEL');
    if (row.visibility !== 'list') continue;
    if (typeof row.slug !== 'string' || !row.slug || typeof row.display_name !== 'string' || !row.display_name) throw new Error('INVALID_MODEL');
    if (seen.has(row.slug)) throw new Error('DUPLICATE_MODEL');
    seen.add(row.slug); choices.push({slug:row.slug,displayName:row.display_name});
  }
  return choices;
}
export type PlanRequest = Readonly<{model:string;input:readonly {role:'user';content:string}[];store:false;stream:true;instructions?:string}>;
export function buildPlanRequest(value: unknown, catalog: readonly ModelChoice[], scopes: readonly string[]): PlanRequest {
  if (!scopes.includes('chatgpt.tokens.use.direct')) throw new Error('DIRECT_PLAN_SCOPE_REQUIRED');
  if (!record(value) || Object.keys(value).some(k => !['model','prompt','instructions'].includes(k))) throw new Error('UNSUPPORTED_REQUEST_FIELD');
  if (typeof value.model !== 'string' || !catalog.some(m => m.slug === value.model)) throw new Error('MODEL_NOT_AVAILABLE');
  if (typeof value.prompt !== 'string' || !value.prompt.trim()) throw new Error('EMPTY_INPUT');
  if (new TextEncoder().encode(value.prompt).length > 256*1024) throw new Error('INPUT_LIMIT');
  if (value.instructions !== undefined && (typeof value.instructions !== 'string' || value.instructions.length > 16384)) throw new Error('INVALID_INSTRUCTIONS');
  return {model:value.model,input:[{role:'user',content:value.prompt}],store:false,stream:true,
    ...(value.instructions === undefined ? {} : {instructions:value.instructions as string})};
}
export type InferenceTerminal = 'completed'|'failed'|'incomplete'|'interrupted';
export function terminalStatus(eventTypes: readonly string[]): InferenceTerminal {
  // Conflicting terminal events are invalid, never upgraded to success.
  const terminals = eventTypes.filter(t => ['response.completed','response.failed','response.incomplete','error'].includes(t));
  if (terminals.length !== 1) return terminals.length ? 'failed' : 'interrupted';
  return terminals[0] === 'response.completed' ? 'completed' : terminals[0] === 'response.incomplete' ? 'incomplete' : 'failed';
}
