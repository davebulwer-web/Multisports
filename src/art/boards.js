// Advertising boards: one 96x16 frame per brand in src/art/brands.js, drawn
// by its top-left corner. Backgrounds and lettering are drawn here so the
// words are always crisp; the logos are PixelLab art stored in logos.js.
// Finished, hand-painted boards can replace any frame through
// assets/art/boards/<brand>_0.png like every other sheet.

import { Bitmap } from './raster.js';
import { C, COLORS } from './palette.js';
import { buildSheet } from './sheet.js';
import { BRANDS } from './brands.js';
import { LOGOS } from './logos.js';
import { GLYPHS } from '../engine/font.js';

export const BOARD = { w: 96, h: 16, pivot: { x: 0, y: 0 } };
export const LOGO_SIZE = 16;

// ---- logo encoding: one character per pixel, '.' = transparent ----
export const LOGO_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/';
if (COLORS.length - 1 > LOGO_CHARS.length) throw new Error('palette too big for logo encoding');
export const encodeLogo = (px) => Array.from({ length: LOGO_SIZE }, (_, y) =>
  px.slice(y * LOGO_SIZE, (y + 1) * LOGO_SIZE).map((c) => (c ? LOGO_CHARS[c - 1] : '.')).join(''));
export const decodeLogo = (rows) => rows.map((r) => [...r].map((ch) => (ch === '.' ? 0 : LOGO_CHARS.indexOf(ch) + 1)));

// ---- lettering ----
// 3x5 font for taglines. The names use the game's 5x7 font.
const MINI = {
  A: '.#.,#.#,###,#.#,#.#', B: '##.,#.#,##.,#.#,##.', C: '.##,#..,#..,#..,.##', D: '##.,#.#,#.#,#.#,##.',
  E: '###,#..,##.,#..,###', F: '###,#..,##.,#..,#..', G: '.##,#..,#.#,#.#,.##', H: '#.#,#.#,###,#.#,#.#',
  I: '###,.#.,.#.,.#.,###', J: '..#,..#,..#,#.#,.#.', K: '#.#,#.#,##.,#.#,#.#', L: '#..,#..,#..,#..,###',
  M: '#.#,###,#.#,#.#,#.#', N: '##.,#.#,#.#,#.#,#.#', O: '.#.,#.#,#.#,#.#,.#.', P: '##.,#.#,##.,#..,#..',
  Q: '.#.,#.#,#.#,##.,.##', R: '##.,#.#,##.,#.#,#.#', S: '.##,#..,.#.,..#,##.', T: '###,.#.,.#.,.#.,.#.',
  U: '#.#,#.#,#.#,#.#,###', V: '#.#,#.#,#.#,#.#,.#.', W: '#.#,#.#,###,###,#.#', X: '#.#,#.#,.#.,#.#,#.#',
  Y: '#.#,#.#,.#.,.#.,.#.', Z: '###,..#,.#.,#..,###',
  0: '###,#.#,#.#,#.#,###', 1: '.#.,##.,.#.,.#.,###', 2: '##.,..#,.#.,#..,###', 3: '##.,..#,.#.,..#,##.',
  4: '#.#,#.#,###,..#,..#', 5: '###,#..,##.,..#,##.', 6: '.##,#..,###,#.#,###', 7: '###,..#,.#.,.#.,.#.',
  8: '###,#.#,###,#.#,###', 9: '###,#.#,###,..#,##.',
  ' ': '...,...,...,...,...', '&': '.#.,#.#,.#.,#.#,.##', '.': '...,...,...,...,.#.', '!': '.#.,.#.,.#.,...,.#.',
  '-': '...,...,###,...,...', "'": '.#.,.#.,...,...,...',
};
const FONTS = {
  big: { glyphs: GLYPHS, w: 5, h: 7, adv: 6 },
  mini: { glyphs: MINI, w: 3, h: 5, adv: 4 },
};
const rowsOf = (font, ch) => {
  const g = font.glyphs[ch] ?? font.glyphs['?'] ?? font.glyphs[' '];
  return g.split(',');
};

/** Width in pixels of a word in a font at x-scale sx (plus the italic lean). */
export function wordWidth(str, { font = 'big', sx = 1, italic = false } = {}) {
  const f = FONTS[font];
  return Math.max(0, str.length * f.adv - (f.adv - f.w)) * sx + (italic ? 2 : 0);
}

function stamp(b, str, x, y, col, { font = 'big', sx = 1, sy = 1, italic = false }) {
  const f = FONTS[font];
  [...str].forEach((ch, i) => {
    rowsOf(f, ch).forEach((row, ry) => {
      const lean = italic ? Math.round((f.h - 1 - ry) / 3) : 0;
      for (let rx = 0; rx < f.w; rx++) {
        if (row[rx] !== '#') continue;
        b.rect(x + i * f.adv * sx + rx * sx + lean, y + ry * sy, sx, sy, col);
      }
    });
  });
}

/** Draw a word with an optional drop shadow or outline. */
function word(b, str, x, y, fg, { sh = null, outline = false, ...o }) {
  if (sh && outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) stamp(b, str, x + dx, y + dy, sh, o);
  else if (sh) stamp(b, str, x + (o.sx || 1), y + 1, sh, o);
  stamp(b, str, x, y, fg, o);
}

