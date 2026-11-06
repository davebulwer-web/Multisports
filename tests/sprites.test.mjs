import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHEETS } from '../src/art/index.js';
import { RAMPS, recolourMap, COLORS } from '../src/art/palette.js';
import { encodePNG } from '../tools/png.mjs';

test('every sheet bakes with Aseprite-style JSON', () => {
  for (const [name, def] of Object.entries(SHEETS)) {
    const { bitmap, json } = def.bake();
    assert.equal(json.meta.size.w, bitmap.w, name);
    assert.ok(json.frames.length > 0);
    for (const t of json.meta.frameTags) {
      assert.ok(t.from <= t.to && t.to < json.frames.length, `${name}:${t.name}`);
    }
    for (const f of json.frames) assert.ok(f.frame.x + f.frame.w <= bitmap.w && f.frame.y + f.frame.h <= bitmap.h);
  }
});

test('athlete sheet has the animations the events use', () => {
  const { json } = SHEETS.athlete.bake();
  const tags = json.meta.frameTags.map((t) => t.name);
  for (const t of ['idle', 'set', 'run', 'stumble', 'jog', 'jav_run', 'jav_throw', 'arch_draw', 'arch_hold', 'arch_loose', 'lift_ready', 'lift_pull', 'lift_rack',
    'lift_dip', 'lift_jerk', 'lift_hold', 'lift_wobble_l', 'lift_wobble_r', 'lift_drop', 'celebrate', 'dejected']) {
    assert.ok(tags.includes(t), `missing ${t}`);
  }
  assert.ok(json.meta.multisports.anchors[0].handF);
});

test('sprites only use palette colours', () => {
  const pal = new Set(COLORS.slice(1).map((h) => h.toLowerCase()));
  const { bitmap } = SHEETS.athlete.bake();
  for (const c of bitmap.data) if (c) assert.ok(pal.has(COLORS[c].toLowerCase()));
});

test('recolour key colours are unique to the key ramps', () => {
  const keys = ['kitA', 'kitB', 'skin', 'hair'].flatMap((k) => RAMPS[k]);
  const others = Object.entries(RAMPS).filter(([k]) => !['kitA', 'kitB', 'skin', 'hair'].includes(k)).flatMap(([, v]) => v);
  for (const k of keys) assert.ok(!others.includes(k), `${k} clashes with a non-key colour`);
  assert.equal(recolourMap(0, 0).size, keys.length);
});

test('png encoder writes a valid signature and IHDR', () => {
  const png = encodePNG(2, 1, new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.readUInt32BE(16), 2);
  assert.equal(png.readUInt32BE(20), 1);
});

test('committed assets match their JSON', () => {
  for (const name of Object.keys(SHEETS)) {
    const json = JSON.parse(readFileSync(new URL(`../assets/sprites/${name}.json`, import.meta.url)));
    const png = readFileSync(new URL(`../assets/sprites/${name}.png`, import.meta.url));
    assert.equal(png.readUInt32BE(16), json.meta.size.w);
    assert.equal(png.readUInt32BE(20), json.meta.size.h);
  }
});
