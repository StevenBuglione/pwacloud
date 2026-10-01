# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> M9 minimal non-Ionic embedding uses independently verified package
- Location: tests\e2e\app.spec.ts:67:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Review Notebook' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Review Notebook' })

```

```yaml
- banner:
  - heading "PWACloud minimal host" [level=1]
  - link "Reference shell":
    - /url: /
  - button "Close app"
- paragraph: This second host uses the same public framework packages, without Ionic or shell imports.
- button "Review Notebook"
- status: No trust metadata
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import type { Page } from '@playwright/test';
  3   | import AxeBuilder from '@axe-core/playwright';
  4   | import { mkdir, writeFile } from 'node:fs/promises';
  5   | 
  6   | async function openTab(page:Page,name:'Home'|'Library'|'Discover'|'Activity'):Promise<void>{await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true}).click();}
  7   | async function install(page:Page,name:string,optional=false):Promise<void>{
  8   |   await openTab(page,'Discover');await page.getByRole('button',{name:`Review ${name}`,exact:true}).click();
  9   |   const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:`Review ${name}`,exact:true})).toBeVisible();
  10  |   if(optional){const boxes=dialog.getByRole('checkbox');for(let i=0;i<await boxes.count();i++){const box=boxes.nth(i);if(await box.isEnabled())await box.check();}}
  11  |   await dialog.getByRole('button',{name:'Install reviewed app',exact:true}).click();await expect(dialog.getByRole('heading',{name:`${name} is ready`,exact:true})).toBeVisible();
  12  |   await dialog.getByRole('button',{name:`Open ${name}`,exact:true}).click();await expect(page.locator('iframe')).toHaveCount(1);
  13  |   await expect(page.frameLocator('iframe').getByRole('heading',{name,exact:true})).toBeVisible();
  14  | }
  15  | async function closePlugin(page:Page):Promise<void>{await page.getByRole('button',{name:'Back to Library',exact:true}).click();await expect(page.getByRole('heading',{name:'Library',exact:true})).toBeVisible();}
  16  | 
  17  | test('M1 phone routes, preferences, real IndexedDB and production offline relaunch',async({page,context})=>{
  18  |   const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  19  |   await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  20  |   await page.getByRole('button',{name:'Start without an account'}).click();
  21  |   await page.getByLabel('Quick note text').fill('Synthetic offline note');await page.getByRole('button',{name:'Save quick note'}).click();await expect(page.getByText('Quick note saved on this device',{exact:true})).toBeVisible();
  22  |   for(const tab of ['Library','Discover','Activity','Home'] as const){await openTab(page,tab);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  23  |   await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Color scheme').selectOption('dark');await page.getByLabel('Text size').selectOption('1.5');
  24  |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  25  |   await page.getByRole('button',{name:'Close Settings',exact:true}).click();
  26  |   await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  27  |   await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  28  |   await context.setOffline(true);await page.reload();await expect(page.getByLabel('Quick note text')).toHaveValue('Synthetic offline note');await expect(page.getByText('Offline · local tools and saved data remain available')).toBeVisible();
  29  |   expect(await page.evaluate(()=>document.documentElement.dataset.theme)).toBe('dark');
  30  |   await page.screenshot({path:`evidence/M1/${test.info().project.name}-360-offline.png`,fullPage:true});
  31  |   expect(errors).toEqual([]);
  32  | });
  33  | 
  34  | test('M5 Notebook rich editing, hostile text, undo, Wasm Worker and persisted reload',async({page})=>{
  35  |   await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await install(page,'Notebook');
  36  |   const frame=page.frameLocator('iframe');await expect(frame.getByText('Local notes ready',{exact:true})).toBeVisible();
  37  |   await frame.getByLabel('Title',{exact:true}).fill('Synthetic notebook');await frame.getByLabel('Note text',{exact:true}).fill('one two three');
  38  |   await frame.getByRole('button',{name:'Bold',exact:true}).click();await frame.getByRole('button',{name:'Preview formatting'}).click();await expect(frame.locator('.preview')).toHaveCSS('font-weight','700');
  39  |   await frame.getByRole('button',{name:'Edit note'}).click();await frame.getByLabel('Note text',{exact:true}).fill('one two three four');await frame.getByRole('button',{name:'Undo',exact:true}).click();await expect(frame.getByLabel('Note text',{exact:true})).toHaveValue('one two three');await frame.getByRole('button',{name:'Redo',exact:true}).click();await expect(frame.getByLabel('Note text',{exact:true})).toHaveValue('one two three four');
  40  |   await frame.getByRole('button',{name:'Analyze with Wasm'}).click();await expect(frame.getByLabel('Wasm analysis')).toContainText('"words":4');await expect(frame.getByLabel('Wasm analysis')).toContainText('Rust Component Model Wasm');
  41  |   await frame.getByLabel('Note text',{exact:true}).fill('<img src=x onerror="alert(1)"> synthetic');await frame.getByRole('button',{name:'Preview formatting'}).click();await expect(frame.locator('.preview')).toContainText('<img src=x');await expect(frame.locator('.preview img')).toHaveCount(0);await expect(frame.getByText('Saved on this device',{exact:true})).toBeVisible();
  42  |   await page.screenshot({path:`evidence/M5/${test.info().project.name}-notebook.png`,fullPage:true});
  43  |   await closePlugin(page);await page.reload();await page.getByRole('button',{name:/Notebook Rich local/}).click();await expect(frame.getByLabel('Title',{exact:true})).toHaveValue('Synthetic notebook');
  44  |   await expect(frame.getByLabel('Note text',{exact:true})).toHaveValue('<img src=x onerror="alert(1)"> synthetic');
  45  | });
  46  | 
  47  | test('M5 Canvas selected note approval, denied escalation, non-drag move and persistence',async({page})=>{
  48  |   await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await install(page,'Notebook');
  49  |   const frame=page.frameLocator('iframe');await expect(frame.getByText('Local notes ready',{exact:true})).toBeVisible();await frame.getByLabel('Title',{exact:true}).fill('Only this synthetic note');await frame.getByLabel('Note text',{exact:true}).fill('Selected synthetic document');await expect(frame.getByText('Saved on this device',{exact:true})).toBeVisible();await closePlugin(page);
  50  |   await install(page,'Canvas Board',true);await frame.getByRole('button',{name:'Import selected note'}).click();
  51  |   const approval=page.getByRole('dialog',{name:'Allow selected note once?'});await expect(approval).toContainText('Only this synthetic note');await approval.getByRole('button',{name:'Deny',exact:true}).click();await expect(frame.locator('p[role=status]')).toContainText('denied');await expect(frame.getByLabel('Selected card')).toHaveValue('');
  52  |   await frame.getByRole('button',{name:'Import selected note'}).click();await approval.getByRole('button',{name:'Allow this note once'}).click();await expect(frame.getByLabel('Card text')).toHaveValue('Only this synthetic note\nSelected synthetic document');
  53  |   const before=await frame.locator('svg g').getAttribute('transform');await frame.getByRole('button',{name:'Right',exact:true}).click();expect(await frame.locator('svg g').getAttribute('transform')).not.toEqual(before);await frame.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(frame.getByLabel('Zoom',{exact:true})).toHaveText('125%');await expect(frame.getByText('Board saved on this device')).toBeVisible();
  54  |   await page.screenshot({path:`evidence/M5/${test.info().project.name}-canvas.png`,fullPage:true});await closePlugin(page);await openTab(page,'Library');await page.getByRole('button',{name:/Canvas Board Responsive/}).click();await expect(frame.getByLabel('Zoom',{exact:true})).toHaveText('125%');
  55  | });
  56  | 
  57  | test('M5 Lit feed virtual list, broker permission denial and offline snapshot',async({page,context})=>{
  58  |   let brokerRequests=0;const articles=Array.from({length:75},(_,i)=>`<item><guid>synthetic-${i}</guid><title>Synthetic NASA fixture ${i}</title><description>Offline synthetic article ${i}</description></item>`).join('');
  59  |   await page.route('**/v1/network/request',async route=>{brokerRequests++;const body:unknown=route.request().postDataJSON();expect(body).toMatchObject({url:'https://www.nasa.gov/feed/',method:'GET',grantId:'feeds'});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:200,body:`<rss><channel>${articles}</channel></rss>`})});});
  60  |   await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await install(page,'Feed Reader');const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'Refresh feed'}).click();await expect(frame.getByRole('status')).toContainText('permission-denied');expect(brokerRequests).toBe(0);
  61  |   await closePlugin(page);await page.getByRole('button',{name:'Manage Feed Reader'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Uninstall',exact:true}).click();await page.getByRole('dialog',{name:'Uninstall Feed Reader?'}).getByRole('button',{name:'Uninstall app',exact:true}).click();
  62  |   await install(page,'Feed Reader',true);await frame.getByRole('button',{name:'Refresh feed'}).click();await expect(frame.getByRole('status')).toContainText('Saved 75 articles');expect(brokerRequests).toBe(1);await expect(frame.locator('.article-row')).toHaveCount(12);await frame.getByRole('button',{name:'Next articles'}).click();await expect(frame.locator('.article-row').first()).toContainText('Synthetic NASA fixture 10');
  63  |   await context.setOffline(true);await closePlugin(page);await page.getByRole('button',{name:/Feed Reader Mobile reading/}).click();await expect(frame.getByRole('status')).toContainText('last saved feed');await expect(frame.locator('.article-row')).toHaveCount(12);await frame.locator('.article-row').first().click();await expect(frame.getByRole('heading',{name:'Synthetic NASA fixture 0'})).toBeVisible();
  64  |   await page.screenshot({path:`evidence/M5/${test.info().project.name}-feed-offline.png`,fullPage:true});
  65  | });
  66  | 
  67  | test('M9 minimal non-Ionic embedding uses independently verified package',async({page})=>{
> 68  |   await page.goto('/minimal/');await expect(page.getByRole('status')).toContainText('Minimal host ready');await page.getByRole('button',{name:'Review Notebook',exact:true}).click();await expect(page.getByRole('heading',{name:'Review Notebook'})).toBeVisible();await page.getByRole('button',{name:'Install reviewed app'}).click();await page.getByRole('button',{name:'Open Notebook'}).click();const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading',{name:'Notebook',exact:true})).toBeVisible();await expect(frame.getByText('Local notes ready',{exact:true})).toBeVisible();await frame.getByLabel('Note text',{exact:true}).fill('minimal host uses packages');await frame.getByRole('button',{name:'Analyze with Wasm'}).click();await expect(frame.getByLabel('Wasm analysis')).toContainText('"words":4');await page.getByRole('button',{name:'Close app',exact:true}).click();await expect(page.locator('iframe')).toHaveCount(0);
      |                                                                                                                                                                                                                                                       ^ Error: expect(locator).toBeVisible() failed
  69  | });
  70  | 
  71  | test('M9 automated accessibility host 360px light/dark and enlarged text',async({page})=>{
  72  |   await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  73  |   for(const tab of ['Home','Library','Discover','Activity'] as const){await openTab(page,tab);const result=await new AxeBuilder({page}).analyze();expect(result.violations).toEqual([]);}
  74  |   await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Color scheme').selectOption('dark');await page.getByLabel('Text size').selectOption('2');const result=await new AxeBuilder({page}).analyze();expect(result.violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`evidence/M9/${test.info().project.name}-settings-dark-large.png`,fullPage:true});
  75  | });
  76  | 
  77  | test('M9 accessibility inside all isolated frames at 200% text and reduced motion',async({page})=>{
  78  |   await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Text size').selectOption('2');await page.getByRole('button',{name:'Close Settings',exact:true}).click();
  79  |   const reports=[];
  80  |   for(const name of ['Notebook','Feed Reader','Canvas Board']){
  81  |     await install(page,name);
  82  |     const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading',{name,exact:true})).toBeVisible();
  83  |     const result=await new AxeBuilder({page}).analyze();expect(result.violations).toEqual([]);expect(result.incomplete.filter(item=>item.id==='frame-tested')).toEqual([]);
  84  |     reports.push({plugin:name,violations:result.violations,incomplete:result.incomplete,passes:result.passes.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)}))});
  85  |     const child=page.frames().find(value=>value!==page.mainFrame());if(!child)throw new Error('Missing plugin frame');
  86  |     expect(await child.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  87  |     await page.screenshot({path:`evidence/M9/${test.info().project.name}-${name.toLowerCase().replaceAll(' ','-')}-200-percent.png`,fullPage:true});await closePlugin(page);
  88  |   }
  89  |   await mkdir('evidence/M9',{recursive:true});await writeFile(`evidence/M9/${test.info().project.name}-frame-accessibility.json`,JSON.stringify({environment:'Windows Playwright emulation; no physical device or screen-reader certification',width:360,textScale:2,reducedMotion:true,reports},null,2));
  90  | });
  91  | 
  92  | test('M9 twenty cached activations retain one rich frame and meet emulated p95 budget',async({page})=>{
  93  |   await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await install(page,'Notebook');await closePlugin(page);
  94  |   const measurements:number[]=[];
  95  |   for(let i=0;i<20;i++){
  96  |     await page.evaluate(()=>performance.mark('activation-start'));
  97  |     await page.getByRole('button',{name:/Notebook Rich local/}).click();await expect(page.frameLocator('iframe').getByText('Local notes ready',{exact:true})).toBeVisible();
  98  |     const duration=await page.evaluate(()=>{performance.mark('activation-ready');return performance.measure('cached-activation','activation-start','activation-ready').duration;});measurements.push(duration);
  99  |     await expect(page.locator('iframe')).toHaveCount(1);await closePlugin(page);await expect(page.locator('iframe')).toHaveCount(0);
  100 |   }
  101 |   const sorted=[...measurements].sort((a,b)=>a-b),p95=sorted[Math.ceil(sorted.length*.95)-1];if(p95===undefined)throw new Error('Missing activation samples');
  102 |   await mkdir('evidence/M9',{recursive:true});await writeFile(`evidence/M9/${test.info().project.name}-activation-performance.json`,JSON.stringify({environment:'Windows Playwright 360 CSS-pixel emulation; physical-device budget remains unverified',samples:measurements,p95Ms:p95,targetP95Ms:1000,maximumRichFrames:1},null,2));expect(p95).toBeLessThanOrEqual(1000);
  103 | });
  104 | 
  105 | test('M6 explicitly labeled demo streaming saves output and revocation blocks access',async({page})=>{
  106 |   await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Try demo AI',exact:true}).click();await expect(page.getByText(/Synthetic demo session connected/)).toBeVisible();await page.getByRole('button',{name:'Close Settings',exact:true}).click();
  107 |   await install(page,'Notebook',true);const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'AI composer'}).click();await expect(frame.getByLabel('Model')).toHaveValue('demo-synthetic');await frame.getByLabel('Prompt').fill('three synthetic words');await frame.getByRole('button',{name:'Send',exact:true}).click();await expect(frame.locator('.answer')).toContainText('[Synthetic demo AI]');await expect(frame.locator('p[role=status]')).toContainText('AI completed');
  108 |   await closePlugin(page);await page.getByRole('button',{name:/Notebook Rich local/}).click();await frame.getByRole('button',{name:'AI composer'}).click();await expect(frame.locator('.answer')).toContainText('[Synthetic demo AI]');
  109 |   await page.getByRole('button',{name:'Permissions',exact:true}).click();await page.getByRole('button',{name:'Revoke summarize',exact:true}).click();await expect(page.locator('iframe')).toHaveCount(0);
  110 |   await page.getByRole('button',{name:'Back to Library',exact:true}).click();await page.getByRole('button',{name:/Notebook Rich local/}).click();await frame.getByRole('button',{name:'AI composer'}).click();await frame.getByLabel('Prompt').fill('another explicit request');await frame.getByRole('button',{name:'Send',exact:true}).click();await expect(frame.locator('p[role=status]')).toContainText('permission-denied');
  111 | });
  112 | 
```