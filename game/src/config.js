// Solmar Bay configuration: the city's shape, the player's numbers, the keys
// and the palette. One place holds every tunable value so the rest of the game
// reads constants instead of magic numbers.

export const GAME_TITLE = 'SOLMAR BAY';
export const GAME_SUBTITLE = 'A sun-soaked coastal crime story';
export const WORLD_SEED = 20261119;

// The world is a grid of blocks separated by roads. The sea hugs the west edge.
export const WORLD = {
  width: 3600,
  height: 2800,
  block: 340,
  road: 96,
  beachWidth: 260,
  seaWidth: 320,
};

// Canvas and camera.
export const VIEW = { width: 1280, height: 800 };
export const CAMERA = { zoom: 1.0, follow: 0.12 };

// The player on foot and behind the wheel.
export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  runSpeed: 265,
  health: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.38,
  pistolDamage: 26,
  pistolRange: 420,
  pistolCooldown: 0.28,
  startCash: 120,
  startAmmo: 48,
};

// Cars: top speed in px/s, acceleration, grip and how hard they hit.
export const CAR = {
  radius: 20,
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 190,
  turn: 2.6,
  grip: 0.94,
};

// The wanted system: heat builds with crimes and cools when the police lose you.
export const WANTED = {
  max: 5,
  stealCar: 1,
  assault: 1,
  shoot: 2,
  killPed: 2,
  decayDelay: 9,
  decayRate: 0.55,
  maxPolice: 6,
};

// Traffic and pedestrians.
export const TRAFFIC = { cars: 26, peds: 46, carSpeedMin: 130, carSpeedMax: 230 };
export const PED = { walkMin: 34, walkMax: 62, fleeSpeed: 150 };

// Missions pay cash and unlock the next chapter of the story.
export const MISSION_REWARDS = [400, 900, 1600];

// The palette: warm sun, pale sand, teal water, pastel rooftops.
export const COLORS = {
  grass: '#7fae5a',
  park: '#69a34e',
  sand: '#ecd9a4',
  sea: '#2e8fb0',
  seaDeep: '#1f6f8e',
  road: '#3d3a38',
  roadLine: '#e8d44d',
  sidewalk: '#b9b2a4',
  buildingRoof: ['#c96f4a', '#d9a441', '#7d9bb5', '#b5658a', '#8a7fbf', '#5aa08a'],
  buildingWall: '#e8e0cf',
  player: '#f2c14e',
  playerCar: '#e2483d',
  police: '#20242e',
  policeLight: '#ff2d2d',
  policeLight2: '#2d6bff',
  trafficCar: ['#4a7fb5', '#c9c9c9', '#5a8a4a', '#b56a3a', '#8a6fb5', '#d9d9d9'],
  ped: ['#e8e8e8', '#7fb5d9', '#d97f7f', '#9fd97f', '#d9c97f'],
  hudBg: 'rgba(12, 16, 24, 0.72)',
  hudText: '#f5f0e1',
  star: '#ffd23d',
  marker: '#ffd23d',
};

// Keyboard controls, shown on the start screen and in the pause menu.
export const CONTROLS = [
  ['W A S D / Arrows', 'Move / drive'],
  ['Shift', 'Sprint'],
  ['E', 'Enter / exit car'],
  ['F', 'Punch'],
  ['Mouse + Click', 'Aim and shoot'],
  ['Space', 'Handbrake'],
  ['M', 'Toggle mission list'],
  ['P / Esc', 'Pause'],
  ['R', 'Restart after busted'],
];
