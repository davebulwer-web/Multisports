// FIGURE SKATING — a free skate to the music. Stroke with SPACE on the beat
// to build speed and flow, take off with UP on a beat and land with SPACE on
// the next one (more speed = more rotations), hold DOWN to spin and let go on
// a beat. Judges score the elements, the timing and the flow.
import { Scene } from '../../engine/game.js';
import { fill, dither, panel, text, meter, circle, W, H } from '../../engine/gfx.js';
import { sfx, playSong } from '../../engine/audio.js';
import { FIG, FigureSkater, beatLen, routineStart, routineEnd, offBeat } from '../sim/figure.js';
import { SKATE_WALTZ } from '../music.js';
import { assets, playerSheet } from '../assets.js';
import { topBar, banner, fmtPts } from '../hud.js';
import { drawWinterSky, hash } from '../winter.js';
import { drawBoardRow } from '../boards.js';

const PX = 9;           // pixels per metre along the rink
const ICE = 148;
const GROUND = 186;
const AX = 150;
const START_DELAY = 0.6; // seconds from pressing SPACE to the music

export class FigureScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.s = new FigureSkater();
    this.sheet = playerSheet(o.player);
    this.state = 'ready';
    this.stateT = 0;
    this.t = 0;
    this.pops = [];
    this.excite = 0.2;
    this.landT = 9;
    this.strokeT = 9;
  }

  exit() { this.song?.stop(); }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    this.pops = this.pops.filter((p) => (p.t += dt) < 1.1);
    this.landT += dt; this.strokeT += dt;
    const s = this.s;
    switch (this.state) {
      case 'ready':
        if (this.stateT > 0.4 && input.confirm()) { this.state = 'wait'; this.stateT = 0; }
        break;
      case 'wait':
        if (!this.song && this.stateT >= START_DELAY - 0.08) this.song = playSong(SKATE_WALTZ);
        if (this.stateT >= START_DELAY) { this.state = 'skate'; this.stateT = 0; this.lastBeat = -1; }
        break;
      case 'skate': {
        if (input.wasPressed('a')) {
          if (s.state === 'air') this.onLand(s.land());
          else { const r = s.stroke(); if (r) { this.strokeT = 0; sfx.step(r.q >= 1); if (r.q === 0) this.pop('OFF THE BEAT', 'orange.3'); } }
        }
        if (input.wasPressed('up')) {
          const r = s.takeoff();
          if (r?.slow) this.pop('MORE SPEED!', 'orange.3');
          else if (r) sfx.whoosh();
        }
        if (input.wasPressed('down')) s.spinStart();
        if (input.wasReleased('down')) this.onElement(s.spinEnd());
        for (const e of s.update(dt)) {
          if (e.type === 'fall') { sfx.thud(); this.pop('FALL!', 'lamp.2'); }
          else if (e.type === 'spin') this.onElement(e);
          else if (e.type === 'end') this.finish();
        }
        // a soft tick on every beat
        const k = Math.floor(s.t / beatLen());
        if (k !== this.lastBeat) { this.lastBeat = k; if (s.started && k % 3 === 0) sfx.beat(); }
        this.excite = Math.min(0.9, 0.15 + s.flow * 0.7);
        break;
      }
      case 'done':
        if (this.stateT > 6 || (this.stateT > 1.5 && input.confirm())) this.o.onDone(s.total);
        break;
    }
  }

  pop(msg, col) { this.pops.push({ msg, col, t: 0 }); }

  onLand(el) {
    if (!el) return;
    this.landT = 0;
    if (el.type === 'fall') { sfx.thud(); this.pop('FALL!', 'lamp.2'); return; }
    sfx.step(el.q >= 1);
    this.onElement(el);
  }

  onElement(el) {
    if (!el) return;
    if (el.points > 0) { this.pop(`${el.name} +${el.points}`, el.q >= 1 ? 'green.2' : 'yellow.2'); sfx.crowd(0.3, 0.6); }
    else this.pop(el.name, 'orange.3');
  }

  finish() {
    this.state = 'done'; this.stateT = 0;
    const total = this.s.total;
    this.newRecord = this.o.record == null || total > this.o.record;
    if (this.newRecord) sfx.fanfare();
    sfx.crowd(0.8, 2);
    this.excite = 0.9;
  }

  // ---- drawing --------------------------------------------------------------

  draw(ctx) {
    const s = this.s, cam = s.x * PX;
    this.drawArena(ctx, cam);
    this.drawSkater(ctx);
    for (const p of this.pops) text(ctx, p.msg, AX + 70, ICE + 14 - p.t * 10, p.col, { align: 'center' });

    topBar(ctx, 'FIGURE SKATING', this.o.player.name, fmtPts(s.total));
    this.drawHud(ctx);
    if (this.state === 'ready') banner(ctx, 'FREE SKATE', 36, 'yellow.2', 'PRESS SPACE TO START THE MUSIC');
    if (this.state === 'skate' && !s.started) text(ctx, 'SKATE IN... MOVES START ON THE FIRST BIG BEAT', W / 2, 40, 'grey.6', { align: 'center' });
    if (this.state === 'done') banner(ctx, fmtPts(s.total), 36, 'yellow.2', this.newRecord ? 'NEW RECORD!' : `ELEMENTS ${s.technical}  FLOW ${s.components}`);
  }

  drawArena(ctx, cam) {
    drawWinterSky(ctx, cam * 0.2, 0, { horizon: 92, ridge: 88 });
    // indoor-style stand with fans
    const sx = cam * 0.6;
    dither(ctx, 'grey.2', 'grey.1', 0, 92, W, 40);
    const c0 = Math.floor(sx / 9) - 1;
    for (let r = 0; r < 4; r++) {
      for (let c = c0; c < c0 + W / 9 + 3; c++) {
        const h = hash(c * 17 + r * 59);
        if (h < 0.12) continue;
        const tag = assets.props.tags[`fan_${Math.floor(h * 8)}`];
        const cheer = hash(c + r * 33) < this.excite;
        assets.props.draw(ctx, tag.from + (cheer && Math.floor(this.t * 4 + h * 4) % 2 ? 1 : 0), Math.round(c * 9 + r * 4 - sx), 94 + r * 8);
      }
    }
    fill(ctx, 'grey.6', 0, 131, W, 1);
    drawBoardRow(ctx, cam, 132, { season: 'winter', salt: 'figure' });
    // ice with skate marks
    fill(ctx, 'grey.6', 0, ICE, W, H - ICE);
    dither(ctx, 'grey.6', 'cyan.2', 0, ICE, W, 8);
    for (let i = 0; i < 40; i++) {
      const x = ((hash(i * 13) * 700 - cam) % 700 + 700) % 700 - 150, y = ICE + 10 + hash(i * 7) * 56;
      fill(ctx, 'cyan.2', x, y, 10 + hash(i) * 30, 1);
    }
    // centre-ice circle passes by now and then
    const cx = Math.round(200 - (cam % 600));
    for (let a = 0; a < 360; a += 5) {
      const r = (a * Math.PI) / 180;
      fill(ctx, 'lamp.2', cx + Math.cos(r) * 40, 182 + Math.sin(r) * 12, 1, 1);
    }
    // the skater's shadow
    fill(ctx, 'cyan.1', AX - 10, GROUND + 3, 22, 2);
  }

  drawSkater(ctx) {
    const s = this.s, sh = this.sheet;
    let tag = 'fs_glide', k = 0, flip = false, lift = 0;
    const turn = (rot) => { const q = Math.floor((rot % 1) * 4); return { k: q % 2, flip: q >= 2 }; };
    switch (s.state) {
      case 'air': ({ k, flip } = turn(s.rot)); tag = 'fs_air'; lift = Math.sin(Math.min(1, s.stateT / beatLen()) * Math.PI) * 18; break;
      case 'spin': ({ k, flip } = turn(s.rot)); tag = 'fs_spin'; break;
      case 'down': tag = 'ski_fall'; break;
      default:
        if (this.state === 'done') { tag = 'celebrate'; k = Math.floor(this.t * 4) % 2; }
        else if (this.landT < 0.4) tag = 'fs_land';
        else k = this.strokeT < 0.25 ? 1 : 0;
    }
    const t = sh.tag(tag);
    const idx = Math.min(t.to, t.from + k);
    const y = GROUND + 1 - Math.round(lift);
    sh.draw(ctx, idx, AX, y, { flip });
    // blades under the feet
    for (const key of ['footB', 'footF']) {
      const f = sh.anchor(idx, key);
      if (!f || s.state === 'down') continue;
      const fx = AX + (flip ? -f.x : f.x);
      fill(ctx, 'grey.4', fx - 3, y + f.y + 4, 8, 1);
    }
  }

  drawHud(ctx) {
    const s = this.s, by = 14;
    // speed, flow and what the next jump would be at this speed
    panel(ctx, 4, by, 128, 34, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'SPEED', 8, by + 3, 'grey.4', { shadow: null });
    meter(ctx, 44, by + 4, 84, 4, s.v, { fg: s.v >= FIG.minJump ? 'cyan.1' : 'grey.3' });
    text(ctx, 'FLOW', 8, by + 12, 'grey.4', { shadow: null });
    meter(ctx, 44, by + 13, 84, 4, s.flow, { fg: 'purple.2' });
    const n = s.v < FIG.minJump ? 0 : Math.min(4, Math.floor(FIG.revs(s.v) * beatLen() + 0.25));
    text(ctx, n ? `UP NOW: ${['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'][n]}` : 'STROKE FOR SPEED', 8, by + 23, n >= 3 ? 'yellow.2' : 'grey.5', { shadow: null });
    // judges' sheet: the last elements
    const ex = W - 112;
    panel(ctx, ex, by, 108, 52, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'ELEMENTS', ex + 4, by + 3, 'grey.4', { shadow: null });
    s.elements.slice(-4).forEach((e, i) => {
      text(ctx, e.name, ex + 4, by + 12 + i * 9, e.type === 'fall' ? 'lamp.2' : 'grey.6', { shadow: null });
      text(ctx, `${e.points > 0 ? '+' : ''}${e.points}`, ex + 104, by + 12 + i * 9, e.points > 0 ? 'green.2' : 'lamp.2', { align: 'right', shadow: null });
    });
    this.drawBeats(ctx);
  }

  /** Beat track along the bottom: dots slide in to the hit line. */
  drawBeats(ctx) {
    const s = this.s, b = beatLen(), y = 200, hitX = 60, pxs = 70;
    panel(ctx, 4, y - 8, W - 8, 18, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    fill(ctx, 'green.0', hitX - FIG.ok * pxs, y - 6, FIG.ok * 2 * pxs, 14);
    fill(ctx, 'grey.6', hitX, y - 6, 1, 14);
    if (this.state !== 'skate' && this.state !== 'done') return;
    const t = s.t;
    const k0 = Math.ceil((t - 1) / b), k1 = Math.floor((t + 4.6) / b);
    for (let k = k0; k <= k1; k++) {
      const bt = k * b;
      if (bt > routineEnd() + 0.01) break;
      const x = hitX + (bt - t) * pxs;
      if (x < 8 || x > W - 10) continue;
      const big = k % 3 === 0, live = bt >= routineStart() - 0.01;
      circle(ctx, x, y + 1, big ? 3 : 2, !live ? 'grey.3' : big ? 'yellow.2' : 'cyan.2');
    }
    if (s.state === 'air') text(ctx, 'LAND ON THE BEAT: SPACE', W / 2 + 30, y - 3, Math.floor(this.t * 6) % 2 ? 'yellow.2' : 'grey.6', { align: 'center', shadow: null });
    const left = Math.max(0, Math.ceil(FIG.intro + FIG.beats - t / b));
    text(ctx, `${left} BEATS`, W - 10, y - 3, 'grey.5', { align: 'right', shadow: null });
    if (Math.abs(offBeat(t)) < 0.05 && s.started) fill(ctx, 'grey.6', hitX - 2, y - 6, 5, 1);
  }
}
