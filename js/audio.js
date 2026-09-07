export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.sfx = true;
    this.musicOn = true;
    this._ambient = null;
    this._musicTimer = null;
    this._sizzle = null;
    this._master = null;
    this._musicGain = null;
    this._step = 0;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this._master = this.ctx.createGain();
      this._master.gain.value = 0.7;
      this._master.connect(this.ctx.destination);
      this._musicGain = this.ctx.createGain();
      this._musicGain.gain.value = 0.0;
      this._musicGain.connect(this._master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setSfx(on) { this.sfx = on; }
  setMusic(on) {
    this.musicOn = on;
    if (!on) this.stopMusic();
    else this.startMusic();
  }

  tone(freq, dur, type = 'sine', gain = 0.08, slide = 0) {
    if (!this.sfx || !this.ensure()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this._master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, gain = 0.04, hp = 800) {
    if (!this.sfx || !this.ensure()) return;
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = hp;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this._master);
    src.start();
  }

  click() { this.tone(720, 0.05, 'square', 0.04); }
  coin() {
    this.tone(880, 0.08, 'square', 0.06);
    setTimeout(() => this.tone(1320, 0.12, 'square', 0.05), 70);
  }
  bell() {
    this.tone(980, 0.25, 'sine', 0.07, -200);
    this.tone(1470, 0.18, 'sine', 0.03);
  }
  sizzleBurst() { this.noise(0.18, 0.05, 1800); }
  fail() { this.tone(180, 0.28, 'sawtooth', 0.06, -80); }
  success() {
    this.tone(523, 0.1, 'sine', 0.05);
    setTimeout(() => this.tone(659, 0.1, 'sine', 0.05), 80);
    setTimeout(() => this.tone(784, 0.18, 'sine', 0.06), 160);
  }
  perfect() {
    this.tone(659, 0.08, 'sine', 0.05);
    setTimeout(() => this.tone(784, 0.08, 'sine', 0.05), 70);
    setTimeout(() => this.tone(1046, 0.22, 'sine', 0.07), 140);
  }
  whoosh() { this.noise(0.2, 0.03, 400); }
  pop() { this.tone(420, 0.07, 'triangle', 0.05, 200); }

  setSizzle(on) {
    if (!this.ensure()) return;
    if (on && this.sfx) {
      if (this._sizzle) return;
      const ctx = this.ctx;
      const n = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.value = 0.03;
      src.connect(f);
      f.connect(g);
      g.connect(this._master);
      src.start();
      this._sizzle = src;
    } else if (this._sizzle) {
      try { this._sizzle.stop(); } catch (_) { /* already stopped */ }
      this._sizzle = null;
    }
  }

  startAmbient() {
    if (!this.ensure() || this._ambient) return;
    const ctx = this.ctx;
    const n = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.value = this.sfx ? 0.07 : 0;
    src.connect(f);
    f.connect(g);
    g.connect(this._master);
    src.start();
    this._ambient = { src, g };
  }

  startMusic() {
    if (!this.ensure() || this._musicTimer || !this.musicOn) return;
    const scale = [196, 220, 261, 294, 330, 392, 440];
    const pattern = [0, 2, 4, 5, 4, 2, 0, 4, 5, 6, 5, 4, 2, 0, 3, 4];
    this._musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this._musicGain.gain.linearRampToValueAtTime(0.045, this.ctx.currentTime + 0.6);
    const tick = () => {
      if (!this.musicOn || !this.ctx) return;
      const freq = scale[pattern[this._step % pattern.length]];
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g);
      g.connect(this._musicGain);
      o.start(t);
      o.stop(t + 0.4);
      this._step++;
    };
    tick();
    this._musicTimer = setInterval(tick, 380);
  }

  stopMusic() {
    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }
    if (this._musicGain && this.ctx) {
      this._musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this._musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
    }
  }

  dispose() {
    this.stopMusic();
    this.setSizzle(false);
    if (this._ambient) {
      try { this._ambient.src.stop(); } catch (_) { /* ignore */ }
      this._ambient = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
