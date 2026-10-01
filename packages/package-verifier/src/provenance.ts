import Ajv2020 from 'ajv/dist/2020.js';
import { Verifier,toSignedEntity,type TrustMaterial } from '@sigstore/verify';
import { bundleFromJSON,isBundleWithDsseEnvelope } from '@sigstore/bundle';
import { PlatformError,isEnvelope,type ReleaseEnvelope,type Receipt } from '../../contracts/src/index';
import { parseJson,sha256,exactBuffer,verifyPackage,type TrustRoot,type PackageInput,type VerifiedPackage } from './index';
type Statement={_type:string;subject:{name:string;digest:{sha256:string}}[];predicateType:string;predicate:{buildDefinition:{buildType:string;externalParameters:{workflow:{repository:string;ref:string;path:string}};resolvedDependencies:{uri:string;digest:{gitCommit:string}}[]};runDetails:{builder:{id:string}}}};
export type ProvenancePolicy={issuer:'https://token.actions.githubusercontent.com';workflowIdentity:string;builderId:string;repository:string;sourceCommit:string;workflowPath:string;sourceRef:string};
const ajv=new Ajv2020({strict:true});
const object=(properties:Record<string,unknown>)=>({type:'object',required:Object.keys(properties),properties});
const text={type:'string'};
const bundleValidator=ajv.compile(object({mediaType:{type:'string',pattern:'^application/vnd.dev.sigstore.bundle'},verificationMaterial:{type:'object'},dsseEnvelope:object({payload:{type:'string',maxLength:349528},payloadType:{const:'application/vnd.in-toto+json'},signatures:{type:'array',minItems:1}})}));
const workflow=object({repository:text,ref:text,path:text});
const dependency=object({uri:text,digest:object({gitCommit:{type:'string',pattern:'^[0-9a-f]{40}$'}})});
const subject=object({name:text,digest:object({sha256:{type:'string',pattern:'^[0-9a-f]{64}$'}})});
const buildDefinition=object({buildType:{const:'https://actions.github.io/buildtypes/workflow/v1'},externalParameters:object({workflow}),resolvedDependencies:{type:'array',minItems:1,maxItems:64,items:dependency}});
const runDetails=object({builder:object({id:text})});
const statementValidator=ajv.compile<Statement>(object({_type:{const:'https://in-toto.io/Statement/v1'},subject:{type:'array',minItems:1,maxItems:16,items:subject},predicateType:{const:'https://slsa.dev/provenance/v1'},predicate:object({buildDefinition,runDetails})}));
export function verifySigstoreProvenance(bundle:unknown,trust:TrustMaterial,envelope:ReleaseEnvelope,policy:ProvenancePolicy,envelopeDigest?:string):void {
  if(!bundleValidator(bundle)) throw new PlatformError('invalid-provenance');
  let statement:unknown;
  try {const parsed=bundleFromJSON(bundle);if(!isBundleWithDsseEnvelope(parsed)) throw new Error();const entity=toSignedEntity(parsed); const signer=new Verifier(trust,{tlogThreshold:1,ctlogThreshold:1}).verify(entity,{subjectAlternativeName:policy.workflowIdentity,extensions:{issuer:policy.issuer}}); if(signer.identity?.subjectAlternativeName!==policy.workflowIdentity || signer.identity.extensions?.issuer!==policy.issuer) throw new Error(); statement=parseJson(parsed.content.dsseEnvelope.payload);} catch {throw new PlatformError('invalid-provenance');}
  if(!statementValidator(statement) || envelope.sourceRepository!==policy.repository || envelope.sourceCommit!==policy.sourceCommit || !statement.subject.some(s=>s.digest.sha256===envelope.archive.sha256) || statement.predicate.runDetails.builder.id!==policy.builderId) throw new PlatformError('provenance-mismatch');
  if(envelopeDigest && !statement.subject.some(s=>s.digest.sha256===envelopeDigest)) throw new PlatformError('provenance-envelope-mismatch');
  const definition=statement.predicate.buildDefinition,workflow=definition.externalParameters.workflow;
  if(workflow.repository!==policy.repository || workflow.ref!==policy.sourceRef || workflow.path!==policy.workflowPath || !definition.resolvedDependencies.some(d=>d.uri===`git+${policy.repository}@${policy.sourceRef}` && d.digest.gitCommit===policy.sourceCommit)) throw new PlatformError('provenance-mismatch');
}
export function verifySigstoreBlob(bundle:unknown,bytes:Uint8Array,trust:TrustMaterial,policy:ProvenancePolicy):void {
  try {const parsed=bundleFromJSON(bundle);if(isBundleWithDsseEnvelope(parsed)) throw new Error();const signer=new Verifier(trust,{tlogThreshold:1,ctlogThreshold:1}).verify(toSignedEntity(parsed,Buffer.from(bytes)),{subjectAlternativeName:policy.workflowIdentity,extensions:{issuer:policy.issuer}});if(signer.identity?.subjectAlternativeName!==policy.workflowIdentity || signer.identity.extensions?.issuer!==policy.issuer) throw new Error();} catch {throw new PlatformError('invalid-sigstore-signature');}
}
export type AttestedRelease={archiveBytes:Uint8Array;envelopeBytes:Uint8Array;archiveBundle:unknown;envelopeBundle:unknown;provenanceBundle:unknown};
export async function issueVerificationReceipt(input:AttestedRelease,trust:TrustMaterial,policy:ProvenancePolicy,issuer:{root:TrustRoot;signingKey:CryptoKey;revocationSequence:number;revokedDigests:readonly string[];now?:Date;lifetimeMs?:number}):Promise<VerifiedPackage> {
  const envelope=parseJson(input.envelopeBytes);if(!isEnvelope(envelope)) throw new PlatformError('invalid-envelope');
  if(issuer.root.demoOnly || issuer.root.publisherIdentity!==policy.workflowIdentity || issuer.signingKey.type!=='private' || issuer.signingKey.algorithm.name!=='ECDSA') throw new PlatformError('invalid-receipt-issuer');
  if(input.archiveBytes.length!==envelope.archive.bytes || await sha256(input.archiveBytes)!==envelope.archive.sha256 || issuer.revokedDigests.includes(envelope.archive.sha256)) throw new PlatformError('digest-mismatch');
  verifySigstoreBlob(input.archiveBundle,input.archiveBytes,trust,policy);verifySigstoreBlob(input.envelopeBundle,input.envelopeBytes,trust,policy);verifySigstoreProvenance(input.provenanceBundle,trust,envelope,policy,await sha256(input.envelopeBytes));
  const lifetime=issuer.lifetimeMs??86400000;if(!Number.isSafeInteger(lifetime) || lifetime<1 || lifetime>7*86400000 || !Number.isSafeInteger(issuer.revocationSequence) || issuer.revocationSequence<0) throw new PlatformError('invalid-receipt-policy');const now=issuer.now??new Date();
  const receipt:Receipt={format:'pwacloud.verification.v1',keyId:issuer.root.keyId,pluginId:envelope.pluginId,version:envelope.version,archiveSha256:envelope.archive.sha256,manifestSha256:envelope.manifestSha256,publisherIdentity:policy.workflowIdentity,policyVersion:issuer.root.policyVersion,verifiedAt:now.toISOString(),expiresAt:new Date(now.getTime()+lifetime).toISOString(),revocationSequence:issuer.revocationSequence};const receiptBytes=new TextEncoder().encode(JSON.stringify(receipt));
  const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},issuer.signingKey,exactBuffer(receiptBytes))),envelopeSignature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},issuer.signingKey,exactBuffer(input.envelopeBytes)));
  const packet:PackageInput={archiveBytes:input.archiveBytes,envelopeBytes:input.envelopeBytes,receiptBytes,signature,envelopeSignature};return verifyPackage(packet,[issuer.root],{now,revocationSequence:issuer.revocationSequence,revokedDigests:issuer.revokedDigests,expectedRepository:policy.repository});
}
