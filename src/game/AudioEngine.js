// Fully synthesised audio (Web Audio API) - no sound files needed.

function distortionCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.volume = 0.7;
    this._boosting = false;
  }

  /** Must be called from a user gesture (browser autoplay rules). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    // Shared white noise buffer.
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // --- Engine -------------------------------------------------------------
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.Q.value = 2.5;
    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(6);
    const pre = ctx.createGain();
    pre.gain.value = 0.6;
    this.osc = [];
    const voices = [
      ['sawtooth', 1, 0.5, 0],
      ['sawtooth', 1, 0.35, 7],
      ['square', 0.5, 0.35, 0],
      ['triangle', 0.25, 0.6, 0],
    ];
    for (const [type, mult, gain, detune] of voices) {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g);
      g.connect(pre);
      o.start();
      this.osc.push({ o, mult });
    }
    pre.connect(shaper);
    shaper.connect(this.engFilter);
    this.engFilter.connect(this.engGain);
    this.engGain.connect(this.master);
    // Cylinder "chug" - amplitude modulation, strongest at idle.
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfoDepth = ctx.createGain();
    this.lfoDepth.gain.value = 0;
    this.lfo.connect(this.lfoDepth);
    this.lfoDepth.connect(this.engGain.gain);
    this.lfo.start();

    // --- Noise based loops -----------------------------------------------------
    const noiseLoop = (filterType, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      src.loopStart = Math.random();
      const f = ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(0, Math.random() * 1.5);
      return { src, f, g };
    };
    this.screech = noiseLoop('bandpass', 1150, 9);
    this.screech2 = noiseLoop('bandpass', 2300, 12);
    this.wind = noiseLoop('lowpass', 500, 0.7);
    this.rumble = noiseLoop('lowpass', 160, 1);
    this.hiss = noiseLoop('highpass', 3500, 0.7);

    // Curb rumble strip.
    this.curbOsc = ctx.createOscillator();
    this.curbOsc.type = 'square';
    const curbF = ctx.createBiquadFilter();
    curbF.type = 'lowpass';
    curbF.frequency.value = 260;
    this.curbGain = ctx.createGain();
    this.curbGain.gain.value = 0;
    this.curbOsc.connect(curbF);
    curbF.connect(this.curbGain);
    this.curbGain.connect(this.master);
    this.curbOsc.start();

    // Opponent engines (nearest car).
    this.oppOsc = ctx.createOscillator();
    this.oppOsc.type = 'sawtooth';
    const oppF = ctx.createBiquadFilter();
    oppF.type = 'lowpass';
    oppF.frequency.value = 900;
    this.oppGain = ctx.createGain();
    this.oppGain.gain.value = 0;
    this.oppOsc.connect(oppF);
    oppF.connect(this.oppGain);
    this.oppGain.connect(this.master);
    this.oppOsc.start();

    this.ready = true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }

  pause() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  /**
   * s: { rpm, throttle, speed, slip, offroad, curb, boost, oppDist, oppRpm, active }
   */
  update(s) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const tc = 0.05;
    const active = s.active ? 1 : 0;
    const rpm = s.rpm;
    const f = 20 + rpm * 0.034;
    for (const { o, mult } of this.osc) o.frequency.setTargetAtTime(f * mult, t, 0.03);
    this.lfo.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    const idleness = Math.max(0, 1 - (rpm - 900) / 2500);
    this.lfoDepth.gain.setTargetAtTime(0.06 * idleness * active, t, tc);
    this.engFilter.frequency.setTargetAtTime(320 + rpm * 0.24 + s.throttle * 1500, t, tc);
    const engVol = (0.11 + s.throttle * 0.11 + (rpm / 7600) * 0.07) * active;
    this.engGain.gain.setTargetAtTime(engVol, t, tc);

    const speed = Math.abs(s.speed);
    const slip = s.slip * active * (1 - s.offroad);
    this.screech.g.gain.setTargetAtTime(slip * 0.3, t, 0.04);
    this.screech.f.frequency.setTargetAtTime(1050 + Math.random() * 250, t, 0.05);
    this.screech2.g.gain.setTargetAtTime(slip * 0.09, t, 0.04);
    const w = Math.min(1, speed / 75);
    this.wind.g.gain.setTargetAtTime(w * w * 0.14 * active, t, 0.1);
    this.wind.f.frequency.setTargetAtTime(350 + speed * 12, t, 0.1);
    this.rumble.g.gain.setTargetAtTime(s.offroad * Math.min(1, speed / 15) * 0.55 * active, t, 0.05);
    this.hiss.g.gain.setTargetAtTime(s.boost ? 0.07 * active : 0, t, 0.08);
    this.curbOsc.frequency.setTargetAtTime(Math.max(8, speed / 0.8), t, 0.03);
    this.curbGain.gain.setTargetAtTime(s.curb && speed > 4 ? 0.12 * active : 0, t, 0.03);

    if (s.boost && !this._boosting) this.whoosh();
    this._boosting = s.boost;

    const oppVol = s.oppDist < 60 ? (0.09 / (1 + s.oppDist / 7)) * active : 0;
    this.oppGain.gain.setTargetAtTime(oppVol, t, 0.08);
    this.oppOsc.frequency.setTargetAtTime(22 + (s.oppRpm || 3000) * 0.034, t, 0.08);
  }

  /** Engine off (menus): fade everything out. */
  silence() {
    this.update({ rpm: 900, throttle: 0, speed: 0, slip: 0, offroad: 0, curb: false, boost: false, oppDist: 999, active: false });
  }

  impact(intensity) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const v = Math.min(1, intensity / 18);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500 + v * 1500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25 + v * 0.6, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18 + v * 0.3);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + 0.6);

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.3 + v * 0.5, t + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(og);
    og.connect(this.master);
    o.start(t);
    o.stop(t + 0.35);
  }

  beep(freq = 440, dur = 0.18, vol = 0.25) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  whoosh() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.5;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2200, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.8);
  }

  /** Short ascending jingle for finishing / best laps. */
  fanfare(good = true) {
    if (!this.ready) return;
    const notes = good ? [523, 659, 784, 1047] : [392, 349, 330];
    notes.forEach((n, i) => setTimeout(() => this.beep(n, 0.22, 0.18), i * 140));
  }
}
