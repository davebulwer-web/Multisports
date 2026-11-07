// Cliff diving model. Pure logic, metres and seconds, +y up, x away from the cliff.
//
// Angular momentum is fixed at take-off; the diver only changes how fast
// they spin by changing shape (moment of inertia). Tucked or piked spins
// fast, opened out spins slowly, and arms out spins slower still. High
// divers enter feet first, so the skill is opening out at the right moment
// for the slow open rotation to bring you exactly upright at the water.
import { clamp } from './rng.js';

export const DIVE = {
  height: 26,          // platform above the water
  g: 9.81,
  rounds: 3,
  lift: 3.2,           // m/s upward spring from a perfect take-off
  drift: 1.1,          // m/s away from the cliff
  clear: 0.12,         // s after take-off before you can pull into position
  shape: 0.08,         // s time constant for changing shape
  inertia: { open: 1, pike: 0.5, tuck: 0.32, arms: 1.45 },
  openLead: 0.75,      // reference plan: open this long before entry
  swing: 1.3,          // s per arm swing on the platform
  dives: [
    { id: 'f1p', name: 'FORWARD 1 SOMERSAULT PIKE', short: 'FWD 1 PIKE', n: 1, pos: 'pike', back: false, dd: 2.0 },
    { id: 'b2t', name: 'BACK 2 SOMERSAULTS TUCK', short: 'BACK 2 TUCK', n: 2, pos: 'tuck', back: true, dd: 2.8 },
    { id: 'f2p', name: 'FORWARD 2 SOMERSAULTS PIKE', short: 'FWD 2 PIKE', n: 2, pos: 'pike', back: false, dd: 3.2 },
    { id: 'b3t', name: 'BACK 3 SOMERSAULTS TUCK', short: 'BACK 3 TUCK', n: 3, pos: 'tuck', back: true, dd: 3.8 },
    { id: 'f3t', name: 'FORWARD 3 SOMERSAULTS TUCK', short: 'FWD 3 TUCK', n: 3, pos: 'tuck', back: false, dd: 4.1 },
  ],
};

/** Take-off quality 0..1 from the arm swing position (-1..1, 1 = top). */
export const takeoffQuality = (swing) => clamp((swing - 0.35) / 0.6, 0, 1);

/** Seconds from take-off to the water for a given take-off quality. */
export function flightTime(q, cfg = DIVE) {
  const vy = cfg.lift * (0.55 + 0.45 * q);
  return (vy + Math.sqrt(vy * vy + 2 * cfg.g * cfg.height)) / cfg.g;
}

/** Angular momentum that completes the dive with the reference plan. */
export function designMomentum(dive, cfg = DIVE) {
  const T = flightTime(1, cfg);
  const d = new Diver(dive, cfg, 1);
  d.takeoff(1);
  while (d.phase === 'air') d.update(1 / 240, { tuck: d.t < T - cfg.openLead });
  return (360 * dive.n) / d.angle;
}

export class Diver {
  /** L: angular momentum (deg/s when open); defaults to the dive's design value. */
  constructor(dive, cfg = DIVE, L = null) {
    this.dive = dive;
    this.cfg = cfg;
    this.L = L;
    this.phase = 'edge';
    this.t = 0;
    this.x = 0; this.y = cfg.height;
    this.vx = 0; this.vy = 0;
    this.angle = 0;          // degrees rotated in the dive's direction
    this.I = 1;
    this.shape = 'open';
    this.openT = 0;          // time spent open in a row
    this.wasIn = false;
    this.breaks = 0;         // pulled back into position after opening
    this.result = null;
  }

  get target() { return 360 * this.dive.n; }
  get spin() { return this.L / this.I; }

  takeoff(q) {
    const c = this.cfg;
    this.q = q;
    if (this.L == null) this.L = designMomentum(this.dive, c);
    this.L *= 0.9 + 0.1 * q;
    this.vy = c.lift * (0.55 + 0.45 * q);
    this.vx = c.drift;
    this.phase = 'air';
  }

  /** @param {{tuck:boolean, arms?:boolean}} u */
  update(dt, { tuck, arms = false }) {
    if (this.phase !== 'air') return;
    const c = this.cfg;
    this.t += dt;
    const into = tuck && this.t >= c.clear;
    const shape = into ? this.dive.pos : arms ? 'arms' : 'open';
    if (into && !this.wasIn && this.openedOnce) this.breaks++;
    if (!into && this.wasIn) this.openedOnce = true;
    this.wasIn = into;
    this.shape = shape;
    this.I += (c.inertia[shape] - this.I) * Math.min(1, dt / c.shape);
    this.angle += (this.L / this.I) * dt;
    this.openT = this.I > 0.85 ? this.openT + dt : 0;
    this.x += this.vx * dt;
    this.vy -= c.g * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) {
      this.y = 0;
      this.phase = 'in';
      this.result = {
        error: this.angle - this.target,
        q: this.q,
        openT: this.openT,
        tucked: this.I < 0.7,
        breaks: this.breaks,
      };
    }
  }
}

/** How the entry looked. */
export function entryWord({ error, tucked }) {
  const e = Math.abs(error);
  if (e > 135) return 'FAILED DIVE';
  if (e > 65) return error > 0 ? 'OVER - SLAP!' : 'SHORT - SLAP!';
  if (tucked) return 'ENTERED TUCKED';
  if (e < 6) return 'RIP ENTRY';
  if (e < 15) return 'CLEAN';
  return error > 0 ? 'OVER-ROTATED' : 'SHORT';
}

/** Five judges' marks (0-10, halves); the middle three times DD score. */
export function judge(result, dd, rng) {
  const e = Math.abs(result.error);
  let base;
  if (e > 135) base = 0;
  else {
    base = 10 - e / 9 - (1 - result.q) * 2 - Math.max(0, 0.4 - result.openT) * 5 - result.breaks * 1;
    if (result.tucked) base -= 3;
    if (e > 65) base = Math.min(base, 2);
  }
  const marks = Array.from({ length: 5 }, () => (base <= 0 ? 0 : clamp(Math.round((base + (rng() - 0.5) * 1.2) * 2) / 2, 0, 10)));
  const sorted = [...marks].sort((a, b) => a - b);
  const sum = sorted.slice(1, 4).reduce((a, b) => a + b, 0);
  return { marks, sum, dropped: [marks.indexOf(sorted[0]), marks.lastIndexOf(sorted[4])], points: Math.round(sum * dd * 10) / 10 };
}

/** CPU total over the rounds for skill 0..1: better divers pick harder dives. */
export function cpuDive(skill, rng, cfg = DIVE) {
  const s = clamp(skill, 0, 1);
  const byDD = [...cfg.dives].sort((a, b) => a.dd - b.dd);
  const start = Math.round(s * (byDD.length - cfg.rounds));
  let total = 0;
  for (const d of byDD.slice(start, start + cfg.rounds)) {
    if (rng() < 0.12 * (1 - s)) { total += d.dd * 4; continue; }
    const avg = clamp(5 + 3.8 * s + rng.normal() * 0.6, 0, 10);
    total += avg * 3 * d.dd;
  }
  return Math.round(total * 10) / 10;
}
