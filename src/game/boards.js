// Rows of trackside advertising boards, picked from the brands that suit the
// season (src/art/brands.js). Every board in a row is different until the
// pool runs out, and the order changes from event to event and visit to visit.
import { assets } from './assets.js';
import { fill, W } from '../engine/gfx.js';
import { brandsFor } from '../art/brands.js';
import { BOARD } from '../art/boards.js';

export const BOARD_W = BOARD.w, BOARD_H = BOARD.h;
const STEP = BOARD.w + 1; // 1px dark gap between boards

let visit = (Math.random() * 1e9) >>> 0;
/** Shuffle the boards again (call when a new event starts). */
export function reshuffleBoards() { visit = (visit * 1103515245 + 12345) >>> 0; }

const orders = new Map();
function rng(seed) {
  return () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const strHash = (s) => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** The brand ids for a season, shuffled for this visit and salt. */
export function boardOrder(season, salt = '') {
  const key = `${season}|${salt}|${visit}`;
  if (!orders.has(key)) {
    const ids = brandsFor(season).map((b) => b.id);
    const r = rng(strHash(key));
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    if (orders.size > 50) orders.clear();
    orders.set(key, ids);
  }
  return orders.get(key);
}

/** Draw one board by brand id with its top-left corner at (x, y). */
export function drawBoard(ctx, id, x, y) {
  assets.boards.draw(ctx, assets.boards.tag(id).from, Math.round(x), Math.round(y));
}

/**
 * A row of boards across the screen with their tops at y, scrolling with camX.
 * @param {{season?:string, salt?:string, x0?:number, x1?:number, gap?:string}} o
 *   x0..x1 = screen span to fill; gap = colour between boards
 */
export function drawBoardRow(ctx, camX, y, { season = 'summer', salt = '', x0 = 0, x1 = W, gap = 'grey.0' } = {}) {
  const order = boardOrder(season, salt);
  const b0 = Math.floor((camX + x0) / STEP) - 1;
  for (let b = b0; b * STEP - camX < x1; b++) {
    const x = Math.round(b * STEP - camX);
    if (x + STEP < x0) continue;
    drawBoard(ctx, order[((b % order.length) + order.length) % order.length], x, y);
    fill(ctx, gap, x + BOARD.w, y, 1, BOARD.h);
  }
}
