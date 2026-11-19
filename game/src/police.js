// Wanted level and police for Solmar Bay.
// Crimes raise heat; heat sets the star count from 0 to 5. Police cars
// spawn to match the stars and chase the player, and foot cops grab Kit
// when they get close on foot. Break line of sight, stay out of trouble,
// and the heat bleeds away until the stars drop back to zero.
import { TUNING } from './config.js';
import { makeRng, clamp, dist, angleTo, turnToward } from './random.js';
import { nearestRoadPoint, collideCircle } from './world.js';

export function createPolice(seed) {
  return {
    level: 0,
    heat: 0,
    cars: [],
    cops: [],
    quietTimer: 0,
    catchTimer: 0,
    rng: makeRng(seed * 31337 + 5),
    spawnTimer: 0,
    respawnDelay: 0,
  };
}

export function wantedTargetCount(level) {
  return [0, 1, 2, 3, 4, 6][clamp(level, 0, 5)];
}

export function addHeat(police, amount) {
  police.heat = clamp(police.heat + amount, 0, 100);
  const next = police.heat >= 85 ? 5 : police.heat >= 65 ? 4 : police.heat >= 45 ? 3 : police.heat >= 25 ? 2 : police.heat >= 8 ? 1 : 0;
  if (next > police.level) police.level = next;
}

export function setWanted(police, level) {
  police.level = clamp(level, 0, 5);
  police.heat = [0, 10, 30, 50, 70, 90][police.level];
  police.quietTimer = 0;
}

function spawnPoliceCar(police, player) {
  const spot = nearestRoadPoint(
    player.x + police.rng.range(-500, 500),
    player.y + police.rng.range(-500, 500),
  );
  const angle = angleTo(spot.x, spot.y, player.x, player.y);
  police.cars.push({
    id: 'cop-' + police.cars.length + '-' + Math.floor(police.rng.next() * 10000),
    x: spot.x,
    y: spot.y,
    angle,
    speed: 0,
    color: '#1b2a4a',
    model: 'Interceptor',
    police: true,
    health: 100,
    driver: 'police',
    sirenPhase: police.rng.next() * Math.PI * 2,
  });
}

function spawnCop(police, player) {
  const a = police.rng.range(0, Math.PI * 2);
  police.cops.push({
    x: player.x + Math.cos(a) * 260,
    y: player.y + Math.sin(a) * 260,
    angle: a,
    speed: 150,
    health: 100,
    shirt: '#1b2a4a',
  });
}

export function updatePolice(police, dt, player, world, onEvent) {
  const wanted = wantedTargetCount(police.level);
  police.spawnTimer -= dt;
  police.respawnDelay = Math.max(0, police.respawnDelay - dt);
  if (police.cars.length < wanted && police.spawnTimer <= 0 && police.respawnDelay <= 0) {
    spawnPoliceCar(police, player);
    police.spawnTimer = 1.2;
  }
  if (police.level >= 3 && police.cops.length < police.level - 2 && police.spawnTimer <= 0) {
    spawnCop(police, player);
    police.spawnTimer = 1.5;
  }
  // Trim extras when the wanted level drops.
  while (police.cars.length > wanted) police.cars.pop();
  while (police.cops.length > Math.max(0, police.level - 2)) police.cops.pop();

  const playerSpeed = Math.abs(player.speed || 0);
  for (const car of police.cars) {
    const d = dist(car.x, car.y, player.x, player.y);
    const target = angleTo(car.x, car.y, player.x, player.y);
    // Lose the trail: past 650 units the police lose sight and slow to a
    // search crawl, so a fast driver who breaks away can shake them.
    const top = d > 650 ? 180 : 300 + police.level * 55;
    if (car.speed < top) car.speed = Math.min(top, car.speed + 320 * dt);
    else if (car.speed > top) car.speed = Math.max(top, car.speed - 500 * dt);
    car.angle = turnToward(car.angle, target, dt * 2.4);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const solved = collideCircle(world, nx, ny, 20);
    if (Math.abs(solved.x - nx) > 0.5 || Math.abs(solved.y - ny) > 0.5) car.speed *= 0.5;
    car.x = solved.x;
    car.y = solved.y;
    car.sirenPhase += dt * 6;
    // A car that loses sight of the player for a while gives up the chase.
    car.lostTimer = d > 800 ? (car.lostTimer || 0) + dt : 0;
    // Ram the player car.
    if (player.car && d < 46) {
      player.car.speed *= 0.82;
      car.speed *= 0.6;
      onEvent({ type: 'policeRam' });
    }
  }

  // Cars that lost the player give up and leave; no fresh pursuit starts
  // for a few seconds, which is the window that lets the heat bleed off.
  const before = police.cars.length;
  police.cars = police.cars.filter((c) => (c.lostTimer || 0) < 2.5);
  if (police.cars.length < before) police.respawnDelay = 5;

  let nearestCop = Infinity;
  for (const cop of police.cops) {
    const target = angleTo(cop.x, cop.y, player.x, player.y);
    cop.angle = turnToward(cop.angle, target, dt * 5);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    const solved = collideCircle(world, nx, ny, 12);
    cop.x = solved.x;
    cop.y = solved.y;
    nearestCop = Math.min(nearestCop, dist(cop.x, cop.y, player.x, player.y));
  }

  // Busted: a cop car sits on the player, or a foot cop grabs Kit on foot.
  let caught = false;
  if (police.level > 0) {
    const closeCar = police.cars.some((c) => dist(c.x, c.y, player.x, player.y) < 42 && Math.abs(c.speed) < 60 && playerSpeed < 40);
    const grabbed = player.onFoot && nearestCop < 34;
    if (closeCar || grabbed) {
      police.catchTimer += dt;
      if (police.catchTimer >= TUNING.policeCatchTime) caught = true;
    } else {
      police.catchTimer = Math.max(0, police.catchTimer - dt * 2);
    }
  } else {
    police.catchTimer = 0;
  }
  if (caught) onEvent({ type: 'busted' });

  // Heat decay: no police car nearby for a while and the stars fall.
  const nearestCar = police.cars.reduce((m, c) => Math.min(m, dist(c.x, c.y, player.x, player.y)), Infinity);
  if (police.level > 0 && nearestCar > 450) {
    police.quietTimer += dt;
    if (police.quietTimer >= TUNING.wantedDecayDelay) {
      police.level -= 1;
      police.heat = [0, 10, 30, 50, 70, 90][police.level];
      police.quietTimer = 0;
      onEvent({ type: 'wantedDown', level: police.level });
    }
  } else {
    police.quietTimer = 0;
  }
  return police;
}

export function clearWanted(police) {
  police.level = 0;
  police.heat = 0;
  police.cars = [];
  police.cops = [];
  police.catchTimer = 0;
  police.quietTimer = 0;
  police.respawnDelay = 0;
}
