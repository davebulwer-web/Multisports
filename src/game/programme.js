// Event programme helpers: grouping events into season tabs and building a
// custom running order. Pure functions (no canvas) so they can be tested.

/** Known seasons, in tab order. `color` is the label, `tab` the tab fill. */
export const SEASONS = [
  { id: 'summer', name: 'SUMMER', color: 'yellow.2', tab: 'yellow.0' },
  { id: 'winter', name: 'WINTER', color: 'cyan.2', tab: 'cyan.0' },
  { id: 'world', name: 'WORLD', color: 'green.3', tab: 'green.0' },
  { id: 'beach', name: 'BEACH', color: 'orange.3', tab: 'orange.1' },
];

const FALLBACK = { color: 'grey.6', tab: 'grey.2' };

/**
 * Split events into season groups, keeping registry order inside each.
 * Seasons that aren't in SEASONS get a tab of their own after the known
 * ones; events without a season go under OTHER. Empty seasons are dropped.
 */
export function groupBySeason(events, seasons = SEASONS) {
  const groups = seasons.map((s) => ({ ...s, events: [] }));
  for (const ev of events) {
    const id = ev.season || 'other';
    let g = groups.find((x) => x.id === id);
    if (!g) {
      g = { id, name: id.toUpperCase(), ...FALLBACK, events: [] };
      groups.push(g);
    }
    g.events.push(ev);
  }
  // keep OTHER last however the events were listed
  const other = groups.findIndex((g) => g.id === 'other');
  if (other >= 0) groups.push(...groups.splice(other, 1));
  return groups.filter((g) => g.events.length);
}

/** Every event, ordered season by season: the "all events" running order. */
export const allEventsInOrder = (events, seasons = SEASONS) =>
  groupBySeason(events, seasons).flatMap((g) => g.events);

/** Add an event id to the end of the programme, or take it out if present. */
export function toggleEvent(programme, id) {
  return programme.includes(id) ? programme.filter((x) => x !== id) : [...programme, id];
}

/**
 * Whole-season toggle: if every id is already in, take them all out;
 * otherwise append the missing ones in their listed order.
 */
export function toggleGroup(programme, ids) {
  if (ids.length && ids.every((id) => programme.includes(id))) return programme.filter((x) => !ids.includes(x));
  return [...programme, ...ids.filter((id) => !programme.includes(id))];
}

/** Turn ids back into events, skipping any that no longer exist. */
export const programmeEvents = (programme, events) =>
  programme.map((id) => events.find((e) => e.id === id)).filter(Boolean);
