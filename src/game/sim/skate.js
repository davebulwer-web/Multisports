// Speed skating model (500m). Pure logic.
//
// Each push adds speed; the best push comes at the end of the glide, so the
// skill on the straights is a steady rhythm: early pushes are weak and break
// your balance, late ones waste glide. In the bends you must lean in to match
// the speed: too little and you drift wide (a longer way round, and the lane
// blocks if you go far enough), too much and your blades slip from under you.
import { clamp } from './rng.js';

export const SKATE = {
  sections: [
    { len: 100 }, { len: 90, r: 28 }, { len: 110 }, { len: 90, r: 28 }, { len: 110 },
  ],
  vmax: 15.5,
  push: 2.45,          // m/s from a perfect push at standstill
  drag: { k: 0.0045, c: 0.12 },
  lane: 4,             // metres of lane before the blocks
  g: 9.81,
  lean: { up: 70, down: 90, max: 60, ok: 6, slip: 13 },
  fall: 1.4,           // seconds on the ice after a fall
};

export const SKATE_LEN = SKATE.sections.reduce((a, s) => a + s.len, 0);

/** Time a full stride takes at speed v: the push window sits at the end. */
export const strideTime = (v) => clamp(0.62 - 0.012 * v, 0.42, 0.62);

/** Quality 0..1 of a push at phase p of the stride (1 = end of the glide). */
export function pushQuality(p) {
  if (p < 0.5) return 0.15;
  if (p < 0.85) return 0.15 + 0.85 * ((p - 0.5) / 0.35) ** 2;
  if (p <= 1.05) return 1;
  if (p <= 1.4) return 1 - ((p - 1.05) / 0.35) * 0.4;
  return 0.6;
}

export class Skater {
  constructor(cfg = SKATE) {
    this.cfg = cfg;
    this.d = 0;          // distance along the inside line
    this.v = 0;
    this.lean = 0;       // degrees
    this.offset = 0;     // metres out from the inside line
    this.since = 1;      // seconds since the last push
    this.t = 0;
    this.down = 0;       // seconds left on the ice after a fall
    this.over = 0;       // time spent over-leaning
    this.finished = false;
    this.pushes = 0;
    this.stats = { perfect: 0, early: 0, wide: 0, falls: 0 };
  }

  /** Section at the current distance: {i, len, r, start}. */
  get section() {
    let start = 0;
    for (let i = 0; i < this.cfg.sections.length; i++) {
      const s = this.cfg.sections[i];
      if (this.d < start + s.len || i === this.cfg.sections.length - 1) return { i, ...s, start };
      start += s.len;
    }
  }

  get inBend() { return !!this.section.r; }
  get phase() { return this.since / strideTime(this.v); }
  /** Lean the bend needs at this speed, in degrees (0 on a straight). */
  get need() {
    const s = this.section;
    return s.r ? Math.atan((this.v * this.v) / (this.cfg.g * (s.r + this.offset))) / (Math.PI / 180) : 0;
  }

  push() {
    if (this.down > 0 || this.finished) return null;
    const q = pushQuality(this.phase);
    const c = this.cfg;
    this.v = clamp(this.v + q * c.push * (1 - (this.v / c.vmax) ** 2), 0, c.vmax);
    if (q < 0.2) { this.v *= 0.985; this.stats.early++; }
    if (q >= 1) this.stats.perfect++;
    this.since = 0;
    this.pushes++;
    return { q };
  }

  /** @param {{lean:boolean}} u lean = holding the lean key */
  update(dt, { lean = false } = {}) {
    if (this.finished) return [];
    const c = this.cfg, ev = [];
    this.t += dt;
    this.since += dt;
    if (this.down > 0) {
      this.down -= dt;
      this.v = Math.max(0, this.v - 4 * dt);
      this.lean = 0;
    }
    this.v = Math.max(0, this.v - (c.drag.k * this.v * this.v + c.drag.c) * dt);
    const L = c.lean;
    this.lean = clamp(this.lean + (lean && this.down <= 0 ? L.up : -L.down) * dt, 0, L.max);

    const sec = this.section;
    if (sec.r && this.down <= 0) {
      const err = this.lean - this.need;
      if (err < -L.ok) this.offset += (-err - L.ok) * 0.12 * dt;
      else if (err > L.ok) this.offset = Math.max(0, this.offset - (err - L.ok) * 0.1 * dt);
      if (err > L.slip && this.v > 6) {
        this.over += dt;
        if (this.over > 0.3) {
          this.down = c.fall; this.v *= 0.3; this.over = 0; this.stats.falls++;
          ev.push({ type: 'fall' });
        }
      } else this.over = Math.max(0, this.over - dt);
      if (this.offset > c.lane) {
        this.offset = c.lane - 0.5;
        this.v *= 0.6;
        this.stats.wide++;
        ev.push({ type: 'blocks' });
      }
      this.d += this.v * (sec.r / (sec.r + this.offset)) * dt;
    } else {
      this.offset = Math.max(0, this.offset - 0.8 * dt);
      this.over = 0;
      this.d += this.v * dt;
    }
    const after = this.section;
    if (after.i !== sec.i) ev.push({ type: after.r ? 'bend' : 'straight' });
    if (this.d >= SKATE_LEN) { this.d = SKATE_LEN; this.finished = true; ev.push({ type: 'finish' }); }
    return ev;
  }
}

/** A skater that pushes at `at` of each stride and leans `leanErr` degrees off the need. */
export function runSkater({ at = 0.95, leanErr = 2, jitter = 0, rng = Math.random } = {}, cfg = SKATE) {
  const s = new Skater(cfg);
  const dt = 1 / 120;
  let target = at + (rng() - 0.5) * jitter;
  while (!s.finished && s.t < 120) {
    if (s.phase >= target) { s.push(); target = at + (rng() - 0.5) * jitter; }
    const lean = s.inBend && s.lean < s.need + leanErr;
    s.update(dt, { lean });
  }
  return s;
}

export const fmtSkate = (t) => (t == null ? '--' : `${t.toFixed(2)}S`);

/** CPU time (s) for skill 0..1. */
export function cpuSkate(skill, rng) {
  const s = clamp(skill, 0, 1);
  let t = 38.3 + (1 - s) * 5 + rng.normal() * (0.25 + 0.6 * (1 - s));
  if (rng() < 0.08 * (1 - s)) t += 3; // a slip in the bend
  return Math.round(t * 100) / 100;
}
