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

// Curling
import { CURL, Stone, deliver, settle, scoreEnd, ringPoints, setupEnd, cpuCurling, maxScore } from '../src/game/sim/curling.js';

/** Weight that draws an unswept stone closest to the tee with the given aim/turn. */
function drawWeight(aim, turn) {
  let best = null;
  for (let w = 0; w <= 1; w += 0.005) {
    const s = settle([deliver(w, aim, turn)])[0];
    if (!s.out && (!best || s.dist < best.d)) best = { w, d: s.dist };
  }
  return best;
}

test('curling: the right weight and line draw to the button', () => {
  const b = drawWeight(-1.0, 1);
  assert.ok(b.d < 0.3, `closest ${b.d}`);
  assert.ok(b.w > 0.2 && b.w < 0.45, `draw weight ${b.w}`);
});

test('curling: the stone curls with the turn', () => {
  const up = settle([deliver(0.3, 0, -1)])[0], down = settle([deliver(0.3, 0, 1)])[0];
  assert.ok(up.y < -0.4 && down.y > 0.4, `${up.y} ${down.y}`);
});

test('curling: sweeping carries the stone further and straighter', () => {
  const plain = settle([deliver(0.25, 0, 1)])[0];
  const swept = settle([deliver(0.25, 0, 1)], () => true)[0];
  assert.ok(swept.x > plain.x + 1.5, `${plain.x} vs ${swept.x}`);
  assert.ok(Math.abs(swept.y) < Math.abs(plain.y), 'sweeping straightens it');
});

test('curling: light stones are hogged, heavy ones go through', () => {
  assert.ok(settle([deliver(0, 0, 1)])[0].out);
  assert.ok(settle([deliver(1, 0, 1)])[0].out);
});

test('curling: a takeout knocks the opposition stone out', () => {
  const stones = setupEnd(2); // stone on the button
  stones.push(deliver(1, 0.05, 1));
  settle(stones);
  assert.ok(stones[0].out || stones[0].dist > 1.83, 'their stone should be removed from the house');
});

test('curling: only stones closer than all of theirs score', () => {
  const mine = (x, y) => new Stone(x, y, 'me');
  const theirs = new Stone(CURL.tee + 0.5, 0, 'them');
  const r = scoreEnd([mine(CURL.tee, 0.05), mine(CURL.tee + 1.0, 0), theirs]);
  assert.equal(r.points, 4); // only the button stone counts
  assert.equal(scoreEnd([mine(CURL.tee + 1.0, 0)]).points, 2);
  assert.equal(ringPoints(3), 0);
  assert.equal(maxScore(), 32);
});

test('curling: CPU scores scale with skill', () => {
  const rng = makeRng(5);
  const avg = (sk) => { let t = 0; for (let i = 0; i < 200; i++) t += cpuCurling(sk, rng); return t / 200; };
  assert.ok(avg(0.9) > avg(0.3) + 8);
});

import { Caber, CABER, tossResult, tossPoints, fmtClock, cpuCaber } from '../src/game/sim/caber.js';

/** Run with the caber: balance on `target` lean, ease off near the end and toss at 13°. */
function caberRun(seed, { balance = true, toss = true } = {}) {
  const c = new Caber(makeRng(seed));
  let tipping = false;
  while (!c.dropped && c.t < 20 && c.x < CABER.runway) {
    if (c.x > CABER.runway - 4) tipping = true;
    if (toss && tipping && c.pitch > 13) return { c, r: c.toss() };
    const steer = balance ? -Math.sign(c.roll + 0.5 * c.rollV) * (Math.abs(c.roll + 0.5 * c.rollV) > 1 ? 1 : 0) : 0;
    c.update(1 / 60, { run: balance ? !tipping && c.pitch + 0.35 * c.pitchV > 5 : true, steer });
  }
  return { c, r: null };
}

test('caber: balancing by running and tossing in the zone lands near 12 o\'clock', () => {
  for (let s = 1; s <= 5; s++) {
    const { c, r } = caberRun(s);
    assert.equal(c.dropped, null);
    assert.ok(r.turned && r.points >= 80, `seed ${s}: ${JSON.stringify(r)}`);
  }
});

