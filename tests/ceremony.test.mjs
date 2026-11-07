import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NATIONS, flagPixels, nationByCode } from '../src/art/flags.js';
import { INDEX } from '../src/art/palette.js';
import { TORCHLIGHT_MARCH, parseSteps } from '../src/game/music.js';
import { SHEETS } from '../src/art/index.js';

test('every nation has a unique code and a palette-only flag', () => {
  assert.equal(new Set(NATIONS.map((n) => n.code)).size, NATIONS.length);
  for (const n of NATIONS) {
    const px = flagPixels(n.code, 18, 12);
    assert.equal(px.length, 18 * 12);
    for (const k of px) assert.ok(k in INDEX, `${n.code}: ${k}`);
    assert.ok(new Set(px).size > 1, `${n.code} is a single colour`);
  }
  assert.equal(nationByCode('nope').code, NATIONS[0].code);
});

test('ceremony tune: tracks line up and notes parse', () => {
  assert.deepEqual(parseSteps('C4 - . k'), [60, null, 0, 'k']);
  const lens = TORCHLIGHT_MARCH.tracks.map((t) => t.steps.length);
  assert.ok(lens.every((l) => l === 128), `track lengths ${lens}`);
});

test('ceremony sprites exist', () => {
  const tags = (s) => SHEETS[s].bake().json.meta.frameTags.map((t) => t.name);
  for (const t of ['torch_run', 'torch_raise', 'march', 'wave']) assert.ok(tags('athlete').includes(t), t);
  for (const t of ['torch', 'dove']) assert.ok(tags('props').includes(t), t);
  assert.ok(tags('scenery').includes('cauldron'));
});
