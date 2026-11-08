import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NATIONS } from '../src/art/flags.js';
import { ANTHEMS, FANFARE_REASONS, anthemFor, anthemSong, anthemSeconds, barLengths, toSteps, transpose } from '../src/game/anthems.js';

test('every nation has an anthem or a fanfare, never both', () => {
  for (const n of NATIONS) {
    assert.ok(anthemFor(n.code), n.code);
    assert.notEqual(n.code in ANTHEMS, n.code in FANFARE_REASONS, `${n.code} needs exactly one of anthem / fanfare reason`);
  }
});

test('transcriptions add up: full bars, tracks the same length', () => {
  for (const n of NATIONS) {
    const a = anthemFor(n.code);
    const bar = a.beats * 4;
    for (const part of ['lead', 'bass']) {
      const bars = barLengths(a[part]);
      bars.slice(1, -1).forEach((len, i) => assert.equal(len, bar, `${n.code} ${part} bar ${i + 2} is ${len}`));
      assert.ok(bars[0] <= bar && bars.at(-1) <= bar, `${n.code} ${part} first/last bar too long`);
    }
    assert.deepEqual(barLengths(a.lead), barLengths(a.bass), `${n.code}: lead and bass bars differ`);
    const len = toSteps(a.lead).length;
    assert.ok(a.short > 0 && a.short <= len, `${n.code} short ${a.short} of ${len}`);
  }
});

test('clips are a sensible length for the podium and the line-up', () => {
  for (const n of NATIONS) {
    const full = anthemSeconds(n.code), short = anthemSeconds(n.code, { short: true });
    assert.ok(full >= 8 && full <= 28, `${n.code} podium clip ${full.toFixed(1)}s`);
    assert.ok(short >= 3 && short <= 12, `${n.code} line-up clip ${short.toFixed(1)}s`);
    const song = anthemSong(n.code);
    assert.ok(song.tracks.every((t) => t.steps.length === song.tracks[0].steps.length), n.code);
    assert.equal(anthemSong(n.code, { short: true }).tracks[0].steps.length, anthemFor(n.code).short);
  }
});

test('fanfares differ between nations and transpose cleanly', () => {
  assert.equal(transpose('C4/2 Bb3/4 | r/2', 2), 'D4/2 C4/4 | r/2');
  const fan = Object.keys(FANFARE_REASONS).map((c) => anthemFor(c).lead);
  assert.equal(new Set(fan).size, fan.length);
});
