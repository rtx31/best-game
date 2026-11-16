// LUMEN DRIFT — tuning and palette. One place for every number the game
// balances on, so the feel can be tuned without touching the logic.
export const CFG = {
  width: 1280,
  height: 800,
  arenaMargin: 26,

  // The player's ship.
  player: {
    radius: 14,
    accel: 1500,
    maxSpeed: 360,
    drag: 3.2,
    fireInterval: 0.16,
    rapidInterval: 0.08,
    bulletSpeed: 640,
    startLives: 3,
    maxLives: 5,
    invulnSeconds: 2.0,
  },

  // Combo: each kill adds one; the multiplier climbs one step per 4 kills,
  // up to x5, and the whole combo dies after this many quiet seconds.
  combo: { perStep: 4, maxMult: 5, windowSeconds: 4 },

  // Pickups: chance a kill drops one, and the weights of each kind.
  pickup: {
    dropChance: 0.16,
    weights: [
      ['shield', 0.3],
      ['rapid', 0.3],
      ['spread', 0.25],
      ['life', 0.15],
    ],
    durationSeconds: 10,
    magnetRadius: 110,
    collectRadius: 30,
  },

  // Enemy kinds. speed is px/s, score is the base value before the multiplier.
  enemies: {
    spark: { hp: 1, speed: 185, radius: 13, score: 100, color: '#ff4fd8' },
    mote: { hp: 2, speed: 118, radius: 18, score: 150, color: '#37e6ff' },
    bulwark: { hp: 14, speed: 58, radius: 36, score: 500, color: '#ffb347' },
  },

  // Waves: wave n fields this many drifters, spawned over time; every third
  // wave fields one bulwark elite (plus one more every six waves).
  wave: {
    baseCount: 4,
    perWave: 2,
    spawnIntervalStart: 0.95,
    spawnIntervalMin: 0.34,
    spawnIntervalStep: 0.055,
    breatherSeconds: 2.2,
    victoryWave: 10,
  },

  // Look: deep-space indigo field, cyan and magenta neon.
  palette: {
    background: '#070512',
    grid: 'rgba(90, 70, 180, 0.16)',
    player: '#5ef2ff',
    playerCore: '#eafcff',
    bullet: '#9df3ff',
    text: '#dff6ff',
    dim: '#8fa3c8',
    gold: '#ffd166',
    danger: '#ff5d7a',
    shield: '#7dffb0',
    rapid: '#ffe066',
    spread: '#c792ff',
    life: '#ff8fb0',
  },
};

/** A small deterministic RNG (mulberry32) so staged screenshots repeat exactly. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one entry from a weighted table using the given rng. */
export function pickWeighted(rng, table) {
  let total = 0;
  for (const [, w] of table) total += w;
  let roll = rng() * total;
  for (const [name, w] of table) {
    roll -= w;
    if (roll <= 0) return name;
  }
  return table[table.length - 1][0];
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};
