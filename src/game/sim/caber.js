// Caber toss model. Pure logic.
//
// The caber balances on the thrower's hands like an inverted pendulum.
// Pitch (forward/back lean) is controlled by running: speeding up pulls the
// base forward under the top, so the caber leans back; easing off lets it
// topple forward. Roll (sideways lean) is steered with left/right. At the
// toss, speed and forward lean decide whether it turns over; any sideways
// lean or wobble sends it off the 12 o'clock line, which is what is judged.
import { clamp } from './rng.js';

export const CABER = {
  length: 5.6,        // metres
  tosses: 3,
  runway: 16,         // metres from the pick-up to the end of the run
  accel: 3.4,         // m/s^2 while running hard (fades towards vmax)
  ease: 2.4,          // m/s^2 slowing when you ease off
  vmax: 7,
  // Pitch in degrees, + = top leaning forward (away from the thrower).
  pitch: { fall: 1.9, push: 8, damp: 1.0, drop: 34, gust: 12 },
  // Roll in degrees, + = top leaning right (towards 1 o'clock).
  roll: { fall: 1.3, control: 24, damp: 1.6, drop: 24, gust: 9 },
  sweet: [8, 22],     // forward lean (deg) that turns it cleanly
};

/** Minutes off 12 o'clock as a clock face reading, e.g. -15 -> '11:45'. */
export function fmtClock(off) {
  const total = ((Math.round(off) % 720) + 720) % 720;
  const h = Math.floor(total / 60) || 12;
  return `${h}:${String(total % 60).padStart(2, '0')}`;
}

/** Points for a toss: 100 at 12:00, falling to 0 at 9:00 or 3:00. */
export const tossPoints = (off) => Math.max(0, Math.round(100 * (1 - Math.abs(off) / 180)));

export class Caber {
  constructor(rng, cfg = CABER) {
    this.cfg = cfg;
    this.rng = rng;
    this.x = 0; this.v = 0;
    this.pitch = 3 + rng() * 3; this.pitchV = 0;
    this.roll = (rng() - 0.5) * 4; this.rollV = 0;
    this.gustP = 0; this.gustR = 0; this.gustT = 0;
    this.t = 0;
    this.dropped = null; // 'FORWARD' | 'BACK' | 'SIDEWAYS'
    this.a = 0;
  }

  get toLine() { return this.cfg.runway - this.x; }

  /** @param {{run:boolean, steer:number}} u steer -1..1 (+ pushes the top right) */
  update(dt, { run, steer = 0 }) {
    if (this.dropped) return;
    const c = this.cfg;
    this.t += dt;
    // running: accelerating hard fades out near top speed
    let a = run ? c.accel * (1 - this.v / c.vmax) : this.v > 0 ? -c.ease : 0;
    this.v = clamp(this.v + a * dt, 0, c.vmax);
    if (this.v === 0 && a < 0) a = 0;
    this.a = a;
    this.x += this.v * dt;

    // slowly wandering gusts / grip wobble
    this.gustT -= dt;
    if (this.gustT <= 0) {
      this.gustT = 0.3 + this.rng() * 0.4;
      this.gustP = this.rng.normal() * c.pitch.gust * 0.5;
      this.gustR = this.rng.normal() * c.roll.gust * 0.5;
    }
    const p = c.pitch;
    const pAcc = p.fall * this.pitch - p.push * a - p.damp * this.pitchV + this.gustP;
    this.pitchV += pAcc * dt;
    this.pitch += this.pitchV * dt;
    const r = c.roll;
    const rAcc = r.fall * this.roll + r.control * clamp(steer, -1, 1) - r.damp * this.rollV + this.gustR;
    this.rollV += rAcc * dt;
    this.roll += this.rollV * dt;

    if (this.pitch > p.drop) this.dropped = 'FORWARD';
    else if (this.pitch < -p.drop) this.dropped = 'BACK';
    else if (Math.abs(this.roll) > r.drop) this.dropped = 'SIDEWAYS';
  }

  /** Release the caber. Returns the result of the toss. */
  toss() {
    return tossResult({ v: this.v, pitch: this.pitch, pitchV: this.pitchV, roll: this.roll }, this.rng, this.cfg);
  }
}

/**
 * Outcome of a toss.
 * turn: >= 1 means it goes over the top. off: minutes off 12 o'clock.
 */
export function tossResult({ v, pitch, pitchV = 0, roll = 0 }, rng = Math.random, cfg = CABER) {
  const [lo, hi] = cfg.sweet;
  const turn = v / 6 + clamp(pitch, -20, 30) / 30;
  if (turn < 1) return { turned: false, turn, off: null, points: 0 };
  const side = roll !== 0 ? Math.sign(roll) : rng() < 0.5 ? -1 : 1;
  const outside = pitch < lo ? lo - pitch : pitch > hi ? pitch - hi : 0;
  let off = roll * 4 + side * (outside * 3 + Math.abs(pitchV) * 0.6);
  off += (rng() - 0.5) * 8;
  off *= 1 + Math.max(0, 1.3 - turn) * 1.5; // a toss that barely turns falls off line
  off = clamp(off, -179, 179);
  return { turned: true, turn, off, points: tossPoints(off) };
}

/** CPU total over three tosses for skill 0..1. */
export function cpuCaber(skill, rng, cfg = CABER) {
  const s = clamp(skill, 0, 1);
  let total = 0;
  for (let i = 0; i < cfg.tosses; i++) {
    if (rng() < 0.05 + 0.3 * (1 - s)) continue;
    const off = Math.abs(rng.normal()) * (8 + 45 * (1 - s));
    total += tossPoints(off);
  }
  return total;
}