test('caber: running flat out tips it back, standing still lets it fall forward', () => {
  assert.equal(caberRun(1, { balance: false }).c.dropped, 'BACK');
  const c = new Caber(makeRng(2));
  while (!c.dropped && c.t < 10) c.update(1 / 60, { run: false });
  assert.equal(c.dropped, 'FORWARD');
});

test('caber: slow or leaning-back tosses do not turn; sideways lean costs points', () => {
  const rng = makeRng(4);
  assert.equal(tossResult({ v: 2, pitch: 10 }, rng).turned, false);
  assert.equal(tossResult({ v: 5, pitch: -10 }, rng).turned, false);
  const straight = tossResult({ v: 5, pitch: 14, roll: 0 }, makeRng(5));
  const leaning = tossResult({ v: 5, pitch: 14, roll: 12 }, makeRng(5));
  assert.ok(straight.points > leaning.points);
});

test('caber: clock face scoring', () => {
  assert.equal(fmtClock(0), '12:00');
  assert.equal(fmtClock(-15), '11:45');
  assert.equal(fmtClock(70), '1:10');
  assert.equal(tossPoints(0), 100);
  assert.equal(tossPoints(-180), 0);
  const rng = makeRng(6);
  const avg = (sk) => { let t = 0; for (let i = 0; i < 200; i++) t += cpuCaber(sk, rng); return t / 200; };
  assert.ok(avg(0.9) > avg(0.3) + 40);
  assert.ok(avg(1) <= 300);
});

import { DIVE, Diver, flightTime, judge, entryWord, cpuDive } from '../src/game/sim/dive.js';

/** One dive: hold the position from take-off until `openAt` seconds before the water. */
function dive(id, { openLead = DIVE.openLead, q = 1, arms = false, tuck = true } = {}) {
  const d = new Diver(DIVE.dives.find((x) => x.id === id));
  d.takeoff(q);
  const T = flightTime(q);
  while (d.phase === 'air') d.update(1 / 120, { tuck: tuck && d.t < T - openLead, arms });
  return d.result;
}

test('cliff diving: opening out at the right time enters upright for every dive', () => {
  for (const dv of DIVE.dives) {
    const r = dive(dv.id);
    assert.ok(Math.abs(r.error) < 10, `${dv.id}: ${r.error}`);
    assert.ok(['RIP ENTRY', 'CLEAN'].includes(entryWord(r)));
  }
});

test('cliff diving: opening late over-rotates, early is short, arms out slow the spin', () => {
  const late = dive('b3t', { openLead: 0.6 }), early = dive('b3t', { openLead: 0.9 });
  assert.ok(late.error > 30 && early.error < -30);
  assert.ok(Math.abs(dive('b3t', { openLead: 0.6, arms: true }).error) < Math.abs(late.error));
  assert.ok(dive('f2p', { tuck: false }).error < -135, 'never pulling in fails the dive');
});

test('cliff diving: judges reward clean entries and multiply by DD', () => {
  const rng = makeRng(3);
  const clean = judge({ error: 2, q: 1, openT: 0.6, tucked: false, breaks: 0 }, 3, rng);
  const slap = judge({ error: 80, q: 1, openT: 0.6, tucked: false, breaks: 0 }, 3, rng);
  const failed = judge({ error: 200, q: 1, openT: 0.6, tucked: false, breaks: 0 }, 3, rng);
  assert.ok(clean.sum >= 27 && Math.abs(clean.points - clean.sum * 3) < 0.11);
  assert.ok(slap.sum <= 7.5);
  assert.equal(failed.points, 0);
  const avg = (sk) => { let t = 0; for (let i = 0; i < 100; i++) t += cpuDive(sk, rng); return t / 100; };
  assert.ok(avg(0.9) > avg(0.3) + 60);
});

// ---- Beach events -----------------------------------------------------------
import { Footbag, FOOTBAG, playFootbag, varietyMult, stringMult } from '../src/game/sim/footbag.js';

