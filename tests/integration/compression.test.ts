import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {gunzipSync,brotliDecompressSync} from 'node:zlib';
import {createRuntime} from '../../apps/personal-runtime/src/index.ts';
test('production server negotiates real compressed critical assets with exact decoded bytes under transfer budgets',async()=>{
 const runtime=await createRuntime();try{
  const names=(await readdir('dist/shell/assets')).filter(name=>/\.(?:js|css)$/.test(name));let total=0,js=0;const records=[];
  for(const name of names){const expected=await readFile('dist/shell/assets/'+name);for(const encoding of ['gzip','br']){const response=await runtime.app.inject({url:'/assets/'+name,headers:{'accept-encoding':encoding}});assert.equal(response.statusCode,200);assert.equal(response.headers['content-encoding'],expected.length>=1024?encoding:undefined);assert.match(String(response.headers.vary),/Accept-Encoding/i);assert.deepEqual(response.headers['content-encoding']?(encoding==='gzip'?gunzipSync(response.rawPayload):brotliDecompressSync(response.rawPayload)):response.rawPayload,expected);if(encoding==='gzip'){total+=response.rawPayload.length;if(name.endsWith('.js'))js+=response.rawPayload.length;records.push({path:'/assets/'+name,encoding:response.headers['content-encoding']??'identity',transferredBytes:response.rawPayload.length,decodedBytes:expected.length});}}}
  assert.ok(js<=450*1024,`Critical JS transfer ${js} exceeds450KiB`);assert.ok(total<=1048576,`Critical assets transfer ${total} exceeds1MiB`);
  await mkdir('evidence/M9',{recursive:true});await writeFile('evidence/M9/production-transfer.json',JSON.stringify({environment:'Actual Fastify production HTTP compression negotiation, synthetic request, desktop build; physical network remains unverified',jsGzipBytes:js,criticalAssetsGzipBytes:total,assets:records},null,2));
 }finally{await runtime.close();}
});
