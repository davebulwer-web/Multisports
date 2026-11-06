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

// ---------------------------------------------------------------------------
// Clay pigeon

import { Clay, Sight, shotTo, breaks, cpuClay, totalClays } from '../src/game/sim/clay.js';

/** Track one clay with the sight and fire once. `lead` = aim where the clay will be when the shot arrives. */
function shootClay(seed, lead) {
  const rng = makeRng(seed);
  const clay = new Clay(rng, rng() < 0.5 ? 'left' : 'right');
  const s = new Sight(200, 150);
  const dt = 1 / 60;
  let shot = null;
  for (let t = 0; t < 6; t += dt) {
    clay.update(dt);
    if (shot && (shot.t -= dt) <= 0) return clay.state === 'flying' && breaks(shot.x, shot.y, shot.r, clay.x, clay.y);
    if (clay.state !== 'flying') return false;
    const p = lead ? clay.predict(shotTo(clay.x, clay.y).delay) : { x: clay.x, y: clay.y };
    const ex = p.x - s.x + (clay.vx - s.vx) * 0.12, ey = p.y - s.y + (clay.vy - s.vy) * 0.12;
    s.update(dt, Math.abs(ex) > 1 ? Math.sign(ex) : 0, Math.abs(ey) > 1 ? Math.sign(ey) : 0);
    if (!shot && clay.t > 0.5 && Math.hypot(p.x - s.x, p.y - s.y) < 2) {
      const { delay, radius } = shotTo(s.x, s.y);
      shot = { x: s.x, y: s.y, r: radius, t: delay };
    }
  }
  return false;
}

test('clay: leading the clay breaks it, aiming straight at it misses', () => {
  let lead = 0, direct = 0;
  for (let seed = 1; seed <= 60; seed++) {
    if (shootClay(seed, true)) lead++;
    if (shootClay(seed, false)) direct++;
  }
  assert.ok(lead >= 54, `with lead ${lead}/60`);
  assert.ok(direct <= 12, `no lead ${direct}/60`);
});

test('clay: further clays need more lead and get a wider pattern', () => {
  const near = shotTo(120, 150), far = shotTo(340, 40);
  assert.ok(far.delay > near.delay * 2, `${near.delay} vs ${far.delay}`);
  assert.ok(far.radius > near.radius);
});

test('clay: clays fly up and across from their trap, then land or leave', () => {
  const rng = makeRng(7);
  for (const side of ['left', 'right']) {
    const c = new Clay(rng, side);
    const x0 = c.x;
    let top = c.y;
    for (let i = 0; i < 60 * 8 && c.state === 'flying'; i++) { c.update(1 / 60); top = Math.min(top, c.y); }
    assert.equal(c.state, 'lost');
    assert.ok(top < 150, `apex ${top}`); // well above the trap houses
    assert.ok(side === 'left' ? c.x > x0 : c.x < x0);
  }
});

test('clay: the sight has momentum and a top swing speed', () => {
  const s = new Sight(40, 100);
  s.update(1 / 60, 1, 0);
  assert.ok(s.vx > 0 && s.vx < 40, 'it takes time to get the swing going');
  for (let i = 0; i < 30; i++) s.update(1 / 60, 1, 0);
  assert.ok(s.vx <= 280);
  const x = s.x;
  s.update(1 / 60, 0, 0);
  assert.ok(s.x > x, 'it keeps moving briefly after you let go');
});

test('clay: CPU hits rise with skill and stay within the round', () => {
  const avg = (skill) => {
    const rng = makeRng(11);
    let s = 0;
    for (let i = 0; i < 300; i++) s += cpuClay(skill, rng);
    return s / 300;
  };
  assert.equal(totalClays(), 12);
  const lo = avg(0.35), hi = avg(0.9);
  assert.ok(hi > lo + 2 && hi < 12 && lo > 4, `lo ${lo} hi ${hi}`);
});

// Ski jump
import { SkiJumper, INRUN, slopeAt, scoreJump, styleMarks, distancePoints, takeoffQuality, cpuSki, SKI } from '../src/game/sim/ski.js';

/**
 * Play one jump. `offset` = take-off press relative to the lip (s, - = early),
 * null for no press. `react` = steering reaction delay (s), null = no steering.
 * `lead` = telemark press this long before touchdown, null for none.
 */
function skiJump(seed, { offset = 0, tuck = true, react = 0.15, lead = 0.25, wind = 0 } = {}) {
  const j = new SkiJumper(makeRng(seed), wind);
  const dt = 1 / 60;
  j.start();
  while (j.phase === 'inrun') {
    const toLip = (INRUN.length - j.s) / j.v;
    if (offset != null && offset <= 0 && toLip <= -offset + dt) j.jump(j.t + toLip + offset);
    j.update(dt, { tuck });
  }
  const seen = [];
  for (let n = 0; j.phase === 'air' && n < 1200; n++) {
    if (offset != null && offset > 0 && j.t - j.lipT >= offset) j.jump(j.t);
    seen.push(j.lean + j.leanV * 0.25);
    const e = react == null ? 0 : seen[Math.max(0, seen.length - 1 - Math.round(react / dt))];
    const close = -j.vy - j.vx * Math.tan(slopeAt(j.x));
    if (lead != null && j.takeoff && close > 0 && j.height / close < lead) j.telemark();
    j.update(dt, { lean: e > 3 ? -1 : e < -3 ? 1 : 0 });
  }
  return j.result;
}

