import {mkdir,readFile,writeFile} from 'node:fs/promises';
const original=JSON.parse(await readFile('artifacts/private-evidence/M3/public-release-browser-results.json','utf8')) as unknown;const workspace=process.cwd();await mkdir('evidence/M3',{recursive:true});
await writeFile('evidence/M3/public-release-browser-results.json',JSON.stringify(original,(_key,value:unknown)=>typeof value==='string'?value.replaceAll(process.execPath,'<node-runtime>/node.exe').replaceAll(workspace,'<workspace>').replaceAll(workspace.replaceAll('\\','/'),'<workspace>'):value,2));
