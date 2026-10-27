/* Original procedural voices. Audio clock drives the sequencer. */
(function () {
  'use strict';
  const C = OrbitCore;
  function graph(ctx, state) {
    const input = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain();
    const convolver = ctx.createConvolver(), master = ctx.createGain(), compressor = ctx.createDynamicsCompressor();
    const random = C.rng(711), duration = 2.4;
    const impulse = ctx.createBuffer(2, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] = (random() * 2 - 1) * Math.pow(1 - i / data.length, 3.5) * 0.28;
    }
    convolver.buffer = impulse;
    dry.gain.value = 0.82; wet.gain.value = state.space * 0.65;
    compressor.threshold.value = -12; compressor.knee.value = 18; compressor.ratio.value = 5;
    compressor.attack.value = 0.003; compressor.release.value = 0.25;
    master.gain.value = state.volume * 1.2;
    input.connect(dry).connect(compressor); input.connect(convolver).connect(wet).connect(compressor);
    compressor.connect(master).connect(ctx.destination);
    const channels = state.tracks.map((track, i) => { const node = ctx.createGain(); node.gain.value = C.audible(state, i) ? track.gain : 0; node.connect(input); return node; });
    return { input, master, wet, channels };
  }
  function voice(ctx, input, event, when, duration = 1, onFinished = () => {}) {
    const f = 440 * Math.pow(2, (event.midi - 69) / 12), type = C.ROLES[event.track].voice;
    const pan = ctx.createStereoPanner(), env = ctx.createGain();
    pan.pan.value = (event.track - 2) * 0.27;
    env.connect(pan).connect(input);
    const specs = {
      bass: { harmonics: [1, 2], levels: [0.74, 0.13], decay: 1.6, attack: 0.018 },
      soft: { harmonics: [1, 2, 3], levels: [0.46, 0.12, 0.04], decay: 1.4, attack: 0.03 },
      pluck: { harmonics: [1, 2, 3.001], levels: [0.48, 0.16, 0.055], decay: 1.15, attack: 0.005 },
      bell: { harmonics: [1, 2.756, 5.404], levels: [0.42, 0.13, 0.026], decay: 2.1, attack: 0.004 },
      air: { harmonics: [0.998, 1.002, 2], levels: [0.21, 0.21, 0.04], decay: 2.5, attack: 0.09 }
    }[type];
    const decay = specs.decay * duration, level = event.gain * 0.60;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(level, when + specs.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    let remaining = specs.harmonics.length;
    const oscillators = [], handle = { stop: () => {
      const now = ctx.currentTime;
      env.gain.cancelScheduledValues(now); env.gain.setTargetAtTime(0, now, 0.006);
      oscillators.forEach(o => { try { o.stop(now + 0.025); } catch {} });
    } };
    specs.harmonics.forEach((ratio, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = f * ratio; gain.gain.value = specs.levels[i];
      osc.connect(gain).connect(env); osc.start(when); osc.stop(when + decay + 0.03);
      oscillators.push(osc);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); if (--remaining === 0) { env.disconnect(); pan.disconnect(); onFinished(handle); } };
    });
    return handle;
  }
  class Engine {
    constructor(getState, onTick) { this.getState = getState; this.onTick = onTick; this.running = false; this.tick = 0; this.lastPhase = 0; this.voices = new Set(); }
    sound(event, when, duration = 1) {
      const gain = event.gain / (this.getState().tracks[event.track].gain || 1);
      this.voices.add(voice(this.ctx, this.bus.channels[event.track], { ...event, gain }, when, duration, handle => this.voices.delete(handle)));
    }
    cutVoices() { this.voices.forEach(handle => handle.stop()); }
    async ready() {
      if (!this.ctx) { this.ctx = new AudioContext(); this.bus = graph(this.ctx, this.getState()); }
      if (this.ctx.state !== 'running') await this.ctx.resume();
    }
    async play() {
      await this.ready();
      if (this.running) return;
      this.running = true; this.next = this.ctx.currentTime + 0.065;
      this.update(); this.schedule(); this.timer = setInterval(() => this.schedule(), 25);
    }
    schedule() {
      if (!this.running) return;
      const state = this.getState(); this.duration = 30 / state.bpm;
      if (this.next < this.ctx.currentTime - 0.2) this.next = this.ctx.currentTime + 0.04;
      while (this.next < this.ctx.currentTime + 0.10) {
        const events = C.eventsAt(state, this.tick);
        events.forEach(e => this.sound(e, this.next));
        this.onTick({ tick: this.tick, when: this.next, events });
        this.anchorTick = this.tick; this.anchorTime = this.next;
        this.tick++; this.next += this.duration;
      }
    }
    phase() { return this.running ? Math.max(0, this.anchorTick + (this.ctx.currentTime - this.anchorTime) / this.duration) : this.lastPhase; }
    pause() {
      if (!this.running) return;
      this.lastPhase = this.phase(); this.tick = Math.ceil(this.lastPhase);
      this.running = false; clearInterval(this.timer);
      this.cutVoices();
      this.bus.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bus.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.025);
    }
    reset() { const playing = this.running; this.pause(); this.cutVoices(); this.tick = 0; this.lastPhase = 0; if (playing) return this.play(); }
    update(audition = false) {
      if (!this.ctx) return;
      const s = this.getState();
      this.bus.master.gain.setTargetAtTime(this.running || audition ? s.volume * 1.2 : 0, this.ctx.currentTime, 0.025);
      this.bus.wet.gain.setTargetAtTime(s.space * 0.65, this.ctx.currentTime, 0.06);
      this.bus.channels.forEach((node, i) => node.gain.setTargetAtTime(C.audible(s, i) ? s.tracks[i].gain : 0, this.ctx.currentTime, 0.025));
    }
    async preview(event) {
      await this.ready(); this.update(true); this.sound(event, this.ctx.currentTime + 0.01, 0.65);
    }
  }
  function wavBytes(buffer) {
    const n = buffer.length, channels = buffer.numberOfChannels, bytes = new ArrayBuffer(44 + n * channels * 2), view = new DataView(bytes);
    const write = (offset, str) => [...str].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    write(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); write(8, 'WAVE'); write(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, n * channels * 2, true);
    const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
    let peak = 0; data.forEach(d => { for (const v of d) peak = Math.max(peak, Math.abs(v)); });
    const gain = peak > 0.88 ? 0.88 / peak : 1;
    for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i] * gain));
      view.setInt16(44 + (i * channels + c) * 2, Math.round(v * (v < 0 ? 32768 : 32767)), true);
    }
    return { bytes, peak: peak * gain, seconds: n / buffer.sampleRate, sampleRate: buffer.sampleRate };
  }
  async function renderWav(state, ticks = 64) {
    const snapshot = C.validate(state), step = 30 / snapshot.bpm, seconds = ticks * step + 3.2;
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * 44100), 44100), bus = graph(ctx, snapshot);
    for (let tick = 0; tick < ticks; tick++) C.eventsAt(snapshot, tick).forEach(e => voice(ctx, bus.channels[e.track], { ...e, gain: e.gain / (snapshot.tracks[e.track].gain || 1) }, tick * step + 0.04));
    return wavBytes(await ctx.startRendering());
  }
  window.OrbitAudio = { Engine, renderWav, wavBytes };
})();
