// Per-frame art overrides: finished frames that replace rig frames at export.
//
// assets/art/<sheet>/<tag>_<n>.png replaces frame "<sheet> <tag>_<n>" (the
// filename in the sheet JSON). Each PNG must be exactly one frame in size and
// use only palette colours, so recolouring keeps working. The rest of the
// sheet still comes from the rig, so new animations keep baking normally.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { COLORS, hexToRgb } from '../src/art/palette.js';
import { decodePNG } from './png.mjs';

const INDEX_OF_RGB = new Map(COLORS.map((h, i) => (h ? [hexToRgb(h).join(','), i] : null)).filter(Boolean));

/** Paste override PNGs into a baked sheet. Returns the frame labels replaced. */
export function applyOverrides(name, bitmap, json, artDir) {
  const dir = join(artDir, name);
  if (!existsSync(dir)) return [];
  const byLabel = new Map(json.frames.map((f) => [f.filename.slice(name.length + 1), f.frame]));
  const done = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.png')).sort()) {
    const label = file.slice(0, -4);
    const rect = byLabel.get(label);
    if (!rect) throw new Error(`${name}/${file}: no frame called "${label}" in the ${name} sheet`);
    const { width, height, rgba } = decodePNG(readFileSync(join(dir, file)));
    if (width !== rect.w || height !== rect.h) throw new Error(`${name}/${file}: is ${width}x${height}, frames are ${rect.w}x${rect.h}`);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        let c = 0;
        if (rgba[i + 3] >= 128) {
          c = INDEX_OF_RGB.get(`${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}`);
          if (c === undefined) throw new Error(`${name}/${file}: pixel ${x},${y} is not a palette colour`);
        }
        bitmap.data[(rect.y + y) * bitmap.w + rect.x + x] = c;
      }
    done.push(label);
  }
  return done;
}
