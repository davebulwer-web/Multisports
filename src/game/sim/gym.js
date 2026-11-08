// Gym tests: squat thrusts then parallel bar dips, 30 seconds each, as many
// clean reps as you can. Pure logic.
//
// DOWN sends the body one way (legs kicked back / lowering on the bars), UP
// brings it back (legs in / pushing up). A rep only counts if you reach both
// lines. Press the next way just as you hit the end and you spring off it,
// quicker; press before you get there and you turn short, no rep. Springing
// tires you faster, and tired muscles move slower, so pace yourself.
import { clamp } from './rng.js';

export const GYM = {
  time: 30,
  outLine: 0.9,       // how far a rep must go
  inLine: 0.1,        // ... and come back
  spring: 0.13,       // seconds after reaching the end that count as a spring
  springBoost: 1.35,
  tiredSlow: 0.55,    // speed lost at full fatigue
  recover: 0.12,      // fatigue lost a second while still
  exercises: {
    squat: { name: 'SQUAT THRUSTS', tOut: 0.42, tIn: 0.46, fOut: 0.012, fIn: 0.014 },
    dips:  { name: 'PARALLEL BAR DIPS', tOut: 0.4, tIn: 0.62, fOut: 0.006, fIn: 0.02 },
  },
};

export class Exercise {
  constructor(kind, cfg = GYM) {
    this.cfg = cfg;
    this.ex = cfg.exercises[kind];
    this.kind = kind;
    this.p = 0;           // 0 = start position, 1 = far end
    this.dir = 0;         // -1 in, +1 out, 0 still
    this.speed = 0;
    this.fatigue = 0;
    this.reachedOut = false;
    this.reps = 0;
    this.noReps = 0;
    this.t = 0;
    this.arrivedAt = 0;   // when the body last stopped at an end
    this.atEnd = 0;       // -1 in, +1 out, 0 moving
    this.finished = false;
    this.springs = 0;
  }

  /** @param {1|-1} d DOWN = +1 (out), UP = -1 (in) */
  move(d) {
    if (this.finished || d === this.dir) return null;
    const c = this.cfg, ex = this.ex;
    let res = { type: 'move' };
    // turning back before reaching the line on this side
    if (this.dir === 1 && d === -1 && this.p < c.outLine) { this.noReps++; res = { type: 'short' }; }
    if (this.dir === -1 && d === 1 && this.p > c.inLine && this.reachedOut) { this.noReps++; this.reachedOut = false; res = { type: 'short' }; }
    const spring = this.atEnd === -d && this.t - this.arrivedAt <= c.spring;
    const base = 1 / (d === 1 ? ex.tOut : ex.tIn);
    this.speed = base * (1 - c.tiredSlow * this.fatigue) * (spring ? c.springBoost : 1);
    this.fatigue = clamp(this.fatigue + (d === 1 ? ex.fOut : ex.fIn) * (spring ? 1.6 : 1), 0, 1);
    if (spring) { this.springs++; res.spring = true; }
    this.dir = d;
    this.atEnd = 0;
    return res;
  }

  update(dt) {
    const c = this.cfg, ev = [];
    if (this.finished) return ev;
    this.t += dt;
    if (this.dir === 0) this.fatigue = Math.max(0, this.fatigue - c.recover * dt);
    else {
      this.p += this.dir * this.speed * dt;
      if (this.p >= 1) { this.p = 1; this.stop(1); }
      if (this.p <= 0) { this.p = 0; this.stop(-1); }
      if (this.p >= c.outLine) this.reachedOut = true;
      if (this.p <= c.inLine && this.reachedOut && this.dir === -1) {
        this.reachedOut = false;
        this.reps++;
        ev.push({ type: 'rep', n: this.reps });
      }
    }
    if (this.t >= c.time) { this.finished = true; ev.push({ type: 'time' }); }
    return ev;
  }

  stop(end) { this.dir = 0; this.atEnd = end; this.arrivedAt = this.t; }
}

/** A bot: presses `lag` seconds after reaching each end (negative = early turns). */
export function runExercise(kind, { lag = 0.05, rest = 0 } = {}) {
  const e = new Exercise(kind);
  const dt = 1 / 240;
  let restUntil = 0;
  while (!e.finished) {
    e.update(dt);
    if (e.t < restUntil) continue;
    if (rest && e.fatigue > 0.6) { restUntil = e.t + rest; continue; }
    if (lag < 0) {
      // turning early: before reaching the lines
      if (e.dir === 1 && e.p >= 1 + lag) e.move(-1);
      else if (e.dir === -1 && e.p <= -lag) e.move(1);
      else if (e.dir === 0) e.move(e.atEnd === 1 ? -1 : 1);
    } else if (e.dir === 0 && e.t - e.arrivedAt >= lag) e.move(e.atEnd === 1 ? -1 : 1);
  }
  return e;
}

/** CPU total reps for skill 0..1. */
export function cpuGym(skill, rng) {
  const s = clamp(skill, 0, 1);
  return Math.max(10, Math.round(30 + s * 20 + rng.normal() * (1.5 + 3 * (1 - s))));
}
