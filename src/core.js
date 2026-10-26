/* Stargram — deterministic musical model. No DOM and no dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OrbitCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LENGTHS = [8, 12, 16, 20, 24];
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
    return { length, notes, muted: false, gain: 0.72, shift: 0 };
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
    return { format: 'stargram', version: 1, volume: 0.55, ...clone(states[id] || states.dawn) };
  }
  function validate(raw) {
    const fail = () => { throw new Error('这不是有效的星轨文件（需要 Stargram v1 星图）。'); };
    const number = (n, lo, hi) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
    if (!raw || raw.format !== 'stargram' || raw.version !== 1 || !Object.hasOwn(SCALES, raw.scale)) fail();
    if (typeof raw.title !== 'string' || raw.title.length > 60 || !number(raw.bpm, 48, 160) || !Number.isInteger(raw.bpm) || !number(raw.space, 0, 1) || !number(raw.volume, 0, 1)) fail();
    if (!Array.isArray(raw.tracks) || raw.tracks.length !== 5) fail();
    const tracks = raw.tracks.map(t => {
      if (!t || !LENGTHS.includes(t.length) || !Array.isArray(t.notes) || t.notes.length !== t.length ||
        !t.notes.every(n => Number.isInteger(n) && n >= -1 && n <= 9) || typeof t.muted !== 'boolean' ||
        !number(t.gain, 0, 1) || !Number.isInteger(t.shift) || t.shift < 0 || t.shift >= t.length) fail();
      return { length: t.length, notes: [...t.notes], muted: t.muted, gain: t.gain, shift: t.shift };
    });
    return { format: 'stargram', version: 1, title: raw.title.trim() || '未命名星图', bpm: raw.bpm, scale: raw.scale, volume: raw.volume, space: raw.space, tracks };
  }
  function midiNote(state, track, pitch) {
    const scale = SCALES[state.scale];
    return scale.root + ROLES[track].octave * 12 + scale.notes[mod(pitch, 5)] + Math.floor(pitch / 5) * 12;
  }
  function eventsAt(state, tick) {
    return state.tracks.flatMap((t, i) => {
      const step = mod(tick - t.shift, t.length), pitch = t.notes[step];
      return t.muted || t.gain === 0 || pitch < 0 ? [] : [{ track: i, step, pitch, midi: midiNote(state, i, pitch), gain: t.gain }];
    });
  }
  function resizeTrack(t, length) {
    if (!LENGTHS.includes(length)) throw new Error('Unsupported orbit length');
    const notes = Array(length).fill(-1);
    t.notes.forEach((p, i) => { if (p >= 0) notes[Math.floor(i / t.length * length)] = p; });
    t.shift = Math.floor(t.shift / t.length * length); t.length = length; t.notes = notes;
  }
  function generate(seed, base = preset()) {
    const random = rng(seed), s = clone(base);
    const motifs = [[0, 2, 4, 3, 1], [0, 3, 2, 4, 2], [4, 3, 1, 2, 0]];
    const motif = motifs[Math.floor(random() * motifs.length)];
    s.tracks.forEach((t, i) => {
      const count = [2, 4, 5, 3, 2][i];
      t.notes.fill(-1); t.muted = false; t.shift = 0;
      for (let k = 0; k < count; k++) {
        const pos = mod(Math.floor(k * t.length / count) + (i > 1 ? Math.floor(random() * 3) : 0), t.length);
        t.notes[pos] = i === 0 ? [0, 3][k % 2] : motif[(k + i) % motif.length];
      }
    });
    s.title = '偶遇 · ' + (seed >>> 0).toString(36).toUpperCase().slice(-6);
    return s;
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function cycleTicks(state) { return state.tracks.filter(t => !t.muted).reduce((a, t) => a * t.length / gcd(a, t.length), 1); }
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
          const vel = Math.max(1, Math.round(e.gain * 95));
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
  return { LENGTHS, SCALES, ROLES, clone, mod, rng, preset, validate, midiNote, eventsAt, resizeTrack, generate, cycleTicks, countNotes, midiBytes };
});
