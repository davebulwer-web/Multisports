// Opening ceremony before a competition: the competitors parade in behind
// their flags, a torch runner lights the stadium cauldron, then doves and
// fireworks open the games. Any button skips it.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, bands, dither, text, circle, P, W, H } from '../../engine/gfx.js';
import { sfx, playSong } from '../../engine/audio.js';
import { drawStadium, drawGrass } from '../stadium.js';
import { assets, athleteSheet, playerSheet, drawProp, drawScenery } from '../assets.js';
import { nationByCode, flagPixels } from '../../art/flags.js';
import { TORCHLIGHT_MARCH } from '../music.js';

const LINE_Y = 208;            // where the competitors line up
const TRACK_Y = 158;           // torch runner's feet
const STAIRS = { x0: 280, x1: 316, top: 130 };
const CAULDRON = { x: 342, y: 130 };
const RIM_Y = CAULDRON.y - 34;
const WALK = 40, RUN = 72;     // px/s
const FLAG_W = 18, FLAG_H = 12, POLE = 46;

const FIREWORK_COLOURS = [['lamp.2', 'lamp.1'], ['yellow.2', 'orange.3'], ['cyan.2', 'cyan.1'], ['green.3', 'green.2'], ['purple.2', 'purple.1'], ['grey.6', 'grey.4']];

const flagCache = new Map();
/** Flag cloth as a small canvas (built once per nation). */
function flagCanvas(code) {
  if (flagCache.has(code)) return flagCache.get(code);
  const c = document.createElement('canvas');
  c.width = FLAG_W; c.height = FLAG_H;
  const g = c.getContext('2d');
  flagPixels(code, FLAG_W, FLAG_H).forEach((key, i) => {
    g.fillStyle = P(key);
    g.fillRect(i % FLAG_W, Math.floor(i / FLAG_W), 1, 1);
  });
  flagCache.set(code, c);
  return c;
}

/** Flag on a pole: pole foot at (x, y), cloth rippling from the top. */
export function drawFlagPole(ctx, code, x, y, t, height = POLE) {
  const top = y - height;
  fill(ctx, 'grey.1', x - 1, top - 1, 3, height + 1);
  fill(ctx, 'grey.5', x, top, 1, height);
  fill(ctx, 'orange.3', x - 1, top - 2, 3, 2);
  const cloth = flagCanvas(code);
  for (let col = 0; col < FLAG_W; col++) {
    const dy = Math.round(Math.sin(t * 7 - col * 0.55) * 1.4 * (col / FLAG_W));
    ctx.drawImage(cloth, col, 0, 1, FLAG_H, x + 1 + col, top + dy, 1, FLAG_H);
  }
}

/** Small flag icon (setup screen, captions). */
export function drawFlagIcon(ctx, code, x, y) {
  fill(ctx, 'grey.0', x - 1, y - 1, FLAG_W + 2, FLAG_H + 2);
  ctx.drawImage(flagCanvas(code), x, y);
}

/** Flickering flame with its base at (x, y). */
function flame(ctx, x, y, size, t) {
  const f = (k) => Math.sin(t * 23 + k * 1.7) * 0.5 + Math.sin(t * 37 + k) * 0.5;
  const layers = [['lamp.1', 1], ['orange.3', 0.7], ['yellow.2', 0.4]];
  for (const [key, s] of layers) {
    const r = size * s;
    for (let k = 0; k < 4; k++) {
      const h = k / 3;
      circle(ctx, x + f(k + s * 3) * size * 0.15, y - r * 0.6 - h * size * 1.3 * s, Math.max(0.5, r * (1 - h * 0.7)), key);
    }
  }
}

export class CeremonyScene extends Scene {
  /** @param {object[]} players @param {() => void} onDone */
  constructor(game, players, onDone) {
    super(game);
    this.onDone = onDone;
    this.t = 0;
    this.finished = false;
    const n = players.length;
    const gap = Math.min(64, 236 / Math.max(1, n));
    this.marchers = players.map((p, i) => ({
      p,
      nation: nationByCode(p.nation),
      anim: new Anim(playerSheet(p), 'march'),
      start: 2.6 + i * 1.5,
      x: -24,
      target: 40 + (n - 1 - i) * gap, // first in walks furthest
      arrived: false,
    }));
    const lastIn = Math.max(...this.marchers.map((m) => m.start + (m.target + 24) / WALK));
    this.torchStart = lastIn + 1;
    this.runner = { anim: new Anim(athleteSheet(7, 2), 'torch_run'), x: -24, y: TRACK_Y, phase: 'wait' };
    this.ignite = Infinity;
    this.doves = [];
    this.rockets = [];
    this.sparks = [];
    this.embers = [];
    this.nextRocket = 0;
  }

