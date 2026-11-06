import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SprintRunner } from '../src/game/sim/sprint.js';
import { simulateThrow } from '../src/game/sim/javelin.js';
import { Balance, zone, grade, gauge, goodLift, difficulty } from '../src/game/sim/lift.js';
import { rankResults, POINTS } from '../src/game/sim/scoring.js';
import { makeRng } from '../src/game/sim/rng.js';

/** Run 100m pressing each stride `offset(i)` seconds from the ideal beat. */
function race(offset, react = 0.18) {
  const r = new SprintRunner();
  let foot = 'left', t = react, i = 0;
  r.step(foot, t);
  while (!r.finished && t < 40) {
    const target = Math.max(t + 0.01, r.nextIdeal + offset(i++));
    while (t < target && !r.finished) { t += 1 / 240; r.update(t); }
    if (r.finished) break;
    foot = foot === 'left' ? 'right' : 'left';
    r.step(foot, t);
  }
  return r;
}

test('sprint: on-beat rhythm is fast, sloppy rhythm is slower', () => {
  const perfect = race(() => 0);
  const rng = makeRng(1);
  const sloppy = race(() => (rng() * 2 - 1) * 0.12);
  assert.ok(perfect.finishTime > 9.6 && perfect.finishTime < 11, `perfect ${perfect.finishTime}`);
  assert.ok(sloppy.finishTime > perfect.finishTime + 0.5, `sloppy ${sloppy.finishTime}`);
});

test('sprint: button mashing is punished', () => {
  const r = new SprintRunner();
  let foot = 'left';
  for (let t = 0.2; t < 12; t += 0.08) {
    r.update(t);
    r.step(foot, t);
    foot = foot === 'left' ? 'right' : 'left';
  }
  assert.ok(!r.finished || r.finishTime > 14, 'mashing should not beat a steady rhythm');
  assert.ok(r.stats.early > 50);
});

test('sprint: same foot twice is a slip', () => {
  const r = new SprintRunner();
  r.step('left', 0.2);
  r.update(0.5);
  assert.equal(r.step('left', 0.5).grade, 'slip');
});

test('javelin: mid-30s beats flat and steep throws, flat throws are void', () => {
  const at = (angle) => simulateThrow({ runSpeed: 8.5, angle, plantX: -1 });
  const best = at(35);
  assert.ok(best.valid);
  assert.ok(best.distance > 75 && best.distance < 95, `best ${best.distance}`);
  assert.ok(at(55).distance < best.distance);
  assert.ok(at(20).distance < best.distance);
  assert.equal(at(8).valid, false);
});

test('javelin: run-up speed and tailwind matter', () => {
  const slow = simulateThrow({ runSpeed: 4, angle: 35, plantX: -1 });
  const fast = simulateThrow({ runSpeed: 8.5, angle: 35, plantX: -1 });
  const tail = simulateThrow({ runSpeed: 8.5, angle: 35, plantX: -1, wind: 3 });
  const head = simulateThrow({ runSpeed: 8.5, angle: 35, plantX: -1, wind: -3 });
  assert.ok(fast.distance > slow.distance + 10);
  assert.ok(tail.distance > head.distance);
});

test('lift: zones tighten with weight and grade correctly', () => {
  assert.ok(zone(220).half < zone(120).half);
  const z = zone(150);
  assert.equal(grade(z.centre, z), 1);
  assert.equal(grade(z.lo - 0.01, z), null);
  assert.ok(Math.abs(gauge(0.65, 1.3) - 1) < 1e-9);
  assert.ok(difficulty(250) > difficulty(150));
});

test('lift: balance falls without input, can be held with good steering', () => {
  const idle = new Balance(180, 0.2, makeRng(3));
  for (let i = 0; i < 180; i++) idle.update(1 / 60, 0);
  assert.ok(idle.failed, 'unattended bar should fall');

  const held = new Balance(180, 0.2, makeRng(3));
  for (let i = 0; i < 180; i++) {
    const p = held.x + held.v * 0.3;
    held.update(1 / 60, p > 0.03 ? -1 : p < -0.03 ? 1 : 0);
  }
  assert.ok(!held.failed);
  assert.ok(goodLift(held.verdict()));
});

test('scoring: points, ties and no-marks', () => {
  const r = rankResults([
    { id: 'a', value: 10.5 }, { id: 'b', value: 10.2 }, { id: 'c', value: null }, { id: 'd', value: 10.5 },
  ], 'lower');
  assert.deepEqual(r.map((e) => [e.id, e.place, e.points]), [['b', 1, 10], ['a', 2, 7], ['d', 2, 7], ['c', null, 0]]);
  assert.deepEqual(POINTS, [10, 7, 4, 2, 1]);
  const h = rankResults([{ id: 'x', value: 70 }, { id: 'y', value: 80 }], 'higher');
  assert.equal(h[0].id, 'y');
});

