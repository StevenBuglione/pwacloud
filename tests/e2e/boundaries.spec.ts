import {test,expect} from '@playwright/test';
import {z} from 'zod';
test('APP-04 RUN-01 RUN-02 RUN-04 actual storage and worker boundaries',async({page})=>{
 const requests:{url:string;method:string;cookie:string|undefined;authorization:string|undefined}[]=[];
 for(const origin of ['effects','denied'])await page.route(`https://${origin}.pwacloud.test/**`,async route=>{
  const request=route.request(),headers=request.headers();requests.push({url:request.url(),method:request.method(),cookie:headers.cookie,authorization:headers.authorization});
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({source:'controlled-https-fixture',value:'guest-http-result'})});
 });
 await page.goto('/spikes/storage.html');await page.getByRole('button',{name:'Run storage boundaries'}).click();await expect(page.locator('#status')).toContainText('PASS: IndexedDB');
 await expect(page.locator('#status')).toContainText('real guest storage and HTTP effect completions');
 await expect(page.locator('#status')).toContainText('HTTP origin/path denial, cross-instance revocation');
 await expect(page.locator('#status')).toContainText('APP-04 installed plugin namespace isolation and selected-handle revocation');
 expect(requests).toEqual([{url:'https://effects.pwacloud.test/allowed/data',method:'GET',cookie:undefined,authorization:undefined}]);
});
test('RUN-04 actual two-page leader replacement restores real guest checkpoint without external replay',async({page,context})=>{
 const database='multitab-'+crypto.randomUUID();await page.goto(`/spikes/storage.html?mode=lease-leader&database=${database}`);await page.getByRole('button',{name:'Run storage boundaries'}).click();
 await expect(page.locator('#status')).toContainText('WAITING: actual page-one leader');const expires=Number(await page.locator('#status').getAttribute('data-expires'));expect(Number.isSafeInteger(expires)).toBe(true);
 await page.waitForTimeout(Math.max(0,expires-Date.now()+50));
 const replacement=await context.newPage();await replacement.goto(`/spikes/storage.html?mode=lease-replacement&database=${database}`);await replacement.getByRole('button',{name:'Run storage boundaries'}).click();
 await expect(replacement.locator('#status')).toContainText('PASS: fresh real Wasm Worker restored persisted words and characters');
 const restoreRaw=await replacement.locator('#status').getAttribute('data-observation');if(!restoreRaw)throw new Error('No real checkpoint observation');z.strictObject({words:z.literal(4),characters:z.literal('checkpoint survives leader replacement'.length),externalWrites:z.literal(1),restoredBytes:z.number().int().positive()}).parse(JSON.parse(restoreRaw));
 await page.evaluate(()=>window.dispatchEvent(new Event('verify-stale-leader')));await expect(page.locator('#status')).toContainText('PASS: actual second-page leader replacement increased fence');
 const raw=await page.locator('#status').getAttribute('data-observation');if(!raw)throw new Error('No actual multi-page fence observation');const observation=z.strictObject({oldFence:z.number().int().positive(),newFence:z.number().int().positive(),staleCommitDenied:z.literal(true),generation:z.literal(2)}).parse(JSON.parse(raw));expect(observation.newFence).toBeGreaterThan(observation.oldFence);await replacement.close();
});
test('RUN-03 inactive installed host and production scheduler bound actual Wasm Workers',async({page})=>{
 const requests:{url:string;at:number}[]=[];page.on('request',request=>{requests.push({url:request.url(),at:Date.now()});});
 await page.goto('/spikes/storage.html?mode=scheduler');await page.getByRole('button',{name:'Run storage boundaries'}).click();
 await expect(page.locator('#status')).toContainText('PASS: inactive installed host',{timeout:15000});
 const raw=await page.locator('#status').getAttribute('data-observation');if(!raw)throw new Error('No actual Worker observation');
 const observation=z.strictObject({idleStart:z.number(),idleEnd:z.number(),idleFetches:z.literal(0),idleWorkers:z.literal(0),peakWorkers:z.literal(2),createdWorkers:z.literal(3),completedGuestCalls:z.literal(3),started:z.tuple([z.literal(0),z.literal(1),z.literal(2)]),cancelledWorkerCreated:z.literal(false)}).parse(JSON.parse(raw));
 expect(observation.idleEnd-observation.idleStart).toBeGreaterThanOrEqual(700);
 expect(requests.filter(request=>request.at>=observation.idleStart&&request.at<observation.idleEnd)).toEqual([]);
 await expect(page.locator('iframe')).toHaveCount(0);
});
