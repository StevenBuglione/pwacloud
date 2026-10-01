import ts from 'typescript-compiler-api';
import {readdir,readFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
const errors:string[]=[];
async function check(directory:string){for(const item of await readdir(directory,{withFileTypes:true})){if(['node_modules','generated','target','dist'].includes(item.name))continue;const path=resolve(directory,item.name);if(item.isDirectory()){await check(path);continue;}if(!/\.tsx?$/.test(path))continue;
  const text=await readFile(path,'utf8'),file=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  function walk(node:ts.Node){if(node.kind===ts.SyntaxKind.AnyKeyword)errors.push(`${relative('.',path)}: explicit any`);
    if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)&&directory.includes('packages')&&node.moduleSpecifier.text.includes('/apps/'))errors.push(`${relative('.',path)}: package imports application`);ts.forEachChild(node,walk);}walk(file);
  if(/(?:^|\n)\s*(?:\/\/|\/\*)\s*(?:@ts-(?:ignore|nocheck)|eslint-disable)/.test(text))errors.push(`${relative('.',path)}: suppressed type errors`);
}}
for(const dir of ['packages','apps','examples/plugins','scripts'])await check(dir);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('TypeScript source and package dependency boundary lint passed');
