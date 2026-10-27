globalThis.v11={errors:[],checks:[]};
page.on('pageerror',error=>v11.errors.push(String(error)));
await page.goto('file:///D:/学习/project/自由发挥/星轨留声机/验证记录/v1.1.0/测试入口.html',{waitUntil:'domcontentloaded'});
globalThis.v11Backup=await page.evaluate(()=>Object.fromEntries(['stargram.universe.v1','stargram.discoveries.v1','stargram.collection.v1'].map(key=>[key,localStorage.getItem(key)])));
await page.setViewportSize({width:1440,height:900});
await page.getByRole('button',{name:/晨雾中的信号/}).click();
return {observation:await tabbit.observe({frames:'none',maxChars:4500}),errors:v11.errors,screenshot:await page.screenshot({fullPage:false})};
