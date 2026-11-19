// SOLMAR BAY — game orchestration: the loop, camera, states (title,
// playing, paused, busted), crime and combat handlers, mission wiring,
// saving, and the deterministic screenshot modes (?shot=cover|street|
// mission|chase) that stage a real gameplay moment for the camera.
import { WORLD_W, WORLD_H, TUNING, CAR_MODELS, districtAt } from './config.js';
import { makeRng, clamp, dist, angleTo } from './random.js';
import { buildWorld, nearestRoadPoint } from './world.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { spawnTraffic, spawnPedestrians, updateTraffic, updatePedestrians, makeTrafficCar } from './traffic.js';
import { Police } from './police.js';
import { MissionManager } from './missions.js';
import { AudioEngine } from './audio.js';
import { Renderer } from './render.js';
import { saveGameState, loadGameState, hasSave } from './save.js';

const params = new URLSearchParams(window.location.search);
const SEED = Number(params.get('seed') || 7) || 7;
const SHOT = params.get('shot') || '';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.input = new Input(this.canvas);
    this.audio = new AudioEngine();
    this.world = buildWorld(SEED);
    this.rng = makeRng(SEED ^ 0xBEEF);
    this.player = new Player(480, 480);
    this.police = new Police(SEED);
    this.missions = new MissionManager();
    this.traffic = spawnTraffic(SEED, TUNING.trafficCount);
    this.peds = spawnPedestrians(SEED, TUNING.pedCount);
    this.particles = [];
    this.parkedCars = this.spawnParkedCars();
    this.missionCar = this.parkedCars[0];
    this.state = 'title';
    this.time = 0;
    this.bestScore = 0;
    this.bustedLoss = 0;
    this.hasSaveData = hasSave();
    this.escapeArmed = false;
    this.scoreArmed = false;
    this.cam = { x: this.player.x, y: this.player.y, zoom: 1 };
    this.autoDrive = false;
    this.last = performance.now();
    this.frame = 0;
    this.ready = false;
    const saved = loadGameState();
    if (saved && typeof saved.bestScore === 'number') this.bestScore = saved.bestScore;
    this.missions.start(0);
  }

  spawnParkedCars() {
    const spots = [
      { model: 'Comet GT', color: '#e8c33d', x: 1470, y: 830, angle: 0 },
      { model: 'Sedan', color: '#3d7dd9', x: 830, y: 510, angle: Math.PI / 2 },
      { model: 'Pickup', color: '#4ad97b', x: 2110, y: 1150, angle: Math.PI },
      { model: 'Van', color: '#e8e8e8', x: 510, y: 1470, angle: -Math.PI / 2 },
      { model: 'Taxi', color: '#f2c230', x: 2750, y: 1790, angle: Math.PI },
      { model: 'Sedan', color: '#d97bb0', x: 1790, y: 510, angle: 0 },
      { model: 'Pinto', color: '#7bd9d0', x: 1150, y: 2110 - 60, angle: Math.PI / 2 },
      { model: 'Pickup', color: '#f08a2d', x: 2430, y: 830, angle: -Math.PI / 2 },
    ];
    return spots.map((s, i) => ({
      id: 1000 + i, kind: 'parked', model: s.model, color: s.color,
      x: s.x, y: s.y, angle: s.angle, speed: 0,
      top: (CAR_MODELS.find((m) => m.name === s.model) || CAR_MODELS[1]).top,
      w: 46, h: 22,
    }));
  }

  startNew() {
    this.player.reset(480, 480);
    this.player.cash = TUNING.startingCash;
    this.player.ammo = TUNING.startingAmmo;
    this.player.score = 0;
    this.police.clear();
    this.missions.start(0);
    this.escapeArmed = false;
    this.scoreArmed = false;
    this.state = 'playing';
    this.audio.resume();
  }

  continueSave() {
    const s = loadGameState();
    if (!s) { this.startNew(); return; }
    this.player.reset(s.x || 480, s.y || 480);
    this.player.cash = s.cash ?? TUNING.startingCash;
    this.player.ammo = s.ammo ?? TUNING.startingAmmo;
    this.player.score = s.score || 0;
    this.player.health = s.health ?? 100;
    this.police.clear();
    this.missions.start(s.missionIndex || 0);
    this.missions.stepIndex = s.stepIndex || 0;
    this.escapeArmed = false;
    this.scoreArmed = false;
    this.state = 'playing';
    this.audio.resume();
  }

  saveGame() {
    const p = this.player;
    this.bestScore = Math.max(this.bestScore, p.score);
    saveGameState({
      missionIndex: this.missions.index,
      stepIndex: this.missions.stepIndex,
      cash: p.cash, health: p.health, ammo: p.ammo, score: p.score,
      x: Math.round(p.x), y: Math.round(p.y), bestScore: this.bestScore,
    });
  }

  crime(kind, target) {
    if (kind === 'hitPedestrian') {
      this.police.addHeat(20);
      this.missions.showMessage('You hit a pedestrian! The police are coming.', 4);
      this.burst(target.x, target.y, '#e85d75', 10);
      this.audio.crash();
    } else if (kind === 'steal') {
      this.police.addHeat(25);
      this.missions.showMessage('Car stolen! Wanted level up.', 4);
    } else if (kind === 'shoot') {
      this.police.addHeat(10);
    } else if (kind === 'punchCop') {
      this.police.addHeat(30);
      this.missions.showMessage('You hit an officer! Wanted level up.', 4);
    }
  }

  crashSound() {
    this.audio.crash();
  }

  burst(x, y, color, n) {
    for (let i = 0; i < (n || 8); i++) {
      const a = this.rng.next() * Math.PI * 2;
      const sp = this.rng.range(40, 160);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.6, max: 0.6, r: this.rng.range(2, 5), color,
      });
    }
  }

  punch(p) {
    this.audio.punch();
    const fx = p.x + Math.cos(p.angle) * 30;
    const fy = p.y + Math.sin(p.angle) * 30;
    this.burst(fx, fy, '#ffffff', 4);
    // Hit a pedestrian.
    for (const ped of this.peds) {
      if (ped.down) continue;
      if (dist(fx, fy, ped.x, ped.y) < 34) {
        ped.down = true;
        ped.downTimer = 8;
        this.police.addHeat(15);
        this.missions.showMessage('You knocked someone down! Wanted level up.', 3);
        return;
      }
    }
    // Hit a foot cop.
    for (let i = 0; i < this.police.cops.length; i++) {
      const cop = this.police.cops[i];
      if (dist(fx, fy, cop.x, cop.y) < 36) {
        cop.health -= 34;
        this.burst(cop.x, cop.y, '#2d5a8a', 8);
        if (cop.health <= 0) {
          this.police.cops.splice(i, 1);
          this.police.addHeat(15);
          this.missions.showMessage('Officer down. That will not help your case.', 3);
        } else {
          this.crime('punchCop');
        }
        return;
      }
    }
  }

  shoot(p) {
    this.audio.gunshot();
    this.crime('shoot');
    const range = 340;
    const fx = p.x + Math.cos(p.angle) * range;
    const fy = p.y + Math.sin(p.angle) * range;
    this.particles.push({
      x: p.x, y: p.y, vx: (fx - p.x) * 0.05, vy: (fy - p.y) * 0.05,
      life: 0.12, max: 0.12, r: 3, color: '#ffd94d',
    });
    // Nearest target roughly in the firing line.
    let best = null;
    let bestD = range;
    const consider = (x, y) => {
      const d = dist(p.x, p.y, x, y);
      if (d > range) return;
      const a = Math.abs(((angleTo(p.x, p.y, x, y) - p.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (a < 0.35 && d < bestD) { bestD = d; best = { x, y }; }
    };
    for (const ped of this.peds) if (!ped.down) consider(ped.x, ped.y);
    for (const cop of this.police.cops) consider(cop.x, cop.y);
    if (best) {
      this.burst(best.x, best.y, '#ff6b5e', 10);
      for (const ped of this.peds) {
        if (!ped.down && dist(best.x, best.y, ped.x, ped.y) < 4) { ped.down = true; ped.downTimer = 10; }
      }
      for (let i = 0; i < this.police.cops.length; i++) {
        if (dist(best.x, best.y, this.police.cops[i].x, this.police.cops[i].y) < 4) {
          this.police.cops[i].health -= 55;
          if (this.police.cops[i].health <= 0) this.police.cops.splice(i, 1);
        }
      }
    }
  }

  tryEnterCar() {
    const p = this.player;
    if (p.inCar) {
      const car = p.car;
      p.exitCar();
      if (car && car.kind !== 'police') {
        car.speed = 0;
        this.parkedCars.push(car);
      }
      return;
    }
    const all = [...this.parkedCars, ...this.traffic];
    const car = p.nearestCar(all, 78);
    if (!car) return;
    if (car.kind === 'parked') this.parkedCars = this.parkedCars.filter((c) => c !== car);
    else this.traffic = this.traffic.filter((c) => c !== car);
    const wasMissionCar = car === this.missionCar;
    p.enterCar(car, this.police);
    this.audio.horn();
    if (car.kind === 'traffic' || wasMissionCar) {
      this.crime('steal');
      if (wasMissionCar) this.missions.completeStep(this);
    }
  }

  onBusted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.bustedLoss = Math.floor(this.player.cash * 0.15);
    this.player.cash -= this.bustedLoss;
    this.audio.busted();
    this.audio.engine(0, false);
    this.saveGame();
  }

  respawnAfterBusted() {
    this.player.reset(480, 1760);
    this.player.health = 100;
    this.police.clear();
    this.state = 'playing';
  }

  update(dt) {
    this.time += dt;
    // Mission 4 arming: the escape job starts with a three-star tail.
    if (this.missions.current && this.missions.current.id === 4 && !this.escapeArmed) {
      this.escapeArmed = true;
      this.police.setWanted(3);
      this.missions.showMessage('Three stars! Lose the tail and stay hidden.', 5);
    }
    if (!this.missions.current || this.missions.current.id !== 4) this.escapeArmed = false;
    // Mission 5 arming: grabbing the bank cash trips the alarm.
    if (this.missions.index === 4 && this.missions.stepIndex === 1 && !this.scoreArmed) {
      this.scoreArmed = true;
      this.police.setWanted(4);
      this.missions.showMessage('The alarm is up! Run for Pier 4!', 5);
    }
    if (this.missions.index !== 4) this.scoreArmed = false;

    const p = this.player;
    // In screenshot modes the car keeps driving itself (W held) so the
    // staged chase stays in motion instead of coasting to a stop.
    const demoInput = {
      axis: () => ({ x: 0, y: -1 }),
      down: () => false,
      wasPressed: () => false,
    };
    const input = this.autoDrive ? demoInput : this.input;
    if (this.state === 'playing') {
      if (input.wasPressed('KeyE')) this.tryEnterCar();
      if (p.inCar) p.updateDriving(dt, input, this.world, this);
      else p.updateOnFoot(dt, input, this.world, this);
      // Player car bumps traffic cars.
      if (p.inCar && p.car) {
        for (const car of this.traffic) {
          if (dist(p.car.x, p.car.y, car.x, car.y) < 52) {
            car.speed *= 0.6;
            p.car.speed *= 0.88;
            this.burst((p.car.x + car.x) / 2, (p.car.y + car.y) / 2, '#ffd94d', 5);
          }
        }
      }
      updateTraffic(this.traffic, dt, p, this.rng);
      updatePedestrians(this.peds, dt, p, this.rng);
      this.police.update(dt, p, () => this.onBusted());
      this.missions.update(dt, this);
      // Health slowly recovers when not wanted.
      if (this.police.stars === 0 && p.health > 0 && p.health < 100) p.heal(2.2 * dt);
      // Pick up an ammo crate now and then near the player.
      if (this.ammoCrate && dist(p.x, p.y, this.ammoCrate.x, this.ammoCrate.y) < 34) {
        p.ammo += 12;
        this.missions.showMessage('Picked up ammo (+12).', 3);
        this.audio.pickup();
        this.ammoCrate = null;
      }
      if (!this.ammoCrate && this.rng.chance(dt * 0.02)) {
        const spot = nearestRoadPoint(p.x + this.rng.range(-300, 300), p.y + this.rng.range(-300, 300));
        this.ammoCrate = { x: spot.x, y: spot.y };
      }
      // Particles.
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.life <= 0) this.particles.splice(i, 1);
      }
      // Camera follows the player, clamped inside the city so the view
      // never shows the void past the map edge.
      const targetZoom = p.inCar ? 0.92 : 1.0;
      this.cam.zoom += (targetZoom - this.cam.zoom) * Math.min(1, dt * 2);
      this.cam.x += (p.x - this.cam.x) * Math.min(1, dt * 5);
      this.cam.y += (p.y - this.cam.y) * Math.min(1, dt * 5);
      const hw = this.canvas.width / 2 / this.cam.zoom;
      const hh = this.canvas.height / 2 / this.cam.zoom;
      this.cam.x = clamp(this.cam.x, hw, WORLD_W - hw);
      this.cam.y = clamp(this.cam.y, hh, WORLD_H - hh);
      // Staged chase speed cap so the car does not outrun its own shot.
      if (this.autoDrive && p.inCar && p.car) p.car.speed = Math.min(p.car.speed, 230);
      // Sound.
      this.audio.engine(p.inCar ? p.speed / 300 : 0, p.inCar);
      this.audio.siren(this.police.stars, this.time);
    }
    if (input.wasPressed('KeyM')) this.audio.setMuted(!this.audio.muted);
    if (input.wasPressed('KeyS') && this.state === 'playing') {
      this.saveGame();
      this.missions.showMessage('Game saved.', 2);
    }
    if (input.wasPressed('KeyR') && this.state === 'playing') {
      if (this.missions.failed) this.missions.retry();
      else if (p.inCar && p.car) {
        const spot = nearestRoadPoint(p.car.x, p.car.y);
        p.car.x = spot.x;
        p.car.y = spot.y;
        p.car.speed = 0;
        p.x = spot.x;
        p.y = spot.y;
      }
    }
    if (input.wasPressed('Escape') && (this.state === 'playing' || this.state === 'paused')) {
      this.state = this.state === 'playing' ? 'paused' : 'playing';
    }
    if (this.state === 'paused' && input.wasPressed('KeyQ')) {
      this.state = 'title';
      this.hasSaveData = hasSave();
    }
    if (this.state === 'title') {
      if (input.wasPressed('Enter') || input.mouseClicked) this.startNew();
      else if (input.wasPressed('KeyC') && this.hasSaveData) this.continueSave();
    }
    if (this.state === 'busted' && (input.wasPressed('Enter') || input.mouseClicked)) {
      this.respawnAfterBusted();
    }
    if (this.missions.done && this.state === 'playing' && input.wasPressed('Enter')) {
      this.missions.showMessage('Free roam — Solmar Bay is yours.', 4);
      this.missions.done = false;
      this.missions.index = MISSIONS_LEN;
    }
    this.input.endFrame();
  }

  render() {
    this.renderer.draw(this, this.cam);
    this.frame += 1;
    if (!this.ready) {
      this.ready = true;
      window.__solmarReady = true;
    }
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.update(dt);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  simulate(seconds) {
    const steps = Math.round(seconds * 60);
    for (let i = 0; i < steps; i++) this.update(1 / 60);
  }

  // Keep the staged chase clear of a traffic pile-up right on the player.
  clearTrafficNearPlayer(r) {
    const p = this.player;
    this.traffic = this.traffic.filter((c) => dist(c.x, c.y, p.x, p.y) > r);
  }

  applyShot() {
    const p = this.player;
    if (SHOT === 'cover') {
      this.state = 'playing';
      this.missions.start(2);
      this.missions.stepIndex = 1;
      this.missions.stepTimer = 70;
      const car = this.missionCar;
      this.parkedCars = this.parkedCars.filter((c) => c !== car);
      p.enterCar(car, this.police);
      car.x = 1440; car.y = 480; car.angle = Math.PI / 2; car.speed = 200;
      p.x = 1440; p.y = 480;
      this.police.setWanted(3);
      this.police.spawnPoliceCar(1440, 160);
      this.police.spawnPoliceCar(1120, 480);
      this.cam.x = 1440; this.cam.y = 480;
      this.autoDrive = true;
      this.simulate(2.5);
      this.clearTrafficNearPlayer(280);
      if (p.car) p.car.speed = 230;
      p.health = 100;
    } else if (SHOT === 'street') {
      this.state = 'playing';
      this.missions.start(0);
      p.reset(2720, 520);
      p.angle = Math.PI / 2;
      this.cam.x = 2720; this.cam.y = 520;
      this.simulate(2);
    } else if (SHOT === 'mission') {
      this.state = 'playing';
      this.missions.start(2);
      this.missions.stepIndex = 1;
      this.missions.stepTimer = 68;
      const car = this.missionCar;
      this.parkedCars = this.parkedCars.filter((c) => c !== car);
      p.enterCar(car, this.police);
      car.x = 2400; car.y = 800; car.angle = Math.PI; car.speed = 200;
      p.x = 2400; p.y = 800;
      this.police.setWanted(1);
      this.cam.x = 2400; this.cam.y = 800;
      this.autoDrive = true;
      this.simulate(2);
      this.clearTrafficNearPlayer(280);
      if (p.car) p.car.speed = 230;
      p.health = 100;
    } else if (SHOT === 'chase') {
      this.state = 'playing';
      this.missions.start(4);
      this.missions.stepIndex = 1;
      const car = this.missionCar;
      this.parkedCars = this.parkedCars.filter((c) => c !== car);
      p.enterCar(car, this.police);
      car.x = 1100; car.y = 2080; car.angle = 0; car.speed = 220;
      p.x = 1100; p.y = 2080;
      this.police.setWanted(4);
      this.police.spawnPoliceCar(800, 2080);
      this.police.spawnPoliceCar(1400, 2080);
      this.police.spawnPoliceCar(950, 1760);
      this.cam.x = 1100; this.cam.y = 2080;
      this.autoDrive = true;
      this.simulate(2);
      this.clearTrafficNearPlayer(280);
      if (p.car) p.car.speed = 230;
      p.health = 100;
    }
  }
}

