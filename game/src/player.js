// The player: Dana Reyes, courier turned wheelman. On foot she walks and
// runs, punches and shoots; in a car she drives with arcade physics. She
// can steal any parked or traffic car, and her health, cash and ammo live here.
import { TUNING, CAR_MODELS } from './config.js';
import { clamp, dist, angleDiff } from './random.js';
import { resolveBuildingCollision, inWater, onSand } from './world.js';
import { makeTrafficCar } from './traffic.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.health = 100;
    this.cash = TUNING.startingCash;
    this.ammo = TUNING.startingAmmo;
    this.score = 0;
    this.onFoot = true;
    this.inCar = false;
    this.car = null;
    this.speed = 0;
    this.punchTimer = 0;
    this.shootTimer = 0;
    this.hurtTimer = 0;
    this.lastDamage = '';
    this.muzzle = 0;
    this.parked = [];
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.health = 100;
    this.onFoot = true;
    this.inCar = false;
    this.car = null;
    this.speed = 0;
  }

  damage(amount, cause) {
    if (this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtTimer = 0.35;
    if (cause) this.lastDamage = cause;
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, 100);
  }

  addCash(amount) {
    this.cash += amount;
    this.score += Math.max(0, amount);
  }

  enterCar(car, police) {
    if (this.inCar) return false;
    this.car = car;
    this.inCar = true;
    this.onFoot = false;
    this.x = car.x;
    this.y = car.y;
    this.angle = car.angle;
    this.speed = 0;
    return true;
  }

  exitCar() {
    if (!this.inCar || !this.car) return;
    const car = this.car;
    // Step out to the side of the car.
    const side = Math.PI / 2;
    this.x = car.x + Math.cos(car.angle + side) * 34;
    this.y = car.y + Math.sin(car.angle + side) * 34;
    this.angle = car.angle;
    this.inCar = false;
    this.onFoot = true;
    this.speed = 0;
    this.car = null;
  }

  nearestCar(cars, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of cars) {
      const d = dist(this.x, this.y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  updateOnFoot(dt, input, world, game) {
    const ax = input.axis();
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const sp = running ? TUNING.runSpeed : TUNING.walkSpeed;
    let mx = ax.x;
    let my = ax.y;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      this.angle = Math.atan2(my, mx);
    }
    const pos = { x: this.x + mx * sp * dt, y: this.y + my * sp * dt };
    resolveBuildingCollision(world, pos, 16);
    // Water blocks the player; sand slows her a little.
    if (!inWater(pos.x, pos.y)) {
      const slow = onSand(pos.x, pos.y) ? 0.75 : 1;
      this.x = pos.x;
      this.y = pos.y;
      if (slow < 1 && len > 0) {
        this.x = this.x - mx * sp * dt * 0.25;
        this.y = this.y - my * sp * dt * 0.25;
      }
    }
    this.x = clamp(this.x, 30, 3170);
    this.y = clamp(this.y, 30, 2110);
    this.speed = len > 0 ? sp : 0;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.punchTimer > 0) this.punchTimer -= dt;
    if (this.shootTimer > 0) this.shootTimer -= dt;
    if (this.muzzle > 0) this.muzzle -= dt;

    // Punch: Space swings at whatever is in front.
    if (input.wasPressed('Space') && this.punchTimer <= 0) {
      this.punchTimer = 0.45;
      game.punch(this);
    }
    // Shoot: KeyF fires the pistol toward the facing direction.
    if (input.wasPressed('KeyF') && this.shootTimer <= 0 && this.ammo > 0) {
      this.shootTimer = 0.32;
      this.ammo -= 1;
      this.muzzle = 0.09;
      game.shoot(this);
    }
  }

  updateDriving(dt, input, world, game) {
    const car = this.car;
    if (!car) { this.inCar = false; this.onFoot = true; return; }
    const ax = input.axis();
    const model = CAR_MODELS.find((m) => m.name === car.model) || CAR_MODELS[1];
    const top = (model.top || 210) * (car.kind === 'police' ? 1 : 1.9);
    const accel = TUNING.carAccel * (model.accel / 380);
    if (ax.y < 0) car.speed += accel * dt;
    else if (ax.y > 0) car.speed -= (car.speed > 0 ? accel * 1.4 : TUNING.carReverse) * dt;
    else {
      car.speed -= car.speed * TUNING.carDrag * dt;
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    if (input.down('Space')) car.speed -= car.speed * 2.6 * dt;
    car.speed = clamp(car.speed, -90, top);
    // Steering bites harder the faster the car goes, then washes out.
    const steer = ax.x * (model.grip || 3) * clamp(Math.abs(car.speed) / 90, 0, 1) * (car.speed >= 0 ? 1 : -1);
    car.angle += steer * dt * (car.speed >= 0 ? 1 : -1) * 0.9;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const pos = { x: nx, y: ny };
    const hitBuilding = resolveBuildingCollision(world, pos, 24);
    if (hitBuilding) {
      car.speed *= 0.45;
      game.crashSound();
    }
    if (!inWater(pos.x, pos.y)) {
      car.x = pos.x;
      car.y = pos.y;
    } else {
      car.speed *= 0.5;
    }
    car.x = clamp(car.x, 30, 3170);
    car.y = clamp(car.y, 30, 2105);
    this.x = car.x;
    this.y = car.y;
    this.angle = car.angle;
    this.speed = car.speed;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.muzzle > 0) this.muzzle -= dt;
    // Bumping pedestrians while driving is a crime.
    for (const ped of game.peds) {
      if (ped.down) continue;
      if (dist(car.x, car.y, ped.x, ped.y) < 30 && Math.abs(car.speed) > 70) {
        ped.down = true;
        ped.downTimer = 6;
        game.crime('hitPedestrian', ped);
      }
    }
  }
}
