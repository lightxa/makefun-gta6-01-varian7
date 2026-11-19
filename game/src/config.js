// SOLMAR BAY — configuration: world size, districts, palette, vehicles,
// mission script and tuning. All names, places and characters are original.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 76;
export const BLOCK = 320;

// Vertical and horizontal road centre lines (a regular city grid).
export const ROADS_X = [160, 480, 800, 1120, 1440, 1760, 2080, 2400, 2720, 3040];
export const ROADS_Y = [160, 480, 800, 1120, 1440, 1760, 2080];

// South of this line is sand, then open water.
export const BEACH_Y = 2120;
export const WATER_Y = 2270;

export const DISTRICTS = [
  { name: 'MARINA', x0: 0, y0: 0, x1: 640, y1: 960, tint: '#3f7f9e' },
  { name: 'DOWNTOWN', x0: 640, y0: 0, x1: 2080, y1: 1120, tint: '#c98f3d' },
  { name: 'MARKET ROW', x0: 2080, y0: 0, x1: 3200, y1: 1120, tint: '#b85c6e' },
  { name: 'OLD TOWN', x0: 0, y0: 960, x1: 1440, y1: 2120, tint: '#7d9b57' },
  { name: 'PALM HEIGHTS', x0: 1440, y0: 1120, x1: 3200, y1: 2120, tint: '#8a6fb0' },
  { name: 'SOLMAR BEACH', x0: 0, y0: 2120, x1: 3200, y1: 2400, tint: '#e8c878' },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'SOLMAR BAY';
}

// Palette for the sun-soaked look: warm asphalt, sand, pastel walls.
export const PALETTE = {
  grass: '#7fae62',
  grassDark: '#6d9c54',
  asphalt: '#3d3a38',
  asphaltLine: '#e8d44f',
  sidewalk: '#b9b2a4',
  sand: '#ecd090',
  water: '#2f7fb8',
  waterDeep: '#22608f',
  buildingRoofs: ['#c96f4a', '#d9a05b', '#7d9b57', '#5b8aa0', '#b85c6e', '#8a6fb0', '#e0d6c0', '#4a7d6a'],
  buildingWalls: ['#e8dcc8', '#f2e6d0', '#dcc7a8', '#cfe0d8', '#e8c8b8'],
  parkTree: '#3e7d3a',
  parkTreeLight: '#57a047',
};

export const CAR_COLORS = [
  '#d94f3d', '#3d7dd9', '#e8c33d', '#4ad97b', '#e8e8e8', '#2b2b33',
  '#d97bb0', '#7bd9d0', '#f08a2d', '#8a5bd9', '#a8c23d', '#c0c8d0',
];

export const CAR_MODELS = [
  { name: 'Pinto', top: 150, accel: 340, grip: 2.6 },
  { name: 'Sedan', top: 210, accel: 380, grip: 2.8 },
  { name: 'Comet GT', top: 300, accel: 520, grip: 3.4 },
  { name: 'Van', top: 130, accel: 300, grip: 2.2 },
  { name: 'Taxi', top: 200, accel: 400, grip: 2.9 },
  { name: 'Pickup', top: 180, accel: 360, grip: 2.7 },
];

// Story missions. Positions are world coordinates on the road grid.
export const MISSIONS = [
  {
    id: 1, title: 'First Errand', giver: 'Mama Sol',
    brief: 'Mama Sol needs a package run from her diner to the marina. On foot is fine. Do not keep her waiting.',
    reward: 300,
    steps: [
      { kind: 'goto', x: 480, y: 480, label: 'Pick up the package at Sol Diner', radius: 70 },
      { kind: 'goto', x: 160, y: 800, label: 'Deliver the package to Pier 4', radius: 70 },
    ],
  },
  {
    id: 2, title: 'Hot Wheels', giver: 'Mama Sol',
    brief: 'A Comet GT is parked outside the Downtown bank. Take it. The owner will not miss it. Probably.',
    reward: 500,
    steps: [
      { kind: 'steal', x: 1440, y: 800, label: 'Steal the Comet GT (press E beside it)', radius: 90 },
      { kind: 'driveTo', x: 2400, y: 1440, label: 'Drive it to the chop garage in Palm Heights', radius: 90 },
    ],
  },
  {
    id: 3, title: 'Getaway Driver', giver: 'Vex',
    brief: 'Vex needs wheels out of Market Row, fast. Pick him up, then hit both checkpoints before the clock runs out.',
    reward: 800,
    steps: [
      { kind: 'goto', x: 2720, y: 480, label: 'Pick up Vex at the Market Row corner', radius: 70 },
      { kind: 'driveTo', x: 800, y: 1760, label: 'Checkpoint 1: Old Town square', radius: 100, time: 75 },
      { kind: 'driveTo', x: 3040, y: 2080, label: 'Checkpoint 2: the beach road', radius: 100, time: 75 },
    ],
  },
  {
    id: 4, title: 'Lose the Tail', giver: 'Vex',
    brief: 'Three stars and the whole Solmar force on your bumper. Break line of sight and stay hidden until the heat dies.',
    reward: 1000,
    steps: [
      { kind: 'escape', label: 'Lose the police: stay out of sight until your wanted level drops', time: 90 },
    ],
  },
  {
    id: 5, title: 'The Big Score', giver: 'Mama Sol',
    brief: 'One last job. Grab the cash from the Downtown bank, then run the gauntlet to the hideout on Pier 4. Make it count.',
    reward: 2500,
    steps: [
      { kind: 'goto', x: 1440, y: 800, label: 'Enter the Downtown bank', radius: 80 },
      { kind: 'goto', x: 160, y: 800, label: 'Escape to the Pier 4 hideout', radius: 90 },
    ],
  },
];

export const TUNING = {
  walkSpeed: 175,
  runSpeed: 265,
  carAccel: 420,
  carReverse: 200,
  carDrag: 0.55,
  carGrip: 3.0,
  wantedDecayDelay: 5,
  wantedDecayRate: 7,
  policeRamDamage: 4,
  punchDamage: 34,
  shotDamage: 55,
  startingCash: 120,
  startingAmmo: 24,
  trafficCount: 26,
  pedCount: 34,
  maxWanted: 5,
};
