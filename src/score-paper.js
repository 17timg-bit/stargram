/* A single-note-per-tick score, displayed in heard order rather than array order. */
(function(root){
  'use strict';
  function create({getOriginal,getDraft,onWrite,onAccent,onUndo,onRedo,onReset,onClear,onRotate}){
    const $=id=>document.getElementById(id),grid=$('manuscriptGrid'),M=OrbitManuscript;
    let selected=0,newAccent=1,focusedPitch=2,lastStep=-1;
    function focus(tick,pitch){const b=grid.querySelector(`[data-tick="${tick}"][data-pitch="${pitch}"]`);if(b){grid.querySelectorAll('[tabindex="0"]').forEach(n=>n.tabIndex=-1);b.tabIndex=0;b.focus();b.scrollIntoView({block:'nearest',inline:'nearest'});}}
    function updateSelection(){
      const draft=getDraft(),note=M.heard(draft,selected);
      $('manuscriptSelection').textContent=note.pitch<0?`第 ${selected+1} 格 · 留白`:`第 ${selected+1} 格 · 第 ${note.pitch+1} 音`;
      for(const b of document.querySelectorAll('[data-manuscript-accent]'))b.setAttribute('aria-pressed',String(Number(b.dataset.manuscriptAccent)===(note.pitch>=0?note.accent:newAccent)));
    }
    function render(){
      const t=getDraft(),original=getOriginal();selected=Math.min(selected,t.length-1);lastStep=-1;
      grid.style.setProperty('--ticks',t.length);grid.setAttribute('aria-colcount',String(t.length+1));grid.replaceChildren();
      const ruler=document.createElement('div');ruler.className='score-row score-ruler';ruler.setAttribute('role','row');
      for(let tick=-1;tick<t.length;tick++){const label=document.createElement('span');label.setAttribute('role','columnheader');label.textContent=tick<0?'音 / 格':String(tick+1).padStart(2,'0');ruler.append(label);}grid.append(ruler);
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
          b.onkeydown=e=>{let x=tick,y=pitch;if(e.key==='ArrowRight')x=Math.min(t.length-1,x+1);else if(e.key==='ArrowLeft')x=Math.max(0,x-1);else if(e.key==='ArrowUp')y=Math.min(9,y+1);else if(e.key==='ArrowDown')y=Math.max(0,y-1);else if(e.key==='Home')x=0;else if(e.key==='End')x=t.length-1;else return;e.preventDefault();focus(x,y);};
          row.append(b);
        }
        grid.append(row);
      }
      $('manuscriptGhostHint').textContent=original.length===t.length?'空心标记是原轨；实心星星是手稿。每格保留一个音。':'手稿周期已改变；可以分别试听原轨与手稿。';updateSelection();
    }
    document.querySelectorAll('[data-manuscript-accent]').forEach(b=>b.onclick=()=>{newAccent=Number(b.dataset.manuscriptAccent);onAccent(selected,newAccent);updateSelection();});
    for(const [id,fn] of [['manuscriptUndo',onUndo],['manuscriptRedo',onRedo],['manuscriptReset',onReset],['manuscriptClear',onClear],['loomRotate',onRotate]])$(id).onclick=fn;
    grid.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopPropagation();(e.shiftKey?onRedo:onUndo)();focus(selected,focusedPitch);}};
    function playhead(tick){if(tick===lastStep)return;lastStep=tick;grid.querySelectorAll('[data-tick]').forEach(b=>b.classList.toggle('sounding',Number(b.dataset.tick)===tick));}
    return {render,playhead};
  }
  root.OrbitScorePaper=Object.freeze({create});
})(globalThis);
