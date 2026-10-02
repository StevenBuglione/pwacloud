import { getTrustedRoot } from '@sigstore/tuf';
import { toTrustMaterial,type TrustMaterial } from '@sigstore/verify';
import { createHash,randomBytes } from 'node:crypto';
import { mkdir,readFile,rename,writeFile } from 'node:fs/promises';
import { join,dirname } from 'node:path';
import { validateTrustRoots,decodeBase64,encodeBase64,validateRevocationPolicy,assertRevocationPolicy,type TrustRoot,type VerifiedPackage,type RevocationPolicy } from '../../../packages/package-verifier/src/index.ts';
import { issueVerificationReceipt,type AttestedRelease,type ProvenancePolicy } from '../../../packages/package-verifier/src/provenance.ts';
import { ProviderError,schema,protectLocalBytes,unprotectLocalBytes } from '../../../packages/provider-chatgpt/src/index.ts';
import { verifyCatalogue,type Catalogue } from '../../catalogue/src/index.ts';
import { PlatformError } from '../../../packages/contracts/src/index.ts';

const repository='https://github.com/StevenBuglione/pwacloud';
const workflowPath='.github/workflows/plugin-release.yml';
const policyVersion='pwacloud.sigstore-local.v1';
const parsePrivateKey=schema<{kty:'EC';crv:'P-256';x:string;y:string;d:string;ext?:boolean;key_ops?:string[]}>({type:'object',additionalProperties:false,required:['kty','crv','x','y','d'],properties:{kty:{const:'EC'},crv:{const:'P-256'},x:{type:'string',pattern:'^[A-Za-z0-9_-]{43}$'},y:{type:'string',pattern:'^[A-Za-z0-9_-]{43}$'},d:{type:'string',pattern:'^[A-Za-z0-9_-]{43}$'},ext:{type:'boolean'},key_ops:{type:'array',items:{type:'string'}}}});
type AuthorityOptions={directory:string;roots:TrustRoot[];encryptionKeyPath?:string;trustLoader?:()=>Promise<TrustMaterial>;revocationPolicy?:()=>RevocationPolicy|undefined|Promise<RevocationPolicy|undefined>};
const parseCatalogueCache=schema<{bytes:string;signature:string}>({type:'object',additionalProperties:false,required:['bytes','signature'],properties:{bytes:{type:'string',maxLength:2796204},signature:{type:'string',maxLength:88}}});
type CataloguePolicyOptions={bytesPath:string;signaturePath:string;roots:readonly TrustRoot[];cachePath:string;allowDemo?:boolean;now?:()=>Date};
/** Persist signed bytes rather than an unauthenticated sequence counter; serialize refreshes per runtime. */
export class SignedCataloguePolicySource {
  private highest:Catalogue|undefined;private loaded=false;private queue:Promise<void>=Promise.resolve();
  constructor(private readonly options:CataloguePolicyOptions){}
  current():Promise<RevocationPolicy>{const result=this.queue.then(()=>this.refresh());this.queue=result.then(()=>undefined,()=>undefined);return result;}
  private async checked(bytes:Uint8Array,signature:Uint8Array){return verifyCatalogue(bytes,signature,this.options.roots,{allowDemo:this.options.allowDemo,allowExpiredForCache:true,minimumSequence:this.highest?.sequence,now:this.options.now?.()});}
  private async refresh():Promise<RevocationPolicy>{
    if(!this.loaded){let cached:unknown;try{cached=JSON.parse(await readFile(this.options.cachePath,'utf8'));}catch(error){if(!(error instanceof Error&&'code'in error&&error.code==='ENOENT'))throw error;}
      if(cached!==undefined){const packet=parseCatalogueCache(cached);this.highest=await this.checked(decodeBase64(packet.bytes),decodeBase64(packet.signature));}this.loaded=true;}
    let bytes:Uint8Array,signature:Uint8Array;
    try{[bytes,signature]=await Promise.all([readFile(this.options.bytesPath),readFile(this.options.signaturePath)]);}catch(error){if(error instanceof Error&&'code'in error&&error.code==='ENOENT'&&this.highest)return this.project(this.highest);throw new PlatformError('catalogue-unavailable');}
    const current=await this.checked(bytes,signature);
    if(this.highest&&current.sequence===this.highest.sequence&&(Date.parse(current.issuedAt)<Date.parse(this.highest.issuedAt)||JSON.stringify([...current.revokedDigests].sort())!==JSON.stringify([...this.highest.revokedDigests].sort())))throw new PlatformError('stale-catalogue');
    const policy=this.project(current);await mkdir(dirname(this.options.cachePath),{recursive:true,mode:0o700});const temporary=this.options.cachePath+'.'+randomBytes(16).toString('hex')+'.tmp';await writeFile(temporary,JSON.stringify({bytes:encodeBase64(bytes),signature:encodeBase64(signature)}),{flag:'wx',mode:0o600});await rename(temporary,this.options.cachePath);this.highest=current;return policy;
  }
  private project(catalogue:Catalogue):RevocationPolicy{return validateRevocationPolicy({sequence:catalogue.sequence,issuedAt:catalogue.issuedAt,expiresAt:catalogue.expiresAt,revokedDigests:[...catalogue.revokedDigests]});}
}
/** Local receipts attest verified public Sigstore evidence; this key never pretends to be the publisher's key. */
export class LocalReceiptAuthority {
  private material:Promise<{key:CryptoKey;publicKey:JsonWebKey}>|null=null;
  constructor(private readonly options:AuthorityOptions) {}
  async loadRoots():Promise<void>{
    let value:unknown;try{value=JSON.parse(await readFile(join(this.options.directory,'receipt-public-roots.json'),'utf8'));}catch(error){if(error instanceof Error&&'code'in error&&error.code==='ENOENT')return;throw new ProviderError('policy-blocked','Local receipt roots could not be read.');}
    const roots=validateTrustRoots(value);const material=await this.key();
    for(const root of roots){
      if(root.demoOnly||root.policyVersion!==policyVersion||!root.publisherIdentity.startsWith(repository+'/'+workflowPath+'@refs/tags/')||root.publicKey.kty!==material.publicKey.kty||root.publicKey.crv!==material.publicKey.crv||root.publicKey.x!==material.publicKey.x||root.publicKey.y!==material.publicKey.y||root.publicKey.d!==undefined)throw new ProviderError('policy-blocked','Local receipt root did not match this runtime authority.');
      if(!this.options.roots.some(existing=>existing.keyId===root.keyId))this.options.roots.push(root);
    }
  }
  private key():Promise<{key:CryptoKey;publicKey:JsonWebKey}>{
    if(!this.material)this.material=this.loadKey();return this.material;
  }
  private async loadKey():Promise<{key:CryptoKey;publicKey:JsonWebKey}>{
    const path=join(this.options.directory,'receipt-private-key.encrypted');let privateKey:JsonWebKey;
    try{privateKey=parsePrivateKey(JSON.parse(Buffer.from(await unprotectLocalBytes(await readFile(path),this.options.encryptionKeyPath)).toString('utf8')));}
    catch(error){
      if(!(error instanceof Error&&'code'in error&&error.code==='ENOENT'))throw new ProviderError('policy-blocked','Local receipt signing key could not be decrypted.');
      const generated=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);privateKey=await crypto.subtle.exportKey('jwk',generated.privateKey);
      await mkdir(this.options.directory,{recursive:true,mode:0o700});const protectedBytes=await protectLocalBytes(Buffer.from(JSON.stringify(privateKey)),this.options.encryptionKeyPath);await writeFile(path,protectedBytes,{flag:'wx',mode:0o600});
    }
    const key=await crypto.subtle.importKey('jwk',privateKey,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
    const publicKey:JsonWebKey={kty:'EC',crv:'P-256',x:privateKey.x,y:privateKey.y,ext:true,key_ops:['verify']};return {key,publicKey};
  }
  async issue(release:{input:AttestedRelease;sourceCommit:string;sourceRef:string}):Promise<VerifiedPackage>{
    if(!/^refs\/tags\/[A-Za-z0-9._/-]+$/u.test(release.sourceRef)||release.sourceRef.includes('..')||!/^([0-9a-f]{40})$/u.test(release.sourceCommit))throw new ProviderError('permission-denied','Reference release identity is invalid.',false,403);
    const workflowIdentity=repository+'/'+workflowPath+'@'+release.sourceRef;
    const policy:ProvenancePolicy={issuer:'https://token.actions.githubusercontent.com',repository,workflowPath,workflowIdentity,builderId:workflowIdentity,sourceCommit:release.sourceCommit,sourceRef:release.sourceRef};
    const material=await this.key();
    const root:TrustRoot={keyId:'pwacloud-local-'+createHash('sha256').update(JSON.stringify([material.publicKey,workflowIdentity])).digest('hex').slice(0,32),publicKey:material.publicKey,publisherIdentity:workflowIdentity,policyVersion};
    const trust=this.options.trustLoader?await this.options.trustLoader():toTrustMaterial(await getTrustedRoot({cachePath:join(this.options.directory,'sigstore-tuf'),timeout:10000,retry:{retries:1}}));
    const revocation=await this.options.revocationPolicy?.();
    // Sequence zero is the format's initial value when no trusted catalogue exists, not freshness assurance.
    const verified=await issueVerificationReceipt(release.input,trust,policy,{root,signingKey:material.key,revocationSequence:revocation?.sequence??0,revokedDigests:revocation?.revokedDigests??[],revocationPolicy:revocation,lifetimeMs:86400000});
    const latest=await this.options.revocationPolicy?.();if(latest)assertRevocationPolicy(verified,latest);
    if(!this.options.roots.some(existing=>existing.keyId===root.keyId))this.options.roots.push(root);
    const owned=this.options.roots.filter(existing=>existing.policyVersion===policyVersion&&!existing.demoOnly);
    const path=join(this.options.directory,'receipt-public-roots.json'),temporary=path+'.'+randomBytes(16).toString('hex')+'.tmp';await writeFile(temporary,JSON.stringify(owned),{flag:'wx',mode:0o600});await rename(temporary,path);
    return verified;
  }
}
