/* An editable copy of one track, with its own history and page-local drafts. */
(function(root,factory){
  const api=typeof module==='object'&&module.exports?factory(require('./core'),require('./loom')):factory(root.OrbitCore,root.OrbitLoom);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.OrbitManuscript=api;
})(globalThis,function(C,L){
  'use strict';
  function track(raw){const s=C.preset();s.tracks[0]=C.clone(raw);return C.validate(s).tracks[0];}
  function at(t,tick){if(!Number.isInteger(tick)||tick<0||tick>=t.length)throw new Error('Invalid manuscript tick');return C.mod(tick-t.shift,t.length);}
  function heard(t,tick){const i=at(t,tick);return {pitch:t.notes[i],accent:t.accents[i]};}
  class Manuscript {
    #original;#draft;#past=[];#future=[];
    constructor(raw){this.#original=track(raw);this.#draft=C.clone(this.#original);}
    get original(){return C.clone(this.#original);}
    snapshot(){return C.clone(this.#draft);}
    get canUndo(){return this.#past.length>0;}
    get canRedo(){return this.#future.length>0;}
    replace(raw){
      const next=track(raw);for(const k of ['gain','muted','solo'])next[k]=this.#original[k];
      if(JSON.stringify(next)===JSON.stringify(this.#draft))return false;
      this.#past.push(this.#draft);if(this.#past.length>60)this.#past.shift();this.#future=[];this.#draft=next;return true;
    }
    write(tick,pitch,accent=1){
      if(!Number.isInteger(pitch)||pitch<0||pitch>9||!C.ACCENTS.includes(accent))throw new Error('Invalid manuscript note');
      const t=this.snapshot(),i=at(t,tick),previous=t.notes[i];
      t.notes[i]=previous===pitch?-1:pitch;t.accents[i]=t.notes[i]<0?1:previous>=0?t.accents[i]:accent;return this.replace(t);
    }
    accent(tick,value){if(!C.ACCENTS.includes(value))throw new Error('Invalid manuscript accent');const t=this.snapshot(),i=at(t,tick);if(t.notes[i]<0)return false;t.accents[i]=value;return this.replace(t);}
    resize(length){const t=this.snapshot();C.resizeTrack(t,length);return this.replace(t);}
    rotate(){const t=this.snapshot();t.shift=(t.shift+1)%t.length;return this.replace(t);}
    clear(){const t=this.snapshot();t.notes.fill(-1);t.accents.fill(1);return this.replace(t);}
    reset(){return this.replace(this.#original);}
    generate(options){return this.replace(L.weave(this.#original,{...options,length:this.#draft.length}));}
    undo(){if(!this.canUndo)return false;this.#future.push(this.#draft);this.#draft=this.#past.pop();return true;}
    redo(){if(!this.canRedo)return false;this.#past.push(this.#draft);this.#draft=this.#future.pop();return true;}
    summary(){
      const a=this.#original,b=this.#draft,periodChanged=a.length!==b.length;
      let changedTicks=null;if(!periodChanged){changedTicks=0;for(let tick=0;tick<b.length;tick++){const x=heard(a,tick),y=heard(b,tick);if(x.pitch!==y.pitch||(x.pitch>=0&&x.accent!==y.accent))changedTicks++;}}
      return {changed:JSON.stringify(a)!==JSON.stringify(b),originalCount:a.notes.filter(p=>p>=0).length,draftCount:b.notes.filter(p=>p>=0).length,changedTicks,periodChanged};
    }
  }
  class DraftCache {
    #entries=new Map();
    get size(){return this.#entries.size;}
    open(index,raw){
      if(!Number.isInteger(index)||index<0||index>4)throw new Error('Invalid manuscript role');
      const t=track(raw),key=index+'|'+JSON.stringify(t);let doc=this.#entries.get(key),resumed=!!doc;
      if(doc)this.#entries.delete(key);else doc=new Manuscript(t);
      this.#entries.set(key,doc);while(this.#entries.size>12)this.#entries.delete(this.#entries.keys().next().value);
      return {doc,resumed};
    }
    forget(index){for(const key of this.#entries.keys())if(key.startsWith(index+'|'))this.#entries.delete(key);}
    reset(){this.#entries.clear();}
  }
  return {Manuscript,DraftCache,heard};
});
