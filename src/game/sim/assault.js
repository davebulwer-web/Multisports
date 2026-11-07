// Assault course model. Pure logic.
//
// A timed run over four obstacles, each with its own timing:
//   WALL  jump (UP) from the take-off zone with enough speed to scale it;
//   NET   climb (UP) as the swaying net swings in towards you;
//   BEAM  walk (hold SPACE) while balancing (LEFT/RIGHT shifts your weight
//         that way; theta > 0 is leaning forward/right);
//   ROPE  leap (UP) as the rope swings back to you, let go (SPACE) at the far
//         end of the swing to clear the water.
// Hold SPACE to run between them. Lowest time wins.
import { clamp } from './rng.js';

export const ASSAULT = {
  accel: 5, vmax: 7.5, brake: 6,
  wall: { x: 18, zone: [1.2, 2.2], best: 1.7, speed: 4, back: 4, stun: 0.8 },
  net: { x: 34, rungs: 5, period: 1.0, window: 0.4, climb: 0.3, slip: 0.5, over: 1.0 },
  beam: { x0: 48, x1: 56, walk: 1.3, fall: 0.45, gain: 6, control: 9, damp: 2, wobble: 3, still: 0.8, back: 1.5 },
  rope: {
    edge: 66, bank: 73.3, px: 69.5, py: 6.0, len: 4.6, amp: 30, reach: 68.0, swing: 40,
    swim: 3.0, wade: 2.5,
  },
  finish: 88,
  g: 9.81,
};

const DEG = Math.PI / 180;

export class Assault {
  constructor(rng = Math.random, cfg = ASSAULT) {
    this.cfg = cfg;
    this.rng = rng;
    this.x = 0; this.y = 0; this.v = 0;
    this.t = 0;
    this.state = 'run';
    this.stateT = 0;
    this.done = { wall: false, net: false, beam: false, rope: false };
    this.rung = 0;
    this.theta = 0; this.thetaV = 0; this.noise = 0; this.noiseT = 0;
    // the rope swings freely until you catch it
    this.ropeA = -cfg.rope.amp * DEG; this.ropeW = 0;
    this.fly = null;
    this.finished = false;
    this.stats = { wallFails: 0, slips: 0, beamFalls: 0, splashes: 0 };
  }

  set(state) { this.state = state; this.stateT = 0; }
  get ropeEnd() { const r = this.cfg.rope; return { x: r.px + Math.sin(this.ropeA) * r.len, y: r.py - Math.cos(this.ropeA) * r.len }; }
  /** Net sway: cos > 1 - window means it's swinging in towards you. */
  get netSway() { return Math.cos((this.t * 2 * Math.PI) / this.cfg.net.period); }

  /**
   * @param {{run?:boolean, up?:boolean, act?:boolean, steer?:number}} u
   *   run: SPACE held; up: UP pressed this frame; act: SPACE pressed this frame
   */
  update(dt, u = {}) {
    if (this.finished) return [];
    const c = this.cfg, ev = [];
    this.t += dt;
    this.stateT += dt;
    // the rope never stops swinging
    if (this.state !== 'rope') {
      const r = c.rope;
      this.ropeA = -Math.cos((this.t * Math.sqrt(c.g / r.len))) * r.amp * DEG;
    }
    switch (this.state) {
      case 'run': this.run(dt, u, ev); break;
      case 'stun': if (this.stateT > c.wall.stun) this.set('run'); break;
      case 'wall':
        if (this.stateT > this.climbT) { this.x = c.wall.x + 0.6; this.v = 2; this.done.wall = true; this.set('run'); ev.push({ type: 'over' }); }
        break;
      case 'net': this.net(u, ev); break;
      case 'netover':
        if (this.stateT > c.net.over) { this.x = c.net.x + 3; this.v = 2; this.done.net = true; this.set('run'); }
        break;
      case 'beam': this.beam(dt, u, ev); break;
      case 'beamfall':
        if (this.stateT > c.beam.back) { this.x = c.beam.x0; this.theta = 0; this.thetaV = 0; this.set('beam'); }
        break;
      case 'edge':
        if (u.up) this.leap(ev);
        break;
      case 'swim':
        if (this.stateT > c.rope.swim) { this.x = c.rope.edge - 0.4; this.y = 0; this.set('edge'); }
        break;
      case 'rope': this.rope(dt, u, ev); break;
      case 'fly': this.flight(dt, ev); break;
      case 'wade':
        if (this.stateT > c.rope.wade) { this.x = c.rope.bank + 0.3; this.y = 0; this.v = 1; this.done.rope = true; this.set('run'); }
        break;
    }
    if (this.x >= c.finish && !this.finished) { this.finished = true; ev.push({ type: 'finish' }); }
    return ev;
  }

