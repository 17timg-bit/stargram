/* Stargram — a deterministic draft, independent of the live composition. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core'));
  else root.OrbitLoom = factory(root.OrbitCore);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';
  const SHAPES = ['arc', 'rise', 'fall', 'wander'];
  function weave(track, options = {}) {
    const holder = C.preset(); holder.tracks[0] = track;
    const original = C.validate(holder).tracks[0];
    const { length = original.length, count = 5, shape = 'arc', register = 0, dynamics = true, seed = 0, offset = 0 } = options;
    if (!C.LENGTHS.includes(length) || !Number.isInteger(count) || count < 1 || count > length ||
      !SHAPES.includes(shape) || ![0, 5].includes(register) || typeof dynamics !== 'boolean' ||
      !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isInteger(offset) || offset < 0 || offset >= length) {
      throw new Error('织星参数无效');
    }
    const random = C.rng(seed), start = Math.floor(random() * 5), arc = [0, 1, 2, 3, 4, 3, 2, 1];
    const phase = Math.floor(random() * arc.length);
    const notes = Array(length).fill(-1), accents = Array(length).fill(1);
    let wandering = start;
    for (let k = 0; k < count; k++) {
      const step = Math.floor(k * length / count);
      let pitch;
      if (shape === 'rise') pitch = (start + k) % 5;
      else if (shape === 'fall') pitch = C.mod(start - k, 5);
      else if (shape === 'arc') pitch = arc[(phase + k) % arc.length];
      else {
        if (k) {
          wandering += [-2, -1, 1, 2][Math.floor(random() * 4)];
          if (wandering < 0) wandering = -wandering;
          if (wandering > 4) wandering = 8 - wandering;
        }
        pitch = wandering;
      }
      notes[step] = pitch + register;
      accents[step] = !dynamics ? 1 : k === 0 ? 1.35 : k === count - 1 ? .55 : k % 4 === 0 ? 1.35 : 1;
    }
    return { ...original, length, notes, accents, shift: C.mod(Math.floor(original.shift / original.length * length) + offset, length) };
  }
  function audition(state, index, draft) {
    if (!Number.isInteger(index) || index < 0 || index > 4) throw new Error('织星轨道无效');
    const snapshot = C.validate(state); snapshot.tracks[index] = C.clone(draft);
    const result = C.validate(snapshot);
    result.tracks.forEach((track, i) => { track.muted = i !== index; track.solo = false; });
    return result;
  }
  return { SHAPES, weave, audition };
});
