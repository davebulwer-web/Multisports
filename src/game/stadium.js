// Parallax stadium backdrop shared by the events.
import { assets } from './assets.js';
import { fill, dither, bands, text, P, W } from '../engine/gfx.js';

export const GROUND_Y = 112;

const hash = (a, b) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const BOARDS = [
  ['MULTISPORTS', 'grey.6', 'blue.1'],
  ['GO FOR GOLD', 'yellow.2', 'red.1'],
  ['TV SPORT 86', 'grey.6', 'green.0'],
  ['FAIR PLAY', 'grey.0', 'yellow.1'],
  ['CHAMPIONS', 'cyan.2', 'purple.1'],
];

/**
 * @param {number} camX camera x in world pixels (ground layer scrolls 1:1)
 * @param {{excite?:number, t?:number}} o excite 0..1 = how many fans cheer
 */
export function drawStadium(ctx, camX, { excite = 0.1, t = 0 } = {}) {
  bands(ctx, ['sky.0', 'sky.1', 'sky.2', 'sky.3'], 0, 0, W, 34);
  // distant floodlight towers (slow parallax)
  for (let i = -1; i < 4; i++) {
    const x = Math.round(i * 160 - ((camX * 0.15) % 160));
    fill(ctx, 'grey.2', x + 20, 6, 2, 30);
    fill(ctx, 'grey.1', x + 12, 2, 18, 7);
    for (let k = 0; k < 4; k++) fill(ctx, 'yellow.2', x + 13 + k * 4, 3, 3, 2);
    for (let k = 0; k < 4; k++) fill(ctx, 'grey.6', x + 13 + k * 4, 6, 3, 2);
  }
  // stand
  const sx = camX * 0.5;
  fill(ctx, 'grey.1', 0, 30, W, 4);
  dither(ctx, 'grey.2', 'grey.1', 0, 34, W, 64);
  const col0 = Math.floor(sx / 9) - 1;
  for (let r = 0; r < 7; r++) {
    const y = 48 + r * 8;
    fill(ctx, 'grey.3', 0, y - 1, W, 1);
    for (let c = col0; c < col0 + W / 9 + 3; c++) {
      const h = hash(c, r);
      if (h < 0.08) continue; // empty seat
      const fan = Math.floor(h * 8);
      const cheering = hash(c, r + 99) < excite;
      const frame = cheering && Math.floor(t * 4 + h * 4) % 2 === 0 ? 1 : 0;
      const tag = assets.props.tags[`fan_${fan}`];
      const x = Math.round(c * 9 + (r % 2) * 4 - sx);
      assets.props.draw(ctx, tag.from + frame, x, y + (cheering && frame ? -1 : 0));
    }
  }
  // front wall + advertising boards (scroll with the ground)
  fill(ctx, 'grey.1', 0, 97, W, 3);
  const bw = 96;
  const b0 = Math.floor(camX / bw) - 1;
  for (let b = b0; b < b0 + W / bw + 3; b++) {
    const [label, fg, bg] = BOARDS[((b % BOARDS.length) + BOARDS.length) % BOARDS.length];
    const x = Math.round(b * bw - camX);
    fill(ctx, bg, x, 100, bw - 1, 12);
    fill(ctx, 'grey.0', x + bw - 1, 100, 1, 12);
    text(ctx, label, x + bw / 2, 102, fg, { align: 'center', shadow: null });
  }
  fill(ctx, 'grey.0', 0, 111, W, 1);
}

/** Striped grass between y0 and y1 that scrolls with the camera. */
export function drawGrass(ctx, camX, y0 = GROUND_Y, y1 = 216) {
  fill(ctx, 'grass.1', 0, y0, W, y1 - y0);
  const stripe = 48;
  const s0 = Math.floor(camX / stripe) - 1;
  for (let s = s0; s < s0 + W / stripe + 3; s++) {
    if (s % 2) continue;
    fill(ctx, 'grass.2', Math.round(s * stripe - camX), y0, stripe, y1 - y0);
  }
}

export { P };
