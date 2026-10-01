# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lifecycle.spec.ts >> PKG-04 UPD-01 UPD-02 UPD-05 RUN-04 actual IndexedDB lifecycle recovery
- Location: tests\e2e\lifecycle.spec.ts:3:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('#status')
Expected substring: "PASS: all5 cancellation stages"
Received string:    ""
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('#status')
    14 × locator resolved to <output id="status"></output>
       - unexpected value ""

```

```yaml
- button "Run lifecycle recovery"
- status
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | test('RUN-02 RUN-05 actual hanging guest crashes back off and quarantine the installed plugin',async({page})=>{test.setTimeout(25000);await page.goto('/spikes/lifecycle.html?mode=crash');await page.getByRole('button',{name:'Run lifecycle recovery'}).click();await expect(page.locator('#status')).toContainText('PASS: three real hanging Workers',{timeout:20000});await expect(page.locator('iframe')).toHaveCount(0);});
> 3  | test('PKG-04 UPD-01 UPD-02 UPD-05 RUN-04 actual IndexedDB lifecycle recovery',async({page})=>{await page.goto('/spikes/lifecycle.html');await page.getByRole('button',{name:'Run lifecycle recovery'}).click();await expect(page.locator('#status')).toContainText('PASS: all5 cancellation stages');});
     |                                                                                                                                                                                                                                                      ^ Error: expect(locator).toContainText(expected) failed
  4  | test('PKG-04 UPD-02 actual page termination at every journal stage restores the old installation',async({context})=>{
  5  |  test.setTimeout(60000);const stages=['staging','artifact','snapshot','migration','commit'];const databases=stages.map(()=>crypto.randomUUID());
  6  |  await Promise.all(stages.map(async(stage,index)=>{const page=await context.newPage();await page.goto(`/spikes/lifecycle.html?mode=terminate&stage=${stage}&database=${databases[index]}`);await page.getByRole('button',{name:'Run lifecycle recovery'}).click();await expect(page.locator('#status')).toHaveText('STALLED: '+stage);await page.close();}));
  7  |  const clock=await context.newPage();await clock.waitForTimeout(11000);await clock.close();
  8  |  await Promise.all(stages.map(async(stage,index)=>{const page=await context.newPage();await page.goto(`/spikes/lifecycle.html?mode=recover&stage=${stage}&database=${databases[index]}`);await page.getByRole('button',{name:'Run lifecycle recovery'}).click();await expect(page.locator('#status')).toHaveText('PASS: actual page termination '+stage);await page.close();}));
  9  | });
  10 | 
```