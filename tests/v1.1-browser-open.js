globalThis.v11={errors:[],checks:[]};
page.on('pageerror',error=>v11.errors.push(String(error)));
// Start a loopback server on a dedicated QA port before this suite. A copied
// file:// entry can share storage with the user's real offline application.
await page.goto('http://127.0.0.1:49741/index.html',{waitUntil:'domcontentloaded'});
await page.setViewportSize({width:1440,height:900});
await page.getByRole('button',{name:/晨雾中的信号/}).click();
return {observation:await tabbit.observe({frames:'none',maxChars:4500}),errors:v11.errors,screenshot:await page.screenshot({fullPage:false})};
