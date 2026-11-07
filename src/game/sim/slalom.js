// Canoe slalom model. Pure logic.
//
// A kayak on a flowing river, seen from above. Each paddle stroke pushes the
// boat on and turns it away from the paddle side, so strokes on alternate
// sides go straight and strokes on one side turn. The current carries you
// downstream, drifts you sideways, and swirls back upstream in the eddies
// behind rocks, where the red gates must be taken going upstream. Missed
// gates cost 50 seconds, touched poles 2.
//
// World coordinates: x across the river (metres from the left bank),
// s downstream (metres from the start). Heading h in radians: 0 points
// downstream, + turns towards +x.
import { clamp } from './rng.js';

export const SLALOM = {
  width: 18,
  finish: 215,
  flow: 1.8,           // m/s in the middle of the river
  drift: 0.5,          // sideways meander (m/s)
  eddy: -0.6,          // upstream flow in an eddy (m/s)
  boat: 3.2,           // length (m)
  stroke: { time: 0.38, thrust: 3.4, yaw: 3.4, back: -3.0 },
  drag: { u: 0.35, lin: 0.15, side: 4, yaw: 2.4, shear: 3 },
  gateW: 2.6,
  touch: 2,
  miss: 50,
  rocks: [
    { x: 15.6, s: 61, r: 1.3 }, { x: 2.4, s: 111, r: 1.3 }, { x: 15.4, s: 174, r: 1.3 },
    { x: 8.5, s: 72, r: 0.8 }, { x: 10.5, s: 140, r: 0.9 }, { x: 5, s: 190, r: 0.7 },
  ],
  gates: [
    { s: 20, x: 9 }, { s: 38, x: 5 }, { s: 54, x: 12.5 }, { s: 67, x: 15.5, up: true },
    { s: 84, x: 6 }, { s: 100, x: 10 }, { s: 117, x: 2.6, up: true }, { s: 132, x: 12 },
    { s: 150, x: 7 }, { s: 164, x: 12 }, { s: 180, x: 15.2, up: true }, { s: 198, x: 8 },
  ],
};

/** Water velocity {x, s} at a point. */
export function flowAt(x, s, cfg = SLALOM) {
  const half = cfg.width / 2;
  const across = clamp((x - half) / half, -1, 1);
  const prof = 1 - 0.85 * across ** 4;
  let fs = cfg.flow * prof * (1 + 0.15 * Math.sin(s / 11));
  const fx = cfg.drift * Math.sin(s / 17) * prof;
  for (const r of cfg.rocks) {
    if (r.r < 1) continue; // small rocks don't make a usable eddy
    const dx = Math.abs(x - r.x), ds = s - r.s;
    const wide = r.r * 2;
    if (dx < wide && ds > 0 && ds < 9) {
      const w = (1 - dx / wide) * (ds < 1 ? ds : ds > 7 ? (9 - ds) / 2 : 1);
      fs = fs * (1 - w) + cfg.eddy * w;
    }
  }
  return { x: fx, s: fs };
}

export class Kayak {
  constructor(cfg = SLALOM) {
    this.cfg = cfg;
    this.x = cfg.width / 2; this.s = 2;
    this.h = 0; this.w = 0;      // heading and yaw rate
    this.u = 0; this.lat = 0;    // speed through the water: forward, sideways
    this.stroke = null;          // {side:-1|1|0, t}
    this.queued = null;
    this.t = 0;
    this.next = 0;               // index of the next gate
    this.gates = cfg.gates.map(() => ({ done: false, missed: false, touched: false }));
    this.penalty = 0;
    this.finished = false;
    this.events = [];
    this.vs = 0; this.vx = 0;    // ground velocity
    this.strokes = 0;
  }

  get time() { return this.t + this.penalty; }
  get dir() { return { x: Math.sin(this.h), s: Math.cos(this.h) }; }

  /** Start a stroke: turn = -1 (turns left, paddle on the right), +1 (turns right), 0 = back paddle. */
  paddle(turn) {
    if (this.stroke && this.stroke.t < this.cfg.stroke.time - 0.1) return false;
    if (this.stroke) { this.queued = turn; return true; }
    this.stroke = { side: turn, t: 0 };
    this.strokes++;
    return true;
  }

