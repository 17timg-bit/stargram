/* Immutable local collections. Writes commit only after storage succeeds. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./core') : root.OrbitCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OrbitShelf = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';
  const KEY = 'stargram.collection.v1';
  class Store {
    constructor(storage) {
      this.storage = storage; this.entries = []; this.readError = false;
      try { const raw = storage?.getItem(KEY); if (raw) this.entries = C.validateCollection(JSON.parse(raw)); }
      catch { this.readError = true; }
    }
    commit(entries) {
      if (this.readError) throw new Error('书架读取失败，原始收藏数据仍保留。请先把当前星图导出为 JSON。');
      if (!this.storage) throw new Error('浏览器无法保存收藏，请导出星图 JSON 留存。');
      const safe = C.validateCollection(entries);
      try { this.storage.setItem(KEY, JSON.stringify(safe)); }
      catch { throw new Error('收藏未写入，可能是浏览器存储空间已满。请导出星图 JSON。'); }
      this.entries = safe;
    }
    save(state, title) {
      const snapshot = C.validate({ ...state, title });
      const existing = this.entries.find(entry => JSON.stringify(entry.state) === JSON.stringify(snapshot));
      if (existing) return { entry: C.clone(existing), duplicate: true };
      if (this.entries.length >= C.COLLECTION_LIMIT) throw new Error('书架已放满 24 张星图。先导出并移除一张，再收藏新作品。');
      const id = `star-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      const entry = { id, created: Date.now(), state: snapshot };
      this.commit([entry, ...this.entries]);
      return { entry: C.clone(entry), duplicate: false };
    }
    load(id) { const entry = this.entries.find(item => item.id === id); if (!entry) throw new Error('这张星图已不在书架里'); return C.clone(entry.state); }
    remove(id) {
      const index = this.entries.findIndex(entry => entry.id === id); if (index < 0) return null;
      const removed = { entry: C.clone(this.entries[index]), index };
      this.commit(this.entries.filter(entry => entry.id !== id)); return removed;
    }
    restore(removed) {
      if (!removed) return;
      if (this.entries.length >= C.COLLECTION_LIMIT) throw new Error('书架已满，请先腾出一个位置再撤销移除。');
      const entries = C.clone(this.entries); entries.splice(Math.min(removed.index, entries.length), 0, removed.entry); this.commit(entries);
    }
  }
  return { KEY, Store };
});
