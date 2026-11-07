import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS } from '../src/game/events/index.js';
import { SEASONS, groupBySeason, allEventsInOrder, toggleEvent, toggleGroup, programmeEvents } from '../src/game/programme.js';

test('every registered event is in a known season', () => {
  const known = SEASONS.map((s) => s.id);
  for (const ev of EVENTS) assert.ok(known.includes(ev.season), `${ev.id} has season ${ev.season}`);
});

test('all events order covers every event once, season by season', () => {
  const order = allEventsInOrder(EVENTS);
  assert.equal(order.length, EVENTS.length);
  assert.equal(new Set(order).size, EVENTS.length);
  const seasons = order.map((e) => e.season);
  const seen = [];
  for (const s of seasons) if (seen.at(-1) !== s) { assert.ok(!seen.includes(s), 'seasons are contiguous'); seen.push(s); }
});

test('new seasons and season-less events get their own tabs', () => {
  const evs = [
    { id: 'a', season: 'summer' },
    { id: 'b' },
    { id: 'c', season: 'urban' },
    { id: 'd', season: 'winter' },
  ];
  const groups = groupBySeason(evs);
  assert.deepEqual(groups.map((g) => g.id), ['summer', 'winter', 'urban', 'other']);
  assert.equal(groups[2].name, 'URBAN');
  assert.deepEqual(allEventsInOrder(evs).map((e) => e.id), ['a', 'd', 'c', 'b']);
});

test('picking events builds an ordered programme', () => {
  let p = [];
  p = toggleEvent(p, 'curling');
  p = toggleEvent(p, 'sprint');
  p = toggleEvent(p, 'surfing');
  assert.deepEqual(p, ['curling', 'sprint', 'surfing']);
  p = toggleEvent(p, 'sprint');
  assert.deepEqual(p, ['curling', 'surfing']);
  assert.deepEqual(programmeEvents([...p, 'gone'], EVENTS).map((e) => e.id), ['curling', 'surfing']);
});

test('whole-season toggle adds the missing ones, then removes them all', () => {
  const winter = ['skijump', 'biathlon', 'curling', 'bobsleigh'];
  let p = toggleGroup(['sprint', 'curling'], winter);
  assert.deepEqual(p, ['sprint', 'curling', 'skijump', 'biathlon', 'bobsleigh']);
  p = toggleGroup(p, winter);
  assert.deepEqual(p, ['sprint']);
});
