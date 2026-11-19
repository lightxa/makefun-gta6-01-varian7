// Sound for Solmar Bay, synthesized live with the Web Audio API: no audio
// files, no network, just oscillators and filtered noise. Everything is guarded
// so the game plays silently when audio is unavailable.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.muted = false;
  }

  // Create the audio context on the first user gesture; browsers require one.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.startEngineHum();
      this.startSiren();
    } catch (err) {
      this.ctx = null;
    }
  }

  // A low engine hum whose pitch follows the player's speed.
  startEngineHum() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  // A two-tone siren that only sounds while the police are after the player.
  startSiren() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenTimer = 0;
  }

  // Per-frame audio: engine pitch from speed, siren wail from wanted level.
  update(speed, wanted, dt) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (this.engineOsc) {
      const rpm = 55 + Math.abs(speed) * 0.16;
      this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
      this.engineGain.gain.setTargetAtTime(Math.abs(speed) > 20 ? 0.05 : 0.0, t, 0.1);
    }
    if (this.sirenOsc) {
      this.sirenTimer = (this.sirenTimer || 0) + dt;
      const tone = Math.sin(this.sirenTimer * 4.4) > 0 ? 880 : 660;
      this.sirenOsc.frequency.setTargetAtTime(tone, t, 0.05);
      this.sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.045 : 0.0, t, 0.2);
    }
  }

  // A short noise burst: the gunshot.
  shot() {
    this.noiseBurst(0.12, 0.5, 1800);
  }

  // A dull thud: a punch landing or a car bump.
  thud() {
    this.noiseBurst(0.09, 0.4, 300);
  }

  // A bright two-note chime: a checkpoint or a mission payout.
  chime() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [660, 990].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22, t + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.35);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.4);
    });
  }

  // A filtered noise burst of a given length, volume and filter frequency.
  noiseBurst(length, volume, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * length), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }
}
