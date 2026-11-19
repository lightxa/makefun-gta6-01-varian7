// Deterministic random numbers for Solmar Bay. The city, the traffic and the
// pedestrians all come from seeded generators, so the same seed always builds
// the same city and the same opening traffic.

// Mulberry32: a small, fast seeded generator with a long period.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A stable hash of a short string, for seeding a generator from a name.
export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// A number in [min, max) from a generator.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// A whole number in [min, max] from a generator.
export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// One element of an array, picked by a generator.
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// A shuffled copy of an array (Fisher-Yates, driven by the given generator).
export function shuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// Clamp a value into [min, max].
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

// The shortest signed angle from a to b, in radians.
export function angleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Distance between two points.
export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}
