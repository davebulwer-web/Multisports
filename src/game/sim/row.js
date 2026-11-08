// Rowing (single sculls, 500m). Pure logic.
//
// A stroke is a drive (hold SPACE: the seat slides back and the blade pulls)
// and a recovery (let go: the seat rolls forward again). Catch the next
// stroke right as the seat reaches the front: early is a short, rushed
// stroke, late lets the boat sit and slow. Let go at the end of the slide:
// early wastes length, holding on too long catches a crab. Hold UP during
// the drive for a power stroke, which burns stamina you'll want for the end.
import { clamp } from './rng.js';

export const ROW = {
  len: 500,
  drive: 0.55,        // seconds for a full drive
  powerDrive: 0.42,
  recover: 0.8,       // seconds for the seat to roll forward
  force: 1.85,        // m/s² while driving (average over the slide)
  powerForce: 2.9,
  k: 0.012,           // drag: v² * k
  sit: 0.6,           // extra drag while waiting at the front
  catchOk: 0.1,       // slide still to go when a catch is clean
  finishOk: 0.9,      // slide done when a release is clean
  crabAfter: 0.14,    // seconds held past the end before the blade digs in
  crab: 1.1,          // seconds stuck
  drain: 0.07,        // stamina per second of power drive
  regen: 0.012,       // stamina per second otherwise
  tired: 0.12,        // below this, every stroke is weak
};

export class Rower {
  constructor(cfg = ROW) {
    this.cfg = cfg;
    this.d = 0;
    this.v = 0;
    this.slide = 0;       // 0 = front (catch), 1 = back (finish)
    this.phase = 'ready'; // ready | drive | recover | crab
    this.held = 0;        // time held at the end of the slide
    this.stuck = 0;
    this.stamina = 1;
    this.power = false;
    this.t = 0;
    this.strokes = 0;
    this.finished = false;
    this.stats = { clean: 0, rushed: 0, short: 0, crabs: 0, late: 0 };
    this.waitFront = 0;
  }

  /** SPACE down: put the blade in. */
  catch() {
    if (this.finished || this.phase === 'drive' || this.phase === 'crab') return null;
    const c = this.cfg, early = this.slide > c.catchOk && this.phase === 'recover';
    // the boat checks a little at every catch, more when the slide is rushed
    this.v *= early ? 0.965 : 0.985;
    if (early) this.stats.rushed++;
    else if (this.waitFront > 0.25) this.stats.late++;
    else this.stats.clean++;
    this.phase = 'drive';
    this.held = 0;
    this.strokes++;
    this.waitFront = 0;
    return { grade: early ? 'RUSHED' : 'CLEAN', from: this.slide };
  }

  /** SPACE up: take the blade out. */
  release() {
    if (this.phase !== 'drive') return null;
    const short = this.slide < this.cfg.finishOk;
    if (short) { this.stats.short++; this.v *= 0.97; } // the blade washes out
    this.phase = 'recover';
    return { grade: short ? 'SHORT' : 'CLEAN' };
  }

  /** @param {{power?:boolean}} u power = UP held */
  update(dt, { power = false } = {}) {
    if (this.finished) return [];
    const c = this.cfg, ev = [];
    this.t += dt;
    this.power = power && this.stamina > 0;
    let a = -c.k * this.v * this.v;
    switch (this.phase) {
      case 'drive': {
        const p = this.power;
        this.slide += dt / (p ? c.powerDrive : c.drive);
        if (this.slide >= 1) {
          this.slide = 1;
          this.held += dt;
          if (this.held > c.crabAfter) {
            this.phase = 'crab'; this.stuck = c.crab; this.v *= 0.55; this.stats.crabs++;
            ev.push({ type: 'crab' });
          }
        } else {
          const tired = this.stamina < c.tired ? 0.6 : 1;
          // the pull peaks mid-drive (legs and back together)
          a += (p ? c.powerForce : c.force) * tired * 1.57 * Math.sin(Math.PI * this.slide) * (1 - (this.v / 12) ** 2);
        }
        if (p) this.stamina = Math.max(0, this.stamina - c.drain * dt);
        break;
      }
      case 'recover':
        this.slide = Math.max(0, this.slide - dt / c.recover);
        if (this.slide === 0) { this.waitFront += dt; a -= c.sit * Math.min(1, this.v); }
        break;
      case 'crab':
        this.stuck -= dt;
        a -= 0.5 * this.v;
        if (this.stuck <= 0) { this.phase = 'recover'; }
        break;
    }
    if (!this.power) this.stamina = Math.min(1, this.stamina + c.regen * dt);
    this.v = Math.max(0, this.v + a * dt);
    this.d += this.v * dt;
    if (this.d >= c.len) { this.d = c.len; this.finished = true; ev.push({ type: 'finish' }); }
    return ev;
  }
}

/**
 * A bot rower: catches with `early` slide still to go (plus `wait` seconds at
 * the front), lets go at `finish`, and powers from `powerFrom` metres.
 */
export function runRower({ early = 0.02, wait = 0, finish = 0.97, powerFrom = 380, jitter = 0, rng = Math.random } = {}, cfg = ROW) {
  const r = new Rower(cfg);
  const dt = 1 / 120;
  let waited = 0;
  r.catch();
  while (!r.finished && r.t < 200) {
    const power = r.d >= powerFrom;
    r.update(dt, { power });
    if (r.phase === 'drive' && r.slide >= finish + (rng() - 0.5) * jitter * 0.2) r.release();
    if (r.phase === 'recover') {
      if (r.slide <= early + (rng() - 0.5) * jitter * 0.3) {
        waited += dt;
        if (waited >= wait) { r.catch(); waited = 0; }
      }
    }
  }
  return r;
}

/** A rival boat driven stroke by stroke (for the race view). */
export class RowBot {
  constructor(skill = 0.6, rng = Math.random, cfg = ROW) {
    this.r = new Rower(cfg);
    this.rng = rng;
    this.skill = clamp(skill, 0, 1);
    this.powerFrom = 300 + (1 - this.skill) * 120;
    this.pick();
    this.wait = 0;
  }
  pick() {
    const s = this.skill, n = () => (this.rng() - 0.5) * (1 - s);
    this.early = Math.max(0, 0.03 + n() * 0.3);
    this.finish = Math.min(1, 0.95 + n() * 0.25);
    this.lag = Math.max(0, (1 - s) * 0.25 * this.rng());
  }
  update(dt) {
    const r = this.r;
    if (r.phase === 'ready') r.catch();
    const ev = r.update(dt, { power: r.d >= this.powerFrom });
    if (r.phase === 'drive' && r.slide >= this.finish) r.release();
    if (r.phase === 'recover' && r.slide <= this.early) {
      this.wait += dt;
      if (this.wait >= this.lag) { r.catch(); this.wait = 0; this.pick(); }
    }
    return ev;
  }
}

export const fmtRow = (t) => {
  if (t == null) return '--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
};

/** CPU time (s) for skill 0..1. */
export function cpuRow(skill, rng) {
  const s = clamp(skill, 0, 1);
  let t = 79.5 + (1 - s) * 9 + rng.normal() * (0.4 + 1.2 * (1 - s));
  if (rng() < 0.1 * (1 - s)) t += 3; // caught a crab
  return Math.round(t * 100) / 100;
}
