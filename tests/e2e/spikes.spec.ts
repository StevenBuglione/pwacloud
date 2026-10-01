import { test,expect } from '@playwright/test';
test('FND-02 opaque React and Lit bundles, real CSP and navigation residual',async({page,request})=>{
  await request.post('/probe/reset');await page.goto('/spikes');await page.getByRole('button',{name:'React',exact:true}).click();
  const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading')).toHaveText('React isolated UI');
  await frame.getByRole('button',{name:'Save',exact:true}).click();await expect(frame.locator('output')).toHaveText('saved');
  await frame.getByRole('button',{name:'Host check'}).click();await expect(frame.locator('output')).toHaveText('host denied');
  await frame.getByRole('button',{name:'Egress check'}).click();await page.waitForTimeout(100);expect(await(await request.get('/probe/log')).json()).toEqual([]);
  await frame.getByRole('button',{name:'Navigate',exact:true}).click();await expect(page.locator('#status')).toHaveText('Session revoked');
  expect(await(await request.get('/probe/log')).json()).toEqual(['/probe/navigation']);
  await page.getByRole('button',{name:'Lit',exact:true}).click();await expect(frame.getByRole('heading')).toHaveText('Lit isolated UI');
  await frame.getByRole('button',{name:'Save',exact:true}).click();await expect(frame.locator('output')).toHaveText('saved');
});
test('FND-03 real Component Model artifact in Worker and watchdog',async({page})=>{
  await page.goto('/spikes');await page.getByRole('button',{name:'Wasm',exact:true}).click();
  await expect(page.locator('#status')).toContainText('Rust Component Model Wasm');await expect(page.locator('#status')).toContainText('"words":3');
  await page.getByRole('button',{name:'Hang',exact:true}).click();await expect(page.locator('#status')).toContainText('timeout');
  await page.getByRole('button',{name:'Wasm',exact:true}).click();await expect(page.locator('#status')).toContainText('Rust Component Model Wasm');
});
