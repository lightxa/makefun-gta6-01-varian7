// Solmar Bay itself: a seeded coastal city of roads, blocks, buildings, a
// beach, a park and a marina. Generation is deterministic: the same seed builds
// the same streets, the same rooftops and the same landmarks every time.

import { WORLD, COLORS } from './config.js';
import { mulberry32, range, intRange, pick, shuffle } from './random.js';

// District names, one per block row, so the map reads like a real place.
const DISTRICTS = [
  'Marina Row', 'Old Pier', 'Palm Court', 'Downtown', 'Cactus Hill',
  'Sunset Strip', 'Harbor Lights', 'Coral Heights',
];

// Build the whole city from a seed. Returns roads, buildings, trees, lamps,
// zones and the named places missions point at.
export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const { width, height, block, road, beachWidth, seaWidth } = WORLD;

  // Road centre lines: vertical avenues and horizontal streets.
  const avenues = [];
  for (let x = beachWidth + seaWidth + block; x < width - block; x += block + road) avenues.push(x);
  const streets = [];
  for (let y = block; y < height - block; y += block + road) streets.push(y);

  const buildings = [];
  const trees = [];
  const lamps = [];
  const zones = [];

  // The sea and the beach run down the whole west edge.
  zones.push({ kind: 'sea', x: 0, y: 0, w: seaWidth, h: height });
  zones.push({ kind: 'beach', x: seaWidth, y: 0, w: beachWidth, h: height });

  // The park sits in the middle of the map, a green break between districts.
  const park = { kind: 'park', x: avenues[2] - road / 2, y: streets[1] - road / 2, w: block + road, h: block + road };
  zones.push(park);

  // Buildings fill every block except the park block.
  let districtIndex = 0;
  for (let bx = 0; bx < avenues.length - 1; bx++) {
    for (let by = 0; by < streets.length - 1; by++) {
      const x0 = avenues[bx] + road / 2;
      const y0 = streets[by] + road / 2;
      const x1 = avenues[bx + 1] - road / 2;
      const y1 = streets[by + 1] - road / 2;
      const isPark = x0 >= park.x - 1 && y0 >= park.y - 1 && x0 < park.x + park.w && y0 < park.y + park.h;
      if (isPark) {
        for (let i = 0; i < 14; i++) {
          trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 10, 18) });
        }
        continue;
      }
      const district = DISTRICTS[districtIndex % DISTRICTS.length];
      districtIndex++;
      const kind = pick(rng, ['tower', 'tower', 'shop', 'house', 'house', 'warehouse']);
      const count = kind === 'tower' ? 1 : intRange(rng, 2, 4);
      for (let i = 0; i < count; i++) {
        const bw = kind === 'tower' ? range(rng, 90, 130) : range(rng, 56, 96);
        const bh = kind === 'tower' ? range(rng, 90, 130) : range(rng, 56, 96);
        const bx0 = range(rng, x0 + 14, Math.max(x0 + 15, x1 - bw - 14));
        const by0 = range(rng, y0 + 14, Math.max(y0 + 15, y1 - bh - 14));
        buildings.push({
          x: bx0, y: by0, w: bw, h: bh,
          kind, district,
          roof: pick(rng, COLORS.buildingRoof),
          height: kind === 'tower' ? intRange(rng, 3, 6) : intRange(rng, 1, 2),
        });
      }
      if (rng() < 0.7) trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 8, 14) });
    }
  }

  // Street lamps along the avenues, for the night glow and the minimap.
  for (const x of avenues) {
    for (const y of streets) {
      lamps.push({ x: x - road / 2 + 8, y: y - road / 2 + 8 });
      lamps.push({ x: x + road / 2 - 8, y: y + road / 2 - 8 });
    }
  }

  // Named places the story points at: the garage, the pier, the hotel, the depot.
  const garage = { x: avenues[0] + 60, y: streets[streets.length - 1] + 40, name: "Rico's Garage" };
  const pier = { x: seaWidth + beachWidth / 2, y: streets[0], name: 'Old Pier' };
  const hotel = { x: avenues[avenues.length - 1] - 40, y: streets[0] + 30, name: 'Hotel Miramar' };
  const depot = { x: avenues[avenues.length - 1] - 40, y: streets[streets.length - 1] - 30, name: 'Harbor Depot' };
  const plaza = { x: avenues[2], y: streets[2], name: 'Palm Court Plaza' };

  // Parked cars the player can steal, placed on road shoulders.
  const parked = [];
  const parkedSpots = shuffle(rng, avenues.flatMap((x) => streets.map((y) => ({ x, y }))));
  for (let i = 0; i < 10; i++) {
    const spot = parkedSpots[i];
    parked.push({
      x: spot.x + road / 2 - 14,
      y: spot.y + range(rng, -120, 120),
      angle: Math.PI / 2,
      color: pick(rng, COLORS.trafficCar),
      kind: pick(rng, ['sedan', 'coupe', 'van', 'pickup']),
    });
  }

  return {
    seed, avenues, streets, buildings, trees, lamps, zones, park,
    garage, pier, hotel, depot, plaza, parked,
    spawn: { x: garage.x + 90, y: garage.y + 60, angle: 0 },
  };
}

// Is this point on a road (used by traffic to stay in its lane)?
export function isOnRoad(world, x, y) {
  const half = WORLD.road / 2;
  for (const ax of world.avenues) if (Math.abs(x - ax) <= half) return true;
  for (const sy of world.streets) if (Math.abs(y - sy) <= half) return true;
  return false;
}

// Is this point in the sea (the player and cars cannot drive there)?
export function isInSea(world, x, y) {
  return x < WORLD.seaWidth;
}

// Push a circle out of every building it overlaps. Returns true when a push happened.
export function collideBuildings(world, body) {
  let hit = false;
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < body.r * body.r) {
      hit = true;
      const d = Math.sqrt(d2) || 0.001;
      const push = body.r - d;
      body.x += (dx / d) * push;
      body.y += (dy / d) * push;
    }
  }
  return hit;
}

// Keep a body inside the world, out of the sea, and off the map edge.
export function clampToWorld(world, body) {
  const minX = WORLD.seaWidth + body.r;
  if (body.x < minX) body.x = minX;
  if (body.x > WORLD.width - body.r) body.x = WORLD.width - body.r;
  if (body.y < body.r) body.y = body.r;
  if (body.y > WORLD.height - body.r) body.y = WORLD.height - body.r;
}

// The nearest road centre to a point, for traffic spawning and routing.
export function nearestRoad(world, x, y) {
  let best = { axis: 'v', at: world.avenues[0], d: Infinity };
  for (const ax of world.avenues) {
    const d = Math.abs(x - ax);
    if (d < best.d) best = { axis: 'v', at: ax, d };
  }
  for (const sy of world.streets) {
    const d = Math.abs(y - sy);
    if (d < best.d) best = { axis: 'h', at: sy, d };
  }
  return best;
}
