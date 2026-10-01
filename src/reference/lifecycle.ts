/** Pure planner; production executor must journal, recheck grants and apply fencing atomically. */
export type Snapshot = Readonly<{
  enabled: boolean; quarantined: boolean; demand: boolean; online: boolean;
  desiredDigest: string; activeDigest: string | null; runningDigest: string | null;
  staged: 'missing'|'unverified'|'verified'; needsNewConsent: boolean; dependenciesReady: boolean;
  uncommittedWrite: boolean; now: number; retryAt: number;
}>;
export type Action = 'revoke-and-stop'|'stop'|'idle'|'request-consent'|'fetch-stage'|'wait-network'|
 'verify-stage'|'wait-dependencies'|'wait-safe-checkpoint'|'activate-atomically'|'backoff'|'start'|'healthy';
export function nextAction(s: Snapshot): Action {
  if (!Number.isFinite(s.now) || !Number.isFinite(s.retryAt)) throw new Error('INVALID_CLOCK');
  if (s.quarantined) return 'revoke-and-stop';
  if (!s.enabled) return s.runningDigest ? 'revoke-and-stop' : 'idle';
  if (s.activeDigest !== s.desiredDigest) {
    if (s.needsNewConsent) return 'request-consent';
    if (s.staged === 'missing') return s.online ? 'fetch-stage' : 'wait-network';
    if (s.staged === 'unverified') return 'verify-stage';
    if (!s.dependenciesReady) return 'wait-dependencies';
    if (s.uncommittedWrite) return 'wait-safe-checkpoint';
    return 'activate-atomically';
  }
  if (!s.demand) return s.runningDigest ? 'stop' : 'idle';
  if (!s.dependenciesReady) return s.runningDigest ? 'stop' : 'wait-dependencies';
  if (s.runningDigest && s.runningDigest !== s.activeDigest) return 'stop';
  if (s.runningDigest) return 'healthy';
  if (s.now < s.retryAt) return 'backoff';
  return 'start';
}
