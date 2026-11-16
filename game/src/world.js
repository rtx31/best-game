// LUMEN DRIFT — the world: ships, drifters, bullets, pickups and waves.
// Pure state plus one update step; rendering lives in render.js, input in
// input.js, sound in audio.js. Every random choice comes from the world's
// own seeded rng so a staged scene repeats exactly.
import { CFG, clamp, dist2, makeRng, pickWeighted } from './config.js';

const TAU = Math.PI * 2;

function randEdgePoint(rng) {
  const m = CFG.arenaMargin;
  const side = Math.floor(rng() * 4);
  if (side === 0) return { x: m + rng() * (CFG.width - 2 * m), y: m };
  if (side === 1) return { x: m + rng() * (CFG.width - 2 * m), y: CFG.height - m };
  if (side === 2) return { x: m, y: m + rng() * (CFG.height - 2 * m) };
  return { x: CFG.width - m, y: m + rng() * (CFG.height - 2 * m) };
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: rng() * CFG.width,
      y: rng() * CFG.height,
      r: 0.6 + rng() * 1.7,
      tw: rng() * TAU,
      depth: 0.2 + rng() * 0.8,
    });
  }
  const world = {
    rng,
    time: 0,
    stars,
    player: {
      x: CFG.width / 2,
      y: CFG.height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      lives: CFG.player.startLives,
      invuln: 0,
      fireTimer: 0,
      shieldUntil: 0,
      rapidUntil: 0,
      spreadUntil: 0,
      thrust: 0,
    },
    bullets: [],
    enemies: [],
    particles: [],
    pickups: [],
    texts: [],
    score: 0,
    best: 0,
    combo: 0,
    comboTimer: 0,
    mult: 1,
    wave: 0,
    waveState: 'idle', // idle | spawning | fighting | breather
    spawnQueue: [],
    spawnTimer: 0,
    spawnInterval: 1,
    breatherTimer: 0,
    kills: 0,
    shake: 0,
    flash: 0,
    over: false,
    victory: false,
    events: [], // sound cues collected per step: 'shoot' | 'kill' | 'bigkill' | 'hit' | 'pickup' | 'wave' | 'victory' | 'gameover'
  };
  return world;
}

/** How many drifters wave n fields, and of which kinds. */
function waveRoster(rng, wave) {
  const count = CFG.wave.baseCount + CFG.wave.perWave * wave;
  const roster = [];
  for (let i = 0; i < count; i++) {
    // Motes join from wave 2, and grow more common as waves climb.
    const moteChance = wave < 2 ? 0 : Math.min(0.45, 0.12 + wave * 0.03);
    roster.push(rng() < moteChance ? 'mote' : 'spark');
  }
  if (wave % 3 === 0) {
    const elites = 1 + Math.floor(wave / 6);
    for (let i = 0; i < elites; i++) roster.push('bulwark');
  }
  // Shuffle so kinds arrive mixed.
  for (let i = roster.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [roster[i], roster[j]] = [roster[j], roster[i]];
  }
  return roster;
}

export function startWave(world, wave) {
  world.wave = wave;
  world.spawnQueue = waveRoster(world.rng, wave);
  world.spawnInterval = Math.max(
    CFG.wave.spawnIntervalMin,
    CFG.wave.spawnIntervalStart - CFG.wave.spawnIntervalStep * wave,
  );
  world.spawnTimer = 0.4;
  world.waveState = 'spawning';
  world.events.push('wave');
}

function spawnEnemy(world, kind) {
  const p = randEdgePoint(world.rng);
  spawnEnemyAt(world, kind, p.x, p.y);
}

/** Place one drifter of the given kind at an exact spot (staging helper). */
export function spawnEnemyAt(world, kind, x, y) {
  const def = CFG.enemies[kind];
  const enemy = {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    speed: def.speed * (0.9 + world.rng() * 0.2),
    score: def.score,
    phase: world.rng() * TAU,
    wobble: 0.6 + world.rng() * 0.9,
    flash: 0,
  };
  world.enemies.push(enemy);
  return enemy;
}

