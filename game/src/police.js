// Wanted level and police. Crimes raise heat; heat sets the star count;
// police cars and foot cops spawn to match the stars and chase the player.
// Break line of sight and stay hidden and the heat bleeds away.
import { TUNING } from './config.js';
import { makeRng, clamp, dist, angleTo, angleDiff } from './random.js';
import { ROADS_X, ROADS_Y } from './config.js';
import { nearestRoadPoint } from './world.js';

export class Police {
  constructor(seed) {
    this.rng = makeRng(seed ^ 0xC0FFEE);
    this.heat = 0;
    this.stars = 0;
    this.hiddenTimer = 0;
    this.cars = [];
    this.cops = [];
    this.sirenPhase = 0;
    // Reinforcements only arrive while the player was recently seen or a
    // crime just happened; once the player is hidden the tail goes cold
    // instead of respawning forever, so the wanted level can actually fall.
    this.spawnCooldown = 0;
    this.recentCrimeTimer = 0;
  }

  addHeat(amount) {
    this.heat = clamp(this.heat + amount, 0, 100);
    this.stars = Math.min(TUNING.maxWanted, Math.ceil(this.heat / 20));
    if (this.stars === 0 && this.heat > 0) this.stars = 1;
    this.recentCrimeTimer = 10;
  }

  setWanted(stars) {
    this.heat = stars * 20;
    this.stars = stars;
    this.recentCrimeTimer = 10;
  }

  clear() {
    this.heat = 0;
    this.stars = 0;
    this.cars = [];
    this.cops = [];
    this.hiddenTimer = 0;
  }

  wantedCount() {
    if (this.stars <= 1) return 1;
    if (this.stars === 2) return 1;
    if (this.stars === 3) return 2;
    if (this.stars === 4) return 3;
    return 4;
  }

  spawnPoliceCar(px, py) {
    // Spawn on a road, off-screen from the player.
    for (let tries = 0; tries < 12; tries++) {
      const vertical = this.rng.chance(0.5);
      const road = vertical ? this.rng.pick(ROADS_X) : this.rng.pick(ROADS_Y);
      const along = this.rng.range(120, 2060);
      const x = vertical ? road : along;
      const y = vertical ? along : road;
      const d = dist(x, y, px, py);
      // Spawn within the give-up radius (1100) or the same frame's filter
      // would remove the car at once; keep it off-screen but reachable.
      if (d < 620 || d > 1000) continue;
      const angle = Math.atan2(py - y, px - x);
      this.cars.push({
        kind: 'police', color: '#20242e', model: 'Interceptor',
        x, y, angle, speed: 0, top: 265, w: 48, h: 23, siren: this.rng.next() * 6,
      });
      return;
    }
    this.cars.push({
      kind: 'police', color: '#20242e', model: 'Interceptor',
      x: px + 700, y: py, angle: Math.PI, speed: 0, top: 265, w: 48, h: 23, siren: 0,
    });
  }

  spawnCop(px, py) {
    const a = this.rng.next() * Math.PI * 2;
    const d = this.rng.range(420, 560);
    const spot = nearestRoadPoint(px + Math.cos(a) * d, py + Math.sin(a) * d);
    this.cops.push({
      x: clamp(spot.x, 80, 3120), y: clamp(spot.y, 80, 2060),
      speed: 195, health: 100, angle: 0, punchTimer: 0,
    });
  }

  update(dt, player, onBusted) {
    this.sirenPhase += dt;
    if (this.spawnCooldown > 0) this.spawnCooldown -= dt;
    if (this.recentCrimeTimer > 0) this.recentCrimeTimer -= dt;
    const px = player.x;
    const py = player.y;

    // Who can see the player right now, before any spawning?
    let seen = false;
    for (const c of this.cars) if (dist(c.x, c.y, px, py) < 520) seen = true;
    for (const c of this.cops) if (dist(c.x, c.y, px, py) < 420) seen = true;

    // Wanted count of police cars. Reinforcements only while seen or while
    // a crime is fresh; a hidden player gets no new tail.
    const want = this.stars > 0 ? this.wantedCount() : 0;
    const mayReinforce = seen || this.recentCrimeTimer > 0;
    if (mayReinforce && this.spawnCooldown <= 0) {
      if (this.cars.length < want) { this.spawnPoliceCar(px, py); this.spawnCooldown = 2.5; }
      const wantCops = !player.inCar && this.stars >= 2 ? Math.min(3, this.stars - 1) : 0;
      if (this.cops.length < wantCops) { this.spawnCop(px, py); this.spawnCooldown = 2.5; }
    }
    while (this.cars.length > want) this.cars.pop();
    // Units that lost the player far away give up and leave.
    this.cars = this.cars.filter((c) => dist(c.x, c.y, px, py) < 1100);
    this.cops = this.cops.filter((c) => dist(c.x, c.y, px, py) < 850);
    while (this.cops.length > (!player.inCar && this.stars >= 2 ? Math.min(3, this.stars - 1) : 0)) this.cops.pop();

    // Heat decay: only while no police can see the player.
    if (this.stars > 0 && !seen) {
      this.hiddenTimer += dt;
      if (this.hiddenTimer > TUNING.wantedDecayDelay) {
        this.heat = Math.max(0, this.heat - TUNING.wantedDecayRate * dt);
        this.stars = Math.min(TUNING.maxWanted, Math.ceil(this.heat / 20));
        if (this.heat <= 0) this.stars = 0;
      }
    } else {
      this.hiddenTimer = 0;
    }

    // Police cars pursue.
    for (const car of this.cars) {
      const target = angleTo(car.x, car.y, px, py);
      const diff = angleDiff(car.angle, target);
      car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      const wantSpeed = this.stars >= 4 ? car.top : car.top * 0.92;
      car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.2);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.siren += dt;
      // Ram the player's car or knock the player down.
      const d = dist(car.x, car.y, px, py);
      if (player.inCar && player.car && d < 52) {
        player.car.speed *= 0.86;
        player.damage(TUNING.policeRamDamage * dt * 3, 'rammed by a police Interceptor');
        car.speed *= 0.7;
      } else if (!player.inCar && d < 30) {
        player.damage(26 * dt, 'caught by a police Interceptor');
      }
      car.x = clamp(car.x, 40, 3160);
      car.y = clamp(car.y, 40, 2080);
    }

    // Foot cops run the player down and brawl.
    for (const cop of this.cops) {
      const d = dist(cop.x, cop.y, px, py);
      cop.angle = angleTo(cop.x, cop.y, px, py);
      if (d > 26) {
        cop.x += Math.cos(cop.angle) * cop.speed * dt;
        cop.y += Math.sin(cop.angle) * cop.speed * dt;
      } else {
        cop.punchTimer -= dt;
        if (cop.punchTimer <= 0) {
          cop.punchTimer = 0.9;
          player.damage(12, 'beaten by a Solmar officer');
        }
      }
    }
    if (player.health <= 0 && onBusted) onBusted();
  }
}
