// Hammer throw model. Pure logic.
//
// The hammer swings round the thrower. Each turn you press as the ball
// sweeps through its low point (the front of the circle, angle 0): on time
// adds speed, off time adds less and knocks you off balance, and a second
// press in the same turn is a stumble. After the wind-ups you get up to
// HAMMER.maxTurns turns; release with UP while the ball's path points into
// the sector. Stay in too long and you foul out of the circle.
import { clamp } from './rng.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export const HAMMER = {
  r: 1.95,             // metres from the axis to the ball
  w0: 6.2,             // rad/s after the wind-ups
  wMax: 16.6,
  gain: 2.7,           // rad/s from a perfect turn
  window: 32 * DEG,    // either side of the low point for any credit
  perfect: 9 * DEG,
  sector: 17 * DEG,    // half the landing sector
  aim: Math.PI / 2,    // ball angle whose tangent points down the sector
  launch: 42,          // degrees, best release elevation
  maxTurns: 5,
  winds: 2,
  g: 9.81,
  h: 1.6,              // release height
};

/** Credit 0..1 for a press `err` radians from the low point. */
export function turnQuality(err, cfg = HAMMER) {
  const e = Math.abs(err);
  if (e <= cfg.perfect) return 1;
  if (e >= cfg.window) return 0;
  return 1 - (e - cfg.perfect) / (cfg.window - cfg.perfect);
}

/** Wrap an angle to -PI..PI. */
const wrap = (a) => ((a % TAU) + TAU + Math.PI) % TAU - Math.PI;

/** Distance (m) for a release at ball speed v, direction error dir and elevation (deg). */
export function throwDistance(v, elevDeg, cfg = HAMMER) {
  const a = elevDeg * DEG, vx = v * Math.cos(a), vy = v * Math.sin(a);
  const t = (vy + Math.sqrt(vy * vy + 2 * cfg.g * cfg.h)) / cfg.g;
  return vx * t * 0.93; // air drag on a 7kg ball, roughly
}

export class Hammer {
  constructor(cfg = HAMMER) {
    this.cfg = cfg;
    this.a = Math.PI;     // ball angle: 0 = low point in front, PI/2 = to the thrower's left
    this.w = 4.4;         // during the wind-ups
    this.turn = -cfg.winds; // negative = wind-ups, then 0.. turns
    this.pressed = false; // pressed during this turn already
    this.balance = 0;     // wobble 0..1, a foul at 1
    this.state = 'wind';  // wind | spin | flight | foul
    this.t = 0;
    this.stats = { perfect: 0, ok: 0, miss: 0 };
    this.result = null;
  }

  get speed() { return this.w * this.cfg.r; }
  /** Angle of the ball from the low point, -PI..PI. */
  get fromLow() { return wrap(this.a); }

  /** SPACE: drive the ball through the low point. */
  press() {
    if (this.state !== 'spin' && this.state !== 'wind') return null;
    if (this.state === 'wind') return { q: 0, wind: true };
    const c = this.cfg;
    if (this.pressed) {
      this.balance = clamp(this.balance + 0.35, 0, 1);
      this.w *= 0.94;
      this.stats.miss++;
      return { q: 0, extra: true };
    }
    this.pressed = true;
    const q = turnQuality(this.fromLow, c);
    this.w = Math.min(c.wMax, this.w + c.gain * q * (1 - (this.w / c.wMax) ** 3) - (q === 0 ? 0.6 : 0));
    this.balance = clamp(this.balance + (1 - q) * 0.22, 0, 1);
    if (q >= 1) this.stats.perfect++; else if (q > 0) this.stats.ok++; else this.stats.miss++;
    return { q };
  }

  /** UP: let go. Returns the throw. */
  release() {
    if (this.state !== 'spin') return null;
    const c = this.cfg;
    const dirErr = wrap(this.a - c.aim);
    const v = this.speed * (1 - this.balance * 0.25);
    const elev = c.launch - Math.abs(dirErr) / DEG * 0.4 - this.balance * 8;
    const foul = Math.abs(dirErr) > c.sector;
    this.result = { v, dirErr, elev, foul, distance: foul ? null : Math.round(throwDistance(v, elev, c) * 100) / 100, why: foul ? (dirErr < 0 ? 'EARLY: INTO THE CAGE' : 'LATE: OUT OF THE SECTOR') : null };
    this.state = 'flight';
    return this.result;
  }

  update(dt) {
    const c = this.cfg, ev = [];
    if (this.state !== 'wind' && this.state !== 'spin') return ev;
    this.t += dt;
    const before = this.a;
    // the ball accelerates a little on its own as the thrower turns in
    if (this.state === 'spin') this.w = Math.min(c.wMax, this.w + 0.12 * dt);
    this.balance = Math.max(0, this.balance - 0.08 * dt);
    this.a += this.w * dt;
    // crossing the top of the circle (angle PI) starts a new turn
    if (Math.floor((before - Math.PI) / TAU) !== Math.floor((this.a - Math.PI) / TAU)) {
      this.turn++;
      this.pressed = false;
      if (this.turn === 0) { this.state = 'spin'; this.w = c.w0; ev.push({ type: 'spin' }); }
      else if (this.turn > 0) ev.push({ type: 'turn', n: this.turn });
      if (this.turn >= c.maxTurns) {
        this.state = 'foul';
        this.result = { foul: true, distance: null, why: 'TOO MANY TURNS' };
        ev.push({ type: 'foul', why: this.result.why });
      }
    }
    if (this.balance >= 1 && this.state === 'spin') {
      this.state = 'foul';
      this.result = { foul: true, distance: null, why: 'LOST BALANCE' };
      ev.push({ type: 'foul', why: this.result.why });
    }
    return ev;
  }
}

/**
 * A bot thrower: presses `err` radians from the low point every turn and lets
 * go at `rel` radians from the aim on the given turn.
 */
export function runHammer({ err = 0, rel = 0, turns = 4 } = {}, cfg = HAMMER) {
  const h = new Hammer(cfg);
  const dt = 1 / 240;
  while (h.state === 'wind' || h.state === 'spin') {
    const prev = h.fromLow;
    h.update(dt);
    if (h.state === 'spin' && !h.pressed && prev < err && h.fromLow >= err && h.turn < turns) h.press();
    if (h.state === 'spin' && h.turn >= turns - 1 && h.pressed) {
      const d = wrap(h.a - cfg.aim);
      if (d >= rel && d - h.w * dt < rel) h.release();
    }
    if (h.t > 30) break;
  }
  return h;
}

/** CPU best of 3 throws (m) for skill 0..1, or null for three fouls. */
export function cpuHammer(skill, rng) {
  const s = clamp(skill, 0, 1);
  let best = null;
  for (let i = 0; i < 3; i++) {
    if (rng() < 0.22 * (1 - s) + 0.04) continue;
    const d = 62 + s * 20 + rng.normal() * (1.5 + 3 * (1 - s));
    best = Math.max(best ?? 0, Math.round(d * 100) / 100);
  }
  return best;
}