function burst(world, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = world.rng() * TAU;
    const s = speed * (0.3 + world.rng() * 0.7);
    world.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.5 + world.rng() * 0.5,
      maxLife: 1,
      size: 1.5 + world.rng() * 2.5,
      color,
    });
  }
  for (const p of world.particles.slice(-n)) p.maxLife = p.life;
}

function addText(world, x, y, text, color) {
  world.texts.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
}

function dropPickup(world, x, y) {
  if (world.rng() > CFG.pickup.dropChance) return;
  const kind = pickWeighted(world.rng, CFG.pickup.weights);
  if (kind === 'life' && world.player.lives >= CFG.player.maxLives) return;
  world.pickups.push({ kind, x, y, vx: 0, vy: 0, life: 12, phase: world.rng() * TAU });
}

function killEnemy(world, enemy, index) {
  world.enemies.splice(index, 1);
  world.kills++;
  world.combo++;
  world.comboTimer = CFG.combo.windowSeconds;
  world.mult = 1 + Math.min(Math.floor(world.combo / CFG.combo.perStep), CFG.combo.maxMult - 1);
  const gained = enemy.score * world.mult;
  world.score += gained;
  addText(world, enemy.x, enemy.y, `+${gained}`, '#ffd166');
  const def = CFG.enemies[enemy.kind];
  burst(world, enemy.x, enemy.y, def.color, enemy.kind === 'bulwark' ? 42 : 18, enemy.kind === 'bulwark' ? 260 : 200);
  world.events.push(enemy.kind === 'bulwark' ? 'bigkill' : 'kill');
  if (enemy.kind === 'bulwark') {
    world.shake = Math.max(world.shake, 10);
    // A bulwark breaks apart into three sparks.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + world.rng();
      const spark = {
        kind: 'spark',
        x: enemy.x + Math.cos(a) * 30,
        y: enemy.y + Math.sin(a) * 30,
        vx: 0,
        vy: 0,
        hp: 1,
        maxHp: 1,
        radius: CFG.enemies.spark.radius,
        speed: CFG.enemies.spark.speed,
        score: CFG.enemies.spark.score,
        phase: world.rng() * TAU,
        wobble: 1,
        flash: 0,
      };
      world.enemies.push(spark);
    }
  }
  dropPickup(world, enemy.x, enemy.y);
}

function hurtPlayer(world) {
  const p = world.player;
  if (p.invuln > 0 || world.over || world.victory) return;
  if (world.time < p.shieldUntil) {
    p.shieldUntil = 0;
    world.shake = Math.max(world.shake, 8);
    world.flash = 0.25;
    burst(world, p.x, p.y, CFG.palette.shield, 20, 220);
    world.events.push('hit');
    p.invuln = 1.2;
    return;
  }
  p.lives--;
  p.invuln = CFG.player.invulnSeconds;
  world.combo = 0;
  world.mult = 1;
  world.comboTimer = 0;
  world.shake = Math.max(world.shake, 14);
  world.flash = 0.4;
  burst(world, p.x, p.y, '#ff5d7a', 26, 260);
  world.events.push('hit');
  if (p.lives <= 0) {
    world.over = true;
    world.events.push('gameover');
    burst(world, p.x, p.y, CFG.palette.player, 60, 320);
  }
}

function fireBullet(world, angle, speedMul = 1) {
  const p = world.player;
  const spread = world.time < p.spreadUntil;
  const angles = spread ? [-0.22, 0, 0.22] : [0];
  for (const off of angles) {
    const a = angle + off;
    world.bullets.push({
      x: p.x + Math.cos(a) * 20,
      y: p.y + Math.sin(a) * 20,
      vx: Math.cos(a) * CFG.player.bulletSpeed * speedMul,
      vy: Math.sin(a) * CFG.player.bulletSpeed * speedMul,
      life: 1.1,
      radius: 4,
    });
  }
  world.events.push('shoot');
}

