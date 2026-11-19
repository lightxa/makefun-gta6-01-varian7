// traffic.js — the city's moving life: cars that drive the road grid and
// pedestrians who stroll the sidewalks and scatter when trouble starts.
// Traffic cars follow lanes and turn at intersections; pedestrians pick a
// nearby sidewalk point and walk to it, then pick another.
import { Rng } from './random.js';
import { roadXs, roadYs, clampToWorld, hitsBuilding } from './world.js';
import { CAR_MODELS, PED_SHIRTS, TUNING } from './config.js';
import { makeCar } from './player.js';

export class Traffic {
  constructor(world, seed) {
    this.world = world;
    this.rng = new Rng(seed + 77);
    this.cars = [];
    this.peds = [];
    this.spawnCars();
    this.spawnPeds();
  }

  spawnCars() {
    const xs = roadXs();
    const ys = roadYs();
    for (let i = 0; i < TUNING.trafficCount; i++) {
      const vertical = this.rng.chance(0.5);
      const model = this.rng.pick(CAR_MODELS);
      let x; let y; let angle;
      if (vertical) {
        x = xs[this.rng.int(0, xs.length - 1)] + (this.rng.chance(0.5) ? 17 : -17);
        y = this.rng.range(200, 2200);
        angle = this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      } else {
        x = this.rng.range(200, 3000);
        y = ys[this.rng.int(0, ys.length - 1)] + (this.rng.chance(0.5) ? 17 : -17);
        angle = this.rng.chance(0.5) ? 0 : Math.PI;
      }
      const car = makeCar(x, y, model, angle);
      car.speed = this.rng.range(110, 190);
      car.cruise = car.speed;
      this.cars.push(car);
    }
  }

  spawnPeds() {
    for (let i = 0; i < TUNING.pedCount; i++) {
      const x = this.rng.range(300, 3000);
      const y = this.rng.range(200, 2200);
      this.peds.push({
        x, y, tx: x, ty: y,
        speed: this.rng.range(45, 80),
        shirt: this.rng.pick(PED_SHIRTS),
        skin: this.rng.pick(['#e8c39a', '#c98f5f', '#8a5a3a', '#f0d0b0']),
        angle: this.rng.range(0, Math.PI * 2),
        flee: 0, bob: this.rng.range(0, 6),
      });
    }
  }

  nearestCar(x, y, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      if (car.isPlayerCar) continue;
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  update(dt, game) {
    const player = game.player;
    for (const car of this.cars) {
      if (car.isPlayerCar) continue;
      this.updateTrafficCar(dt, car, game);
    }
    for (const ped of this.peds) {
      this.updatePed(dt, ped, game);
    }
    // Keep the streets full: replace cars that drifted far from the player.
    for (const car of this.cars) {
      if (car.isPlayerCar) continue;
      if (Math.hypot(car.x - player.x, car.y - player.y) > 1600) {
        this.respawnCar(car, player);
      }
    }
  }

  updateTrafficCar(dt, car, game) {
    // Slow down for the car ahead and for the player crossing the road.
    let target = car.cruise;
    for (const other of this.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 90 && side < 26) { target = 0; break; }
    }
    const pd = Math.hypot(game.player.x - car.x, game.player.y - car.y);
    if (pd < 70 && game.player.onFoot) target = 0;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.6);
    // At an intersection, sometimes turn onto the crossing road.
    const xs = roadXs();
    const ys = roadYs();
    const nearX = xs.find((rx) => Math.abs(car.x - rx) < 12);
    const nearY = ys.find((ry) => Math.abs(car.y - ry) < 12);
    if (nearX !== undefined && nearY !== undefined && this.rng.chance(dt * 0.5)) {
      car.angle = this.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      car.x = nearX + (Math.abs(car.angle) === Math.PI / 2 ? (this.rng.chance(0.5) ? 17 : -17) : 0);
      car.y = nearY + (car.angle === 0 || car.angle === Math.PI ? (this.rng.chance(0.5) ? 17 : -17) : 0);
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const c = clampToWorld(car.x, car.y);
    if (c.x !== car.x || c.y !== car.y) {
      car.angle += Math.PI;
      car.x = c.x;
      car.y = c.y;
    }
    // Hitting a pedestrian while speeding is a crime the police notice.
    for (const ped of this.peds) {
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 20 && Math.abs(car.speed) > 60) {
        ped.flee = 3;
        ped.x += Math.cos(ped.angle) * 40;
      }
    }
  }

  updatePed(dt, ped, game) {
    ped.bob += dt * 6;
    const player = game.player;
    const pd = Math.hypot(player.x - ped.x, player.y - ped.y);
    if (pd < 90 && (game.police.wanted > 0 || player.punchTimer > 0 || (!player.onFoot && Math.abs(player.speed) > 200))) {
      ped.flee = 2.5;
    }
    let speed = ped.speed;
    let tx = ped.tx;
    let ty = ped.ty;
    if (ped.flee > 0) {
      ped.flee -= dt;
      speed = 170;
      const away = Math.atan2(ped.y - player.y, ped.x - player.x);
      tx = ped.x + Math.cos(away) * 200;
      ty = ped.y + Math.sin(away) * 200;
    } else if (Math.hypot(tx - ped.x, ty - ped.y) < 12) {
      tx = ped.x + this.rng.range(-260, 260);
      ty = ped.y + this.rng.range(-260, 260);
      ped.tx = tx;
      ped.ty = ty;
    }
    ped.angle = Math.atan2(ty - ped.y, tx - ped.x);
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    if (!hitsBuilding(this.world, nx, ped.y, 10)) ped.x = nx;
    if (!hitsBuilding(this.world, ped.x, ny, 10)) ped.y = ny;
    const c = clampToWorld(ped.x, ped.y);
    ped.x = c.x;
    ped.y = c.y;
  }

  respawnCar(car, player) {
    const xs = roadXs();
    const ys = roadYs();
    const vertical = this.rng.chance(0.5);
    if (vertical) {
      car.x = xs[this.rng.int(0, xs.length - 1)] + 17;
      car.y = player.y + this.rng.pick([-900, 900]);
      car.angle = Math.PI / 2;
    } else {
      car.x = player.x + this.rng.pick([-900, 900]);
      car.y = ys[this.rng.int(0, ys.length - 1)] + 17;
      car.angle = 0;
    }
    car.speed = car.cruise;
  }

  // A parked car the player can steal: pulled from the traffic pool.
  nearestParked(x, y, maxDist) {
    return this.nearestCar(x, y, maxDist);
  }
}
