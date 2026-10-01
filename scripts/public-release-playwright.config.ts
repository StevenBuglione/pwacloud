import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const origin=process.env.PWACLOUD_PUBLIC_RUNTIME_ORIGIN,tag=process.env.PWACLOUD_EXPECTED_PUBLIC_TAG,commit=process.env.PWACLOUD_EXPECTED_PUBLIC_COMMIT,hostCommit=process.env.PWACLOUD_EXPECTED_HOST_COMMIT;
if(!origin||!tag||!commit||!hostCommit)throw new Error('Public release verification requires an existing personal runtime origin and reviewed public tag/source/host commits.');
const url=new URL(origin);if(url.origin!==origin||url.protocol!=='https:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.username||url.password)throw new Error('Public release verification uses an exact controlled loopback HTTPS runtime origin.');
if(!/^plugin-v[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/.test(tag)||!/^[a-f0-9]{40}$/.test(commit)||!/^[a-f0-9]{40}$/.test(hostCommit))throw new Error('Expected release tag and exact source/host commits are invalid.');
process.env.PLAYWRIGHT_BROWSERS_PATH??=resolve('.cache/browsers');
export default defineConfig({testDir:'../tests/public-release',timeout:180000,workers:1,retries:0,fullyParallel:false,metadata:{publicRunId:randomUUID()},
  reporter:[['list'],['json',{outputFile:resolve('artifacts/private-evidence/M3/public-release-browser-results.json')}]],
  use:{baseURL:origin,viewport:{width:360,height:800},ignoreHTTPSErrors:process.env.PWACLOUD_PUBLIC_ALLOW_SELF_SIGNED==='1',trace:'off',video:'off',screenshot:'off'},
  projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}]});