test('footbag: a clean kick at the contact height pops it straight up, a stretch sends it wide', () => {
  const fb = new Footbag(makeRng(1));
  Object.assign(fb.bag, { x: 0, h: FOOTBAG.surfaces.knee.h, vx: 0, vy: -3 });
  const [k] = fb.update(1e-6, { kick: 'knee' });
  assert.equal(k.type, 'kick');
  assert.equal(k.grade, 'PERFECT');
  assert.ok(Math.abs(fb.bag.vx) < 0.1 && fb.bag.vy > 4);
  const wide = new Footbag(makeRng(1));
  Object.assign(wide.bag, { x: 0.24, h: FOOTBAG.surfaces.knee.h + 0.1, vx: 0, vy: -3 });
  const [w] = wide.update(1e-6, { kick: 'knee' });
  assert.equal(w.type, 'kick');
  assert.ok(Math.abs(wide.bag.vx) > 0.6);
});

test('footbag: whiffs leave you off balance, so mashing drops the bag', () => {
  const fb = new Footbag(makeRng(2));
  let drops = 0;
  for (let i = 0; i < 600; i++) {
    for (const e of fb.update(1 / 60, { kick: ['toe', 'knee', 'head'][i % 3] })) if (e.type === 'drop') drops++;
  }
  assert.ok(drops >= 3, `mashing dropped it ${drops} times`);
  assert.ok(fb.score < playFootbag(0.8, makeRng(2)).score / 3);
});

test('footbag: mixing surfaces and long strings multiply the score; skill beats no skill', () => {
  assert.equal(varietyMult(['toe', 'toe', 'toe']), 1);
  assert.equal(varietyMult(['toe', 'knee', 'head']), 2);
  assert.ok(stringMult(30) === 3 && stringMult(0) === 1);
  const avg = (s) => [1, 2, 3, 4].reduce((a, k) => a + playFootbag(s, makeRng(k)).score, 0) / 4;
  const lo = avg(0.1), hi = avg(1);
  assert.ok(hi > lo * 1.8, `lo ${lo} hi ${hi}`);
  assert.ok(hi < 1600, `bot shouldn't beat the record by much: ${hi}`);
});

test('footbag: a spin followed by a clean kick scores the spin bonus', () => {
  const fb = new Footbag(makeRng(3));
  Object.assign(fb.bag, { x: 0, h: 0.22, vx: 0, vy: -1 });
  fb.update(1e-6, { kick: 'toe' });
  fb.update(FOOTBAG.kickPose + 0.01, {});
  fb.update(1 / 60, { spin: true });
  let ev = [];
  for (let i = 0; i < 300 && !ev.some((e) => e.type === 'kick'); i++) {
    const b = fb.bag;
    const kick = !fb.spinning && b.vy < 0 && b.h <= FOOTBAG.surfaces.knee.h ? 'knee' : null;
    ev = fb.update(1 / 60, { kick, move: (b.x - fb.px) * 5 });
  }
  const k = ev.find((e) => e.type === 'kick');
  assert.ok(k && k.spun, JSON.stringify(ev));
});

import { Surfer, SURF, steepness, cpuSurf, playSurf } from '../src/game/sim/surf.js';

test('surfing: the push fades on the shoulder', () => {
  assert.equal(steepness(2), 1);
  assert.ok(steepness(20) < 0.6);
  assert.equal(steepness(100), SURF.fade);
});

test('surfing: S-turns survive the wave and score turns; sitting still gets caught', () => {
  const { rides } = playSurf(1, makeRng(5));
  for (const r of rides) {
    assert.equal(r.wipeout, null);
    assert.ok(r.moves.some((m) => m.move === 'bottom'));
    assert.ok(r.score > 100, `score ${r.score}`);
  }
  const lazy = new Surfer(makeRng(1));
  lazy.heading = 90;
  while (!lazy.done) lazy.update(1 / 60, { dx: 0, dy: 1 });
  assert.ok(lazy.wipeout, 'pointing at the lip all ride should end in a wipeout');
});

test('surfing: letting the curl catch you mid-face is a tube ride', () => {
  const t = new Surfer(makeRng(2));
  Object.assign(t, { x: 0.2, y: 1.6, v: 1, heading: 0 });
  const ev = [];
  while (!t.done && t.t < 6) ev.push(...t.update(1 / 60, { dx: 1, dy: 1.6 - t.y }));
  const tube = ev.find((e) => e.move === 'tube');
  assert.ok(tube && tube.secs > 0.3, JSON.stringify(ev));
});

