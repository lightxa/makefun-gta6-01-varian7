// Solmar Bay — configuration and story data.
// An original sun-soaked coastal crime city. Every name, character,
// district and vehicle here is invented; nothing comes from a commercial game.
export const WORLD_W = 3600;
export const WORLD_H = 2600;
export const ROAD_W = 84;
export const SEED_DEFAULT = 7;

// Road centre lines. The city is a grid; the west edge is the beach and the
// sea, the east edge the harbor docks.
export const ROADS_X = [300, 700, 1100, 1500, 1900, 2300, 2700, 3100];
export const ROADS_Y = [300, 650, 1000, 1350, 1700, 2050];
export const BEACH_X = 120;
export const WATER_X = 0;
export const BEACH_W = 120;

export const DISTRICTS = [
  { name: 'Marina', x: 150, y: 150, w: 800, h: 500, tint: '#7ec8e3' },
  { name: 'Old Town', x: 150, y: 800, w: 800, h: 600, tint: '#e8b04b' },
  { name: 'Palm Row', x: 1150, y: 150, w: 900, h: 600, tint: '#ff9d76' },
  { name: 'Downtown', x: 1150, y: 900, w: 900, h: 700, tint: '#8fa8c8' },
  { name: 'Harbor', x: 2250, y: 150, w: 900, h: 700, tint: '#5fa8a0' },
  { name: 'Sunset Hills', x: 2250, y: 1000, w: 900, h: 600, tint: '#c98ad6' },
];

export const CAR_COLORS = [
  '#e63946', '#f4a261', '#2a9d8f', '#4361ee', '#f7d154',
  '#9d4edd', '#06d6a0', '#ef476f', '#118ab2', '#ffbe0b',
  '#adb5bd', '#212529', '#e07a5f', '#81b29a',
];

export const CAR_MODELS = [
  'Solstice', 'Pelican', 'Marlin GT', 'Cactus', 'Bayliner',
  'Tortuga', 'Flamingo', 'Sardine', 'Coral', 'Hurricane',
];

export const PED_SHIRTS = [
  '#e63946', '#2a9d8f', '#f4a261', '#4361ee', '#ffbe0b',
  '#9d4edd', '#06d6a0', '#ef476f', '#118ab2', '#f1faee',
];

export const PALETTE = {
  grass: '#7fb069',
  grassDark: '#6a9a58',
  sand: '#ecd9a0',
  water: '#2a9dbe',
  waterDeep: '#1d7a99',
  road: '#3d3d4d',
  roadLine: '#e8e8d0',
  sidewalk: '#b8b0a0',
  park: '#5da85f',
  plaza: '#c9c2b4',
  buildingRoof: ['#c96f4a', '#7d8aa5', '#a5b8d0', '#d9a441', '#8a6f9e', '#5f8a6a'],
  buildingWall: ['#e8dcc8', '#d8c8b0', '#c8d4e0', '#e8c8a0', '#d0c0d8', '#c8e0c8'],
};

export const MISSIONS = [
  {
    id: 1,
    title: 'First Wheels',
    giver: 'Rosa Marlin',
    briefing: 'Rosa needs wheels. Borrow a car from the street and bring it to her garage on Palm Row.',
    reward: 250,
    steps: [
      { type: 'enterCar', text: 'Take a car — walk up to one and press E' },
      { type: 'reach', at: 'garage', text: 'Drive to Rosa\u2019s garage' },
    ],
  },
  {
    id: 2,
    title: 'Bayfront Pickup',
    giver: 'Rosa Marlin',
    briefing: 'A package is waiting at the marina. Pick it up on foot, then deliver it to the Palm Row cafe.',
    reward: 500,
    steps: [
      { type: 'reach', at: 'marina', text: 'Go to the marina drop point' },
      { type: 'pickup', at: 'marina', text: 'Pick up the package (stand on the marker)' },
      { type: 'reach', at: 'cafe', text: 'Deliver the package to the Palm Row cafe' },
    ],
  },
  {
    id: 3,
    title: 'The Getaway',
    giver: 'Dario Sol',
    briefing: 'The harbor crew tipped off the police. Lose the heat, then lay low at the safehouse.',
    reward: 750,
    steps: [
      { type: 'wanted', level: 2, text: 'The police are on you — wanted level 2' },
      { type: 'loseHeat', text: 'Lose the police (wanted level back to 0)' },
      { type: 'reach', at: 'safehouse', text: 'Reach the safehouse in Sunset Hills' },
    ],
  },
  {
    id: 4,
    title: 'Harbor Heat',
    giver: 'Dario Sol',
    briefing: 'Three checkpoints around the harbor, against the clock. Drive fast, drive clean.',
    reward: 1000,
    steps: [
      { type: 'checkpoint', at: 'dockA', time: 45, text: 'Checkpoint 1 of 3 — Harbor Dock A' },
      { type: 'checkpoint', at: 'dockB', time: 45, text: 'Checkpoint 2 of 3 — Harbor Dock B' },
      { type: 'checkpoint', at: 'dockC', time: 45, text: 'Checkpoint 3 of 3 — Harbor Dock C' },
    ],
  },
  {
    id: 5,
    title: 'The Solmar Job',
    giver: 'Rosa Marlin',
    briefing: 'One last job: hold the bank plaza for five seconds, grab the cash, and bring it home with the whole city chasing you.',
    reward: 2500,
    steps: [
      { type: 'reach', at: 'bank', text: 'Go to the Downtown bank plaza' },
      { type: 'hold', at: 'bank', seconds: 5, text: 'Hold the plaza — grab the cash!' },
      { type: 'reach', at: 'safehouse', text: 'Escape to the safehouse with the cash' },
    ],
  },
];

export const STORY_INTRO =
  'Solmar Bay: a sun-soaked coastal city where the tide brings in money and trouble in equal measure. ' +
  'You are Kit Vela, a driver with no car and big debts. Rosa Marlin runs the garage on Palm Row. ' +
  'Dario Sol runs the harbor. Work for both, stay ahead of the Solmar Bay Police, and buy your way out.';

export const CONTROLS_TEXT = [
  'WASD / Arrows — walk or drive',
  'E — steal / enter a car, exit a car',
  'Space or Click — punch / fight',
  'Shift — sprint / boost',
  'P or Esc — pause',
  'M — mute sound',
  'R — restart after busted or wasted',
];

export const TUNING = {
  walkSpeed: 170,
  runSpeed: 265,
  carAccel: 420,
  carBrake: 620,
  carMaxSpeed: 520,
  carReverseMax: 180,
  carTurn: 2.6,
  carDrag: 0.55,
  punchRange: 46,
  punchDamage: 34,
  punchCooldown: 0.45,
  wantedDecayDelay: 6,
  policeCatchTime: 1.6,
};

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  if (x < BEACH_X + BEACH_W) return 'Solmar Beach';
  return 'Solmar Bay';
}
