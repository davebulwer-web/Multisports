#!/usr/bin/env node
// Paints the title screen backdrop with PixelLab's pixen model at the full
// 384x216 screen size, snaps every pixel to the master palette and writes
// assets/title/background.png. The game name/logo is drawn over it in code
// (src/game/brand.js), so the art never contains lettering.
//
//   PIXELLAB_API_KEY=... node tools/pixellab-title.mjs [--seed n] [--out file.png] [--raw]
//
// One generation per run. The API key is read from the environment only:
// never commit it.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS, hexToRgb } from '../src/art/palette.js';
import { decodePNG, encodePNG } from './png.mjs';

const API = 'https://api.pixellab.ai/v2';
const W = 384, H = 216;
export const PROMPT =
  '1980s 8-bit home computer sports game title screen background, no text, no letters. ' +
  'A grand athletics stadium at dusk seen from the infield: a deep purple and orange sunset sky with a few ' +
  'stars, tall floodlight towers glowing on both sides, packed crowd stands in the middle distance with ' +
  'flags along the roof, a red running track curving across the foreground, and a three-step winners ' +
  'podium standing on green grass at the bottom centre. The top third of the picture is open sky.';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i < 0 ? def : args.splice(i, 2)[1]; };
const seed = Number(opt('--seed', 1));
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = opt('--out', join(root, 'assets', 'title', 'background.png'));
const key = process.env.PIXELLAB_API_KEY;
if (!key) { console.error('usage: PIXELLAB_API_KEY=... node tools/pixellab-title.mjs [--seed n] [--out file.png] [--raw]'); process.exit(1); }

// Recolour key ramps are reserved for athletes, so the backdrop never uses them.
const KEYS = new Set(['#7a1030', '#c0204a', '#f05a78', '#103a7a', '#2060c0', '#5a90f0', '#8a4a2a', '#c07850', '#e8a878', '#2a1608', '#50301a']);
const PAL = COLORS.slice(1).filter((h) => !KEYS.has(h)).map(hexToRgb);
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function lab([r, g, b]) {
  [r, g, b] = [r, g, b].map(lin);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.9505), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.089);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const PAL_LAB = PAL.map(lab);
function nearest(rgb) {
  const l = lab(rgb);
  let best = 0, bd = Infinity;
  PAL_LAB.forEach((m, i) => { const d = (l[0] - m[0]) ** 2 + (l[1] - m[1]) ** 2 + (l[2] - m[2]) ** 2; if (d < bd) { bd = d; best = i; } });
  return PAL[best];
}

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method, body: body && JSON.stringify(body), signal: AbortSignal.timeout(180000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

let r = await call('POST', '/create-image-pixen', {
  description: PROMPT, image_size: { width: W, height: H }, seed, view: 'side',
});
if (r.background_job_id) {
  const job = r.background_job_id;
  do { await new Promise((ok) => setTimeout(ok, 4000)); r = await call('GET', `/background-jobs/${job}`); }
  while (!['completed', 'failed', 'cancelled'].includes(r.status));
  if (r.status !== 'completed') throw new Error(r.status);
  r = r.last_response;
}
const img = decodePNG(Buffer.from(r.image.base64, 'base64'));
if (img.width !== W || img.height !== H) throw new Error(`came back ${img.width}x${img.height}`);
const rgba = Buffer.from(img.rgba);
for (let i = 0; i < W * H; i++) {
  const [cr, cg, cb] = nearest([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]]);
  rgba[i * 4] = cr; rgba[i * 4 + 1] = cg; rgba[i * 4 + 2] = cb; rgba[i * 4 + 3] = 255;
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, encodePNG(W, H, rgba));
if (args.includes('--raw')) writeFileSync(out.replace(/\.png$/, '.raw.png'), Buffer.from(r.image.base64, 'base64'));
console.log(`wrote ${out}`);
