#!/usr/bin/env node
/** Fail-closed release report gate. Usage: node --experimental-strip-types scripts/verify-evidence.ts report.json */
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,relative,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {evidenceProblems} from '../src/reference/evidence.ts';
import type {Report,Requirement} from '../src/reference/evidence.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
try {
 const file=resolve(root,process.argv[2]||'evidence/release.pending.json');
 const report=JSON.parse(readFileSync(file,'utf8')) as Report;
 const reqs=JSON.parse(readFileSync(resolve(root,'planning/acceptance-cases.json'),'utf8')).cases as Requirement[];
 const git=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
 const expected=git.status===0?git.stdout.trim():'';
 const errors=evidenceProblems(reqs,report,expected);
 for(const item of report.cases){
  for(const artifact of item.artifacts){
   try {
    const path=realpathSync(resolve(root,artifact.path));const rel=relative(root,path);
    if(rel==='..'||rel.startsWith('..'+sep)||rel.startsWith(sep))throw new Error('outside repository');
    const hash=createHash('sha256').update(readFileSync(path)).digest('hex');
    if(hash!==artifact.sha256)errors.push(item.caseId+':ARTIFACT_HASH_MISMATCH:'+artifact.path);
   } catch {errors.push(item.caseId+':ARTIFACT_UNREADABLE:'+artifact.path);}
  }
 }
 if(errors.length){console.error(JSON.stringify({status:'blocked',problems:errors},null,2));process.exitCode=1;}
 else console.log(JSON.stringify({status:'evidence-shape-and-hashes-pass',commit:expected,note:'Does not substitute for trusted CI capture or human review.'},null,2));
} catch(error){console.error('Evidence gate rejected input:',error instanceof Error?error.message:'invalid input');process.exitCode=1;}
