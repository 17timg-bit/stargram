globalThis.draftQA={checks:[],errors:[]};page.on('pageerror',e=>draftQA.errors.push(String(e)));
await page.goto('http://127.0.0.1:49926/',{waitUntil:'domcontentloaded'});await page.setViewportSize({width:1460,height:1000});
await expect(page.locator('.edition')).toContainText('v1.11');await page.locator('#loomBtn').click();await page.locator('#manuscriptSave').click();
return {edition:await page.locator('.edition').textContent(),dialog:await page.locator('#draftDialog').isVisible(),errors:draftQA.errors,image:await page.screenshot({fullPage:false})};
