/* SL1 letters: a bounded, lossless musical snapshot carried in the URL fragment. */
(function(root,factory){
  const api=typeof module==='object'&&module.exports?factory(require('./core'),require('./appearance')):factory(root.OrbitCore,root.AstroAppearance);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.OrbitLetters=api;
})(globalThis,function(C,A){
  'use strict';
  const ALPHABET='0123456789ABCDEFGHIJKLMNOPQRSTUVW',LIMIT=4096;
  const fail=()=>{throw new Error('这封信不完整或版本暂不支持。请重新复制完整链接或 SL1 信笺码。');};
  function checksum(text){let h=2166136261;for(const byte of new TextEncoder().encode(text))h=Math.imul(h^byte,16777619);return (h>>>0).toString(16).padStart(8,'0');}
  function base64(text){return btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function encode(raw,appearance){
    const s=C.validate(raw),code=A.code(A.validate(appearance));
    if(new TextDecoder('utf-8',{fatal:true}).decode(new TextEncoder().encode(s.title))!==s.title)fail();
    const rows=s.tracks.map(t=>[t.length,t.shift,t.gain,+t.muted,+t.solo,t.notes.map((p,i)=>ALPHABET[(p+1)*3+C.ACCENTS.indexOf(t.accents[i])]).join('')]);
    const body=base64(JSON.stringify([s.title,s.bpm,s.scale,s.volume,s.space,rows,code]));
    const result='SL1.'+body+'.'+checksum(body);if(result.length>LIMIT)fail();return result;
  }
  function decode(code){
    if(typeof code!=='string'||code.length>LIMIT)fail();
    const m=/^SL1\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(code);if(!m||checksum(m[1])!==m[2]||m[1].length%4===1)fail();
    try{
      const bytes=Uint8Array.from(atob(m[1].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
      const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(base64(text)!==m[1])fail();
      const p=JSON.parse(text);if(!Array.isArray(p)||p.length!==7||!Array.isArray(p[5])||p[5].length!==5)fail();
      const tracks=p[5].map(row=>{
        if(!Array.isArray(row)||row.length!==6||!C.LENGTHS.includes(row[0])||![0,1].includes(row[3])||![0,1].includes(row[4])||typeof row[5]!=='string'||row[5].length!==row[0])fail();
        const values=[...row[5]].map(c=>{const n=ALPHABET.indexOf(c);if(n<0)fail();return n;});
        return {length:row[0],shift:row[1],gain:row[2],muted:!!row[3],solo:!!row[4],notes:values.map(n=>Math.floor(n/3)-1),accents:values.map(n=>C.ACCENTS[n%3])};
      });
      const state=C.validate({format:'stargram',version:2,title:p[0],bpm:p[1],scale:p[2],volume:p[3],space:p[4],tracks});
      if(new TextDecoder('utf-8',{fatal:true}).decode(new TextEncoder().encode(state.title))!==state.title)fail();
      return {state,appearance:A.decode(p[6]),code};
    }catch{fail();}
  }
  function parse(input){
    if(typeof input!=='string'||input.length>8192)fail();const text=input.trim();
    if(text.startsWith('SL1.'))return decode(text);
    try{const url=new URL(text);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)fail();return fromHash(url.hash)||fail();}catch{fail();}
  }
  function fromHash(hash){
    if(typeof hash!=='string')fail();if(!hash.startsWith('#letter='))return null;
    if(hash.length>LIMIT+8)fail();return decode(hash.slice(8));
  }
  function link(code,base){
    decode(code);
    try{const url=new URL(base);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return code;url.search='';url.hash='letter='+code;return url.href;}catch{return code;}
  }
  return Object.freeze({encode,decode,parse,fromHash,link,LIMIT});
});
