// Drawing helpers that stick to the master palette.
import { COLORS, INDEX } from '../art/palette.js';
import { drawText } from './font.js';

export const W = 384;
export const H = 216;

/** Hex for 'ramp.step'. */
export function P(key) {
  const i = INDEX[key];
  if (i === undefined) throw new Error(`Unknown colour ${key}`);
  return COLORS[i];
}

export function fill(ctx, key, x, y, w, h) {
  ctx.fillStyle = P(key);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** 50% checkerboard dither between two colours (classic 8-bit blending). */
const ditherCache = new Map();
export function dither(ctx, keyA, keyB, x, y, w, h) {
  const id = keyA + keyB;
  let pat = ditherCache.get(id);
  if (!pat) {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const g = c.getContext('2d');
    g.fillStyle = P(keyA); g.fillRect(0, 0, 2, 2);
    g.fillStyle = P(keyB); g.fillRect(1, 0, 1, 1); g.fillRect(0, 1, 1, 1);
    pat = ctx.createPattern(c, 'repeat');
    ditherCache.set(id, pat);
  }
  ctx.fillStyle = pat;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Vertical banded gradient through a list of colours, dithered at seams. */
export function bands(ctx, keys, x, y, w, h) {
  const n = keys.length;
  const bh = h / n;
  keys.forEach((k, i) => {
    fill(ctx, k, x, y + i * bh, w, Math.ceil(bh));
    if (i > 0) dither(ctx, keys[i - 1], k, x, Math.round(y + i * bh) - 1, w, 2);
  });
}

/** Bevelled panel used for HUD boxes and menus. */
export function panel(ctx, x, y, w, h, { bg = 'blue.1', edge = 'blue.3', shadow = 'blue.0' } = {}) {
  fill(ctx, 'grey.0', x - 1, y - 1, w + 2, h + 2);
  fill(ctx, bg, x, y, w, h);
  fill(ctx, edge, x, y, w, 1);
  fill(ctx, edge, x, y, 1, h);
  fill(ctx, shadow, x, y + h - 1, w, 1);
  fill(ctx, shadow, x + w - 1, y, 1, h);
}

export function text(ctx, str, x, y, color = 'grey.6', opts = {}) {
  drawText(ctx, str, x, y, { ...opts, color: P(color), shadow: opts.shadow === null ? null : P(opts.shadow || 'grey.0') });
}

/** Horizontal meter. value 0..1. */
export function meter(ctx, x, y, w, h, value, { fg = 'green.2', bg = 'grey.1', edge = 'grey.4' } = {}) {
  fill(ctx, edge, x - 1, y - 1, w + 2, h + 2);
  fill(ctx, bg, x, y, w, h);
  fill(ctx, fg, x, y, Math.round(w * Math.max(0, Math.min(1, value))), h);
}

/** Simple rotated 1-2px line (javelin, bar). */
export function pixLine(ctx, x0, y0, x1, y1, key) {
  ctx.fillStyle = P(key);
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 2000; i++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function circle(ctx, cx, cy, r, key) {
  ctx.fillStyle = P(key);
  const r2 = r * r;
  for (let y = Math.floor(-r); y <= Math.ceil(r); y++) {
    const half = Math.floor(Math.sqrt(Math.max(0, r2 - y * y)));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}
