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
export function fmtPts(n) { return n == null ? '--' : `${n} PTS`; }

/** Wind readout with a striped windsock. + blows to the right. */
export function windSock(ctx, x, y, wind) {
  panel(ctx, x, y, 76, 20, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
  text(ctx, 'WIND', x + 4, y + 3, 'grey.4', { shadow: null });
  text(ctx, `${wind >= 0 ? '+' : ''}${wind.toFixed(1)}`, x + 4, y + 11, wind >= 0 ? 'green.2' : 'lamp.2');
  const sx = x + 42;
  fill(ctx, 'grey.4', sx, y + 3, 1, 14);
  const len = 4 + Math.abs(wind) * 3;
  const dir = wind >= 0 ? 1 : -1;
  for (let i = 0; i < len; i++) {
    fill(ctx, Math.floor(i / 3) % 2 ? 'grey.6' : 'lamp.1', sx + dir * (i + 1), y + 4 + Math.floor(i / 6), 1, Math.max(2, 4 - Math.floor(i / 4)));
  }
}