test('surfing: repeated manoeuvres are worth less; airs must land facing down', () => {
  const s = new Surfer(makeRng(1));
  const a = s.award('bottom', 10), b = s.award('bottom', 10);
  assert.ok(b.pts < a.pts);
  const air = new Surfer(makeRng(1));
  Object.assign(air, { y: SURF.face, heading: 60, air: { vy: 2, rot: 0, h0: 60, peak: 0.3 } });
  let ev = [];
  while (!air.done && air.air) ev = air.update(1 / 60, {});
  assert.equal(air.wipeout, 'LANDED FLAT');
  for (let k = 0; k < 20; k++) {
    const r = cpuSurf(0.8, makeRng(k));
    assert.ok(r >= 0 && r < 700);
  }
});

import { Skater, PIPE, surface, geom, playPipe, airName } from '../src/game/sim/halfpipe.js';

test('half-pipe: the ramp profile is continuous from the flat to the coping', () => {
  const { sMax, hc } = geom();
  let prev = surface(0);
  for (let s = 0.05; s <= sMax; s += 0.05) {
    const p = surface(s);
    assert.ok(Math.hypot(p.x - prev.x, p.h - prev.h) < 0.06);
    prev = p;
  }
  assert.ok(Math.abs(surface(sMax).h - hc) < 1e-9);
});

test('half-pipe: good pumping builds big airs, no pumping dies away', () => {
  const lazy = new Skater(makeRng(1));
  let airs = 0;
  while (!lazy.over) if (lazy.update(1 / 60, {}).some((e) => e.type === 'launch')) airs++;
  assert.equal(airs, 0, 'no pumps: never clears the coping');
  const pro = playPipe(1, makeRng(2)).runs[0];
  assert.ok(pro.tricks.length >= 8);
  assert.ok(Math.max(...pro.tricks.map((t) => t.height)) > 1.5);
  assert.ok(playPipe(1, makeRng(3)).total > playPipe(0.1, makeRng(3)).total * 2);
});

test('half-pipe: land sideways or still grabbing and you slam', () => {
  const jump = (spin, grabAll) => {
    const sk = new Skater(makeRng(1));
    sk.s = geom().sMax - 0.01; sk.u = 5;
    const ev = [];
    for (let i = 0; i < 200 && !ev.some((e) => e.type === 'land' || e.type === 'slam'); i++) {
      const air = sk.air;
      ev.push(...sk.update(1 / 60, { spin: air && Math.abs(air.rot) < spin ? 1 : 0, grab: grabAll && !!air }));
    }
    return ev.find((e) => e.type === 'land' || e.type === 'slam');
  };
  assert.equal(jump(180, false).type, 'land');
  assert.equal(jump(180, false).name, '180');
  assert.equal(jump(90, false).type, 'slam');
  assert.equal(jump(180, true).why, 'STILL GRABBING');
  assert.equal(airName(3, true), '540 GRAB');
});

// ---- pole vault -----------------------------------------------------------
import { VAULT, VaultComp, vaultResult, runStep, cpuVault } from '../src/game/sim/vault.js';

test('pole vault: the right speed for the pole and clean timing go highest', () => {
  const good = vaultResult({ speed: 9.3, pole: 2, takeoffErr: 0, rockErr: 0, pushErr: 0 });
  assert.ok(good.peak > 5.5 && good.peak < 6.3, `peak ${good.peak}`);
  const tooFast = vaultResult({ speed: 10.3, pole: 2, takeoffErr: 0, rockErr: 0, pushErr: 0 });
  assert.ok(tooFast.peak < good.peak, 'over-bending the pole wastes energy');
  const soft = vaultResult({ speed: 7.4, pole: 0, takeoffErr: 0, rockErr: 0, pushErr: 0 });
  assert.ok(soft.peak < good.peak && soft.peak > 3.8);
  assert.equal(vaultResult({ speed: 7.4, pole: 2, takeoffErr: 0 }).fail, 'POLE WON\'T BEND');
  const late = vaultResult({ speed: 9.3, pole: 2, takeoffErr: 0, rockErr: 0.3, pushErr: 0.2 });
  const noRock = vaultResult({ speed: 9.3, pole: 2, takeoffErr: 0, rockErr: null, pushErr: null });
  assert.ok(late.peak < good.peak - 0.4 && noRock.peak < late.peak);
});

