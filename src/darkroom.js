(function(root){
  'use strict';
  function create({get,apply,draw}){
    const A=AstroAppearance,$=id=>document.getElementById(id),dialog=$('themeDialog');
    let group='sky',history=[],opening=A.validate(get()),dirty=true,lastDraw=0;
    const labels={sky:'天幕',spectrum:'光谱',disc:'星盘',type:'字样'};
    function choose(value){history.push(A.validate(get()));if(history.length>30)history.shift();apply(value);}
    function status(text){$('themeStatus').textContent=text;}
    for(const [key,catalog] of Object.entries(A.catalogs)){
      const pane=$('appearance-'+key);
      for(const [id,item] of Object.entries(catalog)){
        const button=document.createElement('button');button.type='button';button.className='recipe-option';button.dataset.part=key;button.dataset.choice=id;button.setAttribute('aria-pressed','false');
        const art=document.createElement('span');art.className='recipe-art '+key+'-'+id;art.setAttribute('aria-hidden','true');
        if(key==='sky'){const canvas=document.createElement('canvas');canvas.width=240;canvas.height=120;AstroPaint.paint(canvas.getContext('2d'),240,120,{...get(),sky:id});art.append(canvas);}
        else if(key==='spectrum'){art.style.setProperty('--sample',item.hue);art.style.setProperty('--sample-light',item.light);art.textContent=item.tag;}
        else if(key==='disc')art.innerHTML={rings:'◎',atlas:'⊕',diffraction:'✧',craters:'◌'}[id];
        else {art.style.fontFamily=item.font;art.textContent='星河';}
        const title=document.createElement('strong');title.textContent=item.name;const tag=document.createElement('small');tag.textContent=item.tag;const check=document.createElement('i');check.textContent='✓';check.setAttribute('aria-hidden','true');
        button.append(art,title,tag,check);button.onclick=()=>choose({...get(),[key]:id});pane.append(button);
      }
    }
    for(const [id,item] of Object.entries(A.presets)){
      const b=document.createElement('button');b.type='button';b.dataset.recipe=id;b.textContent=item.name;b.onclick=()=>choose(A.preset(id));$('recipePresets').append(b);
    }
    function setGroup(key){group=key;for(const b of document.querySelectorAll('[data-appearance-tab]')){const active=b.dataset.appearanceTab===key;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}for(const key of Object.keys(A.catalogs))$('appearance-'+key).hidden=key!==group;refresh();}
    const tabs=[...document.querySelectorAll('[data-appearance-tab]')];
    tabs.forEach((b,index)=>{b.onclick=()=>setGroup(b.dataset.appearanceTab);b.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(index+1)%tabs.length;if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();setGroup(tabs[next].dataset.appearanceTab);tabs[next].focus();}};});
    $('appearanceUndo').onclick=()=>{if(history.length)apply(history.pop());};
    $('appearanceRestore').onclick=()=>choose(opening);
    $('appearanceShuffle').onclick=()=>{const before=get(),value={version:1};for(const [key,c] of Object.entries(A.catalogs)){const keys=Object.keys(c);value[key]=keys[Math.floor(Math.random()*keys.length)];}if(A.code(value)===A.code(before)){const keys=Object.keys(A.catalogs.sky);value.sky=keys[(keys.indexOf(value.sky)+1)%keys.length];}choose(value);};
    $('recipeCopy').onclick=async()=>{const code=A.code(get());try{await navigator.clipboard.writeText(code);status('配方编号已复制。把它交给朋友，就能调出同一束光。');}catch{$('recipeCode').focus();$('recipeCode').select();status('配方已选中，按 Ctrl+C 或长按复制即可。');}};
    $('recipeImportForm').onsubmit=e=>{e.preventDefault();try{const value=A.decode($('recipeInput').value);choose(value);$('recipeInput').value='';status('已读入这份观测配方。乐曲保持原样。');}catch{status('这个编号还认不出来，请使用 SG1- 开头的完整配方编号。');}};
    function refresh(){
      const value=get();dirty=true;
      for(const b of document.querySelectorAll('[data-part]'))b.setAttribute('aria-pressed',String(value[b.dataset.part]===b.dataset.choice));
      for(const b of document.querySelectorAll('[data-recipe]'))b.setAttribute('aria-pressed',String(A.code(A.preset(b.dataset.recipe))===A.code(value)));
      $('recipeCode').value=A.code(value);$('appearanceUndo').disabled=!history.length;
      $('darkroomCaption').textContent=Object.entries(A.catalogs).map(([k,c])=>c[value[k]].name).join(' / ');
      const choice=A.catalogs[group][value[group]];$('partDescription').textContent=choice.hint||('用'+choice.name+'为星图留下一束光。');
      $('partName').textContent=labels[group]+' / '+choice.name;
      $('recipeTypeSample').textContent='让偶然，成为旋律。';
      if(dialog.open){draw($('darkroomCanvas'));dirty=false;lastDraw=performance.now();}
    }
    function open(){opening=A.validate(get());history=[];status('随意组合，每一步都可以退回。外观单独记住，不改变乐曲。');dialog.showModal();refresh();}
    function tick(now,playing){if(dialog.open&&(dirty||(playing&&now-lastDraw>120))){draw($('darkroomCanvas'));dirty=false;lastDraw=now;}}
    setGroup('sky');return {open,refresh,tick};
  }
  root.AstroDarkroom=Object.freeze({create});
})(globalThis);
