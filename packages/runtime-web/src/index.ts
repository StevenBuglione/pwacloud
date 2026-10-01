import {PlatformError} from '../../contracts/src/index.ts';
export class GuestWorker {
  private worker:Worker;private serial=0;private closed=false;private ready=false;private queue:unknown[]=[];
  private waiting=new Map<number,{resolve:(v:unknown)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  constructor(url:string,private deadline=2000){
    this.worker=new Worker(url,{type:'module'});
    this.worker.onmessage=(e:MessageEvent<unknown>)=>{
      const v=e.data;if(typeof v!=='object'||!v)return;
      if('ready'in v&&v.ready===true){this.ready=true;for(const message of this.queue)this.worker.postMessage(message);this.queue=[];return;}
      if(!('id' in v)||typeof v.id!=='number')return;
      const p=this.waiting.get(v.id);if(!p)return;clearTimeout(p.timer);this.waiting.delete(v.id);
      if('error' in v)p.reject(new PlatformError('guest-failed'));else p.resolve('result' in v?v.result:null);
    };
    this.worker.onerror=()=>this.close('guest-failed');
  }
  call(method:'handle'|'snapshot'|'activate',payload:unknown):Promise<unknown>{
    if(this.closed)return Promise.reject(new PlatformError('cancelled'));
    if(this.waiting.size>=32)return Promise.reject(new PlatformError('quota-exceeded'));
    return new Promise((resolve,reject)=>{const id=++this.serial;const timer=setTimeout(()=>this.close('timeout'),this.deadline);this.waiting.set(id,{resolve,reject,timer});const message={id,method,payload};if(this.ready)this.worker.postMessage(message);else this.queue.push(message);});
  }
  close(code='cancelled'){if(this.closed)return;this.closed=true;this.worker.terminate();for(const p of this.waiting.values()){clearTimeout(p.timer);p.reject(new PlatformError(code));}this.waiting.clear();}
}
