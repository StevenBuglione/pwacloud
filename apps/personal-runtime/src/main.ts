import { mkdir,readFile,writeFile,open,unlink } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRuntime,type RuntimeConfig } from './index.ts';
import { ChatGptPlanProvider,LocalChatGptOAuth,ProtectedFileCredentialStore,ProviderError,schema } from '../../../packages/provider-chatgpt/src/index.ts';
import { validateTrustRoots } from '../../../packages/package-verifier/src/index.ts';
import { resolveGitHubRepository,secureFetch } from '../../../packages/registry-client/src/server.ts';
import { prepareGuestComponent } from '../../../packages/runtime-web/src/transform.ts';
import { LocalReceiptAuthority,SignedCataloguePolicySource } from './receipt-authority.ts';

const parseMode=schema<'demo'|'chatgpt-plan-local'>({enum:['demo','chatgpt-plan-local']});
const mode=parseMode(process.env.PWACLOUD_MODE);
const runtimeDirectory=resolve(process.env.PWACLOUD_DATA_DIRECTORY??join(homedir(),'.pwacloud'));
await mkdir(runtimeDirectory,{recursive:true,mode:0o700});
const processLock=join(runtimeDirectory,'runtime.lock');
async function acquireProcessLock():Promise<void>{
  try{const lock=await open(processLock,'wx',0o600);await lock.writeFile(String(process.pid));await lock.close();return;}
  catch(error){if(!(error instanceof Error&&'code'in error&&error.code==='EEXIST'))throw error;}
  const recoveryLock=join(runtimeDirectory,'runtime-recovery.lock');let recovery:Awaited<ReturnType<typeof open>>;
  try{recovery=await open(recoveryLock,'wx',0o600);}catch{throw new ProviderError('policy-blocked','Another startup is reviewing the runtime lock; a stale recovery lock requires operator review.');}
  try{
    const previous=await readFile(processLock,'utf8');if(!/^[1-9][0-9]{0,9}$/u.test(previous))throw new ProviderError('policy-blocked','Runtime process lock requires review.');
    try{process.kill(Number(previous),0);throw new ProviderError('policy-blocked','Another runtime process owns this local data directory.');}
    catch(error){if(!(error instanceof Error&&'code'in error&&error.code==='ESRCH'))throw error;}
    await unlink(processLock);const lock=await open(processLock,'wx',0o600);await lock.writeFile(String(process.pid));await lock.close();
  }finally{await recovery.close();await unlink(recoveryLock);}
}
await acquireProcessLock();
try{
  const port=Number(process.env.PORT??'4173');if(!Number.isSafeInteger(port)||port<1||port>65535)throw new ProviderError('invalid-request','Invalid local listener port.');
  const host=process.env.PWACLOUD_HOST??'127.0.0.1',origin=process.env.PWACLOUD_ORIGIN??`http://127.0.0.1:${port}`;
  const rootsPath=resolve(process.env.PWACLOUD_TRUST_ROOTS??(mode==='demo'?'artifacts/packages/trust.json':join(runtimeDirectory,'configured-trust.json')));
  let roots:ReturnType<typeof validateTrustRoots>=[];
  try{roots=validateTrustRoots(JSON.parse(await readFile(rootsPath,'utf8')));}catch(error){if(!(error instanceof Error&&'code'in error&&error.code==='ENOENT'))throw error;}
  const cataloguePath=process.env.PWACLOUD_CATALOGUE??(mode==='demo'?'artifacts/packages/catalogue.json':undefined),catalogueSignature=process.env.PWACLOUD_CATALOGUE_SIGNATURE??(mode==='demo'?'artifacts/packages/catalogue.sig':undefined);
  if(Boolean(cataloguePath)!==Boolean(catalogueSignature))throw new ProviderError('policy-blocked','Configure both signed catalogue paths.');
  let catalogueSource:SignedCataloguePolicySource|undefined;
  if(cataloguePath&&catalogueSignature){const catalogueRoots=process.env.PWACLOUD_CATALOGUE_TRUST_ROOTS?validateTrustRoots(JSON.parse(await readFile(resolve(process.env.PWACLOUD_CATALOGUE_TRUST_ROOTS),'utf8'))):[...roots];if(mode!=='demo'&&catalogueRoots.some(root=>root.demoOnly))throw new ProviderError('policy-blocked','Personal runtime catalogue trust cannot use demo authority.');catalogueSource=new SignedCataloguePolicySource({bytesPath:resolve(cataloguePath),signaturePath:resolve(catalogueSignature),roots:catalogueRoots,cachePath:join(runtimeDirectory,'signed-catalogue-cache.json'),allowDemo:mode==='demo'});await catalogueSource.current();}
  if(!catalogueSource){try{await readFile(join(runtimeDirectory,'signed-catalogue-cache.json'));throw new ProviderError('policy-blocked','Restore trusted signed catalogue configuration before reopening a runtime with recorded revocation metadata.');}catch(error){if(!(error instanceof Error&&'code'in error&&error.code==='ENOENT'))throw error;}}
  const revocationPolicy=()=>catalogueSource?.current();
  const receiptAuthority=new LocalReceiptAuthority({directory:runtimeDirectory,roots,encryptionKeyPath:process.env.PWACLOUD_CREDENTIAL_KEY_FILE,revocationPolicy});await receiptAuthority.loadRoots();
  const config:RuntimeConfig={mode,port,host,origin,databasePath:join(runtimeDirectory,`${mode}.sqlite`),demoInsecureCookie:mode==='demo'&&origin.startsWith('http://127.0.0.1:'),trustRoots:roots,prepareGuest:prepareGuestComponent,revocationPolicy,registryResolver:async(repository)=>resolveGitHubRepository(repository,roots,undefined,{allowDemo:mode==='demo'&&host==='127.0.0.1',revocationPolicy:await revocationPolicy()},secureFetch,release=>receiptAuthority.issue(release))};
  if(process.env.PWACLOUD_TLS_CERT&&process.env.PWACLOUD_TLS_KEY)config.tls={cert:await readFile(resolve(process.env.PWACLOUD_TLS_CERT),'utf8'),key:await readFile(resolve(process.env.PWACLOUD_TLS_KEY),'utf8')};
  if(mode==='chatgpt-plan-local'){
    const hostFile=join(runtimeDirectory,'host-id');let hostId:string;
    try{hostId=await readFile(hostFile,'utf8');}catch(error){if(!(error instanceof Error&&'code'in error&&error.code==='ENOENT'))throw error;hostId='urn:uuid:'+randomUUID();await writeFile(hostFile,hostId,{flag:'wx',mode:0o600});}
    config.provider=new ChatGptPlanProvider(new LocalChatGptOAuth({hostId,store:new ProtectedFileCredentialStore(join(runtimeDirectory,'credentials'),process.env.PWACLOUD_CREDENTIAL_KEY_FILE)}));
  }
  const runtime=await createRuntime(config);await runtime.listen();
  process.stdout.write(`PWACloud ${mode==='demo'?'SYNTHETIC DEMO':'personal ChatGPT runtime'} listening at ${origin}\n`);
  if(mode==='demo')process.stdout.write('Demo AI is synthetic. Real ChatGPT sign-in, eligibility and phone HTTPS pairing are separate gates.\n');
  if(!catalogueSource)process.stdout.write('No trusted signed catalogue is configured; package revocation freshness is unknown.\n');
  let stopping=false;
  const stop=async()=>{if(stopping)return;stopping=true;await runtime.close();await unlink(processLock);};
  process.once('SIGINT',()=>{void stop().then(()=>process.exit(0));});process.once('SIGTERM',()=>{void stop().then(()=>process.exit(0));});
}catch(error){await unlink(processLock).catch(()=>undefined);throw error;}
