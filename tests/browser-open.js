await page.goto('file:///D:/学习/project/自由发挥/星轨留声机/打开星轨留声机.html', {waitUntil:'domcontentloaded'});
return { observation: await tabbit.observe({frames:'none',maxChars:6000}), screenshot: await page.screenshot({fullPage:false}) };
