// Per-browser records (localStorage), seeded with a built-in "world record".
import { EVENTS } from './events/index.js';

const KEY = 'multisports.records.v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export function getRecord(ev) {
  const r = load()[ev.id];
  return r ? r.value : ev.baseRecord;
}

export function getRecordHolder(ev) {
  return load()[ev.id]?.name || 'WORLD';
}

/** Store if better. Returns true when a new record was set. */
export function submitRecord(ev, value, name) {
  if (value == null) return false;
  const cur = getRecord(ev);
  const better = ev.better === 'lower' ? value < cur : value > cur;
  if (!better) return false;
  const all = load();
  all[ev.id] = { value, name };
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode */ }
  return true;
}

export const allRecords = () => EVENTS.map((e) => ({ ev: e, value: getRecord(e), name: getRecordHolder(e) }));
