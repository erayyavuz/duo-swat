// All sound is synthesised with WebAudio, no samples.
// Buzz: a housefly's wingbeat is ~190-220 Hz; the tone is a buzzy sawtooth pair,
// amplitude-modulated and band-passed, panned and attenuated by the fly's position.

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = false;
  }

  async enable() {
    if (!this.ctx) this._init();
    await this.ctx.resume();
    this.enabled = true;
    this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.05);
  }

  disable() {
    this.enabled = false;
    if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  _init() {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // ---- buzz voice
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; o3.type = 'triangle';
    o1.frequency.value = 200; o2.frequency.value = 201.5; o3.frequency.value = 400;
    const mix = ctx.createGain(); mix.gain.value = 0.5;
    const o3g = ctx.createGain(); o3g.gain.value = 0.35;
    o1.connect(mix); o2.connect(mix); o3.connect(o3g).connect(mix);
    // wingbeat flutter: slow random-ish amplitude wobble
    const am = ctx.createGain(); am.gain.value = 0.75;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 23;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.25;
    lfo.connect(lfoG).connect(am.gain);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    this.buzzGain = ctx.createGain(); this.buzzGain.gain.value = 0;
    this.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    mix.connect(am).connect(bp).connect(lp).connect(this.buzzGain);
    if (this.pan) this.buzzGain.connect(this.pan).connect(this.master); else this.buzzGain.connect(this.master);
    for (const o of [o1, o2, o3, lfo]) o.start();
    this.osc = [o1, o2, o3];
    this.bp = bp;

    // shared noise buffer
    const len = ctx.sampleRate * 1;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  // x: -1..1 pan, near: 0..1 loudness, speed: m/s, flying: bool
  buzz(x, near, speed, flying, dt) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const f = 188 + speed * 70 + Math.sin(t * 3.1) * 4 + (Math.random() - 0.5) * 3;
    this.osc[0].frequency.setTargetAtTime(f, t, 0.03);
    this.osc[1].frequency.setTargetAtTime(f * 1.008, t, 0.03);
    this.osc[2].frequency.setTargetAtTime(f * 2, t, 0.03);
    this.bp.frequency.setTargetAtTime(700 + near * 900 + speed * 400, t, 0.05);
    const g = flying ? (0.05 + near * 0.32) * (0.85 + Math.random() * 0.3) : 0;
    this.buzzGain.gain.setTargetAtTime(g, t, flying ? 0.04 : 0.02);
    if (this.pan) this.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, x)) * 0.85, t, 0.05);
  }

  _noiseBurst({ at = 0, dur = 0.08, type = 'bandpass', freq = 2000, q = 1, gain = 0.5, decay = 0.03 }) {
    const ctx = this.ctx, t = ctx.currentTime + at;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5, dur + 0.05);
    return { f, g, t };
  }

  _thump({ at = 0, f0 = 160, f1 = 60, dur = 0.09, gain = 0.6, type = 'sine' }) {
    const ctx = this.ctx, t = ctx.currentTime + at;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  whoosh() {
    if (!this.enabled) return;
    const b = this._noiseBurst({ dur: 0.12, type: 'bandpass', freq: 900, q: 0.8, gain: 0.18 });
    b.f.frequency.exponentialRampToValueAtTime(3500, b.t + 0.1);
  }

  // titanium + glass halves meeting, magnets pulling the last millimetres
  clack(soft = false) {
    if (!this.enabled) return;
    this._noiseBurst({ dur: 0.035, type: 'highpass', freq: 3200, q: 0.7, gain: soft ? 0.25 : 0.55 });
    this._noiseBurst({ dur: 0.06, type: 'bandpass', freq: 1500, q: 2.5, gain: soft ? 0.2 : 0.4 });
    this._thump({ f0: 210, f1: 70, dur: 0.08, gain: soft ? 0.35 : 0.7 });
    this._thump({ at: 0.004, f0: 2400, f1: 1800, dur: 0.025, gain: 0.12, type: 'triangle' });
  }

  squish() {
    if (!this.enabled) return;
    const b = this._noiseBurst({ at: 0.01, dur: 0.14, type: 'lowpass', freq: 700, q: 4, gain: 0.3 });
    b.f.frequency.exponentialRampToValueAtTime(180, b.t + 0.12);
    this._thump({ at: 0.0, f0: 120, f1: 50, dur: 0.12, gain: 0.25 });
  }

  unfold() {
    if (!this.enabled) return;
    const b = this._noiseBurst({ dur: 0.3, type: 'bandpass', freq: 500, q: 1.2, gain: 0.05 });
    b.f.frequency.exponentialRampToValueAtTime(1400, b.t + 0.28);
    this._thump({ at: 0.28, f0: 900, f1: 600, dur: 0.03, gain: 0.08, type: 'triangle' });
  }
}
