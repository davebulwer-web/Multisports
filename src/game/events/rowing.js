// ROWING — rhythm and pacing over 500 metres against a rival boat. Hold
// SPACE to drive (the seat slides back), let go at the end of the slide,
// and catch again as the seat reaches the front. Hold UP during the drive
// for a power stroke: it burns stamina, so save it for the finish.
import { Scene } from '../../engine/game.js';
import { fill, dither, bands, panel, text, meter, pixLine, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { ROW, Rower, RowBot, fmtRow } from '../sim/row.js';
import { assets, athleteSheet, playerSheet } from '../assets.js';
import { topBar, banner } from '../hud.js';
import { drawBoardRow } from '../boards.js';
import { hash } from '../winter.js';

const PX = 7;           // pixels per metre
const BX = 150;         // screen x of the player's boat (bow)
const LANE_NEAR = 176;  // waterline of the player's boat
const LANE_FAR = 146;   // waterline of the rival's boat
const WATER = 124;      // top of the water

export class RowingScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.me = new Rower();
    this.bot = new RowBot(0.65);
    this.sheet = playerSheet(o.player);
    this.rivalKit = (o.player.kit + 3) % 8;
    this.rivalSheet = athleteSheet(this.rivalKit, (o.player.skin + 1) % 4);
    this.state = 'ready';
    this.stateT = 0;
    this.t = 0;
    this.falseStarts = 0;
    this.pops = [];
    this.excite = 0.15;
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    this.pops = this.pops.filter((p) => (p.t += dt) < 0.9);
    const me = this.me;
    switch (this.state) {
      case 'ready':
        if (this.stateT > 0.4 && input.confirm()) { this.state = 'set'; this.stateT = 0; this.goAt = 1.4 + Math.random() * 1.6; sfx.ready(); }
        break;
      case 'set':
        if (input.wasPressed('a')) {
          this.falseStarts++;
          sfx.bad();
          if (this.falseStarts >= 2) { this.state = 'dq'; this.stateT = 0; break; }
          this.state = 'ready'; this.stateT = 0; this.warn = true;
        } else if (this.stateT >= this.goAt) { this.state = 'race'; this.stateT = 0; sfx.gun(); }
        break;
      case 'race': {
        if (input.wasPressed('a')) {
          const r = me.catch();
          if (r) { sfx.step(r.grade === 'CLEAN'); if (r.grade !== 'CLEAN') this.pop('RUSHED', 'orange.3'); }
        }
        if (input.wasReleased('a')) {
          const r = me.release();
          if (r && r.grade === 'SHORT') this.pop('SHORT', 'orange.3');
        }
        const wasWaiting = me.waitFront;
        for (const e of me.update(dt, { power: input.isDown('up') })) this.onEvent(e);
        if (wasWaiting < 0.25 && me.waitFront >= 0.25) this.pop('CATCH!', 'yellow.2');
        if (!this.bot.r.finished) this.bot.update(dt);
        this.excite = Math.min(0.8, 0.15 + me.d / ROW.len * 0.6);
        break;
      }
      case 'done':
        if (!this.bot.r.finished) this.bot.update(dt);
        me.d += me.v * dt; me.v = Math.max(0, me.v - 1.5 * dt);
        if (this.stateT > 5 || (this.stateT > 1 && input.confirm())) this.o.onDone(Math.round(me.t * 100) / 100);
        break;
      case 'dq':
        if (this.stateT > 3 || (this.stateT > 1 && input.confirm())) this.o.onDone(null);
        break;
    }
  }

  pop(msg, col) { this.pops.push({ msg, col, t: 0 }); }

  onEvent(e) {
    if (e.type === 'crab') { sfx.thud(); this.pop('CAUGHT A CRAB!', 'lamp.2'); }
    if (e.type === 'finish') {
      this.state = 'done'; this.stateT = 0;
      this.won = !this.bot.r.finished;
      this.newRecord = this.o.record == null || this.me.t < this.o.record;
      if (this.newRecord) sfx.fanfare(); else sfx.jingle();
      sfx.crowd(0.7, 1.6);
      this.excite = 0.9;
    }
  }

  // ---- drawing --------------------------------------------------------------

  draw(ctx) {
    const cam = this.me.d * PX;
    this.drawBank(ctx, cam);
    this.drawWater(ctx, cam);
    this.drawBoat(ctx, this.bot.r, BX + (this.bot.r.d - this.me.d) * PX, LANE_FAR, this.rivalSheet, cam);
    this.drawBoat(ctx, this.me, BX, LANE_NEAR, this.sheet, cam);
    for (const p of this.pops) text(ctx, p.msg, BX - 24, LANE_NEAR - 46 - p.t * 14, p.col, { align: 'center' });

    topBar(ctx, 'ROWING', this.o.player.name, fmtRow(this.me.t));
    this.drawHud(ctx);
    if (this.state === 'ready') banner(ctx, this.warn ? 'FALSE START' : 'READY', 40, this.warn ? 'lamp.2' : 'yellow.2', 'PRESS SPACE, THEN ROW ON GO');
    if (this.state === 'set') banner(ctx, 'ATTENTION', 40, 'yellow.2');
    if (this.state === 'race' && this.stateT < 3) text(ctx, 'HOLD SPACE TO DRIVE, LET GO AT THE BACK', W / 2, 40, 'grey.6', { align: 'center' });
    if (this.state === 'race' && this.me.d > ROW.len - 150 && this.me.d < ROW.len - 120) text(ctx, 'SPRINT! HOLD UP ON THE DRIVE', W / 2, 40, Math.floor(this.t * 4) % 2 ? 'yellow.2' : 'grey.6', { align: 'center' });
    if (this.state === 'dq') banner(ctx, 'DISQUALIFIED', 40, 'lamp.2', 'TWO FALSE STARTS');
    if (this.state === 'done') banner(ctx, fmtRow(this.me.t), 40, 'yellow.2', this.newRecord ? 'NEW RECORD!' : this.won ? 'YOU BEAT THE RIVAL BOAT' : `${this.me.stats.clean} CLEAN CATCHES  ${this.me.stats.crabs} CRABS`);
  }

  drawBank(ctx, cam) {
    bands(ctx, ['sky.0', 'sky.1', 'sky.2', 'sky.3'], 0, 0, W, 64);
    // distant trees, then the grandstand bank with crowd and boards
    const tx = cam * 0.2;
    for (let i = Math.floor(tx / 22) - 1; i < tx / 22 + W / 22 + 2; i++) {
      const h = 10 + hash(i * 7) * 14, x = Math.round(i * 22 - tx);
      fill(ctx, 'green.0', x - 8, 76 - h, 18, h + 2);
      fill(ctx, 'green.1', x - 6, 78 - h, 10, 4);
    }
    fill(ctx, 'grass.1', 0, 76, W, 48);
    const sx = cam * 0.6;
    dither(ctx, 'grey.2', 'grey.1', 0, 80, W, 22);
    const c0 = Math.floor(sx / 9) - 1;
    for (let r = 0; r < 2; r++) {
      for (let c = c0; c < c0 + W / 9 + 3; c++) {
        const h = hash(c * 31 + r * 7);
        if (h < 0.2) continue;
        const tag = assets.props.tags[`fan_${Math.floor(h * 8)}`];
        const cheer = hash(c + r * 51) < this.excite;
        assets.props.draw(ctx, tag.from + (cheer && Math.floor(this.t * 4 + h * 4) % 2 ? 1 : 0), Math.round(c * 9 + r * 4 - sx), 82 + r * 8);
      }
    }
    fill(ctx, 'grey.6', 0, 103, W, 1);
    drawBoardRow(ctx, cam * 0.8, 104, { season: 'summer', salt: 'rowing' });
    fill(ctx, 'grass.2', 0, 120, W, 4);
    // distance markers on the bank
    for (let m = 100; m <= ROW.len; m += 100) {
      const x = Math.round(BX + (m - this.me.d) * PX * 0.8);
      if (x < -20 || x > W + 20) continue;
      fill(ctx, 'grey.0', x - 13, 64, 26, 10);
      fill(ctx, m === ROW.len ? 'lamp.0' : 'blue.1', x - 12, 65, 24, 8);
      text(ctx, m === ROW.len ? 'END' : `${m}M`, x, 66, 'grey.6', { align: 'center', shadow: null });
    }
  }

  drawWater(ctx, cam) {
    fill(ctx, 'sky.0', 0, WATER, W, H - WATER);
    dither(ctx, 'sky.0', 'sky.1', 0, WATER, W, 6);
    // ripples scroll with the water
    for (let i = 0; i < 70; i++) {
      const y = WATER + 8 + Math.floor(hash(i * 3) * (H - WATER - 10));
      const par = 0.6 + (y - WATER) / (H - WATER) * 0.5;
      const x = ((hash(i * 5) * 600 - cam * par) % 600 + 600) % 600 - 100;
      fill(ctx, hash(i) < 0.5 ? 'sky.1' : 'cyan.0', x, y, 6 + hash(i * 9) * 8, 1);
    }
    // lane ropes of buoys between and outside the lanes
    for (const y of [LANE_FAR - 16, LANE_FAR + 14, LANE_NEAR + 18]) {
      const par = 0.85 + (y - WATER) / (H - WATER) * 0.3;
      for (let x = -((cam * par) % 10); x < W; x += 10) fill(ctx, Math.floor((x + cam * par) / 10) % 4 ? 'yellow.1' : 'lamp.1', Math.round(x), y, 3, 2);
    }
    // finish line across the water
    const fx = Math.round(BX + (ROW.len - this.me.d) * PX);
    if (fx > -4 && fx < W + 4) for (let y = WATER; y < H; y += 4) fill(ctx, (y / 4) % 2 ? 'lamp.1' : 'grey.6', fx, y, 2, 2);
  }

  /** A single scull: bow at bx, waterline y. The rower slides on the seat. */
  drawBoat(ctx, r, bx, y, sheet, cam) {
    if (bx < -80 || bx > W + 80) return;
    const len = 62;
    // wake behind the boat when moving
    if (r.v > 1) for (let i = 0; i < 4; i++) fill(ctx, 'grey.6', bx - len - 6 - i * 7 - ((this.t * 30) % 7), y + 1 + (i % 2), 5, 1);
    // hull
    fill(ctx, 'grey.0', bx - len, y - 2, len, 4);
    fill(ctx, 'grey.6', bx - len + 1, y - 2, len - 3, 2);
    fill(ctx, 'grey.4', bx - len + 1, y, len - 3, 1);
    fill(ctx, 'lamp.1', bx - 2, y - 2, 2, 2);
    fill(ctx, 'grey.0', bx - len + 6, y - 3, len - 16, 1);
    // rower: the seat slides back as the drive goes on
    const seatX = bx - 34 - r.slide * 7, seatY = y - 4;
    const tag = sheet.tag('rw_stroke');
    let k;
    if (r.phase === 'drive') k = r.slide < 0.3 ? 0 : r.slide < 0.8 ? 1 : 2;
    else if (r.phase === 'crab') k = 2;
    else if (r.phase === 'ready') k = 0;
    else k = r.slide > 0.85 ? 2 : r.slide > 0.15 ? 3 : 0;
    const idx = tag.from + k;
    const hip = sheet.anchor(idx, 'hip') || { x: -8, y: -11 };
    const px = seatX - hip.x, py = seatY - hip.y;
    fill(ctx, 'grey.1', seatX - 3, seatY + 1, 7, 2);
    // the far oar behind the rower, the near one in front
    const hand = sheet.anchor(idx, 'handF') || { x: 4, y: -24 };
    const hx = px + hand.x, hy = py + hand.y;
    const pinX = bx - 28, pinY = y - 6;
    const inWater = r.phase === 'drive' || r.phase === 'crab';
    const bladeX = pinX - (hx - pinX) * 1.6, bladeY = y + (inWater ? 3 : -5);
    pixLine(ctx, hx, hy - 1, pinX, pinY - 1, 'grey.3');
    sheet.draw(ctx, idx, px, py);
    pixLine(ctx, hx, hy, pinX, pinY, 'grey.5');
    pixLine(ctx, pinX, pinY, bladeX, bladeY + 4, 'grey.5');
    fill(ctx, 'grey.1', pinX - 1, pinY, 3, 2);
    fill(ctx, 'yellow.1', bladeX - 3, bladeY + 4, 6, 3);
    if (inWater && r.v > 1) fill(ctx, 'grey.6', bladeX - 5, y + 2, 10, 1);
  }

  drawHud(ctx) {
    const me = this.me, by = 14;
    panel(ctx, 4, by, 150, 40, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'SLIDE', 8, by + 3, 'grey.4', { shadow: null });
    // the slide: catch zone at the front (left), finish zone at the back (right)
    const x = 40, y = by + 4, w = 108;
    fill(ctx, 'grey.2', x, y, w, 5);
    fill(ctx, 'green.1', x, y, w * ROW.catchOk, 5);
    fill(ctx, 'green.1', x + w * ROW.finishOk, y, w * (1 - ROW.finishOk), 5);
    const m = Math.round(x + me.slide * (w - 1));
    fill(ctx, me.phase === 'drive' ? 'yellow.2' : 'grey.6', m - 1, y - 2, 3, 9);
    text(ctx, me.phase === 'drive' ? 'DRIVE' : me.phase === 'crab' ? 'CRAB!' : 'RECOVER', 8, by + 13, me.phase === 'crab' ? 'lamp.2' : 'grey.5', { shadow: null });
    text(ctx, 'STAMINA', 8, by + 23, 'grey.4', { shadow: null });
    meter(ctx, 54, by + 24, 94, 4, me.stamina, { fg: me.stamina < ROW.tired ? 'lamp.1' : me.power ? 'yellow.1' : 'green.2' });
    const rate = me.t > 2 ? Math.round(me.strokes / me.t * 60) : 0;
    text(ctx, `${(me.v * 3.6).toFixed(1)}KM/H  RATE ${rate}`, 8, by + 31, 'cyan.2', { shadow: null });
    // race map: both boats along the course
    const mx = W - 124, mw = 116;
    panel(ctx, mx - 4, by, mw + 8, 26, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    fill(ctx, 'sky.0', mx, by + 6, mw, 12);
    fill(ctx, 'lamp.1', mx + mw - 1, by + 6, 1, 12);
    const dot = (d, yy, col) => fill(ctx, col, mx + Math.min(1, d / ROW.len) * (mw - 4), yy, 4, 3);
    dot(this.bot.r.d, by + 8, 'grey.4');
    dot(me.d, by + 13, 'yellow.2');
    const gap = me.d - this.bot.r.d;
    text(ctx, `${Math.floor(me.d)}M`, mx, by + 19, 'grey.6', { shadow: null });
    text(ctx, `${gap >= 0 ? '+' : ''}${gap.toFixed(1)}M`, mx + mw, by + 19, gap >= 0 ? 'green.2' : 'orange.3', { align: 'right', shadow: null });
  }
}
