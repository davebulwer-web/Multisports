// Menu/backdrop helpers shared by the non-event scenes.
import { fill, panel, text, W, H } from '../engine/gfx.js';
import { drawStadium, drawGrass } from './stadium.js';

export function backdrop(ctx, t, excite = 0.2) {
  const camX = (t * 12) % 960;
  drawStadium(ctx, camX, { excite, t, season: 'all' });
  drawGrass(ctx, camX);
}

/** Panel with a title strip, like a TV caption card. */
export function card(ctx, x, y, w, h, title, color = 'yellow.2') {
  panel(ctx, x, y, w, h, { bg: 'blue.0', edge: 'blue.2', shadow: 'grey.0' });
  fill(ctx, 'blue.1', x + 1, y + 1, w - 2, 12);
  fill(ctx, 'red.1', x + 1, y + 13, w - 2, 1);
  fill(ctx, 'grey.6', x + 1, y + 14, w - 2, 1);
  fill(ctx, 'blue.2', x + 1, y + 15, w - 2, 1);
  text(ctx, title, x + w / 2, y + 3, color, { align: 'center' });
}

export function prompt(ctx, t, msg = 'PRESS SPACE') {
  if (Math.floor(t * 2.5) % 2) text(ctx, msg, W / 2, H - 12, 'grey.6', { align: 'center' });
}
