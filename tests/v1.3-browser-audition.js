assert.equal(new URL(page.url()).origin,'http://127.0.0.1:49857');
if(await page.locator('#loomDialog').isVisible())await page.getByRole('button',{name:'关闭织星台',exact:true}).click();
await page.evaluate(()=>OrbitAudio.renderWav=Stargram.exportWav);
await page.getByRole('button',{name:'开始演奏',exact:true}).click();
await page.waitForFunction(()=>Stargram.status().encounters>=3,null,{timeout:15000});
await page.getByRole('button',{name:'✧ 织星台',exact:true}).click();
await page.waitForFunction(()=>!Stargram.status().playing&&Stargram.status().activeVoices===0);
const before=await page.evaluate(()=>Stargram.snapshot());
await page.locator('#loomCount').fill('5');
await page.getByRole('button',{name:'回旋',exact:true}).click();
await page.evaluate(()=>{
  window.loomCapture=null;
  const render=OrbitAudio.renderWav;
  OrbitAudio.renderWav=async(state,ticks)=>{
    const result=await render(state,ticks);const bytes=new Uint8Array(result.bytes);
    let hash=2166136261;for(const v of bytes)hash=Math.imul(hash^v,16777619);
    // decodeAudioData transfers the input buffer; keep a separate verification copy.
    window.loomCaptureBytes=result.bytes.slice(0);
    window.loomCapture={state:OrbitCore.clone(state),ticks,hash:hash>>>0,seconds:result.seconds,peak:result.peak};return result;
  };
});
await page.getByRole('button',{name:'▷ 试听这一圈',exact:true}).click();
await page.waitForFunction(()=>Stargram.status().loomPlaying,null,{timeout:30000});
assert.equal(await page.evaluate(()=>Stargram.status().loomVoices),1);
await expect(page.locator('#loomPosition')).toContainText('格');
const audio=await page.evaluate(async()=>{
  const original=Stargram.snapshot(),current=Stargram.loom(),expected=OrbitCore.clone(original);
  expected.tracks[current.index]=current.draft;
  expected.tracks.forEach((t,i)=>{t.muted=i!==current.index;t.solo=false;});
  const reference=await Stargram.exportWav(expected,current.draft.length),bytes=new Uint8Array(reference.bytes);
  const actualBytes=new Uint8Array(loomCaptureBytes),actual=new DataView(loomCaptureBytes),other=new DataView(reference.bytes);
  let maxPcmDifference=0,squareDifference=0;
  for(let i=44;i<actual.byteLength;i+=2){const d=Math.abs(actual.getInt16(i,true)-other.getInt16(i,true));maxPcmDifference=Math.max(maxPcmDifference,d);squareDifference+=d*d;}
  return {render:loomCapture,expected,comparison:{bytesIdentical:bytes.every((v,i)=>v===actualBytes[i]),sameByteLength:actual.byteLength===other.byteLength,maxPcmDifference,rmsPcmDifference:Math.sqrt(squareDifference/((actual.byteLength-44)/2))}};
});
expect(audio.render.state).toEqual(audio.expected);assert.equal(audio.comparison.sameByteLength,true);assert.ok(audio.comparison.maxPcmDifference<=2);
assert.ok(audio.render.peak>0&&audio.render.peak<=.881);
await page.getByRole('button',{name:'■ 停止试听',exact:true}).click();
await page.waitForFunction(()=>Stargram.status().loomVoices===0);
expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(before);
loomQA.checks.push('opening pauses the main score; the audition renders the exact draft with the shared WAV engine; stopping clears its source without editing the score');
await page.evaluate(()=>{
  window.loomPreviousRender=OrbitAudio.renderWav;window.loomHeldReady=false;window.loomHeldDone=false;
  OrbitAudio.renderWav=async(...args)=>{
    const result=await loomPreviousRender(...args);loomHeldReady=true;
    await new Promise(resolve=>window.releaseLoomHold=resolve);loomHeldDone=true;return result;
  };
});
await page.getByRole('button',{name:'▷ 试听这一圈',exact:true}).click();
await page.waitForFunction(()=>window.loomHeldReady,null,{timeout:30000});
assert.equal(await page.evaluate(()=>Stargram.status().loomPreparing),true);
await page.getByRole('button',{name:'关闭织星台',exact:true}).click();
await page.evaluate(()=>{OrbitAudio.renderWav=loomPreviousRender;releaseLoomHold();});
await page.waitForFunction(()=>window.loomHeldDone&&!Stargram.status().loomPlaying&&!Stargram.status().loomPreparing&&Stargram.status().loomVoices===0);
await page.getByRole('button',{name:'✧ 织星台',exact:true}).click();
await page.getByLabel('一圈长度',{exact:true}).selectOption('8');
await page.locator('#loomCount').fill('3');
await page.getByRole('button',{name:'▷ 试听这一圈',exact:true}).click();
await page.waitForFunction(()=>Stargram.status().loomPlaying,null,{timeout:30000});
await page.waitForFunction(()=>!Stargram.status().loomPlaying&&Stargram.status().loomVoices===0,null,{timeout:15000});
await expect(page.locator('#loomListen')).toHaveText('▷ 试听这一圈');
await page.keyboard.press('Escape');
assert.equal(await page.evaluate(()=>Stargram.status().loomOpen),false);
loomQA.checks.push('closing during preparation cannot start a late audition; an eight-step audition finishes and releases its node; Escape closes the loom');
assert.equal(loomQA.errors.length,0);
return {checks:loomQA.checks,errors:loomQA.errors,audio};
