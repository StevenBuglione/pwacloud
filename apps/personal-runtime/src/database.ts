import { DatabaseSync } from 'node:sqlite';
import { schema } from '../../../packages/provider-chatgpt/src/schema.ts';

export type SessionRow={id_hash:string;workspace_id:string;generation:number;expires_at:number;revoked:number;csrf:string};
export type InstallRow={workspace_id:string;id:string;plugin_id:string;digest:string;generation:number;state:string;manifest_json:string;account_generation:number;receipt_expires_at:number};
export type RunRow={id:string;workspace_id:string;install_id:string;generation:number;account_generation:number;account_key:string;idempotency_key:string;request_digest:string;state:string;provider_mode:string;created_at:number;last_sequence:number;output_bytes:number;session_hash:string};
export type GrantRow={workspace_id:string;install_id:string;id:string;generation:number;capability:string;scope_json:string;revoked:number;expires_at:number|null;account_generation:number};
export type EventRow={run_id:string;sequence:number;kind:string;payload_json:string};
const text={type:'string'},int={type:'integer'};
function row<T>(properties:Record<string,object>){return schema<T>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});}
export const parseSession=row<SessionRow>({id_hash:text,workspace_id:text,generation:int,expires_at:int,revoked:int,csrf:text});
export const parseInstall=row<InstallRow>({workspace_id:text,id:text,plugin_id:text,digest:text,generation:int,state:text,manifest_json:text,account_generation:int,receipt_expires_at:int});
export const parseRun=row<RunRow>({id:text,workspace_id:text,install_id:text,generation:int,account_generation:int,account_key:text,idempotency_key:text,request_digest:text,state:text,provider_mode:text,created_at:int,last_sequence:int,output_bytes:int,session_hash:text});
export const parseGrant=row<GrantRow>({workspace_id:text,install_id:text,id:text,generation:int,capability:text,scope_json:text,revoked:int,expires_at:{type:['integer','null']},account_generation:int});
export const parseEvent=row<EventRow>({run_id:text,sequence:int,kind:text,payload_json:text});
export function openDatabase(path:string):DatabaseSync{
  const database=new DatabaseSync(path);database.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
  CREATE TABLE IF NOT EXISTS runtime_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  INSERT OR IGNORE INTO runtime_metadata VALUES('account_generation','1');
  CREATE TABLE IF NOT EXISTS runtime_registrations(id TEXT PRIMARY KEY,issuer TEXT NOT NULL,subject TEXT NOT NULL,client_id TEXT NOT NULL,state TEXT NOT NULL,label TEXT NOT NULL,UNIQUE(issuer,subject,client_id));
  CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,title TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS sessions(id_hash TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),generation INTEGER NOT NULL,expires_at INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,csrf TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS installs(workspace_id TEXT NOT NULL REFERENCES workspaces(id),id TEXT NOT NULL,plugin_id TEXT NOT NULL,digest TEXT NOT NULL,generation INTEGER NOT NULL,state TEXT NOT NULL,manifest_json TEXT NOT NULL,account_generation INTEGER NOT NULL,receipt_expires_at INTEGER NOT NULL,PRIMARY KEY(workspace_id,id));
  CREATE TABLE IF NOT EXISTS grants(workspace_id TEXT NOT NULL,install_id TEXT NOT NULL,id TEXT NOT NULL,generation INTEGER NOT NULL,capability TEXT NOT NULL,scope_json TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,expires_at INTEGER,account_generation INTEGER NOT NULL,PRIMARY KEY(workspace_id,install_id,id),FOREIGN KEY(workspace_id,install_id) REFERENCES installs(workspace_id,id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,install_id TEXT NOT NULL,generation INTEGER NOT NULL,account_generation INTEGER NOT NULL,account_key TEXT NOT NULL DEFAULT 'legacy-unbound',idempotency_key TEXT NOT NULL,request_digest TEXT NOT NULL,state TEXT NOT NULL,provider_mode TEXT NOT NULL,created_at INTEGER NOT NULL,last_sequence INTEGER NOT NULL DEFAULT 0,output_bytes INTEGER NOT NULL DEFAULT 0,session_hash TEXT NOT NULL,UNIQUE(workspace_id,install_id,idempotency_key));
  CREATE TABLE IF NOT EXISTS run_events(run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,sequence INTEGER NOT NULL,kind TEXT NOT NULL,payload_json TEXT NOT NULL,PRIMARY KEY(run_id,sequence));
  CREATE TABLE IF NOT EXISTS usage_reservations(run_id TEXT PRIMARY KEY REFERENCES runs(id),admitted_at INTEGER NOT NULL,completed_at INTEGER,input_bytes INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS pairing(code_hash TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,generation INTEGER NOT NULL,expires_at INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX IF NOT EXISTS runtime_run_owner ON runs(workspace_id,install_id,created_at);
  CREATE INDEX IF NOT EXISTS runtime_run_account ON runs(account_generation,created_at);`);
  const parseColumn=schema<{name:string}>({type:'object',additionalProperties:true,required:['name'],properties:{name:{type:'string'}}});
  if(!database.prepare('PRAGMA table_info(installs)').all().some(value=>parseColumn(value).name==='receipt_expires_at'))database.exec('ALTER TABLE installs ADD COLUMN receipt_expires_at INTEGER NOT NULL DEFAULT 0');
  if(!database.prepare('PRAGMA table_info(runs)').all().some(value=>parseColumn(value).name==='account_key'))database.exec("ALTER TABLE runs ADD COLUMN account_key TEXT NOT NULL DEFAULT 'legacy-unbound'");
  database.exec('CREATE INDEX IF NOT EXISTS runtime_run_account_key ON runs(account_key,created_at)');
  return database;
}
export function transaction<T>(database:DatabaseSync,operation:()=>T):T{
  database.exec('BEGIN IMMEDIATE');try{const value=operation();database.exec('COMMIT');return value;}catch(error){database.exec('ROLLBACK');throw error;}
}
