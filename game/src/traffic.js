// Traffic cars and pedestrians for Solmar Bay.
// Traffic follows the road grid: each car drives along one road, turns at
// intersections sometimes, and wraps around the city edge so the streets
// always feel alive. Parked cars line the roads for the player to steal.
// Pedestrians stroll the sidewalks and scatter when a car barrels at them.
import { ROADS_X, ROADS_Y, ROAD_W, CAR_COLORS, CAR_MODELS, WORLD_W, WORLD_H } from './config.js';
import { makeRng, clamp, dist, angleDiff, turnToward } from './random.js';
import { collideCircle, nearestRoadPoint, pointInBuilding } from './world.js';

export function createTraffic(world, seed) {
  const rng = makeRng(seed * 104729 + 77);
  const cars = [];
  for (let i = 0; i < 26; i++) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(ROADS_X) : rng.pick(ROADS_Y);
    const along = rng.range(150, (vertical ? WORLD_H : WORLD_W) - 150);
    cars.push({
      id: 'traffic-' + i,
      x: vertical ? road + (rng.chance(0.5) ? -18 : 18) : along,
      y: vertical ? along : road + (rng.chance(0.5) ? -18 : 18),
      angle: vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
      speed: rng.range(70, 130),
      targetSpeed: rng.range(70, 130),
      color: rng.pick(CAR_COLORS),
      model: rng.pick(CAR_MODELS),
      vertical,
      road,
      driver: 'traffic',
      health: 100,
      police: false,
      stolen: false,
    });
  }
  // Parked cars the player can steal.
  for (let i = 0; i < 18; i++) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(ROADS_X) : rng.pick(ROADS_Y);
    const along = rng.range(200, (vertical ? WORLD_H : WORLD_W) - 200);
    const side = rng.chance(0.5) ? 1 : -1;
    cars.push({
      id: 'parked-' + i,
      x: vertical ? road + side * (ROAD_W / 2 - 12) : along,
      y: vertical ? along : road + side * (ROAD_W / 2 - 12),
      angle: vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI),
      speed: 0,
      targetSpeed: 0,
      color: rng.pick(CAR_COLORS),
      model: rng.pick(CAR_MODELS),
      vertical,
      road,
      driver: null,
      health: 100,
      police: false,
      stolen: false,
      parked: true,
    });
  }

  const peds = [];
  for (let i = 0; i < 42; i++) {
    const spot = nearestRoadPoint(rng.range(200, WORLD_W - 200), rng.range(200, WORLD_H - 200));
    const angle = rng.range(0, Math.PI * 2);
    const px = spot.x + Math.cos(angle) * (ROAD_W / 2 + 16);
    const py = spot.y + Math.sin(angle) * (ROAD_W / 2 + 16);
    if (pointInBuilding(world, px, py)) continue;
    peds.push({
      id: 'ped-' + i,
      x: clamp(px, 40, WORLD_W - 40),
      y: clamp(py, 40, WORLD_H - 40),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(28, 55),
      shirt: rng.pick(['#e63946', '#2a9d8f', '#f4a261', '#4361ee', '#ffbe0b', '#9d4edd', '#06d6a0', '#ef476f', '#118ab2', '#f1faee']),
      health: 100,
      down: false,
      fleeing: false,
      wanderTimer: rng.range(1, 4),
    });
  }
  return { cars, peds, rng };
}

function nearestOtherRoad(value, roads) {
  let best = roads[0];
  let bestD = Infinity;
  for (const r of roads) {
    const d = Math.abs(value - r);
    if (d > 4 && d < bestD) { bestD = d; best = r; }
  }
  return best;
}

