// main.js — Solmar Bay: wires every system together and runs the loop.
// States: menu, playing, paused, busted, wasted. The loop is a fixed-clamp
// frame step so the game plays the same on any machine. A ?shot= URL
// parameter stages a scene for screenshots: the same game, the same code,
// just a chosen starting moment.
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Renderer } from './render.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { MissionRunner, TaxiJob, MISSIONS } from './missions.js';
import { generateWorld } from './world.js';
import { GAME_SEED, DISTRICTS, CAR_MODELS, TUNING } from './config.js';
import { Rng } from './random.js';
import { saveGame, loadGame, hasSave } from './save.js';

const canvas = document.getElementById('game');
const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const endEl = document.getElementById('endscreen');

class Game {
  constructor() {
    this.input = new Input();
    this.audio = new AudioSys();
    this.renderer = new Renderer(canvas);
    this.world = generateWorld(GAME_SEED);
    this.worldDistricts = DISTRICTS;
    this.rng = new Rng(GAME_SEED + 4242);
    this.player = new Player(1000, 260);
    this.traffic = new Traffic(this.world, GAME_SEED);
    this.police = new Police(GAME_SEED);
    this.missions = new MissionRunner();
    this.taxi = new TaxiJob();
    this.state = 'menu';
    this.time = 0;
    this.clock = 9 * 3600 + 24 * 60;
    this.toasts = [];
    this.skids = [];
    this.particles = [];
    this.missionIndex = 0;
    this.coinsTaken = 0;
    this.taxiDone = 0;
    this.footstepTimer = 0;
    this.endTitle = '';
    this.endBody = '';
    this.endKind = '';
    this.applyShotParam();
  }

