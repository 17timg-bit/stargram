assert.equal(new URL(page.url()).origin,'http://127.0.0.1:49922');
globalThis.manuscriptQA=globalThis.manuscriptQA||{checks:[],errors:[]};page.on('pageerror',e=>manuscriptQA.errors.push(String(e)));
await page.reload({waitUntil:'domcontentloaded'});const results=[],images=[];
const sizes=[[1920,1080],[1460,923],[1280,720],[1000,900],[700,844],[390,844],[320,700]];
for(const preset of ['paper','nocturne','mist']){
  await page.setViewportSize({width:1460,height:923});await page.evaluate(()=>scrollTo(0,0));await page.locator('#themeBtn').click();
  if(!await page.locator('.recipe-starts').evaluate(e=>e.open))await page.locator('.recipe-starts summary').click();await page.locator(`[data-recipe="${preset}"]`).click();await page.keyboard.press('Escape');
  const original=await page.evaluate(()=>Stargram.snapshot());await page.locator('#loomBtn').click();await page.locator('#loomLength').selectOption('24');
  for(const [width,height] of sizes){
    await page.setViewportSize({width,height});await page.locator('#loomDialog').evaluate(e=>e.scrollTo(0,0));
    const layout=await page.evaluate(()=>{
      const box=s=>document.querySelector(s).getBoundingClientRect().toJSON(),d=document.getElementById('loomDialog'),s=document.querySelector('.score-scroll');
      return {pageOverflow:document.documentElement.scrollWidth>innerWidth,dialogOverflow:d.scrollWidth>d.clientWidth+1,dialog:box('#loomDialog'),scrollWidth:s.scrollWidth,clientWidth:s.clientWidth,cells:document.querySelectorAll('.score-cell').length};
    });
    assert.equal(layout.pageOverflow,false,`${preset}/${width}: page overflow`);assert.equal(layout.dialogOverflow,false,`${preset}/${width}: dialog overflow`);
    assert.ok(layout.dialog.left>=0&&layout.dialog.right<=width+1&&layout.dialog.top>=0&&layout.dialog.bottom<=height+1);
    assert.equal(layout.cells,240);
    for(const id of ['loomOriginalListen','loomListen','loomApply','manuscriptClear']){
      await page.locator('#'+id).evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest'}));
      const reachable=await page.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&e.contains(document.elementFromPoint(x,y));});
      assert.equal(reachable,true,`${preset}/${width}: ${id} obscured`);
    }
    expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(original);
    results.push({preset,width,height,no_page_or_dialog_overflow:true,grid_cells:240,inner_scroll:layout.scrollWidth>layout.clientWidth,all_actions_reachable:true});
  }
  await page.setViewportSize({width:1460,height:923});await page.locator('#loomDialog').evaluate(e=>e.scrollTo(0,0));
  if(preset==='nocturne')images.push({name:'夜航手稿',image:await page.screenshot({fullPage:false})});
  await page.keyboard.press('Escape');
}
manuscriptQA.checks.push('three light, dark and cool appearances across seven viewport sizes keep the 24-tick score inside its own scroll area and A/B, apply and edit controls reachable');
assert.equal(manuscriptQA.errors.length,0);return {checks:manuscriptQA.checks,errors:manuscriptQA.errors,results,images};
