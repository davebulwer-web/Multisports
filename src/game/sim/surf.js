// Surfing model. Pure logic. The wave is seen from the beach: x runs along
// the wave (the way it peels, metres), y up the face from the trough (0) to
// the lip (FACE). The breaking curl chases you along x at a steady speed.
//
// You steer the board's heading with the arrows (it turns towards the held
// direction). Dropping down the face gains speed, climbing loses it, and the
// wave's push is strongest near the curl and fades out on the shoulder.
// Fall behind the curl and you're in the tube (risky, and worth a lot) or
// caught inside. Hit the lip fast enough and you launch: turn to face back
// down before you land.
//
// Manoeuvres are spotted from the heading: a turn from down to up near the
// bottom, from up to down near the lip, a turn back towards the curl on the
// shoulder, time in the tube and airs. Repeats are worth less each time.
import { clamp } from './rng.js';

const DEG = Math.PI / 180;

export const SURF = {
  waves: 2,
  ride: 30,            // seconds before the wave closes out
  face: 3,             // metres of face, trough to lip
  climb: 0.8,          // fraction of the board's speed that moves it up/down the face
  curl: 4.5,            // m/s the curl peels along the wave
  push: 5,             // wave push (m/s^2) in the pocket
  grav: 9,             // down-the-face pull (m/s^2)
  drag: 0.5,           // per second
  flats: 1.6,          // extra drag in the flat water at the bottom
  turn: 230,           // deg/s
  airTurn: 420,
  airG: 6,             // face-units gravity in the air
  launch: 1.5,         // m/s up the face needed at the lip to get air
  tube: [0.3, 0.8],    // fraction of the face you can ride inside the barrel
  tubePush: 3,         // extra push inside the barrel
  tubeDepth: 2.6,      // metres behind the curl before it swallows you
  pocket: 8,           // full push this close ahead of the curl
  shoulder: 26,        // push has faded to `fade` this far ahead
  fade: 0.25,
  pts: { bottom: 10, top: 20, lip: 30, cutback: 40, air: 70, tube: 35, ride: 1 },
};

export const MOVES = { bottom: 'BOTTOM TURN', top: 'TOP TURN', lip: 'OFF THE LIP', cutback: 'CUTBACK', air: 'AIR', tube: 'TUBE RIDE' };

/** How much of the wave's push you get at distance d ahead of the curl. */
export function steepness(d, cfg = SURF) {
  if (d <= cfg.pocket) return 1;
  return Math.max(cfg.fade, 1 - (1 - cfg.fade) * (d - cfg.pocket) / (cfg.shoulder - cfg.pocket));
}

/** Smallest signed difference a-b in degrees. */
export const angDiff = (a, b) => ((a - b + 540) % 360) - 180;

export class Surfer {
  constructor(rng, cfg = SURF) {
    this.cfg = cfg;
    this.rng = rng;
    this.t = 0;
    this.cx = 0;               // curl position
    this.x = 6; this.y = cfg.face * 0.85;
    this.v = 5.5;
    this.heading = -35;        // degrees: 0 = along the wave, +90 = up the face
    this.air = null;           // {vy, rot}
    this.inTube = 0;
    this.score = 0;
    this.moves = [];           // {move, pts}
    this.counts = {};
    this.wipeout = null;
    this.done = false;
    this.prevSin = Math.sin(this.heading * DEG);
    this.cut = false;          // heading back towards the curl on the shoulder
  }

  get d() { return this.x - this.cx; }
  get timeLeft() { return Math.max(0, this.cfg.ride - this.t); }

  award(move, base) {
    const n = this.counts[move] || 0;
    this.counts[move] = n + 1;
    const pts = Math.round(base * 0.7 ** n);
    this.score += pts;
    const m = { move, name: MOVES[move], pts };
    this.moves.push(m);
    return m;
  }

  fall(why) {
    this.wipeout = why;
    this.done = true;
    return { type: 'wipeout', why };
  }

