import test from 'node:test';
import assert from 'node:assert/strict';
import {signedFixture} from './package-fixture';
import {verifyPackage,assertRevocationPolicy,validateRevocationPolicy,encodeInstallPacket,type RevocationPolicy} from '../../packages/package-verifier/src/index';
import {RegistryClient} from '../../packages/registry-client/src/index';
import {verifyCatalogue,type Catalogue} from '../../apps/catalogue/src/index';

const current:RevocationPolicy={sequence:4,issuedAt:'2026-01-01T00:00:00Z',expiresAt:'2027-01-01T00:00:00Z',revokedDigests:[]};
test('authenticated revocation metadata denies revoked stale expired and invalid policies at package verification',async()=>{
  const fixture=await signedFixture(),pkg=await verifyPackage(fixture.input,[fixture.root],{allowDemo:true,revocationPolicy:current});assert.equal(pkg.receipt.revocationSequence,4);
  for(const [policy,code] of [[{...current,sequence:5},'stale-revocation'],[{...current,sequence:5,revokedDigests:[pkg.envelope.archive.sha256]},'revoked-package'],[{...current,expiresAt:'2026-02-01T00:00:00Z'},'expired-revocation'],[{...current,issuedAt:'2026-12-01T00:00:00Z'},'expired-revocation']] as const){await assert.rejects(()=>verifyPackage(fixture.input,[fixture.root],{allowDemo:true,revocationPolicy:policy}),new RegExp(code));assert.throws(()=>assertRevocationPolicy(pkg,policy),new RegExp(code));}
  for(const value of [{...current,sequence:-1},{...current,sequence:Number.MAX_SAFE_INTEGER+1},{...current,expiresAt:'invalid-date'},{...current,revokedDigests:['not-a-digest']},{...current,revokedDigests:['a'.repeat(64),'a'.repeat(64)]},{...current,publisher:'invented'}])assert.throws(()=>validateRevocationPolicy(value),/invalid-revocation-policy/);
});

test('registry resolves current policy after an asynchronous transport instead of preserving reviewed metadata',async()=>{
  const fixture=await signedFixture();let policy=current,release:()=>void=()=>{},arrived:()=>void=()=>{};const barrier=new Promise<void>(resolve=>{release=resolve;}),entered=new Promise<void>(resolve=>{arrived=resolve;});
  const registry=new RegistryClient({roots:[fixture.root],options:()=>({allowDemo:true,revocationPolicy:policy}),transport:async()=>{arrived();await barrier;return encodeInstallPacket(fixture.input);}});const result=registry.resolveRepository(fixture.manifest.source.repository);await entered;policy={...current,sequence:5,revokedDigests:[fixture.envelope.archive.sha256]};release();await assert.rejects(()=>result,/revoked-package/);
});

test('expired catalogue cache can be authenticated without granting admission or accepting forged/future metadata',async()=>{
  const fixture=await signedFixture(),catalogue:Catalogue={format:'pwacloud.catalogue.v1',keyId:fixture.root.keyId,sequence:9,issuedAt:'2026-01-01T00:00:00Z',expiresAt:'2026-02-01T00:00:00Z',revokedDigests:[],entries:[]};const bytes=new TextEncoder().encode(JSON.stringify(catalogue)),signature=await fixture.sign(bytes);
  await assert.rejects(()=>verifyCatalogue(bytes,signature,[fixture.root],{allowDemo:true}),/expired-catalogue/);const cached=await verifyCatalogue(bytes,signature,[fixture.root],{allowDemo:true,allowExpiredForCache:true});assert.equal(cached.sequence,9);const pkg=await verifyPackage(fixture.input,[fixture.root],{allowDemo:true});assert.throws(()=>assertRevocationPolicy(pkg,{sequence:cached.sequence,issuedAt:cached.issuedAt,expiresAt:cached.expiresAt,revokedDigests:cached.revokedDigests}),/expired-revocation/);
  const altered=bytes.slice();altered[0]=(altered[0]??0)^1;await assert.rejects(()=>verifyCatalogue(altered,signature,[fixture.root],{allowDemo:true,allowExpiredForCache:true}));
  const future=new TextEncoder().encode(JSON.stringify({...catalogue,issuedAt:'2027-01-01T00:00:00Z',expiresAt:'2028-01-01T00:00:00Z'}));await assert.rejects(async()=>verifyCatalogue(future,await fixture.sign(future),[fixture.root],{allowDemo:true,allowExpiredForCache:true}),/expired-catalogue/);
});
