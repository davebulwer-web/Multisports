// Javelin flight model. Pure logic.
import { clamp } from './rng.js';

export const JAVELIN = {
  runway: 22,          // metres of run-up before the foul line
  accel: 2.4,          // m/s^2 while holding run
  vmax: 8.5,           // top run-up speed
  releaseHeight: 1.9,  // metres
  drag: 0.0011,        // quadratic drag coefficient
  pitchRate: 1.6,      // how fast the javelin's attitude follows its flight path (1/s)
  tipDownAngle: -7,    // degrees: attitude at landing must be below this to count
};

/**
 * Release speed from run-up speed and angle. Steeper releases cost speed
 * (the arm can't drive as hard upward), which pulls the best angle down
 * to the mid-30s like the real event.
 */
export function releaseSpeed(runSpeed, angle = 35) {
  const steep = Math.max(0, angle - 28) * 0.0065;
  return (13.5 + 2.1 * runSpeed) * (1 - steep);
}

/**
 * Simulate a throw.
 * @param {{runSpeed:number, angle:number, wind:number, plantX:number}} p
 *   plantX: metres relative to the foul line (negative = behind it).
 * @returns {{path:{x:number,y:number,att:number}[], landX:number, distance:number, valid:boolean, reason?:string, flightTime:number}}
 */
export function simulateThrow({ runSpeed, angle, wind = 0, plantX = 0 }, cfg = JAVELIN) {
  const speed = releaseSpeed(runSpeed, angle);
  const a = (angle * Math.PI) / 180;
  let x = plantX + 0.8, y = cfg.releaseHeight;
  let vx = speed * Math.cos(a), vy = speed * Math.sin(a);
  let att = angle;
  const path = [];
  const dt = 1 / 120;
  let t = 0;
  while (y > 0 && t < 20) {
    const rx = vx - wind, ry = vy;
    const rv = Math.hypot(rx, ry);
    vx += -cfg.drag * rv * rx * dt;
    vy += (-9.81 - cfg.drag * rv * ry) * dt;
    x += vx * dt;
    y += vy * dt;
    const flight = (Math.atan2(vy, vx) * 180) / Math.PI;
    att += (flight - att) * clamp(cfg.pitchRate * dt, 0, 1);
    t += dt;
    path.push({ x, y: Math.max(0, y), att, t });
  }
  const valid = att < cfg.tipDownAngle;
  const distance = Math.max(0, Math.floor(x * 100) / 100);
  return { path, landX: x, distance, valid, reason: valid ? undefined : 'FLAT LANDING', flightTime: t };
}

/** CPU distance for skill 0..1 (null = foul). */
export function cpuJavelin(skill, rng) {
  if (rng() < 0.08) return null;
  return Math.round((52 + 34 * skill + rng.normal() * 3) * 100) / 100;
}
