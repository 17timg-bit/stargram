await page.goto('http://127.0.0.1:49925/',{waitUntil:'domcontentloaded'});
return {title:await page.title(),edition:await page.locator('.edition').innerText(),app:await page.evaluate(()=>!!window.Stargram)};
