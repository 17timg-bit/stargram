globalThis.release110={checks:[],errors:[]};page.on('pageerror',e=>release110.errors.push(String(e)));
// Install before the appearance boot script. Real application keys are read only
// for fingerprints; every application read/write goes to this tab's QA session.
await page.addInitScript(()=>{
  const prefix='stargram.qa.release.v110.20261029.',guard=prefix+'finished';
  const keys=['stargram.universe.v1','stargram.discoveries.v1','stargram.collection.v1','stargram.appearance.v1','stargram.appearance.v2'];
  const proto=Storage.prototype,get=proto.getItem,set=proto.setItem,remove=proto.removeItem;
  const hash=value=>{if(value===null)return null;let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);return {length:value.length,hash:h>>>0};};
  const state={prefix,guard,done:get.call(sessionStorage,guard)==='1',original:()=>keys.map(key=>({key,fingerprint:hash(get.call(localStorage,key))}))};
  state.clean=()=>{state.done=true;set.call(sessionStorage,guard,'1');const list=Object.keys(sessionStorage).filter(k=>k.startsWith(prefix)&&k!==guard);list.forEach(k=>remove.call(sessionStorage,k));return list.length;};
  state.finish=()=>{state.done=true;remove.call(sessionStorage,guard);return {original:state.original(),sessionKeysRemaining:Object.keys(sessionStorage).filter(k=>k.startsWith(prefix)).length,persistentKeysRemaining:Object.keys(localStorage).filter(k=>k.startsWith(prefix)).length};};
  window.releaseStorage110=state;
  proto.getItem=function(key){return this===localStorage&&keys.includes(key)?get.call(sessionStorage,prefix+key):get.call(this,key);};
  proto.setItem=function(key,value){if(this===localStorage&&keys.includes(key)){if(!state.done)set.call(sessionStorage,prefix+key,value);return;}return set.call(this,key,value);};
  proto.removeItem=function(key){return this===localStorage&&keys.includes(key)?remove.call(sessionStorage,prefix+key):remove.call(this,key);};
});
let image,baseline,storage,removed=0;
try{
  const response=await page.goto('https://17timg-bit.github.io/stargram/',{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
  baseline=await page.evaluate(()=>releaseStorage110.original());
  await page.setViewportSize({width:1460,height:1000});await expect(page.locator('.edition')).toContainText('v1.10');
  release110.checks.push('public HTTPS page opens v1.10');
  await page.locator('#playBtn').click();await page.waitForFunction(()=>Stargram.status().tonearm===1&&Stargram.status().encounters>=3);
  await page.locator('#playBtn').click();await page.waitForFunction(()=>Stargram.status().tonearm===0&&Stargram.status().activeVoices===0);
  release110.checks.push('public main playback lowers and parks the tonearm and clears voices on pause');
  for(let i=0;i<3;i++)await page.locator('#rotateBtn').click();
  const before=await page.evaluate(()=>Stargram.snapshot());await page.locator('#loomBtn').click();
  expect(await page.evaluate(()=>Stargram.loom().draft)).toEqual(before.tracks[2]);
  await page.locator('#manuscriptClear').click();
  for(const [tick,pitch,accent] of [[1,2,.55],[2,5,1.35],[4,3,1]]){
    await page.locator(`.score-cell[data-tick="${tick}"][data-pitch="${pitch}"]`).click();await page.locator(`[data-manuscript-accent="${accent}"]`).click();
  }
  const written=await page.evaluate(()=>Stargram.loom().draft);
  const heard=t=>Array.from({length:t.length},(_,i)=>({pitch:t.notes[(i-t.shift+t.length)%t.length],accent:t.accents[(i-t.shift+t.length)%t.length]}));
  await page.locator('[data-range-tick="1"]').click();await page.locator('[data-range-tick="4"]').click();
  assert.equal(await page.locator('.score-cell.phrase-selected').count(),40);
  await page.locator('[data-phrase="reverse"]').click();const reversed=await page.evaluate(()=>Stargram.loom().draft);
  expect(heard(reversed).slice(1,5)).toEqual(heard(written).slice(1,5).reverse());
  await page.locator('#manuscriptUndo').click();expect(await page.evaluate(()=>Stargram.loom().draft)).toEqual(written);
  await page.locator('#manuscriptRedo').click();
  await page.locator('[data-phrase="repeat"]').click();const repeated=await page.evaluate(()=>Stargram.loom().draft);
  expect(heard(repeated).slice(5,9)).toEqual(heard(reversed).slice(1,5));
  await expect(page.locator('[data-phrase="repeat"]')).toBeDisabled();
  expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(before);
  release110.checks.push('public phrase selection, audible-order reverse with accents and gaps, whole undo/redo and non-overwriting repeat work at phase=3 without editing the main score');
  await page.locator('#loomListen').click();await page.waitForFunction(()=>Stargram.status().loomPlaying);
  await page.locator('[data-phrase="up"]').click();await page.waitForFunction(()=>!Stargram.status().loomPlaying&&Stargram.status().loomVoices===0);
  const draft=await page.evaluate(()=>Stargram.loom().draft);
  await page.locator('#loomApply').click();const applied=await page.evaluate(()=>Stargram.snapshot());expect(applied.tracks[2]).toEqual(draft);
  await page.locator('#undoBtn').click();expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(before);
  await page.locator('#redoBtn').click();await page.reload({waitUntil:'domcontentloaded'});expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(applied);
  release110.checks.push('public phrase editing cancels B audition, applies through the separate footer, and survives main undo/redo and reload');
  await page.locator('#exportBtn').click();await page.locator('#letterSendBtn').click();const letter=await page.locator('#letterOutput').inputValue();
  expect(await page.evaluate(text=>OrbitLetters.parse(text).state,letter)).toEqual(applied);
  assert.ok(letter.startsWith('https://17timg-bit.github.io/stargram/#letter=SL1.'));
  await page.getByRole('button',{name:'关闭星际来信',exact:true}).click();
  release110.checks.push('the public share link carries the exact edited composition and a playable public address');
  await page.setViewportSize({width:390,height:844});await page.locator('#loomBtn').click();await page.locator('#loomLength').selectOption('24');
  await page.locator('[data-range-tick="20"]').click();await page.locator('[data-range-tick="23"]').click();await expect(page.locator('#phraseRange')).toContainText('21 — 24');
  await page.locator('.phrase-actions').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>{const body=document.querySelector('.loom-scroll').getBoundingClientRect(),footer=document.querySelector('.loom-footer').getBoundingClientRect();return body.bottom<=footer.top+1&&document.querySelector('#loomDialog').scrollWidth<=document.querySelector('#loomDialog').clientWidth+1;}),true);
  await page.keyboard.press('Escape');expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(applied);
  release110.checks.push('public 390px layout reaches the 24th endpoint and keeps the footer outside the editable viewport');
  await page.setViewportSize({width:1460,height:1000});await page.locator('#loomBtn').click();await page.locator('#manuscriptReset').click();
  await page.locator('[data-range-tick="1"]').click();await page.locator('[data-range-tick="8"]').click();await page.locator('.loom-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);
  image=await page.screenshot({fullPage:false});await page.keyboard.press('Escape');
}finally{
  const available=await page.evaluate(()=>typeof releaseStorage110!=='undefined');
  if(available){removed=await page.evaluate(()=>releaseStorage110.clean());await page.reload({waitUntil:'domcontentloaded'});storage=await page.evaluate(()=>releaseStorage110.finish());}
}
expect(storage.original).toEqual(baseline);assert.equal(storage.sessionKeysRemaining,0);assert.equal(storage.persistentKeysRemaining,0);
release110.checks.push('five original storage fingerprints are unchanged and QA keys stay absent after real beforeunload and reload');
assert.equal(release110.errors.length,0);
return {url:'https://17timg-bit.github.io/stargram/',version:'1.10.0',checks:release110.checks,errors:release110.errors,image,storage:{originalUnchanged:true,testKeysRemoved:removed,sessionKeysRemaining:storage.sessionKeysRemaining,persistentKeysRemaining:storage.persistentKeysRemaining}};
