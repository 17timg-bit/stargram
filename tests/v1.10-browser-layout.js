await page.reload({waitUntil:'domcontentloaded'});
globalThis.phraseLayouts=[];const images={};
for(const preset of ['paper','nocturne','mist','rosette','sisters','polar']){
  for(let i=0;i<3&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');
  await page.setViewportSize({width:1460,height:1000});
  await page.locator('#themeBtn').click();
  if(!await page.locator('.recipe-starts').evaluate(e=>e.open))await page.locator('.recipe-starts summary').click();
  await page.locator(`[data-recipe="${preset}"]`).click();await page.keyboard.press('Escape');
  await page.locator('#loomBtn').click();await page.locator('#loomLength').selectOption('24');
  await page.locator('[data-range-tick="20"]').click();await page.locator('[data-range-tick="23"]').click();
  await expect(page.locator('#phraseRange')).toContainText('21 — 24');
  await page.locator('#phraseCancel').click();await page.locator('[data-range-tick="1"]').click();await page.locator('[data-range-tick="8"]').click();
  for(const [width,height] of [[1920,1080],[1460,1000],[1280,720],[1000,900],[700,844],[390,844],[320,700]]){
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>{const c=document.querySelector('#universe'),r=c.getBoundingClientRect();return Math.abs(c.width-r.width*devicePixelRatio)<2;});
    if(width===390){
      await page.locator('[data-range-tick="20"]').click();await page.locator('[data-range-tick="23"]').click();await expect(page.locator('#phraseRange')).toContainText('21 — 24');
      await page.locator('#phraseCancel').click();await page.locator('[data-range-tick="1"]').click();await page.locator('[data-range-tick="8"]').click();
    }
    await page.locator('.phrase-actions').scrollIntoViewIfNeeded();
    const result=await page.evaluate(()=>{
      const $=s=>document.querySelector(s),d=$('#loomDialog'),desk=$('.phrase-desk'),panel=desk.getBoundingClientRect(),buttons=[...document.querySelectorAll('[data-phrase]')];
      const allHit=buttons.every(b=>{const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===b||b.contains(hit);});
      const inside=buttons.every(b=>{const r=b.getBoundingClientRect();return r.left>=panel.left&&r.right<=panel.right&&r.width>=35&&r.height>=45;});
      const boxes=buttons.map(b=>b.getBoundingClientRect());let collision=false;
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)collision=true;}
      return {no_page_overflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,no_dialog_overflow:d.scrollWidth<=d.clientWidth+1,no_body_overflow:$('.loom-scroll').scrollWidth<=$('.loom-scroll').clientWidth+1,footer_outside_scroll:$('.loom-scroll').getBoundingClientRect().bottom<=$('.loom-footer').getBoundingClientRect().top+1,caption_fits:$('.phrase-strip').scrollWidth<=$('.phrase-strip').clientWidth+1,all_buttons_inside:inside,all_buttons_hit:allHit,no_button_collision:!collision,grid_cells:document.querySelectorAll('.score-cell').length,grid_scroll:$('.score-scroll').scrollWidth>$('.score-scroll').clientWidth};
    });
    for(const [key,value] of Object.entries(result))if(typeof value==='boolean'&&key!=='grid_scroll')assert.equal(value,true,`${preset} ${width}x${height} ${key}`);
    assert.equal(result.grid_cells,240);phraseLayouts.push({preset,width,height,...result});
    if(preset==='paper'&&width===1460)images.desktop=await page.screenshot({fullPage:false});
    if(preset==='nocturne'&&width===390)images.mobile=await page.screenshot({fullPage:false});
  }
}
await page.setViewportSize({width:1460,height:1000});
assert.equal(phraseQA.errors.length,0);
return {matrix:phraseLayouts,errors:phraseQA.errors,images};