test('pole vault: planting too close or too far fails', () => {
  assert.equal(vaultResult({ speed: 9.3, pole: 2, takeoffErr: 1.2 }).fail, 'RAN UNDER');
  assert.equal(vaultResult({ speed: 9.3, pole: 2, takeoffErr: -1.6 }).fail, 'TOO FAR OUT');
  const off = vaultResult({ speed: 9.3, pole: 2, takeoffErr: 0.6, rockErr: 0, pushErr: 0 });
  assert.ok(off.fail == null && off.peak < 5.5);
});

test('pole vault: holding the run flat out overshoots the stiff pole', () => {
  let v = 0, x = 0;
  while (x < VAULT.runway - VAULT.takeoff) { v = runStep(v, true, 1 / 120); x += v / 120; }
  assert.ok(v > VAULT.poles[2].band[1], `flat out ${v}`);
});

test('pole vault: competition goes up after a clearance, out after three failures', () => {
  const c = new VaultComp();
  c.setBar(5.0);
  c.record(true);
  assert.equal(c.best, 5.0);
  assert.ok(c.bar > 5.0);
  c.setBar(4.8);
  assert.ok(c.bar >= 5.05, 'cannot go back down');
  c.record(false); c.record(false); c.record(false);
  assert.ok(c.over);
  const rng = makeRng(4);
  const lo = [], hi = [];
  for (let i = 0; i < 40; i++) { lo.push(cpuVault(0.2, rng) ?? 0); hi.push(cpuVault(0.95, rng) ?? 0); }
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  assert.ok(avg(hi) > avg(lo) + 0.4);
});

// ---- canoe slalom ---------------------------------------------------------
import { SLALOM, Kayak, flowAt, runPilot, cpuSlalom } from '../src/game/sim/slalom.js';

test('canoe slalom: alternate strokes go straight, one side turns', () => {
  const run = (sides) => {
    const k = new Kayak();
    k.x = 9; k.s = 30;
    let i = 0;
    for (let t = 0; t < 3; t += 1 / 60) { if (!k.stroke) k.paddle(sides(i++)); k.update(1 / 60); }
    return k;
  };
  const straight = run((i) => (i % 2 ? 1 : -1));
  const right = run(() => 1);
  assert.ok(Math.abs(straight.h) < 0.5, `straight heading ${straight.h}`);
  assert.ok(right.h > 1.5, `turning heading ${right.h}`);
});

test('canoe slalom: mashing does not paddle faster than stroking', () => {
  const k = new Kayak();
  let ok = 0;
  for (let i = 0; i < 10; i++) { if (k.paddle(i % 2 ? 1 : -1)) ok++; k.update(0.02); }
  assert.ok(ok <= 2, `${ok} strokes accepted in 0.2s`);
});

test('canoe slalom: eddies below rocks flow back upstream', () => {
  const r = SLALOM.rocks[0];
  assert.ok(flowAt(r.x, r.s + 4).s < 0);
  assert.ok(flowAt(SLALOM.width / 2, r.s + 4).s > 1);
});

test('canoe slalom: drifting misses gates, a pilot gets round', () => {
  const drift = new Kayak();
  while (!drift.finished && drift.t < 300) drift.update(1 / 60);
  assert.ok(drift.gates.filter((g) => g.missed).length >= 3, 'drifting misses gates (or sits in an eddy)');
  let best = Infinity;
  for (let seed = 1; seed <= 8; seed++) {
    const k = runPilot(0.2, makeRng(seed));
    if (k.gates.every((g) => g.done)) best = Math.min(best, k.time);
  }
  assert.ok(best < 130, `best pilot run ${best}`);
  const rng = makeRng(2);
  assert.ok(cpuSlalom(0.95, rng) < cpuSlalom(0.1, makeRng(2)));
});

// ---- hammer throw ----------------------------------------------------------
import { HAMMER, runHammer, turnQuality, cpuHammer } from '../src/game/sim/hammer.js';

