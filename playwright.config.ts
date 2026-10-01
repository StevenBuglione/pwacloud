import { defineConfig } from '@playwright/test';
import {resolve} from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.cache/browsers');
export default defineConfig({testDir:'tests/e2e',timeout:30000,fullyParallel:false,workers:1,retries:0,
  reporter:[['list'],['json',{outputFile:'evidence/browser-results.json'}]],
  use:{baseURL:'http://127.0.0.1:4173',viewport:{width:360,height:800},trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}],
  webServer:{command:process.env.PWACLOUD_SPIKES?'pnpm exec tsx scripts/spike-server.ts':'pnpm start',url:'http://127.0.0.1:4173/health',reuseExistingServer:!process.env.CI,env:{PWACLOUD_MODE:'demo',PWACLOUD_PORT:'4173',PWACLOUD_DATA:'runtime-data/browser-test'}}
});
