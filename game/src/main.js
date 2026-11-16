// LUMEN DRIFT — bootstrap and game loop. Own code, written from the spec:
// a state machine (title / playing / paused / over / victory), a fixed-step
// update, and a shot mode (?shot=start|play|end|action&seed=N) that stages
// one frozen scene for the dossier screenshots.
import { CFG } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createWorld, loadBest, resetWorld, saveBest, startWave, update } from './world.js';
import { drawGameOver, drawPaused, drawTitle, drawVictory, drawWorld } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CFG.width;
canvas.height = CFG.height;

const input = createInput(canvas);
const audio = createAudio();
const params = new URLSearchParams(window.location.search);
const shotKind = params.get('shot');
const shotSeed = Number(params.get('seed') ?? '1') || 1;

let world = createWorld((Date.now() % 2147483647) || 7);
world.best = loadBest();
let view = 'title'; // title | playing | paused | over | victory
let last = performance.now();
let acc = 0;
const STEP = 1 / 60;

function playEvents() {
  for (const ev of world.events) {
    if (ev === 'shoot') audio.shoot();
    else if (ev === 'kill') audio.kill(false);
    else if (ev === 'bigkill') audio.kill(true);
    else if (ev === 'hit') audio.hit();
    else if (ev === 'pickup') audio.pickup();
    else if (ev === 'wave') audio.wave();
    else if (ev === 'victory') audio.victory();
    else if (ev === 'gameover') audio.gameOver();
  }
  world.events.length = 0;
}

function startRun() {
  audio.ensure();
  world = resetWorld(world, (Date.now() % 2147483647) || 7);
  world.best = loadBest();
  view = 'playing';
  startWave(world, 1);
}

function endCheck() {
  if (world.over && view === 'playing') {
    view = 'over';
    if (world.score > world.best) {
      world.best = world.score;
      saveBest(world.score);
    }
  } else if (world.victory && view === 'playing') {
    view = 'victory';
    if (world.score > world.best) {
      world.best = world.score;
      saveBest(world.score);
    }
  }
}

function render() {
  if (view === 'title') drawTitle(ctx, world);
  else if (view === 'paused') drawPaused(ctx, world);
  else if (view === 'over') drawGameOver(ctx, world);
  else if (view === 'victory') drawVictory(ctx, world);
  else drawWorld(ctx, world);
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (view === 'playing') {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      update(world, input, STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 5) acc = 0;
    playEvents();
    endCheck();
  }
  render();
  requestAnimationFrame(frame);
}

// --- shot mode: one frozen staged scene, then signal readiness ---------
if (shotKind) {
  const staged = stageShot(shotKind, shotSeed);
  world = staged.world;
  view = staged.view;
  if (view === 'over' || view === 'victory') {
    if (world.score > world.best) world.best = world.score;
  }
  render();
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}

// --- controls ------------------------------------------------------------
canvas.addEventListener('mousedown', () => {
  audio.ensure();
  if (view === 'title') startRun();
  else if (view === 'over' || view === 'victory') startRun();
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM') {
    audio.toggleMute();
    return;
  }
  if (event.code === 'KeyP' || event.code === 'Escape') {
    if (view === 'playing') view = 'paused';
    else if (view === 'paused') view = 'playing';
    return;
  }
  if (event.code === 'KeyR') {
    if (view === 'over' || view === 'victory' || view === 'paused') startRun();
    return;
  }
  if (event.code === 'Enter' || event.code === 'Space') {
    if (view === 'title') startRun();
  }
});

// Test/debug handle (read-only snapshot for the play-test harness).
window.__game = {
  get view() {
    return view;
  },
  get world() {
    return world;
  },
  start: startRun,
};
