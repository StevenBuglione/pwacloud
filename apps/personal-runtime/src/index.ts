import Fastify,{type FastifyInstance,type FastifyReply,type FastifyRequest} from 'fastify';
import cookie from '@fastify/cookie';
import staticFiles from '@fastify/static';
import { createHash,randomBytes,timingSafeEqual,randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { EventEmitter } from 'node:events';
import { createServer,type Server as CallbackServer } from 'node:http';
import { validateManifest,PlatformError,type Permission } from '../../../packages/contracts/src/index.ts';
import { verifyInstallPacket,validateTrustRoots,validateRevocationPolicy,assertRevocationPolicy,type TrustRoot,type VerifiedPackage,type RevocationPolicy } from '../../../packages/package-verifier/src/index.ts';
import { secureFetch } from '../../../packages/registry-client/src/secure-fetch.ts';
import { networkAllowed } from '../../../src/reference/policy.ts';
import { ChatGptPlanProvider,DemoProvider,ProviderError,schema,type InferenceProvider,type ProviderEvent } from '../../../packages/provider-chatgpt/src/index.ts';
import { openDatabase,transaction,parseSession,parseInstall,parseRun,parseGrant,parseEvent,type SessionRow,type InstallRow,type RunRow } from './database.ts';

export type RuntimeConfig={
  mode?:'demo'|'chatgpt-plan-local'|'approved-hosted'|'self-hosted-vm';databasePath?:string;origin?:string;host?:string;port?:number;demoInsecureCookie?:boolean;
  tls?:Readonly<{cert:string;key:string}>;oauthCallbackPort?:number;
  shellRoot?:string;minimalRoot?:string;artifactRoot?:string;trustRoots?:readonly TrustRoot[];provider?:InferenceProvider;
  registryResolver?:(repository:string,version?:string)=>Promise<unknown>;
  prepareGuest?:(pkg:VerifiedPackage)=>Promise<void>;
  revocationPolicy?:()=>RevocationPolicy|undefined|Promise<RevocationPolicy|undefined>;
  requestLimitPerHour?:number;accountConcurrency?:number;maximumOutputBytes?:number;maximumElapsedMs?:number;disconnectGraceMs?:number;now?:()=>number;
  /** Supplied only by the reviewed local release gate, never from an HTTP request or ordinary mode flag. */
  pluginScopeAuthorization?:()=>Promise<boolean>;
};
type RunEvent={runId:string;sequence:number;type:string;data:Record<string,unknown>};
type RunInput={installId:string;generation:number;idempotencyKey:string;model:string;input?:string;prompt?:string;instructions?:string;selectedDocumentHandles?:string[]};
const parseRunInput=schema<RunInput>({type:'object',additionalProperties:false,required:['installId','generation','idempotencyKey','model'],oneOf:[{required:['input'],properties:{input:{}},not:{required:['prompt'],properties:{prompt:{}}}},{required:['prompt'],properties:{prompt:{}},not:{required:['input'],properties:{input:{}}}}],properties:{installId:{type:'string',minLength:1,maxLength:256},generation:{type:'integer',minimum:1},idempotencyKey:{type:'string',minLength:1,maxLength:128},model:{type:'string',minLength:1,maxLength:256},input:{type:'string',minLength:1,maxLength:262144},prompt:{type:'string',minLength:1,maxLength:262144},instructions:{type:'string',maxLength:16384},selectedDocumentHandles:{type:'array',maxItems:8,items:{type:'string',minLength:1,maxLength:256}}}});
const parseInstallInput=schema<{packet:unknown;grants:string[];expectedGeneration?:number}>({type:'object',additionalProperties:false,required:['packet','grants'],properties:{packet:{type:'object'},expectedGeneration:{type:'integer',minimum:0},grants:{type:'array',maxItems:64,uniqueItems:true,items:{type:'string',minLength:1,maxLength:128}}}});
const parseGrantsInput=schema<{generation:number;grants:string[]}>({type:'object',additionalProperties:false,required:['generation','grants'],properties:{generation:{type:'integer',minimum:1},grants:{type:'array',maxItems:64,uniqueItems:true,items:{type:'string',minLength:1,maxLength:128}}}});
const parseDeleteInstall=schema<{expectedGeneration:number}>({type:'object',additionalProperties:false,required:['expectedGeneration'],properties:{expectedGeneration:{type:'integer',minimum:1}}});
const parseId=schema<{id:string}>({type:'object',additionalProperties:false,required:['id'],properties:{id:{type:'string',minLength:1,maxLength:256}}});
const parseEventsQuery=schema<{after?:string}>({type:'object',additionalProperties:false,properties:{after:{type:'string',pattern:'^[0-9]{1,10}$'}}});
const parseNetwork=schema<{installId:string;generation:number;grantId:string;url:string;method:'GET'|'HEAD'}>({type:'object',additionalProperties:false,required:['installId','generation','grantId','url','method'],properties:{installId:{type:'string',minLength:1,maxLength:256},generation:{type:'integer',minimum:1},grantId:{type:'string',minLength:1,maxLength:128},url:{type:'string',minLength:1,maxLength:8192},method:{enum:['GET','HEAD']}}});
const parseMetadata=schema<{value:string}>({type:'object',additionalProperties:false,required:['value'],properties:{value:{type:'string'}}});
const parseCount=schema<{count:number}>({type:'object',additionalProperties:false,required:['count'],properties:{count:{type:'integer',minimum:0}}});
const hash=(value:string):string=>createHash('sha256').update(value).digest('hex');
function isLoopback(ip:string):boolean{return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip);}
function equal(left:string,right:string):boolean{const a=Buffer.from(left),b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b);}
const terminalStates=new Set(['completed','failed','interrupted','cancelled']);

