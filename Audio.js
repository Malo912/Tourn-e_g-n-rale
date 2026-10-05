// Procedural audio: adaptive bistro-swing music, crowd ambience and synthesized sound effects (Web Audio, no assets).
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const c0 = (a) => a.ctx.currentTime;

// I - vi - ii - V in F major, voiced as MIDI notes
const PROG = [
  { root: 41, chord: [57, 60, 64, 65] }, // Fmaj7
  { root: 38, chord: [57, 60, 62, 65] }, // Dm7
  { root: 43, chord: [58, 62, 65, 67] }, // Gm7
  { root: 36, chord: [58, 60, 64, 67] }, // C7
];
const PROG_B = [
  { root: 46, chord: [58, 62, 65, 69] }, // Bbmaj7
  { root: 45, chord: [57, 60, 64, 67] }, // Am7
  { root: 38, chord: [57, 60, 62, 65] }, // Dm7
  { root: 43, chord: [58, 62, 65, 67] }, // Gm7 -> C7 turnaround
];
const SCALE = [65, 67, 69, 72, 74, 77, 79, 81, 84]; // F major pentatonic-ish

export class AudioEngine {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.started = false;
    this.intensity = 0;
    this.tempo = 92;
    this.step = 0;
    this.bar = 0;
    this.nextTime = 0;
    this.melodySeed = 1;
    this.laughT = 3;
    const unlock = () => this.init();
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    this._bind();
  }

  init() {
    if (this.started) {
      if (this.ctx?.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) {
      return;
    }
    this.started = true;
    const c = this.ctx;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(c.destination);
    this.music = c.createGain();
    this.sfx = c.createGain();
    this.amb = c.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.amb.connect(this.master);
    // warm room reverb for music
    this.verb = c.createConvolver();
    this.verb.buffer = this._impulse(1.6, 2.5);
    const vg = c.createGain();
    vg.gain.value = 0.22;
    this.verb.connect(vg);
    vg.connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.connect(this.music);
    this.musicBus.connect(this.verb);
    this.noise = this._noiseBuffer(2);
    this._crowd();
    this._pourLoop();
    this.applySettings();
    this.nextTime = c.currentTime + 0.1;
  }

  applySettings() {
    if (!this.ctx) return;
    const s = this.game.state?.settings || { music: 0.55, sfx: 0.8 };
    this.music.gain.value = s.music * 0.55;
    this.sfx.gain.value = s.sfx * 0.9;
    this.amb.gain.value = s.sfx * 0.5;
  }

  _impulse(sec, decay) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }
  _noiseBuffer(sec) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  _crowd() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp1 = c.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.value = 700;
    bp1.Q.value = 0.9;
    const bp2 = c.createBiquadFilter();
    bp2.type = 'peaking';
    bp2.frequency.value = 1400;
    bp2.gain.value = 6;
    this.crowdGain = c.createGain();
    this.crowdGain.gain.value = 0;
    src.connect(bp1);
    bp1.connect(bp2);
    bp2.connect(this.crowdGain);
    this.crowdGain.connect(this.amb);
    src.start();
    this.crowdFilter = bp1;
  }

  /** continuous beer-stream sound driven by the pint mini-game (valve opening and glass level) */
  _pourLoop() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 1.3;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 180;
    this.pourGain = c.createGain();
    this.pourGain.gain.value = 0;
    src.connect(bp);
    bp.connect(hp);
    hp.connect(this.pourGain);
    this.pourGain.connect(this.sfx);
    src.start();
    this.pourFilter = bp;
    this._bubbleT = 0;
  }

  // ------------------------------------------------------------- helpers
  _env(g, t, a, peak, d, sustain = 0, r = 0.1) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d);
    if (sustain) g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
  }
  _osc(type, f, t, dur, peak, dest, opts = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + (opts.glide || dur));
    if (opts.detune) o.detune.value = opts.detune;
    const g = c.createGain();
    this._env(g, t, opts.a ?? 0.005, peak, dur);
    let node = o;
    if (opts.lp) {
      const f2 = c.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.value = opts.lp;
      o.connect(f2);
      node = f2;
    }
    node.connect(g);
    g.connect(dest || this.sfx);
    o.start(t);
    o.stop(t + (opts.a ?? 0.005) + dur + 0.05);
    return o;
  }
  _noise(t, dur, peak, type, freq, q, dest, a = 0.002) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    f.Q.value = q;
    const g = c.createGain();
    this._env(g, t, a, peak, dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || this.sfx);
    const off = Math.random() * 1.5;
    s.start(t, off);
    s.stop(t + dur + a + 0.05);
    return f;
  }
  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }
  ok() {
    return this.ctx && this.ctx.state === 'running';
  }

  // ------------------------------------------------------------- sfx
  pour() {
    if (!this.ok()) return;
    const t = this.now;
    const f = this._noise(t, 1.9, 0.18, 'bandpass', 500, 1.2, this.sfx, 0.08);
    f.frequency.linearRampToValueAtTime(1300, t + 1.9);
    for (let i = 0; i < 8; i++) this._osc('sine', 300 + Math.random() * 400, t + 0.2 + i * 0.2, 0.05, 0.03, this.sfx, { to: 700 + Math.random() * 300, glide: 0.05 });
  }
  clink(k = 1) {
    if (!this.ok()) return;
    const t = this.now;
    const f = 2400 + Math.random() * 900;
    this._osc('sine', f, t, 0.35, 0.09 * k);
    this._osc('sine', f * 1.5, t, 0.25, 0.05 * k);
    if (k > 1) this._osc('sine', f * 1.12, t + 0.06, 0.3, 0.07);
  }
  clatter() {
    if (!this.ok()) return;
    for (let i = 0; i < 4; i++) setTimeout(() => this.clink(0.7), i * 70 + Math.random() * 40);
  }
  cash() {
    if (!this.ok()) return;
    const t = this.now;
    this._noise(t, 0.08, 0.15, 'highpass', 3000, 0.5);
    for (const [f, d] of [[1568, 0], [2093, 0.07], [3136, 0.07]]) this._osc('sine', f, t + 0.06 + d, 0.6, 0.08);
    this._osc('triangle', 4186, t + 0.13, 0.4, 0.03);
  }
  coin() {
    if (!this.ok()) return;
    const t = this.now;
    this._osc('square', 988, t, 0.06, 0.03, this.sfx, { lp: 3000 });
    this._osc('square', 1319, t + 0.06, 0.15, 0.03, this.sfx, { lp: 3000 });
  }
  door() {
    if (!this.ok()) return;
    const t = this.now;
    this._osc('sine', 1318, t, 0.7, 0.05);
    this._osc('sine', 988, t + 0.18, 0.9, 0.05);
    this._osc('sine', 2636, t, 0.3, 0.015);
  }
  chop() {
    if (!this.ok()) return;
    const t = this.now;
    for (let i = 0; i < 4; i++) {
      this._noise(t + i * 0.42, 0.05, 0.12, 'lowpass', 1800, 0.7);
      this._osc('sine', 160, t + i * 0.42, 0.06, 0.08, this.sfx, { to: 90, glide: 0.06 });
    }
  }
  thud() {
    if (!this.ok()) return;
    const t = this.now;
    this._osc('sine', 110, t, 0.25, 0.25, this.sfx, { to: 45, glide: 0.2 });
    this._noise(t, 0.12, 0.08, 'lowpass', 600, 0.7);
  }
  keg() {
    if (!this.ok()) return;
    this.thud();
    const t = this.now;
    this._osc('triangle', 620, t + 0.05, 0.5, 0.04);
    this._osc('triangle', 931, t + 0.05, 0.4, 0.03);
    this._noise(t + 0.3, 0.5, 0.06, 'highpass', 4000, 0.4);
  }
  wash() {
    if (!this.ok()) return;
    const t = this.now;
    const f = this._noise(t, 1.0, 0.07, 'bandpass', 900, 0.8, this.sfx, 0.2);
    f.frequency.linearRampToValueAtTime(400, t + 1.0);
  }
  bottle() {
    if (!this.ok()) return;
    const t = this.now;
    this._osc('sine', 600, t, 0.08, 0.12, this.sfx, { to: 220, glide: 0.07 });
    this._noise(t + 0.05, 0.4, 0.06, 'highpass', 5000, 0.5);
  }
  scribble() {
    if (!this.ok()) return;
    const t = this.now;
    for (let i = 0; i < 5; i++) this._noise(t + i * 0.12, 0.06, 0.04, 'bandpass', 3000 + Math.random() * 2000, 2);
  }
  clank() {
    if (!this.ok()) return;
    const t = this.now;
    for (let i = 0; i < 3; i++) {
      this._osc('square', 820 + Math.random() * 300, t + i * 0.33, 0.12, 0.04, this.sfx, { lp: 2500 });
      this._noise(t + i * 0.33, 0.06, 0.08, 'bandpass', 2500, 1);
    }
  }
  hiss() {
    if (!this.ok()) return;
    const t = this.now;
    this._noise(t, 1.4, 0.12, 'highpass', 2500, 0.5, this.sfx, 0.03);
  }
  angry() {
    if (!this.ok()) return;
    const t = this.now;
    this._osc('sawtooth', 210, t, 0.35, 0.06, this.sfx, { to: 120, glide: 0.35, lp: 900 });
  }
  glassBreak() {
    if (!this.ok()) return;
    const t = this.now;
    this._noise(t, 0.4, 0.2, 'highpass', 3500, 0.7);
    for (let i = 0; i < 6; i++) this._osc('sine', 2500 + Math.random() * 3500, t + Math.random() * 0.2, 0.15, 0.05);
  }
  splash() {
    if (!this.ok()) return;
    const t = this.now;
    this._noise(t, 0.35, 0.18, 'lowpass', 1200, 0.6);
  }
  cheer(big = false) {
    if (!this.ok()) return;
    const t = this.now;
    const f = this._noise(t, big ? 2.2 : 1.2, big ? 0.3 : 0.16, 'bandpass', 900, 0.7, this.amb, 0.25);
    f.frequency.linearRampToValueAtTime(1300, t + 1);
    for (let i = 0; i < (big ? 5 : 3); i++) this.laugh(0.2 + i * 0.15, 1.3);
  }
  laugh(delay = 0, pitchK = 1) {
    if (!this.ok()) return;
    const c = this.ctx;
    const t = this.now + delay;
    const base = (140 + Math.random() * 160) * pitchK;
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.14;
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * (1 + 0.05 * Math.sin(i)), tt);
      o.frequency.exponentialRampToValueAtTime(base * 0.85, tt + 0.1);
      const f1 = c.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.value = 800 + Math.random() * 200;
      f1.Q.value = 4;
      const f2 = c.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.value = 1300;
      f2.Q.value = 5;
      const g = c.createGain();
      this._env(g, tt, 0.015, 0.05, 0.09);
      o.connect(f1);
      o.connect(f2);
      f1.connect(g);
      f2.connect(g);
      g.connect(this.amb);
      o.start(tt);
      o.stop(tt + 0.14);
    }
  }
  chime(up = true) {
    if (!this.ok()) return;
    const t = this.now;
    const notes = up ? [72, 76, 79] : [72, 67];
    notes.forEach((n, i) => this._osc('triangle', NOTE(n), t + i * 0.08, 0.35, 0.06));
  }
  buzz() {
    if (!this.ok()) return;
    const t = this.now;
    this._osc('square', 140, t, 0.18, 0.04, this.sfx, { lp: 700 });
    this._osc('square', 110, t + 0.16, 0.22, 0.04, this.sfx, { lp: 700 });
  }
  blip() {
    if (!this.ok()) return;
    this._osc('sine', 880, this.now, 0.06, 0.04);
  }
  sting() {
    if (!this.ok()) return;
    const t = this.now;
    for (const n of [65, 69, 72, 77]) this._osc('sawtooth', NOTE(n), t, 0.5, 0.025, this.sfx, { lp: 1800, a: 0.02 });
    this._osc('sine', NOTE(41), t, 0.6, 0.12);
  }
  combo(n) {
    if (!this.ok()) return;
    const t = this.now;
    const base = 72 + Math.min(12, n);
    [0, 4, 7].forEach((k, i) => this._osc('square', NOTE(base + k), t + i * 0.05, 0.12, 0.025, this.sfx, { lp: 3000 }));
  }
  fanfare() {
    if (!this.ok()) return;
    const t = this.now;
    [[65, 0], [69, 0.12], [72, 0.24], [77, 0.36], [77, 0.6]].forEach(([n, d]) => {
      this._osc('sawtooth', NOTE(n), t + d, 0.35, 0.04, this.sfx, { lp: 2400, a: 0.01 });
      this._osc('square', NOTE(n - 12), t + d, 0.3, 0.02, this.sfx, { lp: 1200 });
    });
  }

  // mini-game feedback
  mg(name) {
    if (!this.ok()) return;
    const t = this.now;
    switch (name) {
      case 'cut':
      case 'cutPerfect':
        this._noise(t, 0.05, 0.16, 'highpass', 2500, 0.7);
        this._osc('sine', 180, t, 0.06, 0.1, this.sfx, { to: 90, glide: 0.06 });
        if (name === 'cutPerfect') this._osc('triangle', NOTE(84), t + 0.02, 0.12, 0.04);
        break;
      case 'place':
        this._osc('sine', 520, t, 0.08, 0.08, this.sfx, { to: 300, glide: 0.08 });
        this._osc('triangle', NOTE(79 + Math.floor(Math.random() * 3) * 2), t + 0.02, 0.1, 0.04);
        break;
      case 'miss':
        this._osc('square', 160, t, 0.12, 0.05, this.sfx, { lp: 800, to: 110, glide: 0.12 });
        break;
      case 'pop':
        this._osc('sine', 900, t, 0.05, 0.16, this.sfx, { to: 260, glide: 0.05 });
        this._noise(t + 0.03, 0.35, 0.07, 'highpass', 5000, 0.5);
        break;
      case 'fizz':
        this._noise(t, 0.9, 0.12, 'highpass', 3500, 0.4, this.sfx, 0.05);
        break;
      case 'ding':
        this._osc('triangle', NOTE(88), t, 0.4, 0.06);
        this._osc('sine', NOTE(100), t, 0.25, 0.02);
        break;
      default:
    }
  }
  result(q, kind) {
    if (!this.ok()) return;
    const t = this.now;
    if (q === 'perfect') {
      [76, 79, 84, 88].forEach((n, i) => this._osc('triangle', NOTE(n), t + i * 0.055, 0.3, 0.06));
      this._osc('sine', NOTE(100), t + 0.22, 0.4, 0.025);
      if (kind === 'pour') this.clink(1.4);
    } else if (q === 'good') {
      [72, 76].forEach((n, i) => this._osc('triangle', NOTE(n), t + i * 0.06, 0.22, 0.045));
      if (kind === 'pour') this.clink(0.9);
    } else if (q === 'average') {
      this._osc('triangle', NOTE(67), t, 0.2, 0.04);
    } else if (q === 'bad') {
      this.buzz();
    } else if (q === 'catastrophe') {
      this.splash();
      this._noise(t, 0.6, 0.18, 'lowpass', 900, 0.6, this.sfx, 0.02);
      // sad trombone
      [[58, 0], [57, 0.32], [56, 0.64], [55, 0.96]].forEach(([n, d], i) => this._osc('sawtooth', NOTE(n), t + 0.15 + d, i === 3 ? 0.9 : 0.28, 0.035, this.sfx, { lp: 1100, a: 0.03, to: i === 3 ? NOTE(53) : undefined, glide: 0.8 }));
    }
  }
  comboBreak() {
    if (!this.ok()) return;
    const t = this.now;
    this._osc('sawtooth', NOTE(64), t, 0.18, 0.035, this.sfx, { lp: 1400, to: NOTE(57), glide: 0.18 });
    this._osc('sawtooth', NOTE(57), t + 0.16, 0.3, 0.035, this.sfx, { lp: 1200, to: NOTE(50), glide: 0.3 });
  }
  comboMilestone(n) {
    if (!this.ok()) return;
    const t = this.now;
    const b = 72 + Math.min(7, Math.floor(n / 5) * 2);
    [0, 4, 7, 12, 16].forEach((k, i) => this._osc('square', NOTE(b + k), t + i * 0.06, 0.2, 0.03, this.sfx, { lp: 3500 }));
    this.cheer(false);
  }
  rushAlarm() {
    if (!this.ok()) return;
    const t = this.now;
    // referee whistle + alarm horn
    for (let i = 0; i < 2; i++) {
      const o = this._osc('sine', 2900, t + i * 0.32, 0.22, 0.07, this.sfx, { a: 0.01 });
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 38;
      const lg = this.ctx.createGain();
      lg.gain.value = 140;
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(t + i * 0.32);
      lfo.stop(t + i * 0.32 + 0.3);
    }
    [0, 0.5].forEach((d) => this._osc('sawtooth', NOTE(58), t + 0.7 + d, 0.35, 0.04, this.sfx, { lp: 1600, to: NOTE(63), glide: 0.3 }));
  }
  rushStart() {
    if (!this.ok()) return;
    this.cheer(true);
    this.sting();
  }

  ui(kind) {
    if (!this.ok()) return;
    if (kind === 'good') this.chime(true);
    else if (kind === 'bad') this.buzz();
    else if (kind === 'warn') this.chime(false);
    else if (kind === 'place') this.thud();
    else if (kind === 'sell') this.coin();
    else this.blip();
  }

  // ------------------------------------------------------------- music
  _ep(n, t, dur, vel) {
    const c = this.ctx;
    const f = NOTE(n);
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [k, a, type] of [[1, 1, 'sine'], [2, 0.25, 'sine'], [3.01, 0.06, 'triangle']]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f * k;
      const og = c.createGain();
      og.gain.value = a;
      o.connect(og);
      og.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    lp.connect(g);
    g.connect(this.musicBus);
  }
  _bass(n, t, dur, vel) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = NOTE(n);
    const s = c.createOscillator();
    s.type = 'sine';
    s.frequency.value = NOTE(n);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(vel * 0.4, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp);
    s.connect(lp);
    lp.connect(g);
    g.connect(this.music);
    o.start(t);
    s.start(t);
    o.stop(t + dur + 0.05);
    s.stop(t + dur + 0.05);
  }
  _kick(t, v = 0.5) {
    this._osc('sine', 140, t, 0.22, v, this.music, { to: 45, glide: 0.12 });
  }
  _snare(t, v = 0.12) {
    this._noise(t, 0.16, v, 'bandpass', 1900, 0.6, this.musicBus);
    this._osc('sine', 190, t, 0.07, v * 0.6, this.music);
  }
  _hat(t, v = 0.04, open = false) {
    this._noise(t, open ? 0.18 : 0.04, v, 'highpass', 7500, 0.5, this.musicBus);
  }
  _lead(n, t, dur, vel) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = this.disco ? 'sawtooth' : 'triangle';
    o.frequency.value = NOTE(n);
    const vib = c.createOscillator();
    vib.frequency.value = 5.5;
    const vg = c.createGain();
    vg.gain.value = 4;
    vib.connect(vg);
    vg.connect(o.detune);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = this.disco ? 2600 : 3200;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.02);
    g.gain.exponentialRampToValueAtTime(vel * 0.6, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp);
    lp.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
  }

  _scheduleStep(t, step16) {
    const I = this.intensity;
    const g = this.game;
    const service = g.phase === 'service' || g.phase === 'closing';
    const beat = step16 / 4;
    const barIdx = this.bar % 8;
    const prog = barIdx < 4 ? PROG : PROG_B;
    const ch = prog[barIdx % 4];
    const swing = step16 % 2 === 1 ? (60 / this.tempo) * 0.12 : 0;
    const tt = t + swing;
    const disco = this.disco;
    // piano comping
    if (step16 === 0 || step16 === 6 || (I > 0.4 && step16 === 10) || (!service && step16 === 8)) {
      const vel = 0.045 + I * 0.02;
      for (const n of ch.chord) this._ep(n, tt, 1.1, vel * (0.8 + Math.random() * 0.3));
    }
    // bass
    if (disco) {
      if (step16 % 2 === 0) this._bass(ch.root + (step16 % 4 === 2 ? 12 : 0), tt, 0.2, 0.22);
    } else if (step16 % 4 === 0) {
      const walk = [0, 7, 12, 10][beat] ?? 0;
      const n = I > 0.35 ? ch.root + walk : ch.root + (beat === 2 ? 7 : 0);
      if (I > 0.35 || beat % 2 === 0) this._bass(n, tt, 0.45, 0.2);
    }
    // drums
    const drums = service ? I > 0.12 : false;
    if (drums || disco) {
      if (disco ? step16 % 4 === 0 : step16 === 0 || step16 === 8 || (I > 0.7 && step16 === 10)) this._kick(tt, 0.32 + I * 0.15);
      if (step16 === 4 || step16 === 12) this._snare(tt, 0.06 + I * 0.07);
      if (step16 % 2 === 0) this._hat(tt, 0.012 + I * 0.025, disco && step16 % 4 === 2);
      if (I > 0.75 && step16 % 2 === 1) this._hat(tt, 0.012);
    } else if (step16 % 4 === 0) this._hat(tt, 0.01);
    // melody
    if ((I > 0.45 || this.jukebox || disco) && service) {
      const r = this._rand();
      if (step16 % 2 === 0 && r < 0.42 + I * 0.2) {
        const idx = Math.floor(this._rand() * SCALE.length);
        const n = SCALE[idx] + (barIdx >= 4 ? -2 : 0);
        this._lead(n, tt, 0.22 + this._rand() * 0.25, 0.025 + I * 0.012);
      }
    }
  }
  _rand() {
    // deterministic per bar so phrases repeat a bit
    this.melodySeed = (this.melodySeed * 16807) % 2147483647;
    return (this.melodySeed - 1) / 2147483646;
  }

  update(dt) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const g = this.game;
    if (!g.state) return;
    const service = g.phase === 'service' || g.phase === 'closing';
    const cnt = g.customers.customerCount();
    const seats = Math.max(1, g.bar.seatCount());
    const pend = g.orders.pendingList().length;
    const rush = g.rushActive?.() ? 0.35 : 0;
    const target = service ? Math.min(1, cnt / seats * 0.8 + pend * 0.03 + rush + (g.paused ? -1 : 0)) : 0;
    this.intensity += (Math.max(0, target) - this.intensity) * Math.min(1, dt * 0.4);
    // beer stream follows the tap opening during the pint mini-game
    const mg = g.minigames?.active;
    const pour = mg && mg.kind === 'pour' && !g.paused ? mg.game : null;
    const q = pour && !pour.done ? pour.q : 0;
    this.pourGain.gain.setTargetAtTime(q * 0.2, c0(this), 0.04);
    if (pour) this.pourFilter.frequency.setTargetAtTime(380 + Math.min(1, pour.total) * 1100 + q * 200, c0(this), 0.08);
    if (q > 0.2) {
      this._bubbleT -= dt;
      if (this._bubbleT <= 0) {
        this._bubbleT = 0.05 + Math.random() * 0.1;
        this._osc('sine', 500 + Math.random() * 500 + (pour.total || 0) * 600, this.now, 0.04, 0.012 * q, this.sfx, { to: 1100 + Math.random() * 400, glide: 0.04 });
      }
    }
    this.jukebox = g.bar.furniture.some((f) => f.def.id === 'jukebox');
    this.disco = g.eventEffects().music === 'disco' && service;
    const targetTempo = service ? 96 + this.intensity * 30 + rush * 30 : 84;
    this.tempo += (targetTempo - this.tempo) * Math.min(1, dt * 0.3);
    // music scheduler
    const c = this.ctx;
    const spb = 60 / this.tempo / 4;
    if (g.paused && service) {
      this.nextTime = c.currentTime + 0.1;
    } else {
      while (this.nextTime < c.currentTime + 0.15) {
        if (this.step === 0) this.melodySeed = 1 + (this.bar % 4) * 977 + (this.bar >> 3);
        this._scheduleStep(this.nextTime, this.step);
        this.nextTime += spb;
        this.step = (this.step + 1) % 16;
        if (this.step === 0) this.bar++;
      }
      if (this.nextTime < c.currentTime) this.nextTime = c.currentTime + 0.05;
    }
    // crowd
    const crowd = service && !g.paused ? Math.min(0.5, Math.sqrt(cnt) * 0.07) : 0;
    this.crowdGain.gain.setTargetAtTime(crowd * (0.75 + 0.25 * Math.sin(c.currentTime * 0.7) * Math.sin(c.currentTime * 1.9)), c.currentTime, 0.2);
    this.crowdFilter.frequency.setTargetAtTime(600 + 300 * Math.sin(c.currentTime * 1.3), c.currentTime, 0.3);
    if (service && !g.paused && cnt > 2) {
      this.laughT -= dt * g.speed;
      if (this.laughT <= 0) {
        this.laughT = 2 + Math.random() * 8 / Math.sqrt(cnt);
        this.laugh(0, 0.9 + Math.random() * 0.6);
      }
    }
  }

  _bind() {
    const b = this.game.bus;
    b.on('pourStart', ({ mini }) => !mini && this.pour());
    b.on('mgSfx', ({ name }) => this.mg(name));
    b.on('minigameResult', ({ kind, result }) => this.result(result.quality, kind));
    b.on('minigameStart', () => this.blip());
    b.on('comboBreak', () => this.comboBreak());
    b.on('comboMilestone', ({ n }) => this.comboMilestone(n));
    b.on('rushStart', () => this.rushStart());
    b.on('pourDone', () => this.clink(0.6));
    b.on('served', () => this.clink(2));
    b.on('money', ({ amount }) => amount > 0 && this.cash());
    b.on('chop', () => this.chop());
    b.on('kegChanged', () => this.keg());
    b.on('washStart', () => this.wash());
    b.on('tapBroken', () => {
      this.hiss();
      this.clank();
    });
    b.on('tapFixed', () => this.chime(true));
    b.on('angry', () => this.angry());
    b.on('cheer', () => this.cheer(false));
    b.on('goal', () => this.cheer(true));
    b.on('combo', ({ n, up }) => up && n >= 2 && this.combo(n));
    b.on('levelUp', () => this.fanfare());
    b.on('objective', () => this.chime(true));
    b.on('drop', () => this.glassBreak());
    b.on('spill', () => this.splash());
    b.on('cleared', () => this.clatter());
    b.on('dropDishes', () => this.clatter());
    b.on('delivery', () => this.thud());
    b.on('bottle', () => this.bottle());
    b.on('orderTaken', () => this.scribble());
    b.on('door', () => this.door());
    b.on('fridgeFilled', () => this.clatter());
  }
}
