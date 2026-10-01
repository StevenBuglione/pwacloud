/** Reference policy only. Production must also validate schemas, DNS answers and actual socket peers. */
export type Principal = Readonly<{
  workspace: string; plugin: string; digest: string; generation: number; instance: string;
}>;
export type Grant = Readonly<{
  principal: Principal; capability: string; revoked: boolean; expiresAt: number;
}>;
export type NetworkRule = Readonly<{ origin: string; methods: readonly string[]; pathPrefixes: readonly string[] }>;

export function hasCapability(actual: Principal, grant: Grant, capability: string, now: number): boolean {
  if (!Number.isFinite(now) || !Number.isFinite(grant.expiresAt) || now >= grant.expiresAt || grant.revoked) return false;
  if (!Number.isSafeInteger(actual.generation) || actual.generation < 1) return false;
  if (grant.capability !== capability) return false;
  return (['workspace','plugin','digest','generation','instance'] as const)
    .every(key => actual[key] === grant.principal[key]);
}

function safePath(path: string): boolean {
  // Deliberately conservative profile: ambiguous encoded separators/dots, double decoding and matrix params denied.
  return path.startsWith('/') && !/[\\\x00-\x20;]|%(?:2e|2f|5c|25)/i.test(path)
    && !path.split('/').some(part => part === '.' || part === '..');
}
function publicDnsName(host: string): boolean {
  if (!host.includes('.') || host.endsWith('.') || /[:\[\]]/.test(host) || /^[\d.]+$/.test(host)) return false;
  if (/(?:^|\.)(?:localhost|local|internal|invalid)$/.test(host)) return false;
  return host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}
export function networkAllowed(raw: string, method: string, rules: readonly NetworkRule[]): boolean {
  if (typeof raw !== 'string' || raw.length > 8192 || /[\\\x00-\x20]/.test(raw)) return false;
  if (!/^(GET|HEAD|POST|PUT|PATCH|DELETE)$/.test(method)) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || !publicDnsName(url.hostname)) return false;
    const rawPath = raw.match(/^https:\/\/[^/?#]+([^?#]*)/)?.[1] || '/';
    if (!safePath(rawPath) || !safePath(url.pathname)) return false;
    return rules.some(rule => {
      const origin = new URL(rule.origin);
      if (rule.origin !== origin.origin || origin.protocol !== 'https:' || !publicDnsName(origin.hostname)) return false;
      if (url.origin !== rule.origin || !rule.methods.includes(method)) return false;
      return rule.pathPrefixes.some(prefix => {
        if (!safePath(prefix) || prefix.includes('?') || prefix.includes('#')) return false;
        const base = prefix === '/' ? '/' : prefix.replace(/\/+$/, '');
        return base === '/' || url.pathname === base || url.pathname.startsWith(base + '/');
      });
    });
  } catch { return false; }
}
