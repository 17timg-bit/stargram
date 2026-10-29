// Continue after browser-edit: the repeated phrase is a pending manuscript.
await page.locator('#loomApply').click();
await page.locator('#renameBtn').click();await page.locator('#titleInput').fill('星句剪影_本地样片');await page.getByRole('button',{name:'保存名字',exact:true}).click();
globalThis.phraseSample=await page.evaluate(()=>Stargram.snapshot());
await page.locator('#exportBtn').click();
await page.locator('#jsonBtn').click();await page.locator('#midiBtn').click();await page.locator('#posterExportBtn').click();
await expect(page.locator('#exportStatus')).toContainText('明信片已交给浏览器下载');
await page.locator('#wavBtn').click();await expect(page.locator('#wavBtn')).toBeEnabled({timeout:60000});
await expect(page.locator('#exportStatus')).toContainText('WAV');
await page.locator('#letterSendBtn').click();const letter=await page.locator('#letterOutput').inputValue();
expect(await page.evaluate(text=>OrbitLetters.parse(text).state,letter)).toEqual(phraseSample);
await page.getByRole('button',{name:'关闭星际来信',exact:true}).click();
return {state:phraseSample,letter,exportStatus:await page.locator('#exportStatus').textContent(),errors:phraseQA.errors};
