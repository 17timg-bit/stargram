assert.equal(new URL(page.url()).origin,'http://127.0.0.1:49920');
globalThis.lightQA=globalThis.lightQA||{checks:[],errors:[]};
await page.setViewportSize({width:1460,height:823});await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'domcontentloaded'});
const cases=[],images=[];
for(const theme of ['paper','nocturne','mist']) {
  await page.locator('#themeBtn').click();await page.locator(`[data-theme-choice="${theme}"]`).click();await page.getByRole('button',{name:'关闭外观选择',exact:true}).click();
  const contrasts=await page.evaluate(()=>{
    const css=getComputedStyle(document.documentElement),hex=t=>css.getPropertyValue('--'+t).trim();
    const lum=h=>{const c=h.slice(1).match(/../g).slice(0,3).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
    const contrast=(a,b)=>{a=lum(hex(a));b=lum(hex(b));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
    return {body:contrast('ink','paper'),secondary:contrast('muted','paper'),play:contrast('button-ink','button'),fields:contrast('ink','field')};
  });
  for(const value of Object.values(contrasts))assert.ok(value>=4.5,`${theme}: small text or playback contrast below 4.5`);
  await page.locator('#renameBtn').click();await page.locator('#titleInput').fill('V15_QA_'+theme);await page.getByRole('button',{name:'保存名字',exact:true}).click();
  await page.locator('#exportBtn').click();await page.locator('#posterExportBtn').click();
  await expect(page.locator('#exportStatus')).toContainText('明信片已交给浏览器下载',{timeout:30000});
  if(theme==='nocturne') images.push({name:'夜航导出',image:await page.screenshot({fullPage:false})});
  await page.getByRole('button',{name:'关闭导出',exact:true}).click();await expect(page.locator('#toast')).not.toHaveClass(/visible/,{timeout:6000});
  await page.locator('#immerseBtn').click();await page.locator('#captureBtn').click();await expect(page.locator('#toast')).toHaveClass(/visible/,{timeout:30000});
  await expect(page.locator('#toast')).not.toHaveClass(/visible/,{timeout:6000});await page.keyboard.press('Escape');
  cases.push({theme,title:'V15_QA_'+theme,completed:true,contrasts});
}
await page.emulateMedia({reducedMotion:'no-preference'});
await page.locator('#renameBtn').click();await page.locator('#titleInput').fill('晨雾中的信号');await page.getByRole('button',{name:'保存名字',exact:true}).click();
await page.locator('#themeBtn').click();await page.locator('[data-theme-choice="nocturne"]').click();await page.getByRole('button',{name:'关闭外观选择',exact:true}).click();
await page.reload({waitUntil:'domcontentloaded'});await page.evaluate(()=>scrollTo(0,0));
images.push({name:'夜航最终画面',image:await page.screenshot({fullPage:false})});
await page.getByRole('button',{name:'开始演奏',exact:true}).click();await page.waitForFunction(()=>Stargram.status().tonearm===1);
images.push({name:'夜航最终演奏',image:await page.screenshot({fullPage:false})});
await page.getByRole('button',{name:'暂停演奏',exact:true}).click();await page.waitForFunction(()=>Stargram.status().tonearm===0&&Stargram.status().activeVoices===0);
lightQA.checks.push('all three appearances issue real normal and immersive postcard downloads; main playback returns the tonearm to rest');
return {checks:lightQA.checks,errors:lightQA.errors,cases,images};
