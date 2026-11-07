// Pole vault model. Pure logic.
//
// Pick a pole: each one only bends properly in its own band of run-up speed.
// Hold to run and ease off to arrive at the box inside that band, plant at
// the right distance, rock back as the pole reaches full bend, and push off
// as it straightens. The energy you carry into the pole, less what each
// mistake wastes, decides how high you go.
import { clamp } from './rng.js';

export const VAULT = {
  runway: 40,         // metres from the start mark to the box
  accel: 4.6,         // m/s^2 from standstill while running (fades towards vmax)
  ease: 1.5,          // m/s^2 lost when you ease off
  vmax: 10.5,
  takeoff: 4.0,       // ideal take-off distance in front of the box (m)
  poles: [
    { name: 'SOFT', band: [7.0, 7.7] },
    { name: 'MEDIUM', band: [8.0, 8.7] },
    { name: 'STIFF', band: [9.0, 9.5] },
  ],
  bendT: 0.55,        // seconds from plant to full bend: rock back here
  recoilT: 0.6,       // seconds from the rock back to the pole standing straight
  g: 9.81,
  com: 1.15,          // height of the hips at take-off
  push: 0.3,          // most the push-off adds (m)
  grip: 4.6,          // height of the top hand when the pole stands straight
  open: 4.0,          // lowest bar you can choose
  step: 0.05,
  jumps: 6,           // most jumps in a competition
  fails: 3,           // consecutive failures and you're out
};

/** Run-up speed after dt seconds. */
export function runStep(v, run, dt, cfg = VAULT) {
  const a = run ? cfg.accel * (1 - v / cfg.vmax) : -cfg.ease;
  return clamp(v + a * dt, 0, cfg.vmax);
}

/**
 * Outcome of a vault.
 * @param {object} j
 *   speed: run-up speed at the plant (m/s); pole: index into poles;
 *   takeoffErr: metres too close to the box (+) or too far (-);
 *   rockErr: seconds early (-) or late (+) of full bend, null = never rocked;
 *   pushErr: seconds from the pole standing straight, null = no push;
 *   bar: bar height (m)
 * @returns {{fail:string|null, peak:number, cleared:boolean, eff:number}}
 */
export function vaultResult({ speed, pole, takeoffErr, rockErr = null, pushErr = null, bar = 5 }, cfg = VAULT) {
  const [lo, hi] = cfg.poles[pole].band;
  if (takeoffErr > 1.0) return { fail: 'RAN UNDER', peak: cfg.com + 1, cleared: false, eff: 0 };
  if (takeoffErr < -1.4) return { fail: 'TOO FAR OUT', peak: cfg.com + 1, cleared: false, eff: 0 };
  const under = lo - speed, over = speed - hi;
  if (under > 0.9) return { fail: 'POLE WON\'T BEND', peak: cfg.com + 1.5, cleared: false, eff: 0 };
  const bendEff = under > 0 ? 1 - 0.6 * (under / 0.9) : over > 0 ? Math.max(0.3, 1 - 0.6 * over) : 1;
  const toEff = Math.max(0, 1 - (takeoffErr / 1.4) ** 2);
  const rockEff = rockErr == null ? 0.55 : 1 - 0.45 * clamp(Math.abs(rockErr) / 0.3, 0, 1) ** 2;
  const eff = bendEff * toEff * rockEff;
  const push = pushErr == null ? 0 : cfg.push * Math.max(0, 1 - (pushErr / 0.25) ** 2);
  const peak = cfg.com + (speed * speed) / (2 * cfg.g) * eff + push;
  return { fail: null, peak, cleared: peak >= bar, eff };
}

/** Pole index whose band best suits a speed. */
export const poleFor = (speed, cfg = VAULT) => {
  let best = 0, bd = Infinity;
  cfg.poles.forEach((p, i) => { const d = Math.abs((p.band[0] + p.band[1]) / 2 - speed); if (d < bd) { bd = d; best = i; } });
  return best;
};

/**
 * Competition bookkeeping: bar heights, consecutive failures, best clearance.
 */
export class VaultComp {
  constructor(cfg = VAULT) {
    this.cfg = cfg;
    this.jumps = [];       // {bar, cleared, fail}
    this.best = null;
    this.failsInRow = 0;
    this.bar = 4.5;
  }
  get minBar() { return this.best == null ? this.cfg.open : Math.round((this.best + this.cfg.step) * 100) / 100; }
  get over() { return this.failsInRow >= this.cfg.fails || this.jumps.length >= this.cfg.jumps; }
  setBar(h) { this.bar = Math.round(Math.max(this.minBar, Math.min(6.5, h)) * 100) / 100; }
  record(cleared, fail = null) {
    this.jumps.push({ bar: this.bar, cleared, fail });
    if (cleared) { this.best = this.bar; this.failsInRow = 0; this.setBar(this.bar + 0.1); }
    else this.failsInRow++;
  }
}

/** CPU best height for skill 0..1 (null = no height). */
export function cpuVault(skill, rng, cfg = VAULT) {
  const s = clamp(skill, 0, 1);
  const cap = 4.6 + 1.25 * s;
  const c = new VaultComp(cfg);
  c.setBar(Math.max(cfg.open, Math.round((cap - 0.5) * 10) / 10));
  while (!c.over) {
    const day = cap + rng.normal() * (0.08 + 0.15 * (1 - s));
    c.record(day >= c.bar);
  }
  return c.best;
}