  clockText() {
    const h = Math.floor(this.clock / 3600) % 24;
    const m = Math.floor(this.clock / 60) % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  toast(title, body) {
    this.toasts.push({ title, body, life: 3.2 });
    if (this.toasts.length > 3) this.toasts.shift();
    const el = document.getElementById('toast');
    if (el) {
      el.textContent = `${title} — ${body}`;
      el.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
    }
  }

  addSkid(x, y, angle) {
    this.skids.push({ x, y, angle });
    if (this.skids.length > 120) this.skids.shift();
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(30, 120);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, max: 0.5, size: 3, color });
    }
  }

  footstep(dt, sprint) {
    this.footstepTimer -= dt;
    if (this.footstepTimer <= 0) {
      this.footstepTimer = sprint ? 0.22 : 0.34;
      this.audio.blip(90 + this.rng.range(0, 20), 0.05, 'sine', 0.015);
    }
  }

  onCrash(speed) {
    this.audio.crash();
    this.burst(this.player.x, this.player.y, '#ffb0a8', 10);
    if (speed > 260 && this.player.onFoot === false) {
      this.player.car.health -= 6;
    }
  }

  tryPunch(attacker) {
    this.audio.punch();
    const range = TUNING.punchRange;
    const ax = attacker.x + Math.cos(attacker.angle) * range;
    const ay = attacker.y + Math.sin(attacker.angle) * range;
    // Hit an officer: the law answers.
    for (const o of this.police.officers) {
      if (Math.hypot(o.x - ax, o.y - ay) < 30) {
        this.police.officerHit();
        this.burst(o.x, o.y, '#ffd94a', 8);
        return;
      }
    }
    for (const ped of this.traffic.peds) {
      if (Math.hypot(ped.x - ax, ped.y - ay) < 30) {
        ped.flee = 3;
        ped.x += Math.cos(attacker.angle) * 30;
        ped.y += Math.sin(attacker.angle) * 30;
        this.burst(ped.x, ped.y, '#ffd94a', 6);
        this.police.addWanted(1, 'Assault reported');
        return;
      }
    }
    for (const car of this.traffic.cars) {
      if (!car.isPlayerCar && Math.hypot(car.x - ax, car.y - ay) < 34) {
        car.health -= TUNING.punchDamage;
        this.burst(car.x, car.y, '#ffb0a8', 6);
        return;
      }
    }
  }

  onBusted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.audio.busted();
    this.audio.setSiren(false, 0);
    const fine = Math.min(this.player.cash, 300);
    this.player.cash -= fine;
    this.player.health = 60;
    this.police.clearWanted();
    this.missions.fail(this, 'The cops got you. The job is blown.');
    this.endTitle = 'BUSTED';
    this.endBody = `The SBPD hauled you in. Fine: $${fine}. Marisol is not impressed.`;
    this.endKind = 'busted';
    this.showEnd();
    this.saveProgress();
  }

  onWasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.audio.busted();
    this.audio.setSiren(false, 0);
    this.player.cash = Math.floor(this.player.cash * 0.8);
    this.police.clearWanted();
    this.missions.fail(this, 'You got flattened. The job is blown.');
    this.endTitle = 'WASTED';
    this.endBody = 'Solmar General patched you up. You lost 20% of your cash.';
    this.endKind = 'wasted';
    this.showEnd();
    this.saveProgress();
  }

  showEnd() {
    if (endEl) {
      endEl.querySelector('#end-title').textContent = this.endTitle;
      endEl.querySelector('#end-body').textContent = this.endBody;
      endEl.classList.remove('hidden');
    }
  }

  hideEnd() {
    if (endEl) endEl.classList.add('hidden');
  }

  respawn() {
    this.hideEnd();
    this.player.x = this.world.hospital.x;
    this.player.y = this.world.hospital.y + 60;
    if (this.player.car) {
      this.player.car.isPlayerCar = false;
      this.player.car = null;
    }
    this.player.onFoot = true;
    this.player.health = 100;
    this.player.speed = 0;
    this.state = 'playing';
  }

  saveProgress() {
    saveGame({
      cash: this.player.cash,
      missionIndex: this.missionIndex,
      missionsDone: this.missions.completed,
      coinsTaken: this.coinsTaken,
      taxiDone: this.taxiDone,
      playerX: this.player.x,
      playerY: this.player.y,
    });
  }

  loadProgress() {
    const data = loadGame();
    if (!data) return false;
    this.player.cash = data.cash;
    this.missionIndex = Math.min(data.missionIndex || 0, MISSIONS.length - 1);
    this.missions.completed = data.missionsDone || [];
    this.coinsTaken = data.coinsTaken || 0;
    this.taxiDone = data.taxiDone || 0;
    if (typeof data.playerX === 'number') {
      this.player.x = data.playerX;
      this.player.y = data.playerY;
    }
    for (let i = 0; i < this.coinsTaken && i < this.world.coins.length; i++) {
      this.world.coins[i].taken = true;
    }
    return true;
  }

  startGame(fresh) {
    this.audio.ensure();
    if (fresh) {
      this.player.cash = 250;
      this.missionIndex = 0;
      this.missions = new MissionRunner();
      this.coinsTaken = 0;
      this.taxiDone = 0;
      for (const c of this.world.coins) c.taken = false;
      this.player.x = 1000;
      this.player.y = 260;
      this.player.health = 100;
    } else {
      this.loadProgress();
    }
    menuEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
    this.hideEnd();
    this.state = 'playing';
    this.toast('Welcome to Solmar Bay', 'Steal a car, take jobs from Marisol, stay ahead of the SBPD.');
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      pauseEl.classList.remove('hidden');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      pauseEl.classList.add('hidden');
    }
  }

  // Staged starts for screenshots: same game, chosen opening moment.
  applyShotParam() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (!shot) return;
    this.state = 'playing';
    menuEl.classList.add('hidden');
    if (shot === 'cover') {
      // Downtown chase: Rico in a Sunset Coupe, two stars, SBPD behind.
      const car = this.traffic.cars[0];
      car.model = CAR_MODELS[4];
      car.color = CAR_MODELS[4].color;
      car.name = CAR_MODELS[4].name;
      car.top = CAR_MODELS[4].top;
      car.accel = CAR_MODELS[4].accel;
      car.x = 2200; car.y = 600; car.angle = 0; car.speed = 300;
      this.player.enterCar(car, this);
      this.player.x = 2200; this.player.y = 600;
      this.police.wanted = 0;
      this.police.addWanted(2, 'Grand theft auto');
      this.police.spawnCopCar(this);
      this.police.spawnCopCar(this);
      this.missions.start(2, this);
      this.missions.stepIndex = 1;
      this.police.wanted = 2;
      this.police.decayTimer = 26;
    } else if (shot === 'street') {
      // On foot at the marina: palms, pedestrians, parked cars, beach light.
      this.player.x = 340;
      this.player.y = 620;
      this.player.angle = 0;
      this.clock = 17 * 3600 + 40 * 60;
    } else if (shot === 'mission') {
      // Harbor Heist in progress: hauler, timer, warehouse marker.
      const car = this.traffic.cars[1];
      car.model = CAR_MODELS[3];
      car.color = CAR_MODELS[3].color;
      car.name = CAR_MODELS[3].name;
      car.top = CAR_MODELS[3].top;
      car.x = 2600; car.y = 2050; car.angle = -Math.PI / 2; car.speed = 240;
      this.player.enterCar(car, this);
      this.missions.start(3, this);
      this.missions.stepIndex = 1;
      this.missions.stepTimer = 34;
      this.police.wanted = 0;
      this.police.addWanted(1, 'Suspicious hauler');
      this.police.spawnCopCar(this);
    } else if (shot === 'chase') {
      // Four stars on Palm Ave: five interceptors closing in.
      const car = this.traffic.cars[2];
      car.model = CAR_MODELS[4];
      car.color = CAR_MODELS[4].color;
      car.name = CAR_MODELS[4].name;
      car.top = CAR_MODELS[4].top;
      car.x = 1400; car.y = 1000; car.angle = 0; car.speed = 380;
      this.player.enterCar(car, this);
      this.police.wanted = 0;
      this.police.addWanted(4, 'High-speed pursuit');
      for (let i = 0; i < 4; i++) this.police.spawnCopCar(this);
      this.missions.start(4, this);
      this.police.wanted = 4;
      this.police.decayTimer = 26;
    }
    // Screenshots want a settled frame, not a camera still flying in: snap
    // the camera onto the player and clear the mission-start toast so the
    // first rendered frame already shows the staged scene.
    this.toasts = [];
    const toastEl = document.getElementById('toast');
    if (toastEl) toastEl.classList.remove('show');
    this.renderer.camX = Math.max(0, Math.min(3200 - window.innerWidth, this.player.x - window.innerWidth / 2));
    this.renderer.camY = Math.max(0, Math.min(2400 - window.innerHeight, this.player.y - window.innerHeight / 2));
  }

  update(dt) {
    this.time += dt;
    this.clock = (this.clock + dt * 12) % 86400;
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    this.input.endFrame();
    if (this.state !== 'playing') {
      this.audio.setEngine(0, false);
      this.audio.setSiren(false, this.time);
      return;
    }
    const input = this.input;
    if (input.hit('Escape') || input.hit('KeyP')) this.togglePause();
    if (input.hit('KeyM')) {
      const muted = this.audio.toggleMute();
      this.toast(muted ? 'Sound off' : 'Sound on', muted ? 'Press M to unmute.' : 'Engine, sirens and music live.');
    }
    // Enter / exit / interact.
    if (input.hit('KeyE')) {
      if (this.player.onFoot) {
        const near = this.traffic.nearestCar(this.player.x, this.player.y, 64);
        if (near) {
          this.player.enterCar(near, this);
        } else if (this.missions.active === null && this.missionIndex < MISSIONS.length) {
          const d = Math.hypot(this.player.x - this.world.garage.x, this.player.y - this.world.garage.y);
          if (d < 110) {
            this.missions.start(this.missionIndex, this);
          } else {
            this.toast('No car nearby', 'Walk up to a car and press E to take it.');
          }
        }
      } else {
        this.player.exitCar(this);
      }
    }
    // Start the next job from anywhere near its marker when on foot.
    if (this.missions.active === null && this.missionIndex < MISSIONS.length && this.player.onFoot) {
      const g = this.world.garage;
      if (Math.hypot(this.player.x - g.x, this.player.y - g.y) < 110) {
        this.toast('Job available', 'Press E at the garage to start: ' + MISSIONS[this.missionIndex].title);
      }
    }
    this.player.update(dt, input, this.world, this);
    this.traffic.update(dt, this);
    this.police.update(dt, this);
    this.missions.update(dt, this);
    this.taxi.update(dt, this);
    // Mission completion advances the story index.
    if (this.missions.active === null && this.missions.completed.length > this.missionIndex) {
      this.missionIndex = this.missions.completed.length;
      this.saveProgress();
    }
    // Bay coins.
    for (const c of this.world.coins) {
      if (!c.taken && Math.hypot(this.player.x - c.x, this.player.y - c.y) < 30) {
        c.taken = true;
        this.coinsTaken++;
        this.player.cash += TUNING.coinValue;
        this.audio.coin();
        this.toast('Bay coin!', `+$${TUNING.coinValue}. ${this.coinsTaken} of ${TUNING.coinCount} found.`);
        this.saveProgress();
      }
    }
    // Player car hitting a pedestrian is a crime.
    if (!this.player.onFoot && Math.abs(this.player.speed) > 120) {
      for (const ped of this.traffic.peds) {
        if (Math.hypot(ped.x - this.player.x, ped.y - this.player.y) < 26) {
          ped.flee = 3;
          this.police.addWanted(1, 'Pedestrian struck');
          this.burst(ped.x, ped.y, '#ffb0a8', 8);
          break;
        }
      }
    }
    // Taxi flag: a passenger waits near the plaza when no job runs.
    if (!this.taxi.active && this.rng.chance(dt * 0.02)) {
      this.taxi.start(1590 + this.rng.range(-60, 60), 790 + this.rng.range(-60, 60), this.rng);
      this.toast('Taxi fare', 'A passenger waits at Solmar Plaza. Drive over to pick them up.');
    }
    this.audio.setSiren(this.police.wanted > 0 && this.police.copCars.length > 0, this.time);
    this.audio.updateMusic(dt, true);
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this._last) / 1000 || 0.016);
    this._last = now;
    this.update(dt);
    if (this.renderer.canvas.width !== window.innerWidth || this.renderer.canvas.height !== window.innerHeight) {
      this.renderer.resize(window.innerWidth, window.innerHeight);
    }
    this.renderer.draw(this);
    requestAnimationFrame((t) => this.frame(t));
  }

  run() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', () => {
      this.renderer.resize(window.innerWidth, window.innerHeight);
    });
    document.getElementById('start-btn').addEventListener('click', () => this.startGame(true));
    const contBtn = document.getElementById('continue-btn');
    if (hasSave()) {
      contBtn.classList.remove('hidden');
      contBtn.addEventListener('click', () => this.startGame(false));
    }
    document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('save-btn').addEventListener('click', () => {
      this.saveProgress();
      this.toast('Saved', 'Progress saved. Come back any time.');
    });
    document.getElementById('restart-btn').addEventListener('click', () => this.respawn());
    document.getElementById('menu-btn').addEventListener('click', () => {
      pauseEl.classList.add('hidden');
      this.state = 'menu';
      menuEl.classList.remove('hidden');
    });
    document.getElementById('quit-btn').addEventListener('click', () => {
      this.saveProgress();
      pauseEl.classList.add('hidden');
      this.state = 'menu';
      menuEl.classList.remove('hidden');
    });
    this._last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }
}

const game = new Game();
window.SOLMAR = game;
game.run();
