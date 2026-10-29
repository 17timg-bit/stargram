/* A single-note-per-tick score, displayed in heard order rather than array order. */
(function(root){
  'use strict';
  function create({getOriginal,getDraft,onWrite,onAccent,onUndo,onRedo,onReset,onClear,onRotate,onPhrase}){
    const $=id=>document.getElementById(id),grid=$('manuscriptGrid'),M=OrbitManuscript;
    let selected=0,newAccent=1,focusedPitch=2,lastStep=-1;
    let range=null,anchor=0,choosingEnd=false,lastLength=0,keyboardAnchor=null;
    const labels={up:'升一音',down:'降一音',reverse:'反转音序',invert:'高低倒影',earlier:'提前一格',later:'推后一格',repeat:'接到后一句',erase:'擦掉这句'};
    const ns='http://www.w3.org/2000/svg';
    function svgNode(name,attrs){const n=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;}
    function updatePhrase(message=''){
      const t=getDraft(),contour=$('phraseContour');contour.replaceChildren();
      grid.querySelectorAll('[data-tick]').forEach(b=>{
        const tick=Number(b.dataset.tick),inside=!!range&&tick>=range[0]&&tick<=range[1];
        b.classList.toggle('phrase-selected',inside);b.classList.toggle('phrase-first',inside&&tick===range[0]);b.classList.toggle('phrase-last',inside&&tick===range[1]);
      });
      grid.querySelectorAll('[data-range-tick]').forEach(b=>{
        const tick=Number(b.dataset.rangeTick),inside=!!range&&tick>=range[0]&&tick<=range[1];
        b.setAttribute('aria-pressed',String(inside));b.classList.toggle('phrase-endpoint',!!range&&(tick===range[0]||tick===range[1]));
      });
      let count=0;
      if(range){
        const notes=Array.from({length:range[1]-range[0]+1},(_,i)=>M.heard(t,range[0]+i)),points=[];
        for(let i=0;i<notes.length;i++){
          const x=12+i*296/Math.max(1,notes.length-1),note=notes[i];
          contour.append(svgNode('line',{x1:x,x2:x,y1:48,y2:51,class:'phrase-tick'}));
          if(note.pitch>=0){count++;const y=42-note.pitch*3.6;points.push(`${x},${y}`);}
        }
        if(points.length>1)contour.append(svgNode('polyline',{points:points.join(' '),class:'phrase-line'}));
        notes.forEach((note,i)=>{if(note.pitch>=0)contour.append(svgNode('circle',{cx:12+i*296/Math.max(1,notes.length-1),cy:42-note.pitch*3.6,r:note.accent>1?4.2:note.accent<1?2.2:3.2,class:'phrase-star'}));});
        $('phraseRange').textContent=`${String(range[0]+1).padStart(2,'0')} — ${String(range[1]+1).padStart(2,'0')} / ${notes.length} 格 · ${count} 颗`;
      }else{
        contour.append(svgNode('path',{d:'M12 32 H308',class:'phrase-empty'}));
        $('phraseRange').textContent='尚未圈选';
      }
      $('phraseHint').textContent=choosingEnd?`起点是第 ${anchor+1} 格。再点一个格号，圈出这一句。`:range?'升降沿当前音阶；错拍在选区内循环；接句需要后方同样长的留白。':'点谱纸上方的格号选起点，再点终点；也可 Shift + 方向键圈选。';
      $('phraseStatus').textContent=message||(range?`圈出 ${range[1]-range[0]+1} 格，${count} 颗星星 · 每次变换都可撤回`:'只改圈出的手稿 · 每次变换都可撤回');
      $('phraseCancel').disabled=!range;
      document.querySelectorAll('[data-phrase]').forEach(b=>{
        const plan=range?M.phrase(t,range[0],range[1],b.dataset.phrase):null;
        b.disabled=!plan?.changed;b.title=plan?.reason||(!range?'先圈出一句旋律':labels[b.dataset.phrase]+' · 只改选区');
        b.setAttribute('aria-description',b.title);
      });
    }
    function selectRange(tick,extend=false){
      if(extend){range=[Math.min(anchor,tick),Math.max(anchor,tick)];choosingEnd=false;}
      else if(choosingEnd){range=[Math.min(anchor,tick),Math.max(anchor,tick)];choosingEnd=false;}
      else{anchor=tick;range=[tick,tick];choosingEnd=true;}
      updatePhrase();
    }
    function resetSelection(){range=null;anchor=0;choosingEnd=false;lastLength=0;selected=0;focusedPitch=2;keyboardAnchor=null;}
    function focus(tick,pitch){const b=grid.querySelector(`[data-tick="${tick}"][data-pitch="${pitch}"]`);if(b){grid.querySelectorAll('[tabindex="0"]').forEach(n=>n.tabIndex=-1);b.tabIndex=0;b.focus();b.scrollIntoView({block:'nearest',inline:'nearest'});}}
    function updateSelection(){
      const draft=getDraft(),note=M.heard(draft,selected);
      $('manuscriptSelection').textContent=note.pitch<0?`第 ${selected+1} 格 · 留白`:`第 ${selected+1} 格 · 第 ${note.pitch+1} 音`;
      for(const b of document.querySelectorAll('[data-manuscript-accent]'))b.setAttribute('aria-pressed',String(Number(b.dataset.manuscriptAccent)===(note.pitch>=0?note.accent:newAccent)));
    }
    function render(){
      const t=getDraft(),original=getOriginal();selected=Math.min(selected,t.length-1);lastStep=-1;
      if(lastLength&&lastLength!==t.length){range=null;choosingEnd=false;anchor=0;keyboardAnchor=null;}lastLength=t.length;
      grid.style.setProperty('--ticks',t.length);grid.setAttribute('aria-colcount',String(t.length+1));grid.replaceChildren();
      const ruler=document.createElement('div');ruler.className='score-row score-ruler';ruler.setAttribute('role','row');
      for(let tick=-1;tick<t.length;tick++){
        const label=document.createElement('span');label.setAttribute('role','columnheader');
        if(tick<0)label.textContent='音 / 格';
        else{const b=document.createElement('button');b.type='button';b.dataset.rangeTick=tick;b.textContent=String(tick+1).padStart(2,'0');b.setAttribute('aria-label',`圈选端点，第${tick+1}格`);b.onclick=e=>{keyboardAnchor=null;selectRange(tick,e.shiftKey);};label.append(b);}
        ruler.append(label);
      }grid.append(ruler);
      for(let pitch=9;pitch>=0;pitch--){
        const row=document.createElement('div');row.className='score-row'+(pitch===5?' octave-break':'');row.setAttribute('role','row');
        const label=document.createElement('span');label.className='score-pitch';label.setAttribute('role','rowheader');label.textContent=String(pitch+1).padStart(2,'0');row.append(label);
        for(let tick=0;tick<t.length;tick++){
          const note=M.heard(t,tick),ghost=original.length===t.length&&M.heard(original,tick).pitch===pitch;
          const b=document.createElement('button');b.type='button';b.setAttribute('role','gridcell');b.dataset.tick=tick;b.dataset.pitch=pitch;b.tabIndex=tick===selected&&pitch===focusedPitch?0:-1;
          b.className='score-cell'+(tick%4===0?' beat-start':'')+(ghost?' original-note':'')+(note.pitch===pitch?' written':'')+(note.pitch===pitch&&note.accent>1?' strong':note.pitch===pitch&&note.accent<1?' soft':'');
          b.setAttribute('aria-selected',String(note.pitch===pitch));b.setAttribute('aria-label',`第${tick+1}格，第${pitch+1}音，${note.pitch===pitch?'已有星星':ghost?'原轨位置':'空位'}`);
          b.onclick=()=>{selected=tick;focusedPitch=pitch;onWrite(tick,pitch,newAccent);focus(tick,pitch);};
          b.onfocus=()=>{selected=tick;focusedPitch=pitch;updateSelection();};
          b.onkeydown=e=>{let x=tick,y=pitch;if(e.key==='ArrowRight')x=Math.min(t.length-1,x+1);else if(e.key==='ArrowLeft')x=Math.max(0,x-1);else if(e.key==='ArrowUp')y=Math.min(9,y+1);else if(e.key==='ArrowDown')y=Math.max(0,y-1);else if(e.key==='Home')x=0;else if(e.key==='End')x=t.length-1;else return;e.preventDefault();if(e.shiftKey&&(x!==tick||e.key==='Home'||e.key==='End')){if(keyboardAnchor===null)keyboardAnchor=tick;anchor=keyboardAnchor;selectRange(x,true);}else keyboardAnchor=null;focus(x,y);};
          row.append(b);
        }
        grid.append(row);
      }
      $('manuscriptGhostHint').textContent=original.length===t.length?'空心标记是原轨；实心星星是手稿。点音格写音，点上方格号圈一句。':'手稿周期已改变；可以分别试听原轨与手稿。点上方格号圈一句。';updateSelection();updatePhrase();
    }
    document.querySelectorAll('[data-manuscript-accent]').forEach(b=>b.onclick=()=>{newAccent=Number(b.dataset.manuscriptAccent);onAccent(selected,newAccent);updateSelection();});
    for(const [id,fn] of [['manuscriptUndo',onUndo],['manuscriptRedo',onRedo],['manuscriptReset',onReset],['manuscriptClear',onClear],['loomRotate',onRotate]])$(id).onclick=fn;
    grid.onkeydown=e=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopPropagation();(e.shiftKey?onRedo:onUndo)();focus(selected,focusedPitch);}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();e.stopPropagation();range=[0,getDraft().length-1];anchor=0;choosingEnd=false;updatePhrase();}
    };
    grid.onkeyup=e=>{if(e.key==='Shift')keyboardAnchor=null;};
    grid.onfocusout=e=>{if(!grid.contains(e.relatedTarget))keyboardAnchor=null;};
    $('phraseAll').onclick=()=>{range=[0,getDraft().length-1];anchor=0;choosingEnd=false;updatePhrase();};
    $('phraseCancel').onclick=()=>{range=null;choosingEnd=false;keyboardAnchor=null;updatePhrase();};
    document.querySelectorAll('[data-phrase]').forEach(b=>b.onclick=()=>{
      if(!range)return;const result=onPhrase(range[0],range[1],b.dataset.phrase);choosingEnd=false;
      updatePhrase(result.changed?`已${labels[b.dataset.phrase]} · 可以撤回；原轨还没有改变。`:result.reason);
    });
    function playhead(tick){if(tick===lastStep)return;lastStep=tick;grid.querySelectorAll('[data-tick]').forEach(b=>b.classList.toggle('sounding',Number(b.dataset.tick)===tick));}
    return {render,playhead,resetSelection};
  }
  root.OrbitScorePaper=Object.freeze({create});
})(globalThis);
