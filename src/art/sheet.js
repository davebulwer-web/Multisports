// Packs baked frames into a spritesheet bitmap + Aseprite-compatible JSON.
//
// JSON layout follows Aseprite's "Array" export (frames[] + meta.frameTags[])
// so sheets can round-trip through Aseprite (File > Import Sprite Sheet, then
// File > Export Sprite Sheet with "Array" + "Tags" ticked). Multisports-only
// extras live under meta.multisports (pivot, per-frame anchors); if they are
// missing the game falls back to the values from the built-in rig.

import { Bitmap } from './raster.js';

/**
 * @param {string} name sheet name (file stem)
 * @param {{tag:string, frames:{bmp:Bitmap, duration:number, anchors?:object}[], direction?:string}[]} anims
 * @param {{w:number,h:number,pivot:{x:number,y:number},cols?:number}} opts
 */
export function buildSheet(name, anims, { w, h, pivot, cols = 8 }) {
  const all = [];
  const frameTags = [];
  for (const a of anims) {
    const from = all.length;
    a.frames.forEach((f, i) => all.push({ ...f, label: `${a.tag}_${i}` }));
    frameTags.push({ name: a.tag, from, to: all.length - 1, direction: a.direction || 'forward' });
  }
  const rows = Math.ceil(all.length / cols);
  const sheet = new Bitmap(Math.min(cols, all.length) * w, rows * h);
  const frames = [];
  const anchors = {};
  all.forEach((f, i) => {
    const x = (i % cols) * w, y = Math.floor(i / cols) * h;
    f.bmp.blitInto(sheet, x, y);
    frames.push({
      filename: `${name} ${f.label}`,
      frame: { x, y, w, h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h },
      sourceSize: { w, h },
      duration: f.duration,
    });
    if (f.anchors) anchors[i] = f.anchors;
  });
  const json = {
    frames,
    meta: {
      app: 'multisports sprite rig',
      version: '1',
      image: `${name}.png`,
      format: 'RGBA8888',
      size: { w: sheet.w, h: sheet.h },
      scale: '1',
      frameTags,
      multisports: { pivot, anchors },
    },
  };
  return { bitmap: sheet, json };
}
