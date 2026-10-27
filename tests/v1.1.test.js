'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core');
const {Store,KEY}=require('../src/shelf');
const memory=()=>{const items=new Map();return {getItem:k=>items.get(k)??null,setItem:(k,v)=>items.set(k,v)};};

test('v1.0 maps migrate without changing notes, gain or event amplitudes',()=>{
  const original=require('../示例作品/星图/晨雾中的信号.json');
  const migrated=C.validate(original);
  assert.equal(original.version,1);assert.equal(migrated.version,2);
  for(let i=0;i<5;i++){assert.deepEqual(migrated.tracks[i].notes,original.tracks[i].notes);assert.ok(migrated.tracks[i].accents.every(v=>v===1));assert.equal(migrated.tracks[i].solo,false);assert.equal(migrated.tracks[i].gain,original.tracks[i].gain);}
  for(let tick=0;tick<240;tick++)assert.deepEqual(C.eventsAt(original,tick),C.eventsAt(migrated,tick));
  assert.deepEqual(C.midiBytes(original),C.midiBytes(migrated));
});
test('solo intersects mute and zero gain; multiple solo tracks remain audible',()=>{
  const s=C.preset();s.tracks[2].solo=true;
  for(let tick=0;tick<64;tick++)assert.ok(C.eventsAt(s,tick).every(e=>e.track===2));
  assert.equal(C.cycleTicks(s),16);
  s.tracks[3].solo=true;assert.equal(C.cycleTicks(s),48);
  s.tracks[2].muted=true;assert.equal(C.audible(s,2),false);assert.equal(C.audible(s,3),true);
  s.tracks[3].gain=0;assert.ok(s.tracks.every((t,i)=>!C.audible(s,i)));assert.equal(C.eventsAt(s,0).length,0);
  const a=C.preset(),b=C.preset();a.tracks[2].solo=true;b.tracks.forEach((t,i)=>t.muted=i!==2);
  for(let tick=0;tick<240;tick++)assert.deepEqual(C.eventsAt(a,tick),C.eventsAt(b,tick));
  assert.deepEqual(C.midiBytes(a),C.midiBytes(b));
});
test('accents alter exact event amplitude; resizing carries accent with its star',()=>{
  const s=C.preset(),t=s.tracks[2];t.accents[0]=.55;t.accents[6]=1.35;
  assert.equal(C.eventsAt(s,0).find(e=>e.track===2).gain,t.gain*.55);
  assert.equal(C.eventsAt(s,6).find(e=>e.track===2).gain,t.gain*1.35);
  C.resizeTrack(t,24);assert.equal(t.notes[9],4);assert.equal(t.accents[9],1.35);assert.ok(C.validate(s));
  for(const modify of [x=>x.tracks[0].solo='yes',x=>x.tracks[0].accents.pop(),x=>x.tracks[0].accents[0]=2,x=>x.tracks[0].accents=null]){const bad=C.preset();modify(bad);assert.throws(()=>C.validate(bad));}
  const incomplete=C.preset();delete incomplete.tracks[0].accents;assert.throws(()=>C.validate(incomplete));
});
function midiEvents(bytes){
  const b=Buffer.from(bytes),out=[];let pos=14;
  while(pos<b.length){let p=pos+8,end=p+b.readUInt32BE(pos+4),at=0;const events=[];const vlq=()=>{let v=0,n;do{n=b[p++];v=(v<<7)+(n&127);}while(n&128);return v;};
    while(p<end){at+=vlq();const status=b[p++];if(status===255){p++;const length=vlq();p+=length;}else if((status&240)===192)p++;else{const note=b[p++],velocity=b[p++];assert.ok(note<128&&velocity<128);if((status&240)===144)events.push({at,note,velocity});}}out.push(events);pos=end;}
  return out;
}
test('MIDI preserves expressive velocity, clamps max gain and respects solo',()=>{
  const s=C.preset();s.tracks[2].solo=true;s.tracks[2].notes.fill(0);s.tracks[2].accents.fill(1.35);s.tracks[2].gain=1;
  const tracks=midiEvents(C.midiBytes(s));assert.equal(tracks[3].length,64);assert.ok(tracks[3].every(e=>e.velocity===127));assert.equal(tracks.flat().length,64);
  s.tracks[2].accents[0]=.55;assert.equal(midiEvents(C.midiBytes(s))[3][0].velocity,52);
});
test('collections persist independent snapshots, suppress duplicates and survive reload',()=>{
  const storage=memory(),store=new Store(storage),s=C.preset();
  const saved=store.save(s,'我的第一片星空');assert.equal(saved.duplicate,false);assert.equal(store.entries.length,1);
  s.tracks[0].notes[0]=9;assert.equal(store.load(saved.entry.id).tracks[0].notes[0],0);
  const loaded=store.load(saved.entry.id);loaded.title='other';assert.equal(store.entries[0].state.title,'我的第一片星空');
  assert.equal(store.save(C.preset(),'我的第一片星空').duplicate,true);assert.equal(store.entries.length,1);
  assert.deepEqual(new Store(storage).entries,store.entries);assert.ok(storage.getItem(KEY));
});
test('removal and undo preserve full expressive snapshot and relative order',()=>{
  const store=new Store(memory()),s=C.preset();s.tracks[2].solo=true;s.tracks[2].accents[0]=1.35;
  const a=store.save(s,'A'),b=store.save(C.preset('tide'),'B');const before=C.clone(store.entries);
  const removed=store.remove(a.entry.id);assert.equal(store.entries.length,1);assert.equal(store.entries[0].id,b.entry.id);
  store.restore(removed);assert.deepEqual(store.entries,before);assert.equal(store.load(a.entry.id).tracks[2].accents[0],1.35);
});
test('full shelf and failed writes never evict or mutate existing snapshots',()=>{
  const storage=memory(),store=new Store(storage);for(let i=0;i<24;i++)store.save(C.preset(),'星图'+i);
  const before=C.clone(store.entries),persisted=storage.getItem(KEY);assert.throws(()=>store.save(C.preset(),'第25张'),/24/);assert.deepEqual(store.entries,before);assert.equal(storage.getItem(KEY),persisted);
  storage.setItem=()=>{throw Error('quota');};assert.throws(()=>store.remove(store.entries[0].id),/未写入/);assert.deepEqual(store.entries,before);
  assert.throws(()=>new Store(null).save(C.preset(),'不可保存'),/无法保存/);
});
test('corrupt shelf remains untouched; collection input is bounded and validated',()=>{
  const storage=memory();storage.setItem(KEY,'{broken');const store=new Store(storage);assert.equal(store.readError,true);assert.throws(()=>store.save(C.preset(),'新作'),/原始收藏/);assert.equal(storage.getItem(KEY),'{broken');
  const entry={id:'star-1',created:Date.now(),state:C.preset()};assert.ok(C.validateCollection([entry]));
  for(const raw of [null,{},Array(25).fill(entry),[entry,entry],[{...entry,id:'<script>'}],[{...entry,created:NaN}],[{...entry,state:{}}]])assert.throws(()=>C.validateCollection(raw));
});
