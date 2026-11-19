// audio.js — every sound is synthesized with WebAudio: no audio files,
// no network, just oscillators and noise shaped into engine, siren and
// effects, plus a small bass loop that keeps the bay feeling sunny.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.musicTimer = 0;
    this.musicStep = 0;
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
    } catch (err) {
      this.ctx = null;
    }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.sirenGain) this.sirenGain.gain.value = 0;
    return this.muted;
  }
  setEngine(rpm, driving) {
    if (!this.ctx || this.muted) return;
    const target = driving ? 0.045 + rpm * 0.05 : 0.012;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + rpm * 130, this.ctx.currentTime, 0.08);
  }
  setSiren(on, t) {
    if (!this.ctx) return;
    this.sirenOn = on;
    if (this.muted || !on) {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    const f = 620 + Math.sin(t * 5.2) * 220;
    this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    this.sirenGain.gain.setTargetAtTime(0.02, this.ctx.currentTime, 0.1);
  }
  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.06, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + dur);
    } catch (err) { /* sound is decoration, never fatal */ }
  }
  punch() { this.blip(120, 0.12, 'sawtooth', 0.09); }
  coin() { this.blip(880, 0.09, 'sine', 0.07); this.blip(1320, 0.14, 'sine', 0.05); }
  crash() { this.blip(70, 0.25, 'sawtooth', 0.12); }
  jingle() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.22, 'triangle', 0.08), i * 110);
    });
  }
  busted() {
    [392, 330, 262].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.3, 'triangle', 0.08), i * 180);
    });
  }
  // A lazy bass-and-hat loop: four bars of a sunny bay groove.
  updateMusic(dt, playing) {
    if (!this.ctx || this.muted || !playing) return;
    this.musicTimer += dt;
    const stepDur = 0.21;
    while (this.musicTimer >= stepDur) {
      this.musicTimer -= stepDur;
      const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
      const note = bass[this.musicStep % bass.length];
      this.blip(note, 0.19, 'triangle', 0.035);
      if (this.musicStep % 2 === 0) this.blip(6000, 0.03, 'square', 0.008);
      this.musicStep++;
    }
  }
}
