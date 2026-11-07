// Shared beach scenery for the summer beach events: hazy sky, sun, sea,
// sand, palms, a lifeguard hut and a crowd on towels.
import { fill, dither, bands, circle, W } from '../engine/gfx.js';
import { assets, drawScenery } from './assets.js';
import { hash } from './winter.js';
import { drawBoardRow } from './boards.js';

/** Sky and sun down to the horizon. */
export function beachSky(ctx, t, horizon) {
  bands(ctx, ['sky.1', 'sky.2', 'sky.2', 'sky.3'], 0, 0, W, horizon);
  circle(ctx, 300, Math.round(horizon * 0.35), 11, 'yellow.2');
  circle(ctx, 300, Math.round(horizon * 0.35), 8, 'grey.6');
  for (let i = 0; i < 3; i++) {
    const gx = Math.round((i * 131 + t * (6 + i * 2)) % (W + 40)) - 20, gy = 16 + i * 11 + Math.round(Math.sin(t * 2 + i) * 2);
    fill(ctx, 'grey.6', gx, gy, 2, 1); fill(ctx, 'grey.6', gx + 3, gy, 2, 1); fill(ctx, 'grey.4', gx + 2, gy + 1, 1, 1);
  }
}

/** Calm sea from the horizon to y1, with glints that drift with the camera. */
export function beachSea(ctx, t, horizon, y1, camX = 0) {
  fill(ctx, 'cyan.1', 0, horizon, W, y1 - horizon);
  fill(ctx, 'sky.0', 0, horizon, W, 2);
  dither(ctx, 'sky.0', 'cyan.1', 0, horizon + 2, W, 4);
  for (let y = horizon + 3; y < y1; y += 4) {
    const step = 19 + (y % 3) * 4;
    for (let x = ((y * 7 - Math.round(camX * 0.3)) % step + step) % step; x < W; x += step) {
      fill(ctx, (y + x) % 3 ? 'cyan.2' : 'grey.6', x + Math.round(Math.sin(t * 1.3 + y) * 2), y, 4 + (y - horizon) / 12, 1);
    }
  }
}

/**
 * Sand from y0 down, with palms, a lifeguard hut and fans, scrolling with camX
 * at `par` (parallax). excite 0..1 = how many fans are cheering. `boards` (a
 * salt string) puts a row of beach advertising boards in front of the crowd.
 */
export function beachSand(ctx, t, y0, y1, { camX = 0, par = 1, excite = 0.2, crowd = true, props = true, boards = null } = {}) {
  fill(ctx, 'orange.3', 0, y0, W, y1 - y0);
  fill(ctx, 'grey.6', 0, y0, W, 1); // foam line
  dither(ctx, 'orange.3', 'yellow.2', 0, y0 + 1, W, 3);
  const cx = camX * par;
  for (let i = 0; i < 60; i++) {
    const x = Math.round(((hash(i) * 997 - cx) % W + W) % W), y = y0 + 4 + Math.floor(hash(i + 77) * (y1 - y0 - 5));
    fill(ctx, 'orange.2', x, y, 2, 1);
  }
  if (props) {
    for (let k = Math.floor(cx / 170) - 1; k < cx / 170 + W / 170 + 2; k++) {
      const x = Math.round(k * 170 - cx);
      if (hash(k + 300) < 0.5) drawScenery(ctx, 'palm', x + 30, y0 + 6);
      else drawScenery(ctx, 'lifeguard', x + 40, y0 + 8);
    }
  }
  if (!crowd) return;
  const c0 = Math.floor(cx / 11) - 1;
  for (let c = c0; c < c0 + W / 11 + 3; c++) {
    const h = hash(c * 13 + 5);
    if (h < 0.35) continue;
    const x = Math.round(c * 11 - cx), y = y0 + 12 + Math.floor(h * 6);
    fill(ctx, ['lamp.1', 'cyan.1', 'yellow.1', 'green.2'][c & 3], x - 5, y, 12, 2); // towel
    const fan = Math.floor(h * 8);
    const cheering = hash(c + 999) < excite;
    const frame = cheering && Math.floor(t * 4 + h * 4) % 2 === 0 ? 1 : 0;
    const tag = assets.props.tags[`fan_${fan}`];
    assets.props.draw(ctx, tag.from + frame, x, y + 1);
  }
  if (boards != null) drawBoardRow(ctx, cx, y0 + 14, { season: 'beach', salt: boards });
}
