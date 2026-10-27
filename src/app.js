(function () {
  'use strict';
  const C = OrbitCore, $ = id => document.getElementById(id);
  const STORAGE = 'stargram.universe.v1', DISCOVERIES = 'stargram.discoveries.v1';
  let state = C.preset(), selected = 2, newPitch = 2, newAccent = 1, history = [], future = [], sliderBefore = null;
  let editMode = 'plant', focusNote = null, shelfRemoved = null, immersive = false;
  let shelfStorage = null; try { shelfStorage = localStorage; } catch {}
  const shelf = new OrbitShelf.Store(shelfStorage);
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
  let toastTimer, renderedStep = -1, lastFrame = 0, lastEncounterAt = -10000, reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const random = C.rng(20261026), stars = Array.from({ length: 125 }, () => ({ x: random(), y: random(), r: random() * 1.2 + 0.25, a: random() * 0.32 + 0.08, phase: random() * 6.28 }));
  const engine = new OrbitAudio.Engine(() => state, e => queue.push(e));

  function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3000); }
  function persist() {
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); localStorage.setItem(DISCOVERIES, JSON.stringify(discoveries)); $('saveStatus').textContent = '已自动保存 · 只留在此浏览器'; saveError = false; }
    catch { $('saveStatus').textContent = '自动保存不可用，请导出星图留存'; saveError = true; }
  }
  function remember() { history.push(C.clone(state)); if (history.length > 60) history.shift(); future = []; }
  function edit(fn, message) { remember(); fn(); engine.update(); persist(); renderUI(); if (message) toast(message); }
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
    $('cycleLabel').textContent = !state.tracks.some((t, i) => C.audible(state, i)) ? '所有轨道已静音' : `${cycle / 2} 拍后重逢`;
    $('undoBtn').disabled = history.length === 0;
    $('redoBtn').disabled = future.length === 0;
    $('tempo').value = state.bpm; $('tempoValue').innerHTML = `${state.bpm} <small>BPM</small>`;
    $('volume').value = Math.round(state.volume * 100); $('volumeValue').textContent = `${Math.round(state.volume * 100)}%`;
    $('space').value = Math.round(state.space * 100); $('spaceValue').textContent = `${Math.round(state.space * 100)}%`;
    $('scaleSelect').value = state.scale;
    document.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('active', C.preset(b.dataset.preset).title === state.title));
    $('tracks').replaceChildren();
    state.tracks.forEach((track, i) => {
      const role = C.ROLES[i], row = document.createElement('div');
      row.className = 'track-row' + (selected === i ? ' selected' : '') + (!C.audible(state, i) ? ' muted' : '') + (track.solo ? ' solo' : ''); row.style.setProperty('--track', role.color);
      const btn = document.createElement('button'); btn.className = 'track-select'; btn.setAttribute('aria-pressed', String(selected === i)); btn.setAttribute('aria-label', `选择${role.name}轨道`);
      btn.innerHTML = `<span class="track-circle"></span><span class="track-name">${role.name}<small>${track.solo ? 'SOLO / ' : ''}${role.english}</small></span><span class="track-length">${track.length}</span>`;
      btn.onclick = () => selectTrack(i);
      const mute = document.createElement('button'); mute.className = 'mute-button'; mute.textContent = track.muted ? '○' : '●'; mute.setAttribute('aria-label', `${track.muted ? '取消静音' : '静音'}${role.name}`); mute.setAttribute('aria-pressed', String(track.muted)); mute.title = `${track.muted ? '取消静音' : '静音'}${role.name}`;
      mute.onclick = () => edit(() => { track.muted = !track.muted; }); row.append(btn, mute); $('tracks').append(row);
    });
    const role = C.ROLES[selected], track = state.tracks[selected];
    if (focusNote && (focusNote.track !== selected || track.notes[focusNote.step] === undefined || track.notes[focusNote.step] < 0)) focusNote = null;
    document.documentElement.style.setProperty('--accent', role.color);
    $('selectedName').textContent = role.name; $('selectedVoice').textContent = role.voice.toUpperCase(); $('lengthSelect').value = track.length;
    $('trackGain').value = Math.round(track.gain * 100); $('trackGainValue').textContent = `${Math.round(track.gain * 100)}%`;
    $('soloBtn').classList.toggle('active', track.solo); $('soloBtn').setAttribute('aria-pressed', String(track.solo)); $('soloBtn').setAttribute('aria-label', `${track.solo ? '取消独奏' : '独奏'}${role.name}`);
    $('pitchSelect').value = focusNote ? track.notes[focusNote.step] : newPitch;
    $('pitchContext').textContent = focusNote ? `第 ${focusNote.step + 1} 格的音高` : '新星的音高';
    $('pitchLabel').textContent = `第 ${Number($('pitchSelect').value) + 1} 音`;
    document.querySelectorAll('[data-mode]').forEach(b => { const active = b.dataset.mode === editMode; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
    document.querySelectorAll('[data-accent]').forEach(b => { const active = Number(b.dataset.accent) === (focusNote ? track.accents[focusNote.step] : newAccent); b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
    $('editTip').textContent = editMode === 'tune' ? (focusNote ? '正在调这颗星星。改音高、轻重会立即试听；点击另一颗继续。' : '点一颗已有星星，再用音高与轻重按钮调音。Shift+点击切换力度。') : '种星：点击开关音符。调音：选中后改音高、轻重。Shift+点击切换力度。';
    $('steps').replaceChildren();
    track.notes.forEach((pitch, step) => {
      const b = document.createElement('button'); b.className = 'step' + (pitch >= 0 ? ' on' : ''); b.textContent = pitch >= 0 ? pitch + 1 : '·';
      if (pitch >= 0) b.classList.add(track.accents[step] > 1 ? 'accent-strong' : track.accents[step] < 1 ? 'accent-soft' : 'accent-mid');
      if (focusNote?.step === step) b.classList.add('focused');
      b.setAttribute('aria-label', `第${step + 1}格，${pitch >= 0 ? '音高' + (pitch + 1) : '空白'}`); b.setAttribute('aria-pressed', String(pitch >= 0)); b.dataset.step = step;
      b.onclick = e => actOnNote(selected, step, e.shiftKey);
      b.oncontextmenu = e => { e.preventDefault(); raiseNote(selected, step); };
      $('steps').append(b);
    });
    $('shelfCount').textContent = `${shelf.entries.length} 张本地收藏`;
    renderedStep = -1; renderDiscoveries(); updatePlaybackUI();
  }
  function selectTrack(i) { selected = i; focusNote = null; renderUI(); }
  async function preview(track, step) {
    const t = state.tracks[track]; if (t.notes[step] < 0 || !C.audible(state, track)) return;
    try { await engine.preview({ track, step, pitch: t.notes[step], midi: C.midiNote(state, track, t.notes[step]), gain: t.gain * t.accents[step] }); pulse(track, step); }
    catch { toast('浏览器未能启动声音，请再点一次播放。'); }
  }
  function toggleNote(track, step) {
    const adding = state.tracks[track].notes[step] < 0;
    edit(() => { state.tracks[track].notes[step] = adding ? newPitch : -1; state.tracks[track].accents[step] = adding ? newAccent : 1; selected = track; focusNote = null; });
    if (adding) { discover('plant'); preview(track, step); }
  }
  function actOnNote(track, step, shiftKey = false) {
    const t = state.tracks[track];
    if (shiftKey && t.notes[step] >= 0) {
      edit(() => { t.accents[step] = C.ACCENTS[(C.ACCENTS.indexOf(t.accents[step]) + 1) % C.ACCENTS.length]; selected = track; }); preview(track, step); return;
    }
    if (editMode === 'plant') return toggleNote(track, step);
    if (t.notes[step] < 0) { toast('调音模式：先选一颗已有的星星'); return; }
    selected = track; focusNote = { track, step }; renderUI(); preview(track, step);
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
  $('undoBtn').onclick = () => { if (!history.length) return; future.push(C.clone(state)); state = history.pop(); focusNote = null; engine.update(); persist(); renderUI(); toast('已撤销上一次修改'); };
  $('redoBtn').onclick = () => { if (!future.length) return; history.push(C.clone(state)); state = future.pop(); focusNote = null; engine.update(); persist(); renderUI(); toast('已重做这次修改'); };
  document.querySelectorAll('[data-preset]').forEach(b => b.onclick = async () => { edit(() => { const volume = state.volume; state = C.preset(b.dataset.preset); state.volume = volume; focusNote = null; }, '换了一片星空'); queue = []; await engine.reset(); engine.update(); });
  $('randomBtn').onclick = () => { const seed = crypto.getRandomValues(new Uint32Array(1))[0]; edit(() => { state = C.generate(seed, state); focusNote = null; }, '一次新的偶遇。喜欢就把它带走。'); };
  $('lengthSelect').onchange = e => { edit(() => { C.resizeTrack(state.tracks[selected], Number(e.target.value)); focusNote = null; }, '周期改变了，留意下一次重逢'); discover('orbit'); };
  $('rotateBtn').onclick = () => edit(() => { const t = state.tracks[selected]; t.shift = (t.shift + 1) % t.length; }, '整条轨道晚一格相遇');
  $('clearBtn').onclick = () => edit(() => { state.tracks[selected].notes.fill(-1); state.tracks[selected].accents.fill(1); }, '这条轨道空出来了 · 可以撤销');
  $('pitchSelect').onchange = e => {
    const pitch = Number(e.target.value);
    if (focusNote) { const { track, step } = focusNote; edit(() => { state.tracks[track].notes[step] = pitch; }); preview(track, step); }
    else { newPitch = pitch; $('pitchLabel').textContent = `第 ${newPitch + 1} 音`; }
  };
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { editMode = b.dataset.mode; focusNote = null; renderUI(); });
  document.querySelectorAll('[data-accent]').forEach(b => b.onclick = () => {
    const accent = Number(b.dataset.accent);
    if (focusNote) { const { track, step } = focusNote; edit(() => { state.tracks[track].accents[step] = accent; }); preview(track, step); }
    else { newAccent = accent; renderUI(); }
  });
  $('soloBtn').onclick = () => edit(() => { state.tracks[selected].solo = !state.tracks[selected].solo; });
  $('scaleSelect').onchange = e => edit(() => { state.scale = e.target.value; }, '同一片星星，另一种心情');
  for (const [id, key, divisor] of [['tempo', 'bpm', 1], ['space', 'space', 100], ['volume', 'volume', 100], ['trackGain', 'gain', 100]]) {
    $(id).addEventListener('input', e => {
      if (!sliderBefore) sliderBefore = C.clone(state);
      const target = id === 'trackGain' ? state.tracks[selected] : state;
      target[key] = Number(e.target.value) / divisor; engine.update();
      if (id === 'tempo') $('tempoValue').innerHTML = `${state.bpm} <small>BPM</small>`;
      else $(id + 'Value').textContent = `${e.target.value}%`;
    });
    $(id).addEventListener('change', () => { if (sliderBefore) { history.push(sliderBefore); if (history.length > 60) history.shift(); future = []; sliderBefore = null; } persist(); renderUI(); });
  }
  $('helpBtn').onclick = () => $('helpDialog').showModal(); $('exportBtn').onclick = () => $('exportDialog').showModal();
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { const r = d.getBoundingClientRect(); if (e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) d.close(); }));
  document.addEventListener('keydown', e => {
    if (e.target.closest('input,select,textarea') || document.querySelector('dialog[open]')) return;
    if (e.code === 'Space' && !e.target.closest('button')) { e.preventDefault(); playPause(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $(e.shiftKey ? 'redoBtn' : 'undoBtn').click(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); $('redoBtn').click(); }
    if (e.key === 'Escape' && immersive) setImmersive(false);
    if (/^[1-5]$/.test(e.key) && !e.ctrlKey && !e.metaKey) selectTrack(Number(e.key) - 1);
    if (e.key === '?') $('helpDialog').showModal();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && engine.running) { engine.pause(); queue = []; updatePlaybackUI(); } });

  function setImmersive(value) {
    immersive = value; document.body.classList.toggle('immersive', value);
    $('immerseBtn').textContent = value ? '⊡ 返回工作台' : '⛶ 沉浸'; $('immerseBtn').setAttribute('aria-pressed', String(value));
    hover = null; $('tooltip').hidden = true;
  }
  $('immerseBtn').onclick = () => setImmersive(!immersive);
  $('renameBtn').onclick = () => { $('titleInput').value = state.title; $('renameDialog').showModal(); $('titleInput').select(); };
  $('renameForm').onsubmit = e => {
    e.preventDefault(); const title = $('titleInput').value.trim();
    if (!title) { $('titleInput').setCustomValidity('给星空写一个名字吧'); $('titleInput').reportValidity(); return; }
    if (title !== state.title) edit(() => { state.title = title; });
    $('renameDialog').close(); toast('这片星空有名字了');
  };
  $('titleInput').oninput = () => $('titleInput').setCustomValidity('');
  function thumbnail(target, snapshot) {
    target.width = 560; target.height = 300;
    const c = target.getContext('2d'), x = 280, y = 150;
    const gradient = c.createRadialGradient(x, y, 0, x, y, 260); gradient.addColorStop(0, '#244045'); gradient.addColorStop(1, '#0c1a20'); c.fillStyle = gradient; c.fillRect(0, 0, 560, 300);
    snapshot.tracks.forEach((track, i) => {
      const r = 34 + i * 24, color = C.ROLES[i].color;
      c.globalAlpha = C.audible(snapshot, i) ? 1 : .25;
      c.strokeStyle = '#3c6069'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
      track.notes.forEach((pitch, step) => {
        if (pitch < 0) return;
        const a = (step + track.shift) / track.length * Math.PI * 2 - Math.PI / 2;
        c.shadowColor = color; c.shadowBlur = 12; circle(c, x + Math.cos(a) * r, y + Math.sin(a) * r, 2.3 + track.accents[step] * 1.7, color); c.shadowBlur = 0;
      });
    });
    c.globalAlpha = 1; circle(c, x, y, 3.5, '#e1bc89');
  }
  function renderShelf() {
    $('shelfGrid').replaceChildren(); $('shelfCount').textContent = `${shelf.entries.length} 张本地收藏`;
    $('shelfSummary').textContent = `${shelf.entries.length} / ${C.COLLECTION_LIMIT} 张星图`;
    $('shelfUndo').hidden = !shelfRemoved;
    if (!shelf.entries.length) {
      const empty = document.createElement('div'); empty.className = 'shelf-empty';
      empty.innerHTML = '<span>✧</span><strong>第一张星图，等你留下。</strong><p>点上方收藏，把这次相遇保存在自己的书架里。</p>';
      $('shelfGrid').append(empty);
    }
    shelf.entries.forEach(entry => {
      const card = document.createElement('article'); card.className = 'shelf-card';
      const open = document.createElement('button'); open.className = 'shelf-open'; open.setAttribute('aria-label', `打开星图 ${entry.state.title}`);
      const previewCanvas = document.createElement('canvas'); previewCanvas.setAttribute('aria-hidden', 'true'); thumbnail(previewCanvas, entry.state);
      const title = document.createElement('strong'); title.textContent = entry.state.title;
      const meta = document.createElement('small'); meta.textContent = `${C.countNotes(entry.state)} 颗星星 · ${entry.state.bpm} BPM · ${C.SCALES[entry.state.scale].label.split(' · ')[0]}`;
      open.append(previewCanvas, title, meta);
      open.onclick = async () => {
        const snapshot = shelf.load(entry.id);
        edit(() => { state = snapshot; focusNote = null; }); queue = []; pulses.clear(); await engine.reset(); engine.update(); updatePlaybackUI();
        $('shelfDialog').close(); toast('回到「' + snapshot.title + '」');
      };
      const footer = document.createElement('div'); footer.className = 'shelf-card-footer';
      const time = document.createElement('span'); time.textContent = new Date(entry.created).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
      const remove = document.createElement('button'); remove.className = 'text-button'; remove.textContent = '移出书架'; remove.setAttribute('aria-label', `删除收藏 ${entry.state.title}`);
      remove.onclick = () => {
        try { shelfRemoved = shelf.remove(entry.id); renderShelf(); $('shelfFeedback').textContent = '已移出书架。当前正在编辑的星图不会改变。'; }
        catch (error) { $('shelfFeedback').textContent = error.message; }
      };
      footer.append(time, remove); card.append(open, footer); $('shelfGrid').append(card);
    });
  }
  $('shelfBtn').onclick = () => {
    if (engine.running) { engine.pause(); queue = []; updatePlaybackUI(); }
    $('shelfTitle').value = state.title; $('shelfFeedback').textContent = shelf.readError ? '书架读取失败，原始数据仍保留。请先把当前星图导出为 JSON。' : '';
    renderShelf(); $('shelfDialog').showModal();
  };
  $('shelfForm').onsubmit = e => {
    e.preventDefault(); const title = $('shelfTitle').value.trim();
    if (!title) { $('shelfTitle').setCustomValidity('给星空写一个名字吧'); $('shelfTitle').reportValidity(); return; }
    try {
      const saved = shelf.save(state, title);
      if (title !== state.title) edit(() => { state.title = title; });
      renderShelf(); $('shelfFeedback').textContent = saved.duplicate ? '这张星图已经在书架里了，不会重复占位置。' : '已收藏「' + title + '」。继续探索，它会在这里等你。';
    } catch (error) { $('shelfFeedback').textContent = error.message; }
  };
  $('shelfTitle').oninput = () => $('shelfTitle').setCustomValidity('');
  $('restoreShelfBtn').onclick = () => {
    try { shelf.restore(shelfRemoved); shelfRemoved = null; renderShelf(); $('shelfFeedback').textContent = '刚才移出的星图回来了。'; }
    catch (error) { $('shelfFeedback').textContent = error.message; }
  };

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
    if (!d.moved) actOnNote(d.track, d.step, e.shiftKey);
    else if (d.pitch >= 0 && d.target && !(d.track === d.target.track && d.step === d.target.step)) {
      edit(() => {
        // Occupied destinations swap: dragging never silently destroys another star.
        const destination = state.tracks[d.target.track].notes[d.target.step];
        const sourceAccent = state.tracks[d.track].accents[d.step], destinationAccent = state.tracks[d.target.track].accents[d.target.step];
        state.tracks[d.track].notes[d.step] = destination;
        state.tracks[d.target.track].notes[d.target.step] = d.pitch; selected = d.target.track;
        state.tracks[d.track].accents[d.step] = destination >= 0 ? destinationAccent : 1;
        state.tracks[d.target.track].accents[d.target.step] = sourceAccent;
        focusNote = editMode === 'tune' ? { ...d.target } : null;
      }); preview(d.target.track, d.target.step);
    }
  });
  canvas.addEventListener('pointercancel', () => { drag = null; hover = null; $('tooltip').hidden = true; });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  canvas.addEventListener('pointerleave', () => { hover = null; $('tooltip').hidden = true; });
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); const p = pointerPosition(e), h = hit(p.x, p.y); if (h) raiseNote(h.track, h.step); });
  function pulse(track, step) {
    const time = performance.now(); lastEncounterAt = time; pulses.set(`${track}:${step}`, time);
    if (!reducedMotion) { const p = location(track, step); for (let k = 0; k < 5; k++) particles.push({ x: p.x, y: p.y, vx: (random() - .5) * 24, vy: (random() - .5) * 24, born: time, color: C.ROLES[track].color }); }
  }
  function circle(c, x, y, radius, color) { c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fillStyle = color; c.fill(); }
  function scene(c, w, h, phase, now, poster = false) {
    const g = geometry(w, h), scale = poster ? 1.8 : 1;
    c.clearRect(0, 0, w, h);
    const bg = c.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.max * 1.65); bg.addColorStop(0, '#193338'); bg.addColorStop(.55, '#10262c'); bg.addColorStop(1, '#0c171b'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    const colors = { dawn: ['#dfba88', '#89cfb6'], tide: ['#7cbcc9', '#7bc9b1'], glass: ['#b9a0d1', '#86b4d2'] }[state.scale];
    colors.forEach((color, i) => {
      const drift = reducedMotion ? 0 : Math.sin(now * .00008 + i * 2) * g.max * .07;
      const x = g.cx + (i ? -.42 : .46) * g.max + drift, y = g.cy + (i ? .4 : -.35) * g.max;
      const wash = c.createRadialGradient(x, y, 0, x, y, g.max * .95); wash.addColorStop(0, color + '10'); wash.addColorStop(1, color + '00'); c.fillStyle = wash; c.fillRect(0, 0, w, h);
    });
    for (const star of stars) { c.globalAlpha = star.a * (reducedMotion ? 1 : .8 + Math.sin(now * .0005 + star.phase) * .2); circle(c, star.x * w, star.y * h, star.r * scale, '#b2d6d3'); } c.globalAlpha = 1;
    // Fine survey marks: an observatory, rather than a literal gravity simulation.
    c.strokeStyle = '#34525b'; c.lineWidth = .6 * scale;
    for (let k = 0; k < 72; k++) {
      const a = k / 72 * Math.PI * 2, r = g.max + 16 * scale;
      c.globalAlpha = k % 6 ? .35 : .7; c.beginPath(); c.moveTo(g.cx + Math.cos(a) * r, g.cy + Math.sin(a) * r); c.lineTo(g.cx + Math.cos(a) * (r + (k % 6 ? 3 : 7) * scale), g.cy + Math.sin(a) * (r + (k % 6 ? 3 : 7) * scale)); c.stroke();
    }
    c.globalAlpha = 1; c.setLineDash([2 * scale, 7 * scale]); c.strokeStyle = '#29474e'; c.beginPath(); c.moveTo(g.cx, g.cy - g.max - 30 * scale); c.lineTo(g.cx, g.cy + g.max + 20 * scale); c.moveTo(g.cx - g.max - 25 * scale, g.cy); c.lineTo(g.cx + g.max + 25 * scale, g.cy); c.stroke(); c.setLineDash([]);
    state.tracks.forEach((t, track) => {
      const color = C.ROLES[track].color, r = g.radii[track], audible = C.audible(state, track);
      c.globalAlpha = audible ? 1 : .18;
      c.beginPath(); c.arc(g.cx, g.cy, r, 0, Math.PI * 2); c.strokeStyle = track === selected ? '#557c7e' : '#2b4b53'; c.lineWidth = (track === selected ? 1.15 : .75) * scale; c.stroke();
      const active = t.notes.map((p, i) => p >= 0 ? location(track, i, g) : null).filter(Boolean);
      if (active.length > 1) { c.beginPath(); active.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.strokeStyle = color; c.lineWidth = .6 * scale; c.globalAlpha = audible ? .12 : .025; c.stroke(); }
      t.notes.forEach((pitch, step) => {
        const p = location(track, step, g), hot = hover && hover.track === track && hover.step === step;
        const focused = focusNote?.track === track && focusNote.step === step;
        c.globalAlpha = audible ? 1 : .2;
        if (pitch < 0) { circle(c, p.x, p.y, (hot ? 3.7 : 1.75) * scale, hot ? '#a9d6ca' : '#3e646c'); return; }
        const elapsed = now - (pulses.get(`${track}:${step}`) || -10000), glow = Math.max(0, 1 - elapsed / 1000);
        const accent = t.accents[step], size = (2.5 + accent * 1.2 + pitch * .18 + glow * 1.8 + (hot ? 1.2 : 0)) * scale;
        c.shadowColor = color; c.shadowBlur = (glow * 21 + 9) * scale;
        circle(c, p.x, p.y, size, color); c.shadowBlur = 0;
        circle(c, p.x - .6 * scale, p.y - .6 * scale, size * .34, '#f8f7e9');
        if (glow > 0 && !reducedMotion) { c.globalAlpha = glow * .5; c.strokeStyle = color; c.lineWidth = .7 * scale; c.beginPath(); c.arc(p.x, p.y, (7 + (1 - glow) * 17) * scale, 0, Math.PI * 2); c.stroke(); }
        if (accent > 1) { c.globalAlpha = audible ? .5 : .1; c.strokeStyle = color; c.lineWidth = .6 * scale; c.beginPath(); c.moveTo(p.x - size - 3 * scale, p.y); c.lineTo(p.x + size + 3 * scale, p.y); c.moveTo(p.x, p.y - size - 3 * scale); c.lineTo(p.x, p.y + size + 3 * scale); c.stroke(); }
        if (hot || focused) { c.globalAlpha = .8; c.strokeStyle = color; c.lineWidth = scale; c.beginPath(); c.arc(p.x, p.y, size + (focused ? 8 : 5) * scale, 0, Math.PI * 2); c.stroke(); }
      });
      c.globalAlpha = audible ? 1 : .16;
      const a = C.mod(phase, t.length) / t.length * Math.PI * 2 - Math.PI / 2;
      if (!reducedMotion || poster) for (let k = 0; k < 24; k++) {
        c.globalAlpha = (audible ? .48 : .04) * (1 - k / 24); c.strokeStyle = color; c.lineWidth = 1.5 * scale; c.beginPath(); c.arc(g.cx, g.cy, r, a - (k + 1) * .021, a - k * .021); c.stroke();
      }
      c.globalAlpha = audible ? 1 : .2; c.shadowColor = color; c.shadowBlur = 14 * scale;
      circle(c, g.cx + Math.cos(a) * r, g.cy + Math.sin(a) * r, 3 * scale, '#f3f3dd'); c.shadowBlur = 0;
      c.globalAlpha = 1;
    });
    const breathe = reducedMotion ? 0 : Math.sin(now * .001) * .08;
    const heart = reducedMotion ? 0 : Math.max(0, 1 - (now - lastEncounterAt) / 650);
    if (heart > 0) { c.globalAlpha = heart * .2; c.strokeStyle = '#e7c593'; c.lineWidth = scale; c.beginPath(); c.arc(g.cx, g.cy, (18 + (1 - heart) * 20) * scale, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
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
      if (item.events.length) $('noteReadout').textContent = [...new Set(item.events.map(e => C.ROLES[e.track].name))].join(' · ') + ' / 相遇';
      if (encounters >= 32) discover('listen');
    }
    for (const [k, v] of pulses) if (now - v > 1500) pulses.delete(k);
    const phase = engine.phase(); scene(ctx, width, height, phase, now);
    const t = state.tracks[selected], step = C.mod(Math.floor(phase) - t.shift, t.length);
    if (step !== renderedStep) { renderedStep = step; document.querySelectorAll('.step').forEach(b => b.classList.toggle('current', engine.running && Number(b.dataset.step) === step)); }
    const beatText = engine.running ? `第 ${Math.floor(phase / 8) + 1} 小节 · ${Math.floor(phase / 2) % 4 + 1} / 4 拍` : phase > 0 ? '时间暂歇，星星还在这里' : '等待第一束光';
    if ($('beatReadout').textContent !== beatText) $('beatReadout').textContent = beatText;
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
    if (snapshot.volume === 0 || !snapshot.tracks.some((t, i) => C.audible(snapshot, i) && t.notes.some(p => p >= 0))) { $('exportStatus').textContent = '这片宇宙现在没有声音。先打开音量，并点亮一条可听见的轨道。'; return; }
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
      edit(() => { state = imported; focusNote = null; }); queue = []; await engine.reset(); engine.update(); $('exportDialog').close(); toast('欢迎回到这片星空');
    } catch { $('exportStatus').textContent = '导入失败：请选择有效的 Stargram v1 / v2 星图 JSON。当前星图未改变。'; }
    finally { e.target.value = ''; }
  };
  window.addEventListener('beforeunload', persist);
  // Read-only diagnostics for local regression checks; no bypass for UI operations.
  window.Stargram = Object.freeze({ snapshot: () => C.clone(state), collection: () => C.clone(shelf.entries), status: () => ({ playing: engine.running, phase: engine.phase(), encounters, selected, editMode, focusedNote: focusNote ? { ...focusNote } : null, immersive, saved: !saveError, audioState: engine.ctx?.state || 'uninitialized', activeVoices: engine.voices.size }), exportWav: OrbitAudio.renderWav });
  renderUI(); resize(); requestAnimationFrame(frame);
  if (saveError) { $('saveStatus').textContent = '未能恢复本地星图，请导出文件留存'; toast('本地存档不可用，已打开默认星图'); }
  else if (stored) $('saveStatus').textContent = '已恢复上次的星图';
})();
