// Long jump model. Pure logic.
//
// The run-up is the sprint's stride rhythm (alternate feet on the beat to
// build speed). Take off with UP as close behind the front of the board as
// you dare: over it is a foul, and every centimetre behind it is lost.
// Holding UP lifts the take-off angle, and letting go sets it: about 20° is
// best, steeper costs speed. In the air press DOWN just before touchdown to
// shoot the legs forward. Three jumps; the best counts.
import { SprintRunner } from './sprint.js';
import { clamp } from './rng.js';

export const LJ = {
  runway: 40,         // metres from the start mark to the front of the board
  jumps: 3,
  stride: { distance: 1e9, vmax: 11.2, window: 0.085, gain: 0.2, fatigueFrom: 1e9, firstPush: 2.2 },
  angleRate: 55,      // degrees a second the take-off angle rises while UP is held
  angleMax: 40,
  best: 20,           // above this the take-off costs speed ...
  steep: 0.02,        // ... this fraction per degree
  drop: 0.25,         // hips land this much lower than they take off (m)
  g: 9.81,
  reach: 0.5,         // most the legs gain on landing (m)
  reachAt: 0.25,      // ideal seconds before touchdown to shoot the legs
  reachWin: 0.22,
  overrun: 1.2,       // run this far past the board without jumping: no jump
};

/** The run-up: the sprint rhythm runner on a runway with no finish line. */
export const runUp = (cfg = LJ) => new SprintRunner(cfg.stride);

/** Flight of the hips: horizontal speed, vertical speed and time in the air. */
export function flight(speed, angle, cfg = LJ) {
  const v = speed * (1 - cfg.steep * Math.max(0, angle - cfg.best));
  const a = (angle * Math.PI) / 180;
  const vx = v * Math.cos(a), vy = v * Math.sin(a);
  const t = (vy + Math.sqrt(vy * vy + 2 * cfg.g * cfg.drop)) / cfg.g;
  return { vx, vy, t };
}

/** What the landing adds: `early` = seconds before touchdown DOWN was pressed (null = never). */
export function landingGain(early, cfg = LJ) {
  if (early == null) return -0.3; // never brought the legs through: falls back
  const q = 1 - ((early - cfg.reachAt) / cfg.reachWin) ** 2;
  return cfg.reach * Math.max(-0.45, q);
}

/**
 * Measure a jump.
 * @param {{speed:number, behind:number, angle:number, early:number|null}} j
 *   behind: metres the take-off foot was behind the front of the board (- = over: foul).
 * @returns {{foul:boolean, distance:number|null, air:number, gain:number, vx:number, vy:number, t:number}}
 */
export function jumpResult({ speed, behind, angle, early }, cfg = LJ) {
  const f = flight(speed, angle, cfg);
  const air = f.vx * f.t;
  const gain = landingGain(early, cfg);
  if (behind < 0) return { foul: true, distance: null, air, gain, ...f };
  const distance = Math.max(0, Math.floor((air + gain - behind) * 100) / 100);
  return { foul: false, distance, air, gain, ...f };
}

/** CPU best of three for skill 0..1 (null = three fouls). */
export function cpuLongJump(skill, rng) {
  const s = clamp(skill, 0, 1);
  let best = null;
  for (let i = 0; i < LJ.jumps; i++) {
    if (rng() < 0.22 - 0.1 * s) continue;
    const d = Math.round((6.6 + 2.1 * s + rng.normal() * (0.25 - 0.1 * s)) * 100) / 100;
    if (best == null || d > best) best = d;
  }
  return best;
}
