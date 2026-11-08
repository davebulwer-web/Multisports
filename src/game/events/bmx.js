// BMX — pumping and air control on a dirt track by the beach. Hold DOWN to
// pump down the backs of the bumps, UP to pop off each lip, then in the air
// LEFT/RIGHT to pitch the bike and SPACE (superman) or DOWN (can-can) for
// tricks. Let go in time and land matching the slope. Beat the clock.
import { Scene } from '../../engine/game.js';
import { fill, panel, text, meter, pixLine, circle, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { BMX, TRACK, Bmx, groundY, slopeAt } from '../sim/bmx.js';
import { playerSheet } from '../assets.js';
import { topBar, banner, fmtPts } from '../hud.js';
import { beachSky, beachSea, beachSand } from '../beach.js';

const PX = 14;          // pixels per metre
const BASE = 192;       // screen y of track height 0
const RX = 120;         // screen x of the rider
const DEG = Math.PI / 180;

export class BmxScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.b = new Bmx();
    this.sheet = playerSheet(o.player);
    this.state = 'ready';
    this.stateT = 0;
    this.t = 0;
    this.pops = [];
    this.excite = 0.2;
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    this.pops = this.pops.filter((p) => (p.t += dt) < 1.1);
    const b = this.b;
    switch (this.state) {
      case 'ready':
        if (this.stateT > 0.4 && input.confirm()) { this.state = 'ride'; this.stateT = 0; sfx.gun(); }
        break;
      case 'ride': {
        if (input.wasPressed('up')) b.pop();
        const air = b.air;
        const u = {
          pump: !air && input.isDown('down'),
          pedal: !air && input.isDown('a'),
          pitch: air ? (input.isDown('left') ? 1 : 0) - (input.isDown('right') ? 1 : 0) : 0,
          trick: air ? (input.isDown('a') ? 'super' : input.isDown('down') ? 'cancan' : null) : null,
        };
        for (const e of b.update(dt, u)) this.onEvent(e);
        this.excite = Math.min(0.8, 0.2 + b.v / 20 + (b.air ? 0.3 : 0));
        break;
      }
      case 'done':
        if (this.stateT > 5 || (this.stateT > 1 && input.confirm())) this.o.onDone(b.score);
        break;
    }
  }

  pop(msg, col) { this.pops.push({ msg, col, t: 0 }); }

  onEvent(e) {
    switch (e.type) {
      case 'air': sfx.whoosh(); if (e.popped) this.pop('POP!', 'cyan.2'); break;
      case 'land': {
        sfx.step(true);
        const names = e.tricks.map((t) => (t === 'super' ? 'SUPERMAN' : 'CAN-CAN'));
        this.pop(`${names.length ? names.join(' + ') : 'CLEAN'} +${e.pts}`, names.length ? 'green.2' : 'yellow.2');
        if (names.length) sfx.crowd(0.5, 0.8);
        break;
      }
      case 'cased': sfx.thud(); this.pop('CASED IT!', 'orange.3'); break;
      case 'crash': sfx.thud(); sfx.bad(); this.pop(e.why, 'lamp.2'); break;
      case 'finish':
        this.end();
        this.pop(`TIME BONUS +${e.bonus}`, 'yellow.2');
        break;
      case 'time': sfx.bad(); this.end(); break;
    }
  }

  end() {
    this.state = 'done'; this.stateT = 0;
    this.newRecord = this.b.score > 0 && (this.o.record == null || this.b.score > this.o.record);
    if (this.newRecord) sfx.fanfare(); else sfx.jingle();
    sfx.crowd(0.7, 1.6);
    this.excite = 0.9;
  }

  // ---- drawing --------------------------------------------------------------

  draw(ctx) {
    const b = this.b, cam = b.x * PX - RX;
    beachSky(ctx, this.t, 70);
    beachSea(ctx, this.t, 70, 98, cam);
    beachSand(ctx, this.t, 98, H, { camX: cam, par: 0.5, excite: this.excite, props: true, boards: 'bmx' });
    this.drawTrack(ctx, cam);
    this.drawRider(ctx, cam);
    for (const p of this.pops) text(ctx, p.msg, RX, 92 - p.t * 14, p.col, { align: 'center' });

    const left = Math.max(0, BMX.limit - b.t);
    topBar(ctx, 'BMX', this.o.player.name, fmtPts(b.score));
    this.drawHud(ctx, left);
    if (this.state === 'ready') banner(ctx, 'PRESS SPACE', 36, 'yellow.2', 'DOWN PUMPS, UP POPS, SPACE PEDALS');
    if (this.state === 'ride' && this.stateT < 3) text(ctx, 'HOLD DOWN ROLLING DOWN EACH BUMP TO PUMP', W / 2, 40, 'grey.6', { align: 'center' });
    if (this.state === 'done') banner(ctx, fmtPts(b.score), 36, 'yellow.2', this.newRecord ? 'NEW RECORD!' : b.timeUp ? 'OUT OF TIME' : `${b.stats.clean} CLEAN JUMPS  ${b.stats.crashes} CRASHES`);
  }

  drawTrack(ctx, cam) {
    // dirt from the profile down, with a darker packed line on top
    for (let sx = 0; sx < W; sx++) {
      const m = (sx + cam) / PX;
      const y = Math.round(BASE - groundY(m) * PX);
      fill(ctx, 'orange.1', sx, y, 1, H - y);
      fill(ctx, 'orange.0', sx, y, 1, 2);
      if ((sx + Math.round(cam)) % 7 === 0) fill(ctx, 'orange.2', sx, y + 6 + ((sx * 13) % 9), 1, 1);
    }
    // start gate and finish banner
    const gx = Math.round(0 - cam);
    if (gx > -20) { fill(ctx, 'grey.4', gx + 2, BASE - 2 * PX - 22, 2, 22); fill(ctx, 'lamp.1', gx + 4, BASE - 2 * PX - 22, 10, 6); }
    const fx = Math.round(TRACK.finish * PX - cam);
    if (fx > -30 && fx < W + 30) {
      fill(ctx, 'grey.5', fx - 20, BASE - 44, 2, 44);
      fill(ctx, 'grey.5', fx + 20, BASE - 44, 2, 44);
      for (let i = 0; i < 10; i++) fill(ctx, i % 2 ? 'grey.0' : 'grey.6', fx - 20 + i * 4, BASE - 46, 4, 6);
      text(ctx, 'FINISH', fx + 1, BASE - 56, 'yellow.2', { align: 'center' });
    }
  }

  drawRider(ctx, cam) {
    const b = this.b, sh = this.sheet;
    const sx = Math.round(b.x * PX - cam), sy = Math.round(BASE - b.y * PX);
    if (b.down > 0) {
      // sprawled on the dirt, bike on its side
      circle(ctx, sx - 12, sy - 4, 4, 'grey.1'); circle(ctx, sx + 4, sy - 4, 4, 'grey.1');
      pixLine(ctx, sx - 12, sy - 4, sx + 4, sy - 4, 'lamp.1');
      sh.draw(ctx, sh.tag('ski_fall').from, sx + 6, sy + 1);
      return;
    }
    let tag = 'bmx_ride';
    if (this.state === 'done' && !b.air) tag = 'bmx_ride';
    else if (b.air) tag = b.trick === 'super' ? 'bmx_super' : b.trick === 'cancan' ? 'bmx_cancan' : 'bmx_air';
    else if (this.state === 'ride' && slopeAt(b.x) < -0.02 && this.pumping) tag = 'bmx_pump';
    const idx = sh.tag(tag).from;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-b.pitch * DEG);
    // bike: two wheels, frame, bars up to the rider's hands
    const hand = sh.anchor(idx, 'handF') || { x: 8, y: -28 };
    const wr = 5, wy = -wr;
    for (const wx of [-10, 10]) {
      circle(ctx, wx, wy, wr, 'grey.0');
      circle(ctx, wx, wy, wr - 1, 'grey.4');
      circle(ctx, wx, wy, wr - 2, 'grey.0');
      fill(ctx, 'grey.5', wx, wy, 1, 1);
    }
    pixLine(ctx, -10, wy, 0, wy - 2, 'lamp.1');        // chain stay
    pixLine(ctx, 0, wy - 2, 7, wy - 9, 'lamp.1');       // down tube
    pixLine(ctx, -6, wy - 7, 7, wy - 9, 'lamp.1');      // top tube
    pixLine(ctx, -10, wy, -6, wy - 7, 'lamp.1');        // seat stay
    pixLine(ctx, 10, wy, 7, wy - 9, 'grey.5');          // forks
    pixLine(ctx, 7, wy - 9, hand.x, hand.y + 2, 'grey.5'); // stem to the bars
    fill(ctx, 'grey.1', hand.x - 1, hand.y + 1, 3, 2);
    sh.draw(ctx, idx, -2, -5);
    ctx.restore();
  }

  get pumping() { return this.game.input?.isDown('down'); }

  drawHud(ctx, left) {
    const b = this.b, by = 14;
    panel(ctx, 4, by, 132, 32, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'TIME', 8, by + 3, 'grey.4', { shadow: null });
    text(ctx, `${left.toFixed(1)}S`, 40, by + 3, left < 10 ? 'lamp.2' : 'grey.6', { shadow: null });
    text(ctx, 'SPEED', 8, by + 12, 'grey.4', { shadow: null });
    meter(ctx, 44, by + 13, 84, 4, b.v / 11, { fg: 'cyan.1' });
    // pump hint: green while rolling downhill, red going up
    if (!b.air && b.down <= 0) {
      const sl = slopeAt(b.x);
      const msg = sl < -0.02 ? 'PUMP NOW' : sl > 0.02 ? 'EASE OFF' : 'PEDAL';
      text(ctx, msg, 8, by + 22, sl < -0.02 ? 'green.2' : sl > 0.02 ? 'orange.3' : 'grey.5', { shadow: null });
    }
    if (b.air) {
      // pitch against the slope you'll land on
      const want = Math.atan(slopeAt(b.x + b.vx * 0.3)) / DEG, err = b.pitch - want;
      const ok = Math.abs(err) <= BMX.land;
      text(ctx, ok ? (b.trick ? 'LET GO!' : 'LINED UP') : err > 0 ? 'NOSE DOWN (RIGHT)' : 'NOSE UP (LEFT)', 8, by + 22, ok && !b.trick ? 'green.2' : 'orange.3', { shadow: null });
    }
    // progress along the track
    const mx = W - 124, mw = 116;
    panel(ctx, mx - 4, by, mw + 8, 16, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (const s of TRACK.segs) if (s.type === 'jump') fill(ctx, 'orange.2', mx + (s.lip / TRACK.finish) * mw, by + 4, 2, 6);
    fill(ctx, 'grey.3', mx, by + 9, mw, 1);
    fill(ctx, 'yellow.2', mx + Math.min(1, b.x / TRACK.finish) * (mw - 3), by + 6, 3, 5);
  }
}
