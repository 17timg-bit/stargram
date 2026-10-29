/* Diversity is measured separately from validity and musical preference. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),C=require('../src/core');
const all=Array.from({length:1000},(_,seed)=>C.generate(seed));
const count=fn=>new Set(all.map(fn)).size;
const report={date:'2026-10-29',version:'1.9.0',seeds:1000,baseline:'same dawn map, volume 0.55',
  tempos:count(s=>s.bpm),scales:count(s=>s.scale),spaces:count(s=>s.space),styles:count(s=>s.title.split(' · ')[0]),
  distinct_compositions:count(s=>JSON.stringify({...s,title:''})),
  roles:C.ROLES.map((role,i)=>({name:role.name,distinct_tracks:count(s=>JSON.stringify(s.tracks[i])),distinct_rhythms:count(s=>{const t=s.tracks[i];return JSON.stringify([t.length,Array.from({length:t.length},(_,tick)=>t.notes[C.mod(tick-t.shift,t.length)]>=0?tick:-1).filter(n=>n>=0)]);}),lengths:[...new Set(all.map(s=>s.tracks[i].length))].sort((a,b)=>a-b),note_counts:[...new Set(all.map(s=>s.tracks[i].notes.filter(p=>p>=0).length))].sort((a,b)=>a-b)})),
  note:'Diversity statistics verify variation, not listening preference. Rhythm fingerprints use period and occupied heard ticks, so equivalent array/phase representations count once.'};
const folder=path.join(__dirname,'..','验证记录','v1.9.0');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'多样性测量.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
