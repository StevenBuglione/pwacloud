/** Report gate only. Artifact capture, hashes, provenance and human review are separate obligations. */
import {safeArchivePath} from './integrity.ts';
export type Requirement = Readonly<{
 id:string;requiredFor:readonly string[];requiresRealProvider:boolean;requiresPhysicalDevice:boolean;
 requiresExternalAuthorization:boolean;deviceClass:string;
}>;
export type EvidenceCase = Readonly<{
 caseId:string;status:string;commit:string;testedAt:string;
 environment:{runtime:string;provider:string;physicalDevice:boolean;deviceClass:string;details:string};
 steps:readonly string[];observed:string;artifacts:readonly {path:string;sha256:string}[];
 reviewer:string|null;externalAuthorizationVerified:boolean;
}>;
export type Report = Readonly<{version:number;target:string;commit:string;cases:readonly EvidenceCase[]}>;
export function evidenceProblems(requirements:readonly Requirement[],report:Report,expectedCommit:string,now=Date.now()):string[] {
 const errors:string[]=[];
 if(!/^[0-9a-f]{40}$/.test(expectedCommit)||/^0+$/.test(expectedCommit))errors.push('INVALID_EXPECTED_COMMIT');
 if(report.version!==1 || !['local-alpha','hosted'].includes(report.target))errors.push('INVALID_REPORT');
 if(report.commit!==expectedCommit)errors.push('REPORT_COMMIT_MISMATCH');
 const required=requirements.filter(r=>r.requiredFor.includes(report.target));
 const seen=new Set<string>();
 for(const row of report.cases){
  if(seen.has(row.caseId))errors.push('DUPLICATE:'+row.caseId);seen.add(row.caseId);
  if(!requirements.some(r=>r.id===row.caseId))errors.push('UNKNOWN_CASE:'+row.caseId);
 }
 for(const req of required){
  const e=report.cases.find(row=>row.caseId===req.id);
  const fail=(why:string)=>errors.push(req.id+':'+why);
  if(!e){fail('MISSING');continue;}
  if(e.status!=='passed')fail('NOT_PASSED');
  if(e.commit!==expectedCommit)fail('COMMIT_MISMATCH');
  const timestamp=Date.parse(e.testedAt);
  if(!Number.isFinite(timestamp)||!e.testedAt.endsWith('Z')||timestamp>now)fail('INVALID_TIME');
  if(!e.environment.runtime.trim()||!e.environment.details.trim()||!e.steps.length||e.steps.some(s=>!s.trim())||!e.observed.trim())fail('MISSING_OBSERVATION');
  if(req.requiresRealProvider && e.environment.provider!=='real')fail('REAL_PROVIDER_REQUIRED');
  if(req.requiresPhysicalDevice && !e.environment.physicalDevice)fail('PHYSICAL_DEVICE_REQUIRED');
  if(req.requiresPhysicalDevice && req.deviceClass!=='any' && req.deviceClass!==e.environment.deviceClass)fail('WRONG_DEVICE');
  if(req.requiresExternalAuthorization && !e.externalAuthorizationVerified)fail('AUTHORIZATION_REQUIRED');
  if((req.requiresPhysicalDevice||req.requiresRealProvider||req.requiresExternalAuthorization)&&!e.reviewer?.trim())fail('REVIEWER_REQUIRED');
  if(!e.artifacts.length)fail('ARTIFACT_REQUIRED');
  if(e.artifacts.some(a=>!safeArchivePath(a.path)||!/^([0-9a-f]{64})$/.test(a.sha256)||/^0+$/.test(a.sha256)))fail('INVALID_ARTIFACT');
 }
 return errors;
}