export function updateTraffic(traffic, dt, world, playerCar, onEvent) {
  for (const car of traffic.cars) {
    if (car.driver === 'player') continue;
    if (car.parked) continue;
    // Slow down for the car ahead on the same road.
    let slow = false;
    for (const other of traffic.cars) {
      if (other === car || other.parked) continue;
      if (other.vertical !== car.vertical || other.road !== car.road) continue;
      const ahead = car.vertical
        ? (car.angle > 0 ? other.y - car.y : car.y - other.y)
        : (car.angle === 0 ? other.x - car.x : car.x - other.x);
      if (ahead > 0 && ahead < 70) { slow = true; break; }
    }
    const want = slow ? 0 : car.targetSpeed;
    car.speed += clamp(want - car.speed, -260 * dt, 180 * dt);
    // Maybe turn at an intersection.
    const onCross = car.vertical
      ? ROADS_Y.some((ry) => Math.abs(car.y - ry) < 6)
      : ROADS_X.some((rx) => Math.abs(car.x - rx) < 6);
    if (onCross && traffic.rng.chance(dt * 0.35)) {
      if (car.vertical) {
        const ny = nearestOtherRoad(car.y, ROADS_Y);
        car.road = ny;
        car.vertical = false;
        car.angle = traffic.rng.chance(0.5) ? 0 : Math.PI;
        car.y = ny + (traffic.rng.chance(0.5) ? -18 : 18);
      } else {
        const nx = nearestOtherRoad(car.x, ROADS_X);
        car.road = nx;
        car.vertical = true;
        car.angle = traffic.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
        car.x = nx + (traffic.rng.chance(0.5) ? -18 : 18);
      }
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the city edge.
    if (car.x < 120) car.x = WORLD_W - 160;
    if (car.x > WORLD_W - 120) car.x = 160;
    if (car.y < 120) car.y = WORLD_H - 160;
    if (car.y > WORLD_H - 120) car.y = 160;
    // Bump the player car softly.
    if (playerCar && playerCar !== car) {
      const d = dist(car.x, car.y, playerCar.x, playerCar.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const nx = (playerCar.x - car.x) / d;
        const ny = (playerCar.y - car.y) / d;
        playerCar.x += nx * push;
        playerCar.y += ny * push;
        car.x -= nx * push * 0.4;
        car.y -= ny * push * 0.4;
        if (Math.abs(car.speed) > 90 || Math.abs(playerCar.speed) > 90) {
          onEvent({ type: 'trafficCrash' });
          car.speed *= 0.5;
          playerCar.speed *= 0.7;
        }
      }
    }
  }

  for (const ped of traffic.peds) {
    if (ped.down) continue;
    ped.wanderTimer -= dt;
    if (ped.fleeing) {
      ped.speed = 150;
      if (ped.wanderTimer <= 0) {
        ped.fleeing = false;
        ped.wanderTimer = 2;
      }
    } else if (ped.wanderTimer <= 0) {
      ped.angle = traffic.rng.range(0, Math.PI * 2);
      ped.wanderTimer = traffic.rng.range(1.5, 4);
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (pointInBuilding(world, nx, ny)) {
      ped.angle += Math.PI / 2;
      continue;
    }
    const solved = collideCircle(world, nx, ny, 10);
    ped.x = clamp(solved.x, 40, WORLD_W - 40);
    ped.y = clamp(solved.y, 40, WORLD_H - 40);
    // Scatter from a fast player car.
    if (playerCar && Math.abs(playerCar.speed) > 120) {
      if (dist(ped.x, ped.y, playerCar.x, playerCar.y) < 90) {
        ped.fleeing = true;
        ped.angle = Math.atan2(ped.y - playerCar.y, ped.x - playerCar.x);
        ped.wanderTimer = 1.2;
      }
    }
  }
}

// A pedestrian hit by the player car: knocked down, and it is a crime.
export function checkPedCarHits(traffic, playerCar, onEvent) {
  if (!playerCar || Math.abs(playerCar.speed) < 60) return;
  for (const ped of traffic.peds) {
    if (ped.down) continue;
    if (dist(ped.x, ped.y, playerCar.x, playerCar.y) < 30) {
      ped.down = true;
      ped.health = 0;
      onEvent({ type: 'ranOverPed', ped });
    }
  }
}

export { angleDiff, turnToward };
