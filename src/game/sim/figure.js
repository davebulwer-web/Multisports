// Figure skating free skate. Pure logic: times are seconds from the start of
// the music, and every move is judged against the beat.
//
//   SPACE on a beat   stroke: builds speed and flow
//   UP on a beat      take off; spin rate (and so rotations) comes from speed
//   SPACE next beat   open out and land. Late (or never) is a fall.
//   hold DOWN         spin on the spot (burns speed); let go on a beat
//
// Elements score base value x timing, less for repeats; flow builds into the
// programme components; falls cost points.
import { clamp } from './rng.js';

export const FIG = {
  bpm: 132,
  intro: 6,            // beats of music before the routine starts
  beats: 48,           // beats in the routine
  ok: 0.11,            // seconds either side of a beat that count as on it
  near: 0.2,           // still allowed, with less credit
  decay: 0.05,         // speed lost per second gliding
  stroke: 0.16,
  minJump: 0.25,       // speed needed to take off
  revs: (v) => 2.6 + 6.2 * v,  // rotations per second in the air
  air: 1.35,           // beats in the air before you come down regardless
  jump: [0, 5, 13, 30, 55],
  spinRevs: 3.2,       // per second
  spinDrain: 0.22,     // speed per second while spinning
  repeat: [1, 0.7, 0.45, 0.3],
  maxJumps: 7,         // jumps after this score nothing
  fall: 10,
  down: 1.2,           // seconds on the ice after a fall
};

export const beatLen = (cfg = FIG) => 60 / cfg.bpm;
export const routineStart = (cfg = FIG) => cfg.intro * beatLen(cfg);
export const routineEnd = (cfg = FIG) => (cfg.intro + cfg.beats) * beatLen(cfg);

/** Signed seconds from the nearest beat. */
export function offBeat(t, cfg = FIG) {
  const b = beatLen(cfg), k = Math.round(t / b);
  return t - k * b;
}

/** Timing credit for a move at time t: 1 on the beat, 0.6 near it, 0 off it. */
export function timing(t, cfg = FIG) {
  const e = Math.abs(offBeat(t, cfg));
  if (e <= cfg.ok) return 1;
  if (e <= cfg.near) return 0.6;
  return 0;
}

const JUMP_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'];

export class FigureSkater {
  constructor(cfg = FIG) {
    this.cfg = cfg;
    this.t = 0;
    this.v = 0.35;
    this.flow = 0.3;       // 0..1
    this.flowSum = 0;
    this.flowT = 0;
    this.state = 'glide';  // glide | air | spin | down | done
    this.stateT = 0;
    this.x = 0;            // metres travelled (for the scrolling rink)
    this.rot = 0;          // revolutions in the current jump/spin
    this.elements = [];
    this.counts = { jump: {}, spin: 0 };
    this.falls = 0;
    this.strokes = 0;
  }

  get started() { return this.t >= routineStart(this.cfg); }
  get finished() { return this.state === 'done'; }
  get beat() { return (this.t - routineStart(this.cfg)) / beatLen(this.cfg); }

  bump(q) { this.flow = clamp(this.flow + (q >= 1 ? 0.08 : q > 0 ? 0.03 : -0.1), 0, 1); }

  stroke() {
    if (this.state !== 'glide' || !this.started) return null;
    const q = timing(this.t, this.cfg);
    this.v = clamp(this.v + this.cfg.stroke * (q ? q : 0.3), 0, 1);
    this.bump(q);
    this.strokes++;
    return { q };
  }

  takeoff() {
    if (this.state !== 'glide' || !this.started) return null;
    if (this.v < this.cfg.minJump) { this.bump(0); return { q: 0, slow: true }; }
    const q = timing(this.t, this.cfg);
    this.state = 'air'; this.stateT = 0; this.rot = 0;
    this.takeQ = q;
    this.bump(q);
    return { q };
  }

  land() {
    if (this.state !== 'air') return null;
    const c = this.cfg;
    const q = timing(this.t, c);
    // landing on the beat gets the full beat's worth of rotation
    if (q === 1) this.rot = Math.max(this.rot, c.revs(this.v) * beatLen(c));
    const n = Math.min(4, Math.floor(this.rot + 0.25));
    if (q === 0 && this.stateT > beatLen(c) * 0.5 && offBeat(this.t, c) > 0) return this.fall('LATE');
    this.state = 'glide'; this.stateT = 0;
    this.v *= 0.82;
    if (n < 1) { this.bump(0); return { n: 0, q: 0, points: 0, name: 'POPPED' }; }
    const under = this.rot < n; // landed a quarter short: under-rotated
    const rep = this.counts.jump[n] || 0;
    this.counts.jump[n] = rep + 1;
    const goe = 0.6 + 0.35 * ((this.takeQ + q) / 2) + 0.15 * this.flow - (under ? 0.2 : 0);
    const extra = this.elements.filter((e) => e.type === 'jump').length >= c.maxJumps;
    const points = extra ? 0 : Math.round(c.jump[n] * goe * c.repeat[Math.min(rep, c.repeat.length - 1)] * 10) / 10;
    this.bump(q);
    const el = { type: 'jump', n, q, points, name: extra ? 'EXTRA JUMP' : `${JUMP_NAMES[n]}${under ? ' <' : ''}` };
    this.elements.push(el);
    return el;
  }

