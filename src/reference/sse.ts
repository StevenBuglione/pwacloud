/** Incremental SSE framing with UTF-8 validation and a bounded current event. No HTTP or provider calls. */
export type SseEvent = Readonly<{event:string;data:string;id:string}>;
export class SseParser {
  private decoder = new TextDecoder('utf-8',{fatal:true});
  private line = ''; private data: string[] = []; private name = ''; private id = '';
  private skipLf = false; private closed = false; private chars = 0;
  private readonly maxChars: number;
  constructor(maxChars = 256*1024) {
    if (!Number.isSafeInteger(maxChars) || maxChars < 1) throw new Error('INVALID_LIMIT');
    this.maxChars = maxChars;
  }
  push(bytes: Uint8Array): SseEvent[] {
    if (this.closed) throw new Error('STREAM_CLOSED');
    try { return this.consume(this.decoder.decode(bytes,{stream:true})); }
    catch(error) { this.closed=true; throw error; }
  }
  finish(): SseEvent[] {
    if (this.closed) throw new Error('STREAM_CLOSED');
    this.closed = true;
    const events = this.consume(this.decoder.decode());
    if (this.line || this.data.length || this.name) throw new Error('TRUNCATED_EVENT');
    return events;
  }
  private consume(text: string): SseEvent[] {
    const events:SseEvent[]=[];
    for (const char of text) {
      if (this.skipLf) { this.skipLf=false; if (char === '\n') continue; }
      if (char === '\r' || char === '\n') {
        this.processLine(events); this.skipLf=char==='\r';
      } else {
        this.line += char; this.chars += char.length;
        if (this.chars > this.maxChars) throw new Error('EVENT_LIMIT');
      }
    }
    return events;
  }
  private processLine(events: SseEvent[]): void {
    const line=this.line; this.line='';
    if (line === '') {
      if (this.data.length) events.push({event:this.name||'message',data:this.data.join('\n'),id:this.id});
      this.data=[];this.name='';this.chars=0;return;
    }
    if (line.startsWith(':')) return;
    const colon=line.indexOf(':');const field=colon<0?line:line.slice(0,colon);
    let value=colon<0?'':line.slice(colon+1);if(value.startsWith(' ')) value=value.slice(1);
    if(field==='data') this.data.push(value);
    else if(field==='event') this.name=value;
    else if(field==='id' && !value.includes('\0')) this.id=value;
  }
}
