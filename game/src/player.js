// The player: Kit Vela, driver with no car and big debts.
// On foot Kit walks, sprints and punches; in a car Kit drives with simple
// arcade physics. Any parked or traffic car can be taken with E, which is
// a crime and raises the wanted level. Health, cash and the current car
// live here.
import { TUNING } from './config.js';
import { clamp, dist, angleDiff, turnToward } from './random.js';
import { collideCircle } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    speed: 0,
    onFoot: true,
    car: null,
    health: 100,
    cash: 0,
    punchTimer: 0,
    punchCooldown: 0,
    punchHit: false,
    hurtFlash: 0,
    sprinting: false,
  };
}

export function nearestCar(player, cars, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.police) continue;
    const d = dist(player.x, player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function updatePlayer(player, dt, input, world, cars, onEvent) {
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);

  if (player.onFoot) {
    const move = input.moveVector();
    player.sprinting = input.down('ShiftLeft', 'ShiftRight');
    const speed = player.sprinting ? TUNING.runSpeed : TUNING.walkSpeed;
    if (move.x !== 0 || move.y !== 0) {
      const target = Math.atan2(move.y, move.x);
      player.angle = turnToward(player.angle, target, dt * 12);
      const nx = player.x + move.x * speed * dt;
      const ny = player.y + move.y * speed * dt;
      const solved = collideCircle(world, nx, ny, 14);
      player.x = solved.x;
      player.y = solved.y;
      player.speed = speed;
    } else {
      player.speed = 0;
    }
    if (player.punchTimer > 0) player.punchTimer -= dt;
    if (input.wasPressed('Space') || input.mouseClicked) {
      if (player.punchCooldown <= 0) {
        player.punchCooldown = TUNING.punchCooldown;
        player.punchTimer = 0.18;
        player.punchHit = true;
        onEvent({ type: 'punch' });
      }
    }
  } else if (player.car) {
    const car = player.car;
    const forward = input.down('KeyW', 'ArrowUp');
    const back = input.down('KeyS', 'ArrowDown');
    const left = input.down('KeyA', 'ArrowLeft');
    const right = input.down('KeyD', 'ArrowRight');
    const boost = input.down('ShiftLeft', 'ShiftRight');
    const maxSpeed = TUNING.carMaxSpeed * (boost ? 1.25 : 1);
    if (forward) car.speed += TUNING.carAccel * dt * (boost ? 1.3 : 1);
    if (back) {
      car.speed -= car.speed > 20 ? TUNING.carBrake * dt : TUNING.carAccel * 0.6 * dt;
    }
    if (!forward && !back) {
      car.speed -= car.speed * TUNING.carDrag * dt * 2;
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    car.speed = clamp(car.speed, -TUNING.carReverseMax, maxSpeed);
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    const dir = car.speed >= 0 ? 1 : -1;
    if (steer !== 0 && Math.abs(car.speed) > 12) {
      car.angle += steer * TUNING.carTurn * dt * dir * clamp(Math.abs(car.speed) / 220, 0.35, 1);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const solved = collideCircle(world, nx, ny, 20);
    if (Math.abs(solved.x - nx) > 0.5 || Math.abs(solved.y - ny) > 0.5) {
      if (Math.abs(car.speed) > 160) onEvent({ type: 'crash', speed: Math.abs(car.speed) });
      car.speed *= 0.35;
    }
    car.x = solved.x;
    car.y = solved.y;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.speed = Math.abs(car.speed);
    onEvent({ type: 'drive', speedRatio: Math.abs(car.speed) / TUNING.carMaxSpeed });
  }
  return player;
}

export function tryEnterCar(player, cars, onEvent) {
  if (!player.onFoot) return false;
  const car = nearestCar(player, cars, 64);
  if (!car) return false;
  car.stolen = true;
  car.driver = 'player';
  player.car = car;
  player.onFoot = false;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  onEvent({ type: 'stealCar', car });
  return true;
}

export function exitCar(player, world, onEvent) {
  if (player.onFoot || !player.car) return false;
  const car = player.car;
  car.driver = null;
  const side = player.angle + Math.PI / 2;
  const ex = car.x + Math.cos(side) * 34;
  const ey = car.y + Math.sin(side) * 34;
  const solved = collideCircle(world, ex, ey, 14);
  player.x = solved.x;
  player.y = solved.y;
  player.angle = car.angle;
  player.car = null;
  player.onFoot = true;
  player.speed = 0;
  onEvent({ type: 'exitCar', car });
  return true;
}

// Punch: hits the nearest pedestrian, cop or traffic car in front of Kit.
export function resolvePunch(player, peds, cops, cars, onEvent) {
  if (!player.punchHit) return;
  player.punchHit = false;
  const px = player.x + Math.cos(player.angle) * 26;
  const py = player.y + Math.sin(player.angle) * 26;
  let hitSomething = false;
  for (const ped of peds) {
    if (ped.down) continue;
    if (dist(px, py, ped.x, ped.y) < TUNING.punchRange) {
      ped.health -= TUNING.punchDamage;
      ped.fleeing = true;
      if (ped.health <= 0) ped.down = true;
      hitSomething = true;
      onEvent({ type: 'hitPed', ped });
      break;
    }
  }
  if (!hitSomething) {
    for (const cop of cops) {
      if (dist(px, py, cop.x, cop.y) < TUNING.punchRange) {
        cop.health -= TUNING.punchDamage;
        hitSomething = true;
        onEvent({ type: 'hitCop', cop });
        break;
      }
    }
  }
  if (!hitSomething) {
    for (const car of cars) {
      if (car === player.car) continue;
      if (dist(px, py, car.x, car.y) < TUNING.punchRange + 12) {
        car.health = Math.max(0, (car.health || 100) - 12);
        hitSomething = true;
        onEvent({ type: 'hitCar', car });
        break;
      }
    }
  }
  if (hitSomething) onEvent({ type: 'punchLanded' });
}

export function damagePlayer(player, amount) {
  player.health = Math.max(0, player.health - amount);
  player.hurtFlash = 0.35;
  return player.health <= 0;
}
