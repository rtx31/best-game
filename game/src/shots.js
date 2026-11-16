// Staged scenes for the dossier screenshots. Each shot builds a world
// from a fixed seed and steps it a fixed number of times with a scripted
// input, so the same seed always renders the same picture. The game loop
// never runs in shot mode: the scene is rendered once and frozen.
import { CFG } from './config.js';
import { createWorld, spawnEnemyAt, startWave, update } from './world.js';

/** Keep drifters out of the HUD strip so staged shots stay readable. */
function clearHudZone(world) {
  for (const e of world.enemies) {
    if (e.y < 135) e.y = 145 + world.rng() * 60;
    if (e.x < 300 && e.y < 170) e.x = 320 + world.rng() * 220;
    if (e.x > CFG.width - 260 && e.y < 130) e.y = 150 + world.rng() * 50;
  }
}

/** Top the scene up to at least n drifters, placed mid-arena. */
function topUp(world, n) {
  const kinds = ['spark', 'spark', 'mote', 'spark', 'mote'];
  let i = 0;
  while (world.enemies.length < n) {
    const kind = kinds[i % kinds.length];
    const x = 300 + world.rng() * 680;
    const y = 200 + world.rng() * 420;
    spawnEnemyAt(world, kind, x, y);
    i++;
  }
}

function scriptedInput(world, fire) {
  // Aim at the nearest drifter, drift slowly toward the arena centre.
  let target = null;
  let best = Infinity;
  for (const e of world.enemies) {
    const d = (e.x - world.player.x) ** 2 + (e.y - world.player.y) ** 2;
    if (d < best) {
      best = d;
      target = e;
    }
  }
  const aim = target ?? { x: CFG.width / 2, y: 120 };
  const keys = new Set();
  if (world.player.x < CFG.width / 2 - 60) keys.add('KeyD');
  if (world.player.x > CFG.width / 2 + 60) keys.add('KeyA');
  return { keys, mouse: { x: aim.x, y: aim.y, down: fire } };
}

function step(world, n, fire) {
  for (let i = 0; i < n; i++) update(world, scriptedInput(world, fire), 1 / 60);
}

/** Returns { view, world } for one of 'start' | 'play' | 'end' | 'action'. */
export function stageShot(kind, seed) {
  if (kind === 'start') {
    const world = createWorld(seed);
    world.best = 15200;
    return { view: 'title', world };
  }

  if (kind === 'play') {
    const world = createWorld(seed);
    world.best = 15200;
    world.player.x = 560;
    world.player.y = 430;
    startWave(world, 3);
    // Let wave 3 spawn and fight for a while, firing all the way.
    step(world, 60 * 6, true);
    // Hand-place the combo/score so the HUD reads like a real mid-game.
    if (world.combo < 9) {
      world.combo = 9;
      world.mult = 3;
      world.comboTimer = 3.2;
    }
    if (world.score < 2400) world.score = 2450;
    topUp(world, 7);
    clearHudZone(world);
    world.shake = 0;
    world.flash = 0;
    return { view: 'playing', world };
  }

  if (kind === 'end') {
    const world = createWorld(seed);
    world.best = 15200;
    world.player.x = 640;
    world.player.y = 400;
    startWave(world, 7);
    step(world, 60 * 5, true);
    // Force the end state the screenshot needs.
    world.player.lives = 0;
    world.score = 12840;
    world.wave = 7;
    world.over = true;
    clearHudZone(world);
    world.shake = 0;
    world.flash = 0;
    return { view: 'over', world };
  }

  // 'action': an elite wave — bulwark, spread shot, pickups on the floor.
  const world = createWorld(seed);
  world.best = 15200;
  world.player.x = 480;
  world.player.y = 520;
  startWave(world, 6);
  step(world, 60 * 4, true);
  world.player.spreadUntil = world.time + 8;
  world.player.rapidUntil = world.time + 6;
  world.player.shieldUntil = world.time + 5;
  world.pickups.push(
    { kind: 'shield', x: 820, y: 300, vx: 0, vy: 0, life: 11, phase: 1 },
    { kind: 'rapid', x: 900, y: 430, vx: 0, vy: 0, life: 11, phase: 2 },
  );
  if (world.combo < 12) {
    world.combo = 12;
    world.mult = 4;
    world.comboTimer = 3.6;
  }
  if (world.score < 5200) world.score = 5340;
  topUp(world, 8);
  clearHudZone(world);
  world.shake = 0;
  world.flash = 0;
  return { view: 'playing', world };
}
