// Ski jump model: an inrun, a take-off you time to the lip, a flight you
// balance, and a telemark landing you set just before touching down.
// Pure logic in metres with +y UP; x = 0 is the lip of the take-off table.
import { clamp } from './rng.js';

const DEG = Math.PI / 180;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const SKI = {
  K: 120,                  // K-point: 60 distance points for landing here
  HS: 138,                 // hill size: land much past this and you go down
  perMetre: 1.8,           // distance points per metre either side of K
  rounds: 2,
  gravity: 9.81,
  inrun: { straight: 44, slope: 35, radius: 95, table: 6.5, tableAngle: 11, mu: 0.04, dragTuck: 0.0015, dragUp: 0.0024 },
  takeoff: { jump: 2.6, perfect: 0.03, window: 0.22, late: 0.25 }, // m/s push, seconds
  air: { lift: 0.0054, drag: 0.0042, wind: 0.025 },
  // Body lean error in degrees (+ = too far forward). The flight position is
  // unstable: leave it alone and it drifts further off.
  lean: { unstable: 2.2, damping: 2.0, control: 140, gust: 34, width: 15, crash: 32, stall: -35 },
  telemark: { early: 1.0, good: [0.08, 0.45], lift: 0.7 },
  wind: 1.5,               // max head/tail wind, m/s (+ = headwind, helps)
};

// ---- Hill geometry --------------------------------------------------------

/** Slope angle of the landing hill (radians, downhill positive) at x. */
const landAngle = (x) => 36 * DEG * smooth(0, 32, x) * (1 - smooth(118, 185, x));

const STEP = 0.25;
const PROFILE = []; // {x, y, s}: ground height and distance along the hill
{
  let y = -3, s = 0;
  for (let x = 0; x <= 360; x += STEP) {
    PROFILE.push({ x, y, s });
    const a = landAngle(x + STEP / 2);
    y -= Math.tan(a) * STEP;
    s += STEP / Math.cos(a);
  }
}
const KNOLL_BACK = Math.tan(30 * DEG); // ground under the inrun climbs at 30°

function sample(x) {
  if (x <= 0) return { y: -3 - x * KNOLL_BACK, s: 0 };
  const i = Math.min(PROFILE.length - 2, Math.floor(x / STEP));
  const a = PROFILE[i], b = PROFILE[i + 1], f = clamp((x - a.x) / STEP, 0, 1);
  return { y: a.y + (b.y - a.y) * f, s: a.s + (b.s - a.s) * f };
}

/** Ground height (m) at x. Behind the lip it's the hillside under the inrun. */
export const groundY = (x) => sample(x).y;
/** Distance measured along the hill from the lip, as judged. */
export const distanceAt = (x) => sample(x).s;
/** Downhill slope angle in radians at x. */
export const slopeAt = (x) => (x <= 0 ? -30 * DEG : landAngle(x));
/** x where the measured distance reaches d (for drawing marker lines). */
export function xAtDistance(d) {
  for (const p of PROFILE) if (p.s >= d) return p.x;
  return PROFILE[PROFILE.length - 1].x;
}

/** The inrun as a polyline from the gate (s = 0) to the lip (s = length). */
export const INRUN = (() => {
  const c = SKI.inrun;
  const arc = c.radius * (c.slope - c.tableAngle) * DEG;
  const length = c.straight + arc + c.table;
  const angleAt = (s) => (s < c.straight ? c.slope : s < c.straight + arc ? c.slope - (c.slope - c.tableAngle) * (s - c.straight) / arc : c.tableAngle) * DEG;
  // walk back up from the lip
  const pts = [];
  let x = 0, y = 0;
  for (let s = length; s >= 0; s -= STEP) {
    pts.push({ s, x, y, a: angleAt(s) });
    const a = angleAt(s - STEP / 2);
    x -= Math.cos(a) * STEP;
    y += Math.sin(a) * STEP;
  }
  pts.reverse();
  const at = (s) => {
    const i = clamp(Math.floor((s / length) * (pts.length - 1)), 0, pts.length - 2);
    const p = pts[i], q = pts[i + 1], f = clamp((s - p.s) / (q.s - p.s || 1), 0, 1);
    return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, a: p.a + (q.a - p.a) * f };
  };
  return { length, pts, at, angleAt };
})();

// ---- Scoring --------------------------------------------------------------

/** Take-off quality 0..1 from how far the press was from the lip (s, - = early). */
export function takeoffQuality(offset, cfg = SKI) {
  const o = Math.abs(offset), t = cfg.takeoff;
  return o <= t.perfect ? 1 : clamp(1 - (o - t.perfect) / t.window, 0, 1);
}

/** Flight quality 0..1 from lean error in degrees. */
export const leanQuality = (a, cfg = SKI) => Math.exp(-((a / cfg.lean.width) ** 2));

