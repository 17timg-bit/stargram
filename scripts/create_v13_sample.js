// Reproduce the sample score; WAV and MIDI are exported from the actual app.
const fs = require('node:fs'), path = require('node:path');
const C = require('../src/core'), L = require('../src/loom');
const state = C.preset(); state.title = '花园之外，还有星星'; state.space = .62;
const parameters = [
  { length: 8, count: 2, shape: 'rise', seed: 28 },
  { length: 12, count: 3, shape: 'arc', seed: 712, offset: 1 },
  { length: 20, count: 7, shape: 'wander', seed: 1027 },
  { length: 16, count: 4, shape: 'fall', seed: 91, offset: 3 },
  { length: 24, count: 3, shape: 'arc', seed: 503, offset: 2 }
];
state.tracks = state.tracks.map((track, i) => L.weave(track, parameters[i]));
const folder = path.resolve(__dirname, '../示例作品/v1.3.0');
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(path.join(folder, state.title + '.json'), JSON.stringify(C.validate(state), null, 2) + '\n');
console.log(JSON.stringify({ notes: C.countNotes(state), cycles: state.tracks.map(t => t.length) }));
