// SOLMAR — settings: every tuning number, district and mission of the game.
// One place for the constants so the other modules stay small and readable.

export const WORLD = {
  blocks: 8, // the city is an 8x8 grid of blocks
  blockSize: 42, // metres of one block, road included
  roadWidth: 12,
  groundSize: 520,
  seaLevel: -0.4,
};

export const DISTRICTS = [
  // name, x range, z range, palette key
  { name: 'Downtown', x0: -84, x1: 84, z0: -168, z1: -42, kind: 'tower' },
  { name: 'Old Town', x0: -168, x1: -84, z0: -42, z1: 84, kind: 'low' },
  { name: 'Marina', x0: 84, x1: 168, z0: -84, z1: 42, kind: 'marina' },
  { name: 'Park', x0: -42, x1: 42, z0: -42, z1: 42, kind: 'park' },
  { name: 'Beachfront', x0: -84, x1: 84, z0: 84, z1: 168, kind: 'beach' },
  { name: 'Beach', x0: -168, x1: 168, z0: 168, z1: 210, kind: 'sand' },
];

export const PALETTE = {
  skyDay: 0x87bfe8,
  skyDusk: 0xff9a5c,
  fogDay: 0xa8c8e0,
  fogDusk: 0xe08a5a,
  sunDay: 0xfff2d8,
  sunDusk: 0xffb36b,
  asphalt: 0x2e3138,
  sidewalk: 0x8d8f96,
  sand: 0xe3cf9e,
  sea: 0x2a7fa8,
  grass: 0x5da24a,
  towerGlass: 0x4d7ea8,
  towerBrick: 0x9a6a4f,
  lowRoof: 0x7a4a3a,
  marinaRoof: 0xd8e8f0,
};

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 11,
  health: 100,
  punchDamage: 25,
  pistolDamage: 45,
  pistolRange: 55,
  pistolAmmo: 24,
  startMoney: 50,
};

export const CAR = {
  topSpeed: 42, // m/s, about 150 km/h
  accel: 16,
  brake: 30,
  reverseTop: 12,
  steer: 1.9, // rad/s at full lock, scaled by speed
  grip: 0.92,
  trafficCount: 14,
  policeTopSpeed: 46,
};

export const PEDS = { count: 26, walkSpeed: 1.6 };

export const WANTED = {
  max: 5,
  decaySeconds: 22, // seconds without a crime before one star fades
  stealCar: 1,
  hitPed: 1,
  shoot: 2,
  punchCop: 2,
  maxCops: [0, 1, 2, 3, 4, 5],
};

export const MISSIONS = [
  {
    id: 'fare',
    name: 'First Fare',
    pay: 150,
    brief: 'Rico needs a driver. Pick up the passenger waiting at the Marina and take her to the Grand Solmar hotel in Downtown.',
    steps: [
      { kind: 'goto', label: 'Pick up the passenger at the Marina', x: 132, z: -30 },
      { kind: 'goto', label: 'Drop her at the Grand Solmar, Downtown', x: -12, z: -120 },
    ],
  },
  {
    id: 'wheels',
    name: 'Hot Wheels',
    pay: 250,
    brief: 'A crimson Comet GT is parked by the Park. Steal it and bring it to Rico\'s garage in Old Town. The owner will not be pleased.',
    steps: [
      { kind: 'steal', label: 'Steal the crimson Comet GT by the Park', x: 48, z: 30, car: 'comet' },
      { kind: 'goto', label: 'Deliver it to Rico\'s garage, Old Town', x: -132, z: 30 },
    ],
  },
  {
    id: 'heat',
    name: 'Lose the Heat',
    pay: 200,
    brief: 'The Solmar PD is on your tail. Lose them — stay out of sight or outrun them for 60 seconds, then reach the hideout under the pier.',
    steps: [
      { kind: 'survive', label: 'Lose the police — survive 60 seconds', seconds: 60 },
      { kind: 'goto', label: 'Reach the hideout under the pier', x: 150, z: 186 },
    ],
  },
  {
    id: 'package',
    name: 'The Package',
    pay: 400,
    brief: 'Pick up the package at the end of the pier. The cops are watching the docks — keep it quiet, or lose them fast.',
    steps: [
      { kind: 'goto', label: 'Collect the package at the pier', x: 168, z: 192 },
      { kind: 'goto', label: 'Deliver it to the Beachfront bar', x: 36, z: 132 },
    ],
  },
  {
    id: 'sprint',
    name: 'Solmar Sprint',
    pay: 600,
    brief: 'Rico\'s last test: a sprint through five checkpoints across the whole city. Beat the clock — 150 seconds, no excuses.',
    steps: [
      { kind: 'race', label: 'Sprint: checkpoint 1/5 — Downtown', x: -60, z: -132, seconds: 150 },
      { kind: 'race', label: 'Sprint: checkpoint 2/5 — Old Town', x: -138, z: -6 },
      { kind: 'race', label: 'Sprint: checkpoint 3/5 — Marina', x: 138, z: -60 },
      { kind: 'race', label: 'Sprint: checkpoint 4/5 — Beachfront', x: -48, z: 144 },
      { kind: 'race', label: 'Sprint: checkpoint 5/5 — the Lighthouse', x: 186, z: 186 },
    ],
  },
];

export const TAXI_FARES = [
  { from: 'Downtown', x: -12, z: -120, to: 'Beachfront', tx: 60, tz: 138, pay: 45 },
  { from: 'Marina', x: 132, z: -30, to: 'Old Town', tx: -132, tz: 30, pay: 50 },
  { from: 'Park', x: 0, z: 0, to: 'Marina', tx: 138, tz: 6, pay: 40 },
  { from: 'Beachfront', x: 60, z: 138, to: 'Downtown', tx: 24, tz: -108, pay: 55 },
];

export const SPAWN = { x: -120, z: 12, heading: Math.PI / 2 }; // Rico's garage, Old Town

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enterCar: ['KeyE'],
  punch: ['KeyF'],
  reload: ['KeyR'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
};
