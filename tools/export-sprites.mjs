#!/usr/bin/env node
// Bakes every built-in sprite sheet from the pose rig into
// assets/sprites/<name>.png + <name>.json (Aseprite "Array" JSON).
//
//   node tools/export-sprites.mjs            # export all, skip edited files
//   node tools/export-sprites.mjs --force    # overwrite even hand-edited art
//   node tools/export-sprites.mjs athlete    # export one sheet
//   node tools/export-sprites.mjs --palette  # also write palette.gpl/.png
//
// Hand-edited sheets are protected: a sheet is only overwritten if its PNG
// still matches the last rig export (tracked in assets/sprites/.rig-hashes.json).
// Finished frames in assets/art/<sheet>/<tag>_<n>.png replace rig frames at
// export (see tools/overrides.mjs), so they survive re-exports.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHEETS } from '../src/art/index.js';
import { RAMPS, COLORS, hexToRgb } from '../src/art/palette.js';
import { encodePNG } from './png.mjs';
import { applyOverrides } from './overrides.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', 'sprites');
mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));
const hashFile = join(outDir, '.rig-hashes.json');
const hashes = existsSync(hashFile) ? JSON.parse(readFileSync(hashFile, 'utf8')) : {};
const sha = (buf) => createHash('sha1').update(buf).digest('hex');

for (const [name, def] of Object.entries(SHEETS)) {
  if (only.length && !only.includes(name)) continue;
  const { bitmap, json } = def.bake();
  const replaced = applyOverrides(name, bitmap, json, join(root, 'assets', 'art'));
  const png = encodePNG(bitmap.w, bitmap.h, bitmap.toRGBA());
  const pngPath = join(outDir, `${name}.png`);
  if (existsSync(pngPath) && !force) {
    const current = sha(readFileSync(pngPath));
    if (hashes[name] && current !== hashes[name]) {
      console.log(`skip  ${name}.png (hand-edited; use --force to overwrite)`);
      continue;
    }
  }
  writeFileSync(pngPath, png);
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(json, null, 1) + '\n');
  hashes[name] = sha(png);
  console.log(`wrote ${name}.png ${bitmap.w}x${bitmap.h}, ${json.frames.length} frames, tags: ${json.meta.frameTags.map((t) => t.name).join(', ')}${replaced.length ? `, ${replaced.length} frames from assets/art/${name}/` : ''}`);
}
writeFileSync(hashFile, JSON.stringify(hashes, null, 1) + '\n');

if (args.includes('--palette') || !existsSync(join(root, 'assets', 'palette.gpl'))) {
  // GIMP/Aseprite/Krita palette so painting tools use exactly the game colours.
  const lines = ['GIMP Palette', 'Name: Multisports', 'Columns: 8', '#'];
  for (const [ramp, list] of Object.entries(RAMPS))
    list.forEach((hex, i) => {
      const [r, g, b] = hexToRgb(hex);
      lines.push(`${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${ramp}.${i}`);
    });
  writeFileSync(join(root, 'assets', 'palette.gpl'), lines.join('\n') + '\n');
  // 1px-per-colour strip, handy for tools that import palettes from images
  const cols = COLORS.slice(1);
  const rgba = new Uint8Array(cols.length * 4);
  cols.forEach((h, i) => { rgba.set([...hexToRgb(h), 255], i * 4); });
  writeFileSync(join(root, 'assets', 'palette.png'), encodePNG(cols.length, 1, rgba));
  console.log(`wrote palette.gpl + palette.png (${cols.length} colours)`);
}
