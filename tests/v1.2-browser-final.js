assert.equal(new URL(page.url()).origin,'http://127.0.0.1:49831');
await page.reload({waitUntil:'domcontentloaded'});
const mobile=[];
for(const width of [390,320]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(()=>scrollTo(0,0));
  const sizes=await page.locator('.preset strong').evaluateAll(elements=>elements.map(e=>({font:parseFloat(getComputedStyle(e).fontSize),box:e.getBoundingClientRect().toJSON()})));
  assert.ok(sizes.every(s=>s.font>=10&&s.box.x>=0&&s.box.right<=width));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  mobile.push({width,sizes,screenshot:await page.screenshot({fullPage:true})});
}
await page.setViewportSize({width:1440,height:900});
await page.emulateMedia({reducedMotion:'reduce'});
await page.reload({waitUntil:'domcontentloaded'});
await page.getByRole('button',{name:'为星图命名',exact:true}).click();
await page.getByRole('textbox',{name:/星图名称/}).fill('夜色观测室');
await page.getByRole('button',{name:'保存名字',exact:true}).click();
await page.getByRole('button',{name:'⤓ 拍张照',exact:true}).click();
await expect(page.locator('#toast')).toHaveText('已把星空拍成一张明信片',{timeout:30000});
await expect(page.locator('#toast')).not.toHaveClass(/visible/,{timeout:6000});
await page.getByRole('button',{name:'⛶ 沉浸',exact:true}).click();
await page.getByRole('button',{name:'⤓ 拍张照',exact:true}).click();
await expect(page.locator('#toast')).toHaveClass(/visible/,{timeout:30000});
await page.keyboard.press('Escape');
await page.emulateMedia({reducedMotion:'no-preference'});
await page.reload({waitUntil:'domcontentloaded'});
return {mobile,postcardDownloadsRequested:2,status:await page.evaluate(()=>Stargram.status())};
