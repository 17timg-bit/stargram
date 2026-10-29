'use strict';
const fs=require('node:fs'),path=require('node:path'),C=require('../src/core');
const folder=path.join(__dirname,'..','示例作品','v1.9.0');fs.mkdirSync(folder,{recursive:true});
const names=['玻璃漂流','近日巡游','潮汐回航'],found=new Map();
for(let seed=0;seed<1000&&found.size<names.length;seed++){const state=C.generate(seed),style=state.title.split(' · ')[0];if(names.includes(style)&&!found.has(style))found.set(style,{seed,state});}
const manifest=names.map(style=>{const {seed,state}=found.get(style);fs.writeFileSync(path.join(folder,style+'.json'),JSON.stringify(state,null,2)+'\n');return {style,seed,title:state.title,bpm:state.bpm,scale:state.scale,space:state.space,base:'dawn / volume 0.55',periods:state.tracks.map(t=>t.length)};});
fs.writeFileSync(path.join(folder,'样片说明.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest,null,2));