  update(dt) {
    if (this.finished) return [];
    const c = this.cfg, st = c.stroke, dg = c.drag;
    this.events = [];
    this.t += dt;
    let thrust = 0, yaw = 0;
    if (this.stroke) {
      const k = Math.sin((Math.PI * this.stroke.t) / st.time) * (Math.PI / 2); // force curve, averages 1
      if (this.stroke.side === 0) thrust = st.back * k;
      else { thrust = st.thrust * k; yaw = st.yaw * this.stroke.side * k; }
      this.stroke.t += dt;
      if (this.stroke.t >= st.time) {
        this.stroke = null;
        if (this.queued != null) { const q = this.queued; this.queued = null; this.paddle(q); }
      }
    }
    // water at bow and stern: the difference spins the boat (eddy lines!)
    const d = this.dir, n = { x: Math.cos(this.h), s: -Math.sin(this.h) };
    const half = c.boat / 2;
    const fb = flowAt(this.x + d.x * half, this.s + d.s * half, c);
    const fs = flowAt(this.x - d.x * half, this.s - d.s * half, c);
    const shear = ((fb.x - fs.x) * n.x + (fb.s - fs.s) * n.s) / c.boat;
    this.w += (yaw + dg.shear * shear - dg.yaw * this.w) * dt;
    this.h += this.w * dt;
    this.u += (thrust - dg.u * this.u * Math.abs(this.u) - dg.lin * this.u) * dt;
    this.lat += -dg.side * this.lat * dt;

    const f = flowAt(this.x, this.s, c);
    const nd = this.dir, nn = { x: Math.cos(this.h), s: -Math.sin(this.h) };
    this.vx = f.x + nd.x * this.u + nn.x * this.lat;
    this.vs = f.s + nd.s * this.u + nn.s * this.lat;
    const px = this.x, ps = this.s;
    this.x += this.vx * dt;
    this.s += this.vs * dt;
    this.collide();
    this.checkGates(px, ps);
    if (this.s >= c.finish) this.finish();
    return this.events;
  }

  collide() {
    const c = this.cfg;
    const lim = 0.7;
    if (this.x < lim || this.x > c.width - lim) {
      this.x = clamp(this.x, lim, c.width - lim);
      this.u *= 0.6; this.lat = 0;
      this.events.push({ type: 'bump' });
    }
    if (this.s < 0) this.s = 0;
    for (const r of c.rocks) {
      const dx = this.x - r.x, ds = this.s - r.s, dist = Math.hypot(dx, ds), min = r.r + 0.5;
      if (dist < min) {
        this.x = r.x + (dx / dist) * min; this.s = r.s + (ds / dist) * min;
        this.u *= 0.5;
        this.events.push({ type: 'bump' });
      }
    }
  }

  hull() {
    const d = this.dir, half = this.cfg.boat / 2;
    return [{ x: this.x + d.x * half, s: this.s + d.s * half }, { x: this.x - d.x * half, s: this.s - d.s * half }];
  }

  checkGates(px, ps) {
    const c = this.cfg;
    const [a, b] = this.hull();
    // pole touches, any gate
    c.gates.forEach((g, i) => {
      if (this.gates[i].touched || Math.abs(g.s - this.s) > 3) return;
      for (const pole of [g.x - c.gateW / 2, g.x + c.gateW / 2]) {
        if (segDist(pole, g.s, a, b) < 0.25) {
          this.gates[i].touched = true;
          this.penalty += c.touch;
          this.events.push({ type: 'touch', gate: i });
          break;
        }
      }
    });
    // crossing a gate line between the poles in the right direction
    c.gates.forEach((g, i) => {
      const gs = this.gates[i];
      if (gs.done || gs.missed || i < this.next) return;
      const down = ps < g.s && this.s >= g.s, up = ps > g.s && this.s <= g.s;
      if (!down && !up) return;
      const u = (g.s - ps) / (this.s - ps);
      const xc = px + (this.x - px) * u;
      const inside = Math.abs(xc - g.x) < c.gateW / 2;
      if (inside && (g.up ? up : down)) {
        for (let k = this.next; k < i; k++) this.miss(k);
        gs.done = true;
        this.next = i + 1;
        this.events.push({ type: 'gate', gate: i, clean: !gs.touched });
      }
    });
    // too far below the next gate to come back: missed
    const g = c.gates[this.next];
    if (g) {
      const after = c.gates[this.next + 1];
      const limit = g.up ? (after ? after.s + 2 : g.s + 12) : g.s + 5;
      if (this.s > limit) { this.miss(this.next); this.next++; }
    }
  }

