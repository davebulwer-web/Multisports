// National flags for the opening ceremony and the line-up, drawn from simple
// shape rules so they scale to any size and stay inside the palette.
// Each flag is a function (u, v) -> palette key, with u, v in [0, 1) across
// and down the cloth. No DOM code here (shared with Node tests).

const RED = 'lamp.1', WHITE = 'grey.6', NAVY = 'blue.1', BLUE = 'sky.0', GOLD = 'orange.3';
const GREEN = 'green.1', BLACK = 'grey.0', ORANGE = 'orange.2';

const vert = (...c) => (u) => c[Math.min(c.length - 1, Math.floor(u * c.length))];
const horiz = (...c) => (u, v) => c[Math.min(c.length - 1, Math.floor(v * c.length))];
/** Nordic cross: upright offset towards the hoist. */
const nordic = (field, cross, inner = null) => (u, v) => {
  const du = Math.abs(u - 0.36), dv = Math.abs(v - 0.5);
  if (inner && (du < 0.05 || dv < 0.08)) return inner;
  return du < (inner ? 0.1 : 0.07) || dv < (inner ? 0.17 : 0.12) ? cross : field;
};

// Diagonal distance in a 3:2 cloth, so saltires run corner to corner.
const diag = (u, v) => [Math.abs(v - u), Math.abs(v - (1 - u))];

export const NATIONS = [
  { code: 'GBR', name: 'GREAT BRITAIN', flag: (u, v) => {
    const du = Math.abs(u - 0.5), dv = Math.abs(v - 0.5);
    if (du < 0.06 || dv < 0.1) return RED;
    if (du < 0.11 || dv < 0.18) return WHITE;
    const [a, b] = diag(u, v);
    if (Math.min(a, b) < 0.05) return RED;
    if (Math.min(a, b) < 0.12) return WHITE;
    return NAVY;
  } },
  { code: 'USA', name: 'UNITED STATES', flag: (u, v, x, y) => {
    if (u < 0.42 && v < 0.54) return (x + y) % 2 === 0 && x % 2 === 1 ? WHITE : NAVY;
    return Math.floor(v * 13) % 2 ? WHITE : RED;
  } },
  { code: 'FRA', name: 'FRANCE', flag: vert(BLUE, WHITE, RED) },
  { code: 'GER', name: 'GERMANY', flag: horiz(BLACK, RED, GOLD) },
  { code: 'ITA', name: 'ITALY', flag: vert(GREEN, WHITE, RED) },
  { code: 'IRL', name: 'IRELAND', flag: vert(GREEN, WHITE, ORANGE) },
  { code: 'BEL', name: 'BELGIUM', flag: vert(BLACK, GOLD, RED) },
  { code: 'NED', name: 'NETHERLANDS', flag: horiz(RED, WHITE, BLUE) },
  { code: 'AUT', name: 'AUSTRIA', flag: horiz(RED, WHITE, RED) },
  { code: 'ESP', name: 'SPAIN', flag: (u, v) => (v < 0.25 || v >= 0.75 ? RED : GOLD) },
  { code: 'POL', name: 'POLAND', flag: horiz(WHITE, RED) },
  { code: 'SWE', name: 'SWEDEN', flag: nordic(BLUE, GOLD) },
  { code: 'NOR', name: 'NORWAY', flag: nordic(RED, WHITE, NAVY) },
  { code: 'FIN', name: 'FINLAND', flag: nordic(WHITE, NAVY) },
  { code: 'DEN', name: 'DENMARK', flag: nordic(RED, WHITE) },
  { code: 'SUI', name: 'SWITZERLAND', flag: (u, v) => {
    const du = Math.abs(u - 0.5) * 1.5, dv = Math.abs(v - 0.5);
    return (du < 0.09 && dv < 0.3) || (du < 0.3 && dv < 0.09) ? WHITE : RED;
  } },
  { code: 'GRE', name: 'GREECE', flag: (u, v) => {
    if (u < 0.37 && v < 0.56) return Math.abs(u - 0.185) < 0.06 || Math.abs(v - 0.28) < 0.09 ? WHITE : BLUE;
    return Math.floor(v * 9) % 2 ? WHITE : BLUE;
  } },
  { code: 'CAN', name: 'CANADA', flag: (u, v) => {
    if (u < 0.25 || u >= 0.75) return RED;
    return Math.abs(u - 0.5) * 2.4 + Math.abs(v - 0.48) < 0.32 ? RED : WHITE;
  } },
  { code: 'JPN', name: 'JAPAN', flag: (u, v) => ((u - 0.5) * 1.5) ** 2 + (v - 0.5) ** 2 < 0.09 ? RED : WHITE },
  { code: 'CHN', name: 'CHINA', flag: (u, v) => {
    const star = (cu, cv, r) => Math.abs(u - cu) * 1.5 + Math.abs(v - cv) < r;
    return star(0.17, 0.27, 0.13) || star(0.33, 0.12, 0.05) || star(0.38, 0.27, 0.05) || star(0.33, 0.42, 0.05) ? GOLD : RED;
  } },
  { code: 'BRA', name: 'BRAZIL', flag: (u, v) => {
    if (((u - 0.5) * 1.5) ** 2 + (v - 0.5) ** 2 < 0.045) return NAVY;
    return Math.abs(u - 0.5) / 0.43 + Math.abs(v - 0.5) / 0.4 < 1 ? GOLD : GREEN;
  } },
  { code: 'JAM', name: 'JAMAICA', flag: (u, v) => {
    const [a, b] = diag(u, v);
    if (Math.min(a, b) < 0.08) return GOLD;
    return (u < v && u < 1 - v) || (u > v && u > 1 - v) ? BLACK : GREEN;
  } },
  { code: 'KEN', name: 'KENYA', flag: (u, v) => {
    if (((u - 0.5) * 3.2) ** 2 + (v - 0.5) ** 2 < 0.1) return Math.abs(u - 0.5) < 0.03 ? WHITE : RED;
    if (Math.abs(v - 0.33) < 0.035 || Math.abs(v - 0.67) < 0.035) return WHITE;
    return v < 0.33 ? BLACK : v < 0.67 ? RED : GREEN;
  } },
  { code: 'AUS', name: 'AUSTRALIA', flag: (u, v, x, y) => {
    if (u < 0.5 && v < 0.5) {
      const du = Math.abs(u - 0.25), dv = Math.abs(v - 0.25);
      if (du < 0.04 || dv < 0.06) return RED;
      if (du < 0.07 || dv < 0.1) return WHITE;
      return NAVY;
    }
    const star = (cu, cv) => Math.abs(u - cu) * 1.5 + Math.abs(v - cv) < 0.07;
    return star(0.25, 0.78) || star(0.75, 0.2) || star(0.65, 0.5) || star(0.85, 0.42) || star(0.75, 0.82) ? WHITE : NAVY;
  } },
];

export const NATION_CODES = NATIONS.map((n) => n.code);
export const nationByCode = (code) => NATIONS.find((n) => n.code === code) || NATIONS[0];

/** Palette keys for a w x h flag, row by row. */
export function flagPixels(code, w, h) {
  const f = nationByCode(code).flag;
  const out = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) out.push(f((x + 0.5) / w, (y + 0.5) / h, x, y));
  return out;
}
