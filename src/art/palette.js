// Multisports master palette.
//
// The 16 colours of the classic 8-bit home computer palette are kept as the
// "anchor" of each ramp, then each hue is extended with darker and lighter
// steps so sprites can carry shading, highlights and outlines while still
// reading as chunky 8-bit art.
//
// Every sprite and background is drawn ONLY with these colours. Sprite PNGs
// are plain RGBA, but kit/skin recolouring works by exact colour match on the
// "key" ramps below, so keep those exact RGB values when editing art.
//
// This file must stay free of DOM code: it is shared by the browser game and
// the Node export tool (tools/export-sprites.mjs).

export const RAMPS = {
  // name: [darkest ... lightest]
  grey:   ['#000000', '#1c1a22', '#444444', '#6c6c6c', '#959595', '#c4c4c4', '#ffffff'],
  red:    ['#3a1a14', '#68372b', '#9a6759', '#c99a8c'],
  cyan:   ['#2f5a66', '#70a4b2', '#a6d4dd'],
  purple: ['#3a1f4a', '#6f3d86', '#a072b8'],
  green:  ['#24401c', '#588d43', '#9ad284', '#cdeec0'],
  blue:   ['#1b1446', '#352879', '#6c5eb5', '#a399e6'],
  yellow: ['#7d8a3c', '#b8c76f', '#e6ef9f'],
  orange: ['#43280f', '#6f4f25', '#a37a3e', '#d9a95e'],
  brown:  ['#221d00', '#433900', '#6b5d1a'],
  sky:    ['#3d6aa8', '#5e8ed0', '#8fb6e8', '#c6dcf5'],
  track:  ['#6e2a1e', '#9c4128', '#c25a35'],
  grass:  ['#1f5a26', '#2f7a33', '#46a043', '#7cc76a'],
  lamp:   ['#801010', '#d83030', '#ff8a7a'],              // signal red (lights, false start)

  // ---- Recolour key ramps (athlete sheet only) ----
  // These exact colours are replaced per player at load time.
  kitA:   ['#7a1030', '#c0204a', '#f05a78'], // vest: shade, base, highlight
  kitB:   ['#103a7a', '#2060c0', '#5a90f0'], // shorts: shade, base, highlight
  skin:   ['#8a4a2a', '#c07850', '#e8a878'], // skin: shade, base, highlight
  hair:   ['#2a1608', '#50301a'],            // hair: shade, base
};

// Flat list of every palette colour (index 0 is reserved for "transparent").
export const COLORS = [null];
export const INDEX = {}; // 'red.1' -> palette index
export const NAME_OF = [null];
for (const [ramp, list] of Object.entries(RAMPS)) {
  list.forEach((hex, i) => {
    const key = `${ramp}.${i}`;
    INDEX[key] = COLORS.length;
    NAME_OF.push(key);
    COLORS.push(hex);
  });
}

/** Palette index for 'ramp.step'. Throws on typos so art bugs fail loudly. */
export function C(key) {
  const i = INDEX[key];
  if (i === undefined) throw new Error(`Unknown palette colour ${key}`);
  return i;
}

/** One step lighter / darker in the same ramp (clamped). */
export function shift(idx, delta) {
  const name = NAME_OF[idx];
  if (!name) return idx;
  const [ramp, step] = name.split('.');
  const list = RAMPS[ramp];
  const s = Math.max(0, Math.min(list.length - 1, Number(step) + delta));
  return INDEX[`${ramp}.${s}`];
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---- Player customisation -------------------------------------------------

// Each kit maps the kitA (vest) and kitB (shorts) key ramps to palette ramps.
export const KITS = [
  { name: 'Crimson', vest: ['red.1', 'red.2', 'red.3'],       shorts: ['grey.1', 'grey.2', 'grey.3'] },
  { name: 'Royal',   vest: ['blue.1', 'blue.2', 'blue.3'],    shorts: ['grey.4', 'grey.5', 'grey.6'] },
  { name: 'Meadow',  vest: ['green.0', 'green.1', 'green.2'], shorts: ['grey.5', 'grey.6', 'grey.6'] },
  { name: 'Sunburst',vest: ['yellow.0', 'yellow.1', 'yellow.2'], shorts: ['blue.0', 'blue.1', 'blue.2'] },
  { name: 'Violet',  vest: ['purple.0', 'purple.1', 'purple.2'], shorts: ['grey.1', 'grey.2', 'grey.3'] },
  { name: 'Lagoon',  vest: ['cyan.0', 'cyan.1', 'cyan.2'],    shorts: ['blue.0', 'blue.1', 'blue.2'] },
  { name: 'Ember',   vest: ['orange.1', 'orange.2', 'orange.3'], shorts: ['brown.0', 'brown.1', 'brown.2'] },
  { name: 'Snow',    vest: ['grey.4', 'grey.5', 'grey.6'],    shorts: ['red.0', 'red.1', 'red.2'] },
];

export const SKINS = [
  { name: 'Light',  skin: ['red.2', 'red.3', 'grey.6'],          hair: ['orange.1', 'orange.3'] },
  { name: 'Fair',   skin: ['skin.0', 'skin.1', 'skin.2'],        hair: ['hair.0', 'hair.1'] },
  { name: 'Tan',    skin: ['orange.1', 'orange.2', 'orange.3'],  hair: ['grey.1', 'grey.2'] },
  { name: 'Deep',   skin: ['orange.0', 'orange.1', 'orange.2'],  hair: ['grey.0', 'grey.1'] },
  { name: 'Blond',  skin: ['skin.0', 'skin.1', 'skin.2'],        hair: ['yellow.0', 'yellow.2'] },
];

/** Build an RGB->RGB replacement map for a kit + skin choice. */
export function recolourMap(kitIdx, skinIdx) {
  const kit = KITS[kitIdx % KITS.length];
  const sk = SKINS[skinIdx % SKINS.length];
  const map = new Map();
  const add = (keyRamp, targets) =>
    RAMPS[keyRamp].forEach((hex, i) => map.set(hex, COLORS[C(targets[i])]));
  add('kitA', kit.vest);
  add('kitB', kit.shorts);
  add('skin', sk.skin);
  add('hair', sk.hair);
  return map;
}
