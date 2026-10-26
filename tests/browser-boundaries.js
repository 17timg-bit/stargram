await page.reload({waitUntil:'domcontentloaded'});
await page.getByRole('button',{name:/晨雾中的信号/}).click();
// Native keyboard edits, rather than directly assigning range values.
await page.getByRole('slider',{name:'时间流速'}).focus();await page.keyboard.press('Home');
assert.equal(await page.evaluate(()=>Stargram.snapshot().bpm),48);
await page.keyboard.press('End');assert.equal(await page.evaluate(()=>Stargram.snapshot().bpm),160);
await page.getByRole('button',{name:'↶ 撤销',exact:true}).click();
assert.equal(await page.evaluate(()=>Stargram.snapshot().bpm),48);
await page.getByRole('button',{name:/晨雾中的信号/}).click();
await page.getByRole('combobox',{name:'星空的色彩'}).selectOption('tide');
assert.equal(await page.evaluate(()=>Stargram.snapshot().scale),'tide');
qa.checks.push('keyboard tempo limits, undo and scale selection');
const audio=await page.evaluate(async()=>{
  const s=OrbitCore.preset();s.volume=1;s.space=1;s.bpm=160;s.tracks.forEach(t=>{t.gain=1;t.notes.fill(4);});
  const loud=await Stargram.exportWav(s,32),v=new DataView(loud.bytes);let clipped=0,nonzero=0;
  for(let i=44;i<v.byteLength;i+=2){const n=v.getInt16(i,true);if(Math.abs(n)>=32767)clipped++;if(n!==0)nonzero++;}
  s.tracks.forEach(t=>t.muted=true);const silent=await Stargram.exportWav(s,8),z=new DataView(silent.bytes);let silentPeak=0;
  for(let i=44;i<z.byteLength;i+=2)silentPeak=Math.max(silentPeak,Math.abs(z.getInt16(i,true)));
  return {densePeak:loud.peak,clipped,nonzero,silentPeak};
});
assert.ok(audio.densePeak<=.881);assert.equal(audio.clipped,0);assert.ok(audio.nonzero>1000);assert.equal(audio.silentPeak,0);
qa.checks.push('dense full-volume audio has no clipped PCM; muted tracks render exact silence');
await page.getByRole('button',{name:/晨雾中的信号/}).click();
await page.getByRole('button',{name:'开始演奏',exact:true}).click();
await page.waitForFunction(()=>Stargram.status().phase>=18,{timeout:12000});
await page.getByRole('button',{name:'暂停演奏',exact:true}).click();
// Actual tab activation depends on the host foreground policy; do not simulate
// a visibility event and report that as an operating-system tab-switch test.
return {audio,checks:qa.checks,errors:qa.errors,screenshot:await page.screenshot({fullPage:false})};
