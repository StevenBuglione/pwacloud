import { Inflate, zipSync } from 'fflate';
import { PlatformError } from '../../contracts/src/index';

export type ArchiveLimits = { compressedBytes:number; expandedBytes:number; fileBytes:number; files:number };
export const ARCHIVE_LIMITS:ArchiveLimits = {compressedBytes:64*1024*1024,expandedBytes:64*1024*1024,fileBytes:20*1024*1024,files:512};
type Entry = {path:string;size:number;compressed:number;crc:number;offset:number;method:number;flags:number};
const decoder = new TextDecoder('utf-8',{fatal:true});
export function safePath(path:string):string {
  if(path.length===0 || path.length>240 || /[\\\x00-\x1f\x7f:]/u.test(path) || path.startsWith('/') || path.endsWith('/') || path.normalize('NFC')!==path || path.split('/').some(p=>!p || p==='.' || p==='..' || ['__proto__','prototype','constructor'].includes(p)) || /\.(?:zip|tar|tgz|gz|jar|7z|rar|exe|dll|so|dylib|bat|cmd|ps1)$/i.test(path)) throw new PlatformError('unsafe-archive-path');
  return path;
}
function fail():never {throw new PlatformError('invalid-archive');}
export function inspectArchive(bytes:Uint8Array,limits:ArchiveLimits=ARCHIVE_LIMITS):Entry[] {
  if(bytes.length<22 || bytes.length>limits.compressedBytes) throw new PlatformError('archive-budget');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const end=bytes.length-22;
  if(view.getUint32(end,true)!==0x06054b50 || view.getUint16(end+20,true)!==0 || view.getUint16(end+4,true)!==0 || view.getUint16(end+6,true)!==0) fail();
  const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true),start=view.getUint32(end+16,true);
  if(count===0 || count>limits.files || view.getUint16(end+8,true)!==count || start+size!==end) throw new PlatformError('archive-budget');
  const entries:Entry[]=[],names=new Set<string>(); let cursor=start,expanded=0,localCursor=0;
  for(let i=0;i<count;i++) {
    if(cursor+46>end || view.getUint32(cursor,true)!==0x02014b50) fail();
    const nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true);
    if(cursor+46+nameLength+extraLength+commentLength>end || extraLength!==0 || commentLength!==0 || view.getUint16(cursor+34,true)!==0) fail();
    let path:string; try {path=safePath(decoder.decode(bytes.subarray(cursor+46,cursor+46+nameLength)));} catch {throw new PlatformError('unsafe-archive-path');}
    const normalized=path.toLowerCase(); if(names.has(normalized)) throw new PlatformError('duplicate-archive-path'); names.add(normalized);
    const mode=view.getUint32(cursor+38,true)>>>16,type=mode&0xf000;
    if(type!==0 && type!==0x8000) throw new PlatformError('archive-special-file');
    if((view.getUint32(cursor+38,true)&0x10)!==0) throw new PlatformError('archive-special-file');
    const entry:Entry={path,size:view.getUint32(cursor+24,true),compressed:view.getUint32(cursor+20,true),crc:view.getUint32(cursor+16,true),offset:view.getUint32(cursor+42,true),method:view.getUint16(cursor+10,true),flags:view.getUint16(cursor+8,true)};
    if(entry.flags!==0 && entry.flags!==0x800 || ![0,8].includes(entry.method)) fail();
    if(entry.size>limits.fileBytes || entry.compressed>limits.compressedBytes || (expanded+=entry.size)>limits.expandedBytes) throw new PlatformError('archive-budget');
    if(entry.offset!==localCursor || entry.offset+30>start || view.getUint32(entry.offset,true)!==0x04034b50) fail();
    const localName=view.getUint16(entry.offset+26,true),localExtra=view.getUint16(entry.offset+28,true);
    if(localExtra!==0 || localName!==nameLength || entry.offset+30+localName+entry.compressed>start) fail();
    const localPath=decoder.decode(bytes.subarray(entry.offset+30,entry.offset+30+localName));
    if(localPath!==path || view.getUint16(entry.offset+6,true)!==entry.flags || view.getUint16(entry.offset+8,true)!==entry.method || view.getUint32(entry.offset+14,true)!==entry.crc || view.getUint32(entry.offset+18,true)!==entry.compressed || view.getUint32(entry.offset+22,true)!==entry.size) fail();
    if(entry.method===0 && entry.compressed!==entry.size) fail();
    localCursor=entry.offset+30+localName+entry.compressed; entries.push(entry); cursor+=46+nameLength;
  }
  if(cursor!==end || localCursor!==start) fail(); return entries;
}
function crc32(bytes:Uint8Array):number {
  let crc=0xffffffff; for(const byte of bytes) {crc^=byte; for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);} return (crc^0xffffffff)>>>0;
}
export function unpackArchive(bytes:Uint8Array,limits:ArchiveLimits=ARCHIVE_LIMITS):Record<string,Uint8Array> {
  const entries=inspectArchive(bytes,limits),files:Record<string,Uint8Array>={};let expanded=0;
  for(const entry of entries) {
    const start=entry.offset+30+new TextEncoder().encode(entry.path).length,compressed=bytes.subarray(start,start+entry.compressed);let file:Uint8Array;
    if(entry.method===0) {file=compressed.slice();expanded+=file.length;} else {
      const chunks:Uint8Array[]=[];let size=0,completed=false;
      const inflate=new Inflate((chunk,final)=>{size+=chunk.length;expanded+=chunk.length;if(size>entry.size || size>limits.fileBytes || expanded>limits.expandedBytes) throw new PlatformError('archive-budget');chunks.push(chunk.slice());completed=final;});
      try {for(let offset=0;offset<compressed.length;offset+=256) inflate.push(compressed.subarray(offset,offset+256),offset+256>=compressed.length);} catch(error) {if(error instanceof PlatformError) throw error;fail();}
      if(!completed) fail();file=new Uint8Array(size);let offset=0;for(const chunk of chunks) {file.set(chunk,offset);offset+=chunk.length;}
    }
    if(file.length!==entry.size || expanded>limits.expandedBytes || crc32(file)!==entry.crc) fail();files[entry.path]=file;
  }
  return files;
}
export function packArchive(files:Record<string,Uint8Array>):Uint8Array {
  const names=Object.keys(files).sort(); const input:Record<string,[Uint8Array,{level:0;mtime:Date}]> = {};
  const seen=new Set<string>();
  for(const name of names) {safePath(name); if(seen.has(name.toLowerCase())) throw new PlatformError('duplicate-archive-path'); seen.add(name.toLowerCase()); const file=files[name]; if(!file) fail(); input[name]=[file,{level:0,mtime:new Date(1980,0,1,0,0,0)}];}
  const bytes=zipSync(input,{level:0}); inspectArchive(bytes); return bytes;
}
