// world.js — Solmar Bay itself: roads, districts, buildings, parks, beach.
// Generation is fully deterministic from the seed: the same seed always
// builds the same city, so screenshots and replays match.
import { Rng } from './random.js';
import { WORLD_W, WORLD_H, ROAD_STEP, SEA_X, BEACH_W, DISTRICTS, TUNING } from './config.js';

export function roadXs() {
  const xs = [];
  for (let x = 200; x < WORLD_W; x += ROAD_STEP) xs.push(x);
  return xs;
}

export function roadYs() {
  const ys = [];
  for (let y = 200; y < WORLD_H; y += ROAD_STEP) ys.push(y);
  return ys;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[1];
}

export function onRoad(x, y) {
  if (x < SEA_X + BEACH_W) return false;
  for (const rx of roadXs()) if (Math.abs(x - rx) <= 36) return true;
  for (const ry of roadYs()) if (Math.abs(y - ry) <= 36) return true;
  return false;
}

export function generateWorld(seed) {
  const rng = new Rng(seed);
  const buildings = [];
  const trees = [];
  const coins = [];
  const parkSpots = [
    { x: 1000, y: 1000, w: 380, h: 380, name: 'Coral Park' },
    { x: 2200, y: 1600, w: 380, h: 380, name: 'Harbor Green' },
  ];
  const plaza = { x: 1400, y: 600, w: 380, h: 380, name: 'Solmar Plaza' };

  // One building per city block, placed inside the block with a margin.
  for (let bx = 0; bx < 7; bx++) {
    for (let by = 0; by < 5; by++) {
      const x0 = 240 + bx * ROAD_STEP;
      const y0 = 240 + by * ROAD_STEP;
      const cx = x0 + 160;
      const cy = y0 + 160;
      let blocked = false;
      for (const p of parkSpots) {
        if (cx > p.x - 20 && cx < p.x + p.w + 20 && cy > p.y - 20 && cy < p.y + p.h + 20) blocked = true;
      }
      if (cx > plaza.x - 20 && cx < plaza.x + plaza.w + 20 && cy > plaza.y - 20 && cy < plaza.y + plaza.h + 20) blocked = true;
      if (blocked) continue;
      const d = districtAt(cx, cy);
      const tall = d.name === 'Downtown' && rng.chance(0.5);
      const w = rng.range(120, 210);
      const h = rng.range(120, 210);
      buildings.push({
        x: cx - w / 2, y: cy - h / 2, w, h,
        color: rng.pick(d.roof),
        roof: rng.pick(['#3a3d44', '#4a4d54', '#5a5d64', '#2c2f36']),
        tall, district: d.name,
        name: rng.chance(0.35) ? pickBuildingName(rng, d.name) : null,
      });
    }
  }

  // Palm trees along the beach, in the parks and on the plaza.
  for (let y = 60; y < WORLD_H; y += 130) {
    trees.push({ x: SEA_X + BEACH_W + 26 + rng.range(-8, 8), y: y + rng.range(-20, 20), palm: true });
  }
  for (const p of parkSpots) {
    for (let i = 0; i < 14; i++) {
      trees.push({ x: p.x + rng.range(20, p.w - 20), y: p.y + rng.range(20, p.h - 20), palm: rng.chance(0.6) });
    }
  }
  for (let i = 0; i < 8; i++) {
    trees.push({ x: plaza.x + rng.range(20, plaza.w - 20), y: plaza.y + rng.range(20, plaza.h - 20), palm: false });
  }
  for (let i = 0; i < 26; i++) {
    trees.push({ x: rng.range(300, WORLD_W - 100), y: rng.range(100, WORLD_H - 100), palm: rng.chance(0.25) });
  }

  // Bay coins: hidden collectibles tucked into corners of the city.
  const coinSpots = rng.shuffle(buildings).slice(0, TUNING.coinCount);
  for (const b of coinSpots) {
    coins.push({ x: b.x + b.w + 46, y: b.y + b.h / 2, taken: false });
  }

  return {
    seed,
    buildings,
    trees,
    coins,
    parks: parkSpots,
    plaza,
    garage: { x: 1000, y: 200, name: "Marisol's Garage" },
    marina: { x: 300, y: 600, name: 'Marina Pier' },
    docks: { x: 2800, y: 2100, name: 'Harbor Docks' },
    warehouse: { x: 2600, y: 1400, name: 'Bay Warehouse' },
    mansion: { x: 700, y: 2000, name: 'Hilltop Mansion' },
    hospital: { x: 1800, y: 1000, name: 'Solmar General' },
  };
}

const NAMES = {
  Marina: ['Pier Cafe', 'Salt Air Hotel', 'Yacht Club', 'Tide House'],
  'Old Town': ['Casa Verde', 'The Rusty Anchor', 'Plaza Books', 'Taco Sol'],
  Downtown: ['Bay Tower', 'Solmar Bank', 'Glass House', 'The Meridian'],
  Harbor: ['Fish Market', 'Crate & Co', 'Dockside Diner', 'Net Loft'],
  Hills: ['Villa Rosa', 'Sunset Court', 'Palm Villa', 'The Lookout'],
};

function pickBuildingName(rng, district) {
  const list = NAMES[district] || NAMES['Old Town'];
  return rng.pick(list);
}

// Clamp a point inside the world, keeping it out of the sea.
export function clampToWorld(x, y) {
  return {
    x: Math.max(SEA_X + BEACH_W + 10, Math.min(WORLD_W - 10, x)),
    y: Math.max(10, Math.min(WORLD_H - 10, y)),
  };
}

// True when a circle overlaps any building (used for collision).
export function hitsBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
