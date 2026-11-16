// LUMEN DRIFT — everything the eye sees, drawn on one canvas. The arena
// is a fixed 1280x800 logical space; the page scales the canvas with CSS.
import { CFG, clamp } from './config.js';

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, world) {
  const g = ctx.createLinearGradient(0, 0, 0, CFG.height);
  g.addColorStop(0, '#0a0620');
  g.addColorStop(0.55, CFG.palette.background);
  g.addColorStop(1, '#0d0524');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CFG.width, CFG.height);

  // Three soft nebula glows, fixed in the arena.
  const nebulae = [
    { x: 260, y: 190, r: 320, c: 'rgba(88, 40, 180, 0.20)' },
    { x: 1020, y: 620, r: 360, c: 'rgba(20, 120, 160, 0.16)' },
    { x: 980, y: 130, r: 260, c: 'rgba(190, 40, 130, 0.13)' },
  ];
  for (const n of nebulae) {
    const rg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    rg.addColorStop(0, n.c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  }

  // Faint grid.
  ctx.strokeStyle = CFG.palette.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 80; x < CFG.width; x += 80) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CFG.height);
  }
  for (let y = 80; y < CFG.height; y += 80) {
    ctx.moveTo(0, y);
    ctx.lineTo(CFG.width, y);
  }
  ctx.stroke();

  // Parallax starfield, twinkling with world time.
  for (const s of world.stars) {
    const tw = 0.55 + 0.45 * Math.sin(world.time * 1.6 + s.tw);
    ctx.globalAlpha = tw * s.depth;
    ctx.fillStyle = '#cfe8ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Arena edge.
  ctx.strokeStyle = 'rgba(94, 242, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(CFG.arenaMargin - 8, CFG.arenaMargin - 8, CFG.width - 2 * (CFG.arenaMargin - 8), CFG.height - 2 * (CFG.arenaMargin - 8));
}

function drawShip(ctx, world) {
  const p = world.player;
  if (world.over) return;
  // Blink while invulnerable after a hit.
  if (p.invuln > 0 && Math.floor(world.time * 12) % 2 === 0) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.shadowColor = CFG.palette.player;
  ctx.shadowBlur = 18;
  // Engine flame.
  if (p.thrust > 0) {
    const flick = 10 + Math.random() * 8;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(-12, 5);
    ctx.lineTo(-12 - flick, 0);
    ctx.lineTo(-12, -5);
    ctx.closePath();
    ctx.fill();
  }
  // Hull: a swept dart.
  ctx.fillStyle = CFG.palette.player;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-12, 10);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, -10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = CFG.palette.playerCore;
  ctx.beginPath();
  ctx.arc(2, 0, 4, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Shield ring.
  if (world.time < p.shieldUntil) {
    ctx.save();
    ctx.strokeStyle = CFG.palette.shield;
    ctx.globalAlpha = 0.65 + 0.3 * Math.sin(world.time * 6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 26, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemy(ctx, e, time) {
  const def = CFG.enemies[e.kind];
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.shadowColor = def.color;
  ctx.shadowBlur = 14;
  if (e.flash > 0) ctx.fillStyle = '#ffffff';
  else ctx.fillStyle = def.color;
  if (e.kind === 'spark') {
    ctx.rotate(time * 2 + e.phase);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, 9);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, -9);
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'mote') {
    ctx.rotate(Math.sin(time * 1.4 + e.phase) * 0.5);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const x = Math.cos(a) * 18;
      const y = Math.sin(a) * 18;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#06222e';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.fill();
  } else {
    // Bulwark: heavy ring with a health arc.
    ctx.lineWidth = 5;
    ctx.strokeStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#3a1c00';
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, TAU);
    ctx.fill();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, 0, 10 + Math.sin(time * 3 + e.phase) * 2, 0, TAU);
    ctx.fill();
    // Health arc above.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ff5d7a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 40, -Math.PI / 2, -Math.PI / 2 + TAU * (e.hp / e.maxHp));
    ctx.stroke();
  }
  ctx.restore();
}

const PICKUP_STYLE = {
  shield: { color: CFG.palette.shield, glyph: 'S' },
  rapid: { color: CFG.palette.rapid, glyph: 'R' },
  spread: { color: CFG.palette.spread, glyph: 'W' },
  life: { color: CFG.palette.life, glyph: '+' },
};