test('hammer: on-time turns throw furthest; more turns, more speed', () => {
  const four = runHammer({ turns: 4 }), five = runHammer({ turns: 5 });
  assert.ok(four.result.distance > 70 && five.result.distance > four.result.distance, `${four.result.distance} ${five.result.distance}`);
  assert.ok(five.result.distance < 90);
  const late = runHammer({ turns: 5, err: 0.3 });
  assert.ok(late.result.distance < five.result.distance - 10);
  assert.equal(turnQuality(0), 1);
  assert.equal(turnQuality(HAMMER.window + 0.01), 0);
});

test('hammer: release outside the sector or a sixth turn is a foul', () => {
  assert.match(runHammer({ rel: -0.4 }).result.why, /CAGE/);
  assert.match(runHammer({ rel: 0.4 }).result.why, /SECTOR/);
  assert.equal(runHammer({ turns: 7 }).result.why, 'TOO MANY TURNS');
  assert.ok(cpuHammer(1, makeRng(4)) > cpuHammer(0, makeRng(4)) || cpuHammer(0, makeRng(4)) == null);
});

// ---- rowing ------------------------------------------------------------------
import { runRower, RowBot, cpuRow } from '../src/game/sim/row.js';

test('rowing: clean strokes with a late sprint are fastest', () => {
  const steady = runRower({ powerFrom: 9999 });
  const sprint = runRower({ powerFrom: 250 });
  const allOut = runRower({ powerFrom: 0 });
  assert.ok(steady.t > 78 && steady.t < 90, `steady ${steady.t}`);
  assert.ok(sprint.t < steady.t - 2, `sprint ${sprint.t}`);
  assert.ok(allOut.t > sprint.t + 2, 'going flat out from the start runs out of stamina');
});

test('rowing: rushing, short strokes and sitting at the front are slow', () => {
  const clean = runRower({});
  assert.ok(runRower({ early: 0.4 }).t > clean.t + 4);
  assert.ok(runRower({ finish: 0.75 }).t > clean.t + 3);
  assert.ok(runRower({ wait: 0.4 }).t > clean.t + 10);
  const b = new RowBot(0.65, makeRng(1));
  while (!b.r.finished) b.update(1 / 60);
  assert.ok(b.r.t > 80 && b.r.t < 87, `rival ${b.r.t}`);
  assert.ok(cpuRow(1, makeRng(2)) < cpuRow(0, makeRng(2)));
});

// ---- figure skating ------------------------------------------------------------
import { FIG, FigureSkater, runFigure, timing, beatLen, routineStart } from '../src/game/sim/figure.js';

test('figure skating: moves on the beat score; off the beat they do not', () => {
  assert.equal(timing(beatLen() * 7), 1);
  assert.equal(timing(beatLen() * 7 + 0.15), 0.6);
  assert.equal(timing(beatLen() * 7.5), 0);
  const good = runFigure({});
  const sloppy = runFigure({ strokeErr: 0.15 });
  assert.ok(good.total > 150 && good.falls === 0, `good ${good.total}`);
  assert.ok(sloppy.total < good.total - 50, `sloppy ${sloppy.total}`);
});

test('figure skating: speed sets the rotations; landing late is a fall', () => {
  const s = new FigureSkater();
  s.t = routineStart() + beatLen() * 4; s.v = 1;
  s.takeoff();
  for (let i = 0; i < 60 && s.t < routineStart() + beatLen() * 5; i++) s.update(beatLen() / 60);
  const el = s.land();
  assert.equal(el.n, 4);
  const late = runFigure({ landErr: 0.3 });
  assert.ok(late.falls > 2);
  const slow = new FigureSkater();
  slow.t = routineStart(); slow.v = FIG.minJump - 0.05;
  assert.ok(slow.takeoff().slow);
});

// ---- log rolling -------------------------------------------------------------
import { LogRoll, runLogRoll, cpuLog } from '../src/game/sim/logroll.js';

test('log rolling: nobody balancing falls in within seconds', () => {
  const g = new LogRoll({ skill: 0.5, rng: makeRng(1) });
  let t = 0;
  while (!g.over && t < 20) { g.update(1 / 120, {}); t += 1 / 120; }
  assert.equal(g.over, 'rival');
  assert.ok(t < 8);
});

