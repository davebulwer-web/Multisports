// Biathlon model: pace your heart rate on the skis, then shoot five targets
// with a sight that sways with your breathing and kicks with every heartbeat.
// Pure logic. Course distances are in (compressed) metres, sight in pixels.
import { clamp } from './rng.js';

export const BIATHLON = {
  legs: [190, 190, 150],    // ski legs: start -> prone range -> standing range -> finish
  ranges: ['prone', 'standing'],
  penalty: 10,              // seconds added per missed target
  ski: { base: 4.2, push: 5.2, steady: 0.4, climb: 2.4 }, // m/s, effort when not pushing
  hr: { rest: 72, base: 95, span: 95, climb: 120, up: 5, down: 9, rangeDown: 9, max: 200 },
  burn: { redline: 176, rate: 0.012, recover: 0.07, slow: 0.5 },
  sight: {
    prone:    { breathe: 5, pulse: 1.2, drift: 5, hit: 5 },
    standing: { breathe: 9, pulse: 1.8, drift: 10, hit: 9 },
    breathPeriod: 3.6, steer: 34, spacing: 26,
  },
};

/** Height of the trail (m) at course distance d: rolling hills. */
export const trailY = (d) => Math.sin(d / 23) * 5 + Math.sin(d / 9 + 1) * 1.5;
/** Uphill grade (+ = climbing) at d. */
export const gradeAt = (d) => (trailY(d + 0.5) - trailY(d - 0.5));

export class Skier {
  constructor(cfg = BIATHLON) {
    this.cfg = cfg;
    this.d = 0;           // distance into the current leg
    this.v = 0;
    this.hr = cfg.hr.rest + 10;
    this.burn = 0;        // 0..1 lactic burn from going over the redline
    this.offset = 0;      // course distance at the start of this leg (for terrain)
  }

  /** @param {boolean} push holding the push key */
  update(dt, push) {
    const c = this.cfg, h = c.hr, b = c.burn;
    const g = gradeAt(this.offset + this.d);
    const effort = push ? 1 : c.ski.steady;
    const target = clamp(h.base + h.span * effort + h.climb * Math.max(0, g), h.rest, h.max);
    this.hr += ((target - this.hr) / (target > this.hr ? h.up : h.down)) * dt;
    if (this.hr > b.redline) this.burn += (this.hr - b.redline) * b.rate * dt;
    else this.burn -= b.recover * dt * (this.hr < b.redline - 20 ? 1.6 : 1);
    this.burn = clamp(this.burn, 0, 1);
    const speed = (c.ski.base + c.ski.push * effort) * (1 - b.slow * this.burn) * clamp(1 - c.ski.climb * g, 0.55, 1.35);
    this.v += (speed - this.v) * Math.min(1, dt * 2.5);
    this.d += this.v * dt;
  }

  /** Recover at the range. */
  rest(dt) {
    const h = this.cfg.hr;
    this.hr += ((h.rest - this.hr) / h.rangeDown) * dt;
    this.burn = Math.max(0, this.burn - this.cfg.burn.recover * 1.5 * dt);
    this.v = 0;
  }
}

/** The rifle sight at one range. Positions are pixel offsets from target 0's centre. */
export class RifleSight {
  /** @param {'prone'|'standing'} kind */
  constructor(kind, rng, cfg = BIATHLON) {
    this.cfg = cfg;
    this.k = cfg.sight[kind];
    this.kind = kind;
    this.rng = rng;
    this.t = 0;
    this.aimX = -14 + rng() * 6; // where the barrel points before sway
    this.aimY = 10 + rng() * 6;
    this.dx = 0; this.dy = 0;      // drift (random walk)
    this.kick = 0; this.kickV = 0; // heartbeat
    this.beatT = 0;
    this.phase = rng() * Math.PI * 2;
    this.target = 0;
  }

  /** Shake factor from heart rate: calm ~0.5, flat out ~1.6. */
  static shake(hr) { return clamp((hr - 45) / 85, 0.35, 1.8); }

  update(dt, hr, sx = 0, sy = 0) {
    const k = this.k, s = RifleSight.shake(hr);
    this.t += dt;
    this.aimX += sx * this.cfg.sight.steer * dt;
    this.aimY += sy * this.cfg.sight.steer * dt;
    // slow wander that pulls back toward the aim
    const n = Math.sqrt(dt) * k.drift * s * 0.5;
    this.dx += (this.rng() - 0.5) * n - this.dx * 1.2 * dt;
    this.dy += (this.rng() - 0.5) * n - this.dy * 1.2 * dt;
    // heartbeat: a little upward jolt each beat
    this.beatT += dt;
    if (this.beatT >= 60 / hr) { this.beatT = 0; this.kickV -= k.pulse * s * 14; }
    this.kickV += (-this.kick * 90 - this.kickV * 12) * dt;
    this.kick += this.kickV * dt;
  }

  /** Breathing: mostly vertical, slow. */
  get breath() { return Math.sin((this.t / this.cfg.sight.breathPeriod) * Math.PI * 2 + this.phase); }

  /** Where the crosshair actually is. */
  pos(hr) {
    const b = this.k.breathe * RifleSight.shake(hr);
    return { x: this.aimX + this.dx * 4 + this.breath * b * 0.25, y: this.aimY + this.dy * 4 + this.breath * b + this.kick };
  }

  /** Fire at the current target. Returns {hit, x, y} relative to that target's centre. */
  fire(hr) {
    const p = this.pos(hr);
    const cx = this.target * this.cfg.sight.spacing;
    const x = p.x - cx, y = p.y;
    const hit = Math.hypot(x, y) <= this.k.hit;
    this.target++;
    // the rifle comes back roughly onto the next target, not exactly
    this.aimX += this.cfg.sight.spacing + (this.rng() - 0.5) * 6;
    this.aimY += (this.rng() - 0.5) * 6;
    this.kickV -= 30;
    return { hit, x, y };
  }
}

/** Race time as M:SS.s */
export function fmtRace(s) {
  if (s == null) return '--';
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
}

/** CPU race time for skill 0..1. */
export function cpuBiathlon(skill, rng, cfg = BIATHLON) {
  const s = clamp(skill, 0, 1);
  const ski = 104 - 20 * s + (rng() - 0.5) * 6;
  const shoot = 30 - 10 * s + (rng() - 0.5) * 4;
  const p = 0.6 + 0.35 * s;
  let misses = 0;
  for (let i = 0; i < 10; i++) if (rng() > p) misses++;
  return Math.round((ski + shoot + misses * cfg.penalty) * 10) / 10;
}
