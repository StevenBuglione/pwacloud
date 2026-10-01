import {test,expect} from '@playwright/test';
test('APP-04 RUN-01 RUN-02 RUN-04 actual storage and worker boundaries',async({page})=>{
 await page.goto('/spikes/storage.html');await page.getByRole('button',{name:'Run storage boundaries'}).click();await expect(page.locator('#status')).toContainText('PASS: IndexedDB');
});
