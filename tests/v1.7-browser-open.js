globalThis.manuscriptQA={checks:[],errors:[]};page.on('pageerror',e=>manuscriptQA.errors.push(String(e)));
await page.goto('http://127.0.0.1:49922/index.html',{waitUntil:'domcontentloaded'});await page.setViewportSize({width:1460,height:923});
await page.locator('#loomBtn').click();await expect(page.locator('#manuscriptGrid')).toBeVisible();
const value=await page.evaluate(()=>Stargram.loom());expect(value.draft).toEqual(value.original);assert.equal(value.summary.changed,false);assert.equal(await page.locator('#loomApply').isDisabled(),true);
assert.equal(await page.locator('#manuscriptGrid [role="gridcell"]').count(),value.draft.length*10);
return {value,errors:manuscriptQA.errors,image:await page.screenshot({fullPage:false})};