  run(dt, u, ev) {
    const c = this.cfg;
    const a = u.run ? c.accel * (1 - this.v / c.vmax) : -c.brake;
    this.v = clamp(this.v + a * dt, 0, c.vmax);
    this.x += this.v * dt;
    // wall
    if (!this.done.wall) {
      const gap = c.wall.x - this.x;
      if (u.up && gap < 4) {
        const [lo, hi] = c.wall.zone;
        if (gap > hi || gap < lo || this.v < c.wall.speed) {
          this.wallFail(gap > hi ? 'SHORT' : gap < lo ? 'TOO CLOSE' : 'TOO SLOW', ev);
        } else {
          this.climbT = 0.9 + 0.8 * Math.abs(gap - c.wall.best) / 0.5;
          this.set('wall');
          ev.push({ type: 'jump', q: 1 - Math.abs(gap - c.wall.best) / 0.5 });
        }
        return;
      }
      if (gap < 0.3) { this.wallFail('CRASH', ev); return; }
    }
    if (!this.done.net && this.x >= c.net.x - 0.5) { this.x = c.net.x - 0.5; this.v = 0; this.rung = 0; this.set('net'); ev.push({ type: 'net' }); }
    if (!this.done.beam && this.x >= c.beam.x0 - 0.4) { this.x = c.beam.x0; this.v = 0; this.theta = 0; this.thetaV = 0; this.set('beam'); ev.push({ type: 'beam' }); }
    if (!this.done.rope && this.x >= c.rope.edge - 0.4) { this.x = c.rope.edge - 0.4; this.v = 0; this.set('edge'); ev.push({ type: 'edge' }); }
  }

  wallFail(why, ev) {
    const c = this.cfg.wall;
    this.x = c.x - c.back;
    this.v = 0;
    this.stats.wallFails++;
    this.set('stun');
    ev.push({ type: 'wallfail', why });
  }

  net(u, ev) {
    const c = this.cfg.net;
    if (!u.up || this.stateT < c.climb) return;
    if (this.netSway > 1 - c.window) {
      this.rung++;
      this.stateT = 0;
      ev.push({ type: 'climb', rung: this.rung });
      if (this.rung >= c.rungs) { this.set('netover'); ev.push({ type: 'top' }); }
    } else {
      this.rung = Math.max(0, this.rung - 1);
      this.stateT = c.climb - c.slip; // a slip holds you up for a moment
      this.stats.slips++;
      ev.push({ type: 'slip', rung: this.rung });
    }
  }

  beam(dt, u, ev) {
    const c = this.cfg.beam;
    const walking = !!u.run;
    this.noiseT -= dt;
    if (this.noiseT <= 0) {
      this.noiseT = 0.25 + this.rng() * 0.3;
      this.noise = (this.rng() * 2 - 1) * (walking ? c.wobble : c.still);
    }
    const acc = c.gain * this.theta + this.noise + c.control * clamp(u.steer || 0, -1, 1) - c.damp * this.thetaV;
    this.thetaV += acc * dt;
    this.theta += this.thetaV * dt;
    if (walking) this.x += c.walk * dt;
    if (Math.abs(this.theta) > c.fall) {
      this.stats.beamFalls++;
      this.set('beamfall');
      ev.push({ type: 'beamfall' });
      return;
    }
    if (this.x >= c.x1) { this.x = c.x1 + 0.4; this.v = 1.5; this.done.beam = true; this.set('run'); ev.push({ type: 'beamdone' }); }
  }

