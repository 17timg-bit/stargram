// Viewport simulation on the isolated QA origin; no physical-device claim.
assert.equal(new URL(page.url()).origin,'http://127.0.0.1:49831');
const results=[];
for(const [width,height] of [[1440,900],[1440,823],[1200,800],[1100,800],[800,900],[390,844],[320,700]]){
  await page.setViewportSize({width,height});
  await page.evaluate(()=>scrollTo(0,0));
  await page.waitForFunction(()=>{
    const c=document.querySelector('#universe'),r=c.getBoundingClientRect();
    return Math.abs(c.width/Math.min(devicePixelRatio||1,2)-r.width)<2;
  });
  const layout=await page.evaluate(()=>{
    const box=s=>document.querySelector(s).getBoundingClientRect().toJSON();
    return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,workspace:box('.workspace'),stage:box('.observatory'),transport:box('.transport'),inspector:box('.inspector'),save:box('.save-note'),heading:box('.library h1')};
  });
  assert.ok(layout.scrollWidth<=width+1,`horizontal overflow at ${width}`);
  assert.ok(layout.workspace.bottom<=layout.transport.top+1,`footer overlaps workspace at ${width}`);
  assert.ok(layout.stage.width>=280&&layout.stage.height>=480);
  if(width>1100){
    // The inspector intentionally scrolls in short desktop windows.
    await page.locator('.save-note').scrollIntoViewIfNeeded();
    const reachable=await page.locator('.save-note').evaluate(e=>{
      const r=e.getBoundingClientRect(),p=e.closest('.inspector').getBoundingClientRect();
      return r.top>=p.top&&r.bottom<=p.bottom+1;
    });
    assert.ok(reachable,`save indicator unreachable at ${width}`);
    await page.locator('.inspector').evaluate(e=>e.scrollTop=0);
  }
  const screenshot=[1440,800,390,320].includes(width)&&height!==823 ? await page.screenshot({fullPage:true}) : null;
  results.push({viewport:[width,height],layout,screenshot});
}
return {checks:results};
