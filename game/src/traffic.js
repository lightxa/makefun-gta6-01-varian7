// Traffic and pedestrians: the living city. Cars follow the road grid and turn
// at intersections; pedestrians stroll the sidewalks and run from trouble.
// Everything is seeded, so the opening traffic is the same every run.

import { TRAFFIC, PED, WORLD, COLORS, CAR } from './config.js';
import { mulberry32, range, intRange, pick, angleDelta } from './random.js';
import { nearestRoad, collideBuildings, clampToWorld } from './world.js';

// A drivable car: a parked one, a traffic car, or a police cruiser.
export function makeCar(x, y, angle, color, kind, owner) {
  return {
    x, y, angle,
    speed: 0,
    color,
    kind: kind || 'sedan',
    owner: owner || 'traffic',
    driver: owner === 'traffic' ? 'traffic' : null,
    r: CAR.radius,
    cruise: range(Math.random, 0, 0), // replaced by spawnTraffic
  };
}

// Spawn the opening traffic: cars driving the avenues and streets.
export function spawnTraffic(world, seed) {
  const rng = mulberry32(seed + 101);
  const cars = [];
  for (let i = 0; i < TRAFFIC.cars; i++) {
    const vertical = rng() < 0.5;
    const x = vertical ? pick(rng, world.avenues) : range(rng, 700, WORLD.width - 100);
    const y = vertical ? range(rng, 200, WORLD.height - 100) : pick(rng, world.streets);
    const angle = vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const car = makeCar(x, y, angle, pick(rng, COLORS.trafficCar), pick(rng, ['sedan', 'sedan', 'coupe', 'van']), 'traffic');
    car.cruise = range(rng, TRAFFIC.carSpeedMin, TRAFFIC.carSpeedMax);
    car.lane = (rng() < 0.5 ? -1 : 1) * 22;
    cars.push(car);
  }
  // The parked cars from the world are drivable too.
  for (const p of world.parked) {
    cars.push(makeCar(p.x, p.y, p.angle, p.color, p.kind, 'parked'));
  }
  return cars;
}

// Spawn pedestrians on the sidewalks.
export function spawnPeds(world, seed) {
  const rng = mulberry32(seed + 202);
  const peds = [];
  for (let i = 0; i < TRAFFIC.peds; i++) {
    const vertical = rng() < 0.5;
    const x = vertical ? pick(rng, world.avenues) + (rng() < 0.5 ? -58 : 58) : range(rng, 700, WORLD.width - 100);
    const y = vertical ? range(rng, 200, WORLD.height - 100) : pick(rng, world.streets) + (rng() < 0.5 ? -58 : 58);
    peds.push({
      x, y,
      angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, PED.walkMin, PED.walkMax),
      color: pick(rng, COLORS.ped),
      fleeing: false,
      dead: false,
      wander: range(rng, 2, 6),
      r: 9,
    });
  }
  return peds;
}

// Step every traffic car: cruise along its road, turn at intersections, and
// slow down for the car ahead instead of piling into it.
export function updateTraffic(cars, world, dt, rng) {
  for (const car of cars) {
    if (car.driver !== 'traffic') continue;
    const road = nearestRoad(world, car.x, car.y);
    // Steer back toward the lane centre.
    const target = road.axis === 'v'
      ? Math.atan2(Math.sin(car.angle), Math.cos(car.angle)) >= 0 ? Math.PI / 2 : -Math.PI / 2
      : Math.cos(car.angle) >= 0 ? 0 : Math.PI;
    let desired = target;
    if (road.axis === 'v') {
      const off = car.x - (road.at + car.lane);
      desired = target + clampSteer(off);
    } else {
      const off = car.y - (road.at + car.lane);
      desired = target + clampSteer(off);
    }
    car.angle += angleDelta(car.angle, desired) * Math.min(1, dt * 2.2);
    // At an intersection, sometimes turn onto the crossing road.
    if (isAtIntersection(world, car.x, car.y) && rng() < dt * 0.25) {
      car.angle += (rng() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
    // Slow for the car ahead.
    let ahead = Infinity;
    for (const other of cars) {
      if (other === car || other.driver !== 'traffic') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along > 0 && along < 90 && side < 30 && along < ahead) ahead = along;
    }
    const targetSpeed = ahead < 90 ? car.cruise * 0.25 : car.cruise;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the map edge so the streets never run dry.
    if (car.x < 600) car.x = WORLD.width - 60;
    if (car.x > WORLD.width - 40) car.x = 620;
    if (car.y < 40) car.y = WORLD.height - 60;
    if (car.y > WORLD.height - 40) car.y = 60;
    collideBuildings(world, car);
  }
}

// A gentle steering correction toward the lane, proportional to the offset.
function clampSteer(off) {
  return Math.max(-0.5, Math.min(0.5, -off * 0.004));
}

// Is this point within a road crossing?
export function isAtIntersection(world, x, y) {
  const half = WORLD.road / 2;
  let onAvenue = false;
  let onStreet = false;
  for (const ax of world.avenues) if (Math.abs(x - ax) <= half) onAvenue = true;
  for (const sy of world.streets) if (Math.abs(y - sy) <= half) onStreet = true;
  return onAvenue && onStreet;
}

// Step every pedestrian: stroll, wander, and run from the player when a crime
// happens nearby or a police chase rolls past.
export function updatePeds(peds, world, player, dt, rng) {
  for (const ped of peds) {
    if (ped.dead) continue;
    ped.wander -= dt;
    const danger = Math.hypot(ped.x - player.x, ped.y - player.y) < 260 && (player.wanted > 0 || player.speed > 300);
    if (danger) ped.fleeing = true;
    if (ped.fleeing) {
      const away = Math.atan2(ped.y - player.y, ped.x - player.x);
      ped.angle += angleDelta(ped.angle, away) * Math.min(1, dt * 4);
      ped.x += Math.cos(ped.angle) * PED.fleeSpeed * dt;
      ped.y += Math.sin(ped.angle) * PED.fleeSpeed * dt;
      if (Math.hypot(ped.x - player.x, ped.y - player.y) > 420) ped.fleeing = false;
    } else {
      if (ped.wander <= 0) {
        ped.angle += range(rng, -1.2, 1.2);
        ped.wander = range(rng, 2, 6);
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    collideBuildings(world, ped);
    clampToWorld(world, ped);
  }
}
