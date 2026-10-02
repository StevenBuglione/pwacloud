import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { isEnvelope,isReceipt,validateManifest,PlatformError,type Manifest,type ReleaseEnvelope,type Receipt } from '../../contracts/src/index';
import { unpackArchive,safePath,packArchive } from './archive';
export { inspectArchive,unpackArchive,packArchive,ARCHIVE_LIMITS,safePath } from './archive';
export type TrustRoot={keyId:string;publicKey:JsonWebKey;publisherIdentity:string;policyVersion:string;demoOnly?:boolean};
export type RevocationPolicy={sequence:number;issuedAt:string;expiresAt:string;revokedDigests:readonly string[]};
export type VerificationOptions={now?:Date;allowDemo?:boolean;revocationSequence?:number;revokedDigests?:readonly string[];revocationPolicy?:RevocationPolicy;expectedRepository?:string};
export type PackageInput={archiveBytes:Uint8Array;envelopeBytes:Uint8Array;receiptBytes:Uint8Array;signature:Uint8Array;envelopeSignature:Uint8Array};
export type VerifiedPackage={manifest:Manifest;envelope:ReleaseEnvelope;receipt:Receipt;files:Record<string,Uint8Array>;packet:PackageInput};
export function exactBuffer(bytes:Uint8Array):ArrayBuffer {const result=new Uint8Array(bytes.length);result.set(bytes);return result.buffer;}
export async function sha256(bytes:Uint8Array):Promise<string> {return [...new Uint8Array(await crypto.subtle.digest('SHA-256',exactBuffer(bytes)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function parseJson(bytes:Uint8Array,maximum=262144):unknown {if(bytes.length>maximum) throw new PlatformError('metadata-budget'); try {return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));} catch {throw new PlatformError('invalid-json');}}
export async function verifyExactSignature(bytes:Uint8Array,signature:Uint8Array,root:TrustRoot):Promise<void> {
  if(signature.length!==64 || root.publicKey.kty!=='EC' || root.publicKey.crv!=='P-256' || root.publicKey.d!==undefined) throw new PlatformError('invalid-signature');
  try {const key=await crypto.subtle.importKey('jwk',root.publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']); if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,exactBuffer(signature),exactBuffer(bytes))) throw new Error();} catch {throw new PlatformError('invalid-signature');}
}
export async function verifyPackage(input:PackageInput,roots:readonly TrustRoot[],options:VerificationOptions={}):Promise<VerifiedPackage> {
  const receipt=parseJson(input.receiptBytes); if(!isReceipt(receipt)) throw new PlatformError('invalid-receipt');
  const root=roots.find(k=>k.keyId===receipt.keyId); if(!root || roots.filter(k=>k.keyId===receipt.keyId).length!==1) throw new PlatformError('untrusted-key');
  if(root.demoOnly && !options.allowDemo) throw new PlatformError('demo-trust-disabled');
  await verifyExactSignature(input.receiptBytes,input.signature,root); await verifyExactSignature(input.envelopeBytes,input.envelopeSignature,root);
  const envelope=parseJson(input.envelopeBytes); if(!isEnvelope(envelope)) throw new PlatformError('invalid-envelope');
  const now=(options.now??new Date()).getTime();
  if(Date.parse(receipt.verifiedAt)>now || Date.parse(receipt.expiresAt)<=now || Date.parse(receipt.expiresAt)<=Date.parse(receipt.verifiedAt)) throw new PlatformError('expired-receipt');
  if(receipt.publisherIdentity!==root.publisherIdentity || receipt.policyVersion!==root.policyVersion) throw new PlatformError('publisher-mismatch');
  if(options.revokedDigests?.includes(receipt.archiveSha256)) throw new PlatformError('revoked-package');
  if(options.revocationPolicy)assertRevocationPolicy({receipt,envelope},options.revocationPolicy,options.now);
  if(receipt.revocationSequence<(options.revocationSequence??0)) throw new PlatformError('stale-revocation');
  if(envelope.archive.bytes!==input.archiveBytes.length || envelope.archive.sha256!==await sha256(input.archiveBytes) || receipt.archiveSha256!==envelope.archive.sha256 || receipt.manifestSha256!==envelope.manifestSha256 || receipt.pluginId!==envelope.pluginId || receipt.version!==envelope.version) throw new PlatformError('digest-mismatch');
  if(options.expectedRepository && envelope.sourceRepository!==options.expectedRepository) throw new PlatformError('repository-mismatch');
  const files=unpackArchive(input.archiveBytes),manifestBytes=files['manifest.json']; if(!manifestBytes || manifestBytes.length>131072 || await sha256(manifestBytes)!==envelope.manifestSha256) throw new PlatformError('manifest-mismatch');
  const manifest=validateManifest(parseJson(manifestBytes,131072));
  if(manifest.id!==envelope.pluginId || manifest.version!==envelope.version || manifest.source.repository!==envelope.sourceRepository || envelope.componentWorld!==(manifest.service?.world??null)) throw new PlatformError('manifest-mismatch');
  const paths=new Set<string>();
  if(Object.keys(files).length!==envelope.files.length) throw new PlatformError('file-mismatch');
  for(const item of envelope.files) {safePath(item.path); if(paths.has(item.path.toLowerCase())) throw new PlatformError('duplicate-envelope-path'); paths.add(item.path.toLowerCase()); const file=files[item.path]; if(!file || file.length!==item.bytes || await sha256(file)!==item.sha256) throw new PlatformError('file-mismatch');}
  if(manifest.ui && (!files[manifest.ui.entry] || manifest.ui.style && !files[manifest.ui.style])) throw new PlatformError('missing-entry');
  if(manifest.service) {const component=files[manifest.service.entry];if(!component || component.length<8 || [...component.slice(0,8)].join(',')!=='0,97,115,109,13,0,1,0') throw new PlatformError('invalid-component'); if(envelope.browserTransform?.name!=='jco' || envelope.browserTransform.version!=='1.34.0') throw new PlatformError('untrusted-transform');const report=files['build-report.json'];if(!report || await sha256(report)!==envelope.browserTransform.buildReportSha256) throw new PlatformError('build-report-mismatch');}
  for(const path of Object.keys(files)) if(/\.(?:js|mjs|cjs)$/i.test(path) && path!==manifest.ui?.entry) throw new PlatformError('untrusted-js-glue');
  return {manifest,envelope,receipt,files,packet:input};
}
export async function createEnvelope(files:Record<string,Uint8Array>,sourceCommit:string):Promise<{archiveBytes:Uint8Array;envelopeBytes:Uint8Array;envelope:ReleaseEnvelope}> {
  const manifestBytes=files['manifest.json'];if(!manifestBytes) throw new PlatformError('missing-manifest');const manifest=validateManifest(parseJson(manifestBytes));const archiveBytes=packArchive(files);
  const envelope:ReleaseEnvelope={format:'pwacloud.release.v1',pluginId:manifest.id,version:manifest.version,sourceCommit,sourceRepository:manifest.source.repository,archive:{sha256:await sha256(archiveBytes),bytes:archiveBytes.length},manifestSha256:await sha256(manifestBytes),files:await Promise.all(Object.keys(files).sort().map(async path=>({path,sha256:await sha256(files[path]??new Uint8Array()),bytes:files[path]?.length??0}))),componentWorld:manifest.service?.world??null,browserTransform:manifest.service?{name:'jco',version:'1.34.0',buildReportSha256:await sha256(files['build-report.json']??new Uint8Array())}:null};
  if(!isEnvelope(envelope)) throw new PlatformError('invalid-envelope');return {archiveBytes,envelope,envelopeBytes:new TextEncoder().encode(JSON.stringify(envelope))};
}
const ajv=new Ajv2020({strict:true,allErrors:true});addFormats(ajv);
const revocationValidator=ajv.compile<RevocationPolicy>({type:'object',additionalProperties:false,required:['sequence','issuedAt','expiresAt','revokedDigests'],properties:{sequence:{type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER},issuedAt:{type:'string',format:'date-time'},expiresAt:{type:'string',format:'date-time'},revokedDigests:{type:'array',maxItems:4096,uniqueItems:true,items:{type:'string',pattern:'^[0-9a-f]{64}$'}}}});
export function validateRevocationPolicy(value:unknown):RevocationPolicy {if(!revocationValidator(value)||Date.parse(value.expiresAt)<=Date.parse(value.issuedAt))throw new PlatformError('invalid-revocation-policy');return value;}
export function assertRevocationPolicy(pkg:Pick<VerifiedPackage,'envelope'|'receipt'>,policy:RevocationPolicy,now=new Date()):void {
  const checked=validateRevocationPolicy(policy),time=now.getTime();if(!Number.isFinite(time)||Date.parse(checked.issuedAt)>time||Date.parse(checked.expiresAt)<=time)throw new PlatformError('expired-revocation');
  if(checked.revokedDigests.includes(pkg.envelope.archive.sha256)||checked.revokedDigests.includes(pkg.receipt.archiveSha256))throw new PlatformError('revoked-package');
  if(pkg.receipt.revocationSequence<checked.sequence)throw new PlatformError('stale-revocation');
}
const rootsValidator=ajv.compile<TrustRoot[]>({type:'array',minItems:1,maxItems:32,items:{type:'object',additionalProperties:false,required:['keyId','publicKey','publisherIdentity','policyVersion'],properties:{keyId:{type:'string',minLength:1,maxLength:128},publisherIdentity:{type:'string',minLength:1,maxLength:1024},policyVersion:{type:'string',minLength:1,maxLength:128},demoOnly:{type:'boolean'},publicKey:{type:'object',additionalProperties:false,required:['kty','crv','x','y'],properties:{kty:{const:'EC'},crv:{const:'P-256'},x:{type:'string',pattern:'^[A-Za-z0-9_-]{43}$'},y:{type:'string',pattern:'^[A-Za-z0-9_-]{43}$'},key_ops:{type:'array',items:{const:'verify'},maxItems:1},ext:{type:'boolean'},alg:{const:'ES256'},use:{const:'sig'}}}}}});
export function validateTrustRoots(value:unknown):TrustRoot[] {if(!rootsValidator(value) || new Set(value.map(r=>r.keyId)).size!==value.length) throw new PlatformError('invalid-trust-roots');return value;}
const packetValidator=ajv.compile<{archiveBytes:string;envelopeBytes:string;receiptBytes:string;signature:string;envelopeSignature:string}>({type:'object',additionalProperties:false,required:['archiveBytes','envelopeBytes','receiptBytes','signature','envelopeSignature'],properties:{archiveBytes:{type:'string',maxLength:89478488},envelopeBytes:{type:'string',maxLength:349528},receiptBytes:{type:'string',maxLength:349528},signature:{type:'string',maxLength:88},envelopeSignature:{type:'string',maxLength:88}}});
export function decodeBase64(value:string):Uint8Array {if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new PlatformError('invalid-base64');let binary:string;try {binary=atob(value);} catch {throw new PlatformError('invalid-base64');}const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)); if(encodeBase64(bytes)!==value) throw new PlatformError('invalid-base64');return bytes;}
export function encodeBase64(value:Uint8Array):string {let binary='';for(let offset=0;offset<value.length;offset+=8192) binary+=String.fromCharCode(...value.subarray(offset,offset+8192)); return btoa(binary);}
export function decodeInstallPacket(payload:unknown):PackageInput {if(!packetValidator(payload)) throw new PlatformError('invalid-install-packet');return {archiveBytes:decodeBase64(payload.archiveBytes),envelopeBytes:decodeBase64(payload.envelopeBytes),receiptBytes:decodeBase64(payload.receiptBytes),signature:decodeBase64(payload.signature),envelopeSignature:decodeBase64(payload.envelopeSignature)};}
export function encodeInstallPacket(input:PackageInput):Record<string,string> {return {archiveBytes:encodeBase64(input.archiveBytes),envelopeBytes:encodeBase64(input.envelopeBytes),receiptBytes:encodeBase64(input.receiptBytes),signature:encodeBase64(input.signature),envelopeSignature:encodeBase64(input.envelopeSignature)};}
export async function verifyInstallPacket(payload:unknown,roots:readonly TrustRoot[],options:VerificationOptions={}):Promise<VerifiedPackage> {return verifyPackage(decodeInstallPacket(payload),roots,options);}