  /** @param {{dx:number, dy:number}} u held direction (-1..1 each) */
  update(dt, { dx = 0, dy = 0 } = {}) {
    const ev = [];
    if (this.done) return ev;
    const c = this.cfg;
    this.t += dt;
    this.cx += c.curl * dt;
    const speedF = this.v / 7;

    if (this.air) {
      const a = this.air;
      if (dx || dy) {
        const want = Math.atan2(dy, dx) / DEG;
        const turn = clamp(angDiff(want, this.heading), -c.airTurn * dt, c.airTurn * dt);
        this.heading = angDiff(this.heading + turn, 0);
        a.rot += Math.abs(turn);
      }
      a.vy -= c.airG * dt;
      this.y += a.vy * dt;
      this.x += this.v * Math.cos(a.h0 * DEG) * dt;
      if (this.y <= c.face && a.vy < 0) {
        this.y = c.face;
        const s = Math.sin(this.heading * DEG);
        this.air = null;
        if (s > -0.3) { ev.push(this.fall('LANDED FLAT')); return ev; }
        const extra = Math.max(0, Math.floor((a.rot - 150) / 180));
        ev.push({ type: 'move', ...this.award('air', c.pts.air * (1 + extra * 0.6) * (0.6 + 0.4 * Math.min(1.5, a.peak / 0.8))) });
        this.prevSin = s;
      }
      return ev;
    }

    // steering: turn towards the held direction
    if (dx || dy) {
      const want = Math.atan2(dy, dx) / DEG;
      const turn = clamp(angDiff(want, this.heading), -c.turn * dt, c.turn * dt);
      this.heading = angDiff(this.heading + turn, 0);
      this.v -= Math.abs(turn) * 0.0008 * this.v; // carving scrubs a little speed
    }

    const sin = Math.sin(this.heading * DEG), cos = Math.cos(this.heading * DEG);
    const st = steepness(this.d, c);
    let acc = st * (c.push * (0.5 + 0.5 * cos) - c.grav * c.climb * sin) - c.drag * this.v;
    if (this.y <= 0.02) acc -= c.flats * this.v;
    if (this.d < 0) acc += c.tubePush; // the barrel's spit shoves you along
    this.v = clamp(this.v + acc * dt, 0, 14);
    this.x += this.v * cos * dt;
    const vy = this.v * sin * c.climb;
    this.y += vy * dt;

    if (this.y >= c.face) {
      if (vy > c.launch) {
        this.air = { vy, rot: 0, h0: this.heading, peak: 0 };
        this.air.peak = (vy * vy) / (2 * c.airG);
        ev.push({ type: 'launch' });
        return ev;
      }
      this.y = c.face;
      this.v *= 1 - 1.5 * dt; // stalling in the lip
    }
    if (this.y <= 0) this.y = 0;

    // manoeuvres from heading changes
    const f = this.y / c.face;
    if (this.prevSin < -0.2 && sin >= -0.2 && f < 0.35) ev.push({ type: 'move', ...this.award('bottom', c.pts.bottom * (0.6 + 0.6 * speedF)) });
    if (this.prevSin > 0.2 && sin <= 0.2 && f > 0.7) {
      const lip = f > 0.93;
      ev.push({ type: 'move', ...this.award(lip ? 'lip' : 'top', (lip ? c.pts.lip : c.pts.top) * (0.6 + 0.6 * speedF)) });
    }
    this.prevSin = sin;
    if (cos < -0.3 && this.d > 6) this.cut = true;
    if (this.cut && cos > 0.3) {
      this.cut = false;
      ev.push({ type: 'move', ...this.award('cutback', c.pts.cutback * (0.6 + 0.6 * speedF)) });
    }
    if (this.d < 2 && cos < -0.3) this.cut = false; // just turned round into the white water

    // the curl
    const inBand = f >= c.tube[0] && f <= c.tube[1];
    if (this.d < 0) {
      if (!inBand || this.d < -c.tubeDepth) {
        this.inTube = 0;
        ev.push(this.fall(this.d < -c.tubeDepth ? 'SWALLOWED BY THE TUBE' : 'CAUGHT INSIDE'));
        return ev;
      }
      if (!this.inTube) ev.push({ type: 'tube' });
      this.inTube += dt;
    } else if (this.inTube) {
      const t = this.inTube;
      this.inTube = 0;
      if (t > 0.3) ev.push({ type: 'move', ...this.award('tube', c.pts.tube * t), secs: t });
    }

    if (this.t >= c.ride) {
      this.done = true;
      const ridePts = Math.round(c.pts.ride * c.ride);
      this.score += ridePts;
      ev.push({ type: 'closeout', pts: ridePts });
    }
    return ev;
  }
}

/** A steady bot: S-turns between the bottom and the lip, cutting back when far ahead. */
export function surfBot(skill, rng, cfg = SURF) {
  const s = clamp(skill, 0, 1);
  let goingUp = false, cutting = false;
  return (sf) => {
    const f = sf.y / cfg.face;
    const top = 0.8 + 0.18 * s + rng.normal() * 0.05 * (1 - s);
    if (sf.d > 18 - 6 * (1 - s)) cutting = true;
    if (cutting) {
      if (sf.d < 7) cutting = false;
      return { dx: -1, dy: -0.4 };
    }
    if (goingUp && f > top) goingUp = false;
    if (!goingUp && f < 0.12 + 0.1 * (1 - s)) goingUp = true;
    return goingUp ? { dx: 1, dy: 0.9 } : { dx: 1, dy: -0.9 };
  };
}

export function playSurf(skill, rng, cfg = SURF, dt = 1 / 60) {
  let total = 0;
  const rides = [];
  for (let w = 0; w < cfg.waves; w++) {
    const sf = new Surfer(rng, cfg);
    const bot = surfBot(skill, rng, cfg);
    while (!sf.done) sf.update(dt, bot(sf));
    total += sf.score;
    rides.push(sf);
  }
  return { total, rides };
}

/** CPU total over two waves for skill 0..1. */
export function cpuSurf(skill, rng) {
  const s = clamp(skill, 0, 1);
  let total = 0;
  for (let w = 0; w < SURF.waves; w++) {
    if (rng() < 0.08 + 0.25 * (1 - s)) { total += Math.round(30 + rng() * 60 * s); continue; } // early wipeout
    total += Math.round(90 + 190 * s + rng.normal() * 25);
  }
  return Math.max(0, total);
}
