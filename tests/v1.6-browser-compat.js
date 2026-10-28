assert.equal(new URL(page.url()).origin,'http://127.0.0.1:49921');
globalThis.darkQA=globalThis.darkQA||{checks:[],errors:[]};page.on('pageerror',e=>darkQA.errors.push(String(e)));
await page.setViewportSize({width:1460,height:923});await page.reload({waitUntil:'domcontentloaded'});
const song=await page.evaluate(()=>Stargram.snapshot());
await page.evaluate(()=>{localStorage.removeItem('stargram.appearance.v2');localStorage.setItem('stargram.appearance.v1','nocturne');});await page.reload({waitUntil:'domcontentloaded'});
assert.equal(await page.evaluate(()=>Stargram.status().theme),'nocturne');assert.equal(await page.evaluate(()=>localStorage.getItem('stargram.appearance.v2')),null);
await page.locator('#themeBtn').click();await page.locator('.recipe-starts summary').click();await page.locator('[data-recipe="sisters"]').click();await page.keyboard.press('Escape');await page.reload({waitUntil:'domcontentloaded'});
assert.equal(await page.evaluate(()=>Stargram.status().theme),'sisters');assert.equal(await page.evaluate(()=>localStorage.getItem('stargram.appearance.v1')),'nocturne');
expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(song);
await page.evaluate(()=>localStorage.setItem('stargram.appearance.v2','corrupt-recipe'));await page.reload({waitUntil:'domcontentloaded'});
assert.equal(await page.evaluate(()=>Stargram.status().theme),'paper');assert.equal(await page.evaluate(()=>localStorage.getItem('stargram.appearance.v2')),'corrupt-recipe');
darkQA.checks.push('real page reload migrates a legacy theme without eager writes, retains the legacy key, and preserves corrupt settings while safely falling back');
await page.locator('#themeBtn').click();await page.locator('#recipeCopy').click();
const copyStatus=await page.locator('#themeStatus').textContent();assert.ok(copyStatus.includes('已复制')||copyStatus.includes('按 Ctrl+C'));
await page.keyboard.press('Escape');
// The musical hit targets remain the five original orbital rings.
for(const width of [1460,390]){
  await page.setViewportSize({width,height:width===390?844:923});await page.evaluate(()=>scrollTo(0,0));
  await page.waitForFunction(()=>{const c=document.getElementById('universe'),r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);return c.width===Math.round(r.width*d)&&c.height===Math.round(r.height*d);});
  await page.getByRole('button',{name:'选择浮光轨道',exact:true}).click();
  const box=await page.locator('#universe').boundingBox(),g=await page.evaluate(()=>Stargram.status().geometry),a=Math.PI*2/16-Math.PI/2;
  await page.mouse.click(box.x+g.cx+Math.cos(a)*g.radii[2],box.y+g.cy+Math.sin(a)*g.radii[2]);assert.equal(await page.evaluate(()=>Stargram.snapshot().tracks[2].notes[1]),2);
  await page.locator('#undoBtn').evaluate(e=>e.scrollIntoView({block:'center'}));await page.locator('#undoBtn').click();expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(song);
}
darkQA.checks.push('copy provides a usable recipe number and desktop/phone pointer edits still hit the intended musical step with undo');
await page.setViewportSize({width:1460,height:923});await page.evaluate(()=>scrollTo(0,0));
await page.locator('#themeBtn').click();await page.locator('.recipe-starts summary').click();await page.locator('[data-recipe="rosette"]').click();await page.keyboard.press('Escape');
await page.locator('#loomBtn').click();const original=await page.evaluate(()=>Stargram.snapshot());
await page.getByRole('button',{name:'▷ 试听这一圈',exact:true}).click();await page.waitForFunction(()=>Stargram.status().loomPlaying);assert.equal(await page.evaluate(()=>Stargram.status().tonearm),0);
await page.getByRole('button',{name:'■ 停止试听',exact:true}).click();await page.waitForFunction(()=>Stargram.status().loomVoices===0);await page.getByRole('button',{name:/种进这条轨道/}).click();await page.locator('#undoBtn').click();expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(original);
await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>Stargram.status().reducedMotion);await page.getByRole('button',{name:'开始演奏',exact:true}).click();await page.waitForFunction(()=>Stargram.status().tonearm===1);await page.getByRole('button',{name:'暂停演奏',exact:true}).click();await page.waitForFunction(()=>Stargram.status().tonearm===0&&Stargram.status().activeVoices===0);
await page.emulateMedia({reducedMotion:'no-preference'});
darkQA.checks.push('the composable artwork preserves isolated loom audition/apply/undo and live reduced-motion tonearm behavior');
assert.equal(darkQA.errors.length,0);return {checks:darkQA.checks,errors:darkQA.errors,copyStatus};
