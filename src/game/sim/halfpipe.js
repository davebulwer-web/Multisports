// Half-pipe skateboarding model. Pure logic, metres and seconds.
//
// The rider rolls along the ramp's surface (s = distance along it from the
// middle of the flat, + towards the right wall). Gravity and a little
// friction act along the surface. Speed is built by pumping: press SPACE
// just as you roll off the flat into a transition. Each wall gives you one
// pump; time it well and you gain speed, mistime it and you lose a little.
//
// Leave the coping with speed and you fly straight up. In the air, hold
// LEFT or RIGHT to spin and UP to grab. You must let go of the grab before
// you land and come down facing along the ramp (forwards after a 180, 540;
// backwards, "fakie", after a 0 or 360), or you slam.
import { clamp } from './rng.js';

export const PIPE = {
  runs: 2,
  time: 35,            // seconds per run
  flat: 2,             // half-width of the flat bottom
  radius: 3,           // transition radius
  vert: 0.4,           // vertical wall above the transition
  g: 9.81,
  friction: 0.1,       // m/s^2
  drag: 0.005,         // per metre
  pump: { gain: 1.2, window: 0.16, miss: 0.04 },
  spinRate: 560,       // deg/s
  landTol: 32,         // degrees off a multiple of 180
  grabLetGo: 0.08,     // s needed after letting go before you can land it
  slamTime: 2.2,
  restart: 3,          // m/s rolling away after a slam
  spin: [0, 20, 50, 90, 140, 200],
};

export const geom = (cfg = PIPE) => {
  const arc = (Math.PI / 2) * cfg.radius;
  return { arc, sMax: cfg.flat + arc + cfg.vert, hc: cfg.radius + cfg.vert, xc: cfg.flat + cfg.radius };
};

/** Surface point at arc position s: {x, h, ang} with ang the slope in radians (0 flat, pi/2 vertical). */
export function surface(s, cfg = PIPE) {
  const a = Math.abs(s), sg = Math.sign(s) || 1;
  const { arc } = geom(cfg);
  if (a <= cfg.flat) return { x: s, h: 0, ang: 0 };
  if (a <= cfg.flat + arc) {
    const th = (a - cfg.flat) / cfg.radius;
    return { x: sg * (cfg.flat + cfg.radius * Math.sin(th)), h: cfg.radius * (1 - Math.cos(th)), ang: th };
  }
  return { x: sg * (cfg.flat + cfg.radius), h: cfg.radius + (a - cfg.flat - arc), ang: Math.PI / 2 };
}

/** Name an air from its spin (in 180s), grab and landing. */
export function airName(halfTurns, grabbed) {
  const spin = halfTurns ? `${halfTurns * 180}` : '';
  const g = grabbed ? 'GRAB' : '';
  if (!spin && !g) return 'AIR';
  return [spin, g].filter(Boolean).join(' ');
}

export class Skater {
  constructor(rng, cfg = PIPE) {
    this.cfg = cfg;
    this.rng = rng;
    this.G = geom(cfg);
    this.t = 0;
    this.s = -this.G.sMax + 0.01;   // dropping in from the left deck
    this.u = 0.5;
    this.facing = 1;                // +1 nose to the right
    this.air = null;
    this.pumped = false;            // this wall's pump used
    this.slam = 0;
    this.score = 0;
    this.counts = {};
    this.tricks = [];
    this.over = false;
    this.crouch = 0;                // pump animation timer
  }

  get timeLeft() { return Math.max(0, this.cfg.time - this.t); }
  get pos() {
    if (this.air) return { x: Math.sign(this.air.side) * this.G.xc, h: this.air.h, ang: 0 };
    return surface(this.s, this.cfg);
  }

  /** @param {{pump?:boolean, spin?:number, grab?:boolean}} u spin -1..1 */
  update(dt, { pump = false, spin = 0, grab = false } = {}) {
    const ev = [];
    if (this.over) return ev;
    const c = this.cfg;
    this.t += dt;
    this.crouch = Math.max(0, this.crouch - dt);
    if (this.t >= c.time && !this.air) { this.over = true; ev.push({ type: 'end' }); return ev; }

    if (this.slam > 0) {
      this.slam -= dt;
      if (this.slam <= 0) { this.s = 0; this.u = c.restart * this.facing; this.pumped = false; ev.push({ type: 'up' }); }
      return ev;
    }

    if (this.air) return this.updateAir(dt, spin, grab, ev);

    // pumping: judged against the moment you roll off the flat into a wall
    if (pump) {
      this.crouch = 0.25;
      const out = Math.sign(this.u) === Math.sign(this.s) || Math.abs(this.s) < c.flat;
      const tau = (Math.abs(this.s) - c.flat) / Math.max(0.5, Math.abs(this.u)); // + after the line
      const q = 1 - Math.abs(tau) / c.pump.window;
      if (!this.pumped && out && Math.abs(this.u) > 0.3 && q > 0) {
        this.u += Math.sign(this.u) * c.pump.gain * (0.4 + 0.6 * q);
        ev.push({ type: 'pump', q, grade: q > 0.7 ? 'PERFECT' : q > 0.35 ? 'GOOD' : tau < 0 ? 'EARLY' : 'LATE' });
      } else {
        this.u *= 1 - c.pump.miss;
        ev.push({ type: 'pump', q: 0, grade: this.pumped ? 'ONE PUMP A WALL' : 'MISTIMED' });
      }
      this.pumped = true;
    }

    const { ang } = surface(this.s, c);
    const sg = Math.sign(this.s) || 0;
    let a = -c.g * Math.sin(ang) * sg - Math.sign(this.u) * c.friction - c.drag * this.u * Math.abs(this.u);
    const before = this.s;
    this.u += a * dt;
    this.s += this.u * dt;
    // back on the flat: the next wall's pump is available
    if (Math.abs(before) > c.flat && Math.abs(this.s) <= c.flat) this.pumped = false;
    if (Math.sign(before) !== Math.sign(this.s)) this.pumped = false;

    if (Math.abs(this.s) >= this.G.sMax) {
      if (Math.sign(this.u) === Math.sign(this.s)) {
        // launch straight up off the coping
        this.air = { side: Math.sign(this.s), h: this.G.hc, vy: Math.abs(this.u), rot: 0, grab: 0, grabbed: false, letGo: 1, peak: 0, f0: this.facing };
        this.s = Math.sign(this.s) * this.G.sMax;
        ev.push({ type: 'launch', speed: Math.abs(this.u) });
      } else this.s = Math.sign(this.s) * this.G.sMax;
    }
    return ev;
  }

