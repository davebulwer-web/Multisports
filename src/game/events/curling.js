// CURLING — judgement and sweeping. Pick your line with ↑ ↓ and the turn
// with ← →, set the weight on the swinging gauge, then hold Space to sweep:
// sweeping carries the stone further and straighter. Four ends, two stones
// each. Your stones that are closer to the button than every opposition
// stone score their ring's points.
import { Scene } from '../../engine/game.js';
import { fill, panel, text, pixLine, circle, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { CURL, deliver, step, settle, scoreEnd, setupEnd, ringPoints, maxScore } from '../sim/curling.js';
import { makeRng } from '../sim/rng.js';
import { KITS, SKINS } from '../../art/palette.js';
import { topBar, banner } from '../hud.js';
import { hash } from '../winter.js';

const S = 28;           // pixels per metre on the main view
const CY = 98;          // screen y of the centre line
const MS = 10;          // minimap pixels per metre
const MX = (W - 31 * MS) / 2, MY = 204, MYS = 2.5; // minimap origin (release point, centre line), y scale
const ENDS = CURL.ends.length;
const GAUGE = { x: W / 2 - 110, y: 176, w: 220 };
const ZONES = [['GUARD', 0.1, 0.24, 'cyan.1'], ['DRAW', 0.27, 0.38, 'green.1'], ['TAKEOUT', 0.52, 1, 'lamp.0']];

export class CurlingScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.rng = makeRng();
    this.end = -1;
    this.endScores = [];
    const kit = KITS[o.player.kit % KITS.length];
    this.myCol = kit.vest[1];
    this.myLight = kit.vest[2];
    this.skin = SKINS[o.player.skin % SKINS.length].skin[1];
    this.t = 0;
    this.nextEnd();
  }

  get total() { return this.endScores.reduce((a, b) => a + b, 0); }

  nextEnd() {
    this.end++;
    this.stones = setupEnd(this.end);
    this.thrown = 0;
    this.camX = CURL.tee - 6;
    this.newStone();
  }

  newStone() {
    this.state = 'aim';
    this.stateT = 0;
    this.aimY = this.aimY ?? 0;
    this.turn = this.turn ?? 1;
    this.weight = 0;
    this.gaugeT = 0;
    this.live = null;
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    switch (this.state) {
      case 'aim':
        if (input.isDown('up')) this.aimY = Math.max(-1.9, this.aimY - 0.9 * dt);
        if (input.isDown('down')) this.aimY = Math.min(1.9, this.aimY + 0.9 * dt);
        if (input.wasPressed('left')) { this.turn = -1; sfx.blip(); }
        if (input.wasPressed('right')) { this.turn = 1; sfx.blip(); }
        if (input.wasPressed('a') && this.stateT > 0.3) { this.state = 'weight'; this.stateT = 0; sfx.select(); }
        if (input.wasPressed('b')) this.aimY = 0;
        break;
      case 'weight':
        // the gauge swings up and back; press when it's where you want it
        this.gaugeT += dt;
        this.weight = 0.5 - 0.5 * Math.cos((this.gaugeT / 2.4) * Math.PI * 2);
        if (input.wasPressed('a') && this.stateT > 0.15) this.release();
        if (input.wasPressed('b')) { this.state = 'aim'; this.stateT = 0; }
        break;
      case 'run': {
        this.sweeping = input.isDown('a') && this.live.x < CURL.tee && this.live.moving;
        const sub = 4;
        for (let i = 0; i < sub; i++) step(this.stones, dt / sub, this.sweeping);
        if (this.sweeping && Math.floor(this.t * 10) % 2 === 0 && Math.floor((this.t - dt) * 10) % 2 !== 0) sfx.step(true);
        if (this.stones.some((s) => s.hit && !s.clacked)) { sfx.clang(); for (const s of this.stones) if (s.hit) s.clacked = true; }
        if (!this.stones.some((s) => s.moving)) this.stopped();
        break;
      }
      case 'stopped':
        if (this.stateT > 1.2 || (this.stateT > 0.4 && input.confirm())) {
          if (this.thrown < CURL.perEnd) this.newStone();
          else this.scoreEnd();
        }
        break;
      case 'endScore':
        if (this.stateT > 3.5 || (this.stateT > 0.6 && input.confirm())) {
          if (this.end + 1 >= ENDS) return this.o.onDone(this.total);
          this.nextEnd();
        }
        break;
    }
    // camera: house while aiming, follow the stone while it runs
    const target = this.state === 'run' && this.live ? Math.min(CURL.tee - 6, Math.max(2, this.live.x - 5)) : this.state === 'weight' ? 2 : CURL.tee - 6;
    this.camX += (target - this.camX) * Math.min(1, dt * (this.state === 'run' ? 8 : 3));
  }

  release() {
    this.live = deliver(this.weight, this.aimY, this.turn);
    this.stones.push(this.live);
    this.thrown++;
    this.state = 'run';
    this.stateT = 0;
    sfx.whoosh();
  }

  stopped() {
    settle(this.stones); // applies the hog-line rule
    this.state = 'stopped';
    this.stateT = 0;
    const s = this.live;
    this.msg = s.out ? (s.x < CURL.hog ? 'HOGGED' : 'THROUGH') : s.inHouse ? `IN THE ${['BUTTON', '4 FOOT', '8 FOOT', '12 FOOT'][4 - ringPoints(s.dist)]}` : 'GUARD';
    if (s.out) sfx.bad();
  }

  scoreEnd() {
    const r = scoreEnd(this.stones);
    this.endScores.push(r.points);
    this.counting = r.counting;
    this.state = 'endScore';
    this.stateT = 0;
    const last = this.end + 1 >= ENDS;
    if (last) {
      this.newRecord = this.o.record == null || this.total > this.o.record;
      if (this.newRecord) sfx.fanfare(); else if (r.points) sfx.jingle();
    } else if (r.points) sfx.jingle(); else sfx.bad();
  }

  // ---- drawing ------------------------------------------------------------

  sx(x) { return W / 2 - 40 + (x - this.camX) * S; }
  sy(y) { return CY + y * S; }

  draw(ctx) {
    fill(ctx, 'blue.0', 0, 0, W, H);
    this.drawSheet(ctx);
    for (const s of this.stones) if (!s.out) this.drawStone(ctx, s, this.sx(s.x), this.sy(s.y), CURL.r * S);
    if (this.state === 'run' && this.live?.moving) this.drawSweepers(ctx);
    if (this.state === 'aim' || this.state === 'weight') this.drawAim(ctx);

    topBar(ctx, 'CURLING', this.o.player.name, `END ${this.end + 1}/${ENDS}`);
    this.drawCard(ctx);
    this.drawMinimap(ctx);
    if (this.state === 'aim' || this.state === 'weight') this.drawGauge(ctx);
    if (this.state === 'run') text(ctx, this.live.x < CURL.tee ? (this.sweeping ? 'SWEEP! SWEEP!' : 'HOLD SPACE TO SWEEP') : 'PAST THE TEE: NO SWEEPING', W / 2, 178, this.sweeping ? 'yellow.2' : 'grey.5', { align: 'center' });

    if (this.state === 'aim') {
      const e = CURL.ends[this.end];
      const first = this.end === 0 && this.thrown === 0;
      text(ctx, `${e.name}: STONE ${this.thrown + 1} OF ${CURL.perEnd}`, 4, 14, 'grey.6');
      text(ctx, first ? 'UP/DOWN: BROOM. [ ]: CURL. SPACE: GO' : 'AIM, THEN SPACE', 4, 23, 'grey.5');
    }
    if (this.state === 'stopped') banner(ctx, this.msg, 40, this.live.out ? 'lamp.2' : 'yellow.2');
    if (this.state === 'endScore') {
      const p = this.endScores[this.end];
      const last = this.end + 1 >= ENDS;
      banner(ctx, p ? `${p} POINT${p === 1 ? '' : 'S'}` : 'NO SCORE', 40, p ? 'yellow.2' : 'lamp.2',
        last ? `TOTAL ${this.total} OF ${maxScore()}${this.newRecord ? '  NEW RECORD!' : ''}` : p ? 'YOUR STONES CLOSEST TO THE BUTTON' : 'THEIR STONE IS SHOT');
      // highlight counting stones
      for (const s of this.counting) {
        const x = this.sx(s.x), y = this.sy(s.y);
        if (Math.floor(this.t * 4) % 2) for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; fill(ctx, 'yellow.2', x + Math.cos(a) * 6, y + Math.sin(a) * 6, 1, 1); }
      }
    }
  }

  drawSheet(ctx) {
    const top = this.sy(-CURL.width / 2), bot = this.sy(CURL.width / 2);
    fill(ctx, 'orange.1', 0, top - 8, W, 8);           // side boards
    fill(ctx, 'orange.2', 0, top - 8, W, 1);
    fill(ctx, 'orange.1', 0, bot, W, 8);
    fill(ctx, 'orange.0', 0, bot + 7, W, 1);
    fill(ctx, 'grey.6', 0, top, W, bot - top);
    // pebble: fixed to the ice so it scrolls
    const x0 = Math.floor(this.camX * S / 5) - 1;
    for (let i = x0; i < x0 + W / 5 + 2; i++) {
      for (let j = 0; j < 22; j++) {
        if (hash(i * 31 + j) > 0.22) continue;
        const px = i * 5 - this.camX * S + W / 2 - 40 + hash(i + j * 7) * 4;
        fill(ctx, hash(i + j) > 0.5 ? 'grey.5' : 'cyan.2', px, top + j * 5 + 2, 1, 1);
      }
    }
    // house
    const tx = this.sx(CURL.tee), ty = this.sy(0);
    circle(ctx, tx, ty, 1.83 * S, 'blue.2');
    circle(ctx, tx, ty, 1.22 * S, 'grey.6');
    circle(ctx, tx, ty, 0.61 * S, 'lamp.1');
    circle(ctx, tx, ty, 0.15 * S, 'grey.6');
    // lines
    fill(ctx, 'grey.4', 0, ty, W, 1);                                       // centre line
    fill(ctx, 'grey.3', tx, top, 1, bot - top);                             // tee line
    fill(ctx, 'lamp.1', this.sx(CURL.hog) - 1, top, 2, bot - top);          // far hog
    fill(ctx, 'lamp.1', this.sx(0) - 1, top, 2, bot - top);                 // near hog (release)
    fill(ctx, 'blue.1', this.sx(CURL.back), top, 1, bot - top);             // back line
    const endX = this.sx(CURL.back + 1.8);
    if (endX < W) fill(ctx, 'orange.1', endX, top - 8, W - endX, bot - top + 16);
    if (this.camX < 4) {
      // hack (foothold) and delivering curler
      fill(ctx, 'grey.1', this.sx(-6.4) - 2, ty - 3, 4, 6);
    }
  }

  drawStone(ctx, s, x, y, r) {
    const handle = s.team === 'me' ? this.myCol : 'yellow.1';
    const hl = s.team === 'me' ? this.myLight : 'yellow.2';
    circle(ctx, x + 1, y + 1, r, 'grey.4');
    circle(ctx, x, y, r, 'grey.2');
    circle(ctx, x, y, r - 1, 'grey.3');
    fill(ctx, handle, x - 1, y - 1, 3, 3);
    fill(ctx, hl, x - 1, y - 1, 1, 1);
  }

  drawSweepers(ctx) {
    const s = this.live, x = this.sx(s.x), y = this.sy(s.y);
    const sweep = this.sweeping;
    const wob = sweep ? Math.round(Math.sin(this.t * 40) * 3) : 0;
    for (const side of [-1, 1]) {
      const bx = x + 9, by = y + side * 4 + (side < 0 ? wob : -wob);
      // broom head ahead of the stone
      fill(ctx, 'grey.1', bx - 1, by - 2, 2, 4);
      // sweeper walking alongside, top-down: body, head, broom handle
      const px = x + 4, py = y + side * 12;
      pixLine(ctx, px + 1, py, bx, by, 'orange.1');
      fill(ctx, 'grey.1', px - 4, py - 3, 8, 7);
      fill(ctx, this.myCol, px - 3, py - 2, 6, 5);
      fill(ctx, this.myLight, px - 3, py - 2, 6, 1);
      circle(ctx, px + 1, py, 2, 'hair.1');
      fill(ctx, this.skin, px + 2, py - 1, 1, 2);
    }
  }

  drawAim(ctx) {
    // broom target at the house, with the straight line to it
    const bx = this.sx(CURL.tee), by = this.sy(this.aimY);
    const fx = this.sx(0), fy = this.sy(0);
    for (let i = 0; i < 60; i++) {
      const f = i / 60, x = fx + (bx - fx) * f, y = fy + (by - fy) * f;
      if (i % 2 === 0 && x > 0 && x < W) fill(ctx, 'grey.3', x, y, 1, 1);
    }
    fill(ctx, 'grey.0', bx - 4, by - 1, 9, 3);
    fill(ctx, 'lamp.1', bx - 3, by, 7, 1);
    // curl arrow
    const dir = this.turn;
    pixLine(ctx, bx + 6, by, bx + 12, by + dir * 6, 'yellow.2');
    fill(ctx, 'yellow.2', bx + 11, by + dir * 6 - 1, 3, 3);
    text(ctx, dir > 0 ? 'CURLS DOWN' : 'CURLS UP', bx - 20, by + (dir > 0 ? -12 : 7), 'blue.1', { shadow: null });
    // the thrower crouched behind the stone at the release point
    if (this.sx(0) > -20) {
      fill(ctx, 'grey.1', fx - 15, fy - 5, 10, 10);
      fill(ctx, this.myCol, fx - 14, fy - 4, 8, 8);
      fill(ctx, this.myLight, fx - 14, fy - 4, 8, 1);
      circle(ctx, fx - 6, fy, 2.5, 'hair.1');
      pixLine(ctx, fx - 10, fy + 4, fx - 3, fy + 1, this.skin);   // arm on the handle
      pixLine(ctx, fx - 12, fy - 4, fx - 2, fy - 14, 'orange.1'); // broom held out
      this.drawStone(ctx, { team: 'me' }, fx, fy, CURL.r * S);
    }
  }

  drawGauge(ctx) {
    const g = GAUGE;
    panel(ctx, g.x - 4, g.y - 4, g.w + 8, 22, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    fill(ctx, 'grey.2', g.x, g.y, g.w, 6);
    for (const [label, a, b, col] of ZONES) {
      fill(ctx, col, g.x + a * g.w, g.y, (b - a) * g.w, 6);
      text(ctx, label, g.x + ((a + b) / 2) * g.w, g.y + 8, 'grey.4', { align: 'center', shadow: null });
    }
    if (this.state === 'weight') {
      const m = Math.round(g.x + this.weight * g.w);
      fill(ctx, 'grey.6', m - 1, g.y - 2, 3, 10);
      fill(ctx, 'grey.0', m, g.y - 1, 1, 8);
    } else text(ctx, 'WEIGHT', g.x - 8, g.y - 1, 'grey.5', { align: 'right' });
  }

  drawCard(ctx) {
    const w = 84, x = W - w - 4, y = 14;
    panel(ctx, x, y, w, 20, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (let e = 0; e < ENDS; e++) {
      const v = this.endScores[e];
      text(ctx, v == null ? '-' : `${v}`, x + 6 + e * 12, y + 3, v == null ? 'grey.3' : v ? 'yellow.2' : 'lamp.2', { shadow: null });
    }
    text(ctx, 'TOTAL', x + 4, y + 11, 'grey.4', { shadow: null });
    text(ctx, `${this.total}`, x + w - 4, y + 11, 'cyan.2', { align: 'right' });
    // stones left this end
    for (let i = 0; i < CURL.perEnd; i++) circle(ctx, x - 8 - i * 9, y + 10, 3, i < CURL.perEnd - this.thrown ? this.myCol : 'grey.2');
  }

  drawMinimap(ctx) {
    const top = MY - (CURL.width / 2) * MYS, h = CURL.width * MYS;
    panel(ctx, MX - 3, top - 3, 31 * MS + 6, h + 6, { bg: 'grey.6', edge: 'grey.4', shadow: 'grey.3' });
    const tx = MX + CURL.tee * MS;
    for (const [r, col] of [[1.83, 'blue.2'], [1.22, 'grey.6'], [0.61, 'lamp.1']]) {
      fill(ctx, col, tx - r * MS, MY - Math.min(r * MYS, h / 2), r * MS * 2, Math.min(r * MYS, h / 2) * 2);
    }
    fill(ctx, 'lamp.1', MX + CURL.hog * MS, top, 1, h);
    fill(ctx, 'lamp.1', MX, top, 1, h);
    fill(ctx, 'blue.1', MX + CURL.back * MS, top, 1, h);
    // view window
    const vx = MX + (this.camX - (W / 2 - 40) / S) * MS;
    pixLine(ctx, vx, top - 2, vx + (W / S) * MS, top - 2, 'grey.0');
    for (const s of this.stones) if (!s.out) circle(ctx, MX + s.x * MS, MY + s.y * MYS, 1.5, s.team === 'me' ? this.myCol : 'yellow.1');
  }
}
