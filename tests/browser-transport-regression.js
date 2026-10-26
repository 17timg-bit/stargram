await page.reload({waitUntil:'domcontentloaded'});
await page.getByRole('button',{name:'开始演奏',exact:true}).click();
await page.waitForFunction(()=>Stargram.status().encounters>=6,{timeout:12000});
await page.getByRole('button',{name:/潮汐来信/}).click();
await page.waitForFunction(()=>Stargram.status().phase>=3,{timeout:5000});
await page.getByRole('button',{name:'暂停演奏',exact:true}).click();
await page.waitForFunction(()=>Stargram.status().activeVoices===0,{timeout:3000});
qa.checks.push('switch preset while playing; pause cancels all scheduled voices');
for(const name of ['晨雾中的信号','潮汐来信','夜航的玻璃船']){
  await page.getByRole('button',{name:new RegExp(name)}).click();
  await page.getByRole('button',{name:/带走这片星空/}).click();
  await page.getByRole('button',{name:/继续编曲/}).click();
  await page.getByRole('button',{name:'关闭导出',exact:true}).click();
}
await page.getByRole('button',{name:/晨雾中的信号/}).click();
await page.getByRole('button',{name:'选择浮光轨道',exact:true}).click();
return {checks:qa.checks,errors:qa.errors,status:await page.evaluate(()=>Stargram.status())};
