// Game-wide tunables: car line-up, difficulty presets, opponents.

export const GAME_TITLE = 'STALL RACER';

// Physics specs per car. Units: metres, seconds, radians.
//  vMax      top speed (m/s)            accel    launch acceleration (m/s^2)
//  brake     braking deceleration       aGrip    lateral grip limit (m/s^2)
//  rMin      tightest turning radius    grip     how fast sideways slip dies (1/s)
//  driftGrip grip while hand-braking    yawResp  how quickly the car rotates (1/s)
export const CAR_TYPES = [
  {
    id: 'vortex',
    name: 'Vortex GT',
    tagline: 'Balanced all-rounder',
    color: 0xd61f2c,
    stripe: 0xf5f5f5,
    vMax: 73,
    accel: 14,
    brake: 30,
    aGrip: 21,
    rMin: 5.6,
    grip: 9.5,
    driftGrip: 1.5,
    yawResp: 9,
  },
  {
    id: 'phantom',
    name: 'Phantom R',
    tagline: 'Brutal top speed',
    color: 0x1d5be8,
    stripe: 0xf5f5f5,
    vMax: 79,
    accel: 13,
    brake: 29,
    aGrip: 19.2,
    rMin: 6,
    grip: 8.5,
    driftGrip: 1.3,
    yawResp: 8,
  },
  {
    id: 'viper',
    name: 'Viper S',
    tagline: 'Nimble, grippy, quick off the line',
    color: 0xf5b301,
    stripe: 0x141414,
    vMax: 69,
    accel: 15.8,
    brake: 31,
    aGrip: 23.5,
    rMin: 5.2,
    grip: 10.5,
    driftGrip: 1.7,
    yawResp: 10,
  },
];

export function carStats(spec) {
  const norm = (v, a, b) => Math.min(1, Math.max(0.08, (v - a) / (b - a)));
  return {
    speed: norm(spec.vMax, 60, 82),
    accel: norm(spec.accel, 10, 17),
    handling: norm(spec.aGrip, 16, 25),
  };
}

export const AI_COLORS = [
  { color: 0x16a34a, stripe: 0xffffff },
  { color: 0xf97316, stripe: 0x111111 },
  { color: 0x8b2fd9, stripe: 0xf5d90a },
  { color: 0x0ea5e9, stripe: 0xffffff },
  { color: 0xf2f2f2, stripe: 0xd61f2c },
  { color: 0x1f1f1f, stripe: 0xf5b301 },
  { color: 0xdb2777, stripe: 0xffffff },
  { color: 0x84cc16, stripe: 0x111111 },
  { color: 0x0f766e, stripe: 0xfacc15 },
];

export const AI_NAMES = ['Blaze', 'Nova', 'Rex', 'Kai', 'Luna', 'Ace', 'Jett', 'Zara', 'Dash'];

export const DIFFICULTY = {
  easy: { label: 'Easy', skill: [0.8, 0.88], rubber: 0.1 },
  normal: { label: 'Normal', skill: [0.9, 0.97], rubber: 0.06 },
  hard: { label: 'Hard', skill: [0.97, 1.04], rubber: 0.03 },
};

export const LAP_OPTIONS = [1, 3, 5];
export const OPPONENT_OPTIONS = [3, 5, 7];

export const DEFAULT_SETTINGS = {
  car: 0,
  laps: 3,
  opponents: 5,
  difficulty: 'normal',
  muted: false,
  camera: 0,
};

export const BOOST = {
  accel: 10, // extra acceleration while boosting
  speedBonus: 0.17, // top speed increase while boosting
  drain: 0.3, // per second
  regen: 0.018, // passive regen per second
  driftGain: 0.011, // per (m/s of slide) per second
  start: 0.5,
};
