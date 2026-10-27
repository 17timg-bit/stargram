assert.equal(new URL(page.url()).origin,'http://127.0.0.1:49857');
globalThis.loomQA=globalThis.loomQA||{checks:[],errors:[]};
page.on('pageerror',e=>loomQA.errors.push(String(e)));
await page.reload({waitUntil:'domcontentloaded'});
const results=[];
for(const [width,height] of [[1440,900],[1200,800],[800,900],[390,844],[320,700]]){
  await page.setViewportSize({width,height});
  await page.getByRole('button',{name:'✧ 织星台',exact:true}).click();
  const dialog=await page.locator('#loomDialog').evaluate(e=>({box:e.getBoundingClientRect().toJSON(),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}));
  assert.ok(dialog.box.x>=0&&dialog.box.right<=width+1);
  assert.ok(dialog.scrollWidth<=dialog.clientWidth+1,`loom overflows at ${width}`);
  await page.getByRole('button',{name:/种进这条轨道/}).scrollIntoViewIfNeeded();
  const applyVisible=await page.locator('#loomApply').evaluate(e=>{
    const box=e.getBoundingClientRect(),d=e.closest('dialog').getBoundingClientRect();
    return box.top>=d.top&&box.bottom<=d.bottom+1;
  });
  assert.ok(applyVisible,`apply button unreachable at ${width}`);
  await page.locator('#loomDialog').evaluate(e=>e.scrollTop=0);
  const screenshot=width===1440||width===390?await page.screenshot({fullPage:false}):null;
  results.push({width,height,dialog,applyReachable:applyVisible,screenshot});
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>Stargram.status().loomOpen),false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
}
await page.emulateMedia({reducedMotion:'reduce'});
await page.reload({waitUntil:'domcontentloaded'});
await page.setViewportSize({width:1440,height:900});
await page.getByRole('button',{name:'✧ 织星台',exact:true}).click();
assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.loom-launch')).transitionDuration),'0s');
await page.keyboard.press('Escape');
await page.emulateMedia({reducedMotion:'no-preference'});
await page.reload({waitUntil:'domcontentloaded'});
await page.evaluate(()=>scrollTo(0,0));
const workbench=await page.screenshot({fullPage:false});
loomQA.checks.push('five viewport sizes keep the loom within the viewport with reachable controls, no horizontal overflow, Escape close, and reduced-motion styling');
return {checks:loomQA.checks,errors:loomQA.errors,results,workbench};
