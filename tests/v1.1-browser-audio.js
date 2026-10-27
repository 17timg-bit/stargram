await page.reload({waitUntil:'domcontentloaded'});
globalThis.v11Audio=await page.evaluate(async()=>{
  const rms=bytes=>{const v=new DataView(bytes);let sum=0,peak=0,clipped=0;for(let i=44;i<v.byteLength;i+=2){const n=v.getInt16(i,true);sum+=n*n;peak=Math.max(peak,Math.abs(n));if(Math.abs(n)>=32767)clipped++;}return {rms:Math.sqrt(sum/((v.byteLength-44)/2))/32768,peak:peak/32768,clipped};};
  const s=OrbitCore.preset();s.volume=.5;s.space=0;s.tracks.forEach(t=>t.notes.fill(-1));s.tracks[2].notes[0]=2;s.tracks[2].gain=.1;s.tracks[2].accents[0]=.55;
  const light=rms((await Stargram.exportWav(s,8)).bytes);s.tracks[2].accents[0]=1.35;
  const strong=rms((await Stargram.exportWav(s,8)).bytes);
  const solo=OrbitCore.preset();solo.tracks[2].solo=true;const a=await Stargram.exportWav(solo,8);
  solo.tracks[2].solo=false;solo.tracks.forEach((t,i)=>t.muted=i!==2);const b=await Stargram.exportWav(solo,8);
  const x=new DataView(a.bytes),y=new DataView(b.bytes);let mismatch=0,maxPcmDelta=0;for(let i=44;i<x.byteLength;i+=2){const delta=Math.abs(x.getInt16(i,true)-y.getInt16(i,true));if(delta)mismatch++;maxPcmDelta=Math.max(maxPcmDelta,delta);}
  const dense=OrbitCore.preset();dense.volume=1;dense.space=1;dense.bpm=160;dense.tracks.forEach(t=>{t.gain=1;t.notes.fill(4);t.accents.fill(1.35);});
  const loud=await Stargram.exportWav(dense,16),denseMetrics=rms(loud.bytes);
  return {light,strong,rmsRatio:strong.rms/light.rms,soloEqualsManualMute:mismatch===0,soloPcmDelta:maxPcmDelta,soloDifferentSamples:mismatch,dense:{...denseMetrics,renderPeak:loud.peak},sampleRate:loud.sampleRate};
});
const results=v11Audio;
assert.ok(results.rmsRatio>1.7);assert.equal(results.light.clipped,0);assert.equal(results.strong.clipped,0);assert.ok(results.soloPcmDelta<=1);assert.equal(results.dense.clipped,0);assert.ok(results.dense.peak<=.881);
v11.checks.push('strong notes render louder; solo and manual isolation differ by at most one PCM16 rounding unit; dense full-accent render has no clipping');
await page.getByRole('button',{name:/我的星图书架/}).click();
await page.getByRole('button',{name:'打开星图 薄荷色的回声',exact:true}).click();
await page.getByRole('button',{name:/带走这片星空/}).click();
await page.getByRole('button',{name:/一段音乐/}).click();
await page.waitForFunction(()=>document.getElementById('exportStatus').textContent.startsWith('WAV 已交给'),null,{timeout:30000});
await page.getByRole('button',{name:/继续编曲/}).click();
await page.getByRole('button',{name:/保存这张星图/}).click();
await page.getByRole('button',{name:'关闭导出',exact:true}).click();
v11.checks.push('expressive WAV, MIDI and v2 map exports requested from real UI');
return {audio:results,checks:v11.checks,errors:v11.errors};
