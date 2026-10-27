await page.getByRole('button',{name:/我的星图书架/}).click();
const shelfBox=await page.locator('#shelfDialog').boundingBox();assert.ok(shelfBox.width<=740);
globalThis.shelfImage=await page.screenshot({fullPage:false});
await page.getByRole('button',{name:'关闭星图书架',exact:true}).click();
await page.getByRole('button',{name:'⛶ 沉浸',exact:true}).click();
await page.getByRole('button',{name:'开始演奏',exact:true}).click();
await page.waitForFunction(()=>Stargram.status().phase>=5,null,{timeout:5000});
await page.getByRole('button',{name:'暂停演奏',exact:true}).click();
globalThis.immersiveImage=await page.screenshot({fullPage:false});
await page.getByRole('button',{name:'⊡ 返回工作台',exact:true}).click();
const layouts=[];
for(const size of [{width:1440,height:900},{width:1100,height:768},{width:800,height:900},{width:390,height:844}]){
  await page.setViewportSize(size);
  const layout=await page.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect().toJSON();return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,workspace:r('.workspace'),footer:r('.transport'),stage:r('.observatory'),inspector:r('.inspector')};});
  assert.ok(layout.scrollWidth<=layout.width);assert.ok(layout.workspace.bottom<=layout.footer.top+1);
  if(size.width<=650)assert.ok(layout.stage.bottom<=layout.inspector.top+1);
  layouts.push(layout);
}
globalThis.mobileImage=await page.screenshot({fullPage:true});
await page.getByRole('button',{name:/我的星图书架/}).click();
const dialog=await page.locator('#shelfDialog').boundingBox();assert.ok(dialog.width<=390);assert.ok(dialog.x>=0);
await expect(page.getByRole('button',{name:'打开星图 薄荷色的回声',exact:true})).toBeVisible();
await page.getByRole('button',{name:'关闭星图书架',exact:true}).click();
await page.setViewportSize({width:1440,height:900});
v11.checks.push('workbench layouts at 1440/1100/800/390 widths have no overflow or footer overlap; mobile collection fits viewport');
return {layouts,checks:v11.checks,errors:v11.errors,images:{shelf:shelfImage,immersive:immersiveImage,mobile:mobileImage}};
