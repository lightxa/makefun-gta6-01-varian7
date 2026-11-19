// Synthesised sound for Solmar Bay: no audio files at all.
// Everything is generated with the Web Audio API — engine hum, sirens,
// punches, cash chimes and mission jingles. All calls are guarded so the
// game runs silently (and safely) when audio is unavailable.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  resume() {
    if (this.ensure() && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  tone(freq, duration, type, volume, slideTo) {
    if (!this.ensure() || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);
      gain.gain.setValueAtTime(volume || 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    } catch {
      // Sound is cosmetic; never let it break the game.
    }
  }

  noise(duration, volume, lowpass) {
    if (!this.ensure() || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = volume || 0.25;
      let node = src;
      if (lowpass) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = lowpass;
        src.connect(filter);
        node = filter;
      }
      node.connect(gain);
      gain.connect(this.master);
      src.start(t);
    } catch {
      // Ignore audio failures.
    }
  }

  punch() {
    this.noise(0.12, 0.4, 900);
    this.tone(90, 0.1, 'square', 0.15, 50);
  }

  crash() {
    this.noise(0.3, 0.5, 500);
    this.tone(70, 0.25, 'sawtooth', 0.2, 40);
  }

  chime() {
    this.tone(880, 0.12, 'sine', 0.22);
    setTimeout(() => this.tone(1318, 0.18, 'sine', 0.22), 90);
  }

  missionJingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.22, 'triangle', 0.25), i * 110));
  }

  failBuzz() {
    this.tone(220, 0.3, 'sawtooth', 0.18, 110);
  }

  setEngine(speedRatio, active) {
    if (!this.ensure() || this.muted) {
      this.stopEngine();
      return;
    }
    try {
      if (!active || speedRatio <= 0.02) {
        this.stopEngine();
        return;
      }
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.03;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      this.engineOsc.frequency.value = 55 + speedRatio * 130;
      this.engineGain.gain.value = 0.025 + speedRatio * 0.05;
    } catch {
      this.stopEngine();
    }
  }

  stopEngine() {
    try {
      if (this.engineOsc) this.engineOsc.stop();
    } catch {
      // Already stopped.
    }
    this.engineOsc = null;
    this.engineGain = null;
  }

  setSiren(on, dt) {
    if (!this.ensure() || this.muted || !on) {
      if (this.sirenOsc) {
        try { this.sirenOsc.stop(); } catch { /* already stopped */ }
        this.sirenOsc = null;
        this.sirenGain = null;
      }
      return;
    }
    try {
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.045;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        this.sirenTimer = 0;
      }
      this.sirenTimer += dt || 0.016;
      const phase = Math.floor(this.sirenTimer / 0.45) % 2;
      this.sirenOsc.frequency.value = phase === 0 ? 720 : 960;
    } catch {
      this.sirenOsc = null;
    }
  }
}
