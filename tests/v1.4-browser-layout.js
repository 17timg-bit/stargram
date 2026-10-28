assert.equal(new URL(page.url()).origin,'http://127.0.0.1:49919');
globalThis.pressQA=globalThis.pressQA||{checks:[],errors:[]};
page.on('pageerror',e=>pressQA.errors.push(String(e)));
await page.reload({waitUntil:'domcontentloaded'});
const results=[];
for(const [width,height] of [[1920,1080],[1440,960],[1440,823],[1200,800],[1000,900],[800,900],[700,844],[390,844],[320,700]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
  await page.waitForFunction(()=>{const c=document.querySelector('#universe');return Math.abs(c.width/Math.min(devicePixelRatio||1,2)-c.getBoundingClientRect().width)<2;});
  const layout=await page.evaluate(()=>{
    const box=s=>document.querySelector(s).getBoundingClientRect().toJSON();
    return {clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,stage:box('.observatory'),dock:box('.transport'),capture:box('#captureBtn'),legend:box('.stage-voices'),hero:box('.studio-intro h1')};
  });
  assert.ok(layout.scrollWidth<=layout.clientWidth+1,`horizontal overflow at ${width}`);
  assert.ok(layout.dock.x>=0&&layout.dock.right<=width&&layout.dock.bottom<=height);
  if(width>1000)assert.ok(layout.capture.bottom<layout.dock.top,`dock covers initial stage actions at ${width}x${height}`);
  for(const id of ['playBtn','restartBtn','tempo','scaleSelect','space','volume'])await expect(page.locator('#'+id)).toBeVisible();
  await page.locator('#captureBtn').evaluate(e=>e.scrollIntoView({block:'center'}));
  const reachable=await page.locator('#captureBtn').evaluate(e=>{const r=e.getBoundingClientRect(),d=document.querySelector('.transport').getBoundingClientRect();return r.top>=0&&r.bottom<d.top;});
  assert.ok(reachable,`stage actions unreachable at ${width}`);
  await page.evaluate(()=>scrollTo(0,0));
  const screenshot=width===1440&&height===960||width===390?await page.screenshot({fullPage:true}):null;
  results.push({width,height,layout,stageActionsReachable:reachable,screenshot});
}
await page.setViewportSize({width:1440,height:960});await page.evaluate(()=>scrollTo(0,0));
pressQA.checks.push('nine viewport sizes have no horizontal overflow; the fixed deck retains every control and stage actions stay reachable');
return {checks:pressQA.checks,errors:pressQA.errors,results};
