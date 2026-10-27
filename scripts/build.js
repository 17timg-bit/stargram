/* node scripts/build.js — produce one genuinely offline, relocatable HTML file. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'src', name), 'utf8');
const css = read('style.css').replace(/^@charset[^;]+;\s*/, '');
const js = ['core.js', 'audio.js', 'shelf.js', 'loom.js', 'app.js'].map(read).join('\n');
if (/<\/script/i.test(js)) throw new Error('Inline script terminator found');
const html = read('index.html').replace('<!-- STYLE -->', `<style>\n${css}\n</style>`).replace('<!-- SCRIPTS -->', `<script>\n${js}\n</script>`);
const destination = path.join(root, '打开星轨留声机.html');
fs.writeFileSync(destination, html, 'utf8');
// GitHub Pages serves index.html at the project URL. Keep it byte-identical
// to the portable offline edition so both entries receive every update.
fs.writeFileSync(path.join(root, 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(root, '.nojekyll'), '', 'utf8');
console.log(JSON.stringify({ output: destination, webEntry: path.join(root, 'index.html'), bytes: Buffer.byteLength(html), externalDependencies: 0 }, null, 2));