function drawPickups(ctx, world) {
  for (const pk of world.pickups) {
    const style = PICKUP_STYLE[pk.kind];
    const bob = Math.sin(pk.phase) * 3;
    const blink = pk.life < 3 ? (Math.floor(pk.life * 6) % 2 === 0 ? 0.35 : 1) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(pk.x, pk.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = style.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(7, 5, 18, 0.9)';
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 2;
    ctx.fillRect(-11, -11, 22, 22);
    ctx.strokeRect(-11, -11, 22, 22);
    ctx.rotate(-Math.PI / 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = style.color;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.glyph, 0, 1);
    ctx.restore();
  }
}

function drawBullets(ctx, world) {
  for (const b of world.bullets) {
    ctx.save();
    ctx.shadowColor = CFG.palette.bullet;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = CFG.palette.bullet;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles(ctx, world) {
  for (const pt of world.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

function drawTexts(ctx, world) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of world.texts) {
    ctx.globalAlpha = clamp(t.life / t.maxLife, 0, 1);
    ctx.font = 'bold 17px monospace';
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, world) {
  const p = world.player;
  ctx.save();
  ctx.textBaseline = 'top';
  // Score.
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px monospace';
  ctx.fillStyle = CFG.palette.text;
  ctx.fillText(`SCORE ${String(world.score).padStart(6, '0')}`, 28, 20);
  ctx.font = '14px monospace';
  ctx.fillStyle = CFG.palette.dim;
  ctx.fillText(`BEST ${Math.max(world.best, world.score)}`, 28, 52);
  // Wave.
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px monospace';
  ctx.fillStyle = CFG.palette.text;
  const waveLabel = world.waveState === 'breather' ? `WAVE ${world.wave} CLEAR` : `WAVE ${Math.max(1, world.wave)}`;
  ctx.fillText(waveLabel, CFG.width / 2, 20);
  ctx.font = '14px monospace';
  ctx.fillStyle = CFG.palette.dim;
  ctx.fillText(`DRIFTERS LEFT ${world.enemies.length + world.spawnQueue.length}`, CFG.width / 2, 52);
  // Lives.
  ctx.textAlign = 'right';
  ctx.font = 'bold 26px monospace';
  ctx.fillStyle = CFG.palette.text;
  ctx.fillText('♥'.repeat(Math.max(0, p.lives)), CFG.width - 28, 20);
  ctx.font = '14px monospace';
  ctx.fillStyle = CFG.palette.dim;
  ctx.fillText('LIVES', CFG.width - 28, 52);
  // Combo bar, under the score.
  if (world.combo > 1) {
    const w = 190;
    const frac = clamp(world.comboTimer / CFG.combo.windowSeconds, 0, 1);
    ctx.textAlign = 'left';
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = CFG.palette.gold;
    ctx.fillText(`COMBO x${world.mult}  (${world.combo})`, 28, 78);
    ctx.fillStyle = 'rgba(255, 209, 102, 0.25)';
    ctx.fillRect(28, 102, w, 6);
    ctx.fillStyle = CFG.palette.gold;
    ctx.fillRect(28, 102, w * frac, 6);
  }
  // Active power-ups.
  const act = [];
  if (world.time < p.shieldUntil) act.push(`SHIELD ${Math.ceil(p.shieldUntil - world.time)}s`);
  if (world.time < p.rapidUntil) act.push(`RAPID ${Math.ceil(p.rapidUntil - world.time)}s`);
  if (world.time < p.spreadUntil) act.push(`SPREAD ${Math.ceil(p.spreadUntil - world.time)}s`);
  if (act.length > 0) {
    ctx.textAlign = 'right';
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = CFG.palette.gold;
    ctx.fillText(act.join('   '), CFG.width - 28, 78);
  }
  // Bottom hint, inside the arena border (the border sits at height - 18).
  ctx.textAlign = 'center';
  ctx.font = '13px monospace';
  ctx.fillStyle = 'rgba(143, 163, 200, 0.7)';
  ctx.fillText('WASD move · mouse aim · click / space fire · P pause · M mute', CFG.width / 2, CFG.height - 52);
  ctx.restore();
}

function drawCenterPanel(ctx, lines) {
  // lines: [{text, font, color, gap}] — a vertical stack, centred.
  const widths = lines.map((l) => {
    ctx.font = l.font;
    return ctx.measureText(l.text).width;
  });
  const w = Math.max(...widths) + 90;
  // First line's centre sits 34 below the top; each following line sits its
  // gap below the previous; 30 of padding closes the panel under the last.
  const gaps = lines.slice(0, -1).reduce((n, l) => n + (l.gap ?? 46), 0);
  const totalH = 34 + gaps + 30;
  const x = (CFG.width - w) / 2;
  const y = (CFG.height - totalH) / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(5, 4, 16, 0.82)';
  rr(ctx, x, y, w, totalH, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(94, 242, 255, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  let cy = y + 34;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const l of lines) {
    ctx.font = l.font;
    ctx.fillStyle = l.color;
    ctx.fillText(l.text, CFG.width / 2, cy);
    cy += l.gap ?? 46;
  }
  ctx.restore();
}

/** The arena plus HUD, with screen shake applied. */
export function drawWorld(ctx, world) {
  ctx.save();
  if (world.shake > 0) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  drawBackground(ctx, world);
  drawPickups(ctx, world);
  drawBullets(ctx, world);
  for (const e of world.enemies) drawEnemy(ctx, e, world.time);
  drawShip(ctx, world);
  drawParticles(ctx, world);
  drawTexts(ctx, world);
  ctx.restore();
  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255, 93, 122, ${world.flash * 0.5})`;
    ctx.fillRect(0, 0, CFG.width, CFG.height);
  }
  drawHud(ctx, world);
}

export function drawTitle(ctx, world) {
  drawBackground(ctx, world);
  // A few drifting silhouettes for life behind the panel, kept to the top
  // and bottom bands so they never sit on the panel's text.
  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 5; i++) {
    const x = 180 + i * 230 + Math.sin(world.time * 0.4 + i * 2) * 30;
    const y = i % 2 === 0 ? 90 + ((i * 53) % 60) : 680 + ((i * 47) % 60);
    ctx.fillStyle = i % 2 === 0 ? '#ff4fd8' : '#37e6ff';
    ctx.beginPath();
    ctx.arc(x, y, 10 + (i % 3) * 4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  drawCenterPanel(ctx, [
    { text: 'LUMEN DRIFT', font: 'bold 64px monospace', color: CFG.palette.player, gap: 78 },
    { text: 'a neon arena survival', font: '20px monospace', color: CFG.palette.dim, gap: 40 },
    { text: 'WASD / arrows — move      mouse — aim', font: '17px monospace', color: CFG.palette.text, gap: 32 },
    { text: 'click / space — fire      P — pause      M — mute', font: '17px monospace', color: CFG.palette.text, gap: 32 },
    { text: 'Survive 10 waves. Chain kills for combo. Grab pickups.', font: '16px monospace', color: CFG.palette.gold, gap: 44 },
    { text: world.best > 0 ? `BEST SCORE ${world.best}` : 'CLICK TO START', font: 'bold 22px monospace', color: world.best > 0 ? CFG.palette.gold : '#ffffff', gap: 40 },
    { text: world.best > 0 ? 'CLICK TO START' : '', font: 'bold 22px monospace', color: '#ffffff', gap: 0 },
  ]);
}

export function drawPaused(ctx, world) {
  drawWorld(ctx, world);
  ctx.fillStyle = 'rgba(5, 4, 16, 0.55)';
  ctx.fillRect(0, 0, CFG.width, CFG.height);
  drawCenterPanel(ctx, [
    { text: 'PAUSED', font: 'bold 52px monospace', color: CFG.palette.text, gap: 70 },
    { text: 'P / Esc — resume      R — restart', font: '18px monospace', color: CFG.palette.dim, gap: 40 },
  ]);
}

export function drawGameOver(ctx, world) {
  drawWorld(ctx, world);
  ctx.fillStyle = 'rgba(10, 3, 10, 0.6)';
  ctx.fillRect(0, 0, CFG.width, CFG.height);
  drawCenterPanel(ctx, [
    { text: 'SIGNAL LOST', font: 'bold 56px monospace', color: CFG.palette.danger, gap: 76 },
    { text: `FINAL SCORE  ${world.score}`, font: 'bold 26px monospace', color: CFG.palette.text, gap: 44 },
    { text: `BEST WAVE  ${world.wave}      BEST SCORE  ${Math.max(world.best, world.score)}`, font: '19px monospace', color: CFG.palette.dim, gap: 44 },
    { text: 'Press R or click to drift again', font: 'bold 20px monospace', color: CFG.palette.gold, gap: 40 },
  ]);
}

export function drawVictory(ctx, world) {
  drawWorld(ctx, world);
  ctx.fillStyle = 'rgba(3, 10, 12, 0.55)';
  ctx.fillRect(0, 0, CFG.width, CFG.height);
  drawCenterPanel(ctx, [
    { text: 'SECTOR CLEARED', font: 'bold 54px monospace', color: CFG.palette.shield, gap: 74 },
    { text: 'All 10 waves survived. The drift is yours.', font: '20px monospace', color: CFG.palette.text, gap: 44 },
    { text: `FINAL SCORE  ${world.score}`, font: 'bold 26px monospace', color: CFG.palette.text, gap: 44 },
    { text: `BEST SCORE  ${Math.max(world.best, world.score)}`, font: '19px monospace', color: CFG.palette.dim, gap: 44 },
    { text: 'Press R or click to play again', font: 'bold 20px monospace', color: CFG.palette.gold, gap: 40 },
  ]);
}
