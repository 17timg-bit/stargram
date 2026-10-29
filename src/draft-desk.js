/* A small drawer for explicit, portable manuscripts; browsing never restores. */
(function(root){
  'use strict';
  function create({store,getCurrent,onOpen,onSaved,onTake,download,onCount}){
    const D=OrbitDrafts,C=OrbitCore,$=id=>document.getElementById(id),dialog=$('draftDialog');
    let pending=null,chosen=null,imported=false,removed=null,token=0;
    const node=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
    function status(text){$('draftStatus').textContent=text;}
    function strip(track,label){
      const box=node('div','draft-strip'),caption=node('div','draft-strip-label',label+' / '+track.length+' 格'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      if(label==='A 原轨')box.classList.add('original-strip');
      svg.setAttribute('viewBox','0 0 360 78');svg.setAttribute('aria-hidden','true');
      const shape=(tag,attrs)=>{const e=document.createElementNS(svg.namespaceURI,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
      const points=[];
      for(let tick=0;tick<track.length;tick++){
        const note=OrbitManuscript.heard(track,tick),x=14+tick*332/(track.length-1);
        svg.append(shape('line',{x1:x,x2:x,y1:65,y2:68,class:'draft-tick'}));
        if(note.pitch>=0)points.push({x,y:52-note.pitch*4.4,note});
      }
      if(points.length>1)svg.append(shape('polyline',{points:points.map(p=>p.x+','+p.y).join(' '),class:'draft-contour'}));
      for(const p of points)svg.append(shape('circle',{cx:p.x,cy:p.y,r:p.note.accent>1?4.3:p.note.accent<1?2.2:3.3,class:'draft-star'}));
      if(!points.length)box.append(node('span','draft-silence','这一圈，暂时留白。'));
      box.append(caption,svg);return box;
    }
    function preview(data,target){
      target.replaceChildren(node('div','eyebrow','0'+(data.index+1)+' / '+C.ROLES[data.index].name),node('h3','',data.title));
      target.append(node('p','draft-origin','出自「'+data.base.title+'」'),node('p','draft-context',data.base.bpm+' BPM · '+C.SCALES[data.base.scale].label+' · '+Math.round(data.base.space*100)+'% 回响'));
      target.append(strip(data.base.tracks[data.index],'A 原轨'),strip(data.draft,'B 手稿'));
    }
    function counts(){onCount?.(store.size);$('draftTotal').textContent=store.size+' / '+D.LIMIT;$('draftSummary').textContent=store.readError?'原始数据保留中，暂时不能写入':store.size+' / '+D.LIMIT+' 页 · 各自保留原星图';}
    function renderList(){
      counts();const list=$('draftList'),scrollTop=list.scrollTop;list.replaceChildren();
      for(const [index,e] of store.entries.entries()){
        const b=node('button','draft-leaf'+(chosen?.id===e.id?' selected':''));b.type='button';b.dataset.draftId=e.id;b.setAttribute('aria-pressed',String(chosen?.id===e.id));
        b.append(node('span','draft-leaf-number',String(index+1).padStart(2,'0')),node('strong','',e.title),node('span','draft-leaf-meta',C.ROLES[e.index].name+' · '+e.draft.length+' 格 · '+e.base.bpm+' BPM'),node('small','',new Date(e.updated).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})+' / 第 '+e.revision+' 稿'));
        b.onclick=()=>{try{chosen=store.load(e.id,e.revision);imported=false;renderList();renderDetail();status('先看看这一页。只有按下“取回”才改变工作台。');}catch(error){status(error.message);refresh();}};list.append(b);
      }
      if(!store.size){const empty=node('div','draft-empty');empty.append(node('span','','▱'),node('h3','','未完，也是一种抵达。'),node('p','','在织星台存一页手稿，下次再从这里续写。'));list.append(empty);}
      $('draftUndo').hidden=!removed;
      list.scrollTop=scrollTop;
    }
    function renderDetail(){
      $('draftDetailActions').hidden=!chosen;
      if(!chosen){$('draftPreview').replaceChildren(node('div','draft-waiting','从左边翻开一页，或读入一份手稿文件。'));return;}
      preview(chosen,$('draftPreview'));
      $('draftTake').hidden=imported;$('draftImportSave').hidden=!imported;$('draftRemove').hidden=imported;
      $('draftDetail').classList.toggle('import-preview',imported);
    }
    function refresh(){store.refresh();renderList();if(store.readError)status('手稿匣暂时无法读取。原始数据没有被覆盖，可先另存当前手稿文件。');}
    function mode(save){
      $('draftSavePane').hidden=!save;$('draftBrowsePane').hidden=save;
      $('draftBrowseTab').setAttribute('aria-pressed',String(!save));$('draftSaveTab').setAttribute('aria-pressed',String(save));
      if(save){
        pending=getCurrent();if(!pending){mode(false);return;}
        $('draftName').value=pending.payload.title;$('draftName').setCustomValidity('');
        $('draftSaveSubmit').textContent=pending.target?'更新这份手稿':'存进手稿匣';$('draftSaveAs').hidden=!pending.target;
        $('draftSaveSummary').textContent='保存「'+C.ROLES[pending.payload.index].name+'」的当前稿面，连同原星图一起。';preview(pending.payload,$('draftSavePreview'));
        status('没有自动保存进匣；按下保存后，才留下这一份。');
      }else{refresh();renderDetail();status(store.readError?'手稿匣读取失败，原始数据仍保留。':'只留在此浏览器。重要的一页，也可以另存手稿文件带走。');}
    }
    function open(save=false){token++;onOpen();chosen=null;imported=false;$('draftSaveTab').disabled=!getCurrent();mode(save);dialog.showModal();}
    function formData(){const title=$('draftName').value.trim();if(!title){$('draftName').setCustomValidity('给这一页取个名字吧。');$('draftName').reportValidity();return null;}return D.content({...pending.payload,title});}
    function save(asNew=false){
      if(!pending)return;const data=formData();if(!data)return;
      try{const result=store.save(data,asNew?null:pending.target);onSaved(result.entry,pending.doc,data);pending={...pending,payload:data,target:{id:result.entry.id,revision:result.entry.revision}};chosen=result.entry;imported=false;counts();$('draftSaveSubmit').textContent='更新这份手稿';$('draftSaveAs').hidden=false;status(result.duplicate?'这一稿已经在匣中，不重复占位置。':'已存进手稿匣。刷新或换星图后，仍可以从这里取回。');}
      catch(error){status(error.message);}
    }
    $('draftSaveForm').onsubmit=e=>{e.preventDefault();save();};$('draftSaveAs').onclick=()=>save(true);$('draftName').oninput=()=>$('draftName').setCustomValidity('');
    $('draftSaveFile').onclick=()=>{try{const data=formData();if(data){download(D.encode(data),data.title);status('手稿文件已交给浏览器下载，包含原星图与稿面。');}}catch(error){status(error.message);}};
    $('draftBrowseTab').onclick=()=>mode(false);$('draftSaveTab').onclick=()=>mode(true);
    $('draftTake').onclick=()=>{try{const entry=store.load(chosen.id,chosen.revision);dialog.close();onTake(entry);}catch(error){status(error.message);}};
    $('draftExport').onclick=()=>{if(!chosen)return;try{download(D.encode(chosen),chosen.title);status('手稿文件已交给浏览器下载。');}catch(error){status(error.message);}};
    $('draftRemove').onclick=()=>{if(!chosen)return;try{removed=store.remove(chosen.id,chosen.revision);chosen=null;renderList();renderDetail();status('这一页已移出，可撤销刚才的移出。');}catch(error){status(error.message);}};
    $('draftRestore').onclick=()=>{try{store.restore(removed);chosen=removed.entry;removed=null;renderList();renderDetail();status('刚才移出的这一页回来了。');}catch(error){status(error.message);}};
    $('draftImport').onclick=()=>$('draftImportFile').click();
    $('draftImportFile').onchange=async e=>{
      const file=e.target.files?.[0],current=++token;if(!file)return;chosen=null;imported=false;renderList();renderDetail();
      try{if(file.size>D.FILE_LIMIT)throw new Error('手稿文件太大，请使用应用导出的单页JSON。');const text=await file.text();if(current!==token||!dialog.open)return;chosen=D.decode(text);imported=true;renderList();renderDetail();status('文件已展开，尚未写入手稿匣，也没有改变工作台。');}
      catch(error){if(current===token&&dialog.open)status(error.message);}finally{e.target.value='';}
    };
    $('draftImportSave').onclick=()=>{try{const result=store.save(chosen);chosen=result.entry;imported=false;renderList();renderDetail();status(result.duplicate?'同一页已经在匣中。':'已收入手稿匣，现在可以取回续写。');}catch(error){status(error.message);}};
    dialog.addEventListener('close',()=>token++);window.addEventListener('storage',e=>{if(e.key===D.KEY){refresh();if(dialog.open)status('手稿匣在其他窗口发生了变化。取回或更新时会再次核对这一稿。');}});
    refresh();renderDetail();return {open,refresh};
  }
  root.OrbitDraftDesk=Object.freeze({create});
})(globalThis);
