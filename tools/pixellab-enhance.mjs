#!/usr/bin/env node
// Redraws rig frames with more detail using PixelLab's edit-image-pixen model,
// keeping the pose, then snaps the result to the athlete colours (including
// the recolour key ramps) and saves it as a frame override in assets/art/.
//
//   PIXELLAB_API_KEY=... node tools/pixellab-enhance.mjs caber_hold dive_edge_1
//   PIXELLAB_API_KEY=... node tools/pixellab-enhance.mjs --desc "barefoot diver" --seed 3 dive_tuck
//
// Arguments are tags (every frame) or frame labels (tag_n). Existing override
// files are skipped unless --force. Each frame costs one PixelLab generation.
// Review the results, then run `npm run export-sprites` to bake them in.
// The API key is read from the environment only: never commit it.
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHEETS } from '../src/art/index.js';
import { RAMPS, hexToRgb } from '../src/art/palette.js';
import { encodePNG, decodePNG } from './png.mjs';

const API = 'https://api.pixellab.ai/v2';
const DEFAULT_DESC = 'redraw this athlete with more detail and shading in 8-bit home computer style: ' +
  'red vest with a small white number, blue shorts, white socks and shoes, short brown hair; ' +
  'keep the exact same pose, size, position and colours';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i < 0 ? def : args.splice(i, 2)[1]; };
const desc = opt('--desc', DEFAULT_DESC);
const seed = Number(opt('--seed', 1));
const force = args.includes('--force');
const wanted = args.filter((a) => !a.startsWith('--'));
const key = process.env.PIXELLAB_API_KEY;
if (!key || !wanted.length) {
  console.error('usage: PIXELLAB_API_KEY=... node tools/pixellab-enhance.mjs [--desc text] [--seed n] [--force] <tag|tag_n>...');
  process.exit(1);
}

// Colours an athlete frame may use: outline, greys for shoes, and the key ramps.
const ALLOWED = ['#000000', '#1c1a22', '#444444', '#6c6c6c', '#959595', '#c4c4c4', '#ffffff',
  ...RAMPS.kitA, ...RAMPS.kitB, ...RAMPS.skin, ...RAMPS.hair].map(hexToRgb);
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function lab([r, g, b]) {
  [r, g, b] = [r, g, b].map(lin);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.9505), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.089);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const ALLOWED_LAB = ALLOWED.map(lab);
function nearest(rgb) {
  const l = lab(rgb);
  let best = 0, bd = Infinity;
  ALLOWED_LAB.forEach((m, i) => { const d = (l[0] - m[0]) ** 2 + (l[1] - m[1]) ** 2 + (l[2] - m[2]) ** 2; if (d < bd) { bd = d; best = i; } });
  return ALLOWED[best];
}

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method, body: body && JSON.stringify(body),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

const sheet = 'athlete';
const { bitmap, json } = SHEETS[sheet].bake();
const rgba = bitmap.toRGBA();
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'art', sheet);
mkdirSync(outDir, { recursive: true });

const frames = json.frames
  .map((f) => ({ label: f.filename.slice(sheet.length + 1), rect: f.frame }))
  .filter(({ label }) => wanted.some((w) => label === w || label.replace(/_\d+$/, '') === w));
if (!frames.length) { console.error('no matching frames'); process.exit(1); }

for (const { label, rect } of frames) {
  const file = join(outDir, `${label}.png`);
  if (existsSync(file) && !force) { console.log(`skip  ${label} (exists; --force to redo)`); continue; }
  const crop = new Uint8ClampedArray(rect.w * rect.h * 4);
  for (let y = 0; y < rect.h; y++)
    crop.set(rgba.subarray(((rect.y + y) * bitmap.w + rect.x) * 4, ((rect.y + y) * bitmap.w + rect.x + rect.w) * 4), y * rect.w * 4);
  const image = { type: 'base64', format: 'png', base64: encodePNG(rect.w, rect.h, crop).toString('base64') };
  const { background_job_id: job } = await call('POST', '/edit-image-pixen', { image, description: desc, no_background: true, seed });
  let j;
  do { await new Promise((r) => setTimeout(r, 3000)); j = await call('GET', `/background-jobs/${job}`); }
  while (!['completed', 'failed', 'cancelled'].includes(j.status));
  if (j.status !== 'completed') { console.log(`fail  ${label} (${j.status})`); continue; }
  const out = decodePNG(Buffer.from(j.last_response.image.base64, 'base64'));
  if (out.width !== rect.w || out.height !== rect.h) { console.log(`fail  ${label} (came back ${out.width}x${out.height})`); continue; }
  const px = out.rgba;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) { px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0; continue; }
    const [r, g, b] = nearest([px[i], px[i + 1], px[i + 2]]);
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  }
  writeFileSync(file, encodePNG(rect.w, rect.h, px));
  console.log(`wrote ${label}`);
}
