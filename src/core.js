/* Stargram — deterministic musical model. No DOM and no dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OrbitCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LENGTHS = [8, 12, 16, 20, 24];
  const ACCENTS = [0.55, 1, 1.35];
  const COLLECTION_LIMIT = 24;
  const SCALES = {
    dawn: { label: '晨光 · 大调五声音阶', notes: [0, 2, 4, 7, 9], root: 48 },
    tide: { label: '浮潮 · 小调五声音阶', notes: [0, 3, 5, 7, 10], root: 45 },
    glass: { label: '琉璃 · 悬浮音阶', notes: [0, 2, 5, 7, 9], root: 50 }
  };
  const ROLES = [
    { name: '引力', english: 'GRAVITY', color: '#e5ae79', octave: -1, voice: 'bass' },
    { name: '余温', english: 'EMBER', color: '#e4c87f', octave: 0, voice: 'soft' },
    { name: '浮光', english: 'GLIMMER', color: '#8ed8c0', octave: 1, voice: 'pluck' },
    { name: '冰晶', english: 'CRYSTAL', color: '#a5c9df', octave: 2, voice: 'bell' },
    { name: '远星', english: 'DISTANT', color: '#c5b1db', octave: 2, voice: 'air' }
  ];
  const clone = x => JSON.parse(JSON.stringify(x));
  const mod = (x, n) => ((x % n) + n) % n;
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function makeTrack(length, pairs) {
    const notes = Array(length).fill(-1);
    pairs.forEach(([i, p]) => { notes[i] = p; });
    return { length, notes, accents: Array(length).fill(1), muted: false, solo: false, gain: 0.72, shift: 0 };
  }
  function preset(id = 'dawn') {
    const states = {
      dawn: { title: '晨雾中的信号', scale: 'dawn', bpm: 88, space: 0.48, tracks: [
        makeTrack(16, [[0, 0], [8, 3]]), makeTrack(16, [[2, 2], [6, 4], [10, 1], [14, 3]]),
        makeTrack(16, [[0, 0], [3, 2], [6, 4], [10, 3], [14, 1]]),
        makeTrack(12, [[0, 2], [5, 4], [9, 1]]), makeTrack(20, [[4, 0], [12, 3]]) ] },
      tide: { title: '潮汐来信', scale: 'tide', bpm: 104, space: 0.66, tracks: [
        makeTrack(16, [[0, 0], [6, 0], [10, 3]]), makeTrack(12, [[0, 2], [4, 1], [9, 4]]),
        makeTrack(16, [[0, 0], [2, 2], [5, 3], [8, 4], [11, 3], [14, 1]]),
        makeTrack(20, [[2, 0], [8, 2], [15, 4]]), makeTrack(24, [[0, 2], [10, 0], [18, 3]]) ] },
      glass: { title: '夜航的玻璃船', scale: 'glass', bpm: 72, space: 0.78, tracks: [
        makeTrack(16, [[0, 0], [10, 3]]), makeTrack(20, [[0, 0], [7, 2], [15, 4]]),
        makeTrack(12, [[0, 0], [4, 3], [7, 4], [10, 1]]),
        makeTrack(16, [[3, 2], [9, 4], [14, 0]]), makeTrack(24, [[6, 0], [16, 4]]) ] }
    };
    return { format: 'stargram', version: 2, volume: 0.55, ...clone(states[id] || states.dawn) };
  }
  function validate(raw) {
    const fail = () => { throw new Error('这不是有效的星轨文件（支持 Stargram v1 / v2 星图）。'); };
    const number = (n, lo, hi) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
    if (!raw || raw.format !== 'stargram' || ![1, 2].includes(raw.version) || !Object.hasOwn(SCALES, raw.scale)) fail();
    if (typeof raw.title !== 'string' || raw.title.length > 60 || !number(raw.bpm, 48, 160) || !Number.isInteger(raw.bpm) || !number(raw.space, 0, 1) || !number(raw.volume, 0, 1)) fail();
    if (!Array.isArray(raw.tracks) || raw.tracks.length !== 5) fail();
    const tracks = raw.tracks.map(t => {
      if (!t || !LENGTHS.includes(t.length) || !Array.isArray(t.notes) || t.notes.length !== t.length ||
        !t.notes.every(n => Number.isInteger(n) && n >= -1 && n <= 9) || typeof t.muted !== 'boolean' ||
        !number(t.gain, 0, 1) || !Number.isInteger(t.shift) || t.shift < 0 || t.shift >= t.length) fail();
      // v1.0 files remain valid: absent expressive fields retain their old sound.
      if (raw.version === 2 && (t.solo === undefined || t.accents === undefined)) fail();
      if (t.solo !== undefined && typeof t.solo !== 'boolean') fail();
      if (t.accents !== undefined && (!Array.isArray(t.accents) || t.accents.length !== t.length || !t.accents.every(v => ACCENTS.includes(v)))) fail();
      return { length: t.length, notes: [...t.notes], accents: t.accents ? [...t.accents] : Array(t.length).fill(1), muted: t.muted, solo: t.solo ?? false, gain: t.gain, shift: t.shift };
    });
    return { format: 'stargram', version: 2, title: raw.title.trim() || '未命名星图', bpm: raw.bpm, scale: raw.scale, volume: raw.volume, space: raw.space, tracks };
  }
  function midiNote(state, track, pitch) {
    const scale = SCALES[state.scale];
    return scale.root + ROLES[track].octave * 12 + scale.notes[mod(pitch, 5)] + Math.floor(pitch / 5) * 12;
  }
  function eventsAt(state, tick) {
    return state.tracks.flatMap((t, i) => {
      const step = mod(tick - t.shift, t.length), pitch = t.notes[step];
      return !audible(state, i) || pitch < 0 ? [] : [{ track: i, step, pitch, midi: midiNote(state, i, pitch), gain: t.gain * (t.accents?.[step] ?? 1) }];
    });
  }
  function audible(state, index) {
    const t = state.tracks[index];
    return !t.muted && t.gain > 0 && (!state.tracks.some(track => track.solo) || t.solo === true);
  }
  function resizeTrack(t, length) {
    if (!LENGTHS.includes(length)) throw new Error('Unsupported orbit length');
    const notes = Array(length).fill(-1), accents = Array(length).fill(1);
    t.notes.forEach((p, i) => { if (p >= 0) { const at = Math.floor(i / t.length * length); notes[at] = p; accents[at] = t.accents?.[i] ?? 1; } });
    t.shift = Math.floor(t.shift / t.length * length); t.length = length; t.notes = notes; t.accents = accents;
  }
  const encounterStyles = [
    {name:'晨光信号',scale:'dawn',tempo:[84,110],space:[.28,.52],density:1,contour:1},
    {name:'潮汐回航',scale:'tide',tempo:[72,98],space:[.52,.76],density:.9,contour:-1},
    {name:'玻璃漂流',scale:'glass',tempo:[56,80],space:[.66,.86],density:.7,contour:0},
    {name:'近日巡游',scale:'dawn',tempo:[108,136],space:[.20,.44],density:1.25,contour:1},
    {name:'月背电台',scale:'tide',tempo:[88,118],space:[.36,.62],density:1.15,contour:0},
    {name:'彗尾慢行',scale:'glass',tempo:[64,92],space:[.50,.76],density:.85,contour:-1}
  ];
  const ENCOUNTERS = Object.freeze(encounterStyles.map(({name,scale})=>Object.freeze({name,scale})));
  function generate(seed, base = preset()) {
    if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Invalid encounter seed');
    const original=validate(base),random=rng(seed),pick=xs=>xs[Math.floor(random()*xs.length)];
    const style=pick(encounterStyles),integer=(a,b)=>a+Math.floor(random()*(b-a+1));
    const s=preset(style.scale);s.volume=original.volume;
    s.bpm=integer(...style.tempo);if(s.bpm===original.bpm)s.bpm+=s.bpm<style.tempo[1]?1:-1;
    s.space=Math.round((style.space[0]+random()*(style.space[1]-style.space[0]))*100)/100;
    // A short shared idea supplies pitches; the roles answer it in different registers.
    const root=pick([0,0,2,3,4]),motif=[root],motifLength=integer(4,7);let wandering=root;
    for(let n=1;n<motifLength;n++){
      const direction=random()<.28?style.contour:pick([-2,-1,1,2]);
      wandering=Math.max(0,Math.min(7,wandering+direction));motif.push(wandering);
    }
    const families=[[[8,12,16],[8,12,16],[12,16,24],[8,12,20],[16,20,24]],[[16,24],[12,16,24],[16,20,24],[12,20,24],[20,24]],[[16,20,24],[12,20],[8,12,20],[16,20,24],[12,20,24]]];
    const family=pick(families),lengths=family.map(pick);
    if(new Set(lengths).size===1)lengths[4]=pick(LENGTHS.filter(n=>n!==lengths[0]));
    const pulse=pick([[0,2],[0,3],[0,1,3],[0,2,3]]),answer=integer(0,motif.length-1);
    s.tracks=lengths.map((length,i)=>{
      const density=[.18,.28,.37,.20,.12][i]*style.density*(.85+random()*.35);
      const count=Math.max([2,3,4,2,2][i],Math.min(Math.floor(length*.6),Math.round(length*density)));
      const notes=Array(length).fill(-1),accents=Array(length).fill(1),chosen=[];
      // Weighted sampling without replacement gives exact density without lost collisions.
      const candidates=Array.from({length},(_,tick)=>{
        let weight=i===0?(tick%4===0?5:tick%2===0?2:.35):i===1?(tick%4===2?4:pulse.includes(tick%4)?1.8:.7):pulse.includes(tick%4)?2.8:1;
        return {tick,rank:-Math.log(Math.max(random(),1e-9))/weight};
      }).sort((a,b)=>a.rank-b.rank);
      for(const {tick} of candidates){
        if(chosen.length===count)break;
        if(i===0&&chosen.some(t=>Math.min(mod(tick-t,length),mod(t-tick,length))<2))continue;
        chosen.push(tick);
      }
      // Very short bass circles can exhaust the spaced choices; keep the chosen density.
      for(const {tick} of candidates){if(chosen.length===count)break;if(!chosen.includes(tick))chosen.push(tick);}
      chosen.sort((a,b)=>a-b).forEach((tick,k)=>{
        let pitch;
        if(i===0)pitch=k===0?root:pick([root,mod(root+2,5),mod(root+3,5)]);
        else if(i===1)pitch=mod(motif[(k+answer)%motif.length]+pick([0,0,2]),5)+(random()<.18?5:0);
        else if(i===2)pitch=Math.min(9,motif[(k+answer)%motif.length]+(random()<.28?5:0));
        else if(i===3)pitch=Math.min(9,motif[mod(answer-k,motif.length)]+(random()<.25?5:0));
        else pitch=mod(motif[(k*2+answer)%motif.length],5);
        notes[tick]=pitch;accents[tick]=k===0?1.35:k===count-1?.55:tick%4===0&&random()<.65?1.35:pick([.55,1,1]);
      });
      const reference=[.18,.28,.37,.20,.12][i],energy=Math.sqrt(reference/(count/length));
      const gain=Math.round(Math.max(.38,Math.min(.82,[.74,.64,.70,.56,.50][i]*energy*(.9+random()*.2)))*100)/100;
      return {length,notes,accents,gain,muted:false,solo:false,shift:i===0?pick([0,2,4,6])%length:integer(0,length-1)};
    });
    s.title=style.name+' · '+seed.toString(36).toUpperCase().padStart(7,'0');
    return validate(s);
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function cycleTicks(state) { return state.tracks.filter((t, i) => audible(state, i)).reduce((a, t) => a * t.length / gcd(a, t.length), 1); }
  function countNotes(state) { return state.tracks.reduce((n, t) => n + t.notes.filter(p => p >= 0).length, 0); }
  function vlq(value) {
    const bytes = [value & 127];
    while ((value >>= 7)) bytes.unshift((value & 127) | 128);
    return bytes;
  }
  function midiBytes(state, ticks = 64) {
    validate(state);
    const ascii = s => [...s].map(c => c.charCodeAt(0)), be = (v, n) => Array.from({ length: n }, (_, i) => v >>> ((n - i - 1) * 8) & 255);
    const chunk = (name, bytes) => [...ascii(name), ...be(bytes.length, 4), ...bytes];
    const tempo = Math.round(60000000 / state.bpm);
    const conductor = [0, 255, 81, 3, ...be(tempo, 3), 0, 255, 88, 4, 4, 2, 24, 8, ...vlq(ticks * 240), 255, 47, 0];
    const tracks = [chunk('MTrk', conductor)];
    state.tracks.forEach((t, track) => {
      const name = ascii(ROLES[track].english), ev = [];
      for (let tick = 0; tick < ticks; tick++) {
        eventsAt(state, tick).filter(e => e.track === track).forEach(e => {
          const vel = Math.min(127, Math.max(1, Math.round(e.gain * 95)));
          ev.push({ at: tick * 240, type: 1, bytes: [0x90 + track, e.midi, vel] });
          ev.push({ at: tick * 240 + (track === 0 ? 240 : 180), type: 0, bytes: [0x80 + track, e.midi, 0] });
        });
      }
      ev.sort((a, b) => a.at - b.at || a.type - b.type);
      let data = [0, 255, 3, name.length, ...name, 0, 0xC0 + track, [32, 10, 24, 8, 89][track]], prev = 0;
      ev.forEach(e => { data.push(...vlq(e.at - prev), ...e.bytes); prev = e.at; });
      data.push(...vlq(Math.max(0, ticks * 240 - prev)), 255, 47, 0);
      tracks.push(chunk('MTrk', data));
    });
    return new Uint8Array([...chunk('MThd', [0, 1, 0, 6, 1, 224]), ...tracks.flat()]);
  }
  function validateCollection(raw) {
    if (!Array.isArray(raw) || raw.length > COLLECTION_LIMIT) throw new Error('星图书架格式无效');
    const ids = new Set();
    return raw.map(entry => {
      if (!entry || typeof entry.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(entry.id) || ids.has(entry.id) ||
        !Number.isSafeInteger(entry.created) || entry.created < 0) throw new Error('星图书架格式无效');
      ids.add(entry.id);
      return { id: entry.id, created: entry.created, state: validate(entry.state) };
    });
  }
  return { LENGTHS, ACCENTS, COLLECTION_LIMIT, SCALES, ROLES, ENCOUNTERS, clone, mod, rng, preset, validate, validateCollection, midiNote, audible, eventsAt, resizeTrack, generate, cycleTicks, countNotes, midiBytes };
});
