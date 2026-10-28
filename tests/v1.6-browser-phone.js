assert.equal(new URL(page.url()).origin,'http://127.0.0.1:49921');
globalThis.darkQA=globalThis.darkQA||{checks:[],errors:[]};page.on('pageerror',e=>darkQA.errors.push(String(e)));
await page.reload({waitUntil:'domcontentloaded'});await page.setViewportSize({width:390,height:844});
await page.evaluate(()=>scrollTo(0,0));const before=await page.evaluate(()=>Stargram.status().recipeCode),song=await page.evaluate(()=>Stargram.snapshot());
await page.locator('#themeBtn').click();
for(const [part,id] of [['sky','aurora'],['spectrum','oxygen'],['disc','diffraction'],['type','signal']]){await page.locator(`[data-appearance-tab="${part}"]`).click();await page.locator(`[data-part="${part}"][data-choice="${id}"]`).click();assert.equal(await page.evaluate(p=>Stargram.status().appearance[p],part),id);}
const phoneMix=await page.evaluate(()=>Stargram.status().recipeCode);
await page.locator('.recipe-import summary').click();await page.locator('#recipeInput').fill(before);await page.getByRole('button',{name:'读入',exact:true}).click();assert.equal(await page.evaluate(()=>Stargram.status().recipeCode),before);
await page.locator('#appearanceUndo').click();assert.equal(await page.evaluate(()=>Stargram.status().recipeCode),phoneMix);
expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(song);
await page.locator('[data-appearance-tab="sky"]').click();await page.locator('#themeDialog').evaluate(e=>e.scrollTo(0,0));
const image=await page.screenshot({fullPage:false});await page.keyboard.press('Escape');
darkQA.checks.push('phone-size UI can select every material layer, import a code, undo the appearance and reach the sticky footer without changing music');
assert.equal(darkQA.errors.length,0);return {checks:darkQA.checks,errors:darkQA.errors,image,phoneMix};
