'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core'),L=require('../src/letters'),A=require('../src/appearance');
const all=Array.from({length:1000},(_,seed)=>C.generate(seed));
const unique=fn=>new Set(all.map(fn));
const rhythm=t=>JSON.stringify([t.length,Array.from({length:t.length},(_,tick)=>t.notes[C.mod(tick-t.shift,t.length)]>=0?tick:-1).filter(n=>n>=0)]);
test('encounters are deterministic, independent, preserve master volume and reject invalid input atomically',()=>{
  const base=C.preset();base.volume=.1234567;base.tracks.forEach(t=>{t.muted=true;t.solo=true;t.gain=0;});const original=C.clone(base);
  const first=C.generate(123,base);assert.deepEqual(first,C.generate(123,base));assert.deepEqual(base,original);assert.equal(first.volume,base.volume);assert.ok(first.tracks.every(t=>!t.muted&&!t.solo&&t.gain>0));
  first.tracks[0].notes.fill(-1);assert.notDeepEqual(first,C.generate(123,base));
  for(const seed of [-1,.5,NaN,Infinity,'123',4294967296])assert.throws(()=>C.generate(seed,base));
  const bad=C.clone(base);bad.space=2;assert.throws(()=>C.generate(1,bad));assert.deepEqual(base,original);
  base.volume=0;assert.equal(C.generate(0xffffffff,base).volume,0);
  base.version=1;base.tracks.forEach(t=>{delete t.accents;delete t.solo;});assert.equal(C.generate(3,base).version,2);
});
test('all six musical climates, three scales, many tempos and spaces occur for the same starting map',()=>{
  assert.equal(unique(s=>s.title.split(' · ')[0]).size,6);assert.equal(unique(s=>s.scale).size,3);
  assert.ok(unique(s=>s.bpm).size>=60);assert.ok(unique(s=>s.space).size>=40);
  const musical=unique(s=>JSON.stringify({...s,title:''}));assert.equal(musical.size,1000);
  for(const s of all){assert.deepEqual(C.validate(s),s);assert.ok(s.bpm>=56&&s.bpm<=136&&s.bpm!==88);assert.ok(s.space>=.2&&s.space<=.86);assert.equal(s.volume,.55);}
});
test('gravity and ember have substantial rhythmic diversity instead of fixed positions or three templates',()=>{
  assert.ok(unique(s=>rhythm(s.tracks[0])).size>400,'many distinct bass rhythms');assert.ok(unique(s=>rhythm(s.tracks[1])).size>500,'many distinct ember rhythms');
  assert.ok(unique(s=>JSON.stringify(s.tracks[0])).size>900);assert.ok(unique(s=>JSON.stringify(s.tracks[1])).size>900);
  for(let i=0;i<5;i++){
    assert.deepEqual([...unique(s=>s.tracks[i].length)].sort((a,b)=>a-b),C.LENGTHS);
    assert.ok(unique(s=>s.tracks[i].notes.filter(p=>p>=0).length).size>=3);assert.ok(unique(s=>s.tracks[i].shift).size>=4);
  }
});
test('musical climates retain breathing space, bounded levels, audible roles and compatible loop timing',()=>{
  for(const s of all){
    assert.ok(new Set(s.tracks.map(t=>t.length)).size>=2);
    const cycle=C.cycleTicks(s);assert.ok(cycle<=240&&cycle>0);assert.ok(C.countNotes(s)>=13);
    s.tracks.forEach((t,i)=>{
      const count=t.notes.filter(p=>p>=0).length;assert.ok(count>=2&&count<=Math.floor(t.length*.6));assert.ok(t.gain>=.38&&t.gain<=.82);assert.ok(t.notes.every(p=>p<=(i===0?4:9)));
      assert.ok(t.accents.includes(1.35)&&t.accents.includes(.55));assert.equal(cycle%t.length,0);assert.ok(C.audible(s,i));
      assert.ok(Array.from({length:t.length},(_,tick)=>C.eventsAt(s,tick)).flat().some(e=>e.track===i));
    });
  }
});
test('generated performances survive v2 JSON and SL1 with phases, dynamics and mix intact',()=>{
  for(const s of all.filter((_,i)=>i%10===0)){
    const json=C.validate(JSON.parse(JSON.stringify(s)));assert.deepEqual(json,s);
    const letter=L.decode(L.encode(s,A.preset('rosette')));assert.deepEqual(letter.state,s);assert.deepEqual(C.midiBytes(letter.state),C.midiBytes(s));
  }
});
test('generated names carry the full unsigned seed and do not redefine old musical or appearance formats',()=>{
  for(const seed of [0,1,0xffffffff]){const s=C.generate(seed);assert.ok(s.title.endsWith(seed.toString(36).toUpperCase().padStart(7,'0')));assert.ok(s.title.length<=60);}
  assert.equal(C.preset().version,2);assert.ok(Object.isFrozen(C.ENCOUNTERS)&&C.ENCOUNTERS.every(Object.isFrozen));assert.equal(C.ENCOUNTERS.length,6);
});
