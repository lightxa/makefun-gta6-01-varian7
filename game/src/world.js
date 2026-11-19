// City generation and collision. The city is a deterministic road grid:
// every block between roads holds buildings, a park, a plaza or a market,
// and the south edge is Solmar Beach with open water beyond it.
import { WORLD_W, WORLD_H, ROADS_X, ROADS_Y, ROAD_W, BEACH_Y, WATER_Y, PALETTE } from './config.js';
import { makeRng, clamp } from './random.js';

export function isRoad(x, y) {
  if (y >= BEACH_Y) return false;
  const half = ROAD_W / 2;
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= half) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= half) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let bx = ROADS_X[0];
  let bd = Math.abs(x - bx);
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; bx = rx; }
  }
  let by = ROADS_Y[0];
  let bdY = Math.abs(y - by);
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bdY) { bdY = d; by = ry; }
  }
  return bd <= bdY ? { x: bx, y } : { x, y: by };
}

export function buildWorld(seed) {
  const rng = makeRng(seed ^ 0x9e3779b9);
  const buildings = [];
  const trees = [];
  const parks = [];
  const half = ROAD_W / 2 + 14;

  for (let ix = 0; ix < ROADS_X.length - 1; ix++) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy++) {
      const x0 = ROADS_X[ix] + half;
      const x1 = ROADS_X[ix + 1] - half;
      const y0 = ROADS_Y[iy] + half;
      const y1 = ROADS_Y[iy + 1] - half;
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      const roll = rng.next();
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // One park in Old Town, one plaza downtown, one market in Market Row.
      if (ix === 2 && iy === 4) {
        parks.push({ x0, y0, x1, y1, kind: 'park' });
        for (let t = 0; t < 14; t++) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(9, 15) });
        }
        continue;
      }
      if (ix === 5 && iy === 1) {
        parks.push({ x0, y0, x1, y1, kind: 'plaza' });
        for (let t = 0; t < 6; t++) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(8, 12) });
        }
        continue;
      }
      if (roll < 0.12) {
        parks.push({ x0, y0, x1, y1, kind: 'market' });
        for (let t = 0; t < 5; t++) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(8, 12) });
        }
        continue;
      }
      // Split the block into 1-4 buildings.
      const cols = rng.chance(0.5) ? 2 : 1;
      const rows = rng.chance(0.45) ? 2 : 1;
      const bw = (x1 - x0) / cols;
      const bh = (y1 - y0) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const bx0 = x0 + c * bw + 8;
          const by0 = y0 + r * bh + 8;
          const bx1 = x0 + (c + 1) * bw - 8;
          const by1 = y0 + (r + 1) * bh - 8;
          const tall = rng.chance(0.22);
          buildings.push({
            x0: bx0, y0: by0, x1: bx1, y1: by1,
            roof: rng.pick(PALETTE.buildingRoofs),
            wall: rng.pick(PALETTE.buildingWalls),
            h: tall ? rng.range(26, 44) : rng.range(10, 20),
            downtown: cx > 640 && cx < 2080 && cy < 1120,
          });
        }
      }
    }
  }
  // Beach umbrellas and palms along the sand.
  const beachProps = [];
  for (let i = 0; i < 16; i++) {
    beachProps.push({
      x: 120 + i * 190 + rng.range(-40, 40),
      y: rng.range(BEACH_Y + 50, BEACH_Y + 110),
      kind: rng.chance(0.5) ? 'umbrella' : 'palm',
      hue: rng.pick(['#e85d75', '#f2a541', '#4aa8dd', '#7bc96f']),
    });
  }
  return { buildings, trees, parks, beachProps, seed };
}

export function collideBuildings(world, x, y, r) {
  for (const b of world.buildings) {
    const cx = clamp(x, b.x0, b.x1);
    const cy = clamp(y, b.y0, b.y1);
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

// Push a circle out of buildings; returns true when a push happened.
export function resolveBuildingCollision(world, pos, r) {
  let hit = false;
  for (const b of world.buildings) {
    const cx = clamp(pos.x, b.x0, b.x1);
    const cy = clamp(pos.y, b.y0, b.y1);
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 0.001) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * r;
      pos.y = cy + (dy / d) * r;
    } else {
      // Centre inside the building: push out along the shortest side.
      const left = pos.x - b.x0;
      const right = b.x1 - pos.x;
      const top = pos.y - b.y0;
      const bottom = b.y1 - pos.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = b.x0 - r;
      else if (m === right) pos.x = b.x1 + r;
      else if (m === top) pos.y = b.y0 - r;
      else pos.y = b.y1 + r;
    }
  }
  return hit;
}

export function inWater(x, y) {
  return y >= WATER_Y;
}

export function onSand(x, y) {
  return y >= BEACH_Y && y < WATER_Y;
}

export { WORLD_W, WORLD_H, BEACH_Y, WATER_Y };
