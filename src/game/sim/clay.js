// Clay pigeon model: clays on ballistic paths, a gun sight with swing
// momentum, and shot that takes time to arrive, so you must lead the clay.
// Pure logic, in screen pixels with +y DOWN.
import { clamp } from './rng.js';

export const CLAY = {
  rounds: ['single', 'single', 'single', 'single', 'single', 'single', 'double', 'double', 'double'],
  gun: { x: 52, y: 176 },  // where the shot comes from
  ground: 196,             // clays below this have landed
  gravity: 60,             // px/s^2, clays float a long way
  drag: 0.12,              // fraction of speed lost per second
  speed: [165, 230],       // launch speed range, px/s
  angle: [28, 52],         // launch elevation range, degrees
  traps: { left: { x: 92, y: 188 }, right: { x: 332, y: 188 } },
  shotSpeed: 1700,         // px/s: shot reaches 250px away in ~0.15s
  patternBase: 4,          // shot pattern radius at the muzzle, px
  patternGrow: 0.02,       // extra radius per px of distance
  clayRadius: 2,
  sight: { accel: 1100, maxSpeed: 280, friction: 7 },
  shells: 2,               // cartridges per round (singles or doubles)
};

/** Total clays thrown in a full round of stations. */
export const totalClays = (cfg = CLAY) => cfg.rounds.reduce((n, r) => n + (r === 'double' ? 2 : 1), 0);

export class Clay {
  /** @param {'left'|'right'} side trap it comes from */
  constructor(rng, side, cfg = CLAY) {
    this.cfg = cfg;
    const trap = cfg.traps[side];
    const v = cfg.speed[0] + rng() * (cfg.speed[1] - cfg.speed[0]);
    const a = ((cfg.angle[0] + rng() * (cfg.angle[1] - cfg.angle[0])) * Math.PI) / 180;
    const dir = side === 'left' ? 1 : -1;
    this.x = trap.x;
    this.y = trap.y;
    this.vx = Math.cos(a) * v * dir;
    this.vy = -Math.sin(a) * v;
    this.side = side;
    this.t = 0;
    this.state = 'flying'; // 'flying' | 'hit' | 'lost'
  }

  update(dt) {
    if (this.state !== 'flying') return;
    this.t += dt;
    const k = 1 - this.cfg.drag * dt;
    this.vx *= k;
    this.vy = this.vy * k + this.cfg.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y > this.cfg.ground || this.x < -10 || this.x > 394) this.state = 'lost';
  }

  /** Where the clay will be after `ahead` seconds (same integration, no state change). */
  predict(ahead, step = 1 / 120) {
    const c = Object.assign(Object.create(Clay.prototype), this, { state: 'flying' });
    for (let t = 0; t < ahead; t += step) c.update(Math.min(step, ahead - t));
    return { x: c.x, y: c.y };
  }
}

/** Shot travel time and pattern radius for a point the gun is aimed at. */
export function shotTo(x, y, cfg = CLAY) {
  const d = Math.hypot(x - cfg.gun.x, y - cfg.gun.y);
  return { delay: d / cfg.shotSpeed, radius: cfg.patternBase + d * cfg.patternGrow };
}

/** Does a shot pattern centred at (sx,sy) with radius r break a clay at (cx,cy)? */
export const breaks = (sx, sy, r, cx, cy, cfg = CLAY) => Math.hypot(cx - sx, cy - sy) <= r + cfg.clayRadius;

/** The gun sight: swings with momentum so tracking has weight to it. */
export class Sight {
  constructor(x = 200, y = 120, cfg = CLAY) {
    this.cfg = cfg.sight;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
  }

  /** sx, sy in -1..1 (+y = down). */
  update(dt, sx = 0, sy = 0) {
    const c = this.cfg;
    const axis = (v, s) => {
      if (s) v += s * c.accel * dt;
      else v -= v * Math.min(1, c.friction * dt);
      return clamp(v, -c.maxSpeed, c.maxSpeed);
    };
    this.vx = axis(this.vx, sx);
    this.vy = axis(this.vy, sy);
    this.x = clamp(this.x + this.vx * dt, 4, 380);
    this.y = clamp(this.y + this.vy * dt, 14, 200);
  }
}

/** CPU hits out of a full round for skill 0..1. */
export function cpuClay(skill, rng, cfg = CLAY) {
  const p = 0.42 + 0.48 * clamp(skill, 0, 1);
  let hits = 0;
  for (let i = 0; i < totalClays(cfg); i++) if (rng() < p) hits++;
  return hits;
}