  updateAir(dt, spin, grab, ev) {
    const c = this.cfg, a = this.air;
    a.rot += clamp(spin, -1, 1) * c.spinRate * dt;
    if (grab) { a.grab += dt; a.grabbed = true; a.letGo = 0; } else a.letGo += dt;
    a.vy -= c.g * dt;
    a.h += a.vy * dt;
    a.peak = Math.max(a.peak, a.h - this.G.hc);
    if (a.h <= this.G.hc && a.vy < 0) {
      const half = Math.round(a.rot / 180);
      const off = Math.abs(a.rot - half * 180);
      this.air = null;
      this.s = a.side * (this.G.sMax - 0.01);
      if (off > c.landTol || a.letGo < c.grabLetGo) {
        this.slam = c.slamTime;
        this.u = 0;
        this.pumped = false;
        ev.push({ type: 'slam', why: a.letGo < c.grabLetGo ? 'STILL GRABBING' : 'LANDED SIDEWAYS' });
        return ev;
      }
      const n = Math.abs(half);
      this.u = -a.side * Math.abs(a.vy) * 0.97;
      this.facing = n % 2 ? -a.f0 : a.f0;
      this.pumped = false;
      const name = airName(n, a.grabbed);
      const k = this.counts[name] || 0;
      this.counts[name] = k + 1;
      const base = 10 + a.peak * 15 + (c.spin[Math.min(n, c.spin.length - 1)]) + (a.grabbed ? 20 + 25 * Math.min(1, a.grab) : 0);
      const pts = Math.round(base * 0.75 ** k);
      this.score += pts;
      const fakie = Math.sign(this.u) !== this.facing;
      const trick = { name: fakie ? `${name} TO FAKIE` : name, pts, height: a.peak };
      this.tricks.push(trick);
      ev.push({ type: 'land', ...trick });
    }
    return ev;
  }
}

/**
 * Bot: pumps every wall with timing noise, spins 180s (bigger ones and grabs
 * as skill rises), and lets go in good time.
 */
export function skateBot(skill, rng, cfg = PIPE) {
  const s = clamp(skill, 0, 1);
  const noise = 0.03 + 0.12 * (1 - s);
  let target = null, plan = null;
  return (sk) => {
    const u = { pump: false, spin: 0, grab: false };
    if (sk.air) {
      const a = sk.air;
      if (!plan) {
        const t = (2 * a.vy) / cfg.g; // flight time
        let halves = 1;
        while ((halves + 2) * 180 / cfg.spinRate < t - 0.2 && rng() < s * 0.8) halves += 2;
        const err = rng.normal() * 25 * (1 - s);
        plan = { rot: halves * 180 + err, grab: rng() < s * 0.7 ? Math.max(0, t - 0.35) * 0.6 : 0, dir: rng() < 0.5 ? -1 : 1 };
      }
      if (Math.abs(a.rot) < plan.rot) u.spin = plan.dir;
      u.grab = a.grab < plan.grab && a.vy > -1;
      return u;
    }
    plan = null;
    if (!sk.pumped && Math.abs(sk.u) > 0.3 && Math.sign(sk.u) === (Math.sign(sk.s) || Math.sign(sk.u))) {
      if (target == null) target = rng.normal() * noise;
      const tau = (Math.abs(sk.s) - cfg.flat) / Math.max(0.5, Math.abs(sk.u));
      if (tau >= target) { u.pump = true; target = null; }
    }
    return u;
  };
}

export function playPipe(skill, rng, cfg = PIPE, dt = 1 / 60) {
  let total = 0;
  const runs = [];
  for (let r = 0; r < cfg.runs; r++) {
    const sk = new Skater(rng, cfg);
    const bot = skateBot(skill, rng, cfg);
    while (!sk.over) sk.update(dt, bot(sk));
    total += sk.score;
    runs.push(sk);
  }
  return { total, runs };
}

export const cpuPipe = (skill, rng) => playPipe(skill, rng).total;