export async function createRuntime(config:RuntimeConfig={}){
  const mode=config.mode??'demo',host=config.host??'127.0.0.1',port=config.port??4173;
  if(mode==='approved-hosted'||mode==='self-hosted-vm')throw new ProviderError('policy-blocked','Hosted and VM credential persistence require external written release authorization.',false,403);
  const origin=config.origin??`http://127.0.0.1:${port}`;const url=new URL(origin);
  if(url.origin!==origin||url.username||url.password)throw new ProviderError('invalid-request','Runtime origin must be an exact origin.');
  if(url.protocol==='https:'&&!config.tls)throw new ProviderError('policy-blocked','An HTTPS origin requires a configured local TLS listener.',false,403);
  if(config.tls&&url.protocol!=='https:')throw new ProviderError('invalid-request','TLS listener requires its exact HTTPS origin.');
  if(url.protocol!=='https:'&&(!isLoopback(host)||url.hostname!=='127.0.0.1'))throw new ProviderError('policy-blocked','Phone sessions require authenticated HTTPS.',false,403);
  if(config.demoInsecureCookie&&(mode!=='demo'||!isLoopback(host)||url.hostname!=='127.0.0.1'))throw new ProviderError('policy-blocked','Insecure cookies are limited to the explicit loopback synthetic demo.',false,403);
  const candidate=config.provider??(mode==='demo'?new DemoProvider():undefined);
  if(!candidate||candidate.mode!==mode)throw new ProviderError('policy-blocked','Mode requires its explicit local provider.');
  const provider:InferenceProvider=candidate;
  const now=config.now??Date.now;const database=openDatabase(config.databasePath??':memory:');const events=new EventEmitter();events.setMaxListeners(128);
  let knownRevocation:RevocationPolicy|undefined;
  async function revocationPolicy(){const incoming=await config.revocationPolicy?.();if(incoming){const checked=validateRevocationPolicy(incoming);if(knownRevocation&&checked.sequence<knownRevocation.sequence)throw new PlatformError('stale-revocation');knownRevocation={...checked,revokedDigests:[...checked.revokedDigests]};}return knownRevocation;}
  const active=new Map<string,AbortController>();const tasks=new Map<string,Promise<void>>();const pairingAttempts=new Map<string,{count:number;expiresAt:number}>();
  const disconnectTimers=new Map<string,ReturnType<typeof setTimeout>>();let providerSelectionEpoch=0;
  let streamCount=0;
  const app:FastifyInstance=Fastify({logger:false,bodyLimit:90*1024*1024,trustProxy:false,...(config.tls?{https:config.tls}:{})});
  app.addHook('onRoute',route=>{if(route.url.startsWith('/v1/')&&!['/v1/installs','/v1/install/approve'].includes(route.url))route.bodyLimit=262144;});
  const cookieName=config.demoInsecureCookie?'pwacloud-demo-session':'__Host-pwacloud-session';
  await app.register(cookie);
  function generation():number{return Number(parseMetadata(database.prepare("SELECT value FROM runtime_metadata WHERE key='account_generation'").get()).value);}
  function accountBudgetKey():string{
    if(mode==='demo')return 'synthetic-demo';
    const selected=provider instanceof ChatGptPlanProvider?provider.selectedRegistration():null;if(!selected)throw new ProviderError('reauth-required','A verified selected identity is required for account admission.',false,401);
    const parseIdentity=schema<{issuer:string;subject:string}>({type:'object',additionalProperties:false,required:['issuer','subject'],properties:{issuer:{const:'https://auth.openai.com'},subject:{type:'string',minLength:1}}});
    const raw=database.prepare('SELECT issuer,subject FROM runtime_registrations WHERE id=?').get(selected);if(!raw)throw new ProviderError('policy-blocked','Selected identity was not verified by this runtime.',false,403);const identity=parseIdentity(raw);return hash(JSON.stringify([identity.issuer,identity.subject]));
  }
  function session(request:FastifyRequest,mutation=false):SessionRow{
    const requestOrigin=request.headers.origin;
    if(requestOrigin!==undefined&&requestOrigin!==origin)throw new ProviderError('permission-denied','Request origin was rejected.',false,403);
    if(mutation&&requestOrigin!==origin)throw new ProviderError('permission-denied','An exact origin is required.',false,403);
    const metadata=request.headers['sec-fetch-site'];if(metadata==='cross-site')throw new ProviderError('permission-denied','Cross-site request was rejected.',false,403);
    const authority=request.cookies[cookieName];if(!authority||authority.length>256)throw new ProviderError('unauthorized','No valid application session.',false,401);
    const raw=database.prepare('SELECT * FROM sessions WHERE id_hash=?').get(hash(authority));if(!raw)throw new ProviderError('unauthorized','No valid application session.',false,401);
    const result=parseSession(raw);
    if(result.revoked||result.expires_at<=now()||result.generation!==generation())throw new ProviderError('revoked','Application session expired or was revoked.',false,401);
    if(mutation){const csrf=request.headers['x-csrf-token'];if(typeof csrf!=='string'||!equal(csrf,result.csrf))throw new ProviderError('permission-denied','CSRF confirmation was rejected.',false,403);}
    return result;
  }
  function issueSession(reply:FastifyReply,workspaceId:string){
    database.prepare('INSERT OR IGNORE INTO workspaces(id,title) VALUES(?,?)').run(workspaceId,'Personal workspace');
    const secret=randomBytes(32).toString('base64url'),csrfToken=randomBytes(32).toString('base64url'),expiresAt=now()+86400000;
    database.prepare('INSERT INTO sessions(id_hash,workspace_id,generation,expires_at,csrf) VALUES(?,?,?,?,?)').run(hash(secret),workspaceId,generation(),expiresAt,csrfToken);
    reply.setCookie(cookieName,secret,{path:'/',httpOnly:true,secure:!config.demoInsecureCookie,sameSite:'strict',maxAge:86400});
    return {workspaceId,generation:generation(),csrfToken,mode,label:provider.status().label,demoOnly:mode==='demo'};
  }
  function currentInstall(owner:SessionRow,id:string,expected?:number):InstallRow{
    const raw=database.prepare('SELECT * FROM installs WHERE workspace_id=? AND id=?').get(owner.workspace_id,id);if(!raw)throw new ProviderError('permission-denied','Installation does not belong to this workspace.',false,403);
    const install=parseInstall(raw);if(install.state!=='active'||install.account_generation!==owner.generation||install.receipt_expires_at<=now()||(expected!==undefined&&install.generation!==expected))throw new ProviderError('revoked','Installation verification, generation or account is stale.',false,403);return install;
  }
  function grant(owner:SessionRow,install:InstallRow,capability:string,id?:string):Permission{
    const manifest=validateManifest(JSON.parse(install.manifest_json));const rows=database.prepare('SELECT * FROM grants WHERE workspace_id=? AND install_id=? AND capability=? AND revoked=0').all(owner.workspace_id,install.id,capability);
    for(const raw of rows){const row=parseGrant(raw);if(row.generation!==install.generation||row.account_generation!==owner.generation||(row.expires_at!==null&&row.expires_at<=now())||(id&&row.id!==id))continue;const permission=manifest.permissions.find(item=>item.id===row.id&&item.capability===row.capability);if(permission)return permission;}
    throw new ProviderError('permission-denied','Current capability consent is required.',false,403);
  }
  function append(runId:string,type:string,data:Record<string,unknown>):RunEvent{
    const event=transaction(database,()=>{
      const run=parseRun(database.prepare('SELECT * FROM runs WHERE id=?').get(runId));if(terminalStates.has(run.state))throw new ProviderError('cancelled','Run is already terminal.');
      const sequence=run.last_sequence+1;database.prepare('INSERT INTO run_events VALUES(?,?,?,?)').run(runId,sequence,type,JSON.stringify(data));
      const nextState=type==='completed'?'completed':type==='failed'?'failed':type==='interrupted'?'interrupted':type==='cancelled'?'cancelled':'running';
      database.prepare('UPDATE runs SET last_sequence=?,state=?,output_bytes=output_bytes+? WHERE id=?').run(sequence,nextState,type==='delta'&&typeof data.text==='string'?Buffer.byteLength(data.text):0,runId);
      if(terminalStates.has(nextState))database.prepare('UPDATE usage_reservations SET completed_at=? WHERE run_id=?').run(now(),runId);
      return {runId,sequence,type,data};
    });if(terminalStates.has(type)){const timer=disconnectTimers.get(runId);if(timer)clearTimeout(timer);disconnectTimers.delete(runId);}events.emit(runId,event);return event;
  }
  function cancelRun(runId:string,code='cancelled'):void{
    const raw=database.prepare('SELECT * FROM runs WHERE id=?').get(runId);if(!raw)return;const run=parseRun(raw);if(terminalStates.has(run.state))return;
    active.get(runId)?.abort();append(runId,code==='interrupted'?'interrupted':'cancelled',{code,message:code==='revoked'?'Run stopped because consent or account changed.':code==='interrupted'?'Runtime stopped; the admitted request remains accounted.':code==='disconnected'?'Run cancelled after its stream disconnected; admitted usage remains counted.':'Run cancelled.'});
  }
  function cancelInstallation(workspaceId:string,installId:string):void{for(const raw of database.prepare("SELECT * FROM runs WHERE workspace_id=? AND install_id=? AND state IN ('reserved','running')").all(workspaceId,installId))cancelRun(parseRun(raw).id,'revoked');}
  function updateGrants(owner:SessionRow,install:InstallRow,ids:readonly string[],increment:boolean):{installId:string;generation:number;grants:string[]}{
    const manifest=validateManifest(JSON.parse(install.manifest_json));if(ids.some(id=>!manifest.permissions.some(permission=>permission.id===id)))throw new ProviderError('permission-denied','Permission was not declared in the verified package.',false,403);
    const next=install.generation+(increment?1:0);
    transaction(database,()=>{database.prepare('UPDATE installs SET generation=?,account_generation=? WHERE workspace_id=? AND id=?').run(next,owner.generation,owner.workspace_id,install.id);database.prepare('DELETE FROM grants WHERE workspace_id=? AND install_id=?').run(owner.workspace_id,install.id);for(const id of ids){const permission=manifest.permissions.find(item=>item.id===id);if(!permission)throw new ProviderError('permission-denied','Permission mismatch.');database.prepare('INSERT INTO grants VALUES(?,?,?,?,?,?,0,?,?)').run(owner.workspace_id,install.id,id,next,permission.capability,JSON.stringify(permission.scope),now()+86400000,owner.generation);}});
    if(increment)cancelInstallation(owner.workspace_id,install.id);
    return {installId:install.id,generation:next,grants:[...ids]};
  }
  function registerInstallation(workspaceId:string,pkg:VerifiedPackage,grantedPermissionIds:readonly string[],expectedGeneration?:number){
    const manifest=validateManifest(pkg.manifest),digest=pkg.envelope.archive.sha256;
    if(grantedPermissionIds.some(id=>!manifest.permissions.some(permission=>permission.id===id)))throw new ProviderError('permission-denied','Permission was not declared in the verified package.',false,403);
    const receiptExpiry=Date.parse(pkg.receipt.expiresAt);if(!Number.isSafeInteger(receiptExpiry)||receiptExpiry<=now())throw new ProviderError('revoked','Package verification receipt expired.',false,403);
    const result=transaction(database,()=>{
      database.prepare('INSERT OR IGNORE INTO workspaces(id,title) VALUES(?,?)').run(workspaceId,'Personal workspace');
      const oldRaw=database.prepare('SELECT * FROM installs WHERE workspace_id=? AND id=?').get(workspaceId,manifest.id);const old=oldRaw?parseInstall(oldRaw):null;
      // A delayed browser approval must not restore consent after a revocation or uninstall.
      if(old?expectedGeneration!==old.generation:expectedGeneration!==undefined&&expectedGeneration!==0)throw new ProviderError('conflict','Installation changed; review its current permissions before approving again.',false,409);
      const currentAccount=generation();
      const oldGrantIds=database.prepare('SELECT * FROM grants WHERE workspace_id=? AND install_id=? AND revoked=0').all(workspaceId,manifest.id).map(parseGrant).filter(item=>item.account_generation===currentAccount&&item.generation===old?.generation&&(item.expires_at===null||item.expires_at>now())).map(item=>item.id).sort();
      const changed=old&&(old.state!=='active'||old.digest!==digest||old.account_generation!==currentAccount||JSON.stringify(oldGrantIds)!==JSON.stringify([...grantedPermissionIds].sort()));
      const next=old?(changed?old.generation+1:old.generation):1;
      database.prepare('INSERT INTO installs(workspace_id,id,plugin_id,digest,generation,state,manifest_json,account_generation,receipt_expires_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,id) DO UPDATE SET plugin_id=excluded.plugin_id,digest=excluded.digest,generation=excluded.generation,state=excluded.state,manifest_json=excluded.manifest_json,account_generation=excluded.account_generation,receipt_expires_at=excluded.receipt_expires_at').run(workspaceId,manifest.id,manifest.id,digest,next,'active',JSON.stringify(manifest),currentAccount,receiptExpiry);
      database.prepare('DELETE FROM grants WHERE workspace_id=? AND install_id=?').run(workspaceId,manifest.id);
      for(const id of grantedPermissionIds){const permission=manifest.permissions.find(item=>item.id===id);if(!permission)throw new ProviderError('permission-denied','Permission mismatch.');database.prepare('INSERT INTO grants VALUES(?,?,?,?,?,?,0,?,?)').run(workspaceId,manifest.id,id,next,permission.capability,JSON.stringify(permission.scope),now()+86400000,currentAccount);}
      return {installId:manifest.id,generation:next,grants:[...grantedPermissionIds],changed:Boolean(changed)};
    });
    if(result.changed)cancelInstallation(workspaceId,manifest.id);
    return {installId:result.installId,generation:result.generation,grants:result.grants};
  }
  async function execute(run:RunRow,owner:SessionRow,input:RunInput,prompt:string){
    const controller=new AbortController();active.set(run.id,controller);const timeout=setTimeout(()=>cancelRun(run.id,'timeout'),config.maximumElapsedMs??30000);timeout.unref();
    try{
      const emit=(event:ProviderEvent):void=>{
        if(controller.signal.aborted)throw new ProviderError('cancelled','Run stopped.');
        if(Buffer.byteLength(JSON.stringify(event.data))>131072)throw new ProviderError('quota-exceeded','Provider event exceeded the local delivery boundary.',false,429);
        const liveRaw=database.prepare('SELECT * FROM sessions WHERE id_hash=?').get(owner.id_hash);if(!liveRaw)throw new ProviderError('revoked','Session was revoked.');const live=parseSession(liveRaw);
        if(live.revoked||live.expires_at<=now()||live.generation!==generation())throw new ProviderError('revoked','Session or account changed.');
        const install=currentInstall(live,run.install_id,run.generation);grant(live,install,'ai.respond');
        const current=parseRun(database.prepare('SELECT * FROM runs WHERE id=?').get(run.id));if(terminalStates.has(current.state))throw new ProviderError('cancelled','Run stopped.');
        if(event.type==='delta'&&current.output_bytes+Buffer.byteLength(event.data.text??'')>(config.maximumOutputBytes??1048576))throw new ProviderError('quota-exceeded','Local output delivery limit reached.',false,429);
        append(run.id,event.type,event.data);
      };
      await provider.execute({model:input.model,prompt,...(input.instructions===undefined?{}:{instructions:input.instructions})},controller.signal,emit);
      const current=parseRun(database.prepare('SELECT * FROM runs WHERE id=?').get(run.id));if(!terminalStates.has(current.state))append(run.id,'interrupted',{code:'interrupted',message:'Provider ended without completing inference.'});
    }catch(error){
      const raw=database.prepare('SELECT * FROM runs WHERE id=?').get(run.id);if(raw&&!terminalStates.has(parseRun(raw).state)){const code=error instanceof ProviderError?error.code:controller.signal.aborted?'cancelled':'provider-unavailable';append(run.id,code==='cancelled'||code==='revoked'?'cancelled':code==='interrupted'?'interrupted':'failed',{code,message:code==='provider-unavailable'?'Provider could not complete this request.':error instanceof ProviderError?error.message:'Run stopped.'});}
    }finally{clearTimeout(timeout);active.delete(run.id);}
  }
  for(const raw of database.prepare("SELECT * FROM runs WHERE state IN ('reserved','running')").all())append(parseRun(raw).id,'interrupted',{code:'interrupted',message:'Runtime restarted. Resume the journal; start a new request explicitly.'});
  app.addHook('onSend',async(request,reply,payload)=>{reply.header('x-content-type-options','nosniff').header('referrer-policy','no-referrer');if(request.url.startsWith('/v1')||request.url.startsWith('/auth'))reply.header('cache-control','no-store');return payload;});
  app.setErrorHandler((error,_request,reply)=>{
    if(error instanceof ProviderError){reply.code(error.status).send({code:error.code,message:error.message,retryable:error.retryable});return;}
    if(error instanceof PlatformError){reply.code(403).send({code:error.code,message:'Package or capability verification failed.',retryable:false});return;}
    if(error instanceof Error&&'code'in error&&(error.code==='FST_ERR_CTP_BODY_TOO_LARGE'||error.code==='FST_ERR_CTP_INVALID_JSON_BODY')){reply.code(error.code==='FST_ERR_CTP_BODY_TOO_LARGE'?413:400).send({code:'invalid-request',message:'Request body was invalid or exceeded the boundary.',retryable:false});return;}
    reply.code(500).send({code:'internal',message:'Runtime could not complete the operation.',retryable:false});
  });
  app.get('/health',async()=>({ok:true,mode,demoOnly:mode==='demo'}));
  app.post('/v1/session/local',async(request,reply)=>{
    if(!isLoopback(request.ip)||request.headers.origin!==origin||request.headers['sec-fetch-site']==='cross-site')throw new ProviderError('permission-denied','Local owner session requires this runtime origin on loopback.',false,403);
    const parseEmpty=schema<Record<string,never>>({type:'object',additionalProperties:false});parseEmpty(request.body??{});
    return issueSession(reply,'local');
  });
  app.get('/v1/session',async request=>{const owner=session(request);return {workspaceId:owner.workspace_id,generation:owner.generation,csrfToken:owner.csrf,mode,label:provider.status().label,demoOnly:mode==='demo'};});
  app.delete('/v1/session',async(request,reply)=>{const owner=session(request,true);database.prepare('UPDATE sessions SET revoked=1 WHERE id_hash=?').run(owner.id_hash);for(const raw of database.prepare("SELECT * FROM runs WHERE session_hash=? AND state IN ('reserved','running')").all(owner.id_hash))cancelRun(parseRun(raw).id,'revoked');reply.clearCookie(cookieName,{path:'/'});return {signedOut:true};});
  app.get('/v1/provider/status',async request=>{session(request);return {...provider.status(),pluginInferenceAuthorized:mode==='demo'||Boolean(config.pluginScopeAuthorization&&await config.pluginScopeAuthorization())};});
  app.get('/v1/trust',async request=>{session(request);const roots=(config.trustRoots??[]).filter(root=>!root.demoOnly||(mode==='demo'&&isLoopback(host)));return roots.length?validateTrustRoots(roots):[];});
  app.get('/v1/catalogue/policy',async request=>{session(request);const policy=await revocationPolicy();return policy?{state:Date.parse(policy.issuedAt)<=now()&&Date.parse(policy.expiresAt)>now()?'current':'expired',policy}:{state:'unknown'};});
  app.get('/v1/provider/models',async request=>{session(request);return provider.models();});
  const approveInstall=async(request:FastifyRequest)=>{const owner=session(request,true);const body=parseInstallInput(request.body);const verified=await verifyInstallPacket(body.packet,config.trustRoots??[],{allowDemo:mode==='demo'&&isLoopback(host),revocationPolicy:await revocationPolicy(),now:new Date(now())});if(verified.manifest.service){if(!config.prepareGuest)throw new ProviderError('unsupported-capability','Trusted guest preparation is not configured.');await config.prepareGuest(verified);}session(request,true);await revocationPolicy();if(knownRevocation)assertRevocationPolicy(verified,knownRevocation,new Date(now()));return registerInstallation(owner.workspace_id,verified,body.grants,body.expectedGeneration);};
  app.post('/v1/installs',approveInstall);app.post('/v1/install/approve',approveInstall);
  app.get('/v1/installs',async request=>{const owner=session(request);return database.prepare('SELECT * FROM installs WHERE workspace_id=? AND state=?').all(owner.workspace_id,'active').map(raw=>{const install=parseInstall(raw);return {installId:install.id,pluginId:install.plugin_id,digest:install.digest,generation:install.generation,manifest:validateManifest(JSON.parse(install.manifest_json))};});});
  app.get('/v1/installs/:id/registration',async request=>{const owner=session(request),{id}=parseId(request.params);const raw=database.prepare('SELECT * FROM installs WHERE workspace_id=? AND id=?').get(owner.workspace_id,id);if(!raw)throw new ProviderError('not-found','Installation has never been registered.',false,404);const install=parseInstall(raw);const grants=database.prepare('SELECT * FROM grants WHERE workspace_id=? AND install_id=? AND revoked=0').all(owner.workspace_id,id).map(parseGrant).filter(item=>install.state==='active'&&install.receipt_expires_at>now()&&install.account_generation===owner.generation&&item.generation===install.generation&&item.account_generation===owner.generation&&(item.expires_at===null||item.expires_at>now())).map(item=>item.id).sort();return {installId:install.id,generation:install.generation,state:install.state,digest:install.digest,grants};});
  app.put('/v1/installs/:id/grants',async request=>{const owner=session(request,true),{id}=parseId(request.params),body=parseGrantsInput(request.body);return updateGrants(owner,currentInstall(owner,id,body.generation),body.grants,true);});
  app.delete('/v1/installs/:id',async request=>{const owner=session(request,true),{id}=parseId(request.params),input=parseDeleteInstall(request.body??{});const next=transaction(database,()=>{const raw=database.prepare('SELECT * FROM installs WHERE workspace_id=? AND id=?').get(owner.workspace_id,id);if(!raw)throw new ProviderError('not-found','Installation has never been registered.',false,404);const install=parseInstall(raw);if(input.expectedGeneration!==install.generation)throw new ProviderError('conflict','Installation changed before removal; review the current registration.',false,409);if(install.state==='uninstalled')return install.generation;const generation=install.generation+1;database.prepare('DELETE FROM grants WHERE workspace_id=? AND install_id=?').run(owner.workspace_id,id);database.prepare("UPDATE installs SET state='uninstalled',generation=? WHERE workspace_id=? AND id=?").run(generation,owner.workspace_id,id);return generation;});cancelInstallation(owner.workspace_id,id);return {uninstalled:true,generation:next};});
  const resolveInstall=async(request:FastifyRequest)=>{
    session(request,request.method==='POST');const parseResolve=schema<{repository:string;version?:string}>({type:'object',additionalProperties:false,required:['repository'],properties:{repository:{type:'string',minLength:1,maxLength:2048},version:{type:'string',minLength:1,maxLength:128}}});const input=parseResolve(request.method==='POST'?request.body:request.query);
    if(!config.registryResolver)throw new ProviderError('provider-unavailable','Release resolver is not configured.',false,503);const packet=await config.registryResolver(input.repository,input.version);await verifyInstallPacket(packet,config.trustRoots??[],{allowDemo:mode==='demo'&&isLoopback(host),revocationPolicy:await revocationPolicy(),now:new Date(now())});return packet;
  };
  app.get('/v1/registry/resolve',resolveInstall);app.post('/v1/registry/resolve',resolveInstall);app.post('/v1/installs/resolve',resolveInstall);
  app.post('/v1/runs',async(request,reply)=>{
    const owner=session(request,true),input=parseRunInput(request.body);const prompt=input.input??input.prompt??'';const inputBytes=Buffer.byteLength(prompt)+(input.instructions?Buffer.byteLength(input.instructions):0);
    if(!prompt.trim()||inputBytes>262144)throw new ProviderError('invalid-request','Text input is empty or exceeds its boundary.');
    if(input.selectedDocumentHandles?.length)throw new ProviderError('unsupported-capability','Server document handles must be registered before disclosure.');
    const install=currentInstall(owner,input.installId,input.generation),permission=grant(owner,install,'ai.respond');
    if(permission.capability!=='ai.respond')throw new ProviderError('permission-denied','AI consent is required.',false,403);
    if(mode!=='demo'&&(!config.pluginScopeAuthorization||!await config.pluginScopeAuthorization()))throw new ProviderError('policy-blocked','Connected plugin scope authorization remains an external release gate.',false,403);
    if(!(await provider.models()).some(model=>model.slug===input.model))throw new ProviderError('unsupported-capability','Selected model is unavailable.',false,400);
    session(request,true);grant(owner,currentInstall(owner,input.installId,input.generation),'ai.respond');
    const accountKey=accountBudgetKey(),digest=hash(JSON.stringify({model:input.model,prompt,instructions:input.instructions??null,generation:input.generation,accountGeneration:owner.generation}));
    const admitted=transaction(database,()=>{
      const priorRaw=database.prepare('SELECT * FROM runs WHERE workspace_id=? AND install_id=? AND idempotency_key=?').get(owner.workspace_id,install.id,input.idempotencyKey);
      if(priorRaw){const prior=parseRun(priorRaw);if(prior.request_digest!==digest)throw new ProviderError('invalid-request','Idempotency key was already bound to a different request.',false,409);return {run:prior,created:false};}
      const since=now()-3600000;
      const pluginCount=parseCount(database.prepare('SELECT count(*) AS count FROM runs WHERE workspace_id=? AND install_id=? AND created_at>?').get(owner.workspace_id,install.id,since)).count;
      const accountCount=parseCount(database.prepare("SELECT count(*) AS count FROM runs WHERE (account_key=? OR account_key='legacy-unbound') AND created_at>?").get(accountKey,since)).count;
      const inFlight=parseCount(database.prepare("SELECT count(*) AS count FROM runs WHERE workspace_id=? AND install_id=? AND state IN ('reserved','running')").get(owner.workspace_id,install.id)).count;
      const accountFlight=parseCount(database.prepare("SELECT count(*) AS count FROM runs WHERE (account_key=? OR account_key='legacy-unbound') AND state IN ('reserved','running')").get(accountKey)).count;
      if(pluginCount>=permission.scope.requestsPerHour||accountCount>=(config.requestLimitPerHour??100)||inFlight>=permission.scope.concurrency||accountFlight>=(config.accountConcurrency??2))throw new ProviderError('quota-exceeded','Local admitted request or concurrency limit reached.',false,429);
      const id=randomUUID();database.prepare('INSERT INTO runs(id,workspace_id,install_id,generation,account_generation,account_key,idempotency_key,request_digest,state,provider_mode,created_at,session_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,owner.workspace_id,install.id,install.generation,owner.generation,accountKey,input.idempotencyKey,digest,'reserved',mode,now(),owner.id_hash);
      database.prepare('INSERT INTO usage_reservations(run_id,admitted_at,input_bytes) VALUES(?,?,?)').run(id,now(),inputBytes);
      return {run:parseRun(database.prepare('SELECT * FROM runs WHERE id=?').get(id)),created:true};
    });
    if(admitted.created){append(admitted.run.id,'started',{mode,label:provider.status().label});const task=execute(admitted.run,owner,input,prompt);tasks.set(admitted.run.id,task);void task.finally(()=>tasks.delete(admitted.run.id));}
    reply.code(admitted.created?201:200);return {runId:admitted.run.id,state:admitted.run.state,providerMode:mode,demoOnly:mode==='demo'};
  });
  function ownedRun(owner:SessionRow,id:string):RunRow{
    const raw=database.prepare('SELECT * FROM runs WHERE id=? AND workspace_id=?').get(id,owner.workspace_id);if(!raw)throw new ProviderError('permission-denied','Run does not belong to this workspace.',false,403);const run=parseRun(raw);currentInstall(owner,run.install_id,run.generation);return run;
  }
  app.get('/v1/runs/:id',async request=>{const owner=session(request),{id}=parseId(request.params),run=ownedRun(owner,id);return {runId:id,state:run.state,lastSequence:run.last_sequence,providerMode:run.provider_mode,demoOnly:run.provider_mode==='demo'};});
  app.post('/v1/runs/:id/cancel',async request=>{const owner=session(request,true),{id}=parseId(request.params);ownedRun(owner,id);cancelRun(id);return {runId:id,state:parseRun(database.prepare('SELECT * FROM runs WHERE id=?').get(id)).state};});
  app.get('/v1/runs/:id/events',async(request,reply)=>{
    const owner=session(request),{id}=parseId(request.params),run=ownedRun(owner,id);grant(owner,currentInstall(owner,run.install_id,run.generation),'ai.respond');
    const query=parseEventsQuery(request.query),header=request.headers['last-event-id'];if(header!==undefined&&(typeof header!=='string'||!/^\d{1,10}$/u.test(header)))throw new ProviderError('invalid-request','Invalid stream cursor.');
    const after=Number(query.after??header??'0');if(!Number.isSafeInteger(after)||after>run.last_sequence)throw new ProviderError('invalid-request','Stream cursor exceeds the durable journal.');
    if(streamCount>=64||events.listenerCount(id)>=8)throw new ProviderError('quota-exceeded','Local stream subscription limit reached.',false,429);
    streamCount++;
    const reconnectTimer=disconnectTimers.get(id);if(reconnectTimer)clearTimeout(reconnectTimer);disconnectTimers.delete(id);
    reply.hijack();reply.raw.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','connection':'keep-alive','x-content-type-options':'nosniff'});
    let cursor=after,closed=false;const send=(event:RunEvent):void=>{
      if(closed||event.sequence<=cursor)return;
      try{session(request);grant(owner,currentInstall(owner,run.install_id,run.generation),'ai.respond');}catch{close();return;}
      const packet=`id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
      if(reply.raw.writableLength+Buffer.byteLength(packet)>1048576){close();return;}
      cursor=event.sequence;reply.raw.write(packet);if(terminalStates.has(event.type))close();
    };
    const heartbeat=setInterval(()=>{if(!closed){try{session(request);grant(owner,currentInstall(owner,run.install_id,run.generation),'ai.respond');reply.raw.write(': keepalive\n\n');}catch{close();}}},10000);heartbeat.unref();
    function close():void{if(closed)return;closed=true;streamCount--;clearInterval(heartbeat);events.off(id,send);reply.raw.end();const current=parseRun(database.prepare('SELECT * FROM runs WHERE id=?').get(id));if(!terminalStates.has(current.state)&&events.listenerCount(id)===0&&!disconnectTimers.has(id)){const timer=setTimeout(()=>{disconnectTimers.delete(id);cancelRun(id,'disconnected');},config.disconnectGraceMs??5000);timer.unref();disconnectTimers.set(id,timer);}}
    events.on(id,send);reply.raw.on('close',close);
    for(const raw of database.prepare('SELECT * FROM run_events WHERE run_id=? AND sequence>? ORDER BY sequence').all(id,after)){const event=parseEvent(raw);const parsePayload=schema<Record<string,unknown>>({type:'object'});send({runId:id,sequence:event.sequence,type:event.kind,data:parsePayload(JSON.parse(event.payload_json))});}
    if(terminalStates.has(run.state))close();
  });
  app.post('/v1/network/request',async request=>{
    const owner=session(request,true),input=parseNetwork(request.body),install=currentInstall(owner,input.installId,input.generation),permission=grant(owner,install,'network.http',input.grantId);
    if(permission.capability!=='network.http'||!networkAllowed(input.url,input.method,permission.scope.rules))throw new ProviderError('permission-denied','Destination is outside the granted network scope.',false,403);
    const response=await secureFetch(input.url,{method:input.method,maximumBytes:1048576,maximumRedirects:0,allowedOrigins:permission.scope.rules.map(rule=>rule.origin),signal:AbortSignal.timeout(15000)});
    const live=session(request,true);grant(live,currentInstall(live,install.id,input.generation),'network.http',input.grantId);return {status:response.status,body:new TextDecoder('utf-8',{fatal:true}).decode(response.bytes)};
  });
  app.post('/v1/pairing/invitations',async request=>{
    const owner=session(request,true);if(!isLoopback(request.ip))throw new ProviderError('permission-denied','Confirm pairing on the personal runtime computer.',false,403);
    if(url.protocol!=='https:')throw new ProviderError('policy-blocked','Real phone pairing requires authenticated HTTPS.',false,403);
    const parse=schema<{confirmAccountGeneration:number}>({type:'object',additionalProperties:false,required:['confirmAccountGeneration'],properties:{confirmAccountGeneration:{type:'integer',minimum:1}}});if(parse(request.body).confirmAccountGeneration!==owner.generation)throw new ProviderError('revoked','Account confirmation is stale.',false,403);
    const code=randomBytes(32).toString('base64url'),expiresAt=now()+120000;
    database.prepare('INSERT INTO pairing(code_hash,workspace_id,generation,expires_at) VALUES(?,?,?,?)').run(hash(code),owner.workspace_id,owner.generation,expiresAt);return {code,expiresAt,origin,providerLabel:provider.status().label};
  });
  app.post('/v1/pairing/claim',async(request,reply)=>{
    if(url.protocol!=='https:'||request.headers.origin!==origin||request.headers['sec-fetch-site']==='cross-site')throw new ProviderError('permission-denied','Pairing requires this authenticated HTTPS origin.',false,403);
    const parse=schema<{code:string}>({type:'object',additionalProperties:false,required:['code'],properties:{code:{type:'string',minLength:1,maxLength:128}}});const input=parse(request.body);
    for(const [ip,value]of pairingAttempts)if(value.expiresAt<=now())pairingAttempts.delete(ip);
    if(pairingAttempts.size>=2048&&!pairingAttempts.has(request.ip))throw new ProviderError('quota-exceeded','Pairing admission is temporarily limited.',false,429);
    const attempt=pairingAttempts.get(request.ip);const current=attempt&&attempt.expiresAt>now()?attempt:{count:0,expiresAt:now()+60000};current.count++;pairingAttempts.set(request.ip,current);if(current.count>5)throw new ProviderError('quota-exceeded','Pairing attempt limit reached.',false,429);
    const owner=transaction(database,()=>{const parsePair=schema<{workspace_id:string;generation:number;expires_at:number;used:number;attempts:number}>({type:'object',additionalProperties:false,required:['workspace_id','generation','expires_at','used','attempts'],properties:{workspace_id:{type:'string'},generation:{type:'integer'},expires_at:{type:'integer'},used:{type:'integer'},attempts:{type:'integer'}}});const raw=database.prepare('SELECT workspace_id,generation,expires_at,used,attempts FROM pairing WHERE code_hash=?').get(hash(input.code));if(!raw)throw new ProviderError('permission-denied','Pairing invitation was rejected.',false,403);const value=parsePair(raw);if(value.used||value.expires_at<=now()||value.generation!==generation()||value.attempts>=5)throw new ProviderError('permission-denied','Pairing invitation expired, was used, or was revoked.',false,403);database.prepare('UPDATE pairing SET used=1,attempts=attempts+1 WHERE code_hash=?').run(hash(input.code));return value;});
    return issueSession(reply,owner.workspace_id);
  });
  app.delete('/v1/pairing/invitations',async request=>{const owner=session(request,true);database.prepare('UPDATE pairing SET used=1 WHERE workspace_id=?').run(owner.workspace_id);return {revoked:true};});
  if(provider instanceof ChatGptPlanProvider){
    let callbackServer:CallbackServer|null=null,callbackPort:number|null=null;
    const ensureCallback=async():Promise<number>=>{
      if(callbackPort!==null)return callbackPort;
      const listener=createServer((request,response)=>{
        if(request.method!=='GET'||!request.url?.startsWith('/auth/callback?')||!isLoopback(request.socket.remoteAddress??'')){response.writeHead(404);response.end();return;}
        void app.inject({method:'GET',url:request.url,remoteAddress:'127.0.0.1'}).then(result=>{response.writeHead(result.statusCode,result.headers);response.end(result.payload);},()=>{response.writeHead(500,{'cache-control':'no-store'});response.end('Sign-in could not complete.');});
      });
      await new Promise<void>((resolveListener,reject)=>{listener.once('error',()=>reject(new ProviderError('temporarily-unavailable','Local OAuth callback listener is unavailable.',true,503)));listener.listen(config.oauthCallbackPort??0,'127.0.0.1',()=>resolveListener());});
      const address=listener.address();if(!address||typeof address==='string'){listener.close();throw new ProviderError('temporarily-unavailable','Local callback listener did not start.',true,503);}
      callbackServer=listener;callbackPort=address.port;return address.port;
    };
    app.addHook('onClose',async()=>{if(callbackServer)await new Promise<void>(resolveCallback=>callbackServer?.close(()=>resolveCallback()));});
    app.post('/v1/provider/connect',async request=>{session(request,true);if(!isLoopback(request.ip))throw new ProviderError('permission-denied','Complete ChatGPT sign-in on the runtime computer.',false,403);const parse=schema<{registrationId?:string}>({type:'object',additionalProperties:false,properties:{registrationId:{type:'string',pattern:'^[a-f0-9]{64}$'}}});const body=parse(request.body??{});const callback=await ensureCallback();session(request,true);return provider.oauth.begin(`http://127.0.0.1:${callback}/auth/callback`,body.registrationId);});
    app.get('/auth/callback',async(request,reply)=>{
      if(!isLoopback(request.ip))throw new ProviderError('permission-denied','OAuth callback requires loopback.',false,403);
      const selectionEpoch=providerSelectionEpoch,registration=await provider.oauth.complete(request.query);if(selectionEpoch!==providerSelectionEpoch){await provider.oauth.disconnect(registration.id);throw new ProviderError('revoked','Provider selection changed before sign-in completed.',false,403);}providerSelectionEpoch++;
      database.prepare('INSERT INTO runtime_registrations(id,issuer,subject,client_id,state,label) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state').run(registration.id,registration.issuer,registration.subject,registration.clientId,registration.state,'ChatGPT registration '+registration.id.slice(0,8));
      for(const id of active.keys())cancelRun(id,'revoked');database.prepare("UPDATE runtime_metadata SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT) WHERE key='account_generation'").run();database.prepare('UPDATE sessions SET revoked=1').run();database.prepare('UPDATE pairing SET used=1').run();database.prepare('UPDATE grants SET revoked=1').run();provider.select(registration.id,registration.state);
      database.prepare("INSERT INTO runtime_metadata(key,value) VALUES('selected_registration',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(registration.id);issueSession(reply,'local');reply.redirect(origin+'/');
    });
    app.get('/v1/provider/registrations',async request=>{session(request);const parse=schema<{id:string;state:string;label:string}>({type:'object',additionalProperties:false,required:['id','state','label'],properties:{id:{type:'string'},state:{type:'string'},label:{type:'string'}}});return database.prepare('SELECT id,state,label FROM runtime_registrations').all().map(value=>({...parse(value),selected:parse(value).id===provider.selectedRegistration()}));});
    app.post('/v1/provider/select',async(request,reply)=>{
      const owner=session(request,true);const parse=schema<{registrationId:string}>({type:'object',additionalProperties:false,required:['registrationId'],properties:{registrationId:{type:'string',pattern:'^[a-f0-9]{64}$'}}});const input=parse(request.body);const exists=database.prepare('SELECT id FROM runtime_registrations WHERE id=?').get(input.registrationId);if(!exists)throw new ProviderError('permission-denied','Select a registration verified by this runtime.',false,403);
      const selectionEpoch=providerSelectionEpoch,credential=await provider.oauth.credential(input.registrationId);session(request,true);if(selectionEpoch!==providerSelectionEpoch)throw new ProviderError('revoked','Provider selection changed before it was confirmed.',false,403);providerSelectionEpoch++;for(const id of active.keys())cancelRun(id,'revoked');provider.oauth.cancelPending();
      database.prepare("UPDATE runtime_metadata SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT) WHERE key='account_generation'").run();database.prepare('UPDATE sessions SET revoked=1').run();database.prepare('UPDATE pairing SET used=1').run();database.prepare('UPDATE grants SET revoked=1').run();
      provider.select(input.registrationId,credential.scopes.includes('chatgpt.tokens.use.direct')&&credential.scopes.includes('resource.invoke')?'ready':'identity-only');database.prepare("INSERT INTO runtime_metadata(key,value) VALUES('selected_registration',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(input.registrationId);
      return issueSession(reply,owner.workspace_id);
    });
    app.delete('/v1/provider',async request=>{session(request,true);providerSelectionEpoch++;for(const id of active.keys())cancelRun(id,'revoked');const selected=provider.selectedRegistration();provider.clear();provider.oauth.cancelPending();database.prepare('UPDATE grants SET revoked=1').run();database.prepare('UPDATE pairing SET used=1').run();database.prepare("DELETE FROM runtime_metadata WHERE key='selected_registration'").run();return selected?provider.oauth.disconnect(selected):{remoteRevocationConfirmed:true};});
    const selected=database.prepare("SELECT value FROM runtime_metadata WHERE key='selected_registration'").get();if(selected)provider.select(parseMetadata(selected).value);
  }
  const artifactRoot=resolve(config.artifactRoot??'artifacts'),shellRoot=resolve(config.shellRoot??'dist/shell'),minimalRoot=resolve(config.minimalRoot??'dist/minimal');
  if(existsSync(resolve(artifactRoot,'spikes'))){await app.register(staticFiles,{root:resolve(artifactRoot,'spikes'),prefix:'/spikes/',preCompressed:true,decorateReply:false});app.get('/spikes',async(_request,reply)=>reply.redirect('/spikes/'));}
  if(existsSync(resolve(artifactRoot,'guest/browser')))await app.register(staticFiles,{root:resolve(artifactRoot,'guest/browser'),prefix:'/guest/',preCompressed:true,decorateReply:false});
  if(existsSync(resolve(artifactRoot,'packages')))await app.register(staticFiles,{root:resolve(artifactRoot,'packages'),prefix:'/fixtures/',decorateReply:false});
  if(existsSync(minimalRoot)){await app.register(staticFiles,{root:minimalRoot,prefix:'/minimal/',preCompressed:true,decorateReply:false});app.get('/minimal',async(_request,reply)=>reply.redirect('/minimal/'));}
  if(mode==='demo'&&isLoopback(host)){
    const probes:string[]=[];app.post('/probe/reset',async request=>{if(!isLoopback(request.ip))throw new ProviderError('permission-denied','Probe is local only.',false,403);probes.length=0;return {ok:true};});app.get('/probe/log',async request=>{if(!isLoopback(request.ip))throw new ProviderError('permission-denied','Probe is local only.',false,403);return probes;});app.get('/probe/:kind',async(request,reply)=>{if(!isLoopback(request.ip))throw new ProviderError('permission-denied','Probe is local only.',false,403);probes.push(request.url);reply.type('text/html');return '<!doctype html><title>Navigation probe</title>';});
  }
  if(existsSync(shellRoot)){await app.register(staticFiles,{root:shellRoot,prefix:'/',preCompressed:true,decorateReply:false});app.setNotFoundHandler(async(request,reply)=>{if(request.url.startsWith('/v1/')||request.url.startsWith('/auth/')||request.url.includes('.')){reply.code(404);return {code:'not-found',message:'Resource not found.',retryable:false};}return reply.type('text/html').send(await import('node:fs/promises').then(fs=>fs.readFile(resolve(shellRoot,'index.html'))));});}
  app.addHook('onClose',async()=>{for(const timer of disconnectTimers.values())clearTimeout(timer);disconnectTimers.clear();for(const id of active.keys())cancelRun(id,'interrupted');for(const controller of active.values())controller.abort();await Promise.allSettled([...tasks.values()]);events.removeAllListeners();database.close();});
  await app.ready();
  return {app,registerInstallation,provider,database,origin,host,port,async listen(){return app.listen({host,port});},async close(){await app.close();}};
}
