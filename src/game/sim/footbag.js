// Footbag freestyle model. Pure logic, metres and seconds, +h up.
//
// The bag drops under a soft gravity. Each kicking surface (toe, knee, head)
// has a contact height: press its key while the bag passes through that
// height, close to your body. A clean contact pops it straight back up; a
// late, early or stretched one sends it drifting sideways and you have to
// step after it. Whiffs leave you off balance for a moment, so mashing
// doesn't work. Points come from the surface used, how clean the contact
// was, mixing surfaces up, the length of the unbroken string, and spins
// (turn a full circle while the bag is up, then keep it going).
import { clamp } from './rng.js';

export const FOOTBAG = {
  time: 60,            // seconds in the routine
  g: 7,                // a footbag is slow in the air
  move: 1.7,           // m/s side step
  recover: 0.3,        // s off balance after a whiff
  kickPose: 0.22,      // s a kick animation lasts
  spin: 0.75,          // s for a full spin
  spinGrace: 0.9,      // s after a spin to make the next kick count
  spinBonus: 60,
  serve: 1.2,          // s to pick the bag up after a drop
  surfaces: {
    toe:  { h: 0.22, win: 0.17, reach: 0.32, vy: 5.4, pts: 10, label: 'TOE' },
    knee: { h: 0.62, win: 0.15, reach: 0.26, vy: 4.4, pts: 15, label: 'KNEE' },
    head: { h: 1.74, win: 0.13, reach: 0.20, vy: 3.0, pts: 25, label: 'HEAD' },
  },
};

/** Multiplier for the unbroken string: +10% a kick, up to x3. */
export const stringMult = (n) => Math.min(3, 1 + n * 0.1);

/** Variety multiplier from the last three surfaces used: x1, x1.5 or x2. */
export function varietyMult(recent) {
  return 1 + 0.5 * (new Set(recent.slice(-3)).size - 1);
}

export const gradeOf = (q) => (q >= 0.7 ? 'PERFECT' : q >= 0.35 ? 'GOOD' : 'SCUFFED');

export class Footbag {
  constructor(rng, cfg = FOOTBAG) {
    this.cfg = cfg;
    this.rng = rng;
    this.t = 0;
    this.px = 0;               // player x
    this.bag = { x: 0.05, h: 0.62, vx: 0, vy: 2.5 };
    this.score = 0;
    this.string = 0;
    this.best = 0;
    this.kicks = 0;
    this.drops = 0;
    this.recent = [];
    this.busy = 0;             // kick / whiff / spin animation time left
    this.pose = 'ready';
    this.spinT = 0;            // > 0 while spinning
    this.spinDone = -1;        // time the last spin finished
    this.down = 0;             // > 0 while the bag is on the floor
    this.over = false;
  }

  get timeLeft() { return Math.max(0, this.cfg.time - this.t); }
  get spinning() { return this.spinT > 0; }

