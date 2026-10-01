import { ProviderError } from './schema.ts';

export type SseFrame=Readonly<{event:string;data:string;id:string}>;
/** Frames incrementally decoded UTF-8; EOF cannot manufacture a terminal event. */
export class SseParser {
  private readonly decoder=new TextDecoder('utf-8',{fatal:true});
  private line=''; private data:string[]=[]; private name=''; private id='';
  private skipLf=false; private closed=false; private size=0;
  constructor(private readonly maximumBytes=262144) {}
  push(bytes:Uint8Array):SseFrame[] {
    if(this.closed)throw new ProviderError('interrupted','Stream already closed.');
    try{return this.consume(this.decoder.decode(bytes,{stream:true}));}
    catch{this.closed=true;throw new ProviderError('interrupted','Malformed or oversized provider stream.');}
  }
  finish():SseFrame[] {
    if(this.closed)throw new ProviderError('interrupted','Stream already closed.');
    this.closed=true;
    const events=this.consume(this.decoder.decode());
    if(this.line||this.data.length||this.name)throw new ProviderError('interrupted','Provider stream ended within an event.');
    return events;
  }
  private consume(value:string):SseFrame[] {
    const events:SseFrame[]=[];
    for(const char of value){
      if(this.skipLf){this.skipLf=false;if(char==='\n')continue;}
      if(char==='\r'||char==='\n'){this.processLine(events);this.skipLf=char==='\r';}
      else{this.line+=char;this.size+=Buffer.byteLength(char);if(this.size>this.maximumBytes)throw new Error('event limit');}
    }
    return events;
  }
  private processLine(events:SseFrame[]):void {
    const line=this.line;this.line='';
    if(line===''){if(this.data.length)events.push({event:this.name||'message',data:this.data.join('\n'),id:this.id});this.data=[];this.name='';this.size=0;return;}
    if(line.startsWith(':'))return;
    const colon=line.indexOf(':');const field=colon<0?line:line.slice(0,colon);
    let value=colon<0?'':line.slice(colon+1);if(value.startsWith(' '))value=value.slice(1);
    if(field==='data')this.data.push(value);else if(field==='event')this.name=value;else if(field==='id'&&!value.includes('\0'))this.id=value;
  }
}