/** Distance rounded down to the half metre, as measured. */
export const measure = (d) => Math.floor(d * 2) / 2;

export const distancePoints = (d, cfg = SKI) => Math.max(0, Math.round((60 + (d - cfg.K) * cfg.perMetre) * 10) / 10);

/**
 * Five judges' style marks (out of 20, in half points). The highest and lowest
 * are dropped and the middle three count.
 * @param {{steadiness:number, landing:'telemark'|'early'|'late'|'feet'|'fall'}} j
 *   steadiness = mean absolute lean error through the flight, degrees
 */
export function styleMarks({ steadiness, landing }, rng) {
  const flight = clamp((steadiness - 3) / 4, 0, 4);
  const land = { telemark: 0, early: 1, late: 1.5, feet: 2.5, fall: 9 }[landing] ?? 2.5;
  const base = 20 - flight - land;
  const marks = Array.from({ length: 5 }, () => clamp(Math.round((base + (rng() - 0.5) * 1.4) * 2) / 2, 0, 20));
  const sorted = [...marks].sort((a, b) => a - b);
  const total = sorted.slice(1, 4).reduce((a, b) => a + b, 0);
  return { marks, total, dropped: [marks.indexOf(sorted[0]), marks.lastIndexOf(sorted[4])] };
}

// ---- The jumper -----------------------------------------------------------

export class SkiJumper {
  /** @param {number} wind m/s, + = headwind */
  constructor(rng, wind = 0, cfg = SKI) {
    this.cfg = cfg;
    this.rng = rng;
    this.wind = wind;
    this.phase = 'gate'; // gate | inrun | air | landed
    this.s = 0;          // along the inrun
    this.v = 0;          // inrun speed
    this.t = 0;          // sim clock, seconds
    this.x = INRUN.at(0).x;
    this.y = INRUN.at(0).y;
    this.vx = 0; this.vy = 0;
    this.lean = 0; this.leanV = 0;
    this.leanSum = 0; this.leanN = 0;
    this.press = null;   // sim time of the take-off press
    this.lipT = null;    // sim time we left the lip
    this.takeoff = null; // {offset, quality}
    this.telemarkT = null;
    this.crashed = false;
    this.landing = null;
    this.gustPhase = [rng() * 6.3, rng() * 6.3, rng() * 6.3];
  }

  start() { if (this.phase === 'gate') this.phase = 'inrun'; }

  /** Take-off press at sim time t (may be slightly in the past). */
  jump(t = this.t) {
    if (this.takeoff || this.press != null) return;
    if (this.phase === 'inrun' && this.s > INRUN.length * 0.6) this.press = t;
    else if (this.phase === 'air' && t - this.lipT <= this.cfg.takeoff.late) this.applyJump(t - this.lipT);
  }

  /** Set the telemark for landing. */
  telemark(t = this.t) {
    if (this.phase === 'air' && this.telemarkT == null && this.t - this.lipT > 0.4) this.telemarkT = t;
  }

  applyJump(offset) {
    const q = takeoffQuality(offset, this.cfg);
    this.takeoff = { offset, quality: q };
    // push off perpendicular to the direction of travel
    const sp = Math.hypot(this.vx, this.vy) || 1;
    const j = this.cfg.takeoff.jump * q;
    this.vx += (-this.vy / sp) * j;
    this.vy += (this.vx / sp) * j;
    // a mistimed jump leaves you rotating: early sits you back, late tips you over
    const kick = (1 - q) * 14 * Math.sign(offset || 1);
    this.lean = kick + (this.rng() - 0.5) * 4;
    this.leanV = kick * 0.5;
  }

  get height() { return this.y - groundY(this.x); }
  get distance() { return distanceAt(this.x); }
  get speedKmh() { return (this.phase === 'air' ? Math.hypot(this.vx, this.vy) : this.v) * 3.6; }

