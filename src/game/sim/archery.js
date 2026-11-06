// Archery model: draw, steady a swaying sight, aim off for wind, loose.
// Pure logic. Target-face units: the face has radius 1, so each scoring
// ring is 0.1 wide. +x is right, +y is DOWN (screen convention).
import { clamp } from './rng.js';

export const ARCHERY = {
  arrows: 6,
  drawTime: 0.9,     // seconds of holding to reach full draw
  steadyTime: 4,     // seconds at full draw before the arms tire
  maxHold: 10,       // the arrow goes, ready or not
  breathPeriod: 3.2, // seconds per breath (vertical sway)
  swayY: 0.2,        // breathing sway amplitude, face radii
  swayX: 0.12,       // side-to-side sway amplitude
  tremor: 0.06,      // jittery wander while fresh
  fatigue: 0.55,     // extra sway per second held past steadyTime
  steerAccel: 2.6,   // how hard the player can move the sight (radii/s^2)
  damping: 3.2,      // sight momentum bleeds off at this rate (1/s)
  windDrift: 0.085,  // face radii of drift per m/s of crosswind
  sagPerUnder: 1.6,  // how far an under-drawn arrow drops (radii at zero draw)
  spread: 0.025,     // natural arrow dispersion (sd, radii)
};

/** Ring score for an impact point: 10 in the gold, 1 at the edge, 0 off the face. */
export function ringScore(x, y) {
  const r = Math.hypot(x, y);
  if (r >= 1) return 0;
  return 10 - Math.floor(r * 10);
}

/** Inner-10 "X": used by the HUD and for tie-break flavour. */
export const isX = (x, y) => Math.hypot(x, y) < 0.05;

/**
 * The sight picture while drawing and holding. The bow arm sways with each
 * breath and wanders with small muscle tremors; both grow once the archer
 * has held full draw too long. The player steers against it, but the sight
 * has momentum, so it rewards small, early corrections over yanking it about.
 */
export class Aim {
  constructor(rng, cfg = ARCHERY) {
    this.cfg = cfg;
    this.rng = rng;
    // bring the bow up from slightly off the gold
    const a = rng() * Math.PI * 2;
    this.ctrl = { x: Math.cos(a) * 0.45, y: 0.35 + Math.abs(Math.sin(a)) * 0.3 };
    this.vel = { x: 0, y: 0 };
    this.wander = { x: 0, y: 0 };
    this.phase = rng() * Math.PI * 2;
    this.draw = 0;     // 0..1 how far the string is drawn
    this.held = 0;     // seconds at full draw
    this.t = 0;
  }

  /** Multiplier on sway: 1 while fresh, climbing once the arms tire. */
  get shake() {
    return 1 + Math.max(0, this.held - this.cfg.steadyTime) * this.cfg.fatigue;
  }

  get fullDraw() { return this.draw >= 1; }
  get timeUp() { return this.held >= this.cfg.maxHold; }

  /** Sway displacement from breathing and tremor at the current time. */
  get sway() {
    const c = this.cfg, k = this.shake;
    const w = (2 * Math.PI) / c.breathPeriod;
    return {
      x: (c.swayX * Math.sin(w * 0.63 * this.t + this.phase) + this.wander.x) * k,
      y: (c.swayY * Math.sin(w * this.t) + this.wander.y) * k,
    };
  }

  /** Where the sight is pointing now. */
  get pos() {
    const s = this.sway;
    return { x: this.ctrl.x + s.x, y: this.ctrl.y + s.y };
  }

  /**
   * @param {number} dt seconds
   * @param {boolean} drawing string hand is pulling (action held)
   * @param {number} sx steer -1..1 (left/right)
   * @param {number} sy steer -1..1 (up/down, + = down)
   */
  update(dt, drawing, sx = 0, sy = 0) {
    const c = this.cfg;
    this.t += dt;
    if (drawing) this.draw = Math.min(1, this.draw + dt / c.drawTime);
    if (this.fullDraw) this.held += dt;
    // tremor: a mean-reverting random walk
    const n = () => (this.rng() + this.rng() + this.rng() - 1.5) * 2;
    for (const k of ['x', 'y']) {
      this.wander[k] += (-this.wander[k] * 1.5 + n() * c.tremor * 4) * dt;
    }
    // steering with momentum
    this.vel.x += (sx * c.steerAccel - this.vel.x * c.damping) * dt;
    this.vel.y += (sy * c.steerAccel - this.vel.y * c.damping) * dt;
    this.ctrl.x = clamp(this.ctrl.x + this.vel.x * dt, -2, 2);
    this.ctrl.y = clamp(this.ctrl.y + this.vel.y * dt, -2, 2);
  }
}

/**
 * Where the arrow lands on the face.
 * @param {{x:number,y:number}} aim sight position at the loose
 * @param {number} draw 0..1 how far the string was drawn
 * @param {number} wind m/s crosswind, + blows the arrow right
 * @param {() => number & {normal:() => number}} rng
 */
export function loose(aim, draw, wind, rng, cfg = ARCHERY) {
  const under = 1 - clamp(draw, 0, 1);
  const spread = cfg.spread * (1 + under * 4);
  const x = aim.x + wind * cfg.windDrift * (1 + under) + rng.normal() * spread;
  const y = aim.y + under * cfg.sagPerUnder + rng.normal() * spread;
  return { x, y, score: ringScore(x, y), x10: isX(x, y) };
}

/** CPU total over a round for skill 0..1. */
export function cpuArchery(skill, rng, cfg = ARCHERY) {
  const sd = 0.3 - 0.19 * clamp(skill, 0, 1);
  let total = 0;
  for (let i = 0; i < cfg.arrows; i++) total += ringScore(rng.normal() * sd, rng.normal() * sd);
  return total;
}