const MISSIONS_LEN = 5;

const game = new Game();
if (SHOT) game.applyShot();

window.__game = game;
window.__solmar = {
  state: () => game.state,
  player: () => ({
    x: Math.round(game.player.x), y: Math.round(game.player.y),
    health: Math.round(game.player.health), cash: game.player.cash,
    inCar: game.player.inCar, speed: Math.round(game.player.speed || 0),
    ammo: game.player.ammo,
  }),
  police: () => ({ stars: game.police.stars, heat: Math.round(game.police.heat), cars: game.police.cars.length, cops: game.police.cops.length }),
  mission: () => ({
    index: game.missions.index, step: game.missions.stepIndex,
    objective: game.missions.objective, done: game.missions.done, failed: game.missions.failed,
  }),
  counts: () => ({ traffic: game.traffic.length, peds: game.peds.length, parked: game.parkedCars.length }),
  start: () => game.startNew(),
  teleport: (x, y) => {
    game.player.x = x; game.player.y = y;
    if (game.player.inCar && game.player.car) { game.player.car.x = x; game.player.car.y = y; }
    game.cam.x = x; game.cam.y = y;
  },
  setWanted: (n) => game.police.setWanted(n),
  startMission: (i) => game.missions.start(i),
};

requestAnimationFrame((t) => game.loop(t));
