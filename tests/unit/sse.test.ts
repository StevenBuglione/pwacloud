import test from 'node:test';import assert from 'node:assert/strict';import {SseParser} from '../../src/reference/sse.ts';
const enc=new TextEncoder();
test('SSE basic fields',()=>{const p=new SseParser();assert.deepEqual(p.push(enc.encode('id: 1\nevent: delta\ndata: hello\n\n')),[{id:'1',event:'delta',data:'hello'}]);assert.deepEqual(p.finish(),[]);});
test('all possible chunk splits including UTF-8',()=>{
 const bytes=enc.encode('id: 3\r\nevent: delta\r\ndata: A💡é\r\ndata: B\r\n\r\n');
 for(let split=0;split<=bytes.length;split++){
  const p=new SseParser();const rows=[...p.push(bytes.slice(0,split)),...p.push(bytes.slice(split)),...p.finish()];
  assert.deepEqual(rows,[{id:'3',event:'delta',data:'A💡é\nB'}]);
 }
});
test('byte-by-byte split',()=>{const p=new SseParser();const rows=[];for(const b of enc.encode('data: 💡\n\n'))rows.push(...p.push(new Uint8Array([b])));assert.equal(rows[0]?.data,'💡');p.finish();});
test('CR-only line endings',()=>assert.equal(new SseParser().push(enc.encode('data: x\r\r'))[0]?.data,'x'));
test('comments and id inheritance',()=>{const p=new SseParser();assert.deepEqual(p.push(enc.encode(':hi\nid: 9\ndata: first\n\ndata: second\n\n')).map(e=>e.id),['9','9']);});
test('invalid UTF-8 throws',()=>assert.throws(()=>new SseParser().push(new Uint8Array([255]))));
test('truncated UTF-8 throws',()=>{const p=new SseParser();p.push(new Uint8Array([240]));assert.throws(()=>p.finish());});
test('unterminated data fails',()=>{const p=new SseParser();p.push(enc.encode('data: partial\n'));assert.throws(()=>p.finish(),/TRUNCATED/);});
test('size cap and fail-closed parser',()=>{const p=new SseParser(8);assert.throws(()=>p.push(enc.encode('data: too long')),/EVENT_LIMIT/);assert.throws(()=>p.push(enc.encode('\n\n')),/CLOSED/);});
test('size cap resets across events',()=>assert.equal(new SseParser(8).push(enc.encode('data: x\n\ndata: y\n\n')).length,2));
test('finish closes parser',()=>{const p=new SseParser();p.finish();assert.throws(()=>p.push(enc.encode('data: x\n\n')),/CLOSED/);});
