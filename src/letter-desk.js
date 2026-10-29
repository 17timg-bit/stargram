/* The letter desk never writes a received composition until the reader accepts. */
(function(root){
  'use strict';
  function create({getState,getAppearance,accept,onOpen}){
    const $=id=>document.getElementById(id),L=OrbitLetters,C=OrbitCore,A=AstroAppearance,d=$('letterDialog');
    let letter=null,mode='send',revision=0;
    function status(text){$('letterStatus').textContent=text;}
    function paint(){
      const preview=$('letterPreview');preview.replaceChildren();if(!letter)return;
      const s=letter.state,a=letter.appearance,tokens=A.applyTo(preview,a);
      const header=document.createElement('div');header.className='letter-card-head';
      const label=document.createElement('span');label.textContent='STARGRAM / INTERSTELLAR POST';
      const stamp=document.createElement('span');stamp.className='letter-stamp';stamp.textContent='✳\nSL / 01';header.append(label,stamp);
      const title=document.createElement('h3');title.textContent=s.title;
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=300;canvas.setAttribute('aria-label','五条声部的星星与循环');
      const c=canvas.getContext('2d');c.strokeStyle=tokens.border;c.lineWidth=1;
      s.tracks.forEach((t,index)=>{
        const y=30+index*57;c.beginPath();c.moveTo(20,y);c.lineTo(620,y);c.stroke();
        t.notes.forEach((p,i)=>{if(p<0)return;const x=25+C.mod(i+t.shift,t.length)/t.length*590;c.globalAlpha=C.audible(s,index)?0.9:0.25;c.fillStyle=tokens.button;c.beginPath();c.arc(x,y,2.5+t.accents[i]*2,0,Math.PI*2);c.fill();});c.globalAlpha=1;
      });
      const meta=document.createElement('p');meta.className='letter-card-meta';meta.textContent=`${s.bpm} BPM / ${C.countNotes(s)} 颗星 / ${C.SCALES[s.scale].label}`;
      const recipe=document.createElement('small');recipe.textContent='观测配方 '+A.code(a)+' · 五条声部，带着各自的时间';
      preview.append(header,title,canvas,meta,recipe);
    }
    function setMode(next){
      mode=next;revision++;$('letterSend').hidden=next!=='send';$('letterRead').hidden=next!=='read';
      $('letterTitle').textContent=next==='send'?'把这一圈，寄到另一片星空。':'有一片星空，正在等你拆开。';
      $('letterAccept').hidden=next!=='read';$('letterAccept').disabled=!letter;
      $('letterAppearance').checked=true;paint();
    }
    function show(){onOpen();if(!d.open)d.showModal();}
    function send(){
      try{letter=L.decode(L.encode(getState(),getAppearance()));}catch{letter=null;setMode('send');$('letterOutput').value='';$('letterCopy').disabled=true;$('letterTry').disabled=true;status('这张星图暂时无法封成信，请检查名称是否含不完整的字符。');show();return;}
      setMode('send');$('letterCopy').disabled=false;$('letterTry').disabled=false;const value=L.link(letter.code,location.href);$('letterOutput').value=value;
      $('letterCopy').textContent=value===letter.code?'复制信笺码':'复制游玩链接';
      $('letterAddressHint').textContent=value===letter.code?'离线信笺码：对方可在 v1.8 或更新版的“读一封来信”中粘贴打开。':/^(localhost|127\.|\[::1\])/.test(location.hostname)?'这是本机预览地址。发布网页后，从公开网址生成的信才可以寄给朋友。':'链接包含当前作品和外观，保留这个版本。对方需要 v1.8 或更新版；之后修改作品不影响已寄出的信。';
      status('信里装着音符、轻重、混音与这束光。没有上传作品，也没有收件人名单。');show();
    }
    function receive(value){
      revision++;letter=null;$('letterInput').value=value;setMode('read');
      if(!value.trim()){status('粘贴完整链接或 SL1 信笺码，再点“展开来信”。');show();return;}
      try{letter=L.parse(value);paint();$('letterAccept').disabled=false;status('已读到这封信。先看看，再决定是否放上你的唱片机。');}catch(e){status(e.message);}
      show();
    }
    $('letterCopy').onclick=async()=>{const token=revision,value=$('letterOutput').value;try{await navigator.clipboard.writeText(value);if(token===revision&&d.open)status('已复制。把这封信交给你想分享的人。');}catch{if(token===revision&&d.open){$('letterOutput').focus();$('letterOutput').select();status('已选中整封信，按 Ctrl+C 或长按复制即可。');}}};
    $('letterReadBtn').onclick=()=>receive('');$('letterSendBtn').onclick=send;
    $('letterParse').onclick=()=>receive($('letterInput').value);
    $('letterInput').oninput=()=>{letter=null;revision++;paint();$('letterAccept').disabled=true;status('内容已改变，点“展开来信”重新查看。');};
    $('letterTry').onclick=()=>receive($('letterOutput').value);
    $('letterAccept').onclick=()=>{if(!letter)return;accept(C.clone(letter.state),$('letterAppearance').checked?A.validate(letter.appearance):null);d.close();};
    d.addEventListener('close',()=>{revision++;});
    return {send,receive,arrival(){try{const value=L.fromHash(location.hash);if(value)receive(value.code);}catch{receive(location.href);}}};
  }
  root.OrbitLetterDesk=Object.freeze({create});
})(globalThis);
