// BMX dirt track. Pure logic. Distances in metres, heights up.
//
// On the ground: hold DOWN to pump as you roll down the back of each bump
// (holding it going uphill costs speed), SPACE pedals on the flat (but only
// so fast). Press UP just before a lip to pop off it. In the air LEFT/RIGHT
// pitch the bike, hold SPACE for a superman or DOWN for a can-can, then let
// go in time and match the landing slope. Tricks only score when you ride
// away; the clock is ticking and the finish line adds a time bonus.
import { clamp } from './rng.js';

const DEG = Math.PI / 180;

export const BMX = {
  g: 9.81,
  limit: 45,          // seconds
  pedalMax: 6,        // m/s you can pedal to on the flat
  pedal: 2.2,
  pump: 16,           // pumping gain on a downslope
  pumpCost: 4,        // holding pump uphill
  drag: 0.016,        // per m/s²
  roll: 0.12,
  pitchRate: 150,     // deg/s in the air
  land: 20,           // degrees of pitch error a landing allows
  popWindow: 0.18,    // seconds before the lip
  pop: 1.6,           // m/s up from a pop
  recover: 0.18,      // seconds to bring a trick back before landing
  crash: 1.6,
  tricks: { super: 70, cancan: 50 },   // points a second held
  timeBonus: 8,       // a second left at the finish
};

/** Track pieces: rollers and table-top jumps, in order. */
function buildTrack() {
  const segs = [];
  let x = 0;
  const flat = (len) => { segs.push({ type: 'flat', x0: x, x1: x + len }); x += len; };
  const rollers = (n, wl = 6, amp = 0.55) => { segs.push({ type: 'rollers', x0: x, x1: x + n * wl, wl, amp }); x += n * wl; };
  const jump = (h, up, gap, down) => {
    segs.push({ type: 'jump', x0: x, lip: x + up, land: x + up + gap, x1: x + up + gap + down, h });
    x += up + gap + down;
  };
  segs.push({ type: 'start', x0: 0, x1: 8, h: 2 }); x = 8;
  flat(4); rollers(4); flat(4);
  jump(1.0, 3, 3.5, 4); flat(6);
  rollers(3); flat(4);
  jump(1.1, 3.5, 4, 5); flat(6);
  rollers(4, 5, 0.5); flat(4);
  jump(1.2, 3.5, 4, 5); flat(6);
  rollers(4); flat(4);
  jump(1.4, 4, 4.5, 6); flat(14);
  return { segs, finish: x - 8 };
}
export const TRACK = buildTrack();

/** Ground height at x. */
export function groundY(x, track = TRACK) {
  for (const s of track.segs) {
    if (x < s.x0 || x >= s.x1) continue;
    if (s.type === 'start') { const u = (x - s.x0) / (s.x1 - s.x0); return s.h * (1 + Math.cos(u * Math.PI)) / 2; }
    if (s.type === 'rollers') return s.amp * (1 - Math.cos(((x - s.x0) / s.wl) * 2 * Math.PI)) / 2;
    if (s.type === 'jump') {
      if (x < s.lip) { const u = (x - s.x0) / (s.lip - s.x0); return s.h * u * u; } // a kicker, steepest at the lip
      if (x < s.land) return s.h; // the table top
      const u = (x - s.land) / (s.x1 - s.land); return s.h * (1 - u);
    }
    return 0;
  }
  return 0;
}

export const slopeAt = (x, track = TRACK) => (groundY(x + 0.05, track) - groundY(x - 0.05, track)) / 0.1;

/** The jump whose lip is just ahead of x (within `ahead` metres). */
function lipAhead(x, ahead, track = TRACK) {
  return track.segs.find((s) => s.type === 'jump' && s.lip >= x && s.lip - x <= ahead);
}

export class Bmx {
  constructor(cfg = BMX, track = TRACK) {
    this.cfg = cfg;
    this.track = track;
    this.x = 0.2; this.y = groundY(0.2, track);
    this.v = 0;            // speed along the ground
    this.vx = 0; this.vy = 0;
    this.air = false;
    this.pitch = 0;        // degrees, + = nose up
    this.trick = null;     // 'super' | 'cancan' while held
    this.trickT = 0;       // since the trick was let go
    this.airPts = 0;
    this.airTricks = new Set();
    this.popT = -9;        // when UP was last pressed
    this.popped = false;
    this.down = 0;
    this.t = 0;
    this.score = 0;
    this.finished = false;
    this.timeUp = false;
    this.counts = {};
    this.stats = { clean: 0, crashes: 0, cased: 0 };
    this.passed = new Set();
  }

  pop() { this.popT = this.t; }

