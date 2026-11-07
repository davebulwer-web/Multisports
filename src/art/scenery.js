// Scenery objects: trees, tents, trap houses, floodlights. 64x48 frames with
// the pivot at the bottom centre (32,47), so each object is drawn by the
// centre of its base. These bakes match the shapes the events used to draw
// in code; finished art for them lives in assets/art/scenery/.

import { Bitmap } from './raster.js';
import { C } from './palette.js';
import { buildSheet } from './sheet.js';

export const SCENERY = { w: 64, h: 48, pivot: { x: 32, y: 47 } };
export const PINE_SIZES = [12, 18, 26];

/** Bitmap whose drawing coordinates are shifted so (cx, bottom) lands on the pivot. */
function canvas(cx, bottom) {
  const b = new Bitmap(SCENERY.w, SCENERY.h);
  const ox = SCENERY.pivot.x - cx, oy = SCENERY.pivot.y - bottom;
  const put = (key, x, y, w, h) => b.rect(Math.round(x) + ox, Math.round(y) + oy, w, h, C(key));
  return { b, put };
}

// Same shape as pine() in src/game/winter.js, base at y=0.
function pine(h) {
  const { b, put } = canvas(0, -1);
  put('brown.0', 0, -3, 1, 3);
  for (let k = 0; k < h; k++) {
    const w = Math.max(0, Math.floor(((h - k) / h) * (h / 3)) + ((k % 4) === 0 ? 1 : 0));
    const y = -3 - k;
    put('green.0', -w, y, w * 2 + 1, 1);
    if (k % 4 === 0 && w > 1) put('grey.6', -w, y, 2, 1);
    if (k % 4 === 1 && w > 1) put('grey.5', w - 1, y, 1, 1);
  }
  put('grey.6', 0, -3 - h, 1, 1);
  return b;
}

// Caber field marquee, left edge at x=0.
function tent() {
  const { b, put } = canvas(28, 121);
  put('grey.5', 0, 104, 56, 18);
  for (let k = 0; k < 56; k += 8) put('lamp.1', k, 104, 4, 18);
  for (let k = 0; k < 28; k++) put(k % 8 < 4 ? 'lamp.1' : 'grey.6', 28 - k, 96 + k * 0.3, 1, Math.round(8 - k * 0.28));
  for (let k = 0; k < 28; k++) put(k % 8 < 4 ? 'lamp.1' : 'grey.6', 28 + k, 96 + k * 0.3, 1, Math.round(8 - k * 0.28));
  put('grey.1', 24, 110, 8, 12);
  put('grey.2', 28, 90, 1, 6);
  put('yellow.1', 29, 90, 4, 3);
  return b;
}

// Clay pigeon trap house centred on x=0 with its top at y=-6.
function trap(side) {
  const { b, put } = canvas(0, 7);
  put('grey.2', -9, -4, 18, 12);
  put('grey.4', -10, -6, 20, 2);
  put('grey.0', side === 'left' ? 3 : -7, -2, 4, 3);
  return b;
}

// Stadium floodlight tower, left edge at x=0, top at y=2.
function tower() {
  const { b, put } = canvas(21, 35);
  put('grey.2', 20, 6, 2, 30);
  put('grey.1', 12, 2, 18, 7);
  for (let k = 0; k < 4; k++) put('yellow.2', 13 + k * 4, 3, 3, 2);
  for (let k = 0; k < 4; k++) put('grey.6', 13 + k * 4, 6, 3, 2);
  return b;
}

// Beach palm, base at x=0: a leaning trunk and drooping fronds.
function palm() {
  const { b, put } = canvas(0, -1);
  const ox = SCENERY.pivot.x, oy = SCENERY.pivot.y + 1;
  const pts = [];
  for (let k = 0; k <= 36; k++) pts.push([Math.round(Math.sin(k / 36 * 1.3) * 9), -1 - k]);
  pts.forEach(([x, y], k) => {
    put(k % 4 < 2 ? 'orange.1' : 'orange.0', x - 1, y, 3, 1);
    if (k % 4 === 0) put('orange.2', x - 1, y, 1, 1);
  });
  const [tx, ty] = pts[pts.length - 1];
  const fronds = [[-16, 6], [-11, 10], [-5, 12], [4, 12], [11, 10], [17, 5], [-2, -6], [8, -5]];
  for (const [fx, fy] of fronds) b.limb(ox + tx, oy + ty, ox + tx + fx, oy + ty + fy, 1.3, C(fy < 0 ? 'green.2' : 'green.1'), 0.6);
  b.disc(ox + tx, oy + ty + 1, 2, C('orange.0'));
  b.shade();
  b.outline(C('grey.1'));
  put('brown.1', tx - 1, ty + 2, 2, 2); // coconuts
  return b;
}

// Lifeguard hut on stilts, centred on x=0.
function lifeguard() {
  const { b, put } = canvas(0, 0);
  for (const x of [-9, 8]) put('grey.5', x, -18, 2, 18);
  put('grey.4', -8, -10, 16, 1);
  put('grey.4', -11, -19, 23, 2);
  put('yellow.2', -10, -31, 21, 12);
  put('yellow.1', -10, -22, 21, 3);
  put('grey.1', -6, -29, 13, 5);
  put('lamp.1', -12, -35, 25, 4);
  put('lamp.2', -12, -35, 25, 1);
  for (let k = 0; k < 6; k++) put('grey.6', 3 + k, -1 - k * 3, 2, 1); // ladder
  put('grey.4', 12, -45, 1, 10);
  put('lamp.1', 13, -45, 6, 4);
  return b;
}

export function bakeScenery() {
  const one = (tag, bmp) => ({ tag, frames: [{ bmp, duration: 100 }] });
  return buildSheet('scenery', [
    ...PINE_SIZES.map((h) => one(`pine_${h}`, pine(h))),
    one('tent', tent()),
    one('trap_left', trap('left')),
    one('trap_right', trap('right')),
    one('tower', tower()),
    one('palm', palm()),
    one('lifeguard', lifeguard()),
  ], { ...SCENERY, cols: 4 });
}