/**
 * One fixed step (dt seconds). `input` is { keys:Set, mouse:{x,y,down} } or a
 * scripted stand-in with the same shape; `sfx` is the audio object or null.
 * Returns nothing; sound cues land in world.events for the caller to play.
 */
export function update(world, input, dt) {
  world.time += dt;
  const p = world.player;
  const keys = input.keys;

  // --- steering -----------------------------------------------------------
  let ax = 0;
  let ay = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ax -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ax += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) ay -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) ay += 1;
  if (ax !== 0 || ay !== 0) {
    const len = Math.hypot(ax, ay);
    p.vx += (ax / len) * CFG.player.accel * dt;
    p.vy += (ay / len) * CFG.player.accel * dt;
    p.thrust = 1;
  } else {
    p.thrust = 0;
  }
  const drag = Math.exp(-CFG.player.drag * dt);
  p.vx *= drag;
  p.vy *= drag;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > CFG.player.maxSpeed) {
    p.vx = (p.vx / speed) * CFG.player.maxSpeed;
    p.vy = (p.vy / speed) * CFG.player.maxSpeed;
  }
  p.x = clamp(p.x + p.vx * dt, CFG.arenaMargin, CFG.width - CFG.arenaMargin);
  p.y = clamp(p.y + p.vy * dt, CFG.arenaMargin, CFG.height - CFG.arenaMargin);
  if (p.x === CFG.arenaMargin || p.x === CFG.width - CFG.arenaMargin) p.vx = 0;
  if (p.y === CFG.arenaMargin || p.y === CFG.height - CFG.arenaMargin) p.vy = 0;
  p.angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);

  // Engine trail.
  if (p.thrust > 0 && world.rng() < 0.6) {
    world.particles.push({
      x: p.x - Math.cos(p.angle) * 16 + (world.rng() - 0.5) * 6,
      y: p.y - Math.sin(p.angle) * 16 + (world.rng() - 0.5) * 6,
      vx: -Math.cos(p.angle) * 60 + (world.rng() - 0.5) * 40,
      vy: -Math.sin(p.angle) * 60 + (world.rng() - 0.5) * 40,
      life: 0.35,
      maxLife: 0.35,
      size: 2,
      color: '#37e6ff',
    });
  }

  // --- firing -------------------------------------------------------------
  p.fireTimer -= dt;
  const wantFire = input.mouse.down || keys.has('Space');
  if (wantFire && p.fireTimer <= 0 && !world.over && !world.victory) {
    p.fireTimer = world.time < p.rapidUntil ? CFG.player.rapidInterval : CFG.player.fireInterval;
    fireBullet(world, p.angle);
  }

  // --- timers -------------------------------------------------------------
  if (p.invuln > 0) p.invuln -= dt;
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) {
      world.combo = 0;
      world.mult = 1;
    }
  }
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 26);
  if (world.flash > 0) world.flash = Math.max(0, world.flash - dt);

  // --- waves --------------------------------------------------------------
  if (world.waveState === 'idle') {
    startWave(world, 1);
  } else if (world.waveState === 'spawning') {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      const kind = world.spawnQueue.shift();
      if (kind !== undefined) {
        spawnEnemy(world, kind);
        world.spawnTimer = world.spawnInterval;
      } else {
        world.waveState = 'fighting';
      }
    }
  } else if (world.waveState === 'fighting') {
    if (world.enemies.length === 0) {
      if (world.wave >= CFG.wave.victoryWave) {
        world.victory = true;
        world.events.push('victory');
      } else {
        world.waveState = 'breather';
        world.breatherTimer = CFG.wave.breatherSeconds;
      }
    }
  } else if (world.waveState === 'breather') {
    world.breatherTimer -= dt;
    if (world.breatherTimer <= 0) startWave(world, world.wave + 1);
  }

  // --- enemies chase ------------------------------------------------------
  for (const e of world.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    let mx = dx / d;
    let my = dy / d;
    if (e.kind === 'mote') {
      // Motes weave side to side as they close in.
      const wob = Math.sin(world.time * 2.4 + e.phase) * e.wobble * 0.6;
      const px = -my * wob;
      const py = mx * wob;
      mx += px;
      my += py;
      const m = Math.hypot(mx, my) || 1;
      mx /= m;
      my /= m;
    }
    e.vx = mx * e.speed;
    e.vy = my * e.speed;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.flash > 0) e.flash -= dt;
  }

  // --- bullets -------------------------------------------------------------
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.x > CFG.width || b.y < 0 || b.y > CFG.height) {
      world.bullets.splice(i, 1);
      continue;
    }
    let hit = false;
    for (let j = world.enemies.length - 1; j >= 0; j--) {
      const e = world.enemies[j];
      const rr = e.radius + b.radius;
      if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
        e.hp -= 1;
        e.flash = 0.12;
        burst(world, b.x, b.y, '#9df3ff', 4, 120);
        if (e.hp <= 0) killEnemy(world, e, j);
        hit = true;
        break;
      }
    }
    if (hit) world.bullets.splice(i, 1);
  }

  // --- contact damage -----------------------------------------------------
  if (!world.over && !world.victory) {
    for (const e of world.enemies) {
      const rr = e.radius + CFG.player.radius - 2;
      if (dist2(p.x, p.y, e.x, e.y) < rr * rr) {
        hurtPlayer(world);
        // Knock the drifter back so one touch is one hit.
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        e.x = p.x + (dx / d) * (rr + 6);
        e.y = p.y + (dy / d) * (rr + 6);
        break;
      }
    }
  }

  // --- pickups ------------------------------------------------------------
  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const pk = world.pickups[i];
    pk.life -= dt;
    pk.phase += dt * 3;
    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    if (d < CFG.pickup.magnetRadius) {
      const pull = 260 * dt;
      pk.x += ((p.x - pk.x) / (d || 1)) * pull;
      pk.y += ((p.y - pk.y) / (d || 1)) * pull;
    }
    if (d < CFG.pickup.collectRadius) {
      applyPickup(world, pk.kind);
      world.pickups.splice(i, 1);
      continue;
    }
    if (pk.life <= 0) world.pickups.splice(i, 1);
  }

  // --- particles and floating text ----------------------------------------
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.98;
    pt.vy *= 0.98;
    pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.texts.length - 1; i >= 0; i--) {
    const t = world.texts[i];
    t.y -= 34 * dt;
    t.life -= dt;
    if (t.life <= 0) world.texts.splice(i, 1);
  }
}

