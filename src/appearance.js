/* Composable, offline art direction. No musical state or DOM is read here. */
(function (root) {
  'use strict';
  const skies = {
    zodiac:{name:'黄道晨光',tag:'ZODIACAL LIGHT',hint:'尘埃把日光散成一道温暖的斜束。',base:'#f2efe6',ink:'#263b38',colors:['#d7a75f','#d9b98a'],light:true},
    moon:{name:'月海银尘',tag:'LUNAR MARIA',hint:'银灰底片上，留下环形山与月海的印记。',base:'#e9eaf0',ink:'#303b50',colors:['#8d9bb1','#b5bbcb'],light:true},
    deep:{name:'银河远岸',tag:'DEEP FIELD',hint:'墨蓝深处，一条星尘带缓慢展开。',base:'#111a29',ink:'#e2e7ef',colors:['#526aa4','#b0959b'],light:false},
    rosette:{name:'玫瑰星云',tag:'ROSETTE / NGC 2237',hint:'环状云气、暗尘与一抹洋红的余光。',base:'#211724',ink:'#f1e2ed',colors:['#bd4b79','#795896'],light:false},
    pleiades:{name:'昴宿蓝雾',tag:'PLEIADES / M45',hint:'亮星照过尘埃，蓝色云丝在星间散开。',base:'#131e30',ink:'#dfebf7',colors:['#4f8cca','#7c7ab2'],light:false},
    aurora:{name:'极光帷幕',tag:'AURORAL CURTAINS',hint:'青绿与紫色的光带，像被风提起的帷幕。',base:'#102323',ink:'#e0eee7',colors:['#49b49a','#9270b6'],light:false}
  };
  const spectra = {
    hydrogen:{name:'氢红',tag:'Hα',hue:'#df7397',dark:'#8e3457',light:'#edb0c4'},
    oxygen:{name:'氧青',tag:'[O III]',hue:'#6ecab6',dark:'#286b60',light:'#b8dec9'},
    sodium:{name:'钠金',tag:'Na',hue:'#dfba70',dark:'#7c6132',light:'#e7d09b'},
    ice:{name:'星蓝',tag:'REFLECTION',hue:'#88b9e1',dark:'#365c83',light:'#c0d9ea'},
    copper:{name:'日珥橘',tag:'SOLAR',hue:'#e6a06d',dark:'#884e33',light:'#edd0aa'}
  };
  const discs = {
    rings:{name:'土星环纹',tag:'RINGS',hint:'密集同心唱纹，像一圈圈被刻下的时间。'},
    atlas:{name:'航海星图',tag:'ATLAS',hint:'经纬、方位与刻度，让唱片成为一件测绘仪器。'},
    diffraction:{name:'衍射星芒',tag:'DIFFRACTION',hint:'四向光芒与细十字，取意于星野影像中的亮星。'},
    craters:{name:'月面拓印',tag:'CRATERS',hint:'浅浅的坑缘与弧面，在胶片上留下银版的触感。'}
  };
  const types = {
    book:{name:'星图书页',tag:'SERIF',hint:'宋体题签，像一本安静的天文图册。',font:'"Iowan Old Style","Palatino Linotype","STSong","SimSun",serif'},
    signal:{name:'空间站讯号',tag:'SANS',hint:'清楚、直接的无衬线，留一点太空舱的秩序。',font:'"Segoe UI","Microsoft YaHei UI","Microsoft YaHei",sans-serif'},
    field:{name:'观测手记',tag:'FIELD NOTES',hint:'楷体笔意，像观测本上亲手写下的名字。',font:'"KaiTi","STKaiti","FangSong",serif'}
  };
  const presets = {
    rosette:{name:'玫瑰里的航线',sky:'rosette',spectrum:'hydrogen',disc:'atlas',type:'book'},
    sisters:{name:'七姐妹来信',sky:'pleiades',spectrum:'ice',disc:'diffraction',type:'field'},
    polar:{name:'极地电台',sky:'aurora',spectrum:'oxygen',disc:'rings',type:'signal'},
    paper:{name:'纸间晴昼',sky:'zodiac',spectrum:'oxygen',disc:'rings',type:'book'},
    nocturne:{name:'鎏金夜航',sky:'deep',spectrum:'sodium',disc:'rings',type:'book'},
    mist:{name:'雾蓝回声',sky:'moon',spectrum:'ice',disc:'craters',type:'book'}
  };
  // Insertion order is the SG1 wire format. Never reorder existing catalog IDs.
  const catalogs = {sky:skies,spectrum:spectra,disc:discs,type:types};
  const KEY='stargram.appearance.v2', LEGACY='stargram.appearance.v1';
  const own=(o,k)=>Object.hasOwn(o,k);
  function validate(raw) {
    if (!raw || typeof raw!=='object' || Array.isArray(raw) || raw.version!==1) throw new Error('Invalid appearance');
    const result={version:1};
    for(const [key,choices] of Object.entries(catalogs)) {if(!own(raw,key)||!own(choices,raw[key]))throw new Error('Invalid '+key);result[key]=raw[key];}
    return result;
  }
  function preset(id='paper') {if(!own(presets,id))throw new Error('Unknown appearance');return validate({version:1,...presets[id]});}
  function read(storage) {
    try {
      const value=storage?.getItem(KEY);
      if(value!==null&&value!==undefined) {if(value.length>512)throw new Error('Oversized appearance');return {value:validate(JSON.parse(value)),source:'current'};}
      const old=storage?.getItem(LEGACY);if(['paper','nocturne','mist'].includes(old))return {value:preset(old),source:'legacy'};
      return {value:preset(),source:'default'};
    } catch {return {value:preset(),source:'unavailable'};}
  }
  function save(storage,raw) {const value=validate(raw);try{if(!storage)return false;storage.setItem(KEY,JSON.stringify(value));return true;}catch{return false;}}
  function code(raw) {const value=validate(raw);return 'SG1-'+Object.entries(catalogs).map(([k,c])=>Object.keys(c).indexOf(value[k])+1).join('');}
  function decode(text) {if(typeof text!=='string'||!/^SG1-[1-6][1-5][1-4][1-3]$/.test(text.trim()))throw new Error('Invalid recipe code');const n=text.trim().slice(4);return validate({version:1,...Object.fromEntries(Object.entries(catalogs).map(([k,c],i)=>[k,Object.keys(c)[Number(n[i])-1]]))});}
  function mix(a,b,t) {const rgb=h=>h.slice(1).match(/../g).map(x=>parseInt(x,16));return '#'+rgb(a).map((x,i)=>Math.round(x+(rgb(b)[i]-x)*t).toString(16).padStart(2,'0')).join('');}
  function luminance(hex) {const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
  function contrast(a,b) {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  function readable(color,back,target=4.8) {const ink=contrast('#10171d',back)>contrast('#f7f5ee',back)?'#10171d':'#f7f5ee';for(let i=0;i<=20;i++){const c=mix(color,ink,i/20);if(contrast(c,back)>=target)return c;}return ink;}
  function compose(raw) {
    const r=validate(raw),s=skies[r.sky],p=spectra[r.spectrum],b=s.base,i=s.ink,a=readable(p.hue,b),button=a;
    const on=contrast('#10171d',button)>contrast('#fffaf2',button)?'#10171d':'#fffaf2';
    return {paper:b,card:mix(b,i,.035),ink:i,muted:readable(mix(b,i,.66),b,5.4),line:i+'35',border:i+'70',mint:p.light,gold:p.hue,orange:a,accent:p.hue,field:mix(b,i,.025),wash:mix(b,i,.075),selected:mix(b,p.hue,.16),button,'button-ink':on,'button-hover':mix(button,on,.1),'accent-wash':mix(b,p.hue,.10),'accent-selected':mix(b,p.hue,.20),slider:mix(b,i,.28),deck:mix(b,i,.025)+'f7',shadow:s.light?'#15233929':'#00000055',backdrop:mix(b,'#000000',.45)+'d0','loom-paper':mix(b,p.hue,.10),'loom-ink':i,'record-edge':mix(p.dark,'#07151b',.65),'record-light':mix(p.dark,p.hue,.15),'record-mid':mix(p.dark,'#07151b',.40),'record-dark':mix(p.dark,'#07151b',.76),'record-groove':p.light,'record-label':p.light,'record-label-line':p.dark,'record-label-ink':readable(p.dark,p.light),'arm-metal':mix(p.light,'#86909c',.45),'arm-light':'#f7f1de','arm-head':mix(p.dark,'#07151b',.4),'arm-tip':p.hue,serif:types[r.type].font};
  }
  function applyTo(element,raw) {const r=validate(raw),tokens=compose(r);for(const [key,value] of Object.entries(tokens))element.style.setProperty('--'+key,value);for(const key of Object.keys(catalogs))element.dataset[key]=r[key];element.style.colorScheme=skies[r.sky].light?'light':'dark';return tokens;}
  function freeze(value) {Object.values(value).forEach(v=>{if(v&&typeof v==='object')freeze(v);});return Object.freeze(value);}
  const api=freeze({KEY,LEGACY,catalogs,presets,validate,preset,read,save,code,decode,compose,applyTo,mix,contrast});
  if(typeof module==='object'&&module.exports)module.exports=api;else root.AstroAppearance=api;
})(typeof globalThis!=='undefined'?globalThis:this);
