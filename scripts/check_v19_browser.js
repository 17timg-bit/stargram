'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),C=require('../src/core');
const root=path.join(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const history=read('验证记录/v1.9.0/连续偶遇.json');
for(const {before,after} of history){const base=C.preset();base.bpm=before.bpm;base.scale=before.scale;base.space=before.space/100;base.volume=before.volume/100;const seed=parseInt(after.title.split(' · ')[1],36),expected=C.generate(seed,base);assert.equal(after.title,expected.title);assert.equal(after.bpm,expected.bpm);assert.equal(after.scale,expected.scale);assert.equal(after.space,Math.round(expected.space*100));assert.equal(after.volume,before.volume);assert.equal(after.sky,before.sky);assert.deepEqual(after.periods,expected.tracks.map(t=>t.length));}
for(const item of read('示例作品/v1.9.0/样片说明.json'))assert.deepEqual(read('示例作品/v1.9.0/'+item.style+'.json'),C.generate(item.seed));
console.log(JSON.stringify({observed_encounters_matching_generator:history.length,actual_json_samples_matching_generator:3}));
