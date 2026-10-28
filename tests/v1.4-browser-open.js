globalThis.pressQA={checks:[],errors:[]};
page.on('pageerror',e=>pressQA.errors.push(String(e)));
await page.goto('http://127.0.0.1:49919/index.html',{waitUntil:'domcontentloaded'});
await page.setViewportSize({width:1440,height:960});
await page.waitForFunction(()=>document.querySelector('#universe').width>0);
await expect(page.locator('.edition')).toContainText('v1.4');
assert.equal(pressQA.errors.length,0);
return {screenshot:await page.screenshot({fullPage:false}),layout:await page.evaluate(()=>({stage:document.querySelector('.observatory').getBoundingClientRect().toJSON(),dock:document.querySelector('.transport').getBoundingClientRect().toJSON(),scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth})),errors:pressQA.errors};
