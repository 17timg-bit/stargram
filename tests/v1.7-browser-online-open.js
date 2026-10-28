globalThis.release17={checks:[],errors:[]};page.on('pageerror',e=>release17.errors.push(String(e)));
// Install before navigation: both the appearance boot script and the app must
// use the private QA session rather than the user's five real storage keys.
await page.addInitScript(()=>{
  const prefix='stargram.qa.release.v17.20261028.',guard=prefix+'finished';
  const keys=['stargram.universe.v1','stargram.discoveries.v1','stargram.collection.v1','stargram.appearance.v1','stargram.appearance.v2'];
  const proto=Storage.prototype,get=proto.getItem,set=proto.setItem,remove=proto.removeItem;
  const hash=value=>{if(value===null)return null;let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);return {length:value.length,hash:h>>>0};};
  const state={prefix,guard,done:get.call(sessionStorage,guard)==='1',original:()=>keys.map(key=>({key,fingerprint:hash(get.call(localStorage,key))}))};
  state.clean=()=>{state.done=true;set.call(sessionStorage,guard,'1');const list=Object.keys(sessionStorage).filter(k=>k.startsWith(prefix)&&k!==guard);list.forEach(k=>remove.call(sessionStorage,k));return list.length;};
  state.finish=()=>{state.done=true;remove.call(sessionStorage,guard);return {original:state.original(),sessionKeysRemaining:Object.keys(sessionStorage).filter(k=>k.startsWith(prefix)).length,persistentKeysRemaining:Object.keys(localStorage).filter(k=>k.startsWith(prefix)).length};};
  window.releaseStorage17=state;
  proto.getItem=function(key){return this===localStorage&&keys.includes(key)?get.call(sessionStorage,prefix+key):get.call(this,key);};
  proto.setItem=function(key,value){if(this===localStorage&&keys.includes(key)){if(!state.done)set.call(sessionStorage,prefix+key,value);return;}return set.call(this,key,value);};
  proto.removeItem=function(key){return this===localStorage&&keys.includes(key)?remove.call(sessionStorage,prefix+key):remove.call(this,key);};
});
const response=await page.goto('https://17timg-bit.github.io/stargram/',{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
await page.setViewportSize({width:1460,height:923});await expect(page.locator('.edition')).toContainText('v1.7');globalThis.release17Baseline=await page.evaluate(()=>releaseStorage17.original());
release17.checks.push('anonymous HTTPS page opens the published v1.7 application');
await page.locator('#playBtn').click();await page.waitForFunction(()=>Stargram.status().tonearm===1&&Stargram.status().encounters>=6,null,{timeout:20000});assert.equal(await page.evaluate(()=>Stargram.status().audioState),'running');
await page.locator('#playBtn').click();await page.waitForFunction(()=>Stargram.status().tonearm===0&&Stargram.status().activeVoices===0);
release17.checks.push('public playback starts Web Audio, lowers the tonearm and clears voices on pause');
const song=await page.evaluate(()=>Stargram.snapshot());await page.locator('#loomBtn').click();expect(await page.evaluate(()=>Stargram.loom().draft)).toEqual(song.tracks[2]);
await page.locator('#manuscriptGrid [data-tick="1"][data-pitch="7"]').click();await page.locator('[data-manuscript-accent="1.35"]').click();const draft=await page.evaluate(()=>Stargram.loom().draft);
await page.locator('#loomGenerator summary').click();await page.locator('#loomCount').fill('7');expect(await page.evaluate(()=>Stargram.loom().draft)).toEqual(draft);await page.locator('#loomGenerator summary').click();
expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(song);await page.keyboard.press('Escape');await page.locator('#loomBtn').click();assert.equal(await page.evaluate(()=>Stargram.loom().resumed),true);expect(await page.evaluate(()=>Stargram.loom().draft)).toEqual(draft);
release17.checks.push('public manuscript starts from the real track, preserves handwriting while generator options change, and resumes it without changing the song');
await page.locator('#loomOriginalListen').click();await page.waitForFunction(()=>Stargram.status().loomPlaying&&Stargram.loom().audition==='original',null,{timeout:30000});
await page.locator('#loomListen').click();await page.waitForFunction(()=>Stargram.status().loomPlaying&&Stargram.loom().audition==='draft'&&Stargram.status().loomVoices===1,null,{timeout:30000});
await page.locator('#loomListen').click();await page.waitForFunction(()=>Stargram.status().loomVoices===0);
release17.checks.push('public A/B auditions switch between original and draft and stop all audition sources');
await page.locator('#loomApply').click();expect(await page.evaluate(()=>Stargram.snapshot().tracks[2])).toEqual(draft);await page.locator('#undoBtn').click();expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(song);await page.locator('#redoBtn').click();
release17.checks.push('public manuscript applies to one track with global undo and redo');
assert.equal(release17.errors.length,0);return {checks:release17.checks,errors:release17.errors,baseline:release17Baseline};
