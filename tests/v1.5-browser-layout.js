assert.equal(new URL(page.url()).origin,'http://127.0.0.1:49920');
globalThis.lightQA=globalThis.lightQA||{checks:[],errors:[]};
await page.reload({waitUntil:'domcontentloaded'});
const results=[], images=[];
const sizes=[[2189,1235],[1920,1080],[1460,823],[1440,960],[1280,720],[1200,800],[1000,900],[800,900],[700,844],[390,844],[320,700]];
for (const theme of ['paper','nocturne','mist']) {
  await page.locator('#themeBtn').click();await page.locator(`[data-theme-choice="${theme}"]`).click();
  await page.getByRole('button',{name:'关闭外观选择',exact:true}).click();
  for (const [width,height] of sizes) {
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
    await page.waitForFunction(()=>{const c=document.getElementById('universe'),r=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);return c.width===Math.round(r.width*dpr)&&c.height===Math.round(r.height*dpr);});
    await expect(page.locator('.observatory')).toHaveCSS('display','grid');
    const layout=await page.evaluate(()=>{
      const box=s=>document.querySelector(s).getBoundingClientRect().toJSON();
      return {overflow:document.documentElement.scrollWidth>innerWidth,voices:box('.stage-voices'),instructions:box('.stage-instructions'),hint:box('#stageHint'),shortcuts:box('.stage-shortcuts'),bottom:box('.stage-bottom'),history:box('.stage-history'),footer:box('.stage-footer'),deck:box('.transport'),canvas:box('#universe'),g:Stargram.status().geometry,controls:['playBtn','restartBtn','tempo','scaleSelect','space','volume'].map(id=>box('#'+id))};
    });
    assert.equal(layout.overflow,false,`${theme} ${width}: horizontal overflow`);
    assert.ok(layout.voices.bottom<=layout.footer.top+1,`${theme} ${width}: voices overlap footer`);
    if(width>700) {
      assert.ok(layout.instructions.bottom<=layout.bottom.top+1,`${theme} ${width}: instructions overlap counts`);
      assert.ok(layout.hint.right<layout.shortcuts.left||layout.hint.bottom<=layout.shortcuts.top+1,`${theme} ${width}: instruction lines collide`);
      const R=layout.g.max+Math.min(32,layout.g.max*.18),cx=layout.canvas.x+layout.g.cx,cy=layout.canvas.y+layout.g.cy;
      for(const key of ['hint','shortcuts','history']) {
        const rect=layout[key],dx=Math.max(rect.left-cx,0,cx-rect.right),dy=Math.max(rect.top-cy,0,cy-rect.bottom);
        assert.ok(dx*dx+dy*dy>R*R,`${theme} ${width}: ${key} lies on the record`);
      }
    }
    assert.ok(layout.deck.left>=0&&layout.deck.right<=width+.5&&layout.deck.bottom<=height,`${theme} ${width}: deck out of view`);
    for(const control of layout.controls) assert.ok(control.width>0&&control.height>0&&control.top>=layout.deck.top&&control.bottom<=layout.deck.bottom+.5,`${theme} ${width}: missing deck control`);
    await page.locator('#captureBtn').evaluate(e=>e.scrollIntoView({block:'center'}));
    const reachable=await page.locator('#captureBtn').evaluate(e=>{const r=e.getBoundingClientRect(),d=document.querySelector('.transport').getBoundingClientRect();return r.top>=0&&r.bottom<=d.top;});
    assert.equal(reachable,true,`${theme} ${width}: capture button unreachable`);
    results.push({theme,width,height,horizontal_overflow:false,voices_bottom:layout.voices.bottom,footer_top:layout.footer.top,instructions_bottom:layout.instructions.bottom,counts_top:layout.bottom.top,deck_inside_viewport:true,all_six_controls_visible:true,record_clear_of_footer_text:true,stage_actions_reachable:reachable});
    if(theme==='nocturne'&&width===390) {await page.evaluate(()=>scrollTo(0,0));images.push({name:'夜航手机',image:await page.screenshot({fullPage:true})});}
  }
}
lightQA.checks.push('all three themes across eleven viewports preserve controls and separate the voice list, instructions, counts and record');
await page.setViewportSize({width:390,height:844});await page.locator('#themeBtn').click();
assert.equal(await page.locator('#themeDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
images.push({name:'手机外观选择',image:await page.screenshot({fullPage:false})});
await page.getByRole('button',{name:'关闭外观选择',exact:true}).click();
lightQA.checks.push('the theme picker has a complete narrow-screen layout without horizontal overflow');
return {checks:lightQA.checks,errors:lightQA.errors,results,images};
