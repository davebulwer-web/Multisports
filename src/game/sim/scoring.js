// Superstars-style points: places 1..5 score 10, 7, 4, 2, 1.
// Ties share the better place. Null results (foul, DQ, no lift) score 0.
export const POINTS = [10, 7, 4, 2, 1];

/**
 * @param {{id:any, value:number|null}[]} entries
 * @param {'lower'|'higher'} better
 * @returns {{id:any, value:number|null, place:number|null, points:number}[]} sorted best first
 */
export function rankResults(entries, better) {
  const valid = entries.filter((e) => e.value !== null && Number.isFinite(e.value));
  const invalid = entries.filter((e) => !(e.value !== null && Number.isFinite(e.value)));
  const sorted = [...valid].sort((a, b) => (better === 'lower' ? a.value - b.value : b.value - a.value));
  const out = [];
  sorted.forEach((e, i) => {
    const prev = out[i - 1];
    const place = prev && prev.value === e.value ? prev.place : i + 1;
    out.push({ ...e, place, points: POINTS[place - 1] ?? 0 });
  });
  for (const e of invalid) out.push({ ...e, place: null, points: 0 });
  return out;
}

/** Overall standings from per-player point totals, best first. */
export function standings(players) {
  return [...players].sort((a, b) => b.points - a.points || (b.golds ?? 0) - (a.golds ?? 0));
}
