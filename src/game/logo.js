// The title logo: the game name from brand.js in a bold, slanted version of
// the 5x7 font, filled with an 80s chrome gradient, outlined, with a light
// sheen that sweeps across now and then. Built once per scale and cached.
import { GLYPHS } from '../engine/font.js';
import { P } from '../engine/gfx.js';
import { BRAND } from './brand.js';

const GOLD = ['grey.6', 'yellow.2', 'yellow.2', 'yellow.1', 'orange.3', 'orange.3', '|', 'orange.2', 'orange.2', 'track.2', 'track.1'];
const BLUE = ['grey.6', 'cyan.2', 'cyan.2', 'sky.2', 'sky.1', 'sky.1', '|', 'blue.3', 'blue.2', 'purple.2', 'purple.1'];
const ADV = 7;   // bold glyphs are 6 units wide plus a 1 unit gap
const LEAN = 3;  // italic: each screen row shifts 1px right per LEAN rows up

/** Bold + italic mask for a string, in font units. */
function maskOf(str) {
  const w = Math.max(1, str.length * ADV - 1);
  const rows = Array.from({ length: 7 }, () => new Array(w).fill(false));
  [...str.toUpperCase()].forEach((ch, i) => {
    const g = (GLYPHS[ch] || GLYPHS[' ']).split(',');
    g.forEach((row, y) => {
      for (let x = 0; x < 5; x++) {
        if (row[x] !== '#') continue;
        rows[y][i * ADV + x] = true;     // the glyph pixel
        // and one to its right for bold strokes, unless that would close a
        // one-pixel gap (keeps the middle of M, W and friends readable)
        if (row[x + 2] !== '#') rows[y][i * ADV + x + 1] = true;
      }
    });
  });
  return { w, rows };
}

/** One word as a canvas: chrome fill at `scale`, slanted, no outline. */
function chromeWord(str, scale, ramp) {
  const { w, rows } = maskOf(str);
  const h = 7 * scale;
  const c = document.createElement('canvas');
  c.width = w * scale + Math.floor((h - 1) / LEAN); c.height = h;
  const x = c.getContext('2d');
  // gradient stripes; '|' is a one pixel bright "horizon" line
  const bands = ramp.filter((k) => k !== '|');
  const hz = Math.round((ramp.indexOf('|') / (ramp.length - 1)) * c.height);
  for (let y = 0; y < c.height; y++) {
    x.fillStyle = P(bands[Math.min(bands.length - 1, Math.floor((y / c.height) * bands.length))]);
    x.fillRect(0, y, c.width, 1);
  }
  x.fillStyle = P('grey.6');
  x.fillRect(0, hz, c.width, 1);
  const mask = document.createElement('canvas');
  mask.width = c.width; mask.height = c.height;
  const m = mask.getContext('2d');
  m.fillStyle = '#fff';
  rows.forEach((row, y) => row.forEach((on, ux) => { if (on) m.fillRect(ux * scale, y * scale, scale, scale); }));
  const lean = document.createElement('canvas');
  lean.width = c.width; lean.height = h;
  const l = lean.getContext('2d');
  for (let y = 0; y < h; y++) l.drawImage(mask, 0, y, mask.width, 1, Math.floor((h - 1 - y) / LEAN), y, mask.width, 1);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(lean, 0, 0);
  return c;
}

/** Solid silhouette of a canvas in one colour. */
function tint(src, key) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = P(key);
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

const cache = new Map();
function build(scale) {
  if (cache.has(scale)) return cache.get(scale);
  const parts = [chromeWord(BRAND.name, scale, GOLD)];
  if (BRAND.accent) parts.push(chromeWord(BRAND.accent, scale, BLUE));
  const gap = 2 * scale;
  const pad = 3; // room for outline + shadow
  const fillC = document.createElement('canvas');
  fillC.width = parts.reduce((s, p) => s + p.width, 0) + gap * (parts.length - 1);
  fillC.height = 7 * scale;
  const fx = fillC.getContext('2d');
  let px = 0;
  for (const p of parts) { fx.drawImage(p, px, 0); px += p.width + gap; }

  const out = document.createElement('canvas');
  out.width = fillC.width + pad * 2;
  out.height = fillC.height + pad * 2;
  const o = out.getContext('2d');
  const shadow = tint(fillC, 'purple.0');
  const edge = tint(fillC, 'grey.0');
  for (let dy = 0; dy <= 2; dy++) for (let dx = 0; dx <= 2; dx++) o.drawImage(shadow, pad + dx + 1, pad + dy + 1);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) o.drawImage(edge, pad + dx, pad + dy);
  o.drawImage(fillC, pad, pad);
  const logo = { canvas: out, fill: fillC, pad, sheen: document.createElement('canvas') };
  logo.sheen.width = fillC.width; logo.sheen.height = fillC.height;
  cache.set(scale, logo);
  return logo;
}

/** Logo width/height in pixels at a scale (including outline). */
export function logoSize(scale = 5) {
  const { canvas } = build(scale);
  return { w: canvas.width, h: canvas.height };
}

/**
 * Draw the logo centred on cx with its top at y. `t` (seconds) drives the
 * sheen, which crosses the letters every few seconds.
 */
export function drawLogo(ctx, cx, y, t = 0, { scale = 5 } = {}) {
  const logo = build(scale);
  const x = Math.round(cx - logo.canvas.width / 2);
  y = Math.round(y);
  ctx.drawImage(logo.canvas, x, y);
  const period = 4.5, sweep = 0.9;
  const k = (t % period) / sweep;
  if (k >= 1) return;
  const s = logo.sheen, sx = s.getContext('2d');
  sx.globalCompositeOperation = 'source-over';
  sx.clearRect(0, 0, s.width, s.height);
  sx.fillStyle = P('grey.6');
  const bx = Math.round(-s.height + k * (s.width + s.height * 2));
  for (let row = 0; row < s.height; row++) sx.fillRect(bx - row, row, 4, 1); // a thin diagonal glint
  sx.globalCompositeOperation = 'destination-in';
  sx.drawImage(logo.fill, 0, 0);
  ctx.drawImage(s, x + logo.pad, y + logo.pad);
}
