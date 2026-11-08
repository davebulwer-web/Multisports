// The game's name, in one place. Change it here and the title logo, the
// browser tab and the stadium advertising board all follow (re-run
// `npm run export-sprites -- boards` for the board, and update the
// <title> in index.html, which is static).
//
// `name` is drawn in gold chrome, `accent` (optional, may be '') in blue
// chrome straight after it. Letters come from the 5x7 font in
// src/engine/font.js, so stick to A-Z, 0-9 and its punctuation.
// Keep this file free of DOM code: the sprite export tool imports it.
export const BRAND = {
  name: 'PODIUM',
  accent: "'88",
  tagline: 'THE ALL-ROUND SPORTS CHALLENGE',
};

/** The full name as one string, e.g. "PODIUM '88". */
export const GAME_NAME = [BRAND.name, BRAND.accent].filter(Boolean).join(' ');
