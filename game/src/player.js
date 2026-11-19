// The player: Marisol "Mari" Vega, a driver for hire in Solmar Bay. On foot
// she walks, runs, punches and shoots; in a car she drives it, and the car she
// is driving is the one the camera follows.

import { PLAYER, CAR, WORLD } from './config.js';
import { clamp, angleDelta } from './random.js';
import { collideBuildings, clampToWorld, isInSea } from './world.js';

// A fresh player at the garage, on foot, with starting cash and ammo.
export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    angle: spawn.angle,
    r: PLAYER.radius,
    health: PLAYER.health,
    cash: PLAYER.startCash,
    ammo: PLAYER.startAmmo,
    onFoot: true,
    car: null,
    speed: 0,
    sprinting: false,
    punchTimer: 0,
    shootTimer: 0,
    hurtTimer: 0,
    driving: false,
    wanted: 0,
    heat: 0,
    lastCrimeAt: -999,
    kills: 0,
    carsStolen: 0,
    missionsDone: 0,
  };
}

// Step the player one frame. Input is the shared input state; cars is the list
// of drivable cars; effects collects particles and floating text for the renderer.
export function updatePlayer(player, input, world, cars, dt, effects, now) {
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  player.shootTimer = Math.max(0, player.shootTimer - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);

  if (player.onFoot) {
    updateOnFoot(player, input, world, dt);
  } else {
    updateDriving(player, input, world, cars, dt, effects);
  }

  // Heat cools only after a quiet stretch with no new crime.
  if (player.wanted > 0 && now - player.lastCrimeAt > 9) {
    player.heat -= 0.55 * dt;
    if (player.heat <= 0) {
      player.heat = 0;
      player.wanted = 0;
    }
  }
  return player;
}

// Walking and running, with building collision and the sea as a wall.
function updateOnFoot(player, input, world, dt) {
  let mx = 0;
  let my = 0;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  const moving = mx !== 0 || my !== 0;
  player.sprinting = !!input.sprint && moving;
  const speed = player.sprinting ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (moving) {
    const len = Math.hypot(mx, my);
    player.x += (mx / len) * speed * dt;
    player.y += (my / len) * speed * dt;
    player.angle = Math.atan2(my, mx);
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  collideBuildings(world, player);
  clampToWorld(world, player);
  if (isInSea(world, player.x, player.y)) player.x = WORLD.seaWidth + player.r;
}

// Driving: arcade handling with acceleration, steering that scales with speed,
// a handbrake for sharp turns, and building bumps that slow the car.
function updateDriving(player, input, world, cars, dt, effects) {
  const car = player.car;
  if (!car) {
    player.onFoot = true;
    return;
  }
  const forward = input.up ? 1 : input.down ? -0.55 : 0;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const speedSign = car.speed >= 0 ? 1 : -1;

  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) car.speed -= CAR.reverseAccel * dt * 2.2;
  else car.speed *= Math.pow(0.4, dt);
  if (input.handbrake) car.speed *= Math.pow(0.12, dt);

  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const steerAmount = steer * CAR.turn * dt * clamp(Math.abs(car.speed) / 140, 0, 1);
  car.angle += steerAmount * speedSign;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Skid smoke when the handbrake is held at speed.
  if (input.handbrake && Math.abs(car.speed) > 200 && Math.random() < 0.6) {
    effects.push({
      kind: 'smoke',
      x: car.x - Math.cos(car.angle) * 22,
      y: car.y - Math.sin(car.angle) * 22,
      life: 0.6, max: 0.6,
    });
  }

  if (collideBuildings(world, car)) {
    car.speed *= 0.55;
    if (Math.abs(car.speed) > 260) {
      effects.push({ kind: 'spark', x: car.x, y: car.y, life: 0.3, max: 0.3 });
    }
  }
  clampToWorld(world, car);
  if (isInSea(world, car.x, car.y)) {
    car.x = WORLD.seaWidth + CAR.radius;
    car.speed *= 0.4;
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = car.speed;
}

// Step into the nearest car within reach. Stealing a stranger's car is a crime.
export function enterCar(player, cars, now, effects) {
  let best = null;
  let bestD = 70;
  for (const car of cars) {
    if (car.driver === 'player') continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  if (!best) return false;
  const stolen = best.owner !== 'player';
  best.driver = 'player';
  best.owner = 'player';
  player.car = best;
  player.onFoot = false;
  player.driving = true;
  if (stolen) {
    player.carsStolen++;
    addHeat(player, 1, now);
    effects.push({ kind: 'text', x: player.x, y: player.y - 30, text: 'Car stolen!', life: 1.4, max: 1.4 });
  }
  return true;
}

// Step out of the car, leaving it parked where it stops.
export function exitCar(player) {
  if (!player.car) return;
  const car = player.car;
  car.driver = null;
  const side = player.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 34;
  player.y = car.y + Math.sin(side) * 34;
  player.car = null;
  player.onFoot = true;
  player.driving = false;
  player.speed = 0;
}

// A punch in the direction the player faces; returns the pedestrian hit, if any.
export function punch(player, peds, dt) {
  if (player.punchTimer > 0 || !player.onFoot) return null;
  player.punchTimer = PLAYER.punchCooldown;
  const px = player.x + Math.cos(player.angle) * PLAYER.punchRange;
  const py = player.y + Math.sin(player.angle) * PLAYER.punchRange;
  for (const ped of peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - px, ped.y - py) < 30) return ped;
  }
  return null;
}

// A shot toward the mouse; returns the pedestrian hit, if any.
export function shoot(player, peds, mouseWorld, now) {
  if (player.shootTimer > 0 || player.ammo <= 0 || !player.onFoot) return null;
  player.shootTimer = PLAYER.pistolCooldown;
  player.ammo--;
  player.angle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
  addHeat(player, 2, now);
  for (const ped of peds) {
    if (ped.dead) continue;
    const dx = ped.x - player.x;
    const dy = ped.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > PLAYER.pistolRange) continue;
    const aim = Math.atan2(dy, dx);
    if (Math.abs(angleDelta(player.angle, aim)) < 0.12) return ped;
  }
  return null;
}

// Raise the wanted level by a crime and stamp the time of the crime.
export function addHeat(player, stars, now) {
  player.wanted = Math.min(5, player.wanted + stars);
  player.heat = player.wanted;
  player.lastCrimeAt = now;
}

// Hurt the player; returns true when the player is down.
export function hurtPlayer(player, damage) {
  if (player.hurtTimer > 0) return false;
  player.hurtTimer = 0.5;
  player.health -= damage;
  return player.health <= 0;
}
