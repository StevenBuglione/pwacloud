import {test,expect} from '@playwright/test';
test('RPC-01 RPC-02 hostile forged identity oversized requests and replay close real ports',async({page})=>{
 await page.goto('/spikes/hostile.html');
 for(const [button,writes]of [['Forge principal',0],['Replay request',1],['Oversized packet',0]] as const){await page.getByRole('button',{name:'Mount hostile fixture'}).click();const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading')).toHaveText('Hostile protocol fixture');await frame.getByRole('button',{name:button}).click();await expect(page.locator('iframe')).toHaveCount(0);await expect(page.locator('#status')).toHaveText(`Revoked; writes=${writes}`);}
});
