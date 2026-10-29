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
  let width = 1, height = 1, stageBounds = { footer:1, voices:1 }, hover = null, drag = null, particles = [], pulses = new Map(), queue = [];
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let toastTimer, renderedStep = -1, lastFrame = 0, lastEncounterAt = -10000, reducedMotion = motionPreference.matches;
  motionPreference.addEventListener('change', e => { reducedMotion = e.matches; });
  const A = AstroAppearance;
  let appearance = A.read(shelfStorage).value, theme = 'paper';
  let skin = {}, armProgress = 0, darkroom = null, cachedSky = '';
  const skyTexture = document.createElement('canvas'); skyTexture.width = 1200; skyTexture.height = 900;
  function setAppearance(raw, save = true) {
    appearance = A.validate(raw); skin = A.applyTo(document.documentElement, appearance);
    theme = Object.keys(A.presets).find(id => A.code(A.preset(id)) === A.code(appearance)) || 'custom';
    $('themeName').textContent = theme === 'custom' ? A.catalogs.sky[appearance.sky].name : A.presets[theme].name;
    $('themeBtn').setAttribute('aria-label', `打开宇宙暗房，当前${$('themeName').textContent}`);
    document.querySelector('meta[name="theme-color"]').content = skin.paper;
    if (cachedSky !== appearance.sky) {
      AstroPaint.paint(skyTexture.getContext('2d'), 1200, 900, appearance);
      document.documentElement.style.setProperty('--sky-art', `url("${skyTexture.toDataURL('image/png')}")`);
      cachedSky = appearance.sky;
    }
    if (save) {
      $('themeStatus').textContent = A.save(shelfStorage, appearance) ? '这份观测配方已记住。乐曲保持原样。' : '这束光已生效；此浏览器暂时无法记住，请复制配方编号留存。';
      renderShelf();
      resize();
    }
    darkroom?.refresh();
  }
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
    document.body.dataset.scale = state.scale;
    $('sceneTitle').textContent = state.title;
    const encounter=C.ENCOUNTERS.find(item=>state.title.startsWith(item.name+' · '));
    $('randomStatus').textContent=encounter?`${encounter.name} / ${state.bpm} BPM · ${Math.round(state.space*100)}% 回响`:'轨道、速度、调性与回响一起生成';
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
    $('editTip').textContent = editMode === 'tune' ? (focusNote ? '选好星星后，调整它的音高与轻重。' : '调音：先选一颗已有的星星。') : '种星：点空位添加，再点删除。';
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
    $('playIcon').textContent = engine.running ? 'Ⅱ' : '▶'; $('playText').textContent = engine.running ? '这张星图正在演奏' : '放下唱针，听见星空';
    document.body.classList.toggle('is-playing', engine.running);
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
  document.querySelectorAll('[data-preset]').forEach(b => b.onclick = async () => { manuscriptCache.reset(); edit(() => { const volume = state.volume; state = C.preset(b.dataset.preset); state.volume = volume; focusNote = null; }, '换了一片星空'); queue = []; await engine.reset(); engine.update(); });
  $('randomBtn').onclick = async () => {
    const button=$('randomBtn');if(button.disabled)return;button.disabled=true;
    const wasPlaying=engine.running;let applied=false;
    try{
      const next=C.generate(crypto.getRandomValues(new Uint32Array(1))[0],state);
      engine.pause();engine.cutVoices();engine.reset();queue=[];particles=[];pulses.clear();renderedStep=-1;manuscriptCache.reset();
      edit(()=>{state=next;focusNote=null;},`抵达${next.title.split(' · ')[0]} · ${next.bpm} BPM · 可以撤销`);
      applied=true;
      if(wasPlaying&&!document.hidden){await engine.play();if(document.hidden)engine.pause();}
    }catch{toast(applied?'新星图已生成，声音暂未启动，请点播放重试。':'这次漫游没有出发，请再试一次。');}
    finally{button.disabled=false;updatePlaybackUI();}
  };
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
  $('themeBtn').onclick = () => darkroom.open();
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
    c.fillStyle = { dawn: '#ddaa80', tide: '#bdd2c8', glass: '#c9bfd1' }[snapshot.scale]; c.fillRect(0, 0, 560, 300);
    c.shadowColor = '#213c3644'; c.shadowBlur = 15; c.shadowOffsetY = 6; circle(c, x, y, 143, skin['record-edge']); c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.strokeStyle = skin['record-groove']; c.lineWidth = .5;
    drawDiscSurface(c, x, y, 143);
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
    c.globalAlpha = 1; circle(c, x, y, 19, skin['record-label']); circle(c, x, y, 3, skin['record-label-ink']);
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
        const snapshot = shelf.load(entry.id); manuscriptCache.reset();
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

  const manuscriptCache = new OrbitManuscript.DraftCache();
  const loom = { original:null, base:null, draft:null, doc:null, index:2, shape:'arc', seed:0, token:0, worker:false, pending:false, source:null, gain:null, nodes:new Set(), start:0, message:'', readout:'', target:'draft', mode:'copy', resumed:false };
  const scorePaper = OrbitScorePaper.create({
    getOriginal:()=>loom.original,getDraft:()=>loom.draft,
    onWrite:(tick,pitch,accent)=>changeManuscript(()=>loom.doc.write(tick,pitch,accent)),
    onAccent:(tick,value)=>changeManuscript(()=>loom.doc.accent(tick,value)),
    onUndo:()=>changeManuscript(()=>loom.doc.undo()),onRedo:()=>changeManuscript(()=>loom.doc.redo()),
    onReset:()=>changeManuscript(()=>loom.doc.reset()),onClear:()=>changeManuscript(()=>loom.doc.clear()),
    onRotate:()=>changeManuscript(()=>loom.doc.rotate())
  });
  function renderLoomAudio() {
    const active=!!loom.source||loom.pending;
    for(const [kind,id,label] of [['original','loomOriginalListen','A · 听原轨'],['draft','loomListen','B · 听手稿']]){
      const owns=active&&loom.target===kind,t=kind==='original'?loom.original:loom.draft;
      $(id).textContent=owns?(loom.pending?'■ 取消准备':'■ 停止'+(kind==='original'?'原轨':'手稿')):label;
      $(id).setAttribute('aria-pressed',String(owns));
      $(id).disabled=!owns&&(loom.worker||!t||loom.base?.volume===0||t.gain===0||!t.notes.some(p=>p>=0));
    }
    $('loomViewLabel').textContent=loom.source&&loom.target==='original'?'原轨试听':'手稿预览';
    const viewed=loom.source&&loom.target==='original'?loom.original:loom.draft;
    if(viewed){
      $('loomDraftMeta').textContent=`${viewed.notes.filter(p=>p>=0).length} 颗星 / ${viewed.length} 格`;
      $('loomCanvas').setAttribute('aria-label',(loom.source&&loom.target==='original'?'原轨':'手稿')+'预览，内圈音低，外圈音高');
      $('loomPhrase').replaceChildren();
      for(let tick=0;tick<viewed.length;tick++){
        const note=OrbitManuscript.heard(viewed,tick);if(note.pitch<0)continue;
        const span=document.createElement('span');span.textContent=note.pitch+1;span.className=note.accent>1?'strong':note.accent<1?'soft':'';span.title=`第 ${tick+1} 格 · 第 ${note.pitch+1} 音`;$('loomPhrase').append(span);
      }
    }
    $('loomAudioStatus').textContent=loom.pending?'正在准备'+(loom.target==='original'?'原轨':'手稿')+'…':loom.source?'正在试听 · '+(loom.target==='original'?'A 原轨':'B 手稿')+' · '+C.ROLES[loom.index].name:loom.worker?'上一段正在收尾，请稍等…':loom.message||(loom.base?.volume===0||loom.draft?.gain===0?'当前音量为零，先回工作台调高音量':'A 听原轨，B 听手稿；都沿用当前音色、音量与回响。');
    if(!loom.source){$('loomPosition').textContent='应用前，原星图保持原样';scorePaper.playhead(-1);}
  }
  function stopLoomAudition() {
    loom.token++;loom.pending=false;
    if(loom.source){const source=loom.source,now=engine.ctx.currentTime;loom.gain.gain.setTargetAtTime(0,now,.006);try{source.stop(now+.03);}catch{}loom.source=null;loom.gain=null;}
    loom.readout='';renderLoomAudio();
  }
  function generatorControls() {
    const length=loom.draft.length;$('loomCount').max=length;$('loomCount').value=Math.min(length,Math.max(1,Number($('loomCount').value)));
    $('loomCountValue').textContent=$('loomCount').value+' 颗';
    document.querySelectorAll('[data-shape]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shape===loom.shape)));
  }
  function refreshManuscript() {
    loom.draft=loom.doc.snapshot();const info=loom.doc.summary();
    $('loomLength').value=loom.draft.length;generatorControls();
    $('loomTrackLabel').textContent=`0${loom.index+1} / ${C.ROLES[loom.index].name}`;
    $('manuscriptBadge').textContent=!info.changed?'原轨副本':loom.mode==='generated'?'新织候选':loom.mode==='resumed'?'接回手稿':'手写手稿';
    $('manuscriptDiff').textContent=`原轨 ${info.originalCount} → 手稿 ${info.draftCount} 颗 · `+(info.periodChanged?`周期 ${loom.original.length} → ${loom.draft.length} 格`:`${info.changedTicks} 格变化`);
    $('manuscriptUndo').disabled=!loom.doc.canUndo;$('manuscriptRedo').disabled=!loom.doc.canRedo;$('loomApply').disabled=!info.changed;
    scorePaper.render();renderLoomAudio();drawLoom();
  }
  function changeManuscript(action,mode='written') {
    stopLoomAudition();loom.message='';action();loom.mode=mode;refreshManuscript();
  }
  $('loomBtn').onclick=()=>{
    engine.pause();engine.cutVoices();engine.update();queue=[];updatePlaybackUI();stopLoomAudition();
    loom.index=selected;loom.base=C.clone(state);const entry=manuscriptCache.open(selected,state.tracks[selected]);
    loom.doc=entry.doc;loom.original=loom.doc.original;loom.resumed=entry.resumed;loom.mode=entry.resumed?'resumed':'copy';loom.target='draft';
    loom.shape='arc';loom.seed=crypto.getRandomValues(new Uint32Array(1))[0];loom.draft=loom.doc.snapshot();
    $('loomCount').value=Math.max(1,loom.draft.notes.filter(p=>p>=0).length);const pitches=loom.draft.notes.filter(p=>p>=0);
    $('loomRegister').value=pitches.length&&pitches.every(p=>p>=5)?'5':'0';$('loomDynamics').checked=true;$('loomGenerator').open=false;
    $('manuscriptNotice').textContent=entry.resumed?'已接回这条轨道在本次页面里的手稿。应用前，原轨不变。':'已抄下当前「'+C.ROLES[selected].name+'」轨道。点星谱纸写一点变化，或展开下方织一个新念头。';
    refreshManuscript();$('loomDialog').showModal();drawLoom();
  };
  $('loomLength').onchange=()=>changeManuscript(()=>loom.doc.resize(Number($('loomLength').value)));
  for(const [id,event] of [['loomCount','input'],['loomRegister','change'],['loomDynamics','change']])$(id).addEventListener(event,()=>{stopLoomAudition();generatorControls();});
  document.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>{stopLoomAudition();loom.shape=b.dataset.shape;generatorControls();});
  $('loomAgain').onclick=()=>changeManuscript(()=>{
    loom.seed=(loom.seed+1)>>>0;const t=loom.doc.snapshot();
    loom.doc.generate({count:Number($('loomCount').value),shape:loom.shape,register:Number($('loomRegister').value),dynamics:$('loomDynamics').checked,seed:loom.seed,offset:C.mod(t.shift-Math.floor(loom.original.shift/loom.original.length*t.length),t.length)});
  },'generated');
  $('loomDialog').addEventListener('close',stopLoomAudition);$('loomDialog').addEventListener('cancel',stopLoomAudition);
  $('loomApply').onclick=()=>{
    if(!loom.doc.summary().changed)return;const index=loom.index,draft=loom.doc.snapshot();stopLoomAudition();manuscriptCache.forget(index);
    edit(()=>{state.tracks[index]=draft;selected=index;focusNote=null;},'已把'+C.ROLES[index].name+'的手稿种回星图 · 可以撤销');$('loomDialog').close();
  };
  async function auditionManuscript(kind) {
    if((loom.pending||loom.source)&&loom.target===kind){stopLoomAudition();return;}
    if(loom.worker)return;stopLoomAudition();loom.target=kind;
    const t=kind==='original'?loom.original:loom.draft;
    if(!t.notes.some(p=>p>=0)||loom.base.volume===0||t.gain===0)return;
    const token=++loom.token,snapshot=OrbitLoom.audition(loom.base,loom.index,t),length=t.length;
    loom.pending=true;loom.worker=true;loom.message='';renderLoomAudio();
    const current=()=>token===loom.token&&$('loomDialog').open&&!document.hidden;
    try{
      await engine.ready();if(!current())return;
      const wav=await OrbitAudio.renderWav(snapshot,length);if(!current())return;
      const buffer=await engine.ctx.decodeAudioData(wav.bytes);if(!current())return;
      const source=engine.ctx.createBufferSource(),gain=engine.ctx.createGain();source.buffer=buffer;source.connect(gain).connect(engine.ctx.destination);
      const when=engine.ctx.currentTime+.035;
      source.onended=()=>{source.disconnect();gain.disconnect();loom.nodes.delete(source);if(loom.source===source){loom.source=null;loom.gain=null;loom.readout='';renderLoomAudio();}};
      loom.source=source;loom.gain=gain;loom.start=when+.04;loom.nodes.add(source);loom.pending=false;source.start(when);renderLoomAudio();
    }catch{if(current()){loom.pending=false;loom.message='这次未能启动试听，请再试一次。';}}
    finally{if(token===loom.token)loom.pending=false;loom.worker=false;renderLoomAudio();}
  }
  $('loomListen').onclick=()=>auditionManuscript('draft');$('loomOriginalListen').onclick=()=>auditionManuscript('original');
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopLoomAudition(); });
  function drawLoom() {
    if (!$('loomDialog').open || !loom.draft) return;
    const target = $('loomCanvas'), c = target.getContext('2d'), t = loom.source && loom.target === 'original' ? loom.original : loom.draft, x = 180, y = 177;
    c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, 360, 360);
    const ink = !A.catalogs.sky[appearance.sky].light ? C.ROLES[loom.index].color : ['#94643e', '#88702e', '#366e5c', '#4a7080', '#725c7d'][loom.index];
    c.lineWidth = .6; c.strokeStyle = skin['loom-ink'];
    for (let i = 0; i < 5; i++) { c.globalAlpha = .19; c.beginPath(); c.arc(x, y, 68 + i * 11, 0, Math.PI * 2); c.stroke(); }
    c.globalAlpha = .3; c.beginPath(); c.arc(x, y, 131, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < t.length; i++) {
      const a = i / t.length * Math.PI * 2 - Math.PI / 2;
      c.globalAlpha = i % 2 ? .28 : .6; c.beginPath(); c.moveTo(x + Math.cos(a) * 135, y + Math.sin(a) * 135); c.lineTo(x + Math.cos(a) * 140, y + Math.sin(a) * 140); c.stroke();
      c.font = '8px Consolas, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = skin['loom-ink'];
      c.globalAlpha = .7; c.fillText(String(i + 1).padStart(2, '0'), x + Math.cos(a) * 153, y + Math.sin(a) * 153);
    }
    const points = t.notes.map((pitch, step) => {
      if (pitch < 0) return null;
      const a = (step + t.shift) / t.length * Math.PI * 2 - Math.PI / 2, r = 68 + pitch % 5 * 11;
      return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, step, tick: C.mod(step + t.shift, t.length) };
    }).filter(Boolean);
    c.globalAlpha = .45; c.strokeStyle = ink; c.lineWidth = 1;
    c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); if (points.length > 1) c.closePath(); c.stroke();
    const phase = loom.source ? Math.max(0, (engine.ctx.currentTime - loom.start) * loom.base.bpm / 30) : -1;
    if (phase >= 0 && phase < t.length) {
      const a = phase / t.length * Math.PI * 2 - Math.PI / 2;
      c.globalAlpha = .5; c.strokeStyle = ink; c.lineWidth = .8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 129, y + Math.sin(a) * 129); c.stroke();
    }
    points.forEach(p => {
      const hit = phase >= p.tick && phase - p.tick < .65;
      c.globalAlpha = t.accents[p.step] < 1 ? .6 : 1;
      circle(c, p.x, p.y, hit ? 6 : 2.4 + t.accents[p.step] * 1.2, ink);
      if (t.accents[p.step] > 1 || hit) { c.strokeStyle = ink; c.lineWidth = .7; c.beginPath(); c.arc(p.x, p.y, hit ? 11 : 7, 0, Math.PI * 2); c.stroke(); }
    });
    c.globalAlpha = 1; circle(c, x, y, 29, skin['loom-paper']);
    c.fillStyle = ink; c.font = '30px "SimSun", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(points.length).padStart(2, '0'), x, y - 3);
    c.font = '7px Consolas, monospace'; c.fillStyle = skin['loom-ink']; c.fillText('S T A R S', x, y + 21);
    scorePaper.playhead(loom.source && loom.target === 'draft' && phase < t.length ? Math.floor(phase) : -1);
    if (loom.source) {
      const label = phase < t.length ? `第 ${Math.min(t.length, Math.floor(phase) + 1)} / ${t.length} 格 · ${loom.base.bpm} BPM` : '这一圈已走完，余音正在散去';
      if (label !== loom.readout) { loom.readout = label; $('loomPosition').textContent = label; }
    }
  }

  function geometry(w = width, h = height, forPoster = false) {
    if (forPoster) { const max = Math.min(w * .435, h * .32); return { cx:w / 2, cy:h * .52, radii:[.28,.46,.64,.82,1].map(v => v * max), max }; }
    const compact = !immersive && matchMedia('(max-width:700px)').matches;
    if (!compact && !immersive) {
      const max = Math.min(w * .435, h * (w < 740 ? .32 : .358));
      return { cx:w * (w < 740 ? .62 : .59), cy:h * .52, radii:[.28,.46,.64,.82,1].map(v => v * max), max };
    }
    const bottom = (compact ? stageBounds.voices : stageBounds.footer) - 10;
    const top = compact || immersive ? 102 : 55;
    const max = Math.max(20, Math.min(w * (compact ? .40 : .435), (bottom - top) * .41));
    return { cx:immersive || compact ? w / 2 : w * (w < 740 ? .62 : .59), cy:(top + bottom) / 2, radii:[.28,.46,.64,.82,1].map(v => v * max), max };
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
  function drawDiscSurface(c,x,y,r,scale=1) {
    c.save(); c.strokeStyle=skin['record-groove']; c.fillStyle=skin['record-groove']; c.lineWidth=.55*scale;
    if(appearance.disc==='rings') {
      for(let k=0;k<85;k++){c.globalAlpha=k%4?.045:.12;c.beginPath();c.arc(x,y,r*(.15+k/85*.84),0,Math.PI*2);c.stroke();}
    } else if(appearance.disc==='atlas') {
      c.globalAlpha=.20;
      for(let k=1;k<=8;k++){c.beginPath();c.arc(x,y,r*k/9,0,Math.PI*2);c.stroke();}
      for(let k=0;k<24;k++){const a=k/24*Math.PI*2;c.globalAlpha=k%3?.08:.22;c.beginPath();c.moveTo(x+Math.cos(a)*r*.16,y+Math.sin(a)*r*.16);c.lineTo(x+Math.cos(a)*r*.95,y+Math.sin(a)*r*.95);c.stroke();}
      c.globalAlpha=.5;c.font=`${7*scale}px Consolas, monospace`;c.textAlign='center';c.textBaseline='middle';['N','E','S','W'].forEach((t,k)=>{const a=k/4*Math.PI*2-Math.PI/2;c.fillText(t,x+Math.cos(a)*r*.92,y+Math.sin(a)*r*.92);});
    } else if(appearance.disc==='diffraction') {
      for(let k=0;k<8;k++){c.globalAlpha=k%2?.10:.27;const a=k/8*Math.PI*2;c.beginPath();c.moveTo(x+Math.cos(a)*r*.12,y+Math.sin(a)*r*.12);c.lineTo(x+Math.cos(a)*r*.98,y+Math.sin(a)*r*.98);c.stroke();}
      for(const [u,v] of [[-.52,-.42],[.43,.37],[-.36,.60]]){c.globalAlpha=.36;const sx=x+u*r,sy=y+v*r;for(let k=0;k<4;k++){const a=k/4*Math.PI*2;c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+Math.cos(a)*r*.075,sy+Math.sin(a)*r*.075);c.stroke();}}
    } else {
      const rand=C.rng(7309);for(let k=0;k<36;k++){const a=rand()*Math.PI*2,d=Math.sqrt(rand())*r*.92,rad=r*(.015+rand()*.085);c.globalAlpha=.06;c.beginPath();c.arc(x+Math.cos(a)*d,y+Math.sin(a)*d,rad,0,Math.PI*2);c.fill();c.globalAlpha=.23;c.beginPath();c.arc(x+Math.cos(a)*d,y+Math.sin(a)*d,rad,.1,Math.PI*1.2);c.stroke();}
    }
    c.restore();
  }
  function drawTonearm(c, g, platter, w) {
    const x = Math.min(w - 25, g.cx + platter + 19), y = g.cy - platter * .80, length = platter * 1.40;
    const parked = -.055, angle = parked + armProgress * .43;
    // A stationary cradle makes the lifted, parked position readable even when paused.
    const restX = x - Math.sin(parked) * length - Math.cos(parked) * length * .085;
    const restY = y + Math.cos(parked) * length - Math.sin(parked) * length * .085;
    c.save(); c.translate(restX, restY); c.rotate(parked);
    c.fillStyle = skin['arm-head']; c.fillRect(-12, -8, 24, 29);
    c.strokeStyle = skin['arm-metal']; c.lineWidth = 1; c.strokeRect(-9, -5, 18, 23); c.restore();
    c.save(); c.translate(x, y); c.rotate(angle);
    c.shadowColor = '#00000035'; c.shadowBlur = 5 + (1 - armProgress) * 5; c.shadowOffsetX = 3; c.shadowOffsetY = 4;
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = skin['arm-metal']; c.lineWidth = 7;
    c.beginPath(); c.moveTo(0, -18); c.lineTo(0, length * .79); c.lineTo(-length * .085, length); c.stroke();
    c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; c.strokeStyle = skin['arm-light']; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = skin['arm-head']; c.fillRect(-7, -30, 14, 20);
    c.translate(-length * .085, length); c.fillRect(-8, -7, 16, 24);
    c.fillStyle = skin['arm-tip']; c.fillRect(-8, 11, 16, 6);
    c.strokeStyle = skin['arm-light']; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 17); c.lineTo(0, 21 - armProgress * 3); c.stroke(); c.restore();
    circle(c, x, y, 12, skin['arm-metal']); circle(c, x, y, 5, skin['arm-head']); circle(c, x, y, 1.5, skin['arm-light']);
    c.fillStyle = skin.muted; c.font = '7px Consolas, monospace'; c.textAlign = 'center'; c.fillText(engine.running ? 'PLAY' : 'REST', x, y - 42);
  }
  function scene(c, w, h, phase, now, poster = false) {
    const g = geometry(w, h, poster), scale = poster ? 1.8 : 1;
    c.clearRect(0, 0, w, h);
    c.fillStyle = skin.paper; c.fillRect(0, 0, w, h); c.drawImage(skyTexture, 0, 0, w, h);
    const platter = g.max + Math.min(32 * scale, g.max * .18);
    c.shadowColor = '#203e3438'; c.shadowBlur = 18 * scale; c.shadowOffsetY = 9 * scale;
    circle(c, g.cx, g.cy, platter, skin['record-edge']); c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.save(); c.beginPath(); c.arc(g.cx, g.cy, platter, 0, Math.PI * 2); c.clip();
    const bg = c.createRadialGradient(g.cx - g.max * .35, g.cy - g.max * .4, 0, g.cx, g.cy, platter); bg.addColorStop(0, skin['record-light']); bg.addColorStop(.5, skin['record-mid']); bg.addColorStop(1, skin['record-dark']); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = skin['record-groove']; c.lineWidth = .45 * scale;
    if (!A.catalogs.sky[appearance.sky].light) { c.save(); c.globalAlpha = .5; c.globalCompositeOperation = 'screen'; c.drawImage(skyTexture, g.cx - platter, g.cy - platter, platter * 2, platter * 2); c.restore(); }
    drawDiscSurface(c, g.cx, g.cy, platter, scale);
    const colors = { dawn: ['#dfba88', '#89cfb6'], tide: ['#7cbcc9', '#7bc9b1'], glass: ['#b9a0d1', '#86b4d2'] }[state.scale];
    colors.forEach((color, i) => {
      const drift = reducedMotion ? 0 : Math.sin(now * .00008 + i * 2) * g.max * .07;
      const x = g.cx + (i ? -.42 : .46) * g.max + drift, y = g.cy + (i ? .4 : -.35) * g.max;
      const wash = c.createRadialGradient(x, y, 0, x, y, g.max * .95); wash.addColorStop(0, color + '10'); wash.addColorStop(1, color + '00'); c.fillStyle = wash; c.fillRect(0, 0, w, h);
    });
    stars.forEach((star, i) => { const a = star.x * Math.PI * 2, r = Math.sqrt(star.y) * (platter - 4 * scale); c.globalAlpha = star.a * .8 * (reducedMotion ? 1 : .8 + Math.sin(now * .0005 + star.phase) * .2); circle(c, g.cx + Math.cos(a) * r, g.cy + Math.sin(a) * r, star.r * scale * .8, i % 9 ? '#b2cdbc' : '#dfc68e'); }); c.globalAlpha = 1;
    // Fine brass arcs make the moving score feel like an engraved instrument.
    c.lineWidth = .65 * scale;
    for (const [start, end] of [[-.95, -.38], [.1, .48], [.75, 1.3]]) {
      c.globalAlpha = .36; c.strokeStyle = '#c9b27b'; c.beginPath(); c.arc(g.cx, g.cy, g.max + 10 * scale, start * Math.PI, end * Math.PI); c.stroke();
      c.globalAlpha = .11; c.strokeStyle = '#d6c08d'; c.beginPath(); c.arc(g.cx, g.cy, g.max + 13 * scale, start * Math.PI, end * Math.PI); c.stroke();
    }
    c.globalAlpha = 1;
    // Fine survey marks: an observatory, rather than a literal gravity simulation.
    c.strokeStyle = '#8f9f7b'; c.lineWidth = .6 * scale;
    for (let k = 0; k < 72; k++) {
      const a = k / 72 * Math.PI * 2, r = g.max + 16 * scale;
      c.globalAlpha = k % 6 ? .24 : .5; c.beginPath(); c.moveTo(g.cx + Math.cos(a) * r, g.cy + Math.sin(a) * r); c.lineTo(g.cx + Math.cos(a) * (r + (k % 6 ? 3 : 7) * scale), g.cy + Math.sin(a) * (r + (k % 6 ? 3 : 7) * scale)); c.stroke();
    }
    c.globalAlpha = 1; c.setLineDash([2 * scale, 7 * scale]); c.strokeStyle = '#29474e'; c.beginPath(); c.moveTo(g.cx, g.cy - g.max - 30 * scale); c.lineTo(g.cx, g.cy + g.max + 20 * scale); c.moveTo(g.cx - g.max - 25 * scale, g.cy); c.lineTo(g.cx + g.max + 25 * scale, g.cy); c.stroke(); c.setLineDash([]);
    state.tracks.forEach((t, track) => {
      const color = C.ROLES[track].color, r = g.radii[track], audible = C.audible(state, track);
      c.globalAlpha = audible ? 1 : .18;
      const metal = c.createLinearGradient(g.cx - r, g.cy - r, g.cx + r, g.cy + r);
      metal.addColorStop(0, track === selected ? '#a8c2a0' : '#657f70'); metal.addColorStop(.35, '#335858'); metal.addColorStop(.72, track === selected ? '#719d89' : '#385e5b'); metal.addColorStop(1, '#2d514d');
      c.beginPath(); c.arc(g.cx, g.cy, r, 0, Math.PI * 2); c.strokeStyle = metal; c.lineWidth = (track === selected ? 1.2 : .75) * scale; c.stroke();
      c.globalAlpha = audible ? .13 : .025; c.strokeStyle = color; c.lineWidth = .45 * scale; c.beginPath(); c.arc(g.cx, g.cy, r + 2.3 * scale, 0, Math.PI * 2); c.stroke();
      const active = t.notes.map((p, i) => p >= 0 ? location(track, i, g) : null).filter(Boolean);
      if (active.length > 1) { c.beginPath(); active.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.strokeStyle = color; c.lineWidth = .6 * scale; c.globalAlpha = audible ? (track === selected ? .16 : .075) : .02; c.stroke(); }
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
    const label = g.radii[0] * .67;
    circle(c, g.cx, g.cy, label, skin['record-label']); c.strokeStyle = skin['record-label-line']; c.lineWidth = .8 * scale; c.beginPath(); c.arc(g.cx, g.cy, Math.max(.5, label - 4 * scale), 0, Math.PI * 2); c.stroke();
    c.save(); c.translate(g.cx, g.cy); c.rotate(poster || reducedMotion ? 0 : phase * .055);
    c.fillStyle = skin['record-label-ink']; c.font = `${Math.max(4.8, label * .16)}px Consolas, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const brand = 'S T A R G R A M';
    [...brand].forEach((letter, i) => { c.save(); c.rotate(-1.15 + i / (brand.length - 1) * 2.3); c.fillText(letter, 0, -label * .72); c.restore(); });
    c.strokeStyle = skin['arm-tip']; c.lineWidth = 1 * scale;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * label * .23, Math.sin(a) * label * .23); c.lineTo(Math.cos(a) * label * .48, Math.sin(a) * label * .48); c.stroke(); }
    c.fillStyle = skin['record-label-ink']; c.font = `${Math.max(4, label * .13)}px Consolas, monospace`; c.fillText('SIDE A', 0, label * .65); c.restore(); circle(c, g.cx, g.cy, 2.4 * scale, skin['record-label-ink']);
    if (!poster) {
      particles = particles.filter(p => now - p.born < 1400).slice(-150);
      particles.forEach(p => { const age = (now - p.born) / 1000; c.globalAlpha = Math.max(0, 1 - age / 1.4) * .65; circle(c, p.x + p.vx * age, p.y + p.vy * age, 1.2, p.color); }); c.globalAlpha = 1;
      if (drag && drag.moved && drag.pitch >= 0) { const p = drag.target ? location(drag.target.track, drag.target.step, g) : drag; c.globalAlpha = .8; circle(c, p.x, p.y, 7, C.ROLES[drag.target?.track ?? drag.track].color); c.globalAlpha = 1; }
      c.restore();
      if (w >= 570 && !immersive) drawTonearm(c, g, platter, w);
    } else {
      c.restore(); c.strokeStyle = skin.line; c.lineWidth = 1; c.strokeRect(32, 32, w - 64, h - 64);
      c.textAlign = 'center'; c.fillStyle = skin.orange; c.font = '15px Consolas, monospace'; c.fillText('S T A R G R A M   /   O R B I T A L   R E C O R D S', w / 2, 75);
      c.fillStyle = skin.ink; c.font = `42px ${skin.serif}`;
      const titleLines = []; let titleLine = '';
      for (const letter of state.title) {
        if (titleLine && c.measureText(titleLine + letter).width > w - 220) { titleLines.push(titleLine); titleLine = letter; }
        else titleLine += letter;
      }
      titleLines.push(titleLine);
      titleLines.forEach((line, i) => c.fillText(line, w / 2, titleLines.length === 1 ? 138 : 118 + i * 46, w - 180));
      c.fillStyle = skin.muted; c.font = '18px "Microsoft YaHei", sans-serif'; c.fillText(`${C.countNotes(state)} 颗星星  ·  ${state.bpm} BPM  ·  ${C.SCALES[state.scale].label}`, w / 2, h - 90);
      c.fillStyle = skin.muted; c.font = '14px "Microsoft YaHei", sans-serif'; c.fillText('星轨留声机  /  让偶然，成为旋律。  /  ' + A.code(appearance), w / 2, h - 50);
    }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || now - lastFrame < (reducedMotion ? 100 : 16)) return;
    const elapsed = Math.min(100, now - lastFrame); lastFrame = now;
    const target = engine.running ? 1 : 0;
    armProgress = reducedMotion ? target : target + (armProgress - target) * Math.exp(-elapsed / 165);
    if (Math.abs(armProgress - target) < .001) armProgress = target;
    while (queue.length && engine.ctx && queue[0].when <= engine.ctx.currentTime) {
      const item = queue.shift(); item.events.forEach(e => pulse(e.track, e.step)); encounters += item.events.length;
      if (item.events.length) $('noteReadout').textContent = [...new Set(item.events.map(e => C.ROLES[e.track].name))].join(' · ') + ' / 相遇';
      if (encounters >= 32) discover('listen');
    }
    for (const [k, v] of pulses) if (now - v > 1500) pulses.delete(k);
    const phase = engine.phase(); scene(ctx, width, height, phase, now); drawLoom(); darkroom?.tick(now, engine.running);
    const t = state.tracks[selected], step = C.mod(Math.floor(phase) - t.shift, t.length);
    if (step !== renderedStep) { renderedStep = step; document.querySelectorAll('.step').forEach(b => b.classList.toggle('current', engine.running && Number(b.dataset.step) === step)); }
    const beatText = engine.running ? `第 ${Math.floor(phase / 8) + 1} 小节 · ${Math.floor(phase / 2) % 4 + 1} / 4 拍` : phase > 0 ? '时间暂歇，星星还在这里' : '等待第一束光';
    if ($('beatReadout').textContent !== beatText) $('beatReadout').textContent = beatText;
    if (!engine.running) document.querySelectorAll('.step.current').forEach(b => b.classList.remove('current'));
  }
  function resize() {
    const r=canvas.getBoundingClientRect();width=r.width;height=r.height;
    stageBounds={footer:document.querySelector('.stage-footer').offsetTop,voices:document.querySelector('.stage-voices').offsetTop};
    const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(width*dpr),h=Math.round(height*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;particles=[];}
    ctx.setTransform(dpr,0,0,dpr,0,0);
    // Dialog scrollbars and type changes can resize the canvas between frames.
    // Repaint in the observer callback so a cleared bitmap never reaches the screen.
    if(skin.paper&&width>0&&height>0)scene(ctx,width,height,engine.phase(),performance.now());
  }
  const layoutObserver = new ResizeObserver(resize);
  for (const item of [canvas, document.querySelector('.stage-footer'), document.querySelector('.stage-voices')]) layoutObserver.observe(item);

  function filename(ext) { return 'Stargram_' + state.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 40) + '.' + ext; }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function capturePostcard() {
    const postcard = document.createElement('canvas'); postcard.width = 1600; postcard.height = 1200;
    scene(postcard.getContext('2d'), 1600, 1200, engine.phase(), performance.now(), true);
    postcard.toBlob(blob => { if (blob) { download(blob, filename('png')); toast('已把星空拍成一张明信片'); if ($('exportDialog').open) $('exportStatus').textContent = '明信片已交给浏览器下载 · 1600 × 1200 PNG。'; } else toast('明信片生成失败，请重试'); }, 'image/png');
  }
  $('captureBtn').onclick = capturePostcard;
  $('posterExportBtn').onclick = () => { $('exportStatus').textContent = '正在为这张星图制作封面…'; capturePostcard(); };
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
      const imported = C.validate(JSON.parse(await file.text())); manuscriptCache.reset();
      edit(() => { state = imported; focusNote = null; }); queue = []; await engine.reset(); engine.update(); $('exportDialog').close(); toast('欢迎回到这片星空');
    } catch { $('exportStatus').textContent = '导入失败：请选择有效的 Stargram v1 / v2 星图 JSON。当前星图未改变。'; }
    finally { e.target.value = ''; }
  };
  window.addEventListener('beforeunload', persist);
  // Read-only diagnostics for local regression checks; no bypass for UI operations.
  window.Stargram = Object.freeze({ snapshot: () => C.clone(state), collection: () => C.clone(shelf.entries), loom: () => $('loomDialog').open ? { index: loom.index, original:C.clone(loom.original), draft:C.clone(loom.draft), summary:loom.doc.summary(), resumed:loom.resumed, audition:loom.target, seed:loom.seed } : null, status: () => ({ playing: engine.running, theme, appearance:A.validate(appearance), recipeCode:A.code(appearance), tonearm: armProgress, reducedMotion, geometry: geometry(), phase: engine.phase(), encounters, selected, editMode, focusedNote: focusNote ? { ...focusNote } : null, immersive, saved: !saveError, audioState: engine.ctx?.state || 'uninitialized', activeVoices: engine.voices.size, loomOpen: $('loomDialog').open, loomPreparing: loom.pending, loomPlaying: !!loom.source, loomVoices: loom.nodes.size }), exportWav: OrbitAudio.renderWav });
  setAppearance(appearance, false);
  darkroom = AstroDarkroom.create({get:()=>appearance,apply:setAppearance,draw:target=>{const c=target.getContext('2d');c.setTransform(.5,0,0,.5,0,0);scene(c,1600,1200,engine.phase(),performance.now(),true);}});
  renderUI(); resize(); requestAnimationFrame(frame);
  function clearLetterAddress(){try{const url=new URL(window.location.href);if(!url.hash.startsWith('#letter='))return;url.hash='';window.history.replaceState(null,'',url.href);}catch{}}
  const letters=OrbitLetterDesk.create({
    getState:()=>C.clone(state),getAppearance:()=>A.validate(appearance),
    onOpen:()=>{for(const d of document.querySelectorAll('dialog[open]'))if(d.id!=='letterDialog')d.close();engine.pause();engine.cutVoices();queue=[];stopLoomAudition();updatePlaybackUI();},
    accept:(song,look)=>{
      clearLetterAddress();
      manuscriptCache.reset();engine.pause();engine.cutVoices();queue=[];pulses.clear();
      edit(()=>{state=C.validate(song);focusNote=null;},'这封来信已放上唱片机 · 可以撤销');
      engine.reset();updatePlaybackUI();if(look)setAppearance(look);
    }
  });
  $('letterDialog').addEventListener('close',clearLetterAddress);
  $('letterDialog').addEventListener('cancel',clearLetterAddress);
  $('letterDialog').querySelector('[data-close]').addEventListener('click',clearLetterAddress);
  window.addEventListener('hashchange',()=>letters.arrival());
  letters.arrival();
  if (saveError) { $('saveStatus').textContent = '未能恢复本地星图，请导出文件留存'; toast('本地存档不可用，已打开默认星图'); }
  else if (stored) $('saveStatus').textContent = '已恢复上次的星图';
})();
