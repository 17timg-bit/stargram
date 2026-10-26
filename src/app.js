(function () {
  'use strict';
  const C = OrbitCore, $ = id => document.getElementById(id);
  const STORAGE = 'stargram.universe.v1', DISCOVERIES = 'stargram.discoveries.v1';
  let state = C.preset(), selected = 2, newPitch = 2, history = [], sliderBefore = null;
  let discoveries = { plant: false, orbit: false, listen: false }, encounters = 0, stored = false;
  let saveError = false;
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) { state = C.validate(JSON.parse(raw)); stored = true; }
    const d = JSON.parse(localStorage.getItem(DISCOVERIES) || '{}');
    for (const k of Object.keys(discoveries)) discoveries[k] = d[k] === true;
  } catch { saveError = true; }
  const canvas = $('universe'), ctx = canvas.getContext('2d');
  let width = 1, height = 1, hover = null, drag = null, particles = [], pulses = new Map(), queue = [];
  let toastTimer, renderedStep = -1, lastFrame = 0, reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const random = C.rng(20261026), stars = Array.from({ length: 125 }, () => ({ x: random(), y: random(), r: random() * 1.2 + 0.25, a: random() * 0.32 + 0.08, phase: random() * 6.28 }));
  const engine = new OrbitAudio.Engine(() => state, e => queue.push(e));

  function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3000); }
  function persist() {
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); localStorage.setItem(DISCOVERIES, JSON.stringify(discoveries)); $('saveStatus').textContent = '已自动保存 · 只留在此浏览器'; saveError = false; }
    catch { $('saveStatus').textContent = '自动保存不可用，请导出星图留存'; saveError = true; }
  }
  function remember() { history.push(C.clone(state)); if (history.length > 60) history.shift(); }
  function edit(fn, message) { remember(); fn(); persist(); renderUI(); if (message) toast(message); }
  function discover(id) {
    if (discoveries[id]) return;
    discoveries[id] = true; persist(); renderDiscoveries();
    if (Object.values(discoveries).every(Boolean)) toast('观测手记已集齐。你有了自己的小宇宙。');
  }
  function renderDiscoveries() {
    document.querySelectorAll('[data-discovery]').forEach(el => { const done = discoveries[el.dataset.discovery]; el.classList.toggle('done', done); el.querySelector('b').textContent = done ? '✓' : '○'; });
    const count = Object.values(discoveries).filter(Boolean).length;
    $('discoveryCount').textContent = `${count} / 3`;
    if (count === 3) $('discoveryMessage').textContent = '宇宙没有标准答案。现在，让它自由生长。';
  }
  function renderUI() {
    $('sceneTitle').textContent = state.title;
    $('noteCount').textContent = C.countNotes(state);
    const cycle = C.cycleTicks(state);
    $('cycleLabel').textContent = state.tracks.every(t => t.muted) ? '所有轨道已静音' : `${cycle / 2} 拍后重逢`;
    $('undoBtn').disabled = history.length === 0;
    $('tempo').value = state.bpm; $('tempoValue').innerHTML = `${state.bpm} <small>BPM</small>`;
    $('volume').value = Math.round(state.volume * 100); $('volumeValue').textContent = `${Math.round(state.volume * 100)}%`;
    $('space').value = Math.round(state.space * 100); $('spaceValue').textContent = `${Math.round(state.space * 100)}%`;
    $('scaleSelect').value = state.scale;
    document.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('active', C.preset(b.dataset.preset).title === state.title));
    $('tracks').replaceChildren();
    state.tracks.forEach((track, i) => {
      const role = C.ROLES[i], row = document.createElement('div');
      row.className = 'track-row' + (selected === i ? ' selected' : '') + (track.muted ? ' muted' : ''); row.style.setProperty('--track', role.color);
      const btn = document.createElement('button'); btn.className = 'track-select'; btn.setAttribute('aria-pressed', String(selected === i)); btn.setAttribute('aria-label', `选择${role.name}轨道`);
      btn.innerHTML = `<span class="track-circle"></span><span class="track-name">${role.name}<small>${role.english}</small></span><span class="track-length">${track.length}</span>`;
      btn.onclick = () => selectTrack(i);
      const mute = document.createElement('button'); mute.className = 'mute-button'; mute.textContent = track.muted ? '○' : '●'; mute.setAttribute('aria-label', `${track.muted ? '取消静音' : '静音'}${role.name}`); mute.setAttribute('aria-pressed', String(track.muted)); mute.title = `${track.muted ? '取消静音' : '静音'}${role.name}`;
      mute.onclick = () => edit(() => { track.muted = !track.muted; }); row.append(btn, mute); $('tracks').append(row);
    });
    const role = C.ROLES[selected], track = state.tracks[selected];
    document.documentElement.style.setProperty('--accent', role.color);
    $('selectedName').textContent = role.name; $('selectedVoice').textContent = role.voice.toUpperCase(); $('lengthSelect').value = track.length;
    $('steps').replaceChildren();
    track.notes.forEach((pitch, step) => {
      const b = document.createElement('button'); b.className = 'step' + (pitch >= 0 ? ' on' : ''); b.textContent = pitch >= 0 ? pitch + 1 : '·';
      b.setAttribute('aria-label', `第${step + 1}格，${pitch >= 0 ? '音高' + (pitch + 1) : '空白'}`); b.setAttribute('aria-pressed', String(pitch >= 0)); b.dataset.step = step;
      b.onclick = () => toggleNote(selected, step);
      b.oncontextmenu = e => { e.preventDefault(); raiseNote(selected, step); };
      $('steps').append(b);
    });
    renderedStep = -1; renderDiscoveries(); updatePlaybackUI();
  }
  function selectTrack(i) { selected = i; renderUI(); }
  async function preview(track, step) {
    const t = state.tracks[track]; if (t.notes[step] < 0 || t.muted) return;
    try { await engine.preview({ track, step, pitch: t.notes[step], midi: C.midiNote(state, track, t.notes[step]), gain: t.gain }); pulse(track, step); }
    catch { toast('浏览器未能启动声音，请再点一次播放。'); }
  }
  function toggleNote(track, step) {
    const adding = state.tracks[track].notes[step] < 0;
    edit(() => { state.tracks[track].notes[step] = adding ? newPitch : -1; selected = track; });
    if (adding) { discover('plant'); preview(track, step); }
  }
  function raiseNote(track, step) {
    if (state.tracks[track].notes[step] < 0) return;
    edit(() => { state.tracks[track].notes[step] = (state.tracks[track].notes[step] + 1) % 10; selected = track; }); preview(track, step);
    toast(`${C.ROLES[track].name} · 第 ${state.tracks[track].notes[step] + 1} 音`);
  }
  function updatePlaybackUI() {
    $('playIcon').textContent = engine.running ? 'Ⅱ' : '▶'; $('playText').textContent = engine.running ? '正在听见星星' : '让宇宙开始转动';
    $('playBtn').setAttribute('aria-label', engine.running ? '暂停演奏' : '开始演奏'); $('liveLabel').textContent = engine.running ? '● 演奏中' : '静候相遇'; $('liveLabel').classList.toggle('playing', engine.running);
  }
  let starting = false;
  async function playPause() {
    if (starting) return;
    if (engine.running) { engine.pause(); queue = []; updatePlaybackUI(); return; }
    try { starting = true; await engine.play(); updatePlaybackUI(); }
    catch { toast('无法启动音频，请使用新版 Edge、Chrome 或 Firefox。'); }
    finally { starting = false; }
  }
  $('playBtn').onclick = playPause;
  $('restartBtn').onclick = async () => { queue = []; particles = []; pulses.clear(); await engine.reset(); updatePlaybackUI(); toast('所有彗星回到起点'); };
  $('undoBtn').onclick = () => { if (!history.length) return; state = history.pop(); engine.update(); persist(); renderUI(); toast('已撤销上一次修改'); };
  document.querySelectorAll('[data-preset]').forEach(b => b.onclick = async () => { edit(() => { const volume = state.volume; state = C.preset(b.dataset.preset); state.volume = volume; }, '换了一片星空'); queue = []; await engine.reset(); engine.update(); });
  $('randomBtn').onclick = () => { const seed = crypto.getRandomValues(new Uint32Array(1))[0]; edit(() => { state = C.generate(seed, state); }, '一次新的偶遇。喜欢就把它带走。'); };
  $('lengthSelect').onchange = e => { edit(() => C.resizeTrack(state.tracks[selected], Number(e.target.value)), '周期改变了，留意下一次重逢'); discover('orbit'); };
  $('rotateBtn').onclick = () => edit(() => { const t = state.tracks[selected]; t.shift = (t.shift + 1) % t.length; }, '整条轨道晚一格相遇');
  $('clearBtn').onclick = () => edit(() => state.tracks[selected].notes.fill(-1), '这条轨道空出来了 · 可以撤销');
  $('pitchSelect').onchange = e => { newPitch = Number(e.target.value); $('pitchLabel').textContent = `第 ${newPitch + 1} 音`; };
  $('scaleSelect').onchange = e => edit(() => { state.scale = e.target.value; }, '同一片星星，另一种心情');
  for (const [id, key, divisor] of [['tempo', 'bpm', 1], ['space', 'space', 100], ['volume', 'volume', 100]]) {
    $(id).addEventListener('input', e => {
      if (!sliderBefore) sliderBefore = C.clone(state);
      state[key] = Number(e.target.value) / divisor; engine.update();
      if (id === 'tempo') $('tempoValue').innerHTML = `${state.bpm} <small>BPM</small>`;
      else $(id + 'Value').textContent = `${e.target.value}%`;
    });
    $(id).addEventListener('change', () => { if (sliderBefore) { history.push(sliderBefore); if (history.length > 60) history.shift(); sliderBefore = null; } persist(); $('undoBtn').disabled = history.length === 0; });
  }
  $('helpBtn').onclick = () => $('helpDialog').showModal(); $('exportBtn').onclick = () => $('exportDialog').showModal();
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { const r = d.getBoundingClientRect(); if (e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) d.close(); }));
  document.addEventListener('keydown', e => {
    if (e.target.closest('input,select,textarea') || document.querySelector('dialog[open]')) return;
    if (e.code === 'Space' && !e.target.closest('button')) { e.preventDefault(); playPause(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $('undoBtn').click(); }
    if (/^[1-5]$/.test(e.key) && !e.ctrlKey && !e.metaKey) selectTrack(Number(e.key) - 1);
    if (e.key === '?') $('helpDialog').showModal();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && engine.running) { engine.pause(); queue = []; updatePlaybackUI(); } });

  function geometry(w = width, h = height) {
    const max = Math.min(w * 0.435, h * 0.358);
    return { cx: w / 2, cy: h * 0.53, radii: [0.28, 0.46, 0.64, 0.82, 1].map(v => v * max), max };
  }
  function location(track, step, g = geometry()) {
    const t = state.tracks[track], angle = (step + t.shift) / t.length * Math.PI * 2 - Math.PI / 2;
    return { x: g.cx + Math.cos(angle) * g.radii[track], y: g.cy + Math.sin(angle) * g.radii[track], angle };
  }
  function hit(x, y) {
    const g = geometry(), dist = Math.hypot(x - g.cx, y - g.cy);
    let track = -1, delta = Infinity;
    g.radii.forEach((r, i) => { if (Math.abs(dist - r) < delta) { delta = Math.abs(dist - r); track = i; } });
    if (delta > Math.max(12, g.max * .08)) return null;
    const t = state.tracks[track], fraction = C.mod(Math.atan2(y - g.cy, x - g.cx) + Math.PI / 2, Math.PI * 2) / (Math.PI * 2);
    return { track, step: C.mod(Math.round(fraction * t.length) - t.shift, t.length) };
  }
  function pointerPosition(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const p = pointerPosition(e), target = hit(p.x, p.y); if (!target) return;
    canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true });
    drag = { ...target, start: p, x: p.x, y: p.y, moved: false, pitch: state.tracks[target.track].notes[target.step], target };
  });
  canvas.addEventListener('pointermove', e => {
    const p = pointerPosition(e); hover = hit(p.x, p.y);
    if (drag) { drag.x = p.x; drag.y = p.y; drag.moved ||= Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 7; drag.target = hover; }
    if (hover && !drag) {
      const pitch = state.tracks[hover.track].notes[hover.step];
      $('tooltip').hidden = false; $('tooltip').textContent = `${C.ROLES[hover.track].name} · ${pitch < 0 ? '点击种下一颗星' : '第 ' + (pitch + 1) + ' 音 · 拖动 / 右击升音'}`;
      $('tooltip').style.left = `${Math.min(p.x + 14, Math.max(0, width - 220))}px`; $('tooltip').style.top = `${Math.max(0, p.y - 36)}px`;
      canvas.style.cursor = pitch < 0 ? 'crosshair' : 'grab';
    } else { $('tooltip').hidden = true; canvas.style.cursor = drag ? 'grabbing' : 'crosshair'; }
  });
  canvas.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag; drag = null; $('tooltip').hidden = true;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (!d.moved) toggleNote(d.track, d.step);
    else if (d.pitch >= 0 && d.target && !(d.track === d.target.track && d.step === d.target.step)) {
      edit(() => {
        // Occupied destinations swap: dragging never silently destroys another star.
        const destination = state.tracks[d.target.track].notes[d.target.step];
        state.tracks[d.track].notes[d.step] = destination;
        state.tracks[d.target.track].notes[d.target.step] = d.pitch; selected = d.target.track;
      }); preview(d.target.track, d.target.step);
    }
  });
  canvas.addEventListener('pointercancel', () => { drag = null; hover = null; $('tooltip').hidden = true; });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  canvas.addEventListener('pointerleave', () => { hover = null; $('tooltip').hidden = true; });
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); const p = pointerPosition(e), h = hit(p.x, p.y); if (h) raiseNote(h.track, h.step); });
  function pulse(track, step) {
    const time = performance.now(); pulses.set(`${track}:${step}`, time);
    if (!reducedMotion) { const p = location(track, step); for (let k = 0; k < 5; k++) particles.push({ x: p.x, y: p.y, vx: (random() - .5) * 24, vy: (random() - .5) * 24, born: time, color: C.ROLES[track].color }); }
  }
  function circle(c, x, y, radius, color) { c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fillStyle = color; c.fill(); }
  function scene(c, w, h, phase, now, poster = false) {
    const g = geometry(w, h), scale = poster ? 1.8 : 1;
    c.clearRect(0, 0, w, h);
    const bg = c.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.max * 1.65); bg.addColorStop(0, '#193338'); bg.addColorStop(.55, '#10262c'); bg.addColorStop(1, '#0c171b'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    for (const star of stars) { c.globalAlpha = star.a * (reducedMotion ? 1 : .8 + Math.sin(now * .0005 + star.phase) * .2); circle(c, star.x * w, star.y * h, star.r * scale, '#b2d6d3'); } c.globalAlpha = 1;
    // Fine survey marks: an observatory, rather than a literal gravity simulation.
    c.strokeStyle = '#34525b'; c.lineWidth = .6 * scale;
    for (let k = 0; k < 72; k++) {
      const a = k / 72 * Math.PI * 2, r = g.max + 16 * scale;
      c.globalAlpha = k % 6 ? .35 : .7; c.beginPath(); c.moveTo(g.cx + Math.cos(a) * r, g.cy + Math.sin(a) * r); c.lineTo(g.cx + Math.cos(a) * (r + (k % 6 ? 3 : 7) * scale), g.cy + Math.sin(a) * (r + (k % 6 ? 3 : 7) * scale)); c.stroke();
    }
    c.globalAlpha = 1; c.setLineDash([2 * scale, 7 * scale]); c.strokeStyle = '#29474e'; c.beginPath(); c.moveTo(g.cx, g.cy - g.max - 30 * scale); c.lineTo(g.cx, g.cy + g.max + 20 * scale); c.moveTo(g.cx - g.max - 25 * scale, g.cy); c.lineTo(g.cx + g.max + 25 * scale, g.cy); c.stroke(); c.setLineDash([]);
    state.tracks.forEach((t, track) => {
      const color = C.ROLES[track].color, r = g.radii[track];
      c.globalAlpha = t.muted ? .18 : 1;
      c.beginPath(); c.arc(g.cx, g.cy, r, 0, Math.PI * 2); c.strokeStyle = track === selected ? '#557c7e' : '#2b4b53'; c.lineWidth = (track === selected ? 1.15 : .75) * scale; c.stroke();
      const active = t.notes.map((p, i) => p >= 0 ? location(track, i, g) : null).filter(Boolean);
      if (active.length > 1) { c.beginPath(); active.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.strokeStyle = color; c.lineWidth = .6 * scale; c.globalAlpha = t.muted ? .025 : .09; c.stroke(); }
      t.notes.forEach((pitch, step) => {
        const p = location(track, step, g), hot = hover && hover.track === track && hover.step === step;
        c.globalAlpha = t.muted ? .2 : 1;
        if (pitch < 0) { circle(c, p.x, p.y, (hot ? 3.7 : 1.75) * scale, hot ? '#a9d6ca' : '#3e646c'); return; }
        const elapsed = now - (pulses.get(`${track}:${step}`) || -10000), glow = Math.max(0, 1 - elapsed / 1000);
        const size = (3.4 + pitch * .18 + glow * 1.8 + (hot ? 1.2 : 0)) * scale;
        c.shadowColor = color; c.shadowBlur = (glow * 21 + 9) * scale;
        circle(c, p.x, p.y, size, color); c.shadowBlur = 0;
        circle(c, p.x - .6 * scale, p.y - .6 * scale, size * .34, '#f8f7e9');
        if (glow > 0 && !reducedMotion) { c.globalAlpha = glow * .5; c.strokeStyle = color; c.lineWidth = .7 * scale; c.beginPath(); c.arc(p.x, p.y, (7 + (1 - glow) * 17) * scale, 0, Math.PI * 2); c.stroke(); }
        if (hot) { c.globalAlpha = .8; c.strokeStyle = color; c.beginPath(); c.arc(p.x, p.y, size + 5 * scale, 0, Math.PI * 2); c.stroke(); }
      });
      c.globalAlpha = t.muted ? .16 : 1;
      const a = C.mod(phase, t.length) / t.length * Math.PI * 2 - Math.PI / 2;
      if (!reducedMotion || poster) for (let k = 0; k < 24; k++) {
        c.globalAlpha = (t.muted ? .04 : .48) * (1 - k / 24); c.strokeStyle = color; c.lineWidth = 1.5 * scale; c.beginPath(); c.arc(g.cx, g.cy, r, a - (k + 1) * .021, a - k * .021); c.stroke();
      }
      c.globalAlpha = t.muted ? .2 : 1; c.shadowColor = color; c.shadowBlur = 14 * scale;
      circle(c, g.cx + Math.cos(a) * r, g.cy + Math.sin(a) * r, 3 * scale, '#f3f3dd'); c.shadowBlur = 0;
      c.globalAlpha = 1;
    });
    const breathe = reducedMotion ? 0 : Math.sin(now * .001) * .08;
    const halo = c.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.radii[0] * .8); halo.addColorStop(0, '#d7ac6c30'); halo.addColorStop(1, '#d7ac6c00'); c.fillStyle = halo; c.beginPath(); c.arc(g.cx, g.cy, g.radii[0] * .8, 0, 6.284); c.fill();
    c.save(); c.translate(g.cx, g.cy); c.rotate(Math.PI / 4); c.strokeStyle = '#b8996d'; c.lineWidth = .8 * scale; c.globalAlpha = .7 + breathe; c.strokeRect(-8 * scale, -8 * scale, 16 * scale, 16 * scale); c.rotate(Math.PI / 4); c.strokeRect(-6 * scale, -6 * scale, 12 * scale, 12 * scale); c.restore(); circle(c, g.cx, g.cy, 2 * scale, '#e8c08d');
    if (!poster) {
      particles = particles.filter(p => now - p.born < 1400).slice(-150);
      particles.forEach(p => { const age = (now - p.born) / 1000; c.globalAlpha = Math.max(0, 1 - age / 1.4) * .65; circle(c, p.x + p.vx * age, p.y + p.vy * age, 1.2, p.color); }); c.globalAlpha = 1;
      if (drag && drag.moved && drag.pitch >= 0) { const p = drag.target ? location(drag.target.track, drag.target.step, g) : drag; c.globalAlpha = .8; circle(c, p.x, p.y, 7, C.ROLES[drag.target?.track ?? drag.track].color); c.globalAlpha = 1; }
    } else {
      c.textAlign = 'center'; c.fillStyle = '#8faaa9'; c.font = '15px Consolas, monospace'; c.fillText('S T A R G R A M   /   A N   O R B I T A L   P O S T C A R D', w / 2, 75);
      c.fillStyle = '#e8e5da'; c.font = '38px "Microsoft YaHei", sans-serif'; c.fillText(state.title, w / 2, 132);
      c.fillStyle = '#92b7b0'; c.font = '18px "Microsoft YaHei", sans-serif'; c.fillText(`${C.countNotes(state)} 颗星星  ·  ${state.bpm} BPM  ·  ${C.SCALES[state.scale].label}`, w / 2, h - 90);
      c.fillStyle = '#64878a'; c.font = '14px "Microsoft YaHei", sans-serif'; c.fillText('星轨留声机  /  每一次相遇，都是一首新的歌。', w / 2, h - 50);
    }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || now - lastFrame < (reducedMotion ? 100 : 16)) return;
    lastFrame = now;
    while (queue.length && engine.ctx && queue[0].when <= engine.ctx.currentTime) {
      const item = queue.shift(); item.events.forEach(e => pulse(e.track, e.step)); encounters += item.events.length;
      if (encounters >= 32) discover('listen');
    }
    for (const [k, v] of pulses) if (now - v > 1500) pulses.delete(k);
    const phase = engine.phase(); scene(ctx, width, height, phase, now);
    const t = state.tracks[selected], step = C.mod(Math.floor(phase) - t.shift, t.length);
    if (step !== renderedStep) { renderedStep = step; document.querySelectorAll('.step').forEach(b => b.classList.toggle('current', engine.running && Number(b.dataset.step) === step)); }
    if (!engine.running) document.querySelectorAll('.step.current').forEach(b => b.classList.remove('current'));
  }
  function resize() { const r = canvas.getBoundingClientRect(); width = r.width; height = r.height; const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); particles = []; }
  new ResizeObserver(resize).observe(canvas);

  function filename(ext) { return 'Stargram_' + state.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 40) + '.' + ext; }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  $('captureBtn').onclick = () => {
    const postcard = document.createElement('canvas'); postcard.width = 1600; postcard.height = 1200;
    scene(postcard.getContext('2d'), 1600, 1200, engine.phase(), performance.now(), true);
    postcard.toBlob(blob => { if (blob) { download(blob, filename('png')); toast('已把星空拍成一张明信片'); } else toast('明信片生成失败，请重试'); }, 'image/png');
  };
  $('jsonBtn').onclick = () => { download(new Blob([JSON.stringify(C.validate(state), null, 2)], { type: 'application/json' }), filename('json')); $('exportStatus').textContent = '星图已交给浏览器下载，可用“导入星图”恢复全部设置。'; };
  $('midiBtn').onclick = () => { download(new Blob([C.midiBytes(state)], { type: 'audio/midi' }), filename('mid')); $('exportStatus').textContent = 'MIDI 已交给浏览器下载：8 小节、五条分轨和独立速度轨。'; };
  $('wavBtn').onclick = async () => {
    const snapshot = C.clone(state), name = filename('wav');
    if (snapshot.volume === 0 || !snapshot.tracks.some(t => !t.muted && t.gain > 0 && t.notes.some(p => p >= 0))) { $('exportStatus').textContent = '这片宇宙现在没有声音。先打开音量，并点亮一条未静音的轨道。'; return; }
    $('wavBtn').disabled = true; $('exportStatus').textContent = '正在本机合成音乐，稍等片刻……';
    try {
      const wav = await OrbitAudio.renderWav(snapshot); download(new Blob([wav.bytes], { type: 'audio/wav' }), name);
      $('exportStatus').textContent = `WAV 已交给浏览器下载 · ${wav.seconds.toFixed(1)} 秒 · 44.1 kHz / 16-bit / 立体声`;
    } catch (error) { $('exportStatus').textContent = '音频导出失败。请尝试先暂停播放，或改用新版 Chromium 浏览器。'; console.error(error); }
    finally { $('wavBtn').disabled = false; }
  };
  $('importBtn').onclick = () => $('importInput').click();
  $('importInput').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      if (file.size > 100000) throw new Error('星图文件过大，请选择本应用导出的 JSON。');
      const imported = C.validate(JSON.parse(await file.text()));
      edit(() => { state = imported; }); queue = []; await engine.reset(); engine.update(); $('exportDialog').close(); toast('欢迎回到这片星空');
    } catch { $('exportStatus').textContent = '导入失败：请选择有效的 Stargram v1 星图 JSON。当前星图未改变。'; }
    finally { e.target.value = ''; }
  };
  window.addEventListener('beforeunload', persist);
  // Read-only diagnostics for local regression checks; no bypass for UI operations.
  window.Stargram = Object.freeze({ snapshot: () => C.clone(state), status: () => ({ playing: engine.running, phase: engine.phase(), encounters, selected, saved: !saveError, audioState: engine.ctx?.state || 'uninitialized', activeVoices: engine.voices.size }), exportWav: OrbitAudio.renderWav });
  renderUI(); resize(); requestAnimationFrame(frame);
  if (saveError) { $('saveStatus').textContent = '未能恢复本地星图，请导出文件留存'; toast('本地存档不可用，已打开默认星图'); }
  else if (stored) $('saveStatus').textContent = '已恢复上次的星图';
})();
