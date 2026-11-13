// Rapid-fire pistol model. Pure logic, in screen pixels with +y DOWN.
//
// Five targets turn to face you for a few seconds: one shot at each, left to
// right. The sight swings with momentum, the hand trembles more the longer
// the arm is up, and every shot kicks the muzzle up. Fire as the kick
// settles on the next target: too soon and the shot goes high, too slow and
// the targets turn away before you finish. Three series: 8, 6 and 4 seconds.
import { clamp } from './rng.js';

export const PISTOL = {
  series: [8, 6, 4],                 // seconds the targets face you
  targets: [80, 136, 192, 248, 304], // target centres (x)
  targetY: 84,
  ring: 3,                           // ring width: 10 inside 3px, 5 inside 18px
  start: { x: 44, y: 196 },          // where the sight starts: arm down
  sight: { accel: 1000, maxSpeed: 240, friction: 7 },
  tremor: { base: 0.6, grow: 0.22 }, // px of wobble, + per second the arm is up
  recoil: { kick: 300, spring: 160, damp: 20 }, // muzzle flip (px/s) and how it settles
};

/** Rapid-fire score for a hole d pixels from the centre: 10 down to 5, else 0. */
export function ringFor(d, cfg = PISTOL) {
  if (d > cfg.ring * 6) return 0;
  return Math.min(10, 10 - Math.floor(Math.max(0, d - 1e-6) / cfg.ring));
}

/** The firing hand: steer with momentum, tremble, and kick up on each shot. */
export class Hand {
  constructor(rng, cfg = PISTOL) {
    this.cfg = cfg;
    this.x = cfg.start.x;
    this.y = cfg.start.y;
    this.vx = 0; this.vy = 0;
    this.kick = 0; this.kickV = 0; // recoil offset (up is -)
    this.up = 0;                   // seconds the arm has been raised
    this.t = 0;
    this.ph = [rng() * 6.3, rng() * 6.3, rng() * 6.3, rng() * 6.3];
  }

  /** Where the shot would go now. */
  get aim() {
    const c = this.cfg.tremor, a = c.base + c.grow * this.up, t = this.t, p = this.ph;
    return {
      x: this.x + a * (Math.sin(t * 7.1 + p[0]) * 0.7 + Math.sin(t * 12.7 + p[1]) * 0.3),
      y: this.y + this.kick + a * (Math.sin(t * 6.3 + p[2]) * 0.7 + Math.sin(t * 14.1 + p[3]) * 0.3),
    };
  }

  /** How settled the kick is, 1 = fully recovered. */
  get settled() { return 1 - clamp(Math.abs(this.kick) / 12, 0, 1); }

  /** sx, sy in -1..1 (+y = down). raised: the arm is up (series running). */
  update(dt, sx = 0, sy = 0, raised = true) {
    const c = this.cfg.sight, r = this.cfg.recoil;
    this.t += dt;
    if (raised) this.up += dt;
    else this.up = Math.max(0, this.up - dt * 4);
    const axis = (v, s) => {
      if (s) v += s * c.accel * dt;
      else v -= v * Math.min(1, c.friction * dt);
      return clamp(v, -c.maxSpeed, c.maxSpeed);
    };
    this.vx = axis(this.vx, sx);
    this.vy = axis(this.vy, sy);
    this.x = clamp(this.x + this.vx * dt, 4, 380);
    this.y = clamp(this.y + this.vy * dt, 16, 200);
    this.kickV += (-r.spring * this.kick - r.damp * this.kickV) * dt;
    this.kick += this.kickV * dt;
  }

  /** Fire: returns where the shot went, then kicks the muzzle up. */
  fire(rng) {
    const hole = this.aim;
    this.kickV -= this.cfg.recoil.kick * (0.9 + 0.2 * rng());
    this.vx += (rng() - 0.5) * 40;
    return hole;
  }
}

/** One series: five targets, one shot each. */
export class Series {
  constructor(time, cfg = PISTOL) {
    this.cfg = cfg;
    this.time = time;
    this.t = 0;
    this.shots = []; // {x, y, target, ring}
    this.over = false;
  }

  get facing() { return !this.over && this.t < this.time; }
  get score() { return this.shots.reduce((s, h) => s + h.ring, 0); }
  get done() { return this.over || this.shots.length >= this.cfg.targets.length; }

  update(dt) {
    if (this.over) return;
    this.t += dt;
    if (this.t >= this.time) this.over = true;
  }

  /** Score a shot at (x, y). A second hole in the same target scores nothing. */
  shot(x, y) {
    const c = this.cfg;
    let target = -1, best = Infinity;
    c.targets.forEach((tx, i) => { const d = Math.hypot(x - tx, y - c.targetY); if (d < best) { best = d; target = i; } });
    let ring = ringFor(best, c);
    if (!ring) target = -1;
    else if (this.shots.some((s) => s.target === target)) ring = 0;
    const s = { x, y, target, ring, d: best };
    this.shots.push(s);
    if (this.shots.length >= c.targets.length) this.over = true;
    return s;
  }
}

/**
 * A bot for tests and tuning: steer to each target and fire `gap` seconds
 * after the last shot (or, with gap null, once it is steady on the middle).
 */
export function runSeries(time, rng, { gap = null, cfg = PISTOL } = {}) {
  const hand = new Hand(rng, cfg), s = new Series(time, cfg), dt = 1 / 120;
  let last = 0;
  while (!s.done) {
    const tx = cfg.targets[s.shots.length], ty = cfg.targetY;
    const steer = (d, v) => clamp(d * 0.09 - v * 0.012, -1, 1);
    hand.update(dt, steer(tx - hand.x, hand.vx), steer(ty - hand.y, hand.vy));
    s.update(dt);
    const a = hand.aim;
    const ready = gap == null
      ? Math.hypot(a.x - tx, a.y - ty) < 2.5 && Math.hypot(hand.vx, hand.vy) < 25
      : s.t - last >= gap && Math.abs(a.x - tx) < 12;
    if (ready) { s.shot(a.x, a.y); hand.fire(rng); last = s.t; }
  }
  return { ...s, score: s.score, t: s.t, shots: s.shots };
}

/** CPU total out of 150 for skill 0..1. */
export function cpuPistol(skill, rng, cfg = PISTOL) {
  const s = clamp(skill, 0, 1);
  let total = 0;
  cfg.series.forEach((time) => {
    const mean = 6.4 + 3.2 * s - (8 - time) * 0.18 * (1 - s);
    for (let i = 0; i < cfg.targets.length; i++) total += clamp(Math.round(mean + rng.normal() * (1.1 - 0.6 * s)), 0, 10);
  });
  return total;
}
