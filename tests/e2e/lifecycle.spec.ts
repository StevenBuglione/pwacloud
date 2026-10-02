import {test,expect} from '@playwright/test';
import {z} from 'zod';
test('PKG-04 signed host revocation policy changed before commit cannot publish pending update',async({page})=>{
 await page.goto('/spikes/lifecycle.html?mode=policy-race');await page.getByRole('button',{name:'Run lifecycle recovery'}).click();await expect(page.locator('#status')).toHaveText('POLICY STALLED: verified update before commit');
 await page.evaluate(()=>window.dispatchEvent(new Event('refresh-revocation-policy')));await expect(page.locator('#status')).toHaveText('PASS: fresh signed revocation policy changed before commit; old verified package and data preserved');
 const raw=await page.locator('#status').getAttribute('data-observation');if(!raw)throw new Error('No real IndexedDB policy race observation');z.strictObject({initialSequence:z.literal(0),currentSequence:z.literal(1),signedCatalogueVerified:z.literal(true),error:z.literal('revoked-package'),oldPointerPreserved:z.literal(true),oldDataPreserved:z.literal(true),journalCleared:z.literal(true)}).parse(JSON.parse(raw));
});
test('RUN-02 RUN-05 actual hanging guest crashes back off and quarantine the installed plugin',async({page})=>{test.setTimeout(25000);await page.goto('/spikes/lifecycle.html?mode=crash');await page.getByRole('button',{name:'Run lifecycle recovery'}).click();await expect(page.locator('#status')).toContainText('PASS: three real hanging Workers',{timeout:20000});await expect(page.locator('iframe')).toHaveCount(0);});
test('PKG-04 UPD-01 UPD-02 UPD-05 RUN-04 actual IndexedDB lifecycle recovery',async({page})=>{await page.goto('/spikes/lifecycle.html');await page.getByRole('button',{name:'Run lifecycle recovery'}).click();await expect(page.locator('#status')).toContainText('PASS: all5 cancellation stages',{timeout:20000});});
test('PKG-04 UPD-02 actual page termination at every journal stage restores the old installation',async({context})=>{
 test.setTimeout(60000);const stages=['staging','artifact','snapshot','migration','commit'];const databases=stages.map(()=>crypto.randomUUID());
 await Promise.all(stages.map(async(stage,index)=>{const page=await context.newPage();await page.goto(`/spikes/lifecycle.html?mode=terminate&stage=${stage}&database=${databases[index]}`);await page.getByRole('button',{name:'Run lifecycle recovery'}).click();await expect(page.locator('#status')).toHaveText('STALLED: '+stage);await page.close();}));
 const clock=await context.newPage();await clock.waitForTimeout(11000);await clock.close();
 await Promise.all(stages.map(async(stage,index)=>{const page=await context.newPage();await page.goto(`/spikes/lifecycle.html?mode=recover&stage=${stage}&database=${databases[index]}`);await page.getByRole('button',{name:'Run lifecycle recovery'}).click();await expect(page.locator('#status')).toHaveText('PASS: actual page termination '+stage);await page.close();}));
});
test('PKG-04 actual offline transition at all five journal stages preserves a verified install and data',async({context})=>{
 test.setTimeout(60000);const stages=['staging','artifact','snapshot','migration','commit'] as const,pages=await Promise.all(stages.map(()=>context.newPage()));
 try{
  await Promise.all(stages.map(async(stage,index)=>{const page=pages[index]!;await page.goto(`/spikes/lifecycle.html?mode=offline&stage=${stage}&database=offline-${crypto.randomUUID()}`);await page.getByRole('button',{name:'Run lifecycle recovery'}).click();await expect(page.locator('#status')).toHaveText('OFFLINE STALLED: '+stage);}));
  const expires=await Promise.all(pages.map(async page=>z.coerce.number().int().positive().parse(await page.locator('#status').getAttribute('data-expires'))));
  await context.setOffline(true);for(const page of pages)expect(await page.evaluate(()=>navigator.onLine)).toBe(false);
  await pages[0]!.waitForTimeout(Math.max(0,Math.max(...expires)-Date.now()+100));
  await Promise.all(stages.map(async(stage,index)=>{const page=pages[index]!;await page.evaluate(()=>window.dispatchEvent(new Event('recover-offline')));await expect(page.locator('#status')).toHaveText('PASS: actual offline journal recovery '+stage,{timeout:15000});const raw=await page.locator('#status').getAttribute('data-observation');if(!raw)throw new Error('No actual offline recovery observation');z.strictObject({stage:z.literal(stage),offline:z.literal(true),httpBlocked:z.literal(true),verifiedOldPackage:z.literal(true),dataPreserved:z.literal(true),journalCleared:z.literal(true),staleFenceDenied:z.literal(true),generation:z.number().int().positive()}).parse(JSON.parse(raw));}));
 }finally{await context.setOffline(false);await Promise.all(pages.map(page=>page.close()));}
});
