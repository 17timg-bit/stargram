'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core'),A=require('../src/appearance'),L=require('../src/letters');
function repack(payload){const b=Buffer.from(JSON.stringify(payload)).toString('base64url');let h=2166136261;for(const byte of Buffer.from(b))h=Math.imul(h^byte,16777619);return 'SL1.'+b+'.'+(h>>>0).toString(16).padStart(8,'0');}
function unpack(code){return JSON.parse(Buffer.from(code.split('.')[1],'base64url').toString());}
test('SL1 losslessly carries all music expression, irregular phases and Unicode titles',()=>{
  for(let seed=0;seed<100;seed++){
    const s=C.generate(seed);s.title='来信 🌌 / 引力与浮光';s.volume=.123456789;s.space=.987654321;
    s.tracks.forEach((t,i)=>{C.resizeTrack(t,C.LENGTHS[(seed+i)%5]);t.shift=(seed+i)%t.length;t.gain=i/7;t.muted=i===1;t.solo=i===3;t.accents=t.accents.map((_,j)=>C.ACCENTS[j%3]);});
    const code=L.encode(s,A.preset('sisters')),read=L.decode(code);assert.deepEqual(read.state,C.validate(s));assert.deepEqual(read.appearance,A.preset('sisters'));assert.deepEqual(C.midiBytes(read.state),C.midiBytes(s));assert.ok(code.length<1200);
  }
});
test('all 360 appearance recipes preserve published SG1 meanings through a letter',()=>{
  for(const sky of Object.keys(A.catalogs.sky))for(const spectrum of Object.keys(A.catalogs.spectrum))for(const disc of Object.keys(A.catalogs.disc))for(const type of Object.keys(A.catalogs.type)){
    const a={version:1,sky,spectrum,disc,type};assert.equal(A.code(L.decode(L.encode(C.preset(),a)).appearance),A.code(a));
  }
});
test('legacy maps migrate and empty, muted or zero-gain scores stay exact',()=>{
  const s=C.preset();s.version=1;s.tracks.forEach(t=>{delete t.accents;delete t.solo;t.notes.fill(-1);t.gain=0;t.muted=true;});
  assert.deepEqual(L.decode(L.encode(s,A.preset())).state,C.validate(s));
});
test('codes are deterministic, independent snapshots and reject malformed Unicode at creation',()=>{
  const s=C.preset(),a=A.preset(),code=L.encode(s,a);assert.equal(code,L.encode(s,a));const read=L.decode(code);read.state.tracks[0].notes[0]=9;assert.notDeepEqual(read,L.decode(code));assert.equal(s.tracks[0].notes[0],0);s.title='bad\ud800';assert.throws(()=>L.encode(s,a));
});
test('copy damage, unsupported versions, noncanonical bytes and oversized input are rejected',()=>{
  const code=L.encode(C.preset(),A.preset());
  for(const bad of [null,'','SL2'+code.slice(3),code.slice(0,-1),code.replace('SL1.','SL1.='),code.slice(0,-1)+(code.endsWith('0')?'1':'0'),'x'.repeat(8193)])assert.throws(()=>L.parse(bad));
  assert.throws(()=>L.decode('SL1.'+'A'.repeat(L.LIMIT)+'.00000000'));assert.throws(()=>L.fromHash('#letter=broken'));assert.equal(L.fromHash('#something-else'),null);
});
test('valid checksums do not bypass structural, musical or appearance validation',()=>{
  const p=unpack(L.encode(C.preset(),A.preset()));
  for(const change of [p=>p.push(1),p=>p[0]='x'.repeat(61),p=>p[0]='bad\ud800',p=>p[1]=1000,p=>p[2]='unknown',p=>p[3]=null,p=>p[5].pop(),p=>p[5][0][0]=7,p=>p[5][0][1]=24,p=>p[5][0][2]=-1,p=>p[5][0][3]=2,p=>p[5][0][4]='1',p=>p[5][0][5]='?',p=>p[6]='SG1-9999']){const x=C.clone(p);change(x);assert.throws(()=>L.decode(repack(x)));}
});
test('links carry only fragments, strip prior query and credentials, and offline copies stay portable',()=>{
  const code=L.encode(C.preset(),A.preset()),url=L.link(code,'https://example.test/sub/index.html?old=value#old');assert.equal(url,'https://example.test/sub/index.html#letter='+code);assert.deepEqual(L.parse(url),L.decode(code));assert.deepEqual(L.parse(' \n'+code+'\n '),L.decode(code));
  assert.equal(L.link(code,'file:///D:/app.html'),code);assert.equal(L.link(code,'https://name:password@example.test/'),code);
  for(const bad of ['javascript:alert(1)','data:text/html,hi','file:///D:/app.html#letter='+code,'https://name:password@example.test/#letter='+code,'https://example.test/#unrelated'])assert.throws(()=>L.parse(bad));
});
