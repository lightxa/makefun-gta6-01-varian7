// config.js — tuning and look constants for Solmar Bay.
// One place for every number that shapes how the city feels and plays.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_STEP = 400;
export const ROAD_HALF = 34;
export const LANE = 17;
export const SEA_X = 150;
export const BEACH_W = 90;

export const GAME_SEED = 20261119;

export const COLORS = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sand: '#e8d29a',
  sea: '#2e7fa8',
  seaDeep: '#1f6a92',
  road: '#3a3d44',
  roadEdge: '#2c2f36',
  lane: '#d8c95a',
  sidewalk: '#b9b3a4',
  park: '#5d9440',
  plaza: '#c9c2b2',
};

export const DISTRICTS = [
  { name: 'Marina', x0: 150, y0: 0, x1: 900, y1: 800, roof: ['#e8a06a', '#d98f5f', '#c97e52'], accent: '#2e7fa8' },
  { name: 'Old Town', x0: 900, y0: 0, x1: 1900, y1: 1200, roof: ['#c96f4a', '#b95f3e', '#a85434'], accent: '#e8c85a' },
  { name: 'Downtown', x0: 1900, y0: 0, x1: 3200, y1: 1200, roof: ['#5a7ea8', '#4a6e98', '#6a8eb8'], accent: '#7fb2d9' },
  { name: 'Harbor', x0: 900, y0: 1200, x1: 3200, y1: 2400, roof: ['#8a7a5a', '#7a6a4a', '#9a8a6a'], accent: '#d98f5f' },
  { name: 'Hills', x0: 150, y0: 800, x1: 900, y1: 2400, roof: ['#a85a6a', '#98504a', '#b86a5a'], accent: '#e8a06a' },
];

export const CAR_MODELS = [
  { name: 'Solmar Comet', color: '#d94f3d', top: 430, accel: 320, grip: 2.6 },
  { name: 'Bay Cruiser', color: '#3d7fd9', top: 380, accel: 260, grip: 2.2 },
  { name: 'Palm Taxi', color: '#e8c832', top: 360, accel: 250, grip: 2.1 },
  { name: 'Harbor Hauler', color: '#7a8a7a', top: 300, accel: 190, grip: 1.8 },
  { name: 'Sunset Coupe', color: '#c93d8a', top: 450, accel: 340, grip: 2.8 },
  { name: 'Marina Van', color: '#e8e8e8', top: 320, accel: 210, grip: 1.9 },
  { name: 'Dune Buggy', color: '#e89a3d', top: 400, accel: 300, grip: 2.4 },
];

export const PED_SHIRTS = ['#e85a5a', '#5a8ae8', '#5ae88a', '#e8d25a', '#c95ae8', '#e8e8e8', '#3a3a3a', '#e89a5a'];

export const TUNING = {
  walkSpeed: 185,
  sprintSpeed: 265,
  carReverseTop: 140,
  brake: 520,
  drag: 0.9,
  offroadDrag: 1.6,
  punchRange: 34,
  punchDamage: 34,
  playerHealth: 100,
  copTouchDamage: 8,
  wantedDecaySeconds: 26,
  policeSpawnDelay: 2.2,
  trafficCount: 26,
  pedCount: 42,
  coinCount: 20,
  coinValue: 150,
  taxiFare: 120,
};

export const CONTROLS = [
  ['W A S D / arrows', 'Walk or drive'],
  ['E', 'Steal / enter car, exit car, interact'],
  ['Space', 'Handbrake'],
  ['Shift', 'Sprint on foot'],
  ['F', 'Punch'],
  ['M', 'Mute sound'],
  ['Esc / P', 'Pause'],
];
