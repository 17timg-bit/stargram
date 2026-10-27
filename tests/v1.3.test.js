'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core');
const L=require('../src/loom');

test('all legal densities contain the exact star count and balanced cyclic gaps',()=>{
  for(const length of C.LENGTHS)for(let count=1;count<=length;count++){
    const draft=L.weave(C.preset().tracks[2],{length,count});
    const positions=draft.notes.flatMap((p,i)=>p<0?[]:[i]);
    assert.equal(positions.length,count);
    const gaps=positions.map((p,i)=>i+1<positions.length?positions[i+1]-p:length-p+positions[0]);
    assert.ok(Math.max(...gaps)-Math.min(...gaps)<=1);
    const state=C.preset();state.tracks[2]=draft;assert.ok(C.validate(state));
  }
});
test('drafts are deterministic, independent, and preserve gain, mute, solo and relative phase',()=>{
  const original=C.preset().tracks[2];original.shift=5;original.muted=true;original.solo=true;original.gain=.37;
  const before=C.clone(original),options={length:24,count:7,shape:'wander',register:5,seed:470,offset:3};
  const a=L.weave(original,options),b=L.weave(original,options);
  assert.deepEqual(a,b);assert.deepEqual(original,before);
  assert.equal(a.shift,10);assert.equal(a.gain,.37);assert.equal(a.muted,true);assert.equal(a.solo,true);
  a.notes[0]=0;a.accents[0]=1;assert.deepEqual(original,before);assert.notDeepEqual(a,b);
});
test('contours and both registers remain in their selected five-note range',()=>{
  for(const shape of L.SHAPES)for(const register of [0,5])for(let seed=0;seed<120;seed++){
    const draft=L.weave(C.preset().tracks[2],{length:24,count:24,shape,register,seed});
    assert.ok(draft.notes.every(p=>p>=register&&p<register+5));
    for(let i=1;i<draft.notes.length;i++){
      if(shape==='rise')assert.equal(C.mod(draft.notes[i]-draft.notes[i-1],5),1);
      if(shape==='fall')assert.equal(C.mod(draft.notes[i-1]-draft.notes[i],5),1);
      if(shape==='wander')assert.ok(Math.abs(draft.notes[i]-draft.notes[i-1])<=2);
    }
  }
});
test('breathing accents are valid, support a single star, and can be disabled',()=>{
  for(const count of [1,2,7,16]){
    const draft=L.weave(C.preset().tracks[2],{count});
    const active=draft.accents.filter((_,i)=>draft.notes[i]>=0);
    assert.equal(active[0],1.35);if(count>1)assert.equal(active.at(-1),.55);
    assert.ok(draft.accents.every(a=>C.ACCENTS.includes(a)));
    assert.ok(L.weave(draft,{count,dynamics:false}).accents.every(a=>a===1));
  }
});
test('isolated auditions preserve the original mix and use ordinary sequencer events',()=>{
  const state=C.preset();state.tracks[0].solo=true;state.tracks[2].muted=true;state.tracks[2].gain=.4;
  const before=C.clone(state),draft=L.weave(state.tracks[2],{count:7,shape:'rise',seed:19});
  const preview=L.audition(state,2,draft);assert.deepEqual(state,before);
  assert.equal(preview.volume,state.volume);assert.equal(preview.space,state.space);assert.equal(preview.tracks[2].gain,.4);
  assert.ok(preview.tracks.every((t,i)=>!t.solo&&t.muted===(i!==2)));
  let heard=0;for(let tick=0;tick<draft.length;tick++){
    const events=C.eventsAt(preview,tick);heard+=events.length;
    assert.ok(events.every(e=>e.track===2&&e.gain===draft.gain*draft.accents[e.step]));
  }
  assert.equal(heard,7);preview.tracks[2].notes.fill(-1);assert.ok(draft.notes.some(p=>p>=0));
  assert.throws(()=>L.audition(state,5,draft));
});
test('invalid or unbounded parameters are rejected before a draft is created',()=>{
  const track=C.preset().tracks[2];
  for(const options of [{length:11},{count:0},{count:17},{count:1.5},{shape:'unknown'},{register:3},{dynamics:1},{seed:NaN},{seed:-1},{seed:2**32},{offset:-1},{offset:16}])assert.throws(()=>L.weave(track,options));
  assert.throws(()=>L.weave({...track,notes:[]},{}));
});
