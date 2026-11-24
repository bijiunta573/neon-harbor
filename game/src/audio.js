// audio.js — all of Neon Harbor's sound is synthesized live with WebAudio:
// a two-oscillator engine, a two-tone siren that swells with proximity,
// noise-burst gunshots, pickup and objective chimes, harbor ambience, and
// three procedural radio stations. No audio files, no network.
export const STATIONS = ['ONDAS 98.4 FM — HARBOR GOLD', 'VELVET 92.1 — SLOW JAMS', 'PULSE 101.7 — DOCKSIDE BEATS', 'RADIO OFF'];
export class AudioEngine {
  constructor() {
    this.ctx = null; this.volume = 0.8;
    this.station = 0; this.radioTimer = 0; this.noteIdx = 0;
    this.sirenOn = false;
  }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.initGraph(); } catch { this.ctx = null; /* audio is garnish — never break the game */ }
  }
  initGraph() {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.volume * 0.7;
    this.master.connect(ctx.destination);
    // harbor ambience: looped filtered noise, waves on a slow swell
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const amb = ctx.createBufferSource(); amb.buffer = buf; amb.loop = true;
    const ambFilter = ctx.createBiquadFilter(); ambFilter.type = 'lowpass'; ambFilter.frequency.value = 420;
    this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0.035;
    amb.connect(ambFilter); ambFilter.connect(this.ambGain); this.ambGain.connect(this.master);
    amb.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.016;
    lfo.connect(lfoGain); lfoGain.connect(this.ambGain.gain); lfo.start();
    // engine: detuned saw + square through a lowpass
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    const engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 500;
    this.engOsc1 = ctx.createOscillator(); this.engOsc1.type = 'sawtooth'; this.engOsc1.frequency.value = 55;
    this.engOsc2 = ctx.createOscillator(); this.engOsc2.type = 'square'; this.engOsc2.frequency.value = 28;
    this.engOsc1.connect(engFilter); this.engOsc2.connect(engFilter);
    engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.engOsc1.start(); this.engOsc2.start();
    // siren: square wave alternating two tones
    this.sirGain = ctx.createGain(); this.sirGain.gain.value = 0;
    this.sirOsc = ctx.createOscillator(); this.sirOsc.type = 'triangle'; this.sirOsc.frequency.value = 760;
    this.sirOsc.connect(this.sirGain); this.sirGain.connect(this.master);
    this.sirOsc.start();
    this.sirFlip = 0;
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v * 0.7; }
  engine(speedNorm, driving) {
    if (!this.ctx || !this.engGain) return;
    const target = driving ? 0.05 + Math.abs(speedNorm) * 0.075 : 0;
    this.engGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.09);
    const f = 52 + Math.abs(speedNorm) * 165;
    this.engOsc1.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.06);
    this.engOsc2.frequency.setTargetAtTime(f * 0.5 + 3, this.ctx.currentTime, 0.06);
  }
  siren(active, proximity) {
    if (!this.ctx || !this.sirGain) return;
    this.sirenOn = active;
    const target = active ? 0.012 + proximity * 0.05 : 0;
    this.sirGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.15);
  }
  gunshot(weaponIdx = 1, distant = false) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 0.5;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass';
    filter.frequency.value = distant ? 700 : (weaponIdx === 3 ? 1600 : 2400);
    const g = ctx.createGain();
    const vol = distant ? 0.1 : (weaponIdx === 0 ? 0.12 : 0.3);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (weaponIdx === 2 ? 0.07 : 0.16));
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 1.2, 0.25);
  }
  blip(freqA, freqB, dur = 0.12, vol = 0.12, type = 'sine') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freqA, t);
    o.frequency.exponentialRampToValueAtTime(freqB, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  pickup() { this.blip(880, 1320, 0.14, 0.14); setTimeout(() => this.blip(1320, 1760, 0.16, 0.1), 70); }
  objective() { this.blip(660, 660, 0.1, 0.1, 'triangle'); setTimeout(() => this.blip(990, 990, 0.14, 0.1, 'triangle'), 110); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, f, 0.22, 0.12, 'triangle'), i * 120)); }
  cycleStation() { this.station = (this.station + 1) % STATIONS.length; this.noteIdx = 0; return STATIONS[this.station]; }
  update(dt, t) {
    if (!this.ctx) return;
    if (this.sirenOn) {
      this.sirFlip -= dt;
      if (this.sirFlip <= 0) { this.sirFlip = 0.34; this.sirOsc.frequency.value = this.sirOsc.frequency.value > 800 ? 712 : 958; }
    }
    // procedural radio: each station is a small generative pattern
    if (this.station === 3) return;
    this.radioTimer -= dt;
    if (this.radioTimer <= 0) {
      const patterns = [
        { scale: [0, 2, 4, 7, 9], base: 262, wave: 'triangle', step: 0.3, vol: 0.045 },
        { scale: [0, 3, 5, 7, 10], base: 220, wave: 'sine', step: 0.42, vol: 0.05 },
        { scale: [0, 0, 7, 0, 5, 7, 9, 7], base: 196, wave: 'square', step: 0.19, vol: 0.02 },
      ];
      const p = patterns[this.station];
      this.radioTimer = p.step;
      const semis = p.scale[this.noteIdx % p.scale.length] + (this.noteIdx % 16 >= 8 ? 12 : 0);
      this.noteIdx++;
      const freq = p.base * Math.pow(2, semis / 12);
      this.blip(freq, freq, p.step * 0.92, p.vol, p.wave);
      if (this.noteIdx % 4 === 0) this.blip(p.base / 2, p.base / 2, 0.2, p.vol * 0.9, 'sine');
    }
    void t;
  }
}
