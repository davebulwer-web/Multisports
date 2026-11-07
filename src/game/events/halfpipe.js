// HALF-PIPE — pumping and air control. Press SPACE as you roll off the flat
// into each wall to pump up speed. Fly off the coping, hold LEFT or RIGHT
// to spin and UP to grab, and let go in time to land facing along the ramp.
// Two timed runs; every air is scored, repeats are worth less.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, dither, panel, text, meter, pixLine, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { PIPE, Skater, surface, geom } from '../sim/halfpipe.js';
import { makeRng } from '../sim/rng.js';
import { playerSheet, assets } from '../assets.js';
import { topBar, banner, fmtPts } from '../hud.js';
import { beachSky, beachSea, beachSand } from '../beach.js';
import { hash } from '../winter.js';

const PX = 18;
const CX = W / 2;
const GROUND = 198;
const G = geom();
const DEG = Math.PI / 180;

const sx = (x) => CX + x * PX;
const sy = (h) => GROUND - h * PX;

export class HalfPipeScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.rng = makeRng();
    this.runs = [];
    this.anim = new Anim(playerSheet(o.player), 'skate_ride');
    this.t = 0;
    this.newRun();
  }

  get total() { return this.runs.reduce((a, r) => a + r.score, 0); }

  newRun() {
    this.sk = new Skater(this.rng);
    this.state = 'ready';
    this.stateT = 0;
    this.feed = [];
    this.excite = 0.15;
    this.pumpMsg = null;
    this.anim.play('skate_ride');
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    this.feed = this.feed.filter((f) => (f.t += dt) < 2.5);
    if (this.pumpMsg && (this.pumpMsg.t += dt) > 0.8) this.pumpMsg = null;
    const sk = this.sk;
    switch (this.state) {
      case 'ready':
        if (this.stateT > 0.4 && input.confirm()) { this.state = 'run'; this.stateT = 0; sfx.ready(); }
        break;
      case 'run': {
        const spin = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
        for (const e of sk.update(dt, { pump: input.wasPressed('a'), spin, grab: input.isDown('up') })) this.onEvent(e);
        if (sk.slam > 0) this.anim.play('stumble');
        else if (sk.air) this.anim.play(sk.air.grabbed && sk.air.letGo === 0 ? 'skate_grab' : 'skate_air');
        else this.anim.play(sk.crouch > 0 ? 'skate_pump' : 'skate_ride');
        this.excite = Math.max(0.1, this.excite - dt * 0.15);
        break;
      }
      case 'end':
        if (this.stateT > 4.5 || (this.stateT > 0.8 && input.confirm())) {
          if (this.runs.length >= PIPE.runs) return this.o.onDone(this.total);
          this.newRun();
        }
        break;
    }
    this.anim.update(dt * 1000);
  }

  onEvent(e) {
    const say = (msg, col) => this.feed.push({ msg, col, t: 0 });
    switch (e.type) {
      case 'pump':
        this.pumpMsg = { msg: e.q > 0 ? `PUMP ${e.grade}` : e.grade, col: e.q > 0.7 ? 'green.2' : e.q > 0 ? 'grey.6' : 'orange.3', t: 0 };
        sfx.step(e.q > 0.35);
        break;
      case 'launch': sfx.whoosh(); break;
      case 'land':
        say(`${e.name} +${e.pts}`, e.pts >= 80 ? 'yellow.2' : 'green.2');
        sfx.thud();
        if (e.pts >= 60) { sfx.crowd(0.5, 1); this.excite = 0.85; }
        break;
      case 'slam': say(`SLAM - ${e.why}`, 'lamp.2'); sfx.thud(); sfx.bad(); break;
      case 'up': this.anim.play('skate_ride'); break;
      case 'end': {
        this.runs.push({ score: this.sk.score, tricks: this.sk.tricks });
        this.state = 'end'; this.stateT = 0;
        const last = this.runs.length >= PIPE.runs;
        this.anim.play('celebrate');
        if (last && (this.o.record == null || this.total > this.o.record)) { this.newRecord = true; sfx.fanfare(); }
        else sfx.jingle();
        break;
      }
    }
  }

  // ---- drawing ------------------------------------------------------------

  draw(ctx) {
    beachSky(ctx, this.t, 96);
    beachSea(ctx, this.t, 96, 128);
    beachSand(ctx, this.t, 128, H, { crowd: false });
    this.drawRamp(ctx);
    if (this.state !== 'end') this.drawRider(ctx);
    else this.anim.draw(ctx, CX, GROUND);

    const n = Math.min(PIPE.runs, this.runs.length + (this.state === 'end' ? 0 : 1));
    topBar(ctx, 'HALF-PIPE', this.o.player.name, `RUN ${Math.max(1, n)}/${PIPE.runs}`);
    this.drawCard(ctx);
    if (this.state !== 'end') this.drawGauges(ctx);
    this.feed.slice(-3).forEach((f, i, arr) => text(ctx, f.msg, CX, 34 + (i - arr.length + 3) * 9, f.col, { align: 'center' }));
    if (this.pumpMsg) text(ctx, this.pumpMsg.msg, CX, GROUND - 24, this.pumpMsg.col, { align: 'center' });
    if (this.state === 'ready') banner(ctx, this.runs.length ? `RUN ${this.runs.length + 1}` : 'DROP IN', 60, 'yellow.2', 'SPACE TO PUMP  ARROWS SPIN  UP GRABS');
    if (this.state === 'end') this.drawEnd(ctx);
  }

  drawRamp(ctx) {
    const xc = sx(G.xc), xl = sx(-G.xc), top = Math.round(sy(G.hc));
    // decks with spectators
    for (const [x0, x1] of [[0, xl], [xc, W]]) {
      fill(ctx, 'orange.1', x0, top, x1 - x0, GROUND - top + 4);
      for (let x = x0; x < x1; x++) if ((x & 15) === 0) fill(ctx, 'orange.0', x, top + 2, 1, GROUND - top + 2);
      for (let y = top + 16; y < GROUND; y += 16) fill(ctx, 'orange.0', x0, y, x1 - x0, 1);
      fill(ctx, 'orange.3', x0, top - 1, x1 - x0, 2);
      for (let x = x0 + 5, i = 0; x < x1 - 4; x += 12, i++) {
        const k = Math.floor(hash(x) * 8), tag = assets.props.tags[`fan_${k}`];
        const cheer = hash(x + 3) < this.excite && Math.floor(this.t * 4 + i) % 2 === 0;
        assets.props.draw(ctx, tag.from + (cheer ? 1 : 0), x + 4, top - 1);
      }
      // rail
      fill(ctx, 'grey.4', x0, top - 14, x1 - x0, 1);
    }
    // the ramp itself, column by column
    for (let x = Math.ceil(xl); x <= xc; x++) {
      const m = Math.abs((x - CX) / PX);
      let h;
      if (m <= PIPE.flat) h = 0;
      else if (m < G.xc - 0.001) { const th = Math.asin(Math.min(1, (m - PIPE.flat) / PIPE.radius)); h = PIPE.radius * (1 - Math.cos(th)); }
      else h = G.hc;
      const y = Math.round(sy(h));
      fill(ctx, 'grey.5', x, y, 1, 2);
      fill(ctx, 'grey.3', x, y + 2, 1, 1);
      fill(ctx, 'orange.1', x, y + 3, 1, GROUND + 4 - y - 3);
      if ((x & 15) === 0) fill(ctx, 'orange.0', x, y + 3, 1, GROUND + 4 - y - 3);
    }
    // vertical sections and coping
    for (const s of [-1, 1]) {
      const x = Math.round(sx(s * G.xc));
      fill(ctx, 'grey.5', x - (s > 0 ? 1 : 0), Math.round(sy(G.hc)), 2, Math.round(PIPE.vert * PX) + 2);
      fill(ctx, 'grey.6', x - 2, top - 2, 4, 3); // coping
      fill(ctx, 'grey.3', x - 2, top, 4, 1);
      // pump marks where the flat meets the transition
      const px = Math.round(sx(s * PIPE.flat));
      fill(ctx, 'yellow.2', px, GROUND - 1, 1, 3);
    }
  }

  drawRider(ctx) {
    const sk = this.sk;
    if (sk.air) {
      const a = sk.air;
      const x = sx(a.side * (G.xc - 0.35)), y = sy(a.h);
      const c = Math.cos(a.rot * DEG);
      const flip = (a.f0 * (c >= 0 ? 1 : -1)) < 0;
      this.anim.draw(ctx, x, y - 3, { flip });
      // the air frames carry their own deck under the feet
      if (a.peak > 0.3) text(ctx, `${(a.h - G.hc).toFixed(1)}M`, x + (a.side > 0 ? 18 : -18), y - 30, 'grey.6', { align: 'center' });
      return;
    }
    if (this.state === 'ready') {
      // waiting on the deck, nose over the coping
      const x = sx(-G.xc - 0.6), y = sy(G.hc);
      this.anim.draw(ctx, x, y - 3);
      fill(ctx, 'grey.1', x - 8, y - 3, 16, 2);
      fill(ctx, 'lamp.1', x - 8, y - 3, 16, 1);
      return;
    }
    const p = surface(sk.s);
    const x = sx(p.x), y = sy(p.h);
    const rot = -(Math.sign(sk.s) || 0) * p.ang;
    const flip = sk.facing < 0;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(rot);
    if (sk.slam > 0) {
      this.anim.draw(ctx, 0, 0, { flip });
    } else {
      this.anim.draw(ctx, 0, -3, { flip });
      fill(ctx, 'grey.1', -8, -3, 16, 2);
      fill(ctx, 'lamp.1', -8, -3, 16, 1);
      fill(ctx, 'grey.6', -6, -1, 2, 2);
      fill(ctx, 'grey.6', 4, -1, 2, 2);
    }
    ctx.restore();
  }

  drawCard(ctx) {
    const w = 104, x = W - w - 4, y = 14;
    panel(ctx, x, y, w, 29, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (let i = 0; i < PIPE.runs; i++) {
      const live = i === this.runs.length && this.state !== 'end';
      const r = this.runs[i] || (live ? { score: this.sk.score } : null);
      text(ctx, `${i + 1} ${r ? r.score : '--'}`, x + 4, y + 3 + i * 9, live ? 'yellow.2' : 'grey.6');
    }
    text(ctx, `TOTAL ${this.total + (this.state !== 'end' ? this.sk.score : 0)}`, x + w - 4, y + 21, 'cyan.2', { align: 'right' });
  }

  drawGauges(ctx) {
    const sk = this.sk;
    panel(ctx, 4, 14, 104, 29, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'SPEED', 8, 17, 'grey.4', { shadow: null });
    const speed = sk.air ? Math.abs(sk.air.vy) : Math.abs(sk.u);
    meter(ctx, 44, 17, 60, 5, speed / 11, { fg: 'green.2' });
    text(ctx, 'TIME', 8, 27, 'grey.4', { shadow: null });
    meter(ctx, 44, 27, 60, 5, sk.timeLeft / PIPE.time, { fg: sk.timeLeft < 8 ? 'lamp.1' : 'cyan.1' });
    if (sk.air) {
      const r = sk.air.rot, half = Math.round(r / 180), off = Math.abs(r - half * 180);
      const ok = off <= PIPE.landTol;
      text(ctx, `SPIN ${Math.round(Math.abs(r))}`, CX, 50, ok ? 'green.2' : 'orange.3', { align: 'center' });
      pixLine(ctx, CX - 6, 64, CX - 6 + Math.cos(r * DEG) * 12, 64 - Math.sin(r * DEG) * 4, ok ? 'green.2' : 'orange.3');
    }
  }

  drawEnd(ctx) {
    const r = this.runs[this.runs.length - 1], x = W / 2, y = 52;
    const best = [...r.tricks].sort((a, b) => b.pts - a.pts).slice(0, 4);
    panel(ctx, x - 100, y - 6, 200, 44 + best.length * 9, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
    text(ctx, 'TIME!', x, y, 'yellow.2', { align: 'center', scale: 2 });
    text(ctx, `${r.tricks.length} AIRS  BEST:`, x, y + 17, 'grey.5', { align: 'center' });
    best.forEach((tk, i) => {
      text(ctx, tk.name, x - 80, y + 27 + i * 9, 'grey.6');
      text(ctx, `${tk.pts}`, x + 80, y + 27 + i * 9, 'cyan.2', { align: 'right' });
    });
    const last = this.runs.length >= PIPE.runs;
    text(ctx, `RUN ${r.score}   TOTAL ${fmtPts(this.total)}${last && this.newRecord ? ' RECORD!' : ''}`, x, y + 30 + best.length * 9, last && this.newRecord ? 'green.2' : 'yellow.2', { align: 'center' });
  }
}
