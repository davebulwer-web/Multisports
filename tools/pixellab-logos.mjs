#!/usr/bin/env node
// Draws the little logos on the advertising boards with PixelLab's pixen
// model (16x16, transparent), snaps them to the palette and stores them as
// palette-index rows in src/art/logos.js, which the boards baker reads.
//
//   PIXELLAB_API_KEY=... node tools/pixellab-logos.mjs              # every brand without a logo
//   PIXELLAB_API_KEY=... node tools/pixellab-logos.mjs --seed 4 --force zapcola
//
// Prompts come from `icon` in src/art/brands.js. Each logo costs one
// generation. Then run `npm run export-sprites -- boards`.
// The API key is read from the environment only: never commit it.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRANDS } from '../src/art/brands.js';
import { LOGOS } from '../src/art/logos.js';
import { LOGO_SIZE, encodeLogo } from '../src/art/boards.js';
import { COLORS, hexToRgb } from '../src/art/palette.js';
import { decodePNG } from './png.mjs';

const API = 'https://api.pixellab.ai/v2';
const STYLE = 'simple bold pixel art icon for an 1980s advertising board, chunky shapes, clear dark outline, centred, ';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i < 0 ? def : args.splice(i, 2)[1]; };
const seed = Number(opt('--seed', 1));
const force = args.includes('--force');
const wanted = args.filter((a) => !a.startsWith('--'));
const key = process.env.PIXELLAB_API_KEY;
if (!key) { console.error('usage: PIXELLAB_API_KEY=... node tools/pixellab-logos.mjs [--seed n] [--force] [brand ...]'); process.exit(1); }

const PAL = COLORS.slice(1).map(hexToRgb);
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
  return best + 1; // palette index
}

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method, body: body && JSON.stringify(body), signal: AbortSignal.timeout(120000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function generate(desc) {
  let r = await call('POST', '/create-image-pixen', {
    description: STYLE + desc, image_size: { width: LOGO_SIZE, height: LOGO_SIZE }, no_background: true, seed,
  });
  if (r.background_job_id) {
    const job = r.background_job_id;
    do { await new Promise((ok) => setTimeout(ok, 3000)); r = await call('GET', `/background-jobs/${job}`); }
    while (!['completed', 'failed', 'cancelled'].includes(r.status));
    if (r.status !== 'completed') throw new Error(r.status);
    r = r.last_response;
  }
  return decodePNG(Buffer.from(r.image.base64, 'base64'));
}

const logos = { ...LOGOS };
const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'art', 'logos.js');
function save() {
  const body = Object.keys(logos).sort().map((id) => `  ${id}: [\n${logos[id].map((r) => `    '${r}',`).join('\n')}\n  ],`).join('\n');
  const HEADER = '// Board logos, 16x16, one string per row: "." is transparent, any other\n' +
    '// character is a palette index (see LOGO_CHARS in boards.js). Written by\n' +
    '// tools/pixellab-logos.mjs from PixelLab; edit by hand if you like.\n';
  writeFileSync(file, `${HEADER}export const LOGOS = {\n${body}\n};\n`);
}

const todo = BRANDS.filter((b) => b.icon && (wanted.length ? wanted.includes(b.id) : true) && (force || !logos[b.id]));
async function one(b) {
  try {
    const { width, height, rgba } = await generate(b.icon);
    if (width !== LOGO_SIZE || height !== LOGO_SIZE) throw new Error(`came back ${width}x${height}`);
    const px = [];
    for (let i = 0; i < width * height; i++) px.push(rgba[i * 4 + 3] < 128 ? 0 : nearest([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]]));
    logos[b.id] = encodeLogo(px);
    save(); // after each one, so an interrupted run keeps what it made
    console.log(`wrote ${b.id}`);
  } catch (e) { console.log(`fail  ${b.id} (${e.message})`); }
}
for (let i = 0; i < todo.length; i++) await one(todo[i]); // one at a time: parallel requests stall behind the proxy

