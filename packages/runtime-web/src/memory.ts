import {PlatformError} from '../../contracts/src/errors.ts';
/** Validate the MVP32 memory declarations of already validated core Wasm. Other memory profiles fail closed. */
export function coreMemoryMaximum(bytes:Uint8Array):number{
  if(bytes.length<8||Array.from(bytes.slice(0,8)).join(',')!=='0,97,115,109,1,0,0,0')throw new PlatformError('invalid-core-module');let cursor=8,total=0;
  function uint(end=bytes.length):number{let value=0,shift=0;for(let i=0;i<5;i++){if(cursor>=end)throw new PlatformError('invalid-core-module');const byte=bytes[cursor++]!;value+=(byte&127)*2**shift;if(!(byte&128)){if(value>4294967295)throw new PlatformError('invalid-core-module');return value;}shift+=7;}throw new PlatformError('invalid-core-module');}
  while(cursor<bytes.length){const section=bytes[cursor++]!,length=uint(),end=cursor+length;if(end>bytes.length)throw new PlatformError('invalid-core-module');
    if(section===5){const count=uint(end);if(count>16)throw new PlatformError('memory-budget');for(let n=0;n<count;n++){const flags=uint(end);if(flags!==1)throw new PlatformError('unsupported-memory');const initial=uint(end),maximum=uint(end);if(initial>maximum||maximum>65536)throw new PlatformError('memory-budget');total+=maximum*65536;}if(cursor!==end)throw new PlatformError('invalid-core-module');}
    cursor=end;
  }
  return total;
}