  spinStart() {
    if (this.state !== 'glide' || !this.started || this.v < 0.15) return null;
    this.state = 'spin'; this.stateT = 0; this.rot = 0;
    this.spinQ = timing(this.t, this.cfg);
    return { q: this.spinQ };
  }

  spinEnd() {
    if (this.state !== 'spin') return null;
    const c = this.cfg, q = timing(this.t, c);
    this.state = 'glide'; this.stateT = 0;
    const revs = Math.min(14, Math.floor(this.rot));
    if (revs < 3) { this.bump(0); return { type: 'spin', revs, points: 0, name: 'TRAVELLED' }; }
    const rep = this.counts.spin++;
    const points = Math.round(revs * 1.6 * (0.6 + 0.2 * (this.spinQ + q) + 0.2 * this.flow) * c.repeat[Math.min(rep, c.repeat.length - 1)] * 10) / 10;
    this.bump(q);
    const el = { type: 'spin', revs, q, points, name: `SPIN x${revs}` };
    this.elements.push(el);
    return el;
  }

  fall(why) {
    this.state = 'down'; this.stateT = 0;
    this.falls++;
    this.v = 0.1;
    this.flow = Math.max(0, this.flow - 0.3);
    const el = { type: 'fall', points: -this.cfg.fall, name: why === 'LATE' ? 'FALL' : 'FALL' };
    this.elements.push(el);
    return el;
  }

  update(dt) {
    const c = this.cfg, ev = [];
    if (this.state === 'done') return ev;
    this.t += dt;
    this.stateT += dt;
    if (this.started) { this.flowSum += this.flow * dt; this.flowT += dt; }
    switch (this.state) {
      case 'glide': this.v = Math.max(0, this.v - c.decay * dt); this.flow = Math.max(0, this.flow - 0.015 * dt); break;
      case 'air':
        this.rot += c.revs(this.v) * dt;
        if (this.stateT > c.air * beatLen(c)) ev.push(this.fall('LATE'));
        break;
      case 'spin':
        this.rot += c.spinRevs * (0.5 + this.v) * dt;
        this.v = Math.max(0, this.v - c.spinDrain * dt);
        if (this.v <= 0.02) { const e = this.spinEnd(); if (e) ev.push({ ...e, auto: true }); }
        break;
      case 'down':
        if (this.stateT > c.down) { this.state = 'glide'; this.stateT = 0; }
        break;
    }
    this.x += (this.state === 'spin' ? 0.3 : 2 + this.v * 7) * dt;
    if (this.t >= routineEnd(c) && this.state !== 'air') {
      if (this.state === 'spin') { const e = this.spinEnd(); if (e) ev.push(e); }
      this.state = 'done';
      ev.push({ type: 'end' });
    }
    return ev;
  }

  get technical() { return Math.round(this.elements.reduce((a, e) => a + e.points, 0) * 10) / 10; }
  /** Programme components: average flow through the routine. */
  get components() { return Math.round((this.flowT ? this.flowSum / this.flowT : 0) * 60 * 10) / 10; }
  get total() { return Math.max(0, Math.round(this.technical + this.components)); }
}

/**
 * A bot that strokes on the beat, takes off on beat `every` beats when fast
 * enough, lands `landErr` seconds off the next beat, and spins now and then.
 */
export function runFigure({ landErr = 0, strokeErr = 0, jumpAt = 0.75, spins = true } = {}, cfg = FIG) {
  const s = new FigureSkater(cfg);
  const dt = 1 / 240, b = beatLen(cfg);
  let lastBeat = -1;
  while (!s.finished && s.t < 60) {
    s.update(dt);
    const k = Math.floor((s.t - strokeErr) / b);
    const onBeat = k !== lastBeat && s.t - strokeErr >= k * b;
    if (s.state === 'air' && s.t >= s.landAt) s.land();
    if (onBeat) {
      lastBeat = k;
      const beat = Math.round(s.beat);
      if (s.state === 'spin' && s.stateT > 2.2) s.spinEnd();
      else if (s.state === 'glide') {
        if (spins && beat % 16 === 8 && s.v > 0.5) s.spinStart();
        else if (s.v >= jumpAt) { if (s.takeoff()) s.landAt = s.t + b + landErr; }
        else s.stroke();
      }
    }
  }
  return s;
}

export const fmtFig = (n) => (n == null ? '--' : `${n} PTS`);

/** CPU free skate total for skill 0..1. */
export function cpuFigure(skill, rng) {
  const s = clamp(skill, 0, 1);
  let p = 80 + s * 130 + rng.normal() * (5 + 10 * (1 - s));
  if (rng() < 0.4 * (1 - s)) p -= 15; // a fall
  return Math.max(10, Math.round(p));
}
