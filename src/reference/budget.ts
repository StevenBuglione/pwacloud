/** In-memory reference admission. Production uses a durable transaction and grants rechecked per invocation. */
export type Admission = Readonly<{kind:'admitted'|'existing';id:string}>;
export class RequestBudget {
  private windowStart: number; private count=0; private active=new Set<string>(); private seen=new Set<string>();
  private lastNow: number; private readonly limit: number; private readonly concurrency: number; private readonly windowMs: number;
  constructor(limit:number,concurrency:number,now:number,windowMs=3600000) {
    if (![limit,concurrency,windowMs].every(n=>Number.isSafeInteger(n)&&n>0) || !Number.isFinite(now)) throw new Error('INVALID_BUDGET');
    this.limit=limit;this.concurrency=concurrency;this.windowMs=windowMs;this.windowStart=now;this.lastNow=now;
  }
  admit(id:string,now:number): Admission {
    if (!id || id.length>128) throw new Error('INVALID_ID');
    if (!Number.isFinite(now) || now<this.lastNow) throw new Error('NON_MONOTONIC_CLOCK');
    this.lastNow=now;
    if (this.seen.has(id)) return {kind:'existing',id};
    if (now-this.windowStart>=this.windowMs) {this.windowStart=now;this.count=0;}
    if (this.active.size>=this.concurrency) throw new Error('CONCURRENCY_LIMIT');
    if (this.count>=this.limit) throw new Error('REQUEST_LIMIT');
    this.count++;this.active.add(id);this.seen.add(id);return {kind:'admitted',id};
  }
  complete(id:string): boolean { return this.active.delete(id); }
  snapshot(): Readonly<{count:number;active:number;windowStart:number}> {return {count:this.count,active:this.active.size,windowStart:this.windowStart};}
}