  /**
   * @param {number} dt seconds
   * @param {{tuck?:boolean, lean?:number}} ctl lean: -1 back .. +1 forward
   */
  update(dt, ctl = {}) {
    const c = this.cfg;
    this.t += dt;
    if (this.phase === 'inrun') {
      const ir = c.inrun;
      const a = INRUN.angleAt(this.s);
      const k = ctl.tuck ? ir.dragTuck : ir.dragUp;
      this.v += (c.gravity * Math.sin(a) - ir.mu * c.gravity * Math.cos(a) - k * this.v * this.v) * dt;
      this.s += this.v * dt;
      if (this.s >= INRUN.length) {
        // left the lip partway through this step
        const over = (this.s - INRUN.length) / this.v;
        this.lipT = this.t - over;
        this.phase = 'air';
        const ta = c.inrun.tableAngle * DEG;
        this.vx = Math.cos(ta) * this.v;
        this.vy = -Math.sin(ta) * this.v;
        this.x = this.vx * over;
        this.y = this.vy * over;
        if (this.press != null) this.applyJump(this.press - this.lipT);
        return;
      }
      const p = INRUN.at(this.s);
      this.x = p.x; this.y = p.y;
      return;
    }
    if (this.phase !== 'air') return;

    // late window closed with no press: you just drop off the table
    if (!this.takeoff && this.t - this.lipT > c.takeoff.late) this.takeoff = { offset: null, quality: 0 };

    // balance
    const L = c.lean;
    const t = this.t, g = this.gustPhase;
    const gust = L.gust * (Math.sin(1.3 * t + g[0]) + 0.6 * Math.sin(2.9 * t + g[1]) + 0.4 * Math.sin(5.1 * t + g[2]));
    if (!this.crashed) {
      this.leanV += (L.unstable * this.lean + gust + L.control * clamp(ctl.lean || 0, -1, 1) - L.damping * this.leanV) * dt;
      this.lean = clamp(this.lean + this.leanV * dt, L.stall, 60);
      if (this.lean <= L.stall) this.leanV = Math.max(0, this.leanV);
      if (this.lean >= L.crash) this.crashed = true;
      this.leanSum += Math.abs(this.lean) * dt;
      this.leanN += dt;
    }

    // aerodynamics
    const A = c.air;
    let q = this.crashed ? 0.1 : leanQuality(this.lean, c);
    let lift = A.lift * (0.72 + 0.28 * q) * (1 + A.wind * this.wind);
    let drag = A.drag * (1 + 0.9 * (1 - q));
    if (this.telemarkT != null) { lift *= c.telemark.lift; drag *= 1.4; }
    const u = Math.hypot(this.vx, this.vy);
    this.vx += (-drag * u * this.vx - lift * u * this.vy) * dt;
    this.vy += (-c.gravity - drag * u * this.vy + lift * u * this.vx) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.quality = q;

    if (this.y <= groundY(this.x)) this.touchDown();
  }

  touchDown() {
    const c = this.cfg;
    this.y = groundY(this.x);
    this.phase = 'landed';
    const d = measure(this.distance);
    let landing;
    const lead = this.telemarkT == null ? null : this.t - this.telemarkT;
    if (lead == null || lead > c.telemark.early) landing = 'feet';
    else if (lead < c.telemark.good[0]) landing = 'late';
    else if (lead > c.telemark.good[1]) landing = 'early';
    else landing = 'telemark';
    const tilt = Math.abs(this.lean);
    if (this.crashed || tilt > 22 || (landing === 'late' && tilt > 12) || d > c.HS + 6 || (d > c.HS && landing !== 'telemark')) landing = 'fall';
    this.landing = landing;
    this.result = { distance: d, landing, steadiness: this.leanN ? this.leanSum / this.leanN : 0 };
    // keep sliding down the outrun
    const a = slopeAt(this.x);
    const sp = Math.hypot(this.vx, this.vy) * (landing === 'fall' ? 0.5 : 0.9);
    this.vx = Math.cos(a) * sp;
    this.vy = -Math.sin(a) * sp;
  }

  /** After landing: slide along the ground and slow down. */
  slide(dt) {
    if (this.phase !== 'landed') return;
    const sp = Math.max(0, Math.hypot(this.vx, this.vy) - (this.landing === 'fall' ? 9 : 4) * dt);
    this.x += sp * dt;
    this.y = groundY(this.x);
    const a = slopeAt(this.x);
    this.vx = Math.cos(a) * sp;
    this.vy = -Math.sin(a) * sp;
  }
}

/** Points for one jump from its result. */
export function scoreJump(result, rng, cfg = SKI) {
  const dist = distancePoints(result.distance, cfg);
  const style = styleMarks(result, rng);
  return { ...result, distPoints: dist, style, points: Math.round((dist + style.total) * 10) / 10 };
}

/** CPU total over both rounds for skill 0..1. */
export function cpuSki(skill, rng, cfg = SKI) {
  let total = 0;
  for (let r = 0; r < cfg.rounds; r++) {
    const s = clamp(skill + (rng() - 0.5) * 0.25, 0, 1);
    const fall = rng() < 0.08 * (1 - s);
    const d = measure(clamp(88 + 46 * s + (rng() - 0.5) * 10, 60, cfg.HS + 2));
    const landing = fall ? 'fall' : s > 0.6 ? 'telemark' : rng() < 0.5 ? 'early' : 'feet';
    total += scoreJump({ distance: d, landing, steadiness: 3 + (1 - s) * 8 }, rng, cfg).points;
  }
  return Math.round(total * 10) / 10;
}
