import { createCipheriv,createDecipheriv,createHash,randomBytes } from 'node:crypto';
import { mkdir,readFile,rename,writeFile,chmod,stat,unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { ProviderError,schema } from './schema.ts';

export type CredentialRecord=Readonly<{issuer:string;subject:string;clientId:string;hostId:string;accessToken:string;refreshToken?:string;idToken:string;scopes:string[];expiresAt:number;savedAt:number}>;
export const parseCredential=schema<CredentialRecord>({type:'object',additionalProperties:false,required:['issuer','subject','clientId','hostId','accessToken','idToken','scopes','expiresAt','savedAt'],properties:{issuer:{const:'https://auth.openai.com'},subject:{type:'string',minLength:1},clientId:{type:'string',minLength:1},hostId:{type:'string',minLength:1},accessToken:{type:'string',minLength:1},refreshToken:{type:'string',minLength:1},idToken:{type:'string',minLength:1},scopes:{type:'array',items:{type:'string'},uniqueItems:true},expiresAt:{type:'integer',minimum:1},savedAt:{type:'integer',minimum:1}}});
export interface CredentialStore { read(id:string):Promise<CredentialRecord|null>;write(id:string,value:CredentialRecord):Promise<void>;remove(id:string):Promise<void>; }
function filename(id:string):string{return createHash('sha256').update(id).digest('hex')+'.encrypted';}
async function dpapi(bytes:Uint8Array,protect:boolean):Promise<Uint8Array>{
  const script=`$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;$bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd());$result=[Security.Cryptography.ProtectedData]::${protect?'Protect':'Unprotect'}($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($result))`;
  return await new Promise<Uint8Array>((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{stdio:['pipe','pipe','pipe'],windowsHide:true});
    let output='';child.stdout.on('data',(data:Buffer)=>{output+=data.toString();});
    child.stderr.resume();child.on('error',()=>reject(new ProviderError('policy-blocked','Protected local credential storage unavailable.')));
    child.on('close',code=>{if(code!==0)reject(new ProviderError('policy-blocked','Protected local credential storage failed.'));else resolve(Buffer.from(output,'base64'));});
    child.stdin.end(Buffer.from(bytes).toString('base64'));
  });
}
async function protectedKey(keyPath?:string):Promise<Buffer>{
  if(!keyPath)throw new ProviderError('policy-blocked','A separately protected local key is required on this OS.');
  const info=await stat(keyPath);
  if((info.mode&0o077)!==0||info.uid!==process.getuid?.())throw new ProviderError('policy-blocked','Credential key must be owned by this user with mode 0600.');
  const bytes=await readFile(keyPath);if(bytes.length!==32)throw new ProviderError('policy-blocked','Invalid protected credential key.');return bytes;
}
export async function protectLocalBytes(plaintext:Uint8Array,keyPath?:string):Promise<Uint8Array>{
  if(process.platform==='win32')return dpapi(plaintext,true);
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',await protectedKey(keyPath),iv);const data=Buffer.concat([cipher.update(plaintext),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]);
}
export async function unprotectLocalBytes(ciphertext:Uint8Array,keyPath?:string):Promise<Uint8Array>{
  if(process.platform==='win32')return dpapi(ciphertext,false);
  const bytes=Buffer.from(ciphertext);if(bytes.length<29)throw new ProviderError('policy-blocked','Protected local data is malformed.');const decipher=createDecipheriv('aes-256-gcm',await protectedKey(keyPath),bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]);
}
/** Tokens are DPAPI CurrentUser ciphertext on Windows. Unix requires a separately protected, owner-only key. */
export class ProtectedFileCredentialStore implements CredentialStore {
  constructor(private readonly directory:string,private readonly keyPath?:string) {}
  async read(id:string):Promise<CredentialRecord|null>{
    let bytes:Buffer;try{bytes=await readFile(join(this.directory,filename(id)));}catch(error){if(error instanceof Error&&'code' in error&&error.code==='ENOENT')return null;throw new ProviderError('policy-blocked','Cannot read protected credentials.');}
    let plaintext:Uint8Array;
    try{
      plaintext=await unprotectLocalBytes(bytes,this.keyPath);
      return parseCredential(JSON.parse(Buffer.from(plaintext).toString('utf8')));
    }catch{throw new ProviderError('policy-blocked','Cannot decrypt protected credentials.');}
  }
  async write(id:string,value:CredentialRecord):Promise<void>{
    const plaintext=Buffer.from(JSON.stringify(parseCredential(value))),ciphertext=await protectLocalBytes(plaintext,this.keyPath);
    await mkdir(this.directory,{recursive:true,mode:0o700});if(process.platform!=='win32')await chmod(this.directory,0o700);
    const target=join(this.directory,filename(id));const temporary=target+'.'+randomBytes(16).toString('hex')+'.tmp';
    await writeFile(temporary,ciphertext,{flag:'wx',mode:0o600});await rename(temporary,target);
  }
  async remove(id:string):Promise<void>{try{await unlink(join(this.directory,filename(id)));}catch(error){if(!(error instanceof Error&&'code'in error&&error.code==='ENOENT'))throw error;}}
}
