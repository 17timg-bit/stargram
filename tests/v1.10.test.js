'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core'),M=require('../src/manuscript');
function source(length=16,shift=5){
  const t=C.clone(C.preset().tracks[2]);C.resizeTrack(t,length);t.shift=shift%length;t.notes.fill(-1);t.accents.fill(1);t.gain=.317;t.muted=true;t.solo=true;
  [[1,2,.55],[2,5,1.35],[4,3,1]].forEach(([tick,p,a])=>{const i=C.mod(tick-t.shift,length);t.notes[i]=p;t.accents[i]=a;});return t;
}
function heard(t){return Array.from({length:t.length},(_,i)=>M.heard(t,i));}
test('phrase transforms follow audible time for every period and phase, preserving all other slots and mix',()=>{
  for(const length of C.LENGTHS)for(let shift=0;shift<length;shift++)for(const action of ['up','down','reverse','invert','earlier','later','erase']){
    const t=source(length,shift),before=C.clone(t),result=M.phrase(t,1,4,action),a=heard(t),b=heard(result.track);
    for(let tick=0;tick<length;tick++)if(tick<1||tick>4)assert.deepEqual(b[tick],a[tick]);
    for(const key of ['length','shift','gain','muted','solo'])assert.equal(result.track[key],t[key]);
    assert.deepEqual(t,before);C.validate({...C.preset(),tracks:[result.track,...C.preset().tracks.slice(1)]});
  }
});
test('diatonic moves preserve gaps and accents and reject the whole phrase at pitch limits',()=>{
  const t=source(),a=heard(t),up=heard(M.phrase(t,1,4,'up').track);
  for(let tick=1;tick<=4;tick++)assert.deepEqual(up[tick],{pitch:a[tick].pitch<0?-1:a[tick].pitch+1,accent:a[tick].accent});
  for(const [pitch,action] of [[9,'up'],[0,'down']]){const edge=source();edge.notes[C.mod(2-edge.shift,edge.length)]=pitch;const doc=new M.Manuscript(edge);assert.equal(doc.transform(1,4,action).changed,false);assert.deepEqual(doc.snapshot(),edge);assert.equal(doc.canUndo,false);}
});
test('reversing, contour inversion and opposite rotations are reversible without quantizing expression',()=>{
  const t=source();t.accents[C.mod(3-t.shift,t.length)]=.55;
  for(const action of ['reverse','invert'])assert.deepEqual(M.phrase(M.phrase(t,1,4,action).track,1,4,action).track,t);
  const reverse=heard(M.phrase(t,1,4,'reverse').track);assert.deepEqual(reverse.slice(1,5),heard(t).slice(1,5).reverse());
  const inverse=heard(M.phrase(t,1,4,'invert').track);assert.deepEqual(inverse.slice(1,5).map(n=>n.pitch),[5,2,-1,4]);
  assert.deepEqual(M.phrase(M.phrase(t,1,4,'later').track,1,4,'earlier').track,t);
});
test('repetition copies the whole phrase including gaps and accents into the following blank span',()=>{
  for(const length of C.LENGTHS)for(let shift=0;shift<length;shift++){
    const t=source(length,shift);t.notes[C.mod(4-t.shift,length)]=-1;const r=M.phrase(t,1,3,'repeat');assert.equal(r.changed,true);
    assert.deepEqual(heard(r.track).slice(4,7),heard(t).slice(1,4));
    assert.deepEqual(heard(r.track).slice(1,4),heard(t).slice(1,4));
    assert.equal(r.track.shift,t.shift);
  }
});
test('repetition refuses occupied or out-of-bounds destinations without history or partial changes',()=>{
  for(const [start,end,noteTick] of [[1,4,5],[12,15,12]]){const t=source();t.notes[C.mod(noteTick-t.shift,t.length)]=4;const doc=new M.Manuscript(t);const r=doc.transform(start,end,'repeat');assert.equal(r.changed,false);assert.deepEqual(doc.snapshot(),t);assert.equal(doc.canUndo,false);}
  const t=source();t.notes[C.mod(7-t.shift,t.length)]=4;const doc=new M.Manuscript(t);assert.equal(doc.transform(1,4,'repeat').changed,false);assert.deepEqual(doc.snapshot(),t);
});
test('erase affects only the selected interval and is one undo step; redo restores it exactly',()=>{
  const t=source(),doc=new M.Manuscript(t);doc.transform(1,2,'erase');const blank=doc.snapshot();assert.deepEqual(heard(blank).slice(1,3),[{pitch:-1,accent:1},{pitch:-1,accent:1}]);assert.equal(M.heard(blank,4).pitch,3);
  assert.equal(doc.undo(),true);assert.deepEqual(doc.snapshot(),t);assert.equal(doc.canUndo,false);doc.redo();assert.deepEqual(doc.snapshot(),blank);assert.deepEqual(doc.original,t);
});
test('empty, symmetric and single-note no-ops add no history and preserve a redo branch',()=>{
  const doc=new M.Manuscript(source());doc.transform(1,4,'up');doc.undo();
  for(const action of M.PHRASE_ACTIONS)assert.equal(doc.transform(8,11,action).changed,false);
  for(const action of ['reverse','invert','earlier','later'])assert.equal(doc.transform(1,1,action).changed,false);
  assert.equal(doc.canUndo,false);assert.equal(doc.canRedo,true);
});
test('bad selection and operation inputs fail before modifying the manuscript or history',()=>{
  const doc=new M.Manuscript(source()),before=doc.snapshot();
  for(const [start,end,action] of [[-1,2,'up'],[0,16,'up'],[4,2,'up'],[.5,2,'up'],[0,Infinity,'up'],[0,2,'unknown'],[null,2,'up']]){assert.throws(()=>doc.transform(start,end,action));assert.deepEqual(doc.snapshot(),before);assert.equal(doc.canUndo,false);}
});
test('transformed phrases keep their actual events through JSON and SL1 round trips',()=>{
  const A=require('../src/appearance'),Letters=require('../src/letters');
  const s=C.preset();s.tracks[2]=source();s.tracks[2].muted=false;s.tracks[2].solo=false;s.tracks[2].notes[C.mod(4-s.tracks[2].shift,16)]=-1;
  const doc=new M.Manuscript(s.tracks[2]);for(const action of ['reverse','up','later','repeat'])doc.transform(1,3,action);s.tracks[2]=doc.snapshot();
  const json=C.validate(JSON.parse(JSON.stringify(s))),letter=Letters.decode(Letters.encode(s,A.preset()));
  assert.deepEqual(json,s);assert.deepEqual(letter.state,s);
  for(let tick=0;tick<96;tick++)assert.deepEqual(C.eventsAt(letter.state,tick),C.eventsAt(s,tick));
});
