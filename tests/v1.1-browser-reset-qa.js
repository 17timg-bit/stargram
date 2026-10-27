await page.getByRole('button',{name:/我的星图书架/}).click();
for(const name of ['薄荷色的回声','玻璃海上的灯塔']){
  const remove=page.getByRole('button',{name:'删除收藏 '+name,exact:true});
  if(await remove.count())await remove.click();
}
await page.getByRole('button',{name:'关闭星图书架',exact:true}).click();
await page.reload({waitUntil:'domcontentloaded'});
await page.getByRole('button',{name:/晨雾中的信号/}).click();
v11.checks=[];
return {version:await page.evaluate(()=>Stargram.snapshot().version),errors:v11.errors};