test('log rolling: pace changes while the rival wobbles win; just balancing does not', () => {
  let attackWins = 0, passiveWins = 0;
  for (let i = 0; i < 10; i++) {
    if (runLogRoll({ skill: 0.5, rng: makeRng(i + 1) }).g.score[0] >= 2) attackWins++;
    if (runLogRoll({ skill: 0.5, attack: 0, rng: makeRng(i + 1) }).g.score[0] >= 2) passiveWins++;
  }
  assert.ok(attackWins >= 7, `attack ${attackWins}`);
  assert.ok(passiveWins < attackWins);
  assert.ok(cpuLog(1, makeRng(3)) >= cpuLog(0, makeRng(3)));
});

// ---- bmx -------------------------------------------------------------------------
import { runBmx, groundY, TRACK } from '../src/game/sim/bmx.js';

test('bmx: pumping and popping clear the jumps; coasting cases them', () => {
  const good = runBmx({});
  assert.ok(good.finished && !good.timeUp && good.stats.clean === 4, JSON.stringify(good.stats));
  const lazy = runBmx({ pump: false });
  assert.ok(lazy.stats.cased >= 3 && lazy.score < good.score / 3);
  assert.ok(runBmx({ pop: false }).score < good.score);
  assert.ok(runBmx({ level: false }).stats.crashes >= 3);
  assert.ok(runBmx({ hold: 1 }).score > good.score, 'tricks add points');
  for (let x = 0; x < TRACK.finish; x += 0.25) assert.ok(Math.abs(groundY(x + 0.25) - groundY(x)) < 0.6, `step at ${x}`);
});

// ---- gym tests ---------------------------------------------------------------
import { runExercise, cpuGym } from '../src/game/sim/gym.js';

test('gym tests: springing off each end beats waiting; turning early is no rep', () => {
  for (const kind of ['squat', 'dips']) {
    const spring = runExercise(kind, { lag: 0.05 }), slow = runExercise(kind, { lag: 0.25 });
    assert.ok(spring.reps > slow.reps + 4, `${kind} ${spring.reps} vs ${slow.reps}`);
    const early = runExercise(kind, { lag: -0.2 });
    assert.equal(early.reps, 0);
    assert.ok(early.noReps > 10);
  }
  assert.ok(cpuGym(1, makeRng(1)) > cpuGym(0, makeRng(1)));
});

// ---- pistol shooting ---------------------------------------------------------
import { PISTOL, ringFor, runSeries, cpuPistol } from '../src/game/sim/pistol.js';

test('pistol: rings score 10 down to 5, nothing outside', () => {
  assert.equal(ringFor(0), 10);
  assert.equal(ringFor(2.9), 10);
  assert.equal(ringFor(4), 9);
  assert.equal(ringFor(17.5), 5);
  assert.equal(ringFor(19), 0);
});

test('pistol: riding the kick down scores; rushing the next shot goes high', () => {
  for (const time of PISTOL.series) {
    const steady = runSeries(time, makeRng(3));
    assert.equal(steady.shots.length, 5);
    assert.ok(steady.score >= 46, `steady ${time}s: ${steady.score}`);
  }
  const rushed = runSeries(8, makeRng(3), { gap: 0.25 });
  assert.ok(rushed.score < 35, `rushed ${rushed.score}`);
  const slow = runSeries(4, makeRng(3), { gap: 0.9 });
  assert.ok(slow.shots.length < 5, 'too slow on the 4 second series runs out of time');
});

test('pistol: a second hole in the same target scores nothing', async () => {
  const { Series } = await import('../src/game/sim/pistol.js');
  const s = new Series(8);
  assert.equal(s.shot(PISTOL.targets[0], PISTOL.targetY).ring, 10);
  assert.equal(s.shot(PISTOL.targets[0] + 1, PISTOL.targetY).ring, 0);
  assert.ok(cpuPistol(1, makeRng(1)) > cpuPistol(0, makeRng(1)));
});

// ---- long jump ------------------------------------------------------------------
import { LJ, runUp, jumpResult, landingGain, cpuLongJump } from '../src/game/sim/longjump.js';

/** Perfect rhythm down the runway, `off` seconds late on every stride. */
function ljRun(off = 0) {
  const r = runUp();
  let t = 0, foot = 'right';
  r.step('left', 0);
  while (r.x < LJ.runway) { t += 1 / 240; r.update(t); if (t >= r.nextIdeal + off) { r.step(foot, t); foot = foot === 'left' ? 'right' : 'left'; } }
  return r.v;
}

