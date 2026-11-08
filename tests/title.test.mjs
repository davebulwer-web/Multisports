import test from 'node:test';
import assert from 'node:assert/strict';
import { PODIUM_THEME } from '../src/game/music.js';
import { BRAND, GAME_NAME } from '../src/game/brand.js';
import { GLYPHS } from '../src/engine/font.js';

test('title theme tracks all last 16 bars', () => {
  for (const t of PODIUM_THEME.tracks) assert.equal(t.steps.length, 16 * 8);
});

test('the game name only uses letters the font can draw', () => {
  for (const ch of `${BRAND.name}${BRAND.accent}${BRAND.tagline}`) assert.ok(GLYPHS[ch.toUpperCase()], `missing glyph ${ch}`);
  assert.equal(GAME_NAME, "PODIUM '88");
});
