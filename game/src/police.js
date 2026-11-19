// The Solmar Bay Police Department: wanted stars, pursuit cruisers, and the
// busted screen. Police spawn at the map edge when the player has heat, chase
// the player's car or feet, and ram. Lose them by breaking line of sight and
// staying quiet until the heat cools.

import { WANTED, CAR, WORLD } from './config.js';
import { clamp, angleDelta } from './random.js';
import { collideBuildings, clampToWorld } from './world.js';

// A police cruiser, spawned off-screen and sent after the player.
export function makePolice(x, y) {
  return {
    x, y,
    angle: 0,
    speed: 0,
    color: '#20242e',
    kind: 'police',
    owner: 'police',
    driver: 'police',
    r: CAR.radius,
    cruise: 480,
    siren: 0,
    stuck: 0,
  };
}

// How many cruisers the wanted level calls for.
export function wantedPoliceCount(wanted) {
  return Math.min(WANTED.maxPolice, wanted + 1);
}

// Step the police: spawn up to the wanted count, chase, ram, and give up on
// cruisers that fall too far behind. Returns 'busted' when the player is caught
// on foot, or null.
export function updatePolice(police, player, world, dt, rng, effects) {
  if (player.wanted <= 0) {
    // No heat: the cruisers drive off and despawn.
    for (let i = police.length - 1; i >= 0; i--) {
      const c = police[i];
      c.speed = Math.max(0, c.speed - 300 * dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      if (c.speed <= 0) police.splice(i, 1);
    }
    return null;
  }

  // Spawn cruisers at the map edge until the wanted level is answered.
  const want = wantedPoliceCount(player.wanted);
  if (police.length < want) {
    const side = Math.floor(rng() * 4);
    let x = player.x;
    let y = player.y;
    if (side === 0) { x = player.x - 700; y = player.y - 500; }
    if (side === 1) { x = player.x + 700; y = player.y - 500; }
    if (side === 2) { x = player.x - 700; y = player.y + 500; }
    if (side === 3) { x = player.x + 700; y = player.y + 500; }
    x = clamp(x, 700, WORLD.width - 60);
    y = clamp(y, 60, WORLD.height - 60);
    police.push(makePolice(x, y));
  }

  let busted = null;
  for (let i = police.length - 1; i >= 0; i--) {
    const c = police[i];
    c.siren += dt;
    const dx = player.x - c.x;
    const dy = player.y - c.y;
    const dist = Math.hypot(dx, dy);
    // A cruiser that fell far behind gives up and despawns.
    if (dist > 1400) {
      police.splice(i, 1);
      continue;
    }
    // Chase steering with a little wobble so the pursuit looks alive. Up close
    // the cruiser drives straight at the player to ram; farther out it routes
    // along the road grid, so it drives around blocks instead of into them.
    let target;
    if (dist < 170) {
      target = Math.atan2(dy, dx);
    } else {
      const tx = Math.abs(dx) >= Math.abs(dy) ? player.x : nearestAvenue(world, c.x);
      const ty = Math.abs(dx) >= Math.abs(dy) ? nearestStreet(world, c.y) : player.y;
      target = Math.atan2(ty - c.y, tx - c.x);
    }
    const wobble = Math.sin(c.siren * 2.1 + i) * 0.12;
    c.angle += angleDelta(c.angle, target + wobble) * Math.min(1, dt * 2.6);
    const targetSpeed = dist > 120 ? c.cruise + player.wanted * 18 : c.cruise * 0.4;
    c.speed += (targetSpeed - c.speed) * Math.min(1, dt * 1.4);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (collideBuildings(world, c)) c.speed *= 0.6;
    clampToWorld(world, c);

    // Ramming the player's car slows it and shakes the camera.
    if (!player.onFoot && player.car && dist < 46) {
      player.car.speed *= 0.86;
      effects.push({ kind: 'spark', x: player.x, y: player.y, life: 0.25, max: 0.25 });
    }
    // Caught on foot at low speed: busted.
    if (player.onFoot && dist < 30 && player.speed < 120) {
      busted = 'busted';
    }
  }
  return busted;
}

// The stars the HUD draws, from the player's wanted level.
export function wantedStars(player) {
  return Math.max(0, Math.min(WANTED.max, player.wanted));
}

// The nearest avenue centre to an x, for routing a cruiser along the grid.
function nearestAvenue(world, x) {
  let best = world.avenues[0];
  for (const ax of world.avenues) {
    if (Math.abs(ax - x) < Math.abs(best - x)) best = ax;
  }
  return best;
}

// The nearest street centre to a y, for routing a cruiser along the grid.
function nearestStreet(world, y) {
  let best = world.streets[0];
  for (const sy of world.streets) {
    if (Math.abs(sy - y) < Math.abs(best - y)) best = sy;
  }
  return best;
}