// ---- backgrounds ----
const W = BOARD.w, H = BOARD.h;
const BUSY = ['grid', 'tartan']; // backgrounds whose taglines need a shadow
const RAINBOW = ['lamp.1', 'orange.3', 'yellow.2', 'green.2', 'sky.1', 'purple.2'];
const BACKGROUNDS = {
  solid(b, c) {
    b.rect(0, 0, W, H, c.bg);
    b.rect(0, H - 2, W, 2, c.bg2);
  },
  split(b, c, side) {
    b.rect(0, 0, W, H, c.bg);
    for (let y = 0; y < H; y++) {
      const w = 20 + Math.floor((H - y) / 2);
      if (side === 'left') b.rect(0, y, w, 1, c.bg2);
      else b.rect(W - w, y, w, 1, c.bg2);
    }
  },
  stripes(b, c) {
    b.rect(0, 0, W, H, c.bg);
    b.rect(0, 1, W, 1, c.bg2);
    b.rect(0, H - 2, W, 1, c.bg2);
  },
  sunset(b, c) {
    b.rect(0, 0, W, H, c.bg);
    b.rect(0, 0, W, 5, c.bg2);
    for (let x = 0; x < W; x++) b.set(x, 5 + (x % 2), c.bg2);
    for (let x = 0; x < W; x += 2) b.set(x, 7, c.bg2);
  },
  grid(b, c) {
    b.rect(0, 0, W, H, c.bg);
    for (let x = 3; x < W; x += 8) b.rect(x, 0, 1, H, c.bg2);
    for (const y of [5, 10]) b.rect(0, y, W, 1, c.bg2);
  },
  check(b, c, side) {
    b.rect(0, 0, W, H, c.bg);
    const x0 = side === 'left' ? W - 12 : 0;
    for (let y = 0; y < H; y += 4) for (let x = 0; x < 12; x += 4) if (((x + y) / 4) % 2) b.rect(x0 + x, y, 4, 4, c.bg2);
  },
  rainbow(b, c, side) {
    b.rect(0, 0, W, H, c.bg);
    RAINBOW.forEach((k, i) => {
      for (let y = 0; y < H; y++) {
        const x = (side === 'left' ? W - 16 : -8) + i * 2 + Math.floor((H - y) / 2);
        b.rect(x, y, 2, 1, C(k));
      }
    });
  },
  tartan(b, c) {
    b.rect(0, 0, W, H, c.bg);
    for (let x = 2; x < W; x += 12) b.rect(x, 0, 4, H, c.bg2);
    b.rect(0, 6, W, 4, c.bg2);
    for (let x = 4; x < W; x += 12) b.rect(x, 0, 1, H, c.acc);
  },
};

/** Bake one brand's board. Throws if the lettering doesn't fit. */
export function boardBitmap(brand) {
  const b = new Bitmap(W, H);
  const c = Object.fromEntries(Object.entries(brand.c).map(([k, v]) => [k, v ? C(v) : null]));
  const logo = LOGOS[brand.id];
  const hasLogo = !!(brand.icon && logo);
  BACKGROUNDS[brand.bg](b, c, brand.side);

  // text area: the board minus the logo end
  const pad = 3;
  // keep the words off the logo end and the busy background ends
  const near = Math.max(hasLogo ? LOGO_SIZE + 4 : pad, brand.bg === 'split' ? 26 : 0);
  const far = { check: 14, rainbow: 17 }[brand.bg] ?? pad;
  const x0 = brand.side === 'left' ? near : far;
  const x1 = W - (brand.side === 'left' ? far : near);
  const area = x1 - x0;
  let style = brand.letter;
  const opts = (s) => ({ sx: s === 'wide' ? 2 : 1, sy: s === 'tall' ? 2 : 1, italic: s === 'italic', outline: s === 'outline' });
  if (wordWidth(brand.name, opts(style)) > area) style = 'plain';
  if (wordWidth(brand.name, opts(style)) > area) throw new Error(`${brand.id}: "${brand.name}" doesn't fit in ${area}px`);
  const o = opts(style);
  const tag = style === 'tall' ? null : brand.tag;
  const nx = x0 + Math.floor((area - wordWidth(brand.name, o)) / 2);
  const ny = style === 'tall' ? 1 : tag ? 1 : 4;
  word(b, brand.name, nx, ny, c.fg, { sh: c.sh, ...o });
  if (tag) {
    if (wordWidth(tag, { font: 'mini' }) > area) throw new Error(`${brand.id}: tagline "${tag}" doesn't fit in ${area}px`);
    word(b, tag, x0 + Math.floor((area - wordWidth(tag, { font: 'mini' })) / 2), 9, c.acc, { font: 'mini', sh: BUSY.includes(brand.bg) ? c.sh : null });
  }

  if (hasLogo) {
    const lx = brand.side === 'left' ? 2 : W - LOGO_SIZE - 2;
    decodeLogo(logo).forEach((row, y) => row.forEach((p, x) => { if (p) b.set(lx + x, y, p); }));
  }
  return b;
}

export function bakeBoards() {
  return buildSheet('boards', BRANDS.map((br) => ({ tag: br.id, frames: [{ bmp: boardBitmap(br), duration: 100 }] })), { ...BOARD, cols: 4 });
}