function applyPickup(world, kind) {
  const p = world.player;
  if (kind === 'shield') p.shieldUntil = world.time + CFG.pickup.durationSeconds;
  else if (kind === 'rapid') p.rapidUntil = world.time + CFG.pickup.durationSeconds;
  else if (kind === 'spread') p.spreadUntil = world.time + CFG.pickup.durationSeconds;
  else if (kind === 'life') p.lives = Math.min(CFG.player.maxLives, p.lives + 1);
  const labels = { shield: 'SHIELD UP', rapid: 'RAPID FIRE', spread: 'SPREAD SHOT', life: '+1 LIFE' };
  addText(world, p.x, p.y - 26, labels[kind] ?? kind.toUpperCase(), CFG.palette.gold);
  world.events.push('pickup');
}

/** Fresh world for a new run, keeping the stored best score. */
export function resetWorld(world, seed) {
  const best = world.best;
  const fresh = createWorld(seed);
  fresh.best = best;
  return fresh;
}

/** Best score persistence (localStorage, guarded for odd environments). */
export function loadBest() {
  try {
    const v = Number(window.localStorage.getItem('lumen-drift-best'));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

export function saveBest(score) {
  try {
    window.localStorage.setItem('lumen-drift-best', String(Math.floor(score)));
  } catch {
    /* ignore */
  }
}
