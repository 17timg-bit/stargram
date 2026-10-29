/* Explicit, bounded manuscript snapshots. No implicit replacement or eviction. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./core'):root.OrbitCore);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.OrbitDrafts=api;
})(globalThis,function(C){
  'use strict';
  const KEY='stargram.drafts.v1',LIMIT=12,MAX_BYTES=200000,FILE_LIMIT=50000;
  function content(raw){
    if(!raw||typeof raw.title!=='string'||!raw.title.trim()||raw.title.length>60||!Number.isInteger(raw.index)||raw.index<0||raw.index>4)throw new Error('这页手稿的格式无效。');
    const base=C.validate(raw.base),holder=C.clone(base);holder.tracks[raw.index]=raw.draft;
    const draft=C.validate(holder).tracks[raw.index],original=base.tracks[raw.index];
    for(const key of ['gain','muted','solo'])if(draft[key]!==original[key])throw new Error('手稿与原轨的混音不一致。');
    return {title:raw.title.trim(),base,index:raw.index,draft};
  }
  function validate(raw){
    if(!raw||raw.version!==1||!Array.isArray(raw.entries)||raw.entries.length>LIMIT)throw new Error('手稿匣格式无效。');
    const ids=new Set();return raw.entries.map(e=>{
      if(!e||typeof e.id!=='string'||!/^draft-[a-zA-Z0-9-]{1,60}$/.test(e.id)||ids.has(e.id)||!Number.isSafeInteger(e.revision)||e.revision<1||!Number.isSafeInteger(e.created)||e.created<0||!Number.isSafeInteger(e.updated)||e.updated<e.created)throw new Error('手稿匣格式无效。');
      ids.add(e.id);return {id:e.id,revision:e.revision,created:e.created,updated:e.updated,...content(e)};
    });
  }
  // Master volume belongs to the listener; retrieval retains their current level.
  const signature=raw=>{const data=content(raw);data.base.volume=0;return JSON.stringify(data);};
  function encode(raw){return JSON.stringify({format:'stargram-draft',version:1,...content(raw)},null,2);}
  function decode(text){
    if(typeof text!=='string'||text.length>FILE_LIMIT)throw new Error('手稿文件太大或不是文本。');
    let raw;try{raw=JSON.parse(text);}catch{throw new Error('无法读懂这份手稿文件。');}
    if(raw?.format!=='stargram-draft'||raw.version!==1)throw new Error('请选择 STARGRAM 手稿文件，不是普通星图。');
    return content(raw);
  }
  class Store{
    #entries=[];
    constructor(storage){this.storage=storage;this.readError=false;this.refresh();}
    get entries(){return C.clone(this.#entries);}
    get size(){return this.#entries.length;}
    read(){
      if(!this.storage)throw new Error('此浏览器无法保存手稿，请另存手稿文件。');
      try{const raw=this.storage.getItem(KEY);if(raw!==null&&raw.length>MAX_BYTES)throw new Error();const entries=raw===null?[]:validate(JSON.parse(raw));this.readError=false;return entries;}
      catch{this.readError=true;throw new Error('手稿匣读取失败，原始数据已保留。可以先另存手稿文件。');}
    }
    refresh(){try{this.#entries=this.read();this.readError=false;return true;}catch{return false;}}
    commit(entries){
      const safe=validate({version:1,entries}),text=JSON.stringify({version:1,entries:safe});
      if(text.length>MAX_BYTES)throw new Error('手稿匣容量不足，请另存手稿文件。');
      try{this.storage.setItem(KEY,text);}catch{throw new Error('这次没有保存成功，可能是浏览器空间已满。稿面还在，可以另存文件。');}
      this.#entries=safe;this.readError=false;
    }
    save(raw,target=null){
      const data=content(raw),entries=this.read(),now=Date.now();let entry;
      if(target){
        const i=entries.findIndex(e=>e.id===target.id);
        if(i<0||entries[i].revision!==target.revision)throw new Error('这页手稿已被其他窗口更新或移出。请另存一份，或回匣中重新查看。');
        if(signature(entries[i])===signature(data)){this.#entries=entries;return {entry:C.clone(entries[i]),duplicate:true};}
        entry={...entries[i],...data,revision:entries[i].revision+1,updated:Math.max(now,entries[i].updated)};entries.splice(i,1);entries.unshift(entry);
      }else{
        const same=entries.find(e=>signature(e)===signature(data));
        if(same){this.#entries=entries;return {entry:C.clone(same),duplicate:true};}
        if(entries.length>=LIMIT)throw new Error('手稿匣已放满12页。请另存文件，或先移出一页；不会挤掉旧手稿。');
        let id;do{id='draft-'+now.toString(36)+'-'+Math.random().toString(36).slice(2,12);}while(entries.some(e=>e.id===id));
        entry={id,revision:1,created:now,updated:now,...data};entries.unshift(entry);
      }
      this.commit(entries);return {entry:C.clone(entry),duplicate:false};
    }
    load(id,revision){const entries=this.read(),entry=entries.find(e=>e.id===id);if(!entry||revision!==undefined&&entry.revision!==revision)throw new Error('这页手稿已改变，请回匣中重新查看。');this.#entries=entries;return C.clone(entry);}
    remove(id,revision){
      const entries=this.read(),index=entries.findIndex(e=>e.id===id);if(index<0)return null;
      if(entries[index].revision!==revision)throw new Error('这页手稿已被更新，请重新查看后再移出。');
      const removed={entry:C.clone(entries[index]),index};entries.splice(index,1);this.commit(entries);return removed;
    }
    restore(removed){
      if(!removed)return;const entries=this.read(),entry=validate({version:1,entries:[removed.entry]})[0];
      if(entries.some(e=>e.id===entry.id))throw new Error('这页手稿已经在匣中。');
      if(entries.length>=LIMIT)throw new Error('手稿匣已满，暂时无法撤销移出。');
      entries.splice(Math.min(Math.max(0,removed.index),entries.length),0,entry);this.commit(entries);
    }
  }
  return {KEY,LIMIT,FILE_LIMIT,Store,content,validate,signature,encode,decode};
});
