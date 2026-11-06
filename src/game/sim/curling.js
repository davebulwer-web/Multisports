// Curling model: stones that slide, slow and curl on the ice, sweeping that
// carries them further and straighter, and stone-on-stone collisions.
// Pure logic in metres. x runs down the sheet from the release point,
// y across it (0 = centre line). Speeds are game-paced, not real time.
import { clamp } from './rng.js';

export const CURL = {
  tee: 28,                 // distance from release to the tee (house centre)
  hog: 21.6,               // far hog line: a stone must get past it
  back: 29.83,             // back line: past it the stone is out
  width: 4.4,              // playing width of the sheet
  r: 0.145,                // stone radius
  decel: 0.62,             // m/s^2 on clean ice
  sweepDecel: 0.86,        // friction multiplier while sweeping
  curl: 0.17,              // sideways pull, grows as the stone slows
  sweepCurl: 0.5,          // curl multiplier while sweeping
  restitution: 0.92,
  weight: [4.6, 8.4],      // release speed range (m/s) across the weight gauge
  rings: [[0.15, 4], [0.61, 3], [1.22, 2], [1.83, 1]], // radius -> points
  ends: [
    { name: 'OPEN HOUSE', stones: [] },
    { name: 'CENTRE GUARD', stones: [[24.2, 0]] },
    { name: 'STONE ON THE BUTTON', stones: [[28.05, 0.05]] },
    { name: 'GUARD AND SHOT STONE', stones: [[24.6, -0.35], [27.6, -0.3]] },
  ],
  perEnd: 2,
};

export class Stone {
  constructor(x, y, team, cfg = CURL) {
    this.cfg = cfg;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.team = team;     // 'me' | 'them'
    this.spin = 0;        // +1 curls toward +y, -1 toward -y
    this.out = false;
  }
  get speed() { return Math.hypot(this.vx, this.vy); }
  get moving() { return !this.out && this.speed > 0.005; }
  /** Distance from the tee. */
  get dist() { return Math.hypot(this.x - this.cfg.tee, this.y); }
  get inHouse() { return !this.out && this.dist - this.cfg.r <= this.cfg.rings[3][0]; }
}

/** Release speed for weight 0..1. */
export const weightSpeed = (w, cfg = CURL) => cfg.weight[0] + (cfg.weight[1] - cfg.weight[0]) * clamp(w, 0, 1);

/** Deliver a stone aimed at the broom (bx = tee, by) with a turn. */
export function deliver(weight, aimY, turn, cfg = CURL) {
  const s = new Stone(0, 0, 'me', cfg);
  const v = weightSpeed(weight, cfg);
  const a = Math.atan2(aimY, cfg.tee);
  s.vx = Math.cos(a) * v;
  s.vy = Math.sin(a) * v;
  s.spin = turn;
  s.delivered = true;
  return s;
}

/**
 * Advance every stone by dt.
 * @param {Stone[]} stones
 * @param {boolean} sweeping sweeping the delivered stone
 */
export function step(stones, dt, sweeping = false, cfg = CURL) {
  for (const s of stones) {
    if (!s.moving) { s.vx = s.vy = 0; continue; }
    const v = s.speed;
    const ux = s.vx / v, uy = s.vy / v;
    const sweep = sweeping && s.delivered && s.x < cfg.tee;
    const dec = cfg.decel * (sweep ? cfg.sweepDecel : 1) * dt;
    const nv = Math.max(0, v - dec);
    // curl: sideways, stronger as the stone slows
    const lat = s.spin * cfg.curl / (v + 0.35) * (sweep ? cfg.sweepCurl : 1) * dt;
    s.vx = ux * nv - uy * lat;
    s.vy = uy * nv + ux * lat;
    if (nv === 0) { s.vx = s.vy = 0; }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }
  // collisions (equal masses)
  const live = stones.filter((s) => !s.out);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d >= cfg.r * 2 || d === 0) continue;
      const nx = dx / d, ny = dy / d;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      // push apart
      const push = (cfg.r * 2 - d) / 2;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      if (rel <= 0) continue;
      const jv = rel * (1 + cfg.restitution) / 2;
      a.vx -= jv * nx; a.vy -= jv * ny;
      b.vx += jv * nx; b.vy += jv * ny;
      a.spin *= 0.3; b.spin *= 0.3;
      a.hit = b.hit = true;
    }
  }
  for (const s of stones) {
    if (s.out) continue;
    if (Math.abs(s.y) > cfg.width / 2 - cfg.r || s.x > cfg.back + cfg.r) { s.out = true; s.vx = s.vy = 0; }
  }
}

/** Run until everything stops (for tests and the CPU). */
export function settle(stones, sweep = () => false, cfg = CURL, dt = 1 / 120) {
  for (let t = 0; t < 40 && stones.some((s) => s.moving); t += dt) step(stones, dt, sweep(stones), cfg);
  for (const s of stones) {
    // a delivered stone that stops short of the hog line is removed
    if (s.delivered && !s.out && s.x < cfg.hog && !s.hit) s.out = true;
  }
  return stones;
}

/** Ring points for a stone at distance d from the tee. */
export function ringPoints(d, cfg = CURL) {
  for (const [r, p] of cfg.rings) if (d - cfg.r <= r) return p;
  return 0;
}

/**
 * Score an end: each of your stones in the house that is closer to the tee
 * than every opposition stone scores its ring's points.
 */
export function scoreEnd(stones, cfg = CURL) {
  const theirs = stones.filter((s) => s.team === 'them' && s.inHouse).map((s) => s.dist);
  const best = theirs.length ? Math.min(...theirs) : Infinity;
  let points = 0, counting = [];
  for (const s of stones) {
    if (s.team !== 'me' || !s.inHouse || s.dist >= best) continue;
    points += ringPoints(s.dist, cfg);
    counting.push(s);
  }
  return { points, counting, shot: best };
}

/** The stones already in play at the start of end i. */
export const setupEnd = (i, cfg = CURL) => cfg.ends[i].stones.map(([x, y]) => new Stone(x, y, 'them', cfg));

/** Most an end can score. */
export const maxScore = (cfg = CURL) => cfg.ends.length * cfg.perEnd * cfg.rings[0][1];

/** CPU total for skill 0..1. */
export function cpuCurling(skill, rng, cfg = CURL) {
  const s = clamp(skill, 0, 1);
  let total = 0;
  for (let e = 0; e < cfg.ends.length; e++) {
    for (let k = 0; k < cfg.perEnd; k++) {
      const q = clamp(s + (rng() - 0.5) * 0.7 - (e >= 2 && k === 0 ? 0.15 : 0), 0, 1);
      total += q > 0.85 ? 4 : q > 0.65 ? 3 : q > 0.45 ? 2 : q > 0.25 ? 1 : 0;
    }
  }
  return total;
}
