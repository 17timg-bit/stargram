'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const A=require('../src/appearance');
function memory(entries={}){const data=new Map(Object.entries(entries));return {data,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v)};}
test('all 360 recipes have unique roundtrip codes and readable semantic foregrounds',()=>{
  const codes=new Set();
  for(const sky of Object.keys(A.catalogs.sky))for(const spectrum of Object.keys(A.catalogs.spectrum))for(const disc of Object.keys(A.catalogs.disc))for(const type of Object.keys(A.catalogs.type)){
    const r={version:1,sky,spectrum,disc,type},code=A.code(r),t=A.compose(r);codes.add(code);assert.deepEqual(A.decode(code),r);
    for(const [front,back] of [['ink','paper'],['muted','paper'],['ink','field'],['button-ink','button'],['ink','selected'],['record-label-ink','record-label']])assert.ok(A.contrast(t[front],t[back])>=4.5,`${code} ${front}/${back}`);
    assert.match(t.serif,/serif/);
  }
  assert.equal(codes.size,360);
});
test('legacy preferences migrate in memory, current recipes win, and loading never overwrites data',()=>{
  for(const id of ['paper','nocturne','mist']){const s=memory({[A.LEGACY]:id});assert.deepEqual(A.read(s).value,A.preset(id));assert.equal(A.read(s).source,'legacy');assert.equal(s.data.size,1);}
  const s=memory({[A.LEGACY]:'nocturne',[A.KEY]:JSON.stringify(A.preset('sisters'))});assert.deepEqual(A.read(s).value,A.preset('sisters'));assert.equal(s.data.size,2);
});
test('corrupt and oversized preferences stay untouched and unavailable storage falls back safely',()=>{
  for(const text of ['invalid','x'.repeat(513),JSON.stringify({version:1,sky:'__proto__'})]){const s=memory({[A.KEY]:text});assert.deepEqual(A.read(s).value,A.preset());assert.equal(s.data.get(A.KEY),text);}
  assert.deepEqual(A.read({getItem(){throw new Error('blocked');}}).value,A.preset());
  assert.equal(A.save({setItem(){throw new Error('quota');}},A.preset('polar')),false);
});
test('recipe validation rejects invalid fields and codes before any write, preserving unrelated keys',()=>{
  const s=memory({'stargram.universe.v1':'private composition'});
  for(const raw of [null,[],{}, {...A.preset(),sky:'__proto__'},{...A.preset(),spectrum:'constructor'},{...A.preset(),type:'bad'},{...A.preset(),version:2}])assert.throws(()=>A.save(s,raw));
  for(const code of ['SG1-0000','SG1-7111','SG1-1611','SG1-1151','SG1-1114','SG2-1111','SG1-1111x','x'.repeat(1000)])assert.throws(()=>A.decode(code));
  assert.equal(A.save(s,A.preset('rosette')),true);assert.equal(s.data.size,2);assert.equal(s.data.get('stargram.universe.v1'),'private composition');
});
test('editing returned recipes or tokens cannot modify presets or catalogs',()=>{
  const r=A.preset('polar');r.sky='moon';assert.equal(A.preset('polar').sky,'aurora');
  const t=A.compose(A.preset());t.paper='red';assert.notEqual(A.compose(A.preset()).paper,'red');
  assert.throws(()=>A.catalogs.sky.deep.base='red');
});
test('published SG1 examples retain their meanings across later application releases',()=>{
  assert.equal(A.code(A.preset('paper')),'SG1-1211');assert.equal(A.code(A.preset('rosette')),'SG1-4121');
  assert.deepEqual(A.decode('SG1-5433'),A.preset('sisters'));
  assert.deepEqual(A.decode('SG1-4423'),{version:1,sky:'rosette',spectrum:'ice',disc:'atlas',type:'field'});
});
