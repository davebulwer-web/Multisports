// 100m sprint rhythm model. Pure logic, no rendering.
//
// Each stride is a press of the foot that did NOT step last. The next stride
// has an ideal moment (lastStep + period); period shortens as speed builds, so
// the beat accelerates through the race. Pressing on the beat adds speed,
// early presses overstride (lose speed), late presses add little and the
// runner decelerates while waiting. Same-foot presses are a slip.

import { clamp } from './rng.js';

export const SPRINT = {
  distance: 100,
  vmax: 11.4,       // m/s top speed with perfect rhythm
  window: 0.085,    // +/- seconds around the ideal beat that still counts
  gain: 0.2,        // fraction of remaining speed gained by a perfect stride
  fatigueFrom: 65,  // metres
  firstPush: 2.2,   // m/s from the first drive out of the blocks
};

export class SprintRunner {
  constructor(cfg = SPRINT) {
    this.cfg = cfg;
    this.x = 0;
    this.v = 0;
    this.t = 0;
    this.started = false;
    this.finished = false;
    this.finishTime = null;
    this.reaction = null;
    this.lastFoot = null;
    this.lastStep = 0;
    this.nextIdeal = 0;
    this.stats = { perfect: 0, good: 0, early: 0, late: 0, slip: 0 };
  }

  period() { return clamp(0.46 - 0.02 * this.v, 0.24, 0.46); }
  vmaxNow() { return this.cfg.vmax - Math.max(0, this.x - this.cfg.fatigueFrom) * 0.012; }

  /** Register a stride. foot: 'left'|'right', t: seconds since the gun. */
  step(foot, t) {
    if (this.finished) return { grade: 'done' };
    const W = this.cfg.window;
    if (!this.started) {
      this.started = true;
      this.reaction = t;
      this.v = this.cfg.firstPush;
      this.lastFoot = foot;
      this.lastStep = t;
      this.nextIdeal = t + this.period();
      return { grade: 'go', dt: 0 };
    }
    if (foot === this.lastFoot) {
      this.v *= 0.75;
      this.stats.slip++;
      return { grade: 'slip', dt: 0 };
    }
    const dt = t - this.nextIdeal;
    let grade;
    const room = Math.max(0, this.vmaxNow() - this.v);
    if (dt < -W) {
      this.v *= 0.88;
      grade = 'early';
    } else if (dt <= W) {
      const q = 1 - Math.abs(dt) / W;
      this.v += this.cfg.gain * room * (0.35 + 0.65 * q);
      grade = q > 0.55 ? 'perfect' : 'good';
    } else {
      this.v += this.cfg.gain * room * 0.15;
      grade = 'late';
    }
    this.stats[grade]++;
    this.lastFoot = foot;
    this.lastStep = t;
    this.nextIdeal = t + this.period();
    return { grade, dt };
  }

  /** Advance physics to time t (seconds since gun). */
  update(t) {
    const dt = t - this.t;
    this.t = t;
    if (!this.started || this.finished || dt <= 0) return;
    if (t > this.nextIdeal + this.cfg.window) this.v = Math.max(0.8, this.v - 3.5 * dt); // waiting for a stride
    if (this.v > this.vmaxNow()) this.v = Math.max(this.vmaxNow(), this.v - 2 * dt);
    const nx = this.x + this.v * dt;
    if (nx >= this.cfg.distance) {
      const frac = (this.cfg.distance - this.x) / (nx - this.x);
      this.finishTime = t - dt + dt * frac;
      this.finished = true;
      this.x = this.cfg.distance;
    } else this.x = nx;
  }

  /** Beat progress 0..1 toward the ideal moment (for the rhythm meter). */
  beatPhase(t) {
    if (!this.started) return 0;
    return (t - this.lastStep) / (this.nextIdeal - this.lastStep);
  }
}

/** CPU time for skill 0..1. */
export function cpuSprint(skill, rng) {
  return Math.round((13.4 - 2.7 * skill + rng.normal() * 0.18) * 100) / 100;
}
