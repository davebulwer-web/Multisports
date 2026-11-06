// Tiny indexed-colour raster used to bake sprites. No DOM: runs in Node and
// the browser. Index 0 = transparent; other indices refer to palette.COLORS.

import { COLORS, hexToRgb, shift, C } from './palette.js';

export class Bitmap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h);
  }

  get(x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }

  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  /** Filled disc centred on a sub-pixel point. */
  disc(cx, cy, r, c) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, c);
      }
    }
  }

  /** Thick line from (x0,y0) to (x1,y1) with radius r0 tapering to r1. */
  limb(x0, y0, x1, y1, r0, c, r1 = r0) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len * 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t, c);
    }
  }

  /** 1px Bresenham line. */
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /**
   * Automatic light pass: pixels whose upper/left neighbour (toward the light,
   * which sits top-left/front) is empty get one ramp step lighter; pixels
   * whose lower neighbour is empty get one step darker. Gives volume cheaply.
   */
  shade() {
    const src = this.data.slice();
    const at = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = src[y * this.w + x];
        if (!c) continue;
        if (at(x, y - 1) === 0 || at(x + 1, y) === 0) this.data[y * this.w + x] = shift(c, +1);
        else if (at(x, y + 1) === 0 || at(x - 1, y) === 0) this.data[y * this.w + x] = shift(c, -1);
      }
    }
  }

  /** Dark 1px outline around the silhouette (4-neighbourhood). */
  outline(c = C('grey.1')) {
    const src = this.data.slice();
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x]) continue;
        const n =
          (x > 0 && src[y * this.w + x - 1]) ||
          (x < this.w - 1 && src[y * this.w + x + 1]) ||
          (y > 0 && src[(y - 1) * this.w + x]) ||
          (y < this.h - 1 && src[(y + 1) * this.w + x]);
        if (n) this.data[y * this.w + x] = c;
      }
    }
  }

  blitInto(dst, ox, oy) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.data[y * this.w + x];
        if (c) dst.set(ox + x, oy + y, c);
      }
  }

  /** RGBA bytes for PNG encoding or ImageData. */
  toRGBA() {
    const out = new Uint8ClampedArray(this.w * this.h * 4);
    const cache = COLORS.map((h) => (h ? hexToRgb(h) : null));
    for (let i = 0; i < this.data.length; i++) {
      const c = this.data[i];
      if (!c) continue;
      const [r, g, b] = cache[c];
      out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = 255;
    }
    return out;
  }
}
