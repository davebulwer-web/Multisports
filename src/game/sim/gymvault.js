// Gymnastic vault model. Pure logic; metres, seconds, degrees.
//
// Hold RIGHT to sprint at the table. Press DOWN to hurdle so you land on the
// springboard's sweet spot, then SPACE as your hands meet the table to block
// off it. The faster you arrive and the cleaner the board and block, the
// higher you fly and the faster you spin. You spin tucked until you press UP
// to open out, which all but stops the rotation: open at the right moment to
// land feet first and upright, then hold the landing with LEFT/RIGHT.
// Score = difficulty + execution (10 less deductions). Two vaults, averaged.
import { clamp } from './rng.js';

export const GV = {
  runway: 22,            // metres from the start to the board's sweet spot
  tableAt: 1.4,          // the table's near edge, past the board
  accel: 3.2, vmax: 8.6, // run-up
  hurdle: 0.32,          // seconds in the air from the hurdle to the board
  board: { good: 0.12, balk: 0.45 },   // metres off the sweet spot
  preflight: 0.26,       // seconds from the board to the hands on the table
  block: { good: 0.05, win: 0.16 },    // seconds off the hand contact
  comBlock: 2.2,         // height of the hips in the handstand on the table (m)
  comLand: 1.0,          // hips on landing
  rise: 1.15,            // most the block lifts the hips (m)
  spin: { tuck: 1150, open: 150 },     // degrees a second at full power
  g: 9.81,
  vaults: [
    { name: 'FRONT TUCK', d: 3.6, need: 720, spin: 1 },
    { name: 'FRONT PIKE', d: 4.2, need: 720, spin: 0.78 },
    { name: 'DOUBLE FRONT', d: 5.4, need: 1080, spin: 1 },
  ],
  stick: { time: 1.1, push: 7, fall: 5, damp: 2.5, step: 1 },
  vaultsEach: 2,
};

/** Run-up speed after dt seconds. */
export function runStep(v, run, dt, cfg = GV) {
  const a = run ? cfg.accel * (1 - v / cfg.vmax) * 1.6 : -2.5;
  return clamp(v + a * dt, 0, cfg.vmax);
}

/** Where the hurdle lands relative to the sweet spot (+ = past it), and its quality. */
export function boardContact(x, v, cfg = GV) {
  const err = x + v * cfg.hurdle - cfg.runway;
  if (err < -cfg.board.balk) return { err, balk: 'SHORT OF THE BOARD', q: 0 };
  if (err > cfg.board.balk) return { err, balk: 'TOO CLOSE TO THE TABLE', q: 0 };
  return { err, balk: null, q: clamp(1 - (Math.max(0, Math.abs(err) - cfg.board.good) / (cfg.board.balk - cfg.board.good)) ** 2 * 0.8, 0, 1) };
}

/** Block quality from the press timing (seconds after the hands land; null = never). */
export function blockQuality(err, cfg = GV) {
  if (err == null) return 0.15;
  const e = Math.max(0, Math.abs(err) - cfg.block.good);
  return clamp(1 - (e / cfg.block.win) ** 2, 0.15, 1);
}

/**
 * Second flight after the block.
 * @returns {{power:number, rise:number, T:number, tuck:number, open:number}}
 *   T: seconds from the block to the feet landing; tuck/open: spin rates.
 */
export function afterBlock({ speed, board, block }, vault, cfg = GV) {
  const power = (speed / cfg.vmax) * (0.55 + 0.45 * board) * (0.35 + 0.65 * block);
  const rise = Math.max(0.15, cfg.rise * power);
  const T = Math.sqrt((2 * rise) / cfg.g) + Math.sqrt((2 * (cfg.comBlock + rise - cfg.comLand)) / cfg.g);
  return { power, rise, T, tuck: cfg.spin.tuck * power ** 1.6 * vault.spin, open: cfg.spin.open * Math.max(0.4, power) };
}

/** Body rotation (degrees after the block, starting inverted at 180) at time t with UP pressed at tOpen. */
export function rotationAt(t, fl, tOpen = null) {
  const to = tOpen == null ? t : Math.min(t, tOpen);
  return 180 + fl.tuck * to + fl.open * Math.max(0, t - to);
}

