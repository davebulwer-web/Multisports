// BOBSLEIGH — push start then line. Hold Space to push the sled, press ↓ to
// jump in before the line. Down the ice tube the sled swings up the walls
// in the bends like a pendulum: steer with ← → to settle it on the ideal
// line. Swinging about and hard steering both scrub speed, and swinging over
// the lip rolls the sled. Lowest time wins.
import { Scene } from '../../engine/game.js';
import { fill, panel, text, circle, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { BOB, TRACK, Bob, curveAt, fmtBob } from '../sim/bob.js';
import { KITS, SKINS } from '../../art/palette.js';
import { topBar, banner } from '../hud.js';
import { drawWinterSky, pine, hash } from '../winter.js';

const SEG = 2.5;      // metres per drawn segment
const N = 64;         // segments drawn
const D = 150;        // focal length (px)
const CAM_H = 2.2;    // camera height above the ice (m)
const HOR = 78;       // horizon line
const SLED_Z = 4.5;   // camera distance to the sled
const FLOOR = 0.7, LIP = 1.9, WALL = 1.5; // tube half-widths and wall height (m)
const TUBE_R = 1.4;   // radius of the arc the sled rides on (drawing only)

// Sled seen from behind: k=kit, K=kit light, d=kit dark, h=helmet, H=visor,
// n=number plate, r=runner, s=shadow
const SLED = [
  '.....hhh....hhh.....',
  '....hHHHh..hHHHh....',
  '....dhhhd..dhhhd....',
  '..kkkkkkkkkkkkkkkk..',
  '.kKKKKKKKKKKKKKKKKk.',
  '.kkkkkkknnnnkkkkkkk.',
  '.ddddddddddddddddddd',
  '..rr............rr..',
];

export class BobsleighScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.bob = new Bob();
    const kit = KITS[o.player.kit % KITS.length];
    this.kit = kit;
    this.skin = SKINS[o.player.skin % SKINS.length].skin[1];
    this.state = 'ready';
    this.stateT = 0;
    this.heading = 0;
    this.t = 0;
    this.lastS = this.bob.s;
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    const b = this.bob;
    switch (this.state) {
      case 'ready':
        if (input.wasPressed('a') && this.stateT > 0.3) { this.state = 'push'; this.stateT = 0; sfx.ready(); }
        break;
      case 'push':
        b.push(dt, input.isDown('a'), input.wasPressed('down'));
        if (b.loaded && !this.loadedFx) { this.loadedFx = true; sfx.select(); }
        if (b.phase === 'run') {
          this.state = 'run'; this.stateT = 0;
          this.note = b.lateLoad ? { msg: 'LATE LOAD!', col: 'lamp.2' } : { msg: `START ${b.startTime.toFixed(2)}`, col: 'yellow.2' };
          if (b.lateLoad) sfx.bad();
        }
        break;
      case 'run': {
        const steer = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
        const crashes = b.crashes, splits = b.splits.length;
        b.run(dt, steer);
        if (b.crashes > crashes) { sfx.thud(); this.note = { msg: 'OVER THE LIP!', col: 'lamp.2' }; this.noteT = this.t; }
        if (b.splits.length > splits) { this.note = { msg: `SPLIT ${b.splits[splits].toFixed(2)}`, col: 'cyan.2' }; this.noteT = this.t; sfx.blip(); }
        if (Math.abs(b.angle - b.eq) > 0.45 && Math.floor(this.t * 8) % 3 === 0) this.skid = true; else this.skid = false;
        if (b.phase === 'done') this.finish();
        break;
      }
      case 'done':
        b.v = Math.max(0, b.v - 12 * dt);
        b.s += b.v * dt;
        if (this.stateT > 5 || (this.stateT > 1 && input.confirm())) return this.o.onDone(b.finish);
        break;
    }
    this.heading += curveAt(b.s) * (b.s - this.lastS);
    this.lastS = b.s;
  }

  finish() {
    this.state = 'done';
    this.stateT = 0;
    this.newRecord = this.o.record == null || this.bob.finish < this.o.record;
    if (this.newRecord) sfx.fanfare(); else sfx.jingle();
    sfx.crowd(0.6, 1.6);
  }

  // ---- drawing ------------------------------------------------------------

  draw(ctx) {
    drawWinterSky(ctx, this.heading * 900, 0, { horizon: HOR + 6, ridge: HOR + 2 });
    this.drawTrack(ctx);
    this.drawSled(ctx);

    const b = this.bob;
    topBar(ctx, 'BOBSLEIGH', this.o.player.name, fmtBob(b.t));
    this.drawSpeed(ctx);
    if (this.state === 'run') this.drawLine(ctx);
    this.drawMap(ctx);

    if (this.state === 'ready') banner(ctx, 'READY', 50, 'yellow.2', 'HOLD SPACE TO PUSH, DOWN TO JUMP IN');
    if (this.state === 'push') {
      const left = Math.max(0, -b.s);
      text(ctx, b.loaded ? 'IN! HOLD ON' : `PUSH! JUMP IN BEFORE THE LINE  ${left.toFixed(0)}M`, W / 2, 40, b.loaded ? 'green.2' : 'grey.6', { align: 'center' });
    }
    if (this.state === 'run') {
      if (this.note && (this.stateT < 1.5 || (this.noteT && this.t - this.noteT < 1.5))) text(ctx, this.note.msg, W / 2, 40, this.note.col, { align: 'center' });
      else if (this.stateT < 5) text(ctx, 'STEER [ ] TO KEEP THE SLED ON THE GREEN MARK', W / 2, 40, 'grey.6', { align: 'center' });
      if (this.skid) text(ctx, 'SKIDDING', W / 2, 50, 'lamp.2', { align: 'center' });
    }
    if (this.state === 'done') {
      banner(ctx, fmtBob(b.finish), 50, 'yellow.2', `START ${b.startTime.toFixed(2)}${b.crashes ? `  ${b.crashes} ROLL${b.crashes > 1 ? 'S' : ''}` : ''}${this.newRecord ? '  NEW RECORD!' : ''}`);
    }
  }

  /** Project the tube, far to near, as filled scanline strips. */
  drawTrack(ctx) {
    const b = this.bob;
    const camS = b.s - SLED_Z;
    const base = Math.floor(camS / SEG);
    // lateral centre-line offset ahead (metres), from the curvature
    const pts = [];
    let x = 0, dx = 0;
    for (let i = 0; i <= N; i++) {
      const s = (base + i) * SEG;
      const z = s - camS;
      const k = curveAt(s);
      dx += k * SEG;
      x += dx * SEG;
      if (z < 0.6) { pts.push(null); continue; }
      const sc = D / z;
      pts.push({ s, z, sc, cx: W / 2 + x * sc * 1.0, fy: HOR + CAM_H * sc, k, i: base + i });
    }
    // fill below the horizon with snow first
    fill(ctx, 'grey.6', 0, HOR + 4, W, H - HOR - 4);
    for (let i = N; i > 0; i--) {
      const far = pts[i], near = pts[i - 1] || null;
      if (!far) continue;
      const nr = near || { sc: D / 0.6, cx: W / 2, fy: HOR + CAM_H * D / 0.6, s: far.s - SEG, i: far.i - 1 };
      const stripe = ((far.i % 4) + 4) % 4 < 2;
      // pines beside the track
      if (far.i % 5 === 0 && far.sc > 1.5) {
        for (const side of [-1, 1]) {
          const px = far.cx + side * (LIP + 2.5 + hash(far.i + side) * 3) * far.sc;
          const h = Math.min(60, Math.round(far.sc * 3.2));
          if (h > 3) pine(ctx, px, far.fy - WALL * far.sc * 0.4, h);
        }
      }
      // walls: lower and upper bands each side, then the floor
      const fy0 = far.fy, fy1 = nr.fy;
      const lip0 = fy0 - WALL * far.sc, lip1 = fy1 - WALL * nr.sc;
      const mid0 = fy0 - WALL * 0.45 * far.sc, mid1 = fy1 - WALL * 0.45 * nr.sc;
      const MID = (FLOOR + LIP) / 2;
      for (const sd of [-1, 1]) {
        const X = (p, w) => p.cx + sd * w * p.sc;
        this.quad(ctx, [[X(far, FLOOR), fy0], [X(far, MID), mid0], [X(nr, MID), mid1], [X(nr, FLOOR), fy1]], stripe ? 'cyan.1' : 'cyan.2');
        this.quad(ctx, [[X(far, MID), mid0], [X(far, LIP), lip0], [X(nr, LIP), lip1], [X(nr, MID), mid1]], 'sky.3');
        this.quad(ctx, [[X(far, LIP), lip0 - 1], [X(far, LIP + 0.12), lip0 - 1], [X(nr, LIP + 0.12), lip1 - 1], [X(nr, LIP), lip1 - 1]], 'blue.2');
      }
      this.quad(ctx, [[far.cx - FLOOR * far.sc, fy0], [far.cx + FLOOR * far.sc, fy0], [nr.cx + FLOOR * nr.sc, fy1], [nr.cx - FLOOR * nr.sc, fy1]], stripe ? 'grey.6' : 'grey.5');
      // start / push line
      if (far.s <= 0 && far.s + SEG > 0) this.strip(ctx, far.fy - 2, far.cx - LIP * far.sc, far.cx + LIP * far.sc, far.fy, far.cx - LIP * far.sc, far.cx + LIP * far.sc, 'lamp.1');
      if (far.s <= TRACK.length && far.s + SEG > TRACK.length) this.strip(ctx, far.fy - 2, far.cx - LIP * far.sc, far.cx + LIP * far.sc, far.fy, far.cx - LIP * far.sc, far.cx + LIP * far.sc, 'grey.0');
    }
    this.sledAt = pts.find((p) => p && p.z >= SLED_Z - SEG) || { sc: D / SLED_Z, cx: W / 2, fy: HOR + CAM_H * D / SLED_Z };
  }

  /** Fill a convex quad (pixel scanlines, so the edges stay crisp). */
  quad(ctx, pts, col) {
    let y0 = Infinity, y1 = -Infinity;
    for (const [, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    y0 = Math.max(HOR, Math.floor(y0)); y1 = Math.min(H, Math.ceil(y1));
    for (let y = y0; y < y1; y++) {
      const yc = y + 0.5;
      let xl = Infinity, xr = -Infinity;
      for (let i = 0; i < 4; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 4];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
          const x = ax + ((yc - ay) / (by - ay)) * (bx - ax);
          xl = Math.min(xl, x); xr = Math.max(xr, x);
        }
      }
      if (xr >= xl) fill(ctx, col, Math.round(xl), y, Math.max(1, Math.round(xr) - Math.round(xl)), 1);
    }
  }

  /** Trapezoid from a far edge (y0, xl0..xr0) to a near edge (y1, xl1..xr1). */
  strip(ctx, y0, xl0, xr0, y1, xl1, xr1, col) {
    const top = Math.max(HOR, Math.round(y0)), bot = Math.min(H, Math.round(y1));
    if (bot <= top) { if (bot === top && top < H) fill(ctx, col, xl0, top, xr0 - xl0, 1); return; }
    for (let y = top; y < bot; y++) {
      const f = (y - y0) / (y1 - y0 || 1);
      const xl = xl0 + (xl1 - xl0) * f, xr = xr0 + (xr1 - xr0) * f;
      fill(ctx, col, Math.round(xl), y, Math.max(1, Math.round(xr) - Math.round(xl)), 1);
    }
  }

  drawSled(ctx) {
    const b = this.bob, p = this.sledAt;
    const sc = D / SLED_Z;
    const a = b.angle;
    // position on the tube arc, in metres from the floor centre
    const lx = Math.sin(a) * TUBE_R, ly = TUBE_R - Math.cos(a) * TUBE_R;
    const cx = p.cx + lx * sc, cy = HOR + CAM_H * sc - ly * sc;
    const cols = { k: this.kit.vest[1], K: this.kit.vest[2], d: this.kit.vest[0], h: this.kit.shorts[1], H: 'grey.0', n: 'grey.6', r: 'grey.2' };
    const loaded = b.loaded;
    const ca = Math.cos(a), sa = Math.sin(a);
    const w = SLED[0].length, h = SLED.length, Z = 2; // 2x scale
    // shadow
    for (let i = 0; i < w; i++) fill(ctx, 'grey.4', cx + (i - w / 2) * Z * ca, cy + (i - w / 2) * Z * sa + 1, Z, Z);
    for (const pass of [0, 1]) {
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const ch = SLED[j][i];
          if (ch === '.' || (!loaded && j < 3)) continue;
          const ox = (i - w / 2) * Z, oy = (j - h) * Z;
          const px = Math.round(cx + ox * ca - oy * sa), py = Math.round(cy + ox * sa + oy * ca);
          if (pass === 0) fill(ctx, 'grey.0', px - 1, py - 1, Z + 2, Z + 2); // outline
          else fill(ctx, cols[ch], px, py, Z, Z);
        }
      }
    }
    if (!loaded) this.drawCrew(ctx, cx, cy);
    // ice spray when skidding
    if (this.skid) for (let k = 0; k < 6; k++) fill(ctx, 'grey.6', cx + (hash(Math.floor(this.t * 30) + k) - 0.5) * 40, cy - hash(k + Math.floor(this.t * 30)) * 12, 1, 1);
  }

  /** Two pushers behind the sled, legs pumping. */
  drawCrew(ctx, cx, cy) {
    const run = this.bob.v > 0.5 ? Math.floor(this.t * (4 + this.bob.v)) % 2 : 0;
    for (const side of [-1, 1]) {
      const x = Math.round(cx + side * 14), y = Math.round(cy + 6);
      fill(ctx, this.kit.shorts[0], x - 3 + (run ? 1 : 0) * side, y + 6, 3, 8 - (run ? 3 : 0));
      fill(ctx, this.kit.shorts[0], x + 1 - (run ? 1 : 0) * side, y + 6, 3, 5 + (run ? 3 : 0));
      fill(ctx, 'grey.0', x - 5, y - 7, 11, 14);
      fill(ctx, this.kit.vest[1], x - 4, y - 6, 9, 12);
      fill(ctx, this.kit.vest[2], x - 4, y - 6, 9, 1);
      circle(ctx, x, y - 10, 3.5, this.kit.shorts[1]);
      fill(ctx, this.skin, x - side * 6, y - 4, 3, 2); // hands on the push bar
    }
  }

  drawSpeed(ctx) {
    const b = this.bob, x = 4, y = 14;
    panel(ctx, x, y, 74, 20, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'SPEED', x + 4, y + 3, 'grey.4', { shadow: null });
    text(ctx, `${b.kmh.toFixed(0)}KM/H`, x + 4, y + 11, 'yellow.2');
  }

  /** Cross-section gauge: where the sled is on the wall, and where it should be. */
  drawLine(ctx) {
    const b = this.bob, x = W - 40, y = 46, r = 22;
    panel(ctx, x - 32, y - 32, 64, 38, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    const pt = (a) => [x + Math.sin(a) * r, y - (1 - Math.cos(a)) * r];
    for (let i = 0; i <= 32; i++) {
      const a = -1.65 + (3.3 * i) / 32;
      const [px, py] = pt(a);
      fill(ctx, Math.abs(a) > BOB.flip ? 'lamp.1' : 'grey.4', px, py, 1, 1);
    }
    const [ex, ey] = pt(b.eq ?? 0);
    fill(ctx, 'green.2', ex - 2, ey - 2, 5, 5);
    const [sx, sy] = pt(b.angle);
    fill(ctx, 'grey.0', sx - 2, sy - 2, 5, 5);
    fill(ctx, 'yellow.2', sx - 1, sy - 1, 3, 3);
    text(ctx, 'LINE', x, y - 29, 'grey.4', { align: 'center', shadow: null });
  }

  /** Track map with a dot for the sled. */
  drawMap(ctx) {
    const x = 4, y = 38, w = 74;
    panel(ctx, x, y, w, 10, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (const c of TRACK.secs) {
      if (!c.k) continue;
      fill(ctx, c.k > 0 ? 'blue.2' : 'purple.2', x + 2 + (c.start / TRACK.length) * (w - 4), y + 4, Math.max(1, (c.len / TRACK.length) * (w - 4)), 2);
    }
    const f = Math.max(0, Math.min(1, this.bob.s / TRACK.length));
    fill(ctx, 'yellow.2', x + 2 + f * (w - 4) - 1, y + 2, 3, 6);
  }
}
