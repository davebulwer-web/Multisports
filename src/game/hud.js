// Shared HUD pieces: top bar and a centred banner.
import { fill, panel, text, W } from '../engine/gfx.js';

export function topBar(ctx, left, centre, right) {
  fill(ctx, 'grey.0', 0, 0, W, 11);
  fill(ctx, 'blue.1', 0, 0, W, 10);
  fill(ctx, 'blue.2', 0, 0, W, 1);
  text(ctx, left, 4, 2, 'yellow.2');
  if (centre) text(ctx, centre, W / 2, 2, 'grey.6', { align: 'center' });
  if (right) text(ctx, right, W - 4, 2, 'cyan.2', { align: 'right' });
}

/** Big flashing message in the middle of the screen. */
export function banner(ctx, msg, y = 60, color = 'yellow.2', sub = null) {
  const w = Math.max(msg.length * 12 + 16, sub ? sub.length * 6 + 16 : 0);
  panel(ctx, W / 2 - w / 2, y - 4, w, sub ? 30 : 22, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
  text(ctx, msg, W / 2, y, color, { align: 'center', scale: 2 });
  if (sub) text(ctx, sub, W / 2, y + 17, 'grey.5', { align: 'center' });
}

export function fmtTime(s) { return s == null ? '--' : `${s.toFixed(2)}S`; }
export function fmtDist(m) { return m == null ? 'FOUL' : `${m.toFixed(2)}M`; }
export function fmtKg(kg) { return kg == null ? 'NO LIFT' : `${kg.toFixed(1)}KG`; }
