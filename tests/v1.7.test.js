'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core'),L=require('../src/loom'),M=require('../src/manuscript');
test('a new manuscript is an exact independent copy including irregular notes, silence and expression',()=>{
  for(const length of C.LENGTHS){const t=C.clone(C.preset().tracks[2]);C.resizeTrack(t,length);t.shift=length-1;t.notes[1]=9;t.accents[1]=.55;t.solo=true;t.muted=true;t.gain=.31;const doc=new M.Manuscript(t);assert.deepEqual(doc.snapshot(),t);assert.deepEqual(doc.original,t);assert.equal(doc.summary().changed,false);const copy=doc.snapshot();copy.notes[1]=0;assert.equal(doc.snapshot().notes[1],9);}
});
test('writing uses heard ticks and preserves expression when moving a note within its column',()=>{
  const t=C.clone(C.preset().tracks[2]);t.notes.fill(-1);t.shift=5;const doc=new M.Manuscript(t);doc.write(1,8,1.35);
  const s=C.preset();s.tracks[2]=doc.snapshot();assert.equal(C.eventsAt(s,1).find(e=>e.track===2).pitch,8);assert.equal(doc.snapshot().accents[12],1.35);
  doc.write(1,4,.55);assert.deepEqual(M.heard(doc.snapshot(),1),{pitch:4,accent:1.35});doc.accent(1,.55);assert.equal(M.heard(doc.snapshot(),1).accent,.55);
  doc.write(1,4);assert.equal(M.heard(doc.snapshot(),1).pitch,-1);assert.equal(doc.snapshot().accents[12],1);assert.deepEqual(doc.original,t);
});
test('draft undo, redo, blanking and reset never mutate the original and a new edit drops redo',()=>{
  const t=C.preset().tracks[2],doc=new M.Manuscript(t);doc.clear();const blank=doc.snapshot();assert.equal(doc.summary().draftCount,0);doc.write(1,7);const written=doc.snapshot();doc.undo();assert.deepEqual(doc.snapshot(),blank);doc.redo();assert.deepEqual(doc.snapshot(),written);doc.reset();assert.deepEqual(doc.snapshot(),t);doc.undo();assert.deepEqual(doc.snapshot(),written);doc.write(2,6);assert.equal(doc.canRedo,false);assert.deepEqual(doc.original,t);
});
test('resize and rotation keep the shared timing rules while reports handle different periods',()=>{
  const original=C.preset().tracks[2];original.shift=3;
  for(const length of C.LENGTHS){const expected=C.clone(original);C.resizeTrack(expected,length);const doc=new M.Manuscript(original);doc.resize(length);assert.deepEqual(doc.snapshot(),expected);doc.rotate();expected.shift=(expected.shift+1)%length;assert.deepEqual(doc.snapshot(),expected);assert.equal(doc.summary().periodChanged,length!==original.length);if(length!==original.length)assert.equal(doc.summary().changedTicks,null);}
});
test('the original and edited auditions isolate the correct role without changing either snapshot',()=>{
  const s=C.preset(),doc=new M.Manuscript(s.tracks[3]);doc.clear();doc.write(2,9,1.35);const draft=doc.snapshot(),before=C.clone(s);
  const original=L.audition(s,3,doc.original),edited=L.audition(s,3,draft);
  assert.deepEqual(original.tracks[3].notes,s.tracks[3].notes);assert.equal(C.eventsAt(edited,2)[0].pitch,9);assert.ok(C.eventsAt(edited,2).every(e=>e.track===3));assert.deepEqual(s,before);assert.deepEqual(doc.snapshot(),draft);
});
test('generation is explicit, undoable and uses the current period while preserving original mix',()=>{
  const t=C.preset().tracks[1];t.solo=true;t.muted=true;t.gain=.28;const doc=new M.Manuscript(t);doc.resize(24);doc.write(3,8);const handwritten=doc.snapshot();doc.generate({count:7,shape:'wander',seed:123,register:5,dynamics:true});const generated=doc.snapshot();assert.equal(generated.length,24);assert.equal(generated.notes.filter(p=>p>=0).length,7);for(const k of ['gain','muted','solo'])assert.equal(generated[k],t[k]);doc.undo();assert.deepEqual(doc.snapshot(),handwritten);assert.deepEqual(doc.original,t);
});
test('invalid edits fail before mutation, no-op writes add no history, and history stays bounded',()=>{
  const doc=new M.Manuscript(C.preset().tracks[0]),before=doc.snapshot();
  for(const fn of [()=>doc.write(-1,2),()=>doc.write(0,10),()=>doc.write(0,1,7),()=>doc.accent(0,0),()=>doc.resize(13),()=>doc.replace({}),()=>doc.generate({count:99})]){assert.throws(fn);assert.deepEqual(doc.snapshot(),before);assert.equal(doc.canUndo,false);}
  assert.equal(doc.reset(),false);for(let i=0;i<80;i++)doc.rotate();let count=0;while(doc.undo())count++;assert.equal(count,60);
});
test('page-local cache resumes only the matching source and role and bounds retained drafts',()=>{
  const cache=new M.DraftCache(),t=C.preset().tracks[2];const first=cache.open(2,t);first.doc.write(1,7);assert.equal(cache.open(2,t).resumed,true);assert.deepEqual(cache.open(2,t).doc.snapshot(),first.doc.snapshot());assert.equal(cache.open(3,t).resumed,false);
  const changed=C.clone(t);changed.gain=.2;assert.equal(cache.open(2,changed).resumed,false);assert.equal(cache.open(2,t).resumed,true);cache.forget(2);assert.equal(cache.open(2,t).resumed,false);
  for(let i=0;i<30;i++){const t=C.preset().tracks[2];t.notes[0]=i%10;t.shift=i%16;cache.open(i%5,t);}assert.equal(cache.size,12);cache.reset();assert.equal(cache.size,0);assert.throws(()=>cache.open(5,t));
});
