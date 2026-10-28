globalThis.lightQA = { checks:[], errors:[] };
page.on('pageerror', e => lightQA.errors.push(String(e)));
await page.goto('http://127.0.0.1:49920/index.html', {waitUntil:'domcontentloaded'});
await page.setViewportSize({width:1460,height:823});
await page.waitForFunction(() => window.Stargram && Stargram.status().geometry.max > 30);
return {screenshot:await page.screenshot({fullPage:false}),status:await page.evaluate(() => Stargram.status()),errors:lightQA.errors};
