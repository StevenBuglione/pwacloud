/** Exact-byte integrity helpers. These do not constitute a Sigstore/provenance or archive decoder. */
export async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)));
  return [...hash].map(byte => byte.toString(16).padStart(2,'0')).join('');
}
export async function verifyDigest(bytes: Uint8Array, digest: string): Promise<boolean> {
  return /^[0-9a-f]{64}$/.test(digest) && await sha256(bytes) === digest;
}
export function safeArchivePath(path: string): boolean {
  if (!path || path.length > 240 || !/^[a-zA-Z0-9._/-]+$/.test(path) || path.startsWith('/') || path.endsWith('/')) return false;
  return path.split('/').every(part => part !== '' && part !== '.' && part !== '..' && !part.endsWith('.'));
}
export type ArchiveEntry = Readonly<{path: string; size: number; kind: 'file'|'symlink'|'directory'}>;
export function checkArchiveEntries(entries: readonly ArchiveEntry[], maxExpandedBytes = 20*1024*1024): number {
  if (!Number.isSafeInteger(maxExpandedBytes) || maxExpandedBytes < 1) throw new Error('INVALID_LIMIT');
  if (!entries.length || entries.length > 512) throw new Error('ENTRY_COUNT');
  const paths = new Set<string>(); let total = 0;
  for (const entry of entries) {
    if (entry.kind !== 'file' || !safeArchivePath(entry.path)) throw new Error('UNSAFE_ENTRY');
    const canonical = entry.path.toLowerCase();
    if (paths.has(canonical)) throw new Error('DUPLICATE_ENTRY');
    paths.add(canonical);
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new Error('INVALID_SIZE');
    total += entry.size;
    if (!Number.isSafeInteger(total) || total > maxExpandedBytes) throw new Error('EXPANDED_LIMIT');
  }
  // A file must not simultaneously be another file's directory.
  for (const path of paths) {
    const segments = path.split('/');
    for (let n=1;n<segments.length;n++) if (paths.has(segments.slice(0,n).join('/'))) throw new Error('PATH_COLLISION');
  }
  return total;
}
export async function verifyReceiptSignature(publicKey: CryptoKey, exactBytes: Uint8Array, rawSignature: Uint8Array): Promise<boolean> {
  if (rawSignature.byteLength !== 64 || publicKey.type !== 'public') return false;
  const algorithm = publicKey.algorithm as EcKeyAlgorithm;
  if (algorithm.name !== 'ECDSA' || algorithm.namedCurve !== 'P-256') return false;
  try { return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,new Uint8Array(rawSignature),new Uint8Array(exactBytes)); }
  catch { return false; }
}
