# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> M1 phone routes, preferences, real IndexedDB and production offline relaunch
- Location: tests\e2e\app.spec.ts:16:1

# Error details

```
Error: page.reload: WebKit encountered an internal error
Call log:
  - waiting for navigation until "load"

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]: P
      - generic [ref=e6]:
        - heading "PWACloud" [level=1] [ref=e7]
        - generic [ref=e8]: AI not connected
    - button "Settings" [ref=e9] [cursor=pointer]
  - status [ref=e10]: Offline · local tools and saved data remain available
  - main [ref=e11]:
    - generic [ref=e12]:
      - generic [ref=e13]:
        - heading "Quick note" [level=2] [ref=e14]
        - paragraph [ref=e15]: Saved directly on this device, available offline.
        - generic [ref=e16]:
          - text: Quick note text
          - textbox "Quick note text" [ref=e17]:
            - /placeholder: Capture a thought…
            - text: Synthetic offline note
        - button "Save quick note" [ref=e18] [cursor=pointer]
      - generic [ref=e19]:
        - heading "Your tools" [level=2] [ref=e20]
        - generic [ref=e21]:
          - heading "A place for your first tool" [level=2] [ref=e22]
          - paragraph [ref=e23]: Install Notebook to make rich notes and run local text analysis.
          - button "Explore apps" [ref=e24] [cursor=pointer]
    - status [ref=e25]: Quick note saved on this device
  - navigation "Main navigation" [ref=e26]:
    - button "Home" [ref=e27] [cursor=pointer]:
      - generic [ref=e28]: ⌂
      - text: Home
    - button "Library" [ref=e29] [cursor=pointer]:
      - generic [ref=e30]: ▤
      - text: Library
    - button "Discover" [ref=e31] [cursor=pointer]:
      - generic [ref=e32]: ⊕
      - text: Discover
    - button "Activity" [ref=e33] [cursor=pointer]:
      - generic [ref=e34]: ◷
      - text: Activity
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import type { Page } from '@playwright/test';
  3  | import AxeBuilder from '@axe-core/playwright';
  4  | 
  5  | async function openTab(page:Page,name:'Home'|'Library'|'Discover'|'Activity'):Promise<void>{await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true}).click();}
  6  | async function install(page:Page,name:string,optional=false):Promise<void>{
  7  |   await openTab(page,'Discover');await page.getByRole('button',{name:`Review ${name}`,exact:true}).click();
  8  |   const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:`Review ${name}`,exact:true})).toBeVisible();
  9  |   if(optional){const boxes=dialog.getByRole('checkbox');for(let i=0;i<await boxes.count();i++){const box=boxes.nth(i);if(await box.isEnabled())await box.check();}}
  10 |   await dialog.getByRole('button',{name:'Install reviewed app',exact:true}).click();await expect(dialog.getByRole('heading',{name:`${name} is ready`,exact:true})).toBeVisible();
  11 |   await dialog.getByRole('button',{name:`Open ${name}`,exact:true}).click();await expect(page.locator('iframe')).toHaveCount(1);
  12 |   await expect(page.frameLocator('iframe').getByRole('heading',{name,exact:true})).toBeVisible();
  13 | }
  14 | async function closePlugin(page:Page):Promise<void>{await page.getByRole('button',{name:'Back to Library',exact:true}).click();await expect(page.getByRole('heading',{name:'Library',exact:true})).toBeVisible();}
  15 | 
  16 | test('M1 phone routes, preferences, real IndexedDB and production offline relaunch',async({page,context})=>{
  17 |   const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  18 |   await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  19 |   await page.getByRole('button',{name:'Start without an account'}).click();
  20 |   await page.getByLabel('Quick note text').fill('Synthetic offline note');await page.getByRole('button',{name:'Save quick note'}).click();await expect(page.getByText('Quick note saved on this device',{exact:true})).toBeVisible();
  21 |   for(const tab of ['Library','Discover','Activity','Home'] as const){await openTab(page,tab);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  22 |   await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Color scheme').selectOption('dark');await page.getByLabel('Text size').selectOption('1.5');
  23 |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  24 |   await page.getByRole('button',{name:'Close Settings',exact:true}).click();
  25 |   await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
> 26 |   await context.setOffline(true);await page.reload();await expect(page.getByLabel('Quick note text')).toHaveValue('Synthetic offline note');await expect(page.getByText('Offline · local tools and saved data remain available')).toBeVisible();
     |                                             ^ Error: page.reload: WebKit encountered an internal error
  27 |   expect(await page.evaluate(()=>document.documentElement.dataset.theme)).toBe('dark');
  28 |   await page.screenshot({path:`evidence/M1/${test.info().project.name}-360-offline.png`,fullPage:true});
  29 |   expect(errors).toEqual([]);
  30 | });
  31 | 
  32 | test('M5 Notebook rich editing, hostile text, undo, Wasm Worker and persisted reload',async({page})=>{
  33 |   await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await install(page,'Notebook');
  34 |   const frame=page.frameLocator('iframe');await expect(frame.getByText('Local notes ready',{exact:true})).toBeVisible();
  35 |   await frame.getByLabel('Title',{exact:true}).fill('Synthetic notebook');await frame.getByLabel('Note text',{exact:true}).fill('one two three');
  36 |   await frame.getByRole('button',{name:'Bold',exact:true}).click();await frame.getByRole('button',{name:'Preview formatting'}).click();await expect(frame.locator('.preview')).toHaveCSS('font-weight','700');
  37 |   await frame.getByRole('button',{name:'Edit note'}).click();await frame.getByLabel('Note text',{exact:true}).fill('one two three four');await frame.getByRole('button',{name:'Undo',exact:true}).click();await expect(frame.getByLabel('Note text',{exact:true})).toHaveValue('one two three');await frame.getByRole('button',{name:'Redo',exact:true}).click();await expect(frame.getByLabel('Note text',{exact:true})).toHaveValue('one two three four');
  38 |   await frame.getByRole('button',{name:'Analyze with Wasm'}).click();await expect(frame.getByLabel('Wasm analysis')).toContainText('"words":4');await expect(frame.getByLabel('Wasm analysis')).toContainText('Rust Component Model Wasm');
  39 |   await frame.getByLabel('Note text',{exact:true}).fill('<img src=x onerror="alert(1)"> synthetic');await frame.getByRole('button',{name:'Preview formatting'}).click();await expect(frame.locator('.preview')).toContainText('<img src=x');await expect(frame.locator('.preview img')).toHaveCount(0);await expect(frame.getByText('Saved on this device',{exact:true})).toBeVisible();
  40 |   await page.screenshot({path:`evidence/M5/${test.info().project.name}-notebook.png`,fullPage:true});
  41 |   await closePlugin(page);await page.reload();await page.getByRole('button',{name:/Notebook Rich local/}).click();await expect(frame.getByLabel('Title',{exact:true})).toHaveValue('Synthetic notebook');
  42 |   await expect(frame.getByLabel('Note text',{exact:true})).toHaveValue('<img src=x onerror="alert(1)"> synthetic');
  43 | });
  44 | 
  45 | test('M5 Canvas selected note approval, denied escalation, non-drag move and persistence',async({page})=>{
  46 |   await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await install(page,'Notebook');
  47 |   const frame=page.frameLocator('iframe');await expect(frame.getByText('Local notes ready',{exact:true})).toBeVisible();await frame.getByLabel('Title',{exact:true}).fill('Only this synthetic note');await frame.getByLabel('Note text',{exact:true}).fill('Selected synthetic document');await expect(frame.getByText('Saved on this device',{exact:true})).toBeVisible();await closePlugin(page);
  48 |   await install(page,'Canvas Board',true);await frame.getByRole('button',{name:'Import selected note'}).click();
  49 |   const approval=page.getByRole('dialog',{name:'Allow selected note once?'});await expect(approval).toContainText('Only this synthetic note');await approval.getByRole('button',{name:'Deny',exact:true}).click();await expect(frame.getByRole('status')).toContainText('denied');await expect(frame.getByLabel('Selected card')).toHaveValue('');
  50 |   await frame.getByRole('button',{name:'Import selected note'}).click();await approval.getByRole('button',{name:'Allow this note once'}).click();await expect(frame.getByLabel('Card text')).toHaveValue('Only this synthetic note\nSelected synthetic document');
  51 |   const before=await frame.locator('svg g').getAttribute('transform');await frame.getByRole('button',{name:'Right',exact:true}).click();expect(await frame.locator('svg g').getAttribute('transform')).not.toEqual(before);await frame.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(frame.getByLabel('Zoom',{exact:true})).toHaveText('125%');await expect(frame.getByText('Board saved on this device')).toBeVisible();
  52 |   await page.screenshot({path:`evidence/M5/${test.info().project.name}-canvas.png`,fullPage:true});await closePlugin(page);await openTab(page,'Library');await page.getByRole('button',{name:/Canvas Board Responsive/}).click();await expect(frame.getByLabel('Zoom',{exact:true})).toHaveText('125%');
  53 | });
  54 | 
  55 | test('M5 Lit feed virtual list, broker permission denial and offline snapshot',async({page,context})=>{
  56 |   let brokerRequests=0;const articles=Array.from({length:75},(_,i)=>`<item><guid>synthetic-${i}</guid><title>Synthetic NASA fixture ${i}</title><description>Offline synthetic article ${i}</description></item>`).join('');
  57 |   await page.route('**/v1/network',async route=>{brokerRequests++;const body:unknown=route.request().postDataJSON();expect(body).toMatchObject({url:'https://www.nasa.gov/feed/',method:'GET',grantId:'feeds'});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:200,body:`<rss><channel>${articles}</channel></rss>`})});});
  58 |   await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await install(page,'Feed Reader');const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'Refresh feed'}).click();await expect(frame.getByRole('status')).toContainText('permission-denied');expect(brokerRequests).toBe(0);
  59 |   await closePlugin(page);await page.getByRole('button',{name:'Manage Feed Reader'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Uninstall',exact:true}).click();await page.getByRole('dialog',{name:'Uninstall Feed Reader?'}).getByRole('button',{name:'Uninstall app',exact:true}).click();
  60 |   await install(page,'Feed Reader',true);await frame.getByRole('button',{name:'Refresh feed'}).click();await expect(frame.getByRole('status')).toContainText('Saved 75 articles');expect(brokerRequests).toBe(1);await expect(frame.locator('.article-row')).toHaveCount(12);await frame.getByRole('button',{name:'Next articles'}).click();await expect(frame.locator('.article-row').first()).toContainText('Synthetic NASA fixture 10');
  61 |   await context.setOffline(true);await closePlugin(page);await page.getByRole('button',{name:/Feed Reader Mobile reading/}).click();await expect(frame.getByRole('status')).toContainText('last saved feed');await expect(frame.locator('.article-row')).toHaveCount(12);await frame.locator('.article-row').first().click();await expect(frame.getByRole('heading',{name:'Synthetic NASA fixture 0'})).toBeVisible();
  62 |   await page.screenshot({path:`evidence/M5/${test.info().project.name}-feed-offline.png`,fullPage:true});
  63 | });
  64 | 
  65 | test('M9 minimal non-Ionic embedding uses independently verified package',async({page})=>{
  66 |   await page.goto('/minimal/');await expect(page.getByRole('status')).toContainText('Minimal host ready');await page.getByRole('button',{name:'Review Notebook',exact:true}).click();await expect(page.getByRole('heading',{name:'Review Notebook'})).toBeVisible();await page.getByRole('button',{name:'Install reviewed app'}).click();await page.getByRole('button',{name:'Open Notebook'}).click();const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading',{name:'Notebook',exact:true})).toBeVisible();await expect(frame.getByText('Local notes ready',{exact:true})).toBeVisible();await frame.getByLabel('Note text',{exact:true}).fill('minimal host uses packages');await frame.getByRole('button',{name:'Analyze with Wasm'}).click();await expect(frame.getByLabel('Wasm analysis')).toContainText('"words":4');await page.getByRole('button',{name:'Close app',exact:true}).click();await expect(page.locator('iframe')).toHaveCount(0);
  67 | });
  68 | 
  69 | test('M9 automated accessibility host 360px light/dark and enlarged text',async({page})=>{
  70 |   await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  71 |   for(const tab of ['Home','Library','Discover','Activity'] as const){await openTab(page,tab);const result=await new AxeBuilder({page}).analyze();expect(result.violations).toEqual([]);}
  72 |   await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Color scheme').selectOption('dark');await page.getByLabel('Text size').selectOption('1.5');const result=await new AxeBuilder({page}).analyze();expect(result.violations).toEqual([]);await page.screenshot({path:`evidence/M9/${test.info().project.name}-settings-dark-large.png`,fullPage:true});
  73 | });
  74 | 
```