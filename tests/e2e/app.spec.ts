import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, sep } from 'node:path';

async function offlineShellServer(options:{fixtures?:boolean}={}):Promise<{origin:string;publishUpdate:()=>void;stop:()=>Promise<void>}>{
  const root=resolve('dist/shell'),guestRoot=resolve('artifacts/guest/browser'),fixtureRoot=resolve('artifacts/packages');let stopped=false,publishedUpdate=false;
  const server=createServer((request,response)=>{void(async()=>{
    const path=new URL(request.url??'/','http://localhost').pathname;
    if(path==='/sw.js'&&publishedUpdate){const original=await readFile(resolve(root,'sw.js'),'utf8'),updated=original.replace(/var VERSION = "([^"]+)";/,'var VERSION = "$1-update-proof";');if(updated===original)throw new Error('The built service-worker version was not found');response.writeHead(200,{'content-type':'application/javascript','cache-control':'no-store'});response.end(updated);return;}
    if(path==='/health'){response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});response.end('{"status":"static-shell-test"}');return;}
    if(path==='/v1/trust'&&options.fixtures){response.writeHead(200,{'content-type':'application/json'});response.end(await readFile(resolve(fixtureRoot,'trust.json')));return;}
    if(path.startsWith('/v1/')||(!options.fixtures&&path.startsWith('/fixtures/'))){response.writeHead(404,{'content-type':'application/json'});response.end('{"error":"No runtime in the isolated offline shell proof"}');return;}
    const base=path.startsWith('/guest/')?guestRoot:path.startsWith('/fixtures/')?fixtureRoot:root,file=resolve(base,path==='/'?'index.html':path.startsWith('/guest/')?path.slice('/guest/'.length):path.startsWith('/fixtures/')?path.slice('/fixtures/'.length):path.slice(1));if(!file.startsWith(`${base}${sep}`)){response.writeHead(400);response.end();return;}
    const bytes=await readFile(file),type=file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.wasm')?'application/wasm':file.endsWith('.json')?'application/json':'text/html';response.writeHead(200,{'content-type':type,'cache-control':'no-cache'});response.end(bytes);
  })().catch(()=>{response.writeHead(404);response.end();});});
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));const address=server.address();if(!address||typeof address==='string')throw new Error('No listener address');
  return {origin:`http://127.0.0.1:${address.port}`,publishUpdate:()=>{publishedUpdate=true;},stop:async()=>{if(stopped)return;stopped=true;const closing=new Promise<void>((done,fail)=>server.close(error=>error?fail(error):done()));server.closeAllConnections();await closing;}};
}

async function openTab(page:Page,name:'Home'|'Library'|'Discover'|'Activity'):Promise<void>{await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true}).click();}
async function install(page:Page,name:string,optional=false):Promise<void>{
  await openTab(page,'Discover');await page.getByRole('button',{name:`Review ${name}`,exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:`Review ${name}`,exact:true})).toBeVisible();
  if(optional){const boxes=dialog.getByRole('checkbox');for(let i=0;i<await boxes.count();i++){const box=boxes.nth(i);if(await box.isEnabled())await box.check();}}
  await dialog.getByRole('button',{name:'Install reviewed app',exact:true}).click();await expect(dialog.getByRole('heading',{name:`${name} is ready`,exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:`Open ${name}`,exact:true}).click();await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.frameLocator('iframe').getByRole('heading',{name,exact:true})).toBeVisible();
}
async function closePlugin(page:Page):Promise<void>{await page.getByRole('button',{name:'Back to Library',exact:true}).click();await expect(page.getByRole('heading',{name:'Library',exact:true})).toBeVisible();}

test('M1 phone routes, preferences, real IndexedDB and production offline relaunch',async({page})=>{
  const server=await offlineShellServer();
  try{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.origin);await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Start without an account'}).click();
  await page.getByLabel('Quick note text').fill('Synthetic offline note');await page.getByRole('button',{name:'Save quick note'}).click();await expect(page.getByText('Quick note saved on this device',{exact:true})).toBeVisible();
  for(const tab of ['Library','Discover','Activity','Home'] as const){await openTab(page,tab);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Color scheme').selectOption('dark');await page.getByLabel('Text size').selectOption('1.5');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Close Settings',exact:true}).click();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  await server.stop();const offlineResponse=await page.reload();expect(offlineResponse?.fromServiceWorker()).toBe(true);await expect(page.getByLabel('Quick note text')).toHaveValue('Synthetic offline note');await expect(page.getByText('Offline · local tools and saved data remain available')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.dataset.theme)).toBe('dark');
  await page.screenshot({path:`evidence/M1/${test.info().project.name}-360-offline.png`,fullPage:true});
  expect(errors).toEqual([]);
  }finally{await server.stop();}
});

test('M5 Notebook rich editing, hostile text, undo, Wasm Worker and persisted reload',async({page})=>{
  const server=await offlineShellServer({fixtures:true});try{
  await page.goto(server.origin);await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await install(page,'Notebook');
  const frame=page.frameLocator('iframe');await expect(frame.getByText('Local notes ready',{exact:true})).toBeVisible();
  await frame.getByLabel('Title',{exact:true}).fill('Synthetic notebook');await frame.getByLabel('Note text',{exact:true}).fill('one two three');
  await frame.getByRole('button',{name:'Bold',exact:true}).click();await frame.getByRole('button',{name:'Preview formatting'}).click();await expect(frame.locator('.preview')).toHaveCSS('font-weight','700');
  await frame.getByRole('button',{name:'Edit note'}).click();await frame.getByLabel('Note text',{exact:true}).fill('one two three four');await frame.getByRole('button',{name:'Undo',exact:true}).click();await expect(frame.getByLabel('Note text',{exact:true})).toHaveValue('one two three');await frame.getByRole('button',{name:'Redo',exact:true}).click();await expect(frame.getByLabel('Note text',{exact:true})).toHaveValue('one two three four');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);await server.stop();
  await frame.getByRole('button',{name:'Analyze with Wasm'}).click();await expect(frame.getByLabel('Wasm analysis')).toContainText('"words":4');await expect(frame.getByLabel('Wasm analysis')).toContainText('Rust Component Model Wasm');
  await frame.getByLabel('Note text',{exact:true}).fill('<img src=x onerror="alert(1)"> synthetic');await frame.getByRole('button',{name:'Preview formatting'}).click();await expect(frame.locator('.preview')).toContainText('<img src=x');await expect(frame.locator('.preview img')).toHaveCount(0);await expect(frame.getByText('Saved on this device',{exact:true})).toBeVisible();
  await page.screenshot({path:`evidence/M5/${test.info().project.name}-notebook.png`,fullPage:true});
  await closePlugin(page);await page.reload();await page.getByRole('button',{name:/Notebook Rich local/}).click();await expect(frame.getByLabel('Title',{exact:true})).toHaveValue('Synthetic notebook');
  await expect(frame.getByLabel('Note text',{exact:true})).toHaveValue('<img src=x onerror="alert(1)"> synthetic');
  const documentId=await frame.getByRole('combobox',{name:'Document',exact:true}).inputValue();await frame.getByLabel('Note text',{exact:true}).fill('Immediate draft before New note');await frame.getByRole('button',{name:'New note',exact:true}).click();await expect(frame.getByLabel('Title',{exact:true})).toHaveValue('Untitled note');await frame.getByRole('combobox',{name:'Document',exact:true}).selectOption(documentId);await expect(frame.getByLabel('Note text',{exact:true})).toHaveValue('Immediate draft before New note');
  await expect(frame.getByText('Saved on this device',{exact:true})).toBeVisible();await closePlugin(page);await page.getByRole('button',{name:'Manage Notebook',exact:true}).click();const verification=page.getByRole('region',{name:'Package verification freshness'});await expect(verification).toContainText('Last verified');await expect(verification).toContainText('Receipt expires');await expect(verification).toContainText('Recorded revocation sequence');await expect(verification.locator('time')).toHaveCount(2);await expect(verification).toContainText('Offline: current revocation status is unknown');
  }finally{await server.stop();}
});

test('M1 real waiting service-worker update protects an unsaved edit before apply',async({page})=>{
  const server=await offlineShellServer();try{
    await page.goto(server.origin);await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
    await page.getByLabel('Quick note text').fill('Synthetic edit preserved across actual update');server.publishUpdate();await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();if(!registration)throw new Error('No service-worker registration');await registration.update();});
    await expect.poll(()=>page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();return {waiting:registration?.waiting?.state??null,installing:registration?.installing?.state??null};})).toMatchObject({waiting:'installed'});
    await expect(page.getByText('An app update is ready.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Review update',exact:true}).click();await page.getByRole('button',{name:'Save and reload',exact:true}).click();await expect(page.getByRole('dialog').getByText('Save or discard your quick note before updating.',{exact:true})).toBeVisible();await expect(page.getByLabel('Quick note text')).toHaveValue('Synthetic edit preserved across actual update');await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
    await page.getByRole('button',{name:'Save quick note',exact:true}).click();await expect(page.getByText('Quick note saved on this device',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Review update',exact:true}).click();await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Save and reload',exact:true}).click()]);await expect(page.getByLabel('Quick note text')).toHaveValue('Synthetic edit preserved across actual update');await expect.poll(()=>page.evaluate(async()=>(await caches.keys()).some(key=>key.endsWith('-update-proof')))).toBe(true);
  }finally{await server.stop();}
});

test('M1 independent tab state, host Settings return, internal Back, route reload and pinned tools',async({page})=>{
  await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await install(page,'Notebook');const frame=page.frameLocator('iframe');
  await frame.getByRole('button',{name:'AI composer'}).click();await expect(frame.getByRole('heading',{name:'AI composer',exact:true})).toBeVisible();
  await page.goBack();await expect(frame.getByLabel('Note text',{exact:true})).toBeVisible();await expect(page.locator('iframe')).toHaveCount(1);
  await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close Settings',exact:true}).click();await expect(frame.getByLabel('Note text',{exact:true})).toBeVisible();
  await frame.getByRole('button',{name:'AI composer'}).click();await expect(frame.getByRole('heading',{name:'AI composer',exact:true})).toBeVisible();await page.reload();await expect(frame.getByRole('heading',{name:'AI composer',exact:true})).toBeVisible();
  await closePlugin(page);await page.getByLabel('Search installed apps').fill('Note');await openTab(page,'Discover');await page.getByLabel('Search example apps').fill('Feed');await openTab(page,'Library');await expect(page.getByLabel('Search installed apps')).toHaveValue('Note');await openTab(page,'Discover');await expect(page.getByLabel('Search example apps')).toHaveValue('Feed');
  await openTab(page,'Library');await page.getByRole('button',{name:'Manage Notebook',exact:true}).click();await page.getByRole('button',{name:'Pin to Home',exact:true}).click();await expect(page.getByRole('button',{name:'Unpin from Home',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Close app management',exact:true}).click();await openTab(page,'Home');await expect(page.getByRole('heading',{name:'Pinned tools',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Pinned tools',exact:true})).toBeVisible();
  await page.getByLabel('Quick note text').fill('Unsaved synthetic draft');await openTab(page,'Discover');await expect(page.getByRole('dialog').getByRole('heading',{name:'Unsaved quick note',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByLabel('Quick note text')).toHaveValue('Unsaved synthetic draft');await openTab(page,'Discover');await page.getByRole('button',{name:'Discard and leave',exact:true}).click();await expect(page.getByRole('heading',{name:'Discover',exact:true})).toBeVisible();await openTab(page,'Home');await expect(page.getByLabel('Quick note text')).toHaveValue('');
});

test('UI-03 host keyboard order and tab activation work without pointer input',async({page})=>{
  await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();const settings=page.getByRole('button',{name:'Settings',exact:true});await settings.focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();await page.keyboard.press('Tab');await expect(page.getByLabel('Color scheme')).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByLabel('Text size')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.getByLabel('Color scheme')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.getByRole('button',{name:'Close Settings',exact:true})).toBeFocused();await page.keyboard.press('Space');await expect(page.getByLabel('Quick note text')).toBeVisible();
  const navigation=page.getByRole('navigation',{name:'Main navigation'});await navigation.getByRole('button',{name:'Home',exact:true}).focus();for(const [name,key] of [['Library','Enter'],['Discover','Space'],['Activity','Enter']] as const){await page.keyboard.press('Tab');await expect(navigation.getByRole('button',{name,exact:true})).toBeFocused();await page.keyboard.press(key);await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();await expect(navigation.getByRole('button',{name,exact:true})).toHaveAttribute('aria-current','page');}await page.keyboard.press('Shift+Tab');await expect(navigation.getByRole('button',{name:'Discover',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Discover',exact:true})).toBeVisible();
});

test('M5 Canvas selected note approval, denied escalation, non-drag move and persistence',async({page})=>{
  await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await install(page,'Notebook');
  const frame=page.frameLocator('iframe');await expect(frame.getByText('Local notes ready',{exact:true})).toBeVisible();await frame.getByLabel('Title',{exact:true}).fill('Only this synthetic note');await frame.getByLabel('Note text',{exact:true}).fill('Selected synthetic document');await expect(frame.getByText('Saved on this device',{exact:true})).toBeVisible();await closePlugin(page);
  await install(page,'Canvas Board',true);await frame.getByRole('button',{name:'Import selected note'}).click();
  const approval=page.getByRole('dialog',{name:'Allow selected note once?'});await expect(approval).toContainText('Only this synthetic note');await approval.getByRole('button',{name:'Deny',exact:true}).click();await expect(frame.locator('p[role=status]')).toContainText('denied');await expect(frame.getByLabel('Selected card')).toHaveValue('');
  await frame.getByRole('button',{name:'Import selected note'}).click();await approval.getByRole('button',{name:'Allow this note once'}).click();await expect(frame.getByLabel('Card text')).toHaveValue('Only this synthetic note\nSelected synthetic document');
  const before=await frame.locator('svg g').getAttribute('transform');await frame.getByRole('button',{name:'Right',exact:true}).click();expect(await frame.locator('svg g').getAttribute('transform')).not.toEqual(before);await frame.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(frame.getByLabel('Zoom',{exact:true})).toHaveText('125%');await expect(frame.getByText('Board saved on this device')).toBeVisible();
  const beforeKeyboard=await frame.locator('svg g').getAttribute('transform');await frame.getByRole('button',{name:'Up',exact:true}).focus();await page.keyboard.press('Enter');expect(await frame.locator('svg g').getAttribute('transform')).not.toEqual(beforeKeyboard);await page.keyboard.press('Tab');await expect(frame.getByRole('button',{name:'Down',exact:true})).toBeFocused();await page.keyboard.press('Space');await expect(frame.locator('svg g')).toHaveAttribute('transform',beforeKeyboard!);const beforePan=await frame.locator('svg').getAttribute('viewBox');await frame.getByRole('button',{name:'Pan right',exact:true}).focus();await page.keyboard.press('Space');expect(await frame.locator('svg').getAttribute('viewBox')).not.toEqual(beforePan);await frame.getByRole('button',{name:'Zoom out',exact:true}).focus();await page.keyboard.press('Enter');await expect(frame.getByLabel('Zoom',{exact:true})).toHaveText('100%');await page.keyboard.press('Tab');await expect(frame.getByRole('button',{name:'Zoom in',exact:true})).toBeFocused();await page.keyboard.press('Space');await expect(frame.getByLabel('Zoom',{exact:true})).toHaveText('125%');await expect(frame.getByText('Board saved on this device')).toBeVisible();
  await page.screenshot({path:`evidence/M5/${test.info().project.name}-canvas.png`,fullPage:true});await closePlugin(page);await openTab(page,'Library');await page.getByRole('button',{name:/Canvas Board Responsive/}).click();await expect(frame.getByLabel('Zoom',{exact:true})).toHaveText('125%');
});

test.describe('Deterministic HTTP broker interception',()=>{
test.use({serviceWorkers:'block'});
test('M5 Lit feed virtual list, broker permission denial and offline snapshot',async({page,context})=>{
  let brokerRequests=0;const articles=Array.from({length:75},(_,i)=>`<item><guid>synthetic-${i}</guid><title>Synthetic NASA fixture ${i}</title><description>Offline synthetic article ${i}</description></item>`).join('');
  await page.route('**/v1/network/request',async route=>{brokerRequests++;const body:unknown=route.request().postDataJSON();expect(body).toMatchObject({url:'https://www.nasa.gov/feed/',method:'GET',grantId:'feeds'});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:200,body:`<rss><channel>${articles}</channel></rss>`})});});
  await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await install(page,'Feed Reader');const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'Refresh feed'}).click();await expect(frame.getByRole('status')).toContainText('permission-denied');expect(brokerRequests).toBe(0);
  await closePlugin(page);await page.getByRole('button',{name:'Manage Feed Reader'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Uninstall',exact:true}).click();await page.getByRole('dialog',{name:'Uninstall Feed Reader?'}).getByRole('button',{name:'Uninstall app',exact:true}).click();
  await install(page,'Feed Reader',true);await frame.getByRole('button',{name:'Refresh feed'}).click();await expect(frame.getByRole('status')).toContainText('Saved 75 articles');expect(brokerRequests).toBe(1);await expect(frame.locator('.article-row')).toHaveCount(12);await frame.getByRole('button',{name:'Next articles'}).click();await expect(frame.locator('.article-row').first()).toContainText('Synthetic NASA fixture 10');
  await context.setOffline(true);await closePlugin(page);await page.getByRole('button',{name:/Feed Reader Mobile reading/}).click();await expect(frame.getByRole('status')).toContainText('last saved feed');await expect(frame.locator('.article-row')).toHaveCount(12);await frame.locator('.article-row').first().click();await expect(frame.getByRole('heading',{name:'Synthetic NASA fixture 0'})).toBeVisible();
  await page.screenshot({path:`evidence/M5/${test.info().project.name}-feed-offline.png`,fullPage:true});
  await context.setOffline(false);await closePlugin(page);await page.getByRole('button',{name:'Manage Feed Reader',exact:true}).click();await page.getByRole('button',{name:'Revoke feeds',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);const requestsAtRevocation=brokerRequests;await page.getByRole('button',{name:/Feed Reader Mobile reading/}).click();await frame.getByRole('button',{name:'Refresh feed',exact:true}).click();await expect(frame.getByRole('status')).toContainText('permission-denied');expect(brokerRequests).toBe(requestsAtRevocation);await expect(frame.locator('.article-row')).toHaveCount(12);
});
});

test('M9 minimal non-Ionic embedding uses independently verified package',async({page})=>{
  await page.goto('/minimal/');await expect(page.getByRole('status')).toContainText('Minimal host ready');await page.getByRole('button',{name:'Review Notebook',exact:true}).click();await expect(page.getByRole('heading',{name:'Review Notebook'})).toBeVisible();await page.getByRole('button',{name:'Install reviewed app'}).click();await page.getByRole('button',{name:'Open Notebook'}).click();const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading',{name:'Notebook',exact:true})).toBeVisible();await expect(frame.getByText('Local notes ready',{exact:true})).toBeVisible();await frame.getByLabel('Note text',{exact:true}).fill('minimal host uses packages');await frame.getByRole('button',{name:'Analyze with Wasm'}).click();await expect(frame.getByLabel('Wasm analysis')).toContainText('"words":4');await page.getByRole('button',{name:'Close app',exact:true}).click();await expect(page.locator('iframe')).toHaveCount(0);
});

test('M9 automated accessibility host 360px light/dark and enlarged text',async({page})=>{
  await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();
  for(const tab of ['Home','Library','Discover','Activity'] as const){await openTab(page,tab);const result=await new AxeBuilder({page}).analyze();expect(result.violations).toEqual([]);}
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Color scheme').selectOption('dark');await page.getByLabel('Text size').selectOption('2');const result=await new AxeBuilder({page}).analyze();expect(result.violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`evidence/M9/${test.info().project.name}-settings-dark-large.png`,fullPage:true});
});

test('M9 accessibility inside all isolated frames at 200% text and reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Text size').selectOption('2');await page.getByRole('button',{name:'Close Settings',exact:true}).click();
  const reports=[];
  for(const name of ['Notebook','Feed Reader','Canvas Board']){
    await install(page,name);
    const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading',{name,exact:true})).toBeVisible();
    const result=await new AxeBuilder({page}).analyze();expect(result.violations).toEqual([]);expect(result.incomplete.filter(item=>item.id==='frame-tested')).toEqual([]);
    reports.push({plugin:name,violations:result.violations,incomplete:result.incomplete,passes:result.passes.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)}))});
    const child=page.frames().find(value=>value!==page.mainFrame());if(!child)throw new Error('Missing plugin frame');
    expect(await child.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`evidence/M9/${test.info().project.name}-${name.toLowerCase().replaceAll(' ','-')}-200-percent.png`,fullPage:true});await closePlugin(page);
  }
  await mkdir('evidence/M9',{recursive:true});await writeFile(`evidence/M9/${test.info().project.name}-frame-accessibility.json`,JSON.stringify({environment:'Windows Playwright emulation; no physical device or screen-reader certification',width:360,textScale:2,reducedMotion:true,reports},null,2));
});

test('M9 twenty cached activations retain one rich frame and meet emulated p95 budget',async({page})=>{
  await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await install(page,'Notebook');await closePlugin(page);
  const measurements:number[]=[];
  for(let i=0;i<20;i++){
    const started=await page.evaluate(()=>performance.timeOrigin+performance.mark('activation-start').startTime);
    await page.getByRole('button',{name:/Notebook Rich local/}).click();await expect(page.frameLocator('iframe').getByText('Local notes ready',{exact:true})).toBeVisible();
    const child=page.frames().find(frame=>frame!==page.mainFrame());if(!child)throw new Error('No app frame');await expect.poll(()=>child.evaluate(()=>performance.getEntriesByName('pwacloud-ui-ready').length)).toBeGreaterThan(0);
    const ready=await child.evaluate(()=>{const mark=performance.getEntriesByName('pwacloud-ui-ready').at(-1);if(!mark)throw new Error('Missing actual UI readiness mark');return performance.timeOrigin+mark.startTime;});const duration=ready-started;expect(duration).toBeGreaterThanOrEqual(0);measurements.push(duration);
    await expect(page.locator('iframe')).toHaveCount(1);await closePlugin(page);await expect(page.locator('iframe')).toHaveCount(0);
  }
  const sorted=[...measurements].sort((a,b)=>a-b),p95=sorted[Math.ceil(sorted.length*.95)-1];if(p95===undefined)throw new Error('Missing activation samples');
  await mkdir('evidence/M9',{recursive:true});await writeFile(`evidence/M9/${test.info().project.name}-activation-performance.json`,JSON.stringify({environment:'Windows Playwright 360 CSS-pixel emulation; physical-device budget remains unverified',measurement:'Host activation mark to app animation-frame readiness mark after persisted data and DOM are ready; aligned time origins; Playwright visibility still asserted independently',samples:measurements,p95Ms:p95,targetP95Ms:1000,maximumRichFrames:1},null,2));expect(p95).toBeLessThanOrEqual(1000);
});

test.describe('Deterministic provider-mode response boundary',()=>{
test.use({serviceWorkers:'block'});
test('M6 a real-mode app session cannot be labeled synthetic demo authorization',async({page})=>{
  let submissions=0;page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/v1/runs')submissions++;});
  await page.route('**/v1/provider/status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({mode:'chatgpt-plan-local',state:'not-connected',label:'Controlled real-mode response fixture',remainingAllowance:null,pluginInferenceAuthorized:false})}));await page.route('**/v1/provider/models',route=>route.fulfill({contentType:'application/json',body:'[]'}));
  await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Try demo AI',exact:true}).click();
  await expect(page.getByText(/This runtime is configured for real authorization/)).toBeVisible();await expect(page.getByText(/Synthetic demo session connected/)).toHaveCount(0);await expect(page.getByRole('button',{name:'Try demo AI',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Connect ChatGPT on this computer',exact:true})).toBeVisible();expect(submissions).toBe(0);
});
});

test('M6 explicitly labeled demo streaming saves output and revocation blocks access',async({page})=>{
  const expectedAnswer='[Synthetic demo AI] Your document contains 3 words. This deterministic development response did not use ChatGPT. Review your notes, choose a concise title, and keep the next action explicit.';
  await page.goto('/');await expect(page.getByText('Local workspace ready',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Try demo AI',exact:true}).click();await expect(page.getByText(/Synthetic demo session connected/)).toBeVisible();await page.getByRole('button',{name:'Close Settings',exact:true}).click();
  await install(page,'Notebook',true);const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'AI composer'}).click();await expect(frame.getByLabel('Model')).toHaveValue('demo-synthetic');await frame.getByLabel('Prompt').fill('three synthetic words');await frame.getByRole('button',{name:'Send',exact:true}).click();await expect(frame.locator('.answer')).toHaveText(expectedAnswer);await expect(frame.locator('p[role=status]')).toContainText('AI completed');
  await closePlugin(page);await openTab(page,'Activity');await expect(page.getByText('Notebook AI · completed',{exact:true})).toBeVisible();await page.getByRole('button',{name:'View Notebook AI task',exact:true}).click();await expect(page.getByRole('dialog').locator('.task-output').nth(0)).toHaveText('three synthetic words');await expect(page.getByRole('dialog').locator('.task-output').nth(1)).toHaveText(expectedAnswer);await page.getByRole('button',{name:'Close task details',exact:true}).click();await openTab(page,'Library');await page.getByRole('button',{name:/Notebook Rich local/}).click();await frame.getByRole('button',{name:'AI composer'}).click();await expect(frame.locator('.answer')).toHaveText(expectedAnswer);
  await page.getByRole('button',{name:'Permissions',exact:true}).click();await page.getByRole('button',{name:'Revoke summarize',exact:true}).click();await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button',{name:'Back to Library',exact:true}).click();await page.getByRole('button',{name:/Notebook Rich local/}).click();await frame.getByRole('button',{name:'AI composer'}).click();await frame.getByLabel('Prompt').fill('another explicit request');await frame.getByRole('button',{name:'Send',exact:true}).click();await expect(frame.locator('p[role=status]')).toContainText('permission-denied');
});