  miss(i) {
    if (this.gates[i].done || this.gates[i].missed) return;
    this.gates[i].missed = true;
    this.penalty += this.cfg.miss;
    this.events.push({ type: 'miss', gate: i });
  }

  finish() {
    for (let k = this.next; k < this.cfg.gates.length; k++) this.miss(k);
    this.next = this.cfg.gates.length;
    this.finished = true;
    this.events.push({ type: 'finish' });
  }
}

function segDist(px, ps, a, b) {
  const vx = b.x - a.x, vs = b.s - a.s;
  const L = vx * vx + vs * vs || 1;
  const u = clamp(((px - a.x) * vx + (ps - a.s) * vs) / L, 0, 1);
  return Math.hypot(px - (a.x + vx * u), ps - (a.s + vs * u));
}

/**
 * A simple pilot: aims at each gate (from below for upstream gates) and
 * strokes on the side that turns it towards the aim, alternating otherwise.
 * `slop` adds steering error. Used by tests and to tune the record.
 */
export function pilot(k, slop = 0, rng = Math.random) {
  const c = k.cfg;
  const g = c.gates[k.next];
  let tx, ts;
  if (!g) { tx = c.width / 2; ts = c.finish + 5; }
  else if (g.up) {
    const below = k.s > g.s + 2.5;
    if (k._under !== k.next && below && Math.abs(k.x - g.x) < 1.6) k._under = k.next;
    if (k._under === k.next) { tx = g.x; ts = g.s - 3; }
    else { tx = g.x + (g.x > c.width / 2 ? -0.6 : 0.6); ts = g.s + 4; }
  } else { tx = g.x; ts = g.s + 2; }
  // aim where we want to go relative to the water: subtract the flow we'll ride
  const f = flowAt(k.x, k.s, c);
  const dx = tx - k.x, ds = ts - k.s, dist = Math.hypot(dx, ds) || 1;
  const want = { x: dx / dist * 3 - f.x, s: ds / dist * 3 - f.s };
  const goal = Math.atan2(want.x, want.s) + (rng() - 0.5) * slop;
  let err = goal - k.h;
  while (err > Math.PI) err -= 2 * Math.PI;
  while (err < -Math.PI) err += 2 * Math.PI;
  const lead = err - k.w * 0.35;
  if (Math.abs(lead) > 0.18) return Math.sign(lead);
  k._alt = -(k._alt || 1);
  return k._alt;
}

/** Run a whole course with the pilot. Returns the kayak. */
export function runPilot(slop = 0, rng = Math.random, cfg = SLALOM) {
  const k = new Kayak(cfg);
  const dt = 1 / 60;
  while (!k.finished && k.t < 400) {
    if (!k.stroke) k.paddle(pilot(k, slop, rng));
    k.update(dt);
  }
  return k;
}

export const fmtSlalom = (s) => (s == null ? '--' : `${s.toFixed(2)}S`);

/** CPU total time (s) for skill 0..1. */
export function cpuSlalom(skill, rng, cfg = SLALOM) {
  const s = clamp(skill, 0, 1);
  let t = 96 + (1 - s) * 34 + rng.normal() * (2 + 3 * (1 - s));
  const touches = Math.max(0, Math.round(rng() * 4 * (1 - s) + rng.normal() * 0.5));
  t += touches * cfg.touch;
  if (rng() < 0.15 * (1 - s)) t += cfg.miss;
  return Math.round(t * 100) / 100;
}
