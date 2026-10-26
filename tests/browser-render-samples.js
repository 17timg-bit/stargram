const results=[];
for(const name of ['晨雾中的信号','潮汐来信','夜航的玻璃船']){
  if(await page.locator('#exportDialog').isVisible())await page.getByRole('button',{name:'关闭导出',exact:true}).click();
  await page.getByRole('button',{name:new RegExp(name)}).click();
  await page.getByRole('button',{name:/带走这片星空/}).click();
  await page.getByRole('button',{name:/一段音乐/}).click();
  await page.waitForFunction(()=>document.getElementById('exportStatus').textContent.startsWith('WAV 已交给'),{timeout:30000});
  results.push(await page.locator('#exportStatus').textContent());
  await page.getByRole('button',{name:/继续编曲/}).click();
  await page.getByRole('button',{name:/保存这张星图/}).click();
}
await page.getByRole('button',{name:'关闭导出',exact:true}).click();
return {results,errors:qa.errors};
