// LOG ROLLING — balance and bluff. You and a rival share a spinning log.
// LEFT/RIGHT lean to keep your balance; UP/DOWN change the log's pace. Your
// feet catch up faster with your own changes than with your rival's, so a
// sudden change (best when they're already leaning) tips them in. First to
// two dunkings wins; quick wins score more.
import { Scene } from '../../engine/game.js';
import { fill, bands, dither, panel, text, circle, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { LOG, LogRoll, roundPoints } from '../sim/logroll.js';
import { assets, athleteSheet, playerSheet, drawScenery } from '../assets.js';
import { topBar, banner, fmtPts } from '../hud.js';
import { drawBoardRow } from '../boards.js';
import { hash } from '../winter.js';

const LOG_Y = 156;       // top of the log
const LOG_R = 8;         // radius in pixels
const PX_ = 150, RX_ = 234; // where the rollers stand
const WATER = 150;
const RIVAL_SKILL = 0.5;

export class LogRollScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.g = new LogRoll({ skill: RIVAL_SKILL });
    this.sheet = playerSheet(o.player);
    this.rival = athleteSheet((o.player.kit + 4) % 8, (o.player.skin + 2) % 4);
    this.state = 'ready';
    this.stateT = 0;
    this.t = 0;
    this.spin = 0;          // log surface travel, for the bark stripes
    this.points = 0;
    this.splash = null;
    this.excite = 0.2;
    this.stepP = 0; this.stepR = 0;
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    const g = this.g;
    switch (this.state) {
      case 'ready':
        if (this.stateT > 0.4 && input.confirm()) { this.state = 'roll'; this.stateT = 0; sfx.gun(); }
        break;
      case 'roll': {
        const lean = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
        const push = (input.isDown('up') ? 1 : 0) - (input.isDown('down') ? 1 : 0);
        for (const e of g.update(dt, { lean, push })) {
          if (e.type !== 'over') continue;
          this.state = 'dunk'; this.stateT = 0;
          this.winner = e.winner;
          if (e.winner === 'player') { this.won = roundPoints(e.t); this.points += this.won; sfx.crowd(0.8, 1.6); }
          else this.won = 0;
          if (!g.bell) { sfx.thud(); this.splash = { x: e.winner === 'player' ? RX_ : PX_, t: 0 }; }
          else sfx.blip();
        }
        this.spin += g.u * dt;
        this.excite = Math.min(0.8, 0.2 + Math.max(Math.abs(g.p.lean), Math.abs(g.r.lean)) * 0.6);
        break;
      }
      case 'dunk':
        if (this.splash) this.splash.t += dt;
        if (this.stateT > 2.6 || (this.stateT > 1 && input.confirm())) {
          if (g.finished) { this.state = 'done'; this.stateT = 0; this.finish(); }
          else { g.newRound(); this.splash = null; this.state = 'roll'; this.stateT = 0; sfx.ready(); }
        }
        break;
      case 'done':
        if (this.stateT > 5 || (this.stateT > 1 && input.confirm())) this.o.onDone(this.points);
        break;
    }
    // stepping animation follows the log's pace
    const step = Math.abs(g.u) * dt * 3.2;
    this.stepP += step; this.stepR += step;
  }

  finish() {
    this.newRecord = this.points > 0 && (this.o.record == null || this.points > this.o.record);
    if (this.newRecord) sfx.fanfare(); else if (this.g.score[0] >= LOG.wins) sfx.jingle(); else sfx.fail();
    this.excite = 0.9;
  }

  // ---- drawing --------------------------------------------------------------

  draw(ctx) {
    this.drawLake(ctx);
    this.drawLog(ctx);
    const g = this.g, down = this.state === 'dunk' || this.state === 'done';
    this.drawRoller(ctx, this.sheet, PX_, g.p, false, this.stepP, down && this.winner === 'rival' && !g.bell);
    this.drawRoller(ctx, this.rival, RX_, g.r, true, this.stepR + 0.5, down && this.winner === 'player' && !g.bell);
    this.drawSplash(ctx);

    topBar(ctx, 'LOG ROLLING', this.o.player.name, fmtPts(this.points));
    this.drawHud(ctx);
    if (this.state === 'ready') banner(ctx, 'PRESS SPACE', 36, 'yellow.2', 'LEFT/RIGHT BALANCE  UP/DOWN CHANGE PACE');
    if (this.state === 'roll' && this.stateT < 2) banner(ctx, `ROUND ${g.roundNo}`, 36, 'yellow.2');
    if (this.state === 'dunk') {
      const you = this.winner === 'player';
      banner(ctx, g.bell ? 'TIME!' : you ? 'SPLASH!' : 'IN YOU GO!', 36, you ? 'yellow.2' : 'lamp.2', you ? `+${this.won} POINTS` : g.bell ? 'JUDGES: RIVAL WAS STEADIER' : 'ROUND TO THE RIVAL');
    }
    if (this.state === 'done') {
      const won = g.score[0] >= LOG.wins;
      banner(ctx, won ? 'YOU WIN!' : 'BEATEN', 36, won ? 'yellow.2' : 'lamp.2', this.newRecord ? 'NEW RECORD!' : `${g.score[0]}-${g.score[1]}  ${fmtPts(this.points)}`);
    }
  }

  drawLake(ctx) {
    bands(ctx, ['sky.0', 'sky.1', 'sky.2', 'sky.3'], 0, 0, W, 70);
    // far shore with pines
    fill(ctx, 'green.0', 0, 70, W, 30);
    for (let i = 0; i < 14; i++) drawScenery(ctx, ['pine_12', 'pine_18', 'pine_26'][i % 3], Math.round(i * 30 + hash(i) * 14 - 10), 96);
    // the dock: crowd and boards
    dither(ctx, 'orange.1', 'orange.0', 0, 100, W, 22);
    for (let r = 0; r < 2; r++) {
      for (let c = -1; c < W / 9 + 2; c++) {
        const h = hash(c * 23 + r * 5);
        if (h < 0.15) continue;
        const tag = assets.props.tags[`fan_${Math.floor(h * 8)}`];
        const cheer = hash(c + r * 41) < this.excite;
        assets.props.draw(ctx, tag.from + (cheer && Math.floor(this.t * 4 + h * 4) % 2 ? 1 : 0), Math.round(c * 9 + r * 4), 96 + r * 8);
      }
    }
    fill(ctx, 'orange.3', 0, 120, W, 1);
    drawBoardRow(ctx, 20, 121, { season: 'world', salt: 'logroll' });
    fill(ctx, 'orange.0', 0, 137, W, 3);
    for (let x = 6; x < W; x += 24) fill(ctx, 'orange.0', x, 140, 3, 10);
    // water
    fill(ctx, 'sky.0', 0, WATER - 10, W, H - WATER + 10);
    dither(ctx, 'sky.0', 'sky.1', 0, WATER - 10, W, 4);
    for (let i = 0; i < 40; i++) {
      const y = WATER - 4 + Math.floor(hash(i * 3) * (H - WATER));
      const x = ((hash(i * 5) * 500 + this.t * (6 + hash(i) * 6)) % 500) - 60;
      fill(ctx, hash(i) < 0.5 ? 'sky.1' : 'cyan.0', x, y, 6 + hash(i * 9) * 10, 1);
    }
  }

  drawLog(ctx) {
    const x0 = 96, x1 = 288, y = LOG_Y;
    // the log floats with its lower half in the water
    fill(ctx, 'grey.0', x0 - 1, y - 1, x1 - x0 + 2, LOG_R * 2 + 2);
    fill(ctx, 'orange.1', x0, y, x1 - x0, LOG_R * 2);
    fill(ctx, 'orange.2', x0, y + 1, x1 - x0, 3);
    fill(ctx, 'orange.0', x0, y + LOG_R * 2 - 3, x1 - x0, 3);
    // bark grooves slide over the top as it spins
    for (let i = 0; i < 6; i++) {
      const ph = ((this.spin * 3 + i / 6) % 1 + 1) % 1;
      const yy = y + Math.round((1 - Math.cos(ph * Math.PI)) / 2 * (LOG_R * 2 - 1));
      for (let x = x0 + (i * 13) % 20; x < x1 - 4; x += 20) fill(ctx, 'orange.0', x, yy, 7, 1);
    }
    // end grain
    circle(ctx, x1, y + LOG_R, LOG_R, 'orange.3');
    circle(ctx, x1, y + LOG_R, LOG_R - 3, 'orange.2');
    circle(ctx, x1, y + LOG_R, 2, 'orange.1');
    // waterline over the bottom of the log
    dither(ctx, 'sky.0', 'sky.1', x0 - 2, y + LOG_R + 3, x1 - x0 + 12, 3);
    fill(ctx, 'sky.0', x0 - 2, y + LOG_R + 6, x1 - x0 + 12, LOG_R);
    fill(ctx, 'grey.6', x0 - 4, y + LOG_R + 3, 3, 1);
    fill(ctx, 'grey.6', x1 + 9, y + LOG_R + 3, 3, 1);
  }

  drawRoller(ctx, sheet, x, ro, flip, step, inWater) {
    if (inWater) {
      // bobbing in the water in front of the log
      if (this.splash && this.splash.t < 0.35) return;
      const swim = sheet.tag('ac_swim');
      sheet.draw(ctx, swim.from + (Math.floor(this.t * 3) % 2), x, WATER + 52 + Math.sin(this.t * 3) * 1.5, { flip });
      return;
    }
    const run = sheet.tag('lr_run');
    const g = this.g;
    const idx = this.state === 'done' && ((flip && g.score[1] >= LOG.wins) || (!flip && g.score[0] >= LOG.wins))
      ? sheet.tag('celebrate').from + (Math.floor(this.t * 4) % 2)
      : Math.abs(g.u) < 0.15 ? sheet.tag('idle').from : run.from + (Math.floor(step * 4) % 4);
    ctx.save();
    ctx.translate(x, LOG_Y + 1);
    ctx.rotate(ro.lean * 0.6);
    sheet.draw(ctx, idx, 0, 0, { flip });
    ctx.restore();
  }

  drawSplash(ctx) {
    const s = this.splash;
    if (!s || s.t > 1.2) return;
    const u = s.t / 1.2;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI;
      const r = 6 + u * 26;
      const x = s.x + Math.cos(a) * r, y = LOG_Y + 8 - Math.sin(a) * r * (1 - u) * 1.4;
      fill(ctx, i % 2 ? 'grey.6' : 'cyan.2', x, y, 2, 2);
    }
  }

  drawHud(ctx) {
    const g = this.g, by = 14;
    // balance gauges: the marker must stay off the red ends
    const gauge = (x, label, ro, col) => {
      panel(ctx, x, by, 96, 20, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
      text(ctx, label, x + 4, by + 3, col, { shadow: null });
      const gx = x + 4, gw = 88, gy = by + 12;
      fill(ctx, 'lamp.0', gx, gy, gw, 4);
      fill(ctx, 'grey.2', gx + 10, gy, gw - 20, 4);
      fill(ctx, 'green.1', gx + gw / 2 - 12, gy, 24, 4);
      const m = Math.round(gx + gw / 2 + Math.max(-1, Math.min(1, ro.lean)) * (gw / 2));
      fill(ctx, 'grey.6', m - 1, gy - 2, 3, 8);
    };
    gauge(4, 'YOUR BALANCE', g.p, 'yellow.2');
    gauge(W - 100, 'RIVAL', g.r, 'grey.5');
    // the log's pace, centred on still
    const px = W / 2 - 60;
    panel(ctx, px, by, 120, 20, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'PACE', px + 4, by + 3, 'grey.4', { shadow: null });
    text(ctx, `${g.score[0]}-${g.score[1]}`, px + 116, by + 3, 'yellow.2', { align: 'right', shadow: null });
    const mx = px + 4, mw = 112, my = by + 12;
    fill(ctx, 'grey.2', mx, my, mw, 4);
    fill(ctx, 'grey.4', mx + mw / 2, my - 1, 1, 6);
    const pos = (u) => mx + mw / 2 + (u / LOG.uMax) * (mw / 2);
    fill(ctx, 'cyan.1', Math.min(pos(0), pos(g.u)), my, Math.abs(pos(g.u) - pos(0)), 4);
    fill(ctx, 'yellow.2', Math.round(pos(g.target)) - 1, my - 2, 2, 8);
    if (this.state === 'roll') {
      const left = Math.max(0, Math.ceil(LOG.round - g.t));
      text(ctx, `${left}`, W / 2, by + 24, left <= 10 ? 'orange.3' : 'grey.5', { align: 'center' });
    }
  }
}
