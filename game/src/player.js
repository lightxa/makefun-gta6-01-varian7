// player.js — Rico Vega on foot and behind the wheel.
// On foot: walk, sprint, punch. In a car: arcade driving with steering that
// tightens with speed, a handbrake for sliding, and collisions that slow
// the car instead of stopping the fun.
import { clampToWorld, hitsBuilding, onRoad } from './world.js';
import { TUNING } from './config.js';

export function makeCar(x, y, model, angle) {
  return {
    x, y, angle: angle || 0, speed: 0,
    model, color: model.color, name: model.name,
    top: model.top, accel: model.accel, grip: model.grip,
    health: 100, stolen: false, isPlayerCar: false,
  };
}

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.speed = 0;
    this.onFoot = true;
    this.car = null;
    this.health = TUNING.playerHealth;
    this.cash = 250;
    this.punchTimer = 0;
    this.punchCooldown = 0;
    this.hurtTimer = 0;
    this.stealFlash = 0;
  }

  update(dt, input, world, game) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.stealFlash = Math.max(0, this.stealFlash - dt);
    if (this.onFoot) this.updateOnFoot(dt, input, world, game);
    else this.updateDriving(dt, input, world, game);
    if (this.punchTimer > 0) this.punchTimer -= dt;
  }

  updateOnFoot(dt, input, world, game) {
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? TUNING.sprintSpeed : TUNING.walkSpeed;
    let mx = 0;
    let my = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) my -= 1;
    if (input.down('KeyS') || input.down('ArrowDown')) my += 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      this.angle = Math.atan2(my, mx);
      const nx = this.x + mx * speed * dt;
      const ny = this.y + my * speed * dt;
      if (!hitsBuilding(world, nx, this.y, 14)) this.x = nx;
      if (!hitsBuilding(world, this.x, ny, 14)) this.y = ny;
      const c = clampToWorld(this.x, this.y);
      this.x = c.x;
      this.y = c.y;
      game.footstep(dt, sprint);
    }
    if (input.hit('KeyF') && this.punchCooldown <= 0) {
      this.punchTimer = 0.22;
      this.punchCooldown = 0.45;
      game.tryPunch(this);
    }
  }

  updateDriving(dt, input, world, game) {
    const car = this.car;
    if (!car) { this.onFoot = true; return; }
    const throttle = input.throttle();
    const steer = input.steer();
    const handbrake = input.down('Space');
    const onRoadNow = onRoad(car.x, car.y);
    const drag = onRoadNow ? TUNING.drag : TUNING.offroadDrag;
    if (throttle > 0) car.speed += car.accel * throttle * dt;
    else if (throttle < 0) {
      if (car.speed > 20) car.speed -= TUNING.brake * dt;
      else car.speed -= car.accel * 0.55 * dt;
    }
    car.speed -= car.speed * drag * dt * 0.55;
    if (handbrake) car.speed -= car.speed * 2.4 * dt;
    car.speed = Math.max(-TUNING.carReverseTop, Math.min(car.top, car.speed));
    if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
    const steerAuthority = Math.min(1, Math.abs(car.speed) / 90) * (handbrake ? 1.5 : 1);
    car.angle += steer * car.grip * steerAuthority * dt * Math.sign(car.speed || 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = hitsBuilding(world, nx, ny, 16);
    if (hit) {
      if (Math.abs(car.speed) > 160) {
        game.onCrash(Math.abs(car.speed));
        car.health -= 8;
      }
      car.speed *= -0.25;
    } else {
      car.x = nx;
      car.y = ny;
    }
    const c = clampToWorld(car.x, car.y);
    if (c.x !== car.x || c.y !== car.y) { car.speed *= 0.4; }
    car.x = c.x;
    car.y = c.y;
    if (handbrake && Math.abs(car.speed) > 120 && Math.random() < 0.5) {
      game.addSkid(car.x, car.y, car.angle);
    }
    this.x = car.x;
    this.y = car.y;
    this.angle = car.angle;
    this.speed = car.speed;
    game.audio.setEngine(Math.abs(car.speed) / car.top, true);
  }

  enterCar(car, game) {
    this.car = car;
    this.onFoot = false;
    car.isPlayerCar = true;
    if (car.stolen === false && !car.owned) {
      car.stolen = true;
      this.stealFlash = 1.2;
      game.police.addWanted(1, 'Car stolen');
    }
    game.audio.ensure();
  }

  exitCar(game) {
    if (!this.car) return;
    const car = this.car;
    car.isPlayerCar = false;
    const bx = this.x + Math.cos(this.angle + Math.PI / 2) * 34;
    const by = this.y + Math.sin(this.angle + Math.PI / 2) * 34;
    this.x = bx;
    this.y = by;
    this.car = null;
    this.onFoot = true;
    this.speed = 0;
    game.audio.setEngine(0, false);
  }

  hurt(amount, game) {
    if (this.hurtTimer > 0) return;
    this.health -= amount;
    this.hurtTimer = 0.7;
    if (this.health <= 0) {
      this.health = 0;
      game.onWasted();
    }
  }
}
