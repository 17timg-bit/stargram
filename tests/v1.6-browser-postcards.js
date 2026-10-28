assert.equal(new URL(page.url()).origin,'http://127.0.0.1:49921');
globalThis.darkQA=globalThis.darkQA||{checks:[],errors:[]};page.on('pageerror',e=>darkQA.errors.push(String(e)));
await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1460,height:923});await page.reload({waitUntil:'domcontentloaded'});
const cases=[],images=[];
for(const [preset,title] of [['rosette','暗房样片_玫瑰航线_v16'],['sisters','暗房样片_昴宿蓝雾_v16'],['polar','暗房样片_极地电台_v16']]){
  await page.locator('#themeBtn').click();await page.locator('.recipe-starts summary').click();await page.locator(`[data-recipe="${preset}"]`).click();
  if(preset==='rosette'){await page.locator('[data-appearance-tab="sky"]').click();await page.locator('#themeDialog').evaluate(e=>e.scrollTo(0,0));images.push({name:'宇宙暗房',image:await page.screenshot({fullPage:false})});}
  await page.keyboard.press('Escape');
  await page.locator('#renameBtn').click();await page.locator('#titleInput').fill(title);await page.getByRole('button',{name:'保存名字',exact:true}).click();
  await page.locator('#exportBtn').click();await page.locator('#posterExportBtn').click();await expect(page.locator('#exportStatus')).toContainText('明信片已交给浏览器下载',{timeout:30000});
  await page.getByRole('button',{name:'关闭导出',exact:true}).click();await expect(page.locator('#toast')).not.toHaveClass(/visible/,{timeout:6000});
  await page.locator('#immerseBtn').click();await page.locator('#captureBtn').click();await expect(page.locator('#toast')).toHaveClass(/visible/,{timeout:30000});await expect(page.locator('#toast')).not.toHaveClass(/visible/,{timeout:6000});await page.keyboard.press('Escape');
  cases.push({preset,title,code:await page.evaluate(()=>Stargram.status().recipeCode),appearance:await page.evaluate(()=>Stargram.status().appearance)});
  await page.reload({waitUntil:'domcontentloaded'});
}
await page.emulateMedia({reducedMotion:'no-preference'});
await page.locator('#renameBtn').click();await page.locator('#titleInput').fill('晨雾中的信号');await page.getByRole('button',{name:'保存名字',exact:true}).click();
await page.locator('#themeBtn').click();await page.locator('.recipe-starts summary').click();await page.locator('[data-recipe="rosette"]').click();await page.keyboard.press('Escape');
await page.reload({waitUntil:'domcontentloaded'});await page.evaluate(()=>scrollTo(0,0));
await page.waitForFunction(()=>{const c=document.getElementById('universe');return c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data[3]===255;});
images.push({name:'玫瑰航线主界面',image:await page.screenshot({fullPage:false})});
await page.locator('#themeBtn').click();await page.locator('[data-appearance-tab="disc"]').click();images.push({name:'星盘材料',image:await page.screenshot({fullPage:false})});await page.keyboard.press('Escape');
darkQA.checks.push('three composed appearances issue actual normal and immersive PNG downloads with printed recipe codes');
assert.equal(darkQA.errors.length,0);return {checks:darkQA.checks,errors:darkQA.errors,cases,images};
