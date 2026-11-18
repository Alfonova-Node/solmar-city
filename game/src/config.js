// SOLMAR — every tuning number, colour and place in one file.
// The city is a road grid: 8 x 8 blocks, block 36 m, road 12 m wide, so the
// drivable city spans 396 m a side. Roads run at the coordinates in ROADS.
// South is the beach and the ocean; north is downtown.

export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-save-v1';

// --- City layout -----------------------------------------------------------
export const CITY = {
  blocks: 8,
  block: 36,
  road: 12,
  // Road centre lines, west/east and north/south, from -198 to +198.
  roads: [-198, -150, -102, -54, -6, 42, 90, 138, 186],
  half: 204, // half-extent of the ground plane
  oceanZ: 210, // the water starts here (south edge)
  beachZ: 186, // the sand strip starts here
};

// Districts, used to pick building height and colour per block.
export const DISTRICTS = {
  downtown: { x0: -120, x1: 60, z0: -204, z1: -60, minH: 22, maxH: 64 },
  marina: { x0: 120, x1: 204, z0: -60, z1: 120, minH: 8, maxH: 18 },
  oldtown: { x0: -204, x1: -60, z0: -60, z1: 150, minH: 6, maxH: 14 },
  beachfront: { x0: -60, x1: 204, z0: 150, z1: 204, minH: 8, maxH: 20 },
  park: { x0: -54, x1: 42, z0: -6, z1: 90, minH: 0, maxH: 0 }, // the green heart
};

export const PALETTE = {
  skyDay: 0x8ec9ee,
  skyDusk: 0xff9a5c,
  fogDay: 0xa8c8e0,
  fogDusk: 0x5c4a6e,
  sunDay: 0xfff2d8,
  sunDusk: 0xffb36b,
  road: 0x33363d,
  roadLine: 0xd8d8d8,
  sidewalk: 0x9a9a92,
  sand: 0xe8d29a,
  ocean: 0x1f7fa8,
  grass: 0x5da24a,
  building: [0xcfc4b4, 0xb8c4d0, 0xd8b8a0, 0xa8b8c8, 0xe0d0c0, 0x98a8b8],
  windowLit: 0xffd27a,
  windowDark: 0x2a3542,
  palmTrunk: 0x8a6a4a,
  palmLeaf: 0x3f8f3a,
};

// --- Player on foot --------------------------------------------------------
export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  accel: 40,
  radius: 0.55,
  health: 100,
  punchRange: 2.4,
  punchDamage: 34,
  punchCooldown: 0.45,
};

// --- Cars ------------------------------------------------------------------
export const CAR = {
  accel: 14,
  brake: 26,
  reverseAccel: 9,
  maxSpeed: 30, // ~108 km/h, player car
  trafficSpeed: 9,
  policeSpeed: 34,
  steer: 1.9, // rad/s at full lock, scaled down with speed
  radius: 2.1,
  length: 4.4,
  width: 1.9,
};

// --- Wanted / police -------------------------------------------------------
export const WANTED = {
  maxStars: 5,
  decaySeconds: 18, // seconds with no police line-of-sight to lose one star
  loseSight: 45, // police give up beyond this distance
  bustSeconds: 2, // a slow police car touching you on foot for this long busts you
  bustFine: 50,
  wastedFine: 100,
};

// --- People ----------------------------------------------------------------
export const PED_COUNT = 26;
export const TRAFFIC_COUNT = 14;

// --- Missions --------------------------------------------------------------
// Marco Vale, a driver-for-hire in Solmar, works for Rico, a fixer who runs
// jobs out of a garage in Old Town. Five jobs, one story, then free roam.
export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Fare',
    brief: 'Rico: "Pick up Lena at the pier and take her to the Coral Hotel. Drive like you mean it."',
    reward: 150,
    steps: [
      { type: 'goto', label: 'Go to the pier', x: 150, z: 220 },
      { type: 'pickup', label: 'Pick up Lena', x: 150, z: 220 },
      { type: 'goto', label: 'Drive Lena to the Coral Hotel', x: -30, z: -102, passenger: true },
    ],
  },
  {
    id: 'm2',
    title: 'Hot Wheels',
    brief: 'Rico: "A Comet GT is parked at the marina. Take it. Bring it to my garage in Old Town. The owner will not miss it until morning."',
    reward: 250,
    steps: [
      { type: 'steal', label: 'Steal the Comet GT at the marina', x: 183, z: 60, car: 'comet' },
      { type: 'deliver', label: 'Deliver the Comet GT to Rico\'s garage', x: -150, z: 80, car: 'comet' },
    ],
  },
  {
    id: 'm3',
    title: 'Lose the Heat',
    brief: 'Rico: "You have heat on you. Two stars. Get out of sight until it cools off, then meet me at Palms Park."',
    reward: 200,
    steps: [
      { type: 'evade', label: 'Lose the 2-star wanted level', stars: 2, x: 0, z: 30 },
      { type: 'goto', label: 'Meet Rico at Palms Park', x: 0, z: 30 },
    ],
  },
  {
    id: 'm4',
    title: 'The Package',
    brief: 'Rico: "A package waits at the docks. Grab it and run it to the lighthouse. The harbour police will not wave."',
    reward: 400,
    steps: [
      { type: 'pickup', label: 'Pick up the package at the docks', x: 186, z: -120 },
      { type: 'deliver', label: 'Deliver the package to the lighthouse', x: -180, z: 186, heat: 2 },
    ],
  },
  {
    id: 'm5',
    title: 'Solmar Sprint',
    brief: 'Rico: "Last job. A client at the north gate needs a case in two and a half minutes, and the whole city is awake. Make it count, Marco."',
    reward: 600,
    steps: [
      { type: 'timed', label: 'Deliver the case to the north gate', x: -6, z: -186, seconds: 150, heat: 3 },
    ],
  },
];

// Landmarks the HUD and missions point at.
export const PLACES = {
  pier: { x: 150, z: 220, label: 'Pier' },
  hotel: { x: -30, z: -102, label: 'Coral Hotel' },
  marina: { x: 183, z: 60, label: 'Marina' },
  garage: { x: -150, z: 80, label: "Rico's Garage" },
  park: { x: 0, z: 30, label: 'Palms Park' },
  docks: { x: 186, z: -120, label: 'Docks' },
  lighthouse: { x: -180, z: 186, label: 'Lighthouse' },
  northGate: { x: -6, z: -186, label: 'North Gate' },
  hospital: { x: -102, z: -150, label: 'Solmar General' },
  station: { x: 90, z: -102, label: 'Police HQ' },
};

export const START_CASH = 250;
export const FARE_MIN = 40;
export const FARE_MAX = 80;

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
