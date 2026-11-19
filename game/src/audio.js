// Synthesised sound: no audio files, everything is generated with the
// Web Audio API — engine hum, sirens, gunshots, punches and cash chimes.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.muted = false;
    this.sirenOn = false;
    this.ready = false;
  }

  ensure() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.ready = true;
    } catch {
      this.ready = false;
    }
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  engine(speedRatio, driving) {
    if (!this.ready || !this.engineOsc) return;
    const target = driving ? 0.05 + Math.abs(speedRatio) * 0.11 : 0;
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + Math.abs(speedRatio) * 130, this.ctx.currentTime, 0.08);
  }

  siren(wanted, t) {
    if (!this.ready || !this.sirenOsc) return;
    const on = wanted > 0;
    if (on !== this.sirenOn) this.sirenOn = on;
    const target = on && !this.muted ? 0.045 : 0;
    this.sirenGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
    if (on) {
      const f = Math.sin(t * 3.2) > 0 ? 720 : 540;
      this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    }
  }

  blip(freq, dur, type, vol) {
    if (!this.ready || this.muted) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.value = vol || 0.12;
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (dur || 0.12));
      o.connect(g);
      g.connect(this.master);
      o.start();
      o.stop(this.ctx.currentTime + (dur || 0.12));
    } catch { /* sound is optional */ }
  }

  noise(dur, vol, lowpass) {
    if (!this.ready || this.muted) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.2;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass || 1200;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start();
    } catch { /* sound is optional */ }
  }

  pickup() { this.blip(880, 0.1, 'sine', 0.14); setTimeout(() => this.blip(1320, 0.12, 'sine', 0.12), 70); }
  cash() {
    this.blip(660, 0.09, 'sine', 0.14);
    setTimeout(() => this.blip(880, 0.09, 'sine', 0.14), 80);
    setTimeout(() => this.blip(1320, 0.16, 'sine', 0.14), 160);
  }
  gunshot() { this.noise(0.16, 0.3, 900); }
  punch() { this.noise(0.09, 0.22, 500); }
  crash() { this.noise(0.22, 0.25, 350); }
  horn() { this.blip(370, 0.18, 'square', 0.08); }
  busted() {
    this.blip(220, 0.3, 'sawtooth', 0.14);
    setTimeout(() => this.blip(165, 0.4, 'sawtooth', 0.14), 220);
  }
}