  /** @param {{pump?:boolean, pedal?:boolean, pitch?:number, trick?:string|null}} u */
  update(dt, { pump = false, pedal = false, pitch = 0, trick = null } = {}) {
    const c = this.cfg, ev = [];
    if (this.finished) return ev;
    this.t += dt;
    if (this.t >= c.limit) { this.finished = true; this.timeUp = true; ev.push({ type: 'time' }); return ev; }
    if (this.down > 0) {
      this.down -= dt;
      if (this.down <= 0) { this.y = groundY(this.x, this.track); this.v = 1; ev.push({ type: 'up' }); }
      return ev;
    }
    if (!this.air) {
      const sl = slopeAt(this.x, this.track), ang = Math.atan(sl);
      let a = -c.g * Math.sin(ang) - c.drag * this.v * this.v - c.roll;
      if (pump) a += sl < -0.02 ? c.pump * -sl : sl > 0.02 ? -c.pumpCost * sl : 0;
      if (pedal && Math.abs(sl) < 0.15 && this.v < c.pedalMax) a += c.pedal;
      this.v = Math.max(0.3, this.v + a * dt);
      const before = this.x;
      this.x += this.v * Math.cos(ang) * dt;
      this.y = groundY(this.x, this.track);
      this.pitch = ang / DEG;
      // off the lip of a jump
      const j = this.track.segs.find((s) => s.type === 'jump' && before < s.lip && this.x >= s.lip);
      if (j) {
        const la = Math.atan(slopeAt(j.lip - 0.1, this.track));
        this.air = true;
        this.popped = this.t - this.popT <= c.popWindow;
        this.vx = this.v * Math.cos(la);
        this.vy = this.v * Math.sin(la) + (this.popped ? c.pop : 0);
        this.pitch = la / DEG;
        this.airPts = 0; this.airTricks = new Set(); this.trick = null; this.trickT = 9;
        ev.push({ type: 'air', popped: this.popped });
      }
    } else {
      this.vy -= c.g * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.pitch = clamp(this.pitch + pitch * c.pitchRate * dt, -80, 80);
      if (trick) {
        this.trick = trick;
        this.trickT = 0;
        this.airTricks.add(trick);
        this.airPts += c.tricks[trick] * dt;
      } else { if (this.trick) this.trickT += dt; if (this.trickT >= c.recover) this.trick = null; }
      const gy = groundY(this.x, this.track);
      if (this.y <= gy && this.vy < 0) this.touchDown(gy, ev);
    }
    if (!this.passed.has('finish') && this.x >= this.track.finish) {
      this.passed.add('finish');
      this.finished = true;
      const bonus = Math.round((c.limit - this.t) * c.timeBonus);
      this.score += bonus;
      ev.push({ type: 'finish', bonus });
    }
    return ev;
  }

  touchDown(gy, ev) {
    const c = this.cfg;
    this.y = gy;
    this.air = false;
    const ang = Math.atan(slopeAt(this.x, this.track)) / DEG;
    const err = this.pitch - ang;
    const speed = Math.hypot(this.vx, this.vy);
    const flat = Math.abs(ang) < 3;
    if (Math.abs(err) > c.land || this.trick) {
      this.down = c.crash; this.v = 0; this.stats.crashes++;
      ev.push({ type: 'crash', why: this.trick ? 'STILL IN THE TRICK' : err > 0 ? 'NOSE TOO HIGH' : 'NOSE TOO LOW' });
      return;
    }
    // casing the table (landing on the flat top) loses speed and the points
    const j = this.track.segs.find((s) => s.type === 'jump' && this.x >= s.lip && this.x < s.land);
    const keep = Math.cos(Math.atan2(-this.vy, this.vx) + ang * DEG);
    this.v = Math.max(1, speed * Math.max(0.3, keep) * (j || flat ? 0.6 : 0.97));
    if (j) { this.stats.cased++; ev.push({ type: 'cased' }); return; }
    let pts = 20 + (this.popped ? 15 : 0) + Math.round(Math.abs(err) < c.land / 2 ? 10 : 0);
    for (const tr of this.airTricks) {
      const n = this.counts[tr] = (this.counts[tr] || 0) + 1;
      pts += Math.round(this.airPts / this.airTricks.size * (n === 1 ? 1 : n === 2 ? 0.6 : 0.3));
    }
    if (this.airTricks.size > 1) pts += 25; // both in one jump
    this.score += pts;
    this.stats.clean++;
    ev.push({ type: 'land', pts, tricks: [...this.airTricks], popped: this.popped });
  }
}

/** A bot for tests: pumps the downslopes, pops each lip, holds a trick for `hold` s, levels out. */
export function runBmx({ pump = true, pop = true, hold = 0.25, level = true } = {}) {
  const b = new Bmx();
  const dt = 1 / 120;
  while (!b.finished) {
    const lip = lipAhead(b.x, b.v * 0.1);
    if (pop && !b.air && lip) b.pop();
    let pitch = 0, trick = null;
    if (b.air) {
      const want = Math.atan(slopeAt(b.x + b.vx * 0.3)) / DEG;
      if (level) pitch = clamp((want - b.pitch) / 20, -1, 1);
      if (hold && b.vy > -2 && b.airPts / BMX.tricks.super < hold) trick = 'super';
    }
    b.update(dt, { pump: pump && !b.air && slopeAt(b.x) < -0.02, pedal: !b.air, pitch, trick });
  }
  return b;
}

/** CPU score for skill 0..1. */
export function cpuBmx(skill, rng) {
  const s = clamp(skill, 0, 1);
  let p = 120 + s * 300 + rng.normal() * (20 + 40 * (1 - s));
  if (rng() < 0.4 * (1 - s)) p -= 60; // a crash
  return Math.max(20, Math.round(p));
}

export { lipAhead };