test('ski jump: a clean jump lands around the hill size with a telemark', () => {
  const r = skiJump(1);
  assert.ok(r.distance > 125 && r.distance <= SKI.HS + 2, `distance ${r.distance}`);
  assert.equal(r.landing, 'telemark');
});

test('ski jump: take-off timing matters', () => {
  const good = skiJump(2).distance;
  const late = skiJump(2, { offset: 0.12 }).distance;
  const early = skiJump(2, { offset: -0.12 }).distance;
  const none = skiJump(2, { offset: null }).distance;
  assert.ok(good > late + 6 && good > early + 6, `good ${good} late ${late} early ${early}`);
  assert.ok(none < good - 20, `no spring ${none}`);
  assert.equal(takeoffQuality(0), 1);
  assert.equal(takeoffQuality(-0.5), 0);
});

test('ski jump: tucking on the inrun carries more speed', () => {
  assert.ok(skiJump(3).distance > skiJump(3, { tuck: false }).distance + 8);
});

test('ski jump: no steering in the air ends in a fall', () => {
  for (const seed of [4, 5, 6]) assert.equal(skiJump(seed, { react: null }).landing, 'fall', `seed ${seed}`);
});

test('ski jump: telemark too early costs distance and style', () => {
  const good = skiJump(7);
  const early = skiJump(7, { lead: 1.6 });
  const none = skiJump(7, { lead: null });
  assert.ok(early.distance < good.distance - 3, `${early.distance} vs ${good.distance}`);
  assert.equal(none.landing, 'feet');
  const rng = makeRng(1);
  assert.ok(scoreJump(good, rng).style.total > scoreJump(none, rng).style.total);
});

test('ski jump: scoring', () => {
  assert.equal(distancePoints(SKI.K), 60);
  assert.equal(distancePoints(SKI.K + 10), 78);
  assert.equal(distancePoints(10), 0);
  const s = styleMarks({ steadiness: 0, landing: 'telemark' }, makeRng(3));
  assert.equal(s.marks.length, 5);
  assert.ok(s.total <= 60 && s.total >= 55);
  const f = styleMarks({ steadiness: 10, landing: 'fall' }, makeRng(3));
  assert.ok(f.total < 33);
});

test('ski jump: CPU totals scale with skill', () => {
  const avg = (skill) => { const rng = makeRng(11); let t = 0; for (let i = 0; i < 200; i++) t += cpuSki(skill, rng); return t / 200; };
  const lo = avg(0.3), hi = avg(0.9);
  assert.ok(hi > lo + 40, `${lo} vs ${hi}`);
  assert.ok(hi < 300, `cpu ${hi}`);
});

// Biathlon
import { Skier, RifleSight, BIATHLON, cpuBiathlon, fmtRace } from '../src/game/sim/biathlon.js';

function skiLeg(push, len = BIATHLON.legs[0]) {
  const s = new Skier();
  let t = 0;
  while (s.d < len && t < 200) { s.update(1 / 60, push(s)); t += 1 / 60; }
  return t;
}

test('biathlon: pacing below the redline beats flat out and cruising', () => {
  const paced = skiLeg((s) => s.hr < BIATHLON.burn.redline - 4);
  const flatOut = skiLeg(() => true);
  const cruise = skiLeg(() => false);
  assert.ok(paced < flatOut - 2, `paced ${paced} flat out ${flatOut}`);
  assert.ok(paced < cruise - 3, `paced ${paced} cruise ${cruise}`);
});

/** Shoot 5 at a fixed heart rate, firing as soon as the sight is within `loose` x the hit radius. */
function shoot(kind, hr, loose, seed) {
  const rng = makeRng(seed), r = new RifleSight(kind, rng);
  let hits = 0, since = 0;
  for (let t = 0; r.target < 5 && t < 60; t += 1 / 60) {
    const cx = r.target * BIATHLON.sight.spacing;
    const ex = cx - r.aimX, ey = -r.aimY;
    r.update(1 / 60, hr, Math.abs(ex) > 1.5 ? Math.sign(ex) : 0, Math.abs(ey) > 1.5 ? Math.sign(ey) : 0);
    since += 1 / 60;
    const p = r.pos(hr);
    if (since > 0.5 && Math.hypot(p.x - cx, p.y) < r.k.hit * loose) { if (r.fire(hr).hit) hits++; since = 0; }
  }
  return hits;
}

test('biathlon: a racing heart makes hasty shots miss', () => {
  let calm = 0, racing = 0;
  for (let i = 0; i < 30; i++) { calm += shoot('prone', 110, 1.2, i); racing += shoot('prone', 185, 1.2, i); }
  assert.ok(calm > racing + 15, `calm ${calm} racing ${racing}`);
});

test('biathlon: the heart rate settles at the range', () => {
  const s = new Skier();
  s.hr = 180;
  for (let t = 0; t < 5; t += 1 / 60) s.rest(1 / 60);
  assert.ok(s.hr < 145, `${s.hr}`);
});

test('biathlon: CPU times and formatting', () => {
  const rng = makeRng(2);
  const avg = (sk) => { let t = 0; for (let i = 0; i < 100; i++) t += cpuBiathlon(sk, rng); return t / 100; };
  assert.ok(avg(0.9) < avg(0.3) - 20);
  assert.equal(fmtRace(65.25), '1:05.3');
  assert.equal(fmtRace(null), '--');
});