/** The best moment to open, for a given flight and vault (may be < 0 or > T if impossible). */
export const idealOpen = (fl, vault) => (vault.need - 180 - fl.open * fl.T) / (fl.tuck - fl.open);

/** Landing: how far from upright the feet came down (+ = over-rotated). */
export const landingError = (fl, vault, tOpen) => rotationAt(fl.T, fl, tOpen) - vault.need;

/**
 * Holding the landing: an unstable lean (+ forward) you push back with
 * LEFT (-1) / RIGHT (+1). Past the edge you take a step, which costs marks.
 */
export class Stick {
  constructor(err, cfg = GV) {
    this.cfg = cfg.stick;
    this.lean = clamp(err / 70, -0.95, 0.95);
    this.v = clamp(err / 50, -1.5, 1.5);
    this.t = 0;
    this.steps = 0;
    this.fell = Math.abs(err) > 90;
    this.done = this.fell;
  }

  update(dt, u = 0) {
    if (this.done) return null;
    const c = this.cfg;
    this.t += dt;
    this.v += (c.fall * this.lean + c.push * u - c.damp * this.v) * dt;
    this.lean += this.v * dt;
    let ev = null;
    if (Math.abs(this.lean) > c.step) {
      this.steps++;
      ev = { type: 'step', dir: Math.sign(this.lean) };
      this.lean *= 0.35; this.v *= 0.3;
      if (this.steps >= 3) { this.fell = true; this.done = true; ev = { type: 'fall' }; }
    }
    if (this.t >= c.time) this.done = true;
    return ev;
  }
}

/**
 * Judges' score.
 * @param {{vault:object, board:number, block:number, rise:number, landErr:number, steps:number, fell:boolean}} v
 */
export function judge({ vault, board, block, rise, landErr, steps, fell }) {
  const ded = {
    board: Math.round((1 - board) * 0.5 * 10) / 10,
    block: Math.round((1 - block) * 0.8 * 10) / 10,
    height: rise < 0.6 ? 0.5 : rise < 0.85 ? 0.2 : 0,
    landing: Math.min(1.5, Math.round(Math.max(0, Math.abs(landErr) - 15) * 0.015 * 10) / 10),
    steps: Math.min(0.9, steps * 0.3),
    fall: fell ? 1.0 : 0,
  };
  const e = Math.max(0, 10 - Object.values(ded).reduce((a, b) => a + b, 0));
  return { d: vault.d, e: Math.round(e * 1000) / 1000, total: Math.round((vault.d + e) * 1000) / 1000, ded };
}

/** A whole vault from the inputs (for bots and tests). openErr = seconds off the ideal opening. */
export function playVault({ vault = GV.vaults[0], speed = GV.vmax, boardErr = 0, blockErr = 0, openErr = 0, steady = true }, cfg = GV) {
  const bc = boardContact(cfg.runway - speed * cfg.hurdle + boardErr, speed, cfg);
  if (bc.balk) return { balk: bc.balk, total: 0 };
  const block = blockQuality(blockErr, cfg);
  const fl = afterBlock({ speed, board: bc.q, block }, vault, cfg);
  const tOpen = clamp(idealOpen(fl, vault) + openErr, 0, fl.T);
  const landErr = landingError(fl, vault, tOpen);
  const st = new Stick(landErr, cfg);
  while (!st.done) st.update(1 / 120, steady ? clamp(-st.lean * 3 - st.v, -1, 1) : 0);
  return { ...judge({ vault, board: bc.q, block, rise: fl.rise, landErr, steps: st.steps, fell: st.fell }), landErr, fl };
}

/** Format a gymnastics score. */
export const fmtGym = (n) => (n == null ? '--' : n.toFixed(3));

/** CPU average of two vaults for skill 0..1. */
export function cpuVaulting(skill, rng, cfg = GV) {
  const s = clamp(skill, 0, 1);
  const vault = cfg.vaults[s > 0.75 ? 2 : s > 0.4 ? 1 : 0];
  let sum = 0;
  for (let i = 0; i < cfg.vaultsEach; i++) {
    const fall = rng() < 0.15 - 0.1 * s;
    sum += vault.d + clamp(7.6 + 2.0 * s + rng.normal() * 0.25 - (fall ? 1.5 : 0), 0, 10);
  }
  return Math.round((sum / cfg.vaultsEach) * 1000) / 1000;
}
