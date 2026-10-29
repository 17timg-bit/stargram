globalThis.letterQA={checks:[],errors:[]};page.on('pageerror',e=>letterQA.errors.push(String(e)));
await page.goto('http://127.0.0.1:49923/index.html',{waitUntil:'domcontentloaded'});await page.setViewportSize({width:1460,height:923});
await expect(page.locator('.edition')).toContainText('v1.8');
await page.locator('[data-preset="tide"]').click();
await page.locator('#themeBtn').click();await page.locator('[data-appearance-tab="sky"]').click();await page.locator('[data-part="sky"][data-choice="rosette"]').click();await page.keyboard.press('Escape');
await page.locator('#renameBtn').click();await page.locator('#titleInput').fill('穿过玫瑰星云的信');await page.getByRole('button',{name:'保存名字',exact:true}).click();
globalThis.letterSender=await page.evaluate(()=>Stargram.snapshot());globalThis.letterLook=await page.evaluate(()=>Stargram.status().recipeCode);
await page.locator('#exportBtn').click();await page.locator('#letterSendBtn').click();
globalThis.letterLink=await page.locator('#letterOutput').inputValue();assert.ok(letterLink.startsWith('http://127.0.0.1:49923/index.html#letter=SL1.'));
const decoded=await page.evaluate(value=>OrbitLetters.parse(value),letterLink);expect(decoded.state).toEqual(letterSender);assert.equal(await page.evaluate(a=>AstroAppearance.code(a),decoded.appearance),letterLook);
expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(letterSender);await expect(page.locator('#letterPreview h3')).toHaveText('穿过玫瑰星云的信');
const image=await page.screenshot({fullPage:false});
// A denied clipboard must offer the whole unmodified link for manual copying.
await page.evaluate(()=>{window.letterClipboard=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=async()=>{throw new Error('test denial');};});
await page.locator('#letterCopy').click();await expect(page.locator('#letterStatus')).toContainText('已选中整封信');assert.equal(await page.locator('#letterOutput').evaluate(e=>e.selectionEnd-e.selectionStart),letterLink.length);
await page.evaluate(()=>navigator.clipboard.writeText=window.letterClipboard);
await page.locator('#letterTry').click();await expect(page.locator('#letterAccept')).toBeEnabled();expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(letterSender);await page.keyboard.press('Escape');
letterQA.checks.push('sender encodes an exact independent snapshot and recipe, renders its letter, opens a read-only preview and offers a complete manual copy after clipboard denial');
assert.equal(letterQA.errors.length,0);return {checks:letterQA.checks,errors:letterQA.errors,image,link:letterLink,sender:letterSender,recipe:letterLook};
