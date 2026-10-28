// Dedicated tab-session adapter: the app never writes the user's actual localStorage keys.
page.setDefaultTimeout(10000);
globalThis.releaseErrors=[];
page.on('pageerror',e=>releaseErrors.push(String(e)));
await page.addInitScript(()=>{
  const prefix='stargram.qa.release.v13.20261028.';
  const keys=['stargram.universe.v1','stargram.discoveries.v1','stargram.collection.v1'];
  const prototype=Storage.prototype,get=prototype.getItem,set=prototype.setItem,remove=prototype.removeItem;
  const fingerprint=value=>{
    if(value===null)return null;
    let hash=2166136261;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);
    return {length:value.length,hash:hash>>>0};
  };
  window.releaseStorage={prefix,done:false,current:()=>keys.map(key=>({key,fingerprint:fingerprint(get.call(localStorage,key))}))};
  prototype.getItem=function(key){return this===localStorage&&keys.includes(key)?get.call(sessionStorage,prefix+key):get.call(this,key);};
  prototype.setItem=function(key,value){
    if(this===localStorage&&keys.includes(key)){if(!releaseStorage.done)set.call(sessionStorage,prefix+key,value);return;}
    return set.call(this,key,value);
  };
  prototype.removeItem=function(key){return this===localStorage&&keys.includes(key)?remove.call(sessionStorage,prefix+key):remove.call(this,key);};
});
const url='https://17timg-bit.github.io/stargram/';
const response=await page.goto(url,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
await page.setViewportSize({width:1440,height:900});
await expect(page).toHaveTitle('星轨留声机 · STARGRAM');
await expect(page.locator('.edition')).toContainText('v1.3');
const baseline=await page.evaluate(()=>releaseStorage.current());
await page.getByRole('button',{name:/晨雾中的信号/}).click();
await page.getByRole('button',{name:'选择浮光轨道',exact:true}).click();
const before=await page.evaluate(()=>Stargram.snapshot());
await page.getByRole('button',{name:'✧ 织星台',exact:true}).click();
await page.getByLabel('一圈长度',{exact:true}).selectOption('12');
await page.locator('#loomCount').fill('7');
await page.getByRole('button',{name:'漫游',exact:true}).click();
const draft=await page.evaluate(()=>Stargram.loom().draft);
expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(before);
assert.equal(draft.notes.filter(p=>p>=0).length,7);
await page.getByRole('button',{name:'▷ 试听这一圈',exact:true}).click();
await page.waitForFunction(()=>Stargram.status().loomPlaying,null,{timeout:30000});
assert.equal(await page.evaluate(()=>Stargram.status().loomVoices),1);
await page.getByRole('button',{name:'■ 停止试听',exact:true}).click();
await page.waitForFunction(()=>Stargram.status().loomVoices===0);
const loomScreenshot=await page.screenshot({fullPage:false});
await page.getByRole('button',{name:/种进这条轨道/}).click();
const after=await page.evaluate(()=>Stargram.snapshot());expect(after.tracks[2]).toEqual(draft);
for(const i of [0,1,3,4])expect(after.tracks[i]).toEqual(before.tracks[i]);
await page.getByRole('button',{name:'↶ 撤销',exact:true}).click();expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(before);
await page.getByRole('button',{name:'↷ 重做',exact:true}).click();expect(await page.evaluate(()=>Stargram.snapshot())).toEqual(after);
await page.getByRole('button',{name:'开始演奏',exact:true}).click();
await page.waitForFunction(()=>Stargram.status().encounters>=6,null,{timeout:20000});
assert.equal(await page.evaluate(()=>Stargram.status().audioState),'running');
await page.getByRole('button',{name:'暂停演奏',exact:true}).click();
await page.waitForFunction(()=>Stargram.status().activeVoices===0,null,{timeout:5000});
await page.getByRole('button',{name:/我的星图书架/}).click();
await page.getByRole('textbox',{name:'这次相遇的名字',exact:true}).fill('发布验收 · 织星台');
await page.getByRole('button',{name:'收藏当前星图',exact:true}).click();
await page.getByRole('button',{name:'打开星图 发布验收 · 织星台',exact:true}).click();
await page.reload({waitUntil:'domcontentloaded'});
assert.equal(await page.evaluate(()=>Stargram.snapshot().title),'发布验收 · 织星台');
expect(await page.evaluate(()=>Stargram.snapshot().tracks[2])).toEqual(draft);
assert.equal(await page.evaluate(()=>Stargram.collection().length),1);
const workbenchScreenshot=await page.screenshot({fullPage:false});
const cleanup=await page.evaluate(()=>{
  releaseStorage.done=true;
  const keys=Object.keys(sessionStorage).filter(key=>key.startsWith(releaseStorage.prefix));
  keys.forEach(key=>sessionStorage.removeItem(key));
  return {removed:keys.length,original:releaseStorage.current()};
});
expect(cleanup.original).toEqual(baseline);
// A real reload exercises the app's beforeunload autosave after cleanup.
await page.reload({waitUntil:'domcontentloaded'});
const storage=await page.evaluate(()=>{
  releaseStorage.done=true;
  return {original:releaseStorage.current(),sessionKeysRemaining:Object.keys(sessionStorage).filter(k=>k.startsWith(releaseStorage.prefix)).length,persistentKeysRemaining:Object.keys(localStorage).filter(k=>k.startsWith(releaseStorage.prefix)).length};
});
expect(storage.original).toEqual(baseline);assert.equal(storage.sessionKeysRemaining,0);assert.equal(storage.persistentKeysRemaining,0);
assert.equal(releaseErrors.length,0);
return {url,httpStatus:response.status(),version:'1.3.0',checks:['public v1.3 opens','loom draft preserves the live score until application','draft audition starts and stops cleanly','application, one undo and redo preserve the correct tracks','main playback runs and pause clears voices','shelf and complete draft persist across reload','original storage fingerprints are unchanged and QA keys stay absent after real beforeunload'],storage:{originalUnchanged:true,testKeysRemoved:cleanup.removed,sessionKeysRemaining:storage.sessionKeysRemaining,persistentKeysRemaining:storage.persistentKeysRemaining},errors:releaseErrors,loomScreenshot,workbenchScreenshot};
