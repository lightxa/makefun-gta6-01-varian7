// police.js — the wanted system and the Solmar Bay Police Department.
// Stars rise with crimes and fade when the player stays clean and unseen.
// Patrol cars spawn at the edge of view and chase; on foot, officers chase
// and try to arrest. Getting caught costs cash and a trip to the hospital.
import { Rng } from './random.js';
import { roadXs, roadYs, clampToWorld, hitsBuilding } from './world.js';
import { TUNING } from './config.js';
import { makeCar } from './player.js';

const COP_MODEL = { name: 'SBPD Interceptor', color: '#1a1a22', top: 460, accel: 360, grip: 2.9 };

export class Police {
  constructor(seed) {
    this.rng = new Rng(seed + 991);
    this.wanted = 0;
    this.heat = 0;
    this.decayTimer = 0;
    this.spawnTimer = 0;
    this.copCars = [];
    this.officers = [];
    this.lastCrime = '';
    this.crimeTimer = 0;
  }

  addWanted(n, why) {
    const before = this.wanted;
    this.wanted = Math.min(5, this.wanted + n);
    this.heat = 1;
    this.decayTimer = TUNING.wantedDecaySeconds;
    if (this.wanted > before) {
      this.lastCrime = why || 'Crime reported';
      this.crimeTimer = 4;
    }
  }

  clearWanted() {
    this.wanted = 0;
    this.heat = 0;
    this.copCars = [];
    this.officers = [];
  }

  wantedTarget() {
    return this.wanted === 0 ? 0 : Math.min(2 + this.wanted, 7);
  }

  spawnCopCar(game) {
    const player = game.player;
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = 700;
    let x = player.x + Math.cos(angle) * dist;
    let y = player.y + Math.sin(angle) * dist;
    // Snap the spawn onto the nearest road so sirens arrive by street.
    const xs = roadXs();
    const ys = roadYs();
    let bestX = xs[0];
    let bestD = Infinity;
    for (const rx of xs) { const d = Math.abs(rx - x); if (d < bestD) { bestD = d; bestX = rx; } }
    let bestY = ys[0];
    bestD = Infinity;
    for (const ry of ys) { const d = Math.abs(ry - y); if (d < bestD) { bestD = d; bestY = ry; } }
    if (Math.abs(bestX - x) < Math.abs(bestY - y)) x = bestX + 17;
    else y = bestY + 17;
    const c = clampToWorld(x, y);
    const car = makeCar(c.x, c.y, COP_MODEL, Math.atan2(player.y - c.y, player.x - c.x));
    car.speed = 200;
    car.cop = true;
    this.copCars.push(car);
  }

  spawnOfficer(game) {
    const player = game.player;
    const angle = this.rng.range(0, Math.PI * 2);
    const x = player.x + Math.cos(angle) * 320;
    const y = player.y + Math.sin(angle) * 320;
    const c = clampToWorld(x, y);
    this.officers.push({ x: c.x, y: c.y, speed: 175, angle: 0, punchCooldown: 0 });
  }

  update(dt, game) {
    const player = game.player;
    this.crimeTimer = Math.max(0, this.crimeTimer - dt);
    if (this.wanted > 0) {
      this.decayTimer -= dt;
      if (this.decayTimer <= 0) {
        this.wanted = Math.max(0, this.wanted - 1);
        this.decayTimer = TUNING.wantedDecaySeconds;
        if (this.wanted === 0) this.clearWanted();
      }
    }
    const target = this.wantedTarget();
    this.spawnTimer -= dt;
    if (this.copCars.length + this.officers.length < target && this.spawnTimer <= 0 && this.wanted > 0) {
      this.spawnTimer = TUNING.policeSpawnDelay;
      if (player.onFoot && this.wanted <= 2 && this.rng.chance(0.45)) this.spawnOfficer(game);
      else this.spawnCopCar(game);
    }
    for (const car of this.copCars) this.updateCopCar(dt, car, game);
    for (const o of this.officers) this.updateOfficer(dt, o, game);
    // Prune cops that fell far behind.
    this.copCars = this.copCars.filter((c) => Math.hypot(c.x - player.x, c.y - player.y) < 2400);
    this.officers = this.officers.filter((o) => Math.hypot(o.x - player.x, o.y - player.y) < 1200);
  }

  updateCopCar(dt, car, game) {
    const player = game.player;
    const desired = Math.atan2(player.y - car.y, player.x - car.x);
    let diff = desired - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    const dist = Math.hypot(player.x - car.x, player.y - car.y);
    const targetSpeed = dist > 260 ? car.top : 300;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!hitsBuilding(game.world, nx, ny, 16)) {
      car.x = nx;
      car.y = ny;
    } else {
      car.speed *= 0.5;
      car.angle += 0.6 * dt * 10;
    }
    const c = clampToWorld(car.x, car.y);
    car.x = c.x;
    car.y = c.y;
    // Ram the player: on foot it hurts, in a car it shoves and slows.
    if (dist < 34) {
      if (player.onFoot) {
        player.hurt(TUNING.copTouchDamage, game);
        car.speed *= 0.4;
        if (player.health <= 0) return;
        // Busted when an officer catches the player standing still.
        if (player.health < 30 && this.wanted >= 1) game.onBusted();
      } else if (player.car) {
        player.car.speed *= 0.82;
        player.car.x += Math.cos(car.angle) * 26 * dt * 10;
        player.car.y += Math.sin(car.angle) * 26 * dt * 10;
        game.addSkid(car.x, car.y, car.angle);
      }
    }
  }

  updateOfficer(dt, o, game) {
    const player = game.player;
    o.punchCooldown = Math.max(0, o.punchCooldown - dt);
    const dist = Math.hypot(player.x - o.x, player.y - o.y);
    o.angle = Math.atan2(player.y - o.y, player.x - o.x);
    if (dist > 26) {
      const nx = o.x + Math.cos(o.angle) * o.speed * dt;
      const ny = o.y + Math.sin(o.angle) * o.speed * dt;
      if (!hitsBuilding(game.world, nx, o.y, 10)) o.x = nx;
      if (!hitsBuilding(game.world, o.x, ny, 10)) o.y = ny;
    } else if (player.onFoot && o.punchCooldown <= 0) {
      o.punchCooldown = 0.9;
      player.hurt(12, game);
      game.audio.punch();
      if (player.health <= 0) return;
      if (player.health < 25) game.onBusted();
    }
    const c = clampToWorld(o.x, o.y);
    o.x = c.x;
    o.y = c.y;
  }

  // The player struck an officer: that is a serious crime.
  officerHit() {
    this.addWanted(2, 'Assault on an officer');
  }
}
