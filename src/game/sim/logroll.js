// Log rolling. Pure logic.
//
// Two rollers face each other on a floating log. UP/DOWN change the log's
// pace (UP rolls it faster towards you, DOWN slows and reverses it); LEFT
// and RIGHT lean you to keep your balance. Your feet keep up with the log by
// themselves, but they need a moment to catch up when the pace changes, and
// it's quicker when you made the change. So change pace suddenly, ideally
// while your rival is already leaning, and they go in. First to two wins.
import { clamp } from './rng.js';

export const LOG = {
  uMax: 3.2,          // m/s, log surface speed either way
  push: 4.2,          // m/s² change in target pace while UP/DOWN is held
  follow: 2.6,        // 1/s, how fast the log reaches its target pace
  drift: 0.5,         // m/s² back towards the steady roll when left alone
  steady: 1.1,
  G: 2.4,             // unstable lean growth
  damp: 1.6,
  C: 7.5,             // lean control from LEFT/RIGHT
  K: 7.0,             // lean kick per m/s of foot mismatch
  noise: 1.5,
  selfLag: 0.1,       // seconds for your feet to catch up with your own change
  playerLag: 0.32,    // ... with your rival's change
  round: 40,          // seconds before the judges call a round
  wins: 2,
};

/** One roller's lean. side -1 = left (the player), +1 = right. */
class Roller {
  constructor(side) {
    this.side = side;
    this.lean = 0;      // -1..1 world x, |lean| >= 1 is a fall
    this.dl = 0;
    this.feet = LOG.steady; // pace the feet are stepping at
    this.down = false;
  }
}

export class LogRoll {
  /** @param {{skill?:number, rng?:() => number}} o rival skill 0..1 */
  constructor({ skill = 0.5, rng = Math.random } = {}, cfg = LOG) {
    this.cfg = cfg;
    this.rng = rng;
    this.skill = clamp(skill, 0, 1);
    this.score = [0, 0];       // [player, rival]
    this.roundNo = 0;
    this.newRound();
  }

  newRound() {
    this.roundNo++;
    this.u = this.cfg.steady;
    this.target = this.cfg.steady;
    this.driver = null;        // 0 player, 1 rival: who changed the pace last
    this.driverT = 9;
    this.p = new Roller(-1);
    this.r = new Roller(1);
    this.t = 0;
    this.over = null;          // 'player' | 'rival' | 'draw'
    this.noiseP = 0; this.noiseR = 0;
    this.botHist = [];
    this.botPlan = null;
    this.botPush = 0;
  }

  get finished() { return this.score[0] >= this.cfg.wins || this.score[1] >= this.cfg.wins || this.roundNo > 5; }
  get roll() { return this.u; }

  /** The rival's lean control and occasional attacks. */
  bot(dt) {
    const s = this.skill, r = this.r, c = this.cfg;
    // it sees its lean a little late
    this.botHist.push({ lean: r.lean, dl: r.dl });
    const delay = Math.round((0.22 - 0.14 * s) / dt);
    const seen = this.botHist.length > delay ? this.botHist[this.botHist.length - 1 - delay] : this.botHist[0];
    if (this.botHist.length > 200) this.botHist.shift();
    const want = -(4 + 6 * s) * seen.lean - (1.2 + 1.2 * s) * seen.dl;
    const lean = clamp(want / c.C, -1, 1) * (0.75 + 0.25 * s);
    // attacks: swing the pace when the player looks shaky and it feels safe
    if (!this.botPlan && Math.abs(r.lean) < 0.25 && this.t > 2 && this.rng() < dt * (0.25 + 0.8 * s) * (0.4 + Math.abs(this.p.lean) * 2)) {
      this.botPlan = { dir: this.u > c.steady ? -1 : 1, t: 0.25 + this.rng() * 0.4 };
    }
    let push = 0;
    if (this.botPlan) { push = this.botPlan.dir; this.botPlan.t -= dt; if (this.botPlan.t <= 0) this.botPlan = null; }
    return { lean, push };
  }

