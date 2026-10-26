const statusBefore=await page.evaluate(()=>Stargram.status());
for(const p of pages())if(p!==page&&p.url()==='about:blank')await p.close();
if(statusBefore.playing)await page.getByRole('button',{name:'暂停演奏',exact:true}).click();
const audio=await page.evaluate(async()=>{
  const s=OrbitCore.preset();s.volume=1;s.space=1;s.bpm=160;s.tracks.forEach(t=>{t.gain=1;t.notes.fill(4);});
  const loud=await Stargram.exportWav(s,16),v=new DataView(loud.bytes);let clipped=0,nonzero=0;
  for(let i=44;i<v.byteLength;i+=2){const n=v.getInt16(i,true);if(Math.abs(n)>=32767)clipped++;if(n!==0)nonzero++;}
  s.tracks.forEach(t=>t.muted=true);const silent=await Stargram.exportWav(s,8),z=new DataView(silent.bytes);let silentPeak=0;
  for(let i=44;i<z.byteLength;i+=2)silentPeak=Math.max(silentPeak,Math.abs(z.getInt16(i,true)));
  return {densePeak:loud.peak,clipped,nonzero,silentPeak};
});
assert.ok(audio.densePeak<=.881);assert.equal(audio.clipped,0);assert.ok(audio.nonzero>1000);assert.equal(audio.silentPeak,0);
await page.getByRole('button',{name:/晨雾中的信号/}).click();
await page.getByRole('button',{name:'选择浮光轨道',exact:true}).click();
await page.getByRole('button',{name:'开始演奏',exact:true}).click();
await page.waitForFunction(()=>Stargram.status().encounters>=32&&Stargram.status().phase>=18,{timeout:20000});
await page.getByRole('button',{name:'暂停演奏',exact:true}).click();
await page.mouse.move(5,5);
const desktop=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,stage:document.querySelector('.observatory').getBoundingClientRect().toJSON(),footer:document.querySelector('.transport').getBoundingClientRect().toJSON(),inspectorHeight:document.querySelector('.inspector').clientHeight,inspectorScroll:document.querySelector('.inspector').scrollHeight}));
assert.ok(desktop.stage.bottom<=desktop.footer.top+1);assert.ok(desktop.scrollWidth<=desktop.width);
return {audio,checks:qa.checks,errors:qa.errors,status:await page.evaluate(()=>Stargram.status()),desktop,screenshot:await page.screenshot({fullPage:false})};