  leap(ev) {
    const r = this.cfg.rope;
    const end = this.ropeEnd;
    if (end.x <= r.reach) {
      // catch it: your leap carries the rope forward to swing out to `swing` degrees
      const k = (2 * this.cfg.g) / r.len;
      this.ropeW = Math.sqrt(Math.max(0.05, k * (Math.cos(this.ropeA) - Math.cos(r.swing * DEG))));
      this.set('rope');
      ev.push({ type: 'grab' });
    } else {
      this.fly = { x: this.x + 0.3, y: 0.3, vx: 2.2, vy: 2.5 };
      this.missed = true;
      this.set('fly');
      ev.push({ type: 'miss' });
    }
  }

  rope(dt, u, ev) {
    const r = this.cfg.rope, g = this.cfg.g;
    this.ropeW += (-(g / r.len) * Math.sin(this.ropeA)) * dt;
    this.ropeA += this.ropeW * dt;
    const end = this.ropeEnd;
    this.x = end.x; this.y = end.y;
    if (u.act) {
      const v = this.ropeW * r.len;
      this.fly = { x: end.x, y: end.y - 0.4, vx: v * Math.cos(this.ropeA), vy: v * Math.sin(this.ropeA) };
      this.set('fly');
      ev.push({ type: 'release' });
    }
  }

  flight(dt, ev) {
    const f = this.fly, r = this.cfg.rope;
    f.vy -= this.cfg.g * dt;
    f.x += f.vx * dt; f.y += f.vy * dt;
    this.x = f.x; this.y = f.y;
    if (f.y <= 0) {
      this.y = 0;
      if (f.x >= r.bank) { this.x = Math.max(f.x, r.bank + 0.2); this.v = 2; this.done.rope = true; this.set('run'); ev.push({ type: 'land' }); }
      else {
        this.stats.splashes++;
        ev.push({ type: 'splash' });
        // missed the rope: swim back and try again; let go too soon: wade on
        this.set(this.missed ? 'swim' : 'wade');
        this.missed = false;
      }
      this.fly = null;
    }
  }
}

/**
 * A scripted athlete for tests and tuning. `err` scales its timing errors
 * (0 = perfect). Returns the finished course.
 */
export function runAssault(err = 0, rng = Math.random, cfg = ASSAULT) {
  const a = new Assault(rng, cfg);
  const dt = 1 / 120;
  let releaseAt = null, wallAt = cfg.wall.best + (rng() - 0.5) * 2 * err;
  while (!a.finished && a.t < 200) {
    const u = { run: true };
    if (a.state === 'run' && !a.done.wall && cfg.wall.x - a.x <= wallAt) { u.up = true; wallAt = cfg.wall.best + (rng() - 0.5) * 2 * err; }
    if (a.state === 'net' && a.stateT >= cfg.net.climb && a.netSway > 1 - cfg.net.window * (1 - err) + err * (rng() - 0.5)) u.up = true;
    if (a.state === 'beam') u.steer = -clamp((a.theta * 1.6 + a.thetaV * 0.5) * (1 - err * 0.5), -1, 1);
    if (a.state === 'edge' && a.ropeEnd.x <= cfg.rope.reach - 0.3 + err * rng()) u.up = true;
    if (a.state === 'rope') {
      if (releaseAt == null) releaseAt = 18 + (rng() - 0.5) * 30 * err;
      if (a.ropeA / DEG >= releaseAt && a.ropeW > 0) u.act = true;
      if (a.ropeW < 0 && a.ropeA > 0) u.act = true; // missed the moment
    } else releaseAt = null;
    a.update(dt, u);
  }
  return a;
}

export const fmtAssault = (s) => (s == null ? '--' : `${s.toFixed(2)}S`);

/** CPU time (s) for skill 0..1. */
export function cpuAssault(skill, rng) {
  const s = clamp(skill, 0, 1);
  let t = 31 + (1 - s) * 9 + rng.normal() * (0.4 + 1.2 * (1 - s));
  if (rng() < 0.3 * (1 - s)) t += 3; // a fall somewhere
  return Math.round(t * 100) / 100;
}
