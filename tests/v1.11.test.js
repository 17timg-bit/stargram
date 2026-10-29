'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core'),M=require('../src/manuscript'),D=require('../src/drafts');
function storage(){const data=new Map();return {data,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v))};}
function sample(title='明天再写的旋律'){
  const base=C.generate(14);base.tracks[2].shift=5;base.tracks[2].gain=.317;const doc=new M.Manuscript(base.tracks[2]);doc.resize(24);doc.clear();doc.write(1,8,.55);doc.write(23,2,1.35);
  return {title,base,index:2,draft:doc.snapshot()};
}
test('saved manuscripts reload as independent exact source and draft snapshots',()=>{
  const disk=storage(),store=new D.Store(disk),data=sample(),original=C.clone(data),result=store.save(data);assert.equal(store.size,1);data.draft.notes.fill(0);data.base.bpm=160;
  const fresh=new D.Store(disk),entry=fresh.load(result.entry.id);assert.deepEqual(D.content(entry),original);entry.base.title='changed';assert.equal(fresh.entries[0].base.title,original.base.title);assert.equal(result.entry.revision,1);
});
test('duplicate snapshots do not consume capacity or write a new revision',()=>{
  const disk=storage(),store=new D.Store(disk),data=sample(),one=store.save(data),raw=disk.getItem(D.KEY);assert.equal(store.save(data).duplicate,true);assert.equal(store.save(data,{id:one.entry.id,revision:1}).duplicate,true);assert.equal(store.size,1);assert.equal(disk.getItem(D.KEY),raw);
});
test('listener volume changes alone do not create duplicate pages or artificial revisions',()=>{
  const disk=storage(),store=new D.Store(disk),data=sample(),first=store.save(data).entry,raw=disk.getItem(D.KEY);
  const changed=C.clone(data);changed.base.volume=.17;
  assert.equal(store.save(changed).duplicate,true);assert.equal(store.save(changed,{id:first.id,revision:1}).duplicate,true);assert.equal(store.size,1);assert.equal(disk.getItem(D.KEY),raw);
  changed.base.bpm+=1;assert.equal(store.save(changed,{id:first.id,revision:1}).entry.revision,2);
});
test('updating a linked revision preserves identity and source, while a stale revision cannot overwrite it',()=>{
  const disk=storage(),a=new D.Store(disk),first=a.save(sample()).entry,b=new D.Store(disk),changed=sample('后来写下的一页');changed.draft.notes[0]=7;
  const update=b.save(changed,{id:first.id,revision:1}).entry;assert.equal(update.id,first.id);assert.equal(update.created,first.created);assert.equal(update.revision,2);const raw=disk.getItem(D.KEY);
  assert.throws(()=>a.save(sample(),{id:first.id,revision:1}),/其他窗口/);assert.equal(disk.getItem(D.KEY),raw);assert.equal(a.size,1);assert.throws(()=>a.load(first.id,1));assert.deepEqual(a.load(first.id,2),update);
});
test('each mutation reads the current drawer so sequential changes from another instance are preserved',()=>{
  const disk=storage(),a=new D.Store(disk),b=new D.Store(disk);const one=a.save(sample('一')).entry;b.save(sample('二'));a.save(sample('三'));assert.equal(new D.Store(disk).size,3);
  b.remove(one.id,one.revision);assert.equal(new D.Store(disk).size,2);a.refresh();assert.equal(a.size,2);
});
test('full drawers never evict old manuscripts and failed writes leave storage and memory intact',()=>{
  const disk=storage(),store=new D.Store(disk);for(let i=0;i<D.LIMIT;i++)store.save(sample('页'+i));const raw=disk.getItem(D.KEY),before=store.entries;
  assert.throws(()=>store.save(sample('第十三页')),/12页/);assert.deepEqual(store.entries,before);assert.equal(disk.getItem(D.KEY),raw);
  disk.setItem=()=>{throw new Error('quota');};assert.throws(()=>store.save({...D.content(before[0]),title:'修订'},{id:before[0].id,revision:1}),/没有保存成功/);assert.deepEqual(store.entries,before);assert.equal(disk.getItem(D.KEY),raw);
});
test('corrupt, oversized and unavailable storage cannot be overwritten or clear previously readable memory',()=>{
  const disk=storage(),store=new D.Store(disk);store.save(sample());const previous=store.entries;
  for(const raw of ['not-json','',JSON.stringify({version:2,entries:[]}),JSON.stringify({version:1,entries:[{}]}),'x'.repeat(200001)]){
    disk.data.set(D.KEY,raw);assert.equal(store.refresh(),false);assert.deepEqual(store.entries,previous);assert.throws(()=>store.save(sample()),/读取失败/);assert.equal(disk.getItem(D.KEY),raw);
  }
  const missing=new D.Store(null);assert.equal(missing.readError,false);assert.throws(()=>missing.save(sample()),/无法保存/);
});
test('remove and undo keep the exact manuscript and order, rejecting an updated or full destination',()=>{
  const disk=storage(),store=new D.Store(disk),one=store.save(sample('一')).entry;store.save(sample('二'));const before=store.entries;
  const removed=store.remove(one.id,1);store.restore(removed);assert.deepEqual(store.entries,before);assert.throws(()=>store.remove(one.id,0),/更新/);
  const gone=store.remove(one.id,1);for(let i=1;i<D.LIMIT;i++)store.save(sample('新'+i));const full=disk.getItem(D.KEY);assert.throws(()=>store.restore(gone),/已满/);assert.equal(disk.getItem(D.KEY),full);
});
test('portable draft files retain periods, phase, silence, all expression and their source for all roles',()=>{
  for(let index=0;index<5;index++)for(const length of C.LENGTHS){const base=C.preset('tide');base.tracks[index].muted=true;base.tracks[index].solo=true;base.tracks[index].gain=0;const doc=new M.Manuscript(base.tracks[index]);doc.resize(length);doc.rotate();doc.write(length-1,9,.55);const data={title:'星笺 ✧ '+index,base,index,draft:doc.snapshot()},before=C.clone(data);assert.deepEqual(D.decode(D.encode(data)),D.content(data));assert.deepEqual(data,before);}
});
test('invalid payloads, altered mix, unsupported files and duplicate IDs fail before writes',()=>{
  const disk=storage(),store=new D.Store(disk),data=sample(),before=C.clone(data);
  for(const change of [x=>x.index=5,x=>x.title=' ',x=>x.title='x'.repeat(61),x=>x.draft.gain=.9,x=>x.base.bpm=999,x=>x.draft.shift=24]){const bad=C.clone(data);change(bad);assert.throws(()=>store.save(bad));assert.equal(disk.getItem(D.KEY),null);}
  for(const text of ['{}','{',D.encode(data).replace('stargram-draft','stargram'),'x'.repeat(D.FILE_LIMIT+1)])assert.throws(()=>D.decode(text));assert.deepEqual(data,before);
  const entry=store.save(data).entry;assert.throws(()=>D.validate({version:1,entries:[entry,entry]}));assert.throws(()=>D.validate({version:1,entries:[{...entry,updated:-1}]}));
});
test('restored source and edited track keep the original event meanings through existing JSON and SL1',()=>{
  const Letters=require('../src/letters'),A=require('../src/appearance'),data=D.decode(D.encode(sample())),song=C.clone(data.base);song.tracks[data.index]=data.draft;
  const round=Letters.decode(Letters.encode(song,A.preset())).state;assert.deepEqual(round,C.validate(song));for(let tick=0;tick<96;tick++)assert.deepEqual(C.eventsAt(round,tick),C.eventsAt(song,tick));
});
