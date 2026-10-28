globalThis.darkQA={checks:[],errors:[]};
page.on('pageerror',e=>darkQA.errors.push(String(e)));
await page.goto('http://127.0.0.1:49921/index.html',{waitUntil:'domcontentloaded'});
await page.setViewportSize({width:1460,height:923});
await page.waitForFunction(()=>window.Stargram&&Stargram.status().geometry.max>30);
await page.locator('#themeBtn').click();
await expect(page.locator('#darkroomCanvas')).toBeVisible();
return {image:await page.screenshot({fullPage:false}),errors:darkQA.errors,status:await page.evaluate(()=>Stargram.status())};
