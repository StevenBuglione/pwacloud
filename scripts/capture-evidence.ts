/** Capture honest current-commit observations. This does not approve an alpha release. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import type {EvidenceCase,Report} from '../src/reference/evidence.ts';

const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const runId=process.argv[2];if(!runId||!/^\d+$/.test(runId))throw new Error('Pass a completed verification Actions run ID.');
const ci=JSON.parse(execFileSync('gh',['run','view',runId,'--repo','StevenBuglione/pwacloud','--json','status,conclusion,headSha,url,createdAt,updatedAt'],{encoding:'utf8'})) as {status:string;conclusion:string;headSha:string;url:string};
if(ci.status!=='completed'||ci.conclusion!=='success'||ci.headSha!==commit)throw new Error('CI must have succeeded on the exact current commit.');
writeFileSync('evidence/M10/ci-current.json',JSON.stringify(ci,null,2)+'\n');
const local=JSON.parse(readFileSync('evidence/M10/local-verification.json','utf8')) as {commit:string;exitCode:number;finishedAt:string};
const build=JSON.parse(readFileSync('dist/shell/build-info.json','utf8')) as {sourceCommit:string;changedSource:string[]};
if(local.commit!==commit||local.exitCode!==0||build.sourceCommit!==commit||build.changedSource.length)throw new Error('Local production verification must succeed against this clean source commit.');
const browser=JSON.parse(readFileSync('evidence/browser-results.json','utf8')) as {stats:{expected:number;unexpected:number;flaky:number;skipped:number}};
if(browser.stats.expected<44||browser.stats.unexpected||browser.stats.flaky||browser.stats.skipped)throw new Error('Complete default browser suite must pass without retries or skips.');
const publicReport=JSON.parse(readFileSync('evidence/M3/public-install-results.json','utf8')) as {hostCommit:string;status:string;results:{status:string}[]};
if(publicReport.hostCommit!==commit||publicReport.status!=='passed'||publicReport.results.length!==2||publicReport.results.some(result=>result.status!=='passed'))throw new Error('Both actual public installation browser checks must pass against this host commit.');
const requirements=(JSON.parse(readFileSync('planning/acceptance-cases.json','utf8')) as {cases:{id:string;milestone:string;title:string;passCriterion:string;requiresRealProvider:boolean;requiresPhysicalDevice:boolean;requiresExternalAuthorization:boolean}[]}).cases;
const blocked:Record<string,string>={
 'AI-04':'Real ChatGPT completion requires authorized human sign-in; user selected automated checks for now.',
 'AI-05':'Actual provider cancellation requires a real authorized request; synthetic transport checks do not satisfy it.',
 'AI-09':'Authenticated HTTPS pairing is tested synthetically, but no physical phone was paired.',
 'DEV-01':'Physical iPhone Home Screen, keyboard, Back and app-switch checks were deferred.',
 'DEV-02':'Physical Android PWA, keyboard, Back, offline and permission checks were deferred.',
 'DEV-03':'No physical VoiceOver or TalkBack critical-flow review has been performed.',
 'DEV-04':'Desktop browser measurements cannot establish named phone hardware performance.',
 'DEV-05':'Browser page termination does not establish physical OS eviction and long-background recovery.',
 'REL-02':'Mandatory local-alpha real-provider and physical-device evidence remains incomplete; the release gate must reject it.',
 'REL-03':'A signed public reference-package release is available, but a product-alpha release requires the deferred mandatory gates.',
 'HST-01':'Applicable hosted authorization, credential custody and installed-plugin scope have not been verified.',
 'HST-02':'Hosted mode remains disabled pending verified authorization and real mobile inference.',
 'HST-03':'Hosted terms, tenant isolation and retention cannot be tested as an enabled service while authorization is unresolved.'
};
const artifact=(path:string)=>{if(!existsSync(path))throw new Error('Missing evidence: '+path);return{path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')};};
const common=['evidence/ACCEPTANCE-DISPOSITION.md','evidence/M10/local-verification.json','evidence/M10/ci-current.json','evidence/M10/verify-all-final-output.txt','evidence/browser-results.json'];
const cases:EvidenceCase[]=requirements.map(requirement=>({caseId:requirement.id,status:blocked[requirement.id]?'blocked':'passed',commit,testedAt:local.finishedAt,environment:{runtime:'Windows x64 Node 24.19.0; clean Ubuntu 24.04 Actions; Chromium and WebKit at 360x800',provider:requirement.id.startsWith('AI-')?'synthetic':'none',physicalDevice:false,deviceClass:'desktop',details:'Real Component Model Workers and browser IndexedDB; synthetic user data/provider fixtures. Actual public GitHub/Sigstore/TUF verification is separate. '+ci.url},steps:blocked[requirement.id]?['Record the unmet prerequisite without substituting synthetic or emulator results.']:['Build the actual production shell, independently bundled plugins and Rust component.','Run unit, integration, hostile and both browser suites; inspect the case-specific mapping in ACCEPTANCE-DISPOSITION.md.'],observed:blocked[requirement.id]??('Automated acceptance supported by the concrete implementation and checks mapped for '+requirement.id+'. Criterion: '+requirement.passCriterion),artifacts:[...common,...(requirement.id==='PKG-03'?['evidence/M3/public-install-results.json']:[])].map(artifact),reviewer:null,externalAuthorizationVerified:false}));
const report:Report={version:1,target:'local-alpha',commit,cases};writeFileSync('evidence/release.current.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({commit,passed:cases.filter(row=>row.status==='passed').length,blocked:cases.filter(row=>row.status==='blocked').length,report:'evidence/release.current.json',note:'Mandatory deferred checks remain blocked. Run verify:release with this report to inspect the fail-closed gate.'}));
