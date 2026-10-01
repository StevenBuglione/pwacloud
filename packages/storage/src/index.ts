import {openDB,type IDBPDatabase,type DBSchema} from 'idb';
import {PlatformError,type Manifest,type Receipt,type Principal} from '../../contracts/src/index.ts';
export type InstalledPlugin = {manifest:Manifest;digest:string;generation:number;revision:number;grants:string[];enabled:boolean;state:string;receipt:Receipt;previousDigest?:string;dependencyBindings?:{interface:string;provider:string;providerDigest:string}[]};
type RecordValue = {id:string;namespace:string;key:string;value:unknown;bytes:number};
type Lease = {owner:string;fence:number;expires:number};
export type DataReplacement={namespace:string;backup:string;quota:number};
interface Database extends DBSchema {
  values:{key:string;value:RecordValue;indexes:{namespace:string}};
  installs:{key:string;value:InstalledPlugin};
  artifacts:{key:string;value:unknown};
  journal:{key:string;value:unknown};
  leases:{key:string;value:Lease};
  operations:{key:string;value:unknown};
  generations:{key:string;value:number};
}
export function valueBytes(value:unknown):number {
  let text:string|undefined;
  try{text=JSON.stringify(value);}catch{throw new PlatformError('invalid-value');}
  if(text===undefined)throw new PlatformError('invalid-value');return new TextEncoder().encode(text).length;
}
export class PluginStorage {
  private constructor(private db:IDBPDatabase<Database>){}
  static async open(name='pwacloud'):Promise<PluginStorage>{
    const db=await openDB<Database>(name,2,{upgrade(db,oldVersion){if(oldVersion<1){const values=db.createObjectStore('values',{keyPath:'id'});values.createIndex('namespace','namespace');for(const store of ['installs','artifacts','journal','leases','operations'] as const)db.createObjectStore(store);}if(oldVersion<2)db.createObjectStore('generations');}});
    return new PluginStorage(db);
  }
  close(){this.db.close();}
  private id(namespace:string,key:string){if(namespace.includes('\0')||key.includes('\0')||!key||key.length>240)throw new PlatformError('invalid-key');return `${namespace}\0${key}`;}
  private backupRecords(namespace:string,text:string,quota:number):RecordValue[]{
    if(text.length>6291456||!Number.isSafeInteger(quota)||quota<1)throw new PlatformError('invalid-backup');const value:unknown=JSON.parse(text);
    if(typeof value!=='object'||!value||!('format'in value)||value.format!=='pwacloud.backup.v1'||!('namespace'in value)||value.namespace!==namespace||!('records'in value)||!Array.isArray(value.records)||value.records.length>500)throw new PlatformError('invalid-backup');
    const records:RecordValue[]=[];for(const entry of value.records){if(typeof entry!=='object'||!entry||!('key'in entry)||typeof entry.key!=='string'||!('value'in entry))throw new PlatformError('invalid-backup');const key=entry.key;records.push({id:this.id(namespace,key),namespace,key,value:entry.value,bytes:valueBytes(entry.value)+new TextEncoder().encode(key).length+64});}
    if(new Set(records.map(r=>r.id)).size!==records.length||records.reduce((total,r)=>total+r.bytes,0)>quota)throw new PlatformError('quota-exceeded');return records;
  }
  async get(namespace:string,key:string):Promise<unknown>{return (await this.db.get('values',this.id(namespace,key)))?.value??null;}
  async list(namespace:string):Promise<{key:string;value:unknown}[]>{return (await this.db.getAllFromIndex('values','namespace',namespace)).map(r=>({key:r.key,value:r.value}));}
  async put(namespace:string,key:string,value:unknown,quota=1048576,guard?:{principal:Principal;capability?:string}){
    const id=this.id(namespace,key);const bytes=valueBytes(value)+new TextEncoder().encode(key).length+64;
    if(!Number.isSafeInteger(quota)||quota<1||bytes>quota)throw new PlatformError('quota-exceeded');
    const tx=this.db.transaction(['values','installs'],'readwrite');
    if(guard){const install=await tx.objectStore('installs').get(guard.principal.plugin);if(!install||!install.enabled||install.digest!==guard.principal.digest||install.generation!==guard.principal.generation||(guard.capability&&!install.manifest.permissions.some(p=>p.capability===guard.capability&&install.grants.includes(p.id)))){tx.abort();throw new PlatformError('revoked');}}
    const records=await tx.objectStore('values').index('namespace').getAll(namespace);
    const total=records.reduce((sum,r)=>sum+(r.id===id?0:r.bytes),bytes);
    if(total>quota){tx.abort();throw new PlatformError('quota-exceeded');}
    await tx.objectStore('values').put({id,namespace,key,value,bytes});await tx.done;
  }
  async delete(namespace:string,key:string,guard?:{principal:Principal;capability:string}){const tx=this.db.transaction(['values','installs'],'readwrite');if(guard){const install=await tx.objectStore('installs').get(guard.principal.plugin);if(!install||!install.enabled||install.digest!==guard.principal.digest||install.generation!==guard.principal.generation||!install.manifest.permissions.some(p=>p.capability===guard.capability&&install.grants.includes(p.id))){tx.abort();throw new PlatformError('revoked');}}await tx.objectStore('values').delete(this.id(namespace,key));await tx.done;}
  async deleteNamespace(namespace:string){const tx=this.db.transaction('values','readwrite');for(const key of await tx.store.index('namespace').getAllKeys(namespace))await tx.store.delete(key);await tx.done;}
  getInstall(id:string){return this.db.get('installs',id);}
  listInstalls(){return this.db.getAll('installs');}
  async lastGeneration(id:string){return await this.db.get('generations',id)??0;}
  async mutateInstall(id:string,mutate:(old:InstalledPlugin|undefined)=>InstalledPlugin|undefined){
    const tx=this.db.transaction(['installs','generations'],'readwrite');const store=tx.objectStore('installs');const old=await store.get(id);const next=mutate(old);
    if(next){await store.put(next,id);await tx.objectStore('generations').put(Math.max(next.generation,await tx.objectStore('generations').get(id)??0),id);}else{await store.delete(id);if(old)await tx.objectStore('generations').put(old.generation+1,id);}await tx.done;return next;
  }
  getArtifact(digest:string){return this.db.get('artifacts',digest);}
  putArtifact(digest:string,value:unknown){return this.db.put('artifacts',value,digest);}
  getJournal(id:string){return this.db.get('journal',id);}
  async putJournal(id:string,value:unknown,guard?:{name:string;owner:string;fence:number}){const tx=this.db.transaction(['journal','leases'],'readwrite');if(guard){const lease=await tx.objectStore('leases').get(guard.name);if(!lease||lease.owner!==guard.owner||lease.fence!==guard.fence||lease.expires<=Date.now()){tx.abort();throw new PlatformError('stale-fence');}}await tx.objectStore('journal').put(value,id);await tx.done;}
  deleteJournal(id:string){return this.db.delete('journal',id);}
  listJournals(){return this.db.getAllKeys('journal');}
  async failInstall(id:string,guard:{name:string;owner:string;fence:number},frozenRevision?:number){const tx=this.db.transaction(['journal','leases','installs','generations'],'readwrite');const lease=await tx.objectStore('leases').get(guard.name),journal=await tx.objectStore('journal').get(id);if(lease?.owner===guard.owner&&lease.fence===guard.fence&&typeof journal==='object'&&journal&&'fence'in journal&&journal.fence===guard.fence){const install=await tx.objectStore('installs').get(id);if(install?.state==='updating'&&install.revision===frozenRevision){const next={...install,state:'ready',enabled:true,generation:install.generation+1,revision:install.revision+1};await tx.objectStore('installs').put(next,id);await tx.objectStore('generations').put(next.generation,id);}await tx.objectStore('journal').delete(id);}await tx.done;}
  async freezeInstall(id:string,guard:{name:string;owner:string;fence:number},expectedRevision:number){const tx=this.db.transaction(['installs','generations','leases','journal'],'readwrite');const current=await tx.objectStore('installs').get(id),lease=await tx.objectStore('leases').get(guard.name),journal=await tx.objectStore('journal').get(id);if(!current||current.revision!==expectedRevision||lease?.owner!==guard.owner||lease.fence!==guard.fence||lease.expires<=Date.now()||typeof journal!=='object'||!journal||!('fence'in journal)||journal.fence!==guard.fence){tx.abort();throw new PlatformError('stale-fence');}const next={...current,state:'updating',enabled:false,generation:current.generation+1,revision:current.revision+1};await tx.objectStore('installs').put(next,id);await tx.objectStore('generations').put(next.generation,id);await tx.done;return next;}
  async recoverJournals(now=Date.now()){const tx=this.db.transaction(['journal','leases','installs','generations'],'readwrite');for(const id of await tx.objectStore('journal').getAllKeys()){const lease=await tx.objectStore('leases').get(`install/${id}`);if(!lease||lease.expires<=now){const install=await tx.objectStore('installs').get(id);if(install?.state==='updating'){const next={...install,enabled:true,state:'ready',generation:install.generation+1,revision:install.revision+1};await tx.objectStore('installs').put(next,id);await tx.objectStore('generations').put(next.generation,id);}await tx.objectStore('journal').delete(id);}}await tx.done;}
  async acquireLease(name:string,owner:string,now=Date.now(),duration=10000):Promise<Lease>{
    const tx=this.db.transaction('leases','readwrite');const old=await tx.store.get(name);
    if(old&&old.expires>now&&old.owner!==owner){tx.abort();throw new PlatformError('busy');}
    const lease={owner,fence:(old?.fence??0)+1,expires:now+duration};await tx.store.put(lease,name);await tx.done;return lease;
  }
  async commitInstall(id:string,next:InstalledPlugin,lease:{name:string;owner:string;fence:number},expectedRevision:number,replacement?:DataReplacement){
    const records=replacement?this.backupRecords(replacement.namespace,replacement.backup,replacement.quota):undefined;
    const tx=this.db.transaction(['installs','leases','journal','generations','values'],'readwrite');const current=await tx.objectStore('leases').get(lease.name);
    const old=await tx.objectStore('installs').get(id);
    if(!current||current.owner!==lease.owner||current.fence!==lease.fence||current.expires<=Date.now()||(old?.revision??0)!==expectedRevision||next.generation<=Math.max(old?.generation??0,await tx.objectStore('generations').get(id)??0)){tx.abort();throw new PlatformError('stale-fence');}
    if(replacement&&records){for(const key of await tx.objectStore('values').index('namespace').getAllKeys(replacement.namespace))await tx.objectStore('values').delete(key);for(const record of records)await tx.objectStore('values').put(record);}
    await tx.objectStore('installs').put(next,id);await tx.objectStore('generations').put(next.generation,id);await tx.objectStore('journal').delete(id);await tx.done;
  }
  async releaseLease(name:string,owner:string,fence:number){const tx=this.db.transaction('leases','readwrite');const lease=await tx.store.get(name);if(lease?.owner===owner&&lease.fence===fence){lease.expires=0;await tx.store.put(lease,name);}await tx.done;}
  async exportNamespace(namespace:string){return JSON.stringify({format:'pwacloud.backup.v1',namespace,records:await this.list(namespace)},null,2);}
  async restoreNamespace(namespace:string,text:string,quota:number){
    const records=this.backupRecords(namespace,text,quota);
    const tx=this.db.transaction('values','readwrite');for(const key of await tx.store.index('namespace').getAllKeys(namespace))await tx.store.delete(key);
    for(const record of records)await tx.store.put(record);await tx.done;
  }
  async operationOnce<T>(key:string,perform:()=>Promise<T>):Promise<T>{
    const tx=this.db.transaction('operations','readwrite');const old=await tx.store.get(key);
    if(old!==undefined){tx.abort();throw new PlatformError('operation-already-admitted');}
    await tx.store.put({status:'admitted'},key);await tx.done;
    const result=await perform();await this.db.put('operations',{status:'completed',result},key);return result;
  }
}