  /**
   * @param {{move?:number, kick?:'toe'|'knee'|'head'|null, spin?:boolean}} u
   * @returns {object[]} events for the scene: kick, whiff, drop, spin, serve
   */
  update(dt, { move = 0, kick = null, spin = false } = {}) {
    const ev = [];
    if (this.over) return ev;
    const c = this.cfg;
    this.t += dt;
    if (this.t >= c.time) {
      this.over = true;
      ev.push({ type: 'end' });
      return ev;
    }
    this.busy = Math.max(0, this.busy - dt);
    if (this.busy === 0 && !this.spinning) this.pose = 'ready';

    if (this.spinT > 0) {
      this.spinT -= dt;
      if (this.spinT <= 0) { this.spinT = 0; this.spinDone = this.t; this.pose = 'ready'; }
    }

    // stepping (not mid-kick or mid-spin)
    if (!this.busy && !this.spinning) this.px += clamp(move, -1, 1) * c.move * dt;

    const b = this.bag;
    if (this.down > 0) {
      this.down -= dt;
      if (this.down <= 0) {
        // flick it back up from the floor
        Object.assign(b, { x: this.px + 0.05, h: c.surfaces.knee.h, vx: 0, vy: 2.6 });
        ev.push({ type: 'serve' });
      }
      return ev;
    }

    b.vy -= c.g * dt;
    b.x += b.vx * dt;
    b.h += b.vy * dt;

    if (spin && !this.busy && !this.spinning) {
      this.spinT = c.spin;
      this.pose = 'spin';
      ev.push({ type: 'spin' });
    }

    if (kick && !this.busy && !this.spinning) {
      const s = c.surfaces[kick];
      const dh = b.h - s.h, dx = b.x - this.px;
      if (Math.abs(dh) <= s.win && Math.abs(dx) <= s.reach) {
        const q = clamp(1 - Math.max(Math.abs(dh) / s.win, Math.abs(dx) / s.reach * 0.8), 0, 1);
        // off-centre contact pushes it outward, scuffs add a random slice
        const side = dx !== 0 ? Math.sign(dx) : this.rng() < 0.5 ? -1 : 1;
        b.vx = (dx / s.reach) * 0.7 + side * (1 - q) * (0.5 + this.rng() * 0.6);
        b.vy = s.vy * (0.9 + 0.1 * q);
        this.recent.push(kick);
        this.string++;
        this.kicks++;
        this.best = Math.max(this.best, this.string);
        const grade = gradeOf(q);
        let pts = s.pts * (0.5 + 0.5 * q) * varietyMult(this.recent) * stringMult(this.string - 1);
        let spun = false;
        if (this.spinDone >= 0 && this.t - this.spinDone <= c.spinGrace && q >= 0.35) {
          pts += c.spinBonus * stringMult(this.string - 1);
          spun = true;
        }
        this.spinDone = -1;
        pts = Math.round(pts);
        this.score += pts;
        this.busy = c.kickPose;
        this.pose = kick;
        ev.push({ type: 'kick', surface: kick, q, grade, pts, spun, switched: this.recent.length > 1 && this.recent.at(-2) !== kick });
      } else {
        this.busy = c.recover;
        this.pose = kick;
        ev.push({ type: 'whiff', surface: kick });
      }
    }

    if (b.h <= 0) {
      b.h = 0; b.vx = 0; b.vy = 0;
      this.down = c.serve;
      this.drops++;
      ev.push({ type: 'drop', string: this.string });
      this.string = 0;
      this.recent = [];
      this.spinDone = -1;
    }
    return ev;
  }
}

/**
 * A simple bot: steps under the bag and kicks when it falls through a
 * contact height, with timing noise that grows as skill falls. Used for
 * CPU results and to tune the event.
 */
export function footbagBot(skill, rng, cfg = FOOTBAG) {
  const s = clamp(skill, 0, 1);
  const noise = 0.02 + 0.09 * (1 - s);
  const order = s > 0.5 ? ['toe', 'knee', 'head', 'knee'] : ['toe', 'knee'];
  let i = 0, plan = null, spinNext = false;
  return (fb) => {
    const b = fb.bag;
    const u = { move: 0, kick: null, spin: false };
    const dx = b.x - fb.px;
    if (Math.abs(dx) > 0.04) u.move = clamp(dx * 6, -1, 1);
    if (fb.down > 0 || fb.busy || fb.spinning) { plan = null; return u; }
    if (b.vy > 0) {
      // high and rising after a toe kick: good players sometimes spin under it
      if (spinNext && b.h > 1.0 && Math.abs(dx) < 0.06 && Math.abs(b.vx) < 0.3) { u.spin = true; spinNext = false; }
      return u;
    }
    if (!plan) {
      let want = order[i % order.length];
      // head needs the bag to come down from above head height
      if (want === 'head' && b.h < cfg.surfaces.head.h + 0.1) want = 'knee';
      plan = { surface: want, at: cfg.surfaces[want].h + rng.normal() * noise };
    }
    if (b.h <= plan.at) {
      u.kick = plan.surface;
      spinNext = plan.surface === 'toe' && s > 0.5 && rng() < s - 0.3;
      i++;
      plan = null;
    }
    return u;
  };
}

/** Play a whole routine with the bot. */
export function playFootbag(skill, rng, cfg = FOOTBAG, dt = 1 / 60) {
  const fb = new Footbag(rng, cfg);
  const bot = footbagBot(skill, rng, cfg);
  while (!fb.over) fb.update(dt, bot(fb));
  return fb;
}

export const cpuFootbag = (skill, rng) => playFootbag(skill, rng).score;