test('long jump: a fast run, a good board and 20 degrees jumps near the record', () => {
  const v = ljRun();
  const best = jumpResult({ speed: v, behind: 0.03, angle: 20, early: LJ.reachAt });
  assert.ok(best.distance > 8.6 && best.distance < 9.2, `best ${best.distance}`);
  assert.ok(jumpResult({ speed: ljRun(0.05), behind: 0.03, angle: 20, early: LJ.reachAt }).distance < best.distance - 0.5);
  assert.ok(jumpResult({ speed: v, behind: 0.03, angle: 30, early: LJ.reachAt }).distance < best.distance - 0.5, 'too steep');
  assert.ok(jumpResult({ speed: v, behind: 0.03, angle: 12, early: LJ.reachAt }).distance < best.distance - 1, 'too flat');
});

test('long jump: over the board is a foul; behind it is lost distance', () => {
  const v = ljRun();
  assert.equal(jumpResult({ speed: v, behind: -0.01, angle: 20, early: 0.25 }).foul, true);
  const near = jumpResult({ speed: v, behind: 0.01, angle: 20, early: 0.25 }).distance;
  const far = jumpResult({ speed: v, behind: 0.4, angle: 20, early: 0.25 }).distance;
  assert.ok(Math.abs(near - far - 0.39) < 0.02);
});

test('long jump: legs forward just before landing gains; never is a fall back', () => {
  assert.ok(landingGain(LJ.reachAt) > landingGain(0.6) + 0.3);
  assert.ok(landingGain(LJ.reachAt) > landingGain(0.02) + 0.3);
  assert.ok(landingGain(null) < 0);
  const rng = makeRng(4);
  let hi = 0, lo = 0;
  for (let i = 0; i < 50; i++) { hi += cpuLongJump(1, rng) ?? 0; lo += cpuLongJump(0, rng) ?? 0; }
  assert.ok(hi > lo + 50);
});

// ---- gymnastic vault --------------------------------------------------------------
import { GV, playVault, boardContact, blockQuality, Stick, cpuVaulting } from '../src/game/sim/gymvault.js';

test('vault: a clean vault scores difficulty plus nearly 10', () => {
  for (const vault of GV.vaults) {
    const r = playVault({ vault });
    assert.ok(Math.abs(r.landErr) < 2, `${vault.name} lands upright`);
    assert.ok(r.total > vault.d + 9.5, `${vault.name} ${r.total}`);
  }
});

test('vault: opening out early or late costs marks and can be a fall', () => {
  const v = GV.vaults[0], clean = playVault({ vault: v }).total;
  assert.ok(playVault({ vault: v, openErr: 0.06 }).total < clean - 0.5);
  assert.ok(playVault({ vault: v, openErr: -0.08 }).total < clean - 0.5);
  assert.ok(playVault({ vault: v, openErr: 0.2 }).ded.fall > 0, 'way over-rotated falls');
});

test('vault: the double front needs a fast run and a good block', () => {
  const dbl = GV.vaults[2];
  assert.ok(playVault({ vault: dbl, speed: 6 }).ded.fall > 0);
  assert.ok(playVault({ vault: dbl, speed: 7, blockErr: 0.12 }).ded.fall > 0);
  assert.ok(playVault({ vault: GV.vaults[0], speed: 6 }).ded.fall === 0, 'a single still makes it round');
});

test('vault: board and block timing', () => {
  const v = GV.vmax;
  assert.equal(boardContact(GV.runway - v * GV.hurdle, v).q, 1);
  assert.equal(boardContact(GV.runway - v * GV.hurdle - 1, v).balk, 'SHORT OF THE BOARD');
  assert.equal(boardContact(GV.runway - v * GV.hurdle + 1, v).balk, 'TOO CLOSE TO THE TABLE');
  assert.equal(blockQuality(0.02), 1);
  assert.ok(blockQuality(0.15) < 0.7 && blockQuality(null) < 0.2);
  const st = new Stick(40);
  while (!st.done) st.update(1 / 120, 0);
  assert.ok(st.steps > 0, 'an unheld landing steps');
  assert.ok(cpuVaulting(1, makeRng(2)) > cpuVaulting(0, makeRng(2)));
});
