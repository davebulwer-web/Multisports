// Bobsleigh model: a push start where you load in at the right moment, then
// a run down an ice tube where the sled swings up the walls in the bends
// like a pendulum. Steer to hold the line: swinging about scrubs speed,
// steering hard scrubs speed, and swinging over the lip flips you.
// Pure logic in metres and radians.
import { clamp } from './rng.js';

export const BOB = {
  push: { zone: 50, accel: 4, max: 13, lateLoss: 4, coast: 0.6 },
  slope: 1.9,              // m/s^2 downhill pull
  drag: 0.0012,            // air drag per v^2
  scrubSwing: 2.2,         // m/s^2 per radian off the ideal line
  scrubSteer: 0.6,         // m/s^2 at full steer
  tube: 3.0,               // pendulum radius (m) of the sled in the tube
  damping: 0.5,
  steer: 5,                // rad/s^2 at full steer
  flip: 1.5,               // radians up the wall (~86°) and you're over
  ease: 18,                // metres over which a bend's curvature builds up
  gravity: 9.81,
  // [length m, curvature 1/m (+ = right)]
  track: [
    [140, 0], [70, 0.012], [50, 0], [80, -0.015], [40, 0], [90, 0.018],
    [60, 0], [45, -0.02], [30, 0], [45, 0.02], [70, 0], [110, -0.016],
    [50, 0], [40, 0.019], [25, -0.019], [40, 0.019], [80, 0], [120, 0.014],
    [140, 0],
  ],
};

/** Track as cumulative sections. */
export const TRACK = (() => {
  let s = 0;
  const secs = BOB.track.map(([len, k]) => { const o = { start: s, len, k }; s += len; return o; });
  return { secs, length: s };
})();

/** Curvature at distance s, eased in and out of each bend. */
export function curveAt(s, cfg = BOB) {
  const secs = TRACK.secs;
  for (let i = 0; i < secs.length; i++) {
    const c = secs[i];
    if (s < c.start || s >= c.start + c.len) continue;
    if (!c.k) return 0;
    const into = s - c.start, left = c.start + c.len - s;
    return c.k * Math.min(1, into / cfg.ease, left / cfg.ease);
  }
  return 0;
}

/** Ideal angle up the wall at speed v and curvature k (+ = up the right wall).
 * A right-hand bend (k > 0) throws the sled up the outside, left, wall. */
export const idealAngle = (v, k, cfg = BOB) => -Math.atan2(v * v * k, cfg.gravity);

export class Bob {
  constructor(cfg = BOB) {
    this.cfg = cfg;
    this.phase = 'push';  // push | run | done
    this.s = -cfg.push.zone; // distance along the track; 0 = end of push zone
    this.v = 0;
    this.t = 0;
    this.startTime = null; // time to the end of the push zone
    this.angle = 0;        // radians around the tube, + = right wall
    this.spin = 0;
    this.loaded = false;
    this.crashes = 0;
    this.scrub = 0;
    this.splits = [];
  }

  /** Push phase input: pushing = holding the push key; load = pressed to jump in. */
  push(dt, pushing, load) {
    const p = this.cfg.push;
    if (!this.loaded) {
      if (pushing) this.v += p.accel * (1 - this.v / p.max) * dt;
      else this.v = Math.max(0, this.v - p.coast * dt);
      if (load && this.v > 1) this.loaded = true;
    }
    this.advance(dt);
    if (this.s >= 0 && this.startTime == null) {
      this.startTime = this.t;
      if (!this.loaded) { this.loaded = true; this.lateLoad = true; this.v = Math.max(2, this.v - p.lateLoss); }
      this.phase = 'run';
    }
  }

  advance(dt) {
    const c = this.cfg;
    this.t += dt;
    if (this.loaded) this.v += (c.slope * (this.s >= 0 ? 1 : 0.4) - c.drag * this.v * this.v) * dt;
    this.s += this.v * dt;
  }

  /** Run phase. steer -1 (left) .. +1 (right). */
  run(dt, steer = 0) {
    const c = this.cfg;
    const k = curveAt(this.s);
    const eq = idealAngle(this.v, k, c);
    const geff = Math.hypot(c.gravity, this.v * this.v * k);
    const u = clamp(steer, -1, 1);
    this.spin += (-(geff / c.tube) * Math.sin(this.angle - eq) - c.damping * this.spin + c.steer * u) * dt;
    this.angle += this.spin * dt;
    this.eq = eq;
    const off = Math.abs(this.angle - eq);
    const loss = c.scrubSwing * off + c.scrubSteer * Math.abs(u);
    this.scrub += loss * dt;
    this.v = Math.max(3, this.v - loss * dt);
    if (Math.abs(this.angle) > c.flip) {
      // over the lip: the sled rolls, the crew rights it, lots of time lost
      this.crashes++;
      this.crashT = this.t;
      this.v *= 0.45;
      this.angle = eq * 0.5;
      this.spin = 0;
    }
    const before = this.s;
    this.advance(dt);
    for (const m of [TRACK.length * 0.25, TRACK.length * 0.5, TRACK.length * 0.75]) if (before < m && this.s >= m) this.splits.push(this.t);
    if (this.s >= TRACK.length) { this.phase = 'done'; this.finish = this.t; }
  }

  get kmh() { return this.v * 3.6; }
}

export const fmtBob = (s) => (s == null ? '--' : `${s.toFixed(2)}S`);

/** CPU run time for skill 0..1. */
export function cpuBob(skill, rng, cfg = BOB) {
  const s = clamp(skill, 0, 1);
  const crash = rng() < 0.12 * (1 - s) ? 6 : 0;
  return Math.round((63 - 9 * s + (rng() - 0.5) * 2 + crash) * 100) / 100;
}
