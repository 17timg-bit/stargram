assert.equal(new URL(page.url()).origin,'http://127.0.0.1:49921');
globalThis.darkQA=globalThis.darkQA||{checks:[],errors:[]};
await page.reload({waitUntil:'domcontentloaded'});const results=[],images=[];
const sizes=[[1920,1080],[1460,823],[1280,720],[1000,900],[700,844],[390,844],[320,700]];
const selectedSkies=globalThis.darkLayoutSkies||['zodiac','moon','deep','rosette','pleiades','aurora'];
for(const sky of selectedSkies)for(const type of ['book','signal','field']){
  await page.setViewportSize({width:1460,height:923});await page.evaluate(()=>scrollTo(0,0));await page.locator('#themeBtn').click();
  await page.locator('[data-appearance-tab="sky"]').click();await page.locator(`[data-part="sky"][data-choice="${sky}"]`).click();
  await page.locator('[data-appearance-tab="type"]').click();await page.locator(`[data-part="type"][data-choice="${type}"]`).click();await page.keyboard.press('Escape');
  for(const [width,height] of sizes){
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
    await page.waitForFunction(()=>{const c=document.getElementById('universe'),r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);return c.width===Math.round(r.width*d)&&c.height===Math.round(r.height*d);});
    const layout=await page.evaluate(()=>{
      const box=s=>document.querySelector(s).getBoundingClientRect().toJSON();
      return {overflow:document.documentElement.scrollWidth>innerWidth,voices:box('.stage-voices'),footer:box('.stage-footer'),instructions:box('.stage-instructions'),counts:box('.stage-bottom'),deck:box('.transport'),controls:['playBtn','restartBtn','tempo','scaleSelect','space','volume'].map(id=>box('#'+id))};
    });
    assert.equal(layout.overflow,false,`${sky}/${type}/${width}: horizontal overflow`);assert.ok(layout.voices.bottom<=layout.footer.top+1,`${sky}/${type}/${width}: voices overlap footer`);
    if(width>700)assert.ok(layout.instructions.bottom<=layout.counts.top+1,`${sky}/${type}/${width}: footer texts overlap`);
    assert.ok(layout.deck.left>=0&&layout.deck.right<=width+.5&&layout.deck.bottom<=height);
    for(const c of layout.controls)assert.ok(c.width>0&&c.height>0&&c.top>=layout.deck.top&&c.bottom<=layout.deck.bottom+.5);
    await page.locator('#captureBtn').evaluate(e=>e.scrollIntoView({block:'center'}));assert.equal(await page.locator('#captureBtn').evaluate(e=>e.getBoundingClientRect().bottom<=document.querySelector('.transport').getBoundingClientRect().top),true);
    const painted=await page.locator('#universe').evaluate(c=>c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data[3]===255);assert.equal(painted,true,'resized canvas is painted');
    results.push({sky,type,width,height,no_horizontal_overflow:true,footer_separated:true,controls_visible:true,stage_actions_reachable:true,canvas_painted:painted});
  }
}
darkQA.checks.push('sky and typeface layout batch preserves all controls and separated footer text');
for(const width of selectedSkies.includes('aurora')?[1460,700,390,320]:[]){
  await page.setViewportSize({width,height:width>700?923:844});await page.evaluate(()=>scrollTo(0,0));await page.locator('#themeBtn').click();
  for(const part of ['sky','spectrum','disc','type']){await page.locator(`[data-appearance-tab="${part}"]`).click();assert.equal(await page.locator('#themeDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);}
  if(width===390){await page.locator('[data-appearance-tab="sky"]').click();await page.locator('#themeDialog').evaluate(e=>e.scrollTo(0,0));images.push({name:'手机暗房',image:await page.screenshot({fullPage:false})});}
  await page.keyboard.press('Escape');
}
if(selectedSkies.includes('aurora'))darkQA.checks.push('all four material panels fit wide, tablet and narrow phone dialogs');
assert.equal(darkQA.errors.length,0);return {checks:darkQA.checks,errors:darkQA.errors,results,images};
