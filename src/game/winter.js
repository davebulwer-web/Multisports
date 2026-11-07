// Shared winter scenery: sky, parallax mountains, pines and falling snow.
// Used by the winter events (ski jump, biathlon).
import { fill, dither, bands, W, H } from '../engine/gfx.js';
import { assets, drawScenery } from './assets.js';
import { PINE_SIZES } from '../art/scenery.js';

export const hash = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const peak = (u, w) => 1 - Math.abs(((u / w) % 1 + 1) % 1 - 0.5) * 2; // triangle wave 0..1

/**
 * Sky, far peaks and a nearer snowy ridge.
 * @param {number} camPx camera x in screen pixels; camPy camera y in pixels (+ = up)
 */
export function drawWinterSky(ctx, camPx, camPy = 0, { horizon = 150, ridge = 146 } = {}) {
  bands(ctx, ['sky.0', 'sky.1', 'sky.2', 'sky.3', 'grey.5'], 0, 0, W, H);
  const px = camPx * 0.12, py = camPy * 0.08;
  for (let x = 0; x < W; x += 2) {
    const u = x + px;
    const h = 40 + peak(u, 120) * 46 + peak(u + 37, 47) * 16 + peak(u + 11, 19) * 5;
    const top = Math.round(horizon - h + py);
    fill(ctx, 'blue.2', x, top, 2, H - top);
    if (peak(u + 60, 240) > 0.5) fill(ctx, 'blue.1', x, top + 6, 2, H - top - 6); // shaded faces
    const cap = Math.max(0, Math.round(h - 62));
    fill(ctx, 'grey.6', x, top, 2, Math.min(cap, 16));
    if (cap > 2) dither(ctx, 'grey.6', 'blue.3', x, top + Math.min(cap, 16), 2, 2);
  }
  const qx = camPx * 0.3, qy = camPy * 0.2;
  for (let x = 0; x < W; x += 2) {
    const u = x + qx;
    const top = Math.round(ridge - Math.sin(u / 37) * 12 - Math.sin(u / 11) * 3 + qy);
    fill(ctx, 'sky.3', x, top, 2, H - top);
    fill(ctx, 'grey.6', x, top, 2, 1);
  }
}

/** A snow-dusted pine with its base at (x, base). */
export function pine(ctx, x, base, h) {
  x = Math.round(x);
  if (h >= 10 && assets.scenery) {
    const size = PINE_SIZES.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a));
    drawScenery(ctx, `pine_${size}`, x, base - 1);
    return;
  }
  fill(ctx, 'brown.0', x, base - 3, 1, 3);
  for (let k = 0; k < h; k++) {
    const w = Math.max(0, Math.floor(((h - k) / h) * (h / 3)) + ((k % 4) === 0 ? 1 : 0));
    const y = base - 3 - k;
    fill(ctx, 'green.0', x - w, y, w * 2 + 1, 1);
    if (k % 4 === 0 && w > 1) fill(ctx, 'grey.6', x - w, y, 2, 1);
    if (k % 4 === 1 && w > 1) fill(ctx, 'grey.5', x + w - 1, y, 1, 1);
  }
  fill(ctx, 'grey.6', x, base - 3 - h, 1, 1);
}

/** Falling snow in screen space, drifting with wind and parallax. */
export class Snowfall {
  constructor(n = 70) {
    this.flakes = Array.from({ length: n }, (_, i) => ({ x: hash(i) * W, y: hash(i + 500) * H, z: 0.4 + hash(i + 900) * 0.8 }));
    this.t = 0;
  }
  update(dt, wind = 0) {
    this.t += dt;
    for (const f of this.flakes) { f.y += (10 + f.z * 14) * dt; f.x += Math.sin(this.t * 0.8 + f.z * 9) * 6 * dt - wind * 4 * f.z * dt; }
  }
  draw(ctx, camPx = 0, camPy = 0) {
    for (const f of this.flakes) {
      const x = (((f.x - camPx * 0.3 * f.z) % W) + W) % W;
      const y = (((f.y + camPy * 0.3 * f.z) % H) + H) % H;
      fill(ctx, f.z > 0.9 ? 'grey.6' : 'grey.5', x, y, 1, 1);
    }
  }
}