// ---------------------------------------------------------------------------
// Archery

import { Aim, loose, ringScore, cpuArchery, ARCHERY } from '../src/game/sim/archery.js';

/**
 * Shoot one arrow. `steer` true = a steady archer who nudges the sight back
 * onto the aim-off point (into the wind) and looses when it is close.
 */
function shootArrow(rng, wind, { steer = true, holdFor = null, drawTo = 1 } = {}) {
  const aim = new Aim(rng);
  const tx = -wind * ARCHERY.windDrift;
  let t = 0;
  for (;;) {
    let sx = 0, sy = 0;
    if (steer) {
      const ex = aim.ctrl.x - tx + aim.vel.x * 0.35, ey = aim.ctrl.y + aim.vel.y * 0.35;
      sx = Math.abs(ex) > 0.03 ? -Math.sign(ex) : 0;
      sy = Math.abs(ey) > 0.03 ? -Math.sign(ey) : 0;
    }
    aim.update(1 / 60, aim.draw < drawTo, sx, sy);
    t += 1 / 60;
    const p = aim.pos;
    if (drawTo < 1 && aim.draw >= drawTo) break;
    if (holdFor != null) { if (aim.held >= holdFor) break; continue; }
    if (aim.fullDraw && (Math.hypot(p.x - tx, p.y) < 0.06 || aim.timeUp)) break;
    if (!steer && aim.fullDraw) break;
  }
  return { ...loose(aim.pos, aim.draw, wind, rng), aim };
}

test('archery: rings score 10 in the gold down to 1 at the edge, 0 off the face', () => {
  assert.equal(ringScore(0, 0), 10);
  assert.equal(ringScore(0.05, 0.05), 10);
  assert.equal(ringScore(0.15, 0), 9);
  assert.equal(ringScore(0, -0.95), 1);
  assert.equal(ringScore(1.01, 0), 0);
});

test('archery: steadying and aiming off beats loosing as soon as the bow is drawn', () => {
  let steady = 0, snap = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const rng = makeRng(seed);
    const wind = rng() * 6 - 3;
    steady += shootArrow(rng, wind).score;
    snap += shootArrow(makeRng(seed + 1000), wind, { steer: false }).score;
  }
  assert.ok(steady / 40 > 8.5, `steady average ${steady / 40}`);
  assert.ok(snap / 40 < 5, `snap-shot average ${snap / 40}`);
});

test('archery: wind pushes the arrow downwind', () => {
  const still = loose({ x: 0, y: 0 }, 1, 0, makeRng(3));
  const gust = loose({ x: 0, y: 0 }, 1, 3, makeRng(3));
  assert.ok(gust.x - still.x > 0.2, `drift ${gust.x - still.x}`);
});

test('archery: an under-drawn arrow drops low', () => {
  const full = loose({ x: 0, y: 0 }, 1, 0, makeRng(4));
  const half = loose({ x: 0, y: 0 }, 0.5, 0, makeRng(4));
  assert.ok(half.y - full.y > 0.6, `drop ${half.y - full.y}`);
  assert.ok(half.score < full.score);
});

test('archery: holding too long makes the sight shake', () => {
  const fresh = new Aim(makeRng(5));
  const tired = new Aim(makeRng(5));
  let swayFresh = 0, swayTired = 0;
  for (let i = 0; i < 60 * 9; i++) {
    fresh.update(1 / 60, true);
    tired.update(1 / 60, true);
    if (fresh.held > 1 && fresh.held < 3) swayFresh = Math.max(swayFresh, Math.abs(fresh.sway.y));
    if (tired.held > 7) swayTired = Math.max(swayTired, Math.abs(tired.sway.y));
  }
  assert.ok(tired.shake > 2, `shake ${tired.shake}`);
  assert.ok(swayTired > swayFresh * 1.8, `fresh ${swayFresh} tired ${swayTired}`);
  for (let i = 0; i < 60 * 2; i++) tired.update(1 / 60, true);
  assert.ok(tired.timeUp);
});

test('archery: CPU totals rise with skill and stay below a perfect 60', () => {
  const avg = (skill) => {
    const rng = makeRng(9);
    let s = 0;
    for (let i = 0; i < 300; i++) s += cpuArchery(skill, rng);
    return s / 300;
  };
  const lo = avg(0.35), hi = avg(0.9);
  assert.ok(hi > lo + 4, `lo ${lo} hi ${hi}`);
  assert.ok(lo > 35 && hi < 58, `lo ${lo} hi ${hi}`);
});
