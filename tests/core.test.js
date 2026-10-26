'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core');

test('all presets validate, are independent, and contain five audible roles', () => {
  for (const id of Object.keys(C.SCALES)) {
    const s = C.preset(id); assert.deepEqual(C.validate(s), s);
    assert.equal(s.tracks.length, 5); assert.ok(C.countNotes(s) >= 12);
    for (let i = 0; i < 5; i++) assert.ok(Array.from({length:24}, (_,n)=>C.eventsAt(s,n)).flat().some(e=>e.track===i));
    s.tracks[0].notes[0] = 9; assert.notEqual(C.preset(id).tracks[0].notes[0], 9);
  }
});
test('shift and loop positions agree, including wraparound', () => {
  const s=C.preset(); s.tracks.forEach(t=>t.notes.fill(-1));
  s.tracks[2].notes[15]=4; s.tracks[2].shift=3;
  assert.equal(C.eventsAt(s,1).length,0);
  assert.equal(C.eventsAt(s,2)[0].step,15);
  assert.deepEqual(C.eventsAt(s,2),C.eventsAt(s,18));
  s.tracks[2].muted=true; assert.equal(C.eventsAt(s,2).length,0);
  s.tracks[2].muted=false; s.tracks[2].gain=0; assert.equal(C.eventsAt(s,2).length,0);
});
test('pitch mapping respects scale and octave across all roles', () => {
  for (const id of Object.keys(C.SCALES)) {
    const s=C.preset(id);
    for (let t=0;t<5;t++) for(let p=0;p<5;p++) {
      const n=C.midiNote(s,t,p); assert.ok(n>=0&&n<=127); assert.equal(C.midiNote(s,t,p+5),n+12);
      assert.equal(C.mod(n-C.SCALES[id].root,12),C.SCALES[id].notes[p]);
    }
  }
});
test('resizing preserves phase proportion and creates valid tracks', () => {
  for (const length of C.LENGTHS) {
    const s=C.preset(); s.tracks[2].shift=15; C.resizeTrack(s.tracks[2],length);
    assert.equal(s.tracks[2].notes.length,length); assert.ok(C.validate(s));
    assert.equal(s.tracks[2].shift,Math.floor(15/16*length));
  }
  assert.throws(()=>C.resizeTrack(C.preset().tracks[0],13));
});
test('seeded generator is reproducible and bounded for 1000 universes', () => {
  assert.deepEqual(C.generate(42),C.generate(42)); assert.notDeepEqual(C.generate(42),C.generate(43));
  for(let seed=0;seed<1000;seed++){const s=C.generate(seed);assert.ok(C.validate(s));assert.ok(C.countNotes(s)>10);}
});
test('common cycle is a real least common multiple', () => {
  const s=C.preset(); assert.equal(C.cycleTicks(s),240);
  for(const t of s.tracks) assert.equal(240%t.length,0);
  s.tracks.forEach(t=>t.muted=true); assert.equal(C.cycleTicks(s),1);
});
test('import rejects corrupt, oversized and unexpected structures', () => {
  for(const raw of [null,{},[],{format:'stargram',version:2}]) assert.throws(()=>C.validate(raw));
  const mutations=[s=>s.bpm=NaN,s=>s.bpm=Infinity,s=>s.bpm='88',s=>s.volume=-1,s=>s.space=2,s=>s.title='x'.repeat(61),s=>s.scale='__proto__',s=>s.tracks.pop(),s=>s.tracks[0].notes.push(1),s=>s.tracks[0].notes[1]=99,s=>s.tracks[0].shift=16,s=>s.tracks[0].muted='yes',s=>s.tracks[0].gain=null];
  for(const mutate of mutations){const s=C.preset(); mutate(s); assert.throws(()=>C.validate(s));}
  const s=C.preset();s.extra='discard';assert.equal(C.validate(s).extra,undefined);
});
function parseMidi(bytes){
  const b=Buffer.from(bytes); assert.equal(b.toString('ascii',0,4),'MThd');assert.equal(b.readUInt32BE(4),6);assert.equal(b.readUInt16BE(8),1);assert.equal(b.readUInt16BE(12),480);
  const tracks=[];let pos=14;
  while(pos<b.length){assert.equal(b.toString('ascii',pos,pos+4),'MTrk');const end=pos+8+b.readUInt32BE(pos+4);let p=pos+8,time=0,active=new Map(),ons=0,tempo=null,name=null,ended=false;
    function variable(){let n=0,v;do{v=b[p++];n=(n<<7)+(v&127);}while(v&128);return n;}
    while(p<end){time+=variable();const status=b[p++];if(status===255){const kind=b[p++],len=variable();if(kind===81)tempo=b.readUIntBE(p,3);if(kind===3)name=b.toString('ascii',p,p+len);if(kind===47)ended=true;p+=len;}
      else if((status&240)===192)p++;
      else {const pitch=b[p++],velocity=b[p++],key=`${status&15}:${pitch}`;if((status&240)===144&&velocity>0){assert.ok(!active.has(key),'no overlapping same-pitch voices');active.set(key,time);ons++;}else{assert.ok(active.has(key),'note-off has a matching note-on');assert.ok(time>active.get(key));active.delete(key);}}}
    assert.equal(p,end);assert.equal(active.size,0);assert.ok(ended);tracks.push({time,ons,tempo,name});pos=end;}
  assert.equal(pos,b.length);assert.equal(tracks.length,b.readUInt16BE(10));return tracks;
}
test('MIDI has valid independent tracks, real tempo and balanced note events', () => {
  for(const id of Object.keys(C.SCALES)){
    const s=C.preset(id),tracks=parseMidi(C.midiBytes(s));assert.equal(tracks.length,6);assert.equal(tracks[0].tempo,Math.round(60000000/s.bpm));
    for(let i=1;i<6;i++){assert.equal(tracks[i].name,C.ROLES[i-1].english);assert.equal(tracks[i].time,64*240);assert.ok(tracks[i].ons>0);}
  }
  const s=C.preset();s.tracks[2].muted=true;assert.equal(parseMidi(C.midiBytes(s))[3].ons,0);
  const dense=C.preset();dense.tracks.forEach(t=>t.notes.fill(0));
  const denseTracks=parseMidi(C.midiBytes(dense));
  denseTracks.slice(1).forEach(t=>{assert.equal(t.ons,64);assert.equal(t.time,64*240);});
});
test('single-file distribution has no network, imports or external assets',()=>{
  const fs=require('node:fs'),path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'..','打开星轨留声机.html'),'utf8');
  assert.ok(html.includes('window.Stargram'));assert.ok(!/\b(?:src|href)=["']https?:/i.test(html));assert.ok(!/\bfetch\(|XMLHttpRequest|WebSocket|import\(/.test(html));assert.ok(!html.includes('<!-- SCRIPTS -->'));
  assert.equal(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),html,'online and offline entries must be identical');
});