  /** @param {{lean?:number, push?:number}} u lean -1..1 (LEFT/RIGHT), push -1..1 (DOWN/UP) */
  update(dt, { lean = 0, push = 0 } = {}) {
    const c = this.cfg, ev = [];
    if (this.over) return ev;
    this.t += dt;
    const b = this.bot(dt);
    // the pace: pushes from either roller move the target; otherwise it drifts back
    const total = push + b.push;
    if (push) { this.driver = 0; this.driverT = 0; }
    if (b.push) { this.driver = 1; this.driverT = 0; }
    this.driverT += dt;
    if (total) this.target = clamp(this.target + total * c.push * dt, -c.uMax, c.uMax);
    else this.target += clamp(c.steady - this.target, -c.drift * dt, c.drift * dt);
    this.u += (this.target - this.u) * Math.min(1, c.follow * dt);
    // the log rolls a little faster as the round goes on, so it always ends
    const hurry = 1 + Math.max(0, this.t - 15) * 0.12;
    for (const [ro, ctl, mine] of [[this.p, lean, 0], [this.r, b.lean, 1]]) {
      const lag = this.driver === mine ? c.selfLag : mine === 0 ? c.playerLag : 0.2 + 0.35 * (1 - this.skill);
      ro.feet += (this.u - ro.feet) * Math.min(1, dt / lag);
      const mismatch = this.u - ro.feet;
      const n = mine ? (this.noiseR += ((this.rng() - 0.5) * 6 - this.noiseR) * dt * 2) : (this.noiseP += ((this.rng() - 0.5) * 6 - this.noiseP) * dt * 2);
      const acc = c.G * ro.lean - c.damp * ro.dl - c.K * mismatch + ctl * c.C + n * c.noise * (0.5 + Math.abs(this.u) / c.uMax) * hurry;
      ro.dl += acc * dt;
      ro.lean += ro.dl * dt;
      if (Math.abs(ro.lean) >= 1) ro.down = true;
    }
    if (this.p.down || this.r.down || this.t >= c.round) {
      // at the bell the judges give it to whoever is steadier
      const steadier = Math.abs(this.p.lean) <= Math.abs(this.r.lean) ? 'player' : 'rival';
      this.over = this.p.down && this.r.down ? 'draw' : this.p.down ? 'rival' : this.r.down ? 'player' : steadier;
      this.bell = !this.p.down && !this.r.down;
      if (this.over === 'player') this.score[0]++;
      if (this.over === 'rival') this.score[1]++;
      ev.push({ type: 'over', winner: this.over, t: this.t });
    }
    return ev;
  }
}

/** Points: 100 a round won, plus up to 40 for winning it quickly. */
export const roundPoints = (t) => 100 + Math.max(0, Math.round(40 - t));

/**
 * A bot player for tests: balances with gains kp/kd and attacks (a pace
 * swing for `attack` seconds) when the rival leans past `when`.
 */
export function runLogRoll({ kp = 8, kd = 2, attack = 0.5, when = 0.3, skill = 0.5, seed, rng = Math.random } = {}, cfg = LOG) {
  const g = new LogRoll({ skill, rng }, cfg);
  const dt = 1 / 120;
  let pts = 0, plan = 0, dir = 1;
  while (!g.finished) {
    const lean = clamp((-kp * g.p.lean - kd * g.p.dl) / cfg.C, -1, 1);
    if (!plan && attack && Math.abs(g.r.lean) > when) { plan = attack; dir = g.r.lean > 0 ? 1 : -1; }
    let push = 0;
    if (plan) { push = dir; plan = Math.max(0, plan - dt); }
    for (const e of g.update(dt, { lean, push })) if (e.winner === 'player') pts += roundPoints(e.t);
    if (g.over) { if (g.finished) break; g.newRound(); plan = 0; }
  }
  return { g, pts };
}

/** CPU points for skill 0..1 (against a rival of middling skill). */
export function cpuLog(skill, rng) {
  const s = clamp(skill, 0, 1);
  const win = 0.25 + 0.6 * s;
  let me = 0, them = 0, pts = 0;
  while (me < 2 && them < 2) {
    if (rng() < win) { me++; pts += roundPoints(8 + rng() * 25 * (1.3 - s)); } else them++;
  }
  return pts;
}
