// Weightlifting model: timing gauges + balance hold. Pure logic.
import { clamp } from './rng.js';

export const LIFT = {
  minKg: 100,
  maxKg: 270,
  stepKg: 2.5,
  holdTime: 3,
  judgeTolerance: [0.72, 0.82, 0.92], // max |offset| each judge accepts
};

/** 0 (easy) .. ~1.1 (world record) */
export const difficulty = (kg) => clamp((kg - 100) / 150, 0, 1.2);

/** Gauge value 0..1..0 over a cycle. */
export function gauge(t, period) {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / period);
}

export function gaugePeriod(kg) { return 1.3 - 0.35 * difficulty(kg); }

/** Target zone for the pull/drive gauge. */
export function zone(kg, phase = 'clean') {
  const d = difficulty(kg);
  const half = phase === 'clean' ? 0.17 - 0.1 * d : 0.15 - 0.09 * d;
  const centre = phase === 'clean' ? 0.9 : 0.86;
  return { lo: centre - half, hi: Math.min(1, centre + half), centre, half };
}

/** Grade a press: quality 1 at zone centre, 0 at the edge, null if outside. */
export function grade(value, z) {
  if (value < z.lo || value > z.hi) return null;
  return clamp(1 - Math.abs(value - z.centre) / z.half, 0, 1);
}

/**
 * Overhead balance: the bar's front/back offset over the base of support.
 * It is an inverted pendulum, unstable, with random nudges. The player
 * shifts underneath it with left/right. |offset| > 1 = bar lost.
 */
export class Balance {
  constructor(kg, startOffset, rng) {
    const d = difficulty(kg);
    this.instab = 1.8 + 2.4 * d;
    this.nudge = 0.7 + 1.6 * d;
    this.push = 5.5;
    this.damp = 1.8;
    this.x = clamp(startOffset, -0.6, 0.6);
    this.v = 0;
    this.f = 0;
    this.fTimer = 0;
    this.rng = rng;
    this.maxAbs = Math.abs(this.x);
    this.time = 0;
    this.failed = false;
  }

  /** steer: -1 (back/left), 0, +1 (forward/right). */
  update(dt, steer) {
    if (this.failed) return;
    this.fTimer -= dt;
    if (this.fTimer <= 0) {
      this.fTimer = 0.25 + this.rng() * 0.3;
      this.f = (this.rng() * 2 - 1) * this.nudge;
    }
    const acc = this.instab * this.x + this.f + steer * this.push - this.damp * this.v;
    this.v += acc * dt;
    this.x += this.v * dt;
    this.time += dt;
    this.maxAbs = Math.max(this.maxAbs, Math.abs(this.x));
    if (Math.abs(this.x) > 1) this.failed = true;
  }

  /** Judges' decision: array of booleans (true = white light). */
  verdict(cfg = LIFT) {
    return cfg.judgeTolerance.map((tol) => !this.failed && this.maxAbs < tol);
  }
}

export const goodLift = (lights) => lights.filter(Boolean).length >= 2;

/** CPU best lift for skill 0..1 (null = no successful lift). */
export function cpuLift(skill, rng) {
  if (rng() < 0.07) return null;
  const kg = 135 + 95 * skill + rng.normal() * 6;
  return Math.round(kg / LIFT.stepKg) * LIFT.stepKg;
}
