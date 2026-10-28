assert.equal(new URL(page.url()).origin,'http://127.0.0.1:49922');
globalThis.manuscriptQA=globalThis.manuscriptQA||{checks:[],errors:[]};page.on('pageerror',e=>manuscriptQA.errors.push(String(e)));
await page.setViewportSize({width:1460,height:923});await page.evaluate(()=>scrollTo(0,0));
if(await page.locator('#shelfDialog').evaluate(e=>e.open))await page.keyboard.press('Escape');
if(await page.evaluate(()=>Stargram.snapshot().title!=='回声手稿_本地样片')){
  await page.locator('#shelfBtn').click();await page.getByRole('button',{name:'打开星图 回声手稿_本地样片',exact:true}).click();
}
const song=await page.evaluate(()=>Stargram.snapshot()),appearance=await page.evaluate(()=>Stargram.status().recipeCode);
await page.locator('#shelfBtn').click();await page.getByRole('button',{name:'收藏当前星图',exact:true}).click();
const entry=await page.evaluate(()=>Stargram.collection().find(e=>e.state.title==='回声手稿_本地样片'));
assert.ok(entry);await page.keyboard.press('Escape');
await page.locator('#loomBtn').click();await page.locator('#manuscriptGrid [data-tick="0"][data-pitch="8"]').click();await page.keyboard.press('Escape');
await page.locator('[data-preset="tide"]').click();await page.locator('#shelfBtn').click();await page.getByRole('button',{name:'打开星图 回声手稿_本地样片',exact:true}).click();
expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(song);await page.locator('#loomBtn').click();assert.equal(await page.evaluate(()=>Stargram.loom().resumed),false);expect(await page.evaluate(()=>Stargram.loom().draft)).toEqual(song.tracks[2]);await page.keyboard.press('Escape');
assert.equal(await page.evaluate(()=>Stargram.status().recipeCode),appearance);await page.evaluate(()=>scrollTo(0,0));const main=await page.screenshot({fullPage:false});
await page.locator('#loomBtn').click();await page.locator('#loomGenerator summary').click();await page.locator('#loomGenerator').evaluate(e=>e.scrollIntoView({block:'center'}));const generator=await page.screenshot({fullPage:false});await page.keyboard.press('Escape');
expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(song);assert.equal(await page.evaluate(()=>Stargram.status().loomVoices),0);
manuscriptQA.checks.push('saving the handwritten sample to the shelf and loading it after a different preset restores the song, clears stale manuscripts and preserves the appearance; generator expansion leaves the score unchanged');
assert.equal(manuscriptQA.errors.length,0);return {checks:manuscriptQA.checks,errors:manuscriptQA.errors,main,generator};
