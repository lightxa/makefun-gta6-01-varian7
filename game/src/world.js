// City generation and collision for Solmar Bay.
// The city is a deterministic road grid built from the seed: every block
// between roads holds buildings, a park, a plaza or a market, and the west
// edge is Solmar Beach with open water beyond it. Landmark points (garage,
// marina, cafe, safehouse, bank, docks) sit on named road spots so missions
// always have a real place to go.
import {
  WORLD_W, WORLD_H, ROADS_X, ROADS_Y, ROAD_W, BEACH_X, BEACH_W,
  PALETTE, DISTRICTS,
} from './config.js';
import { makeRng, clamp } from './random.js';

export function buildWorld(seed) {
  const rng = makeRng(seed * 7919 + 13);
  const buildings = [];
  const parks = [];
  const palms = [];
  const plazas = [];

  for (let ix = 0; ix < ROADS_X.length - 1; ix++) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy++) {
      const x0 = ROADS_X[ix] + ROAD_W / 2 + 14;
      const x1 = ROADS_X[ix + 1] - ROAD_W / 2 - 14;
      const y0 = ROADS_Y[iy] + ROAD_W / 2 + 14;
      const y1 = ROADS_Y[iy + 1] - ROAD_W / 2 - 14;
      const roll = rng.next();
      if (roll < 0.14) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let p = 0; p < 6; p++) {
          palms.push({
            x: rng.range(x0 + 20, x1 - 20),
            y: rng.range(y0 + 20, y1 - 20),
            s: rng.range(0.8, 1.3),
          });
        }
        continue;
      }
      if (roll < 0.22) {
        plazas.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const cols = rng.int(2, 3);
      const rows = rng.int(1, 2);
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng.chance(0.12)) continue;
          const bw = cw * rng.range(0.62, 0.82);
          const bh = ch * rng.range(0.6, 0.8);
          const bx = x0 + c * cw + (cw - bw) / 2;
          const by = y0 + r * ch + (ch - bh) / 2;
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            height: rng.int(1, 4),
            roof: rng.pick(PALETTE.buildingRoof),
            wall: rng.pick(PALETTE.buildingWall),
            windows: rng.int(2, 5),
          });
        }
      }
    }
  }

  // Beach palms along the shore.
  for (let y = 120; y < WORLD_H - 100; y += 90) {
    palms.push({ x: BEACH_X + 30 + rng.range(-8, 40), y: y + rng.range(-14, 14), s: rng.range(0.9, 1.4) });
  }

  const landmarks = {
    garage: { x: 1500, y: 650, label: 'Rosa\u2019s Garage' },
    marina: { x: 300, y: 300, label: 'Marina Drop' },
    cafe: { x: 1900, y: 300, label: 'Palm Row Cafe' },
    safehouse: { x: 2700, y: 1350, label: 'Safehouse' },
    bank: { x: 1500, y: 1000, label: 'Downtown Bank' },
    dockA: { x: 3100, y: 300, label: 'Dock A' },
    dockB: { x: 3100, y: 1000, label: 'Dock B' },
    dockC: { x: 2700, y: 1700, label: 'Dock C' },
    spawn: { x: 1500, y: 1350, label: 'Palm Row' },
  };

  return { seed, buildings, parks, palms, plazas, landmarks };
}

export function isOnRoad(x, y) {
  for (const rx of ROADS_X) {
    if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  }
  for (const ry of ROADS_Y) {
    if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y: clamp(y, 80, WORLD_H - 80) }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x: clamp(x, 80, WORLD_W - 80), y: ry }; }
  }
  return best;
}

// Circle vs building rectangles. Returns the pushed-out position.
export function collideCircle(world, x, y, radius) {
  let px = x;
  let py = y;
  for (const b of world.buildings) {
    const cx = clamp(px, b.x, b.x + b.w);
    const cy = clamp(py, b.y, b.y + b.h);
    const dx = px - cx;
    const dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 < 0.0001) {
        py = b.y - radius;
      } else {
        const d = Math.sqrt(d2);
        px = cx + (dx / d) * radius;
        py = cy + (dy / d) * radius;
      }
    }
  }
  px = clamp(px, 30, WORLD_W - 30);
  py = clamp(py, 30, WORLD_H - 30);
  return { x: px, y: py };
}

export function pointInBuilding(world, x, y) {
  for (const b of world.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

export function districtTintAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.tint;
  }
  return '#7fb069';
}