  enter() {
    this.song = playSong(TORCHLIGHT_MARCH);
    sfx.crowd(0.4, 2.5);
  }
  exit() { this.song?.stop(); }

  finish() {
    if (this.finished) return;
    this.finished = true;
    sfx.select();
    this.onDone();
  }

  get excite() {
    if (this.t >= this.ignite) return 1;
    return this.t > this.torchStart ? 0.7 : 0.4;
  }

  update(dt, input) {
    this.t += dt;
    const t = this.t;
    if (t > 0.3 && (input.wasPressed('a') || input.wasPressed('b') || input.wasPressed('start'))) return this.finish();
    if (t > this.ignite + 10) return this.finish();

    for (const m of this.marchers) {
      if (t < m.start) continue;
      if (!m.arrived) {
        m.x += WALK * dt;
        if (m.x >= m.target) { m.x = m.target; m.arrived = true; m.anim.play('idle'); }
      }
      if (t > this.ignite + 0.4 && m.anim.tagName !== 'wave') m.anim.play('wave');
      m.anim.update(dt * 1000);
    }

    this.updateRunner(dt);

    if (t >= this.ignite) {
      if (t > this.nextRocket && t < this.ignite + 8) {
        this.launch();
        this.nextRocket = t + 0.35 + Math.random() * 0.6;
      }
      if (Math.random() < dt * 30) {
        this.embers.push({ x: CAULDRON.x + (Math.random() - 0.5) * 20, y: RIM_Y - 10, vy: -20 - Math.random() * 30, life: 1 + Math.random() });
      }
    }
    for (const r of this.rockets) {
      r.y -= r.v * dt;
      if (r.y <= r.burst) {
        r.dead = true;
        sfx.pop();
        const [hi, lo] = FIREWORK_COLOURS[Math.floor(Math.random() * FIREWORK_COLOURS.length)];
        const count = 26 + Math.floor(Math.random() * 12);
        for (let k = 0; k < count; k++) {
          const a = (k / count) * Math.PI * 2, sp = 26 + Math.random() * 18;
          this.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.3 + Math.random() * 0.4, hi, lo });
        }
      }
    }
    this.rockets = this.rockets.filter((r) => !r.dead);
    for (const s of this.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 30 * dt; s.vx *= 0.985; s.life -= dt; }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const e of this.embers) { e.y += e.vy * dt; e.x += Math.sin(e.y * 0.2) * 0.3; e.life -= dt; }
    this.embers = this.embers.filter((e) => e.life > 0);
    for (const d of this.doves) {
      if (t < d.start) continue;
      d.x += d.vx * dt; d.y += d.vy * dt + Math.sin(t * 5 + d.k) * 0.3;
      d.vy = Math.min(-8, d.vy + 6 * dt);
    }
  }

  updateRunner(dt) {
    const r = this.runner, t = this.t;
    if (r.phase === 'wait' && t >= this.torchStart) { r.phase = 'track'; sfx.crowd(0.5, 1.5); }
    if (r.phase === 'track') {
      r.x += RUN * dt;
      if (r.x >= STAIRS.x0) r.phase = 'stairs';
    } else if (r.phase === 'stairs') {
      r.x += RUN * 0.6 * dt;
      const k = Math.min(1, (r.x - STAIRS.x0) / (STAIRS.x1 - STAIRS.x0));
      r.y = TRACK_Y + (STAIRS.top - TRACK_Y) * k;
      if (k >= 1) { r.phase = 'platform'; r.y = STAIRS.top; }
    } else if (r.phase === 'platform') {
      r.x += RUN * 0.4 * dt;
      if (r.x >= CAULDRON.x - 22) { r.x = CAULDRON.x - 22; r.phase = 'raise'; r.raised = t; r.anim.play('torch_raise'); sfx.ready(); }
    } else if (r.phase === 'raise' && t > r.raised + 0.9) {
      r.phase = 'spark'; r.sparkT = t; sfx.whoosh();
    } else if (r.phase === 'spark' && t > r.sparkT + 0.7) {
      r.phase = 'done';
      this.ignite = t;
      this.nextRocket = t + 0.6;
      sfx.ignite();
      sfx.crowd(0.9, 3);
      this.doves = Array.from({ length: 9 }, (_, k) => ({
        k, start: t + 0.3 + k * 0.12,
        x: 60 + k * 22 + Math.random() * 10, y: LINE_Y - 30 - Math.random() * 20,
        vx: 20 + Math.random() * 30, vy: -80 - Math.random() * 25,
      }));
    }
    r.anim.update(dt * 1000);
  }

  launch() {
    sfx.rocket();
    this.rockets.push({ x: 30 + Math.random() * (W - 60), y: 96, v: 120 + Math.random() * 40, burst: 8 + Math.random() * 26 });
  }

  /** Where the torch flame sits for the runner's current frame. */
  torchTop() {
    const r = this.runner;
    const h = r.anim.anchor('handF') || { x: 6, y: -44 };
    return { x: r.x + h.x, y: r.y + h.y - 7 };
  }

  draw(ctx) {
    const t = this.t;
    drawStadium(ctx, 0, { excite: this.excite, t: this.game.time, season: 'all', salt: 'ceremony' });
    // dusk: dim the stand so the fireworks stand out, then a sunset sky
    ctx.globalAlpha = 0.45;
    fill(ctx, 'blue.0', 0, 30, W, 65);
    ctx.globalAlpha = 1;
    bands(ctx, ['blue.0', 'blue.1', 'purple.1', 'red.2'], 0, 0, W, 31);
    for (let i = 0; i < 3; i++) drawScenery(ctx, 'tower', i * 160 + 21, 35);
    for (const s of this.sparks) {
      const key = s.life > 0.5 ? s.hi : s.lo;
      fill(ctx, key, s.x, s.y, s.life > 1.1 ? 2 : 1, s.life > 1.1 ? 2 : 1);
      if (s.life > 0.9) fill(ctx, key, s.x - s.vx * 0.03, s.y - s.vy * 0.03, 1, 1);
    }
    for (const r of this.rockets) { fill(ctx, 'orange.3', r.x, r.y, 1, 2); fill(ctx, 'orange.1', r.x, r.y + 2, 1, 3); }

    drawGrass(ctx, 0);
    // running track across the infield
    fill(ctx, 'track.1', 0, TRACK_Y - 12, W, 20);
    fill(ctx, 'track.2', 0, TRACK_Y - 12, W, 1);
    for (const ly of [TRACK_Y - 6, TRACK_Y + 1]) fill(ctx, 'grey.5', 0, ly, W, 1);
    fill(ctx, 'grey.6', 0, TRACK_Y + 7, W, 1);
    this.drawStairs(ctx);
    drawScenery(ctx, 'cauldron', CAULDRON.x, CAULDRON.y);
    if (t >= this.ignite) {
      const grow = Math.min(1, (t - this.ignite) / 0.6);
      flame(ctx, CAULDRON.x, RIM_Y + 1, 4 + 9 * grow, t);
      for (const e of this.embers) fill(ctx, e.life > 0.6 ? 'yellow.2' : 'orange.2', e.x, e.y, 1, 1);
    }

    this.drawRunner(ctx);

    const ms = [...this.marchers].filter((m) => t >= m.start).sort((a, b) => a.x - b.x);
    for (const m of ms) {
      m.anim.draw(ctx, m.x, LINE_Y);
      if (m.arrived) drawFlagPole(ctx, m.nation.code, m.x + 13, LINE_Y, t + m.target);
      else {
        const h = m.anim.anchor('handF') || { x: 6, y: -30 };
        drawFlagPole(ctx, m.nation.code, m.x + h.x, LINE_Y + h.y + 10, t, POLE - 6);
      }
    }

    for (const d of this.doves) {
      if (t < d.start || d.y < -16) continue;
      const tag = assets.props.tag('dove');
      assets.props.draw(ctx, tag.from + (Math.floor(t * 8 + d.k) % 2), d.x, d.y);
    }

    this.drawCaptions(ctx);
    if (t < 0.6) { ctx.globalAlpha = 1 - t / 0.6; fill(ctx, 'grey.0', 0, 0, W, H); ctx.globalAlpha = 1; }
  }

  drawStairs(ctx) {
    const { x0, x1, top } = STAIRS;
    const steps = 6, sw = (x1 - x0) / steps, sh = (TRACK_Y - top) / steps;
    for (let k = 0; k < steps; k++) {
      const x = x0 + k * sw, y = TRACK_Y - (k + 1) * sh;
      fill(ctx, 'grey.4', x, y, x1 - x + 6, sh);
      fill(ctx, 'grey.5', x, y, x1 - x + 6, 1);
    }
    fill(ctx, 'grey.3', x1, top, W - x1, TRACK_Y + 8 - top);
    fill(ctx, 'grey.5', x1, top, W - x1, 1);
    dither(ctx, 'grey.3', 'grey.2', x1, top + 6, W - x1, TRACK_Y + 8 - top - 6);
    fill(ctx, 'red.1', x1 + 6, top + 4, W - x1 - 12, 2);
  }

  drawRunner(ctx) {
    const r = this.runner, t = this.t;
    if (r.phase === 'wait') return;
    r.anim.draw(ctx, r.x, r.y);
    const h = r.anim.anchor('handF') || { x: 6, y: -44 };
    drawProp(ctx, 'torch', r.x + h.x, r.y + h.y + 5);
    const top = this.torchTop();
    flame(ctx, top.x, top.y, 3, t);
    if (r.phase === 'spark') {
      // the flame leaps in an arc from the torch to the cauldron rim
      const k = Math.min(1, (t - r.sparkT) / 0.7);
      const x = top.x + (CAULDRON.x - top.x) * k;
      const y = top.y + (RIM_Y - top.y) * k - Math.sin(k * Math.PI) * 18;
      flame(ctx, x, y, 2.5, t * 1.3);
      for (let j = 1; j < 5; j++) {
        const kk = Math.max(0, k - j * 0.05);
        fill(ctx, 'orange.3', top.x + (CAULDRON.x - top.x) * kk, top.y + (RIM_Y - top.y) * kk - Math.sin(kk * Math.PI) * 18, 1, 1);
      }
    }
  }

  drawCaptions(ctx) {
    const t = this.t;
    const banner = (msg, sub, y = 5, cx = W / 2) => {
      const w = msg.length * 12 + 20;
      fill(ctx, 'grey.0', cx - w / 2 - 1, y, w + 2, sub ? 32 : 22);
      fill(ctx, 'blue.0', cx - w / 2, y + 1, w, sub ? 30 : 20);
      fill(ctx, 'orange.3', cx - w / 2, y + 1, w, 1);
      text(ctx, msg, cx, y + 4, 'yellow.2', { align: 'center', scale: 2 });
      if (sub) text(ctx, sub, cx, y + 21, 'grey.5', { align: 'center' });
    };
    if (t < 2.6) banner('OPENING CEREMONY', 'THE COMPETITORS ENTER THE STADIUM');
    else if (t < this.torchStart) {
      const m = [...this.marchers].reverse().find((q) => t >= q.start);
      if (m) {
        const w = 170;
        fill(ctx, 'grey.0', W / 2 - w / 2 - 1, 5, w + 2, 28);
        fill(ctx, 'blue.0', W / 2 - w / 2, 6, w, 26);
        drawFlagIcon(ctx, m.nation.code, W / 2 - w / 2 + 6, 13);
        text(ctx, m.nation.name, W / 2 - w / 2 + 30, 10, 'yellow.2');
        text(ctx, m.p.name + (m.p.cpu ? '  (CPU)' : ''), W / 2 - w / 2 + 30, 21, 'grey.6');
      }
    } else if (t < this.ignite) {
      if (t < this.torchStart + 3.5) banner('THE FLAME ARRIVES');
    } else if (t > this.ignite + 0.8) banner('LET THE GAMES BEGIN!', null, 62, 164);

    const msg = t > this.ignite + 3 ? 'PRESS SPACE' : 'SPACE TO SKIP';
    if (t > this.ignite + 3 ? Math.floor(t * 2.5) % 2 : t > 1) text(ctx, msg, W - 6, H - 9, 'grey.6', { align: 'right' });
  }
}
