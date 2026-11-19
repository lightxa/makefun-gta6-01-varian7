// Traffic cars and pedestrians. Traffic follows the road grid: each car
// drives along one road, turns at intersections sometimes, and wraps around
// the edge of the city so the streets always feel alive. Pedestrians stroll
// the sidewalks and scatter when a car barrels at them.
import { ROADS_X, ROADS_Y, CAR_COLORS, CAR_MODELS, TUNING } from './config.js';
import { makeRng, clamp, dist } from './random.js';
import { isRoad, collideBuildings } from './world.js';

export function spawnTraffic(seed, count) {
  const rng = makeRng(seed ^ 0x51ab);
  const cars = [];
  for (let i = 0; i < count; i++) {
    cars.push(makeTrafficCar(rng, true));
  }
  return cars;
}

export function makeTrafficCar(rng, anywhere) {
  const vertical = rng.chance(0.5);
  const model = rng.pick(CAR_MODELS);
  const road = vertical ? rng.pick(ROADS_X) : rng.pick(ROADS_Y);
  const along = rng.range(120, vertical ? 2080 : 2080);
  const dir = rng.chance(0.5) ? 1 : -1;
  const lane = 19;
  const car = {
    id: Math.floor(rng.next() * 1e9),
    kind: 'traffic',
    model: model.name,
    color: rng.pick(CAR_COLORS),
    x: vertical ? road + (dir > 0 ? lane : -lane) : along,
    y: vertical ? along : road + (dir > 0 ? lane : -lane),
    angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
    speed: rng.range(55, 105),
    top: model.top * 0.45,
    vertical,
    dir,
    w: 46,
    h: 22,
    brake: 0,
    stopped: false,
  };
  if (!anywhere) {
    car.x = clamp(car.x, 60, 3140);
    car.y = clamp(car.y, 60, 2060);
  }
  return car;
}

function atIntersection(car) {
  const near = (v, list) => list.some((r) => Math.abs(v - r) < 46);
  return car.vertical ? near(car.y, ROADS_Y) : near(car.x, ROADS_X);
}

export function updateTraffic(cars, dt, player, rng) {
  for (const car of cars) {
    // Brake for the car ahead on the same road.
    car.brake = 0;
    for (const other of cars) {
      if (other === car) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 70 && d > 1) {
        const ahead = car.vertical
          ? (car.dir > 0 ? other.y > car.y : other.y < car.y) && Math.abs(other.x - car.x) < 30
          : (car.dir > 0 ? other.x > car.x : other.x < car.x) && Math.abs(other.y - car.y) < 30;
        if (ahead) car.brake = 1;
      }
    }
    // Brake for the player's car right ahead.
    if (player && player.inCar && player.car) {
      const d = dist(car.x, car.y, player.car.x, player.car.y);
      if (d < 64) car.brake = 1;
    }
    const target = car.brake ? 0 : car.top;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.6);
    if (car.speed < 1) car.speed = 0;
    if (car.speed > 0) {
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
    }
    // Maybe turn at an intersection.
    if (atIntersection(car) && rng.chance(dt * 0.35)) {
      const turn = rng.chance(0.5) ? 1 : -1;
      const wasVertical = car.vertical;
      car.vertical = !wasVertical;
      car.angle += turn * Math.PI / 2;
      car.dir = Math.cos(car.angle) > 0.5 || Math.sin(car.angle) > 0.5 ? 1 : -1;
      if (car.vertical) {
        const rx = ROADS_X.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
        car.x = rx + (car.dir > 0 ? 19 : -19);
      } else {
        const ry = ROADS_Y.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
        car.y = ry + (car.dir > 0 ? 19 : -19);
      }
    }
    // Wrap around the city edge so traffic never runs dry.
    if (car.x < 40) car.x = 3160;
    if (car.x > 3160) car.x = 40;
    if (car.y < 40) car.y = 2060;
    if (car.y > 2100) car.y = 40;
  }
}

export function spawnPedestrians(seed, count) {
  const rng = makeRng(seed ^ 0x77aa);
  const peds = [];
  const shirts = ['#e85d75', '#4aa8dd', '#f2a541', '#7bc96f', '#b07bd9', '#e8e8e8', '#3d3d4a', '#d97bb0'];
  for (let i = 0; i < count; i++) {
    peds.push(makePedestrian(rng, shirts));
  }
  return peds;
}

export function makePedestrian(rng, shirts) {
  const vertical = rng.chance(0.5);
  const road = vertical ? rng.pick(ROADS_X) : rng.pick(ROADS_Y);
  const along = rng.range(120, 2060);
  return {
    id: Math.floor(rng.next() * 1e9),
    x: vertical ? road + rng.range(-52, 52) : along,
    y: vertical ? along : road + rng.range(-52, 52),
    tx: 0, ty: 0,
    speed: rng.range(24, 46),
    shirt: rng.pick(shirts || ['#e85d75', '#4aa8dd', '#f2a541']),
    skin: rng.pick(['#e8b88a', '#c98d5f', '#8a5a3b', '#f2c9a0']),
    flee: 0,
    down: false,
    downTimer: 0,
    hasTarget: false,
  };
}

export function updatePedestrians(peds, dt, player, rng) {
  for (const ped of peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) { ped.down = false; ped.hasTarget = false; }
      continue;
    }
    if (!ped.hasTarget || dist(ped.x, ped.y, ped.tx, ped.ty) < 12) {
      // Pick a nearby sidewalk point.
      let nx = ped.x + rng.range(-260, 260);
      let ny = ped.y + rng.range(-260, 260);
      nx = clamp(nx, 80, 3120);
      ny = clamp(ny, 80, 2060);
      if (!isRoad(nx, ny)) { nx = ped.x; ny = ped.y + rng.range(-80, 80); }
      ped.tx = nx;
      ped.ty = ny;
      ped.hasTarget = true;
    }
    // Flee from a fast car or the player.
    let fx = 0;
    let fy = 0;
    if (player && player.inCar && player.car) {
      const d = dist(ped.x, ped.y, player.car.x, player.car.y);
      if (d < 90 && Math.abs(player.car.speed || 0) > 60) {
        ped.flee = 1.2;
        fx = (ped.x - player.car.x) / d;
        fy = (ped.y - player.car.y) / d;
      }
    }
    if (ped.flee > 0) ped.flee -= dt;
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const sp = ped.speed * (ped.flee > 0 ? 2.4 : 1);
    ped.x += (dx / d + fx * 1.6) * sp * dt;
    ped.y += (dy / d + fy * 1.6) * sp * dt;
    ped.x = clamp(ped.x, 60, 3140);
    ped.y = clamp(ped.y, 60, 2080);
  }
}

export function carOverlapsCar(a, b) {
  return Math.abs(a.x - b.x) < 48 && Math.abs(a.y - b.y) < 30;
}

export { TUNING };
