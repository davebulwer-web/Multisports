// SPEED SKATING — rhythm and lean. 500 metres against the clock. Push with
// SPACE at the end of each glide (the stride bar's green zone): early pushes
// are weak, late ones waste speed. In the bends hold LEFT to lean in and keep
// the lean in the green: too little and you drift wide, too much and you slip.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, dither, panel, text, meter, circle, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { SKATE, SKATE_LEN, Skater, pushQuality, fmtSkate } from '../sim/skate.js';
import { playerSheet, assets } from '../assets.js';
import { topBar, banner } from '../hud.js';
import { drawWinterSky, hash } from '../winter.js';

const PX = 8;          // pixels per metre along the track
const ICE = 150;       // top of the ice
const GROUND = 188;    // where the skater's blades sit
const AX = 130;        // screen x of the skater

export class SkatingScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.sk = new Skater();
    this.anim = new Anim(playerSheet(o.player), 'sk_ready');
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
    const sk = this.sk;
    switch (this.state) {
      case 'ready':
        if (this.stateT > 0.4 && input.confirm()) { this.state = 'set'; this.stateT = 0; this.gunAt = 1.4 + Math.random() * 1.6; sfx.ready(); }
        break;
      case 'set':
        if (input.wasPressed('a')) {
          this.falseStarts++;
          sfx.bad();
          if (this.falseStarts >= 2) { this.state = 'dq'; this.stateT = 0; break; }
          this.state = 'ready'; this.stateT = 0; this.warn = true;
        } else if (this.stateT >= this.gunAt) {
          this.state = 'race'; this.stateT = 0; sfx.gun();
          sk.since = 0.85 * 0.62; // a quick first push is a perfect one
          this.anim.play('sk_stride');
        }
        break;
      case 'race': {
        if (input.wasPressed('a')) {
          const r = sk.push();
          if (r) {
            sfx.step(r.q >= 0.9);
            const msg = r.q >= 0.9 || sk.pushes <= 1 ? null : this.lastPhase > 1 ? 'LATE' : 'EARLY';
            if (msg) this.pops.push({ msg, t: 0, col: r.q >= 1 ? 'green.2' : 'orange.3' });
          }
        }
        this.lastPhase = sk.phase;
        for (const e of sk.update(dt, { lean: input.isDown('left') })) this.onEvent(e);
        if (sk.down > 0) this.anim.play('stumble');
        else { this.anim.play(sk.inBend ? 'sk_cross' : 'sk_stride'); this.anim.speed = 0.3 + sk.v / 14; }
        this.excite = Math.min(0.7, 0.15 + sk.d / SKATE_LEN * 0.6);
        break;
      }
      case 'done':
        if (this.stateT > 5 || (this.stateT > 1 && input.confirm())) this.o.onDone(sk.t);
        // glide to a stop
        sk.d += sk.v * dt; sk.v = Math.max(0, sk.v - 5 * dt);
        break;
      case 'dq':
        if (this.stateT > 3 || (this.stateT > 1 && input.confirm())) this.o.onDone(null);
        break;
    }
    this.anim.update(dt * 1000);
  }

  onEvent(e) {
    switch (e.type) {
      case 'fall': sfx.thud(); this.pops.push({ msg: 'SLIPPED!', t: 0, col: 'lamp.2' }); break;
      case 'blocks': sfx.bad(); this.pops.push({ msg: 'TOO WIDE!', t: 0, col: 'lamp.2' }); break;
      case 'bend': sfx.blip(); break;
      case 'finish':
        this.state = 'done'; this.stateT = 0;
        this.newRecord = this.o.record == null || this.sk.t < this.o.record;
        this.anim.play('celebrate');
        if (this.newRecord) sfx.fanfare(); else sfx.jingle();
        sfx.crowd(0.7, 1.6);
        this.excite = 0.85;
        break;
    }
  }

  // ---- drawing ------------------------------------------------------------

  draw(ctx) {
    const sk = this.sk, cam = sk.d * PX;
    drawWinterSky(ctx, cam * 0.5, 0, { horizon: 112, ridge: 108 });
    this.drawStands(ctx, cam);
    this.drawIce(ctx, cam);
    this.anim.draw(ctx, AX, GROUND + 1);
    // blades
    const fF = this.anim.anchor('footF'), fB = this.anim.anchor('footB');
    for (const f of [fB, fF]) if (f && this.state !== 'dq') fill(ctx, 'grey.5', AX + f.x - 3, GROUND + f.y + 4, 9, 1);
    for (const p of this.pops) text(ctx, p.msg, AX + 6, GROUND - 40 - p.t * 14, p.col, { align: 'center' });

    topBar(ctx, 'SPEED SKATING', this.o.player.name, fmtSkate(sk.t));
    this.drawMap(ctx);
    this.drawGauges(ctx);
    if (this.state === 'ready') banner(ctx, this.warn ? 'FALSE START' : 'READY', 40, this.warn ? 'lamp.2' : 'yellow.2', 'PRESS SPACE, THEN PUSH ON THE GUN');
    if (this.state === 'set') banner(ctx, 'SET', 40, 'yellow.2');
    if (this.state === 'race' && this.stateT < 3) text(ctx, 'PUSH WITH SPACE IN THE GREEN', W / 2 - 40, 40, 'grey.6', { align: 'center' });
    if (this.state === 'race' && sk.inBend && sk.lean < 4) text(ctx, 'BEND! HOLD LEFT TO LEAN IN', W / 2 - 40, 40, Math.floor(this.t * 4) % 2 ? 'yellow.2' : 'grey.6', { align: 'center' });
    if (this.state === 'dq') banner(ctx, 'DISQUALIFIED', 40, 'lamp.2', 'TWO FALSE STARTS');
    if (this.state === 'done') {
      const s = this.sk.stats;
      banner(ctx, fmtSkate(sk.t), 40, 'yellow.2', this.newRecord ? 'NEW RECORD!' : `${s.perfect} GOOD PUSHES  ${s.falls} SLIPS`);
    }
  }

  drawStands(ctx, cam) {
    // boards and a crowd behind them, scrolling slower than the ice
    const sx = cam * 0.7;
    dither(ctx, 'grey.2', 'grey.1', 0, 112, W, 30);
    const c0 = Math.floor(sx / 9) - 1;
    for (let r = 0; r < 3; r++) {
      for (let c = c0; c < c0 + W / 9 + 3; c++) {
        const h = hash(c * 13 + r * 101);
        if (h < 0.15) continue;
        const tag = assets.props.tags[`fan_${Math.floor(h * 8)}`];
        const cheer = hash(c + r * 77) < this.excite;
        assets.props.draw(ctx, tag.from + (cheer && Math.floor(this.t * 4 + h * 4) % 2 ? 1 : 0), Math.round(c * 9 + r * 4 - sx), 114 + r * 8);
      }
    }
    fill(ctx, 'grey.6', 0, 140, W, 8);
    fill(ctx, 'blue.2', 0, 141, W, 2);
    // distance boards every 100m
    for (let m = 100; m < SKATE_LEN; m += 100) {
      const x = Math.round(AX + (m - this.sk.d) * PX);
      if (x < -20 || x > W + 20) continue;
      fill(ctx, 'blue.1', x - 12, 140, 24, 8);
      text(ctx, `${m}M`, x, 141, 'grey.6', { align: 'center', shadow: null });
    }
  }

  drawIce(ctx, cam) {
    fill(ctx, 'grey.6', 0, 148, W, H - 148);
    dither(ctx, 'grey.6', 'cyan.2', 0, 148, W, 10);
    fill(ctx, 'cyan.2', 0, 166, W, 1);
    // lane markings scroll with the skater; in bends the blocks mark the lane
    for (let x = -((cam) % 32); x < W; x += 32) fill(ctx, 'cyan.1', Math.round(x), 200, 14, 1);
    const sk = this.sk;
    let start = 0;
    for (const s of SKATE.sections) {
      if (s.r) {
        for (let m = start; m < start + s.len; m += 4) {
          const x = Math.round(AX + (m - sk.d) * PX);
          if (x < -4 || x > W + 4) continue;
          fill(ctx, 'grey.0', x, 160, 3, 3);
          fill(ctx, 'grey.0', x, 203, 3, 3);
        }
      }
      start += s.len;
    }
    // finish line
    const fx = Math.round(AX + (SKATE_LEN - sk.d) * PX);
    if (fx > -4 && fx < W + 4) { fill(ctx, 'lamp.1', fx, 150, 2, H - 150); }
    // skater's shadow and spray when pushing hard
    fill(ctx, 'cyan.1', AX - 10, GROUND + 4, 24, 2);
  }

  drawMap(ctx) {
    const w = 104, x = W - w - 4, y = 14, h = 48;
    panel(ctx, x, y, w, h, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    const r = 15, cx0 = x + 22, cx1 = x + w - 22, cy = y + 26;
    // the oval
    for (let a = 0; a < 360; a += 4) {
      const rad = (a * Math.PI) / 180;
      const px = (a < 180 ? cx1 : cx0) + Math.sin(rad) * r * (a < 180 ? 1 : 1);
      fill(ctx, 'grey.4', px, cy + Math.cos(rad) * r, 1, 1);
    }
    fill(ctx, 'grey.4', cx0, cy + r, cx1 - cx0, 1);
    fill(ctx, 'grey.4', cx0, cy - r, cx1 - cx0, 1);
    const p = this.mapPos(cx0, cx1, cy, r);
    circle(ctx, p.x, p.y, 1.5, 'yellow.2');
    const sk = this.sk;
    text(ctx, `${Math.min(SKATE_LEN, Math.floor(sk.d))}M`, x + 4, y + 3, 'grey.6', { shadow: null });
    text(ctx, `${(sk.v * 3.6).toFixed(0)}KM/H`, x + w - 4, y + 3, 'cyan.2', { align: 'right', shadow: null });
  }

  /** Map position: bottom straight left to right, bends anticlockwise. */
  mapPos(cx0, cx1, cy, r) {
    const sk = this.sk, sec = sk.section, u = Math.min(1, (sk.d - sec.start) / sec.len);
    const out = r + (sk.offset / SKATE.lane) * 4;
    const sl = cx1 - cx0;
    switch (sec.i) {
      case 0: return { x: cx1 - sl * (1 - u) * (100 / 110), y: cy + r };
      case 1: { const a = Math.PI * u; return { x: cx1 + Math.sin(a) * out, y: cy + Math.cos(a) * out }; }
      case 2: return { x: cx1 - sl * u, y: cy - r };
      case 3: { const a = Math.PI * u; return { x: cx0 - Math.sin(a) * out, y: cy - Math.cos(a) * out }; }
      default: return { x: cx0 + sl * u, y: cy + r };
    }
  }

  drawGauges(ctx) {
    const sk = this.sk, by = 14;
    // stride bar: push in the green
    panel(ctx, 4, by, 120, 30, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'STRIDE', 8, by + 3, 'grey.4', { shadow: null });
    const x = 8, y = by + 13, w = 112, span = 1.5;
    const px = (p) => x + Math.min(1, p / span) * w;
    fill(ctx, 'grey.2', x, y, w, 5);
    for (let p = 0; p < span; p += 0.05) {
      const q = pushQuality(p + 0.025);
      fill(ctx, q >= 1 ? 'green.1' : q > 0.6 ? 'yellow.0' : 'grey.2', Math.round(px(p)), y, Math.ceil(w * 0.05 / span), 5);
    }
    if (this.state === 'race') fill(ctx, 'grey.6', Math.round(px(sk.phase)), y - 2, 1, 9);
    text(ctx, 'SPEED', 8, by + 21, 'grey.4', { shadow: null });
    meter(ctx, 44, by + 22, 74, 3, sk.v / SKATE.vmax, { fg: 'cyan.1' });

    // lean gauge, shown in the bends
    if (!sk.inBend || this.state !== 'race') return;
    const gx = 8, gy = 66, gw = 112, max = SKATE.lean.max;
    panel(ctx, gx - 4, gy - 12, gw + 8, 20, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    const lx = (d) => gx + Math.max(0, Math.min(1, d / max)) * gw;
    const need = sk.need, L = SKATE.lean;
    fill(ctx, 'lamp.0', gx, gy, gw, 4);
    fill(ctx, 'grey.2', gx, gy, lx(need + L.slip) - gx, 4);
    fill(ctx, 'green.1', lx(need - L.ok), gy, lx(need + L.ok) - lx(need - L.ok), 4);
    const m = Math.round(lx(sk.lean));
    fill(ctx, 'grey.6', m - 1, gy - 2, 3, 8);
    fill(ctx, 'grey.0', m, gy - 1, 1, 6);
    text(ctx, 'LEAN', gx, gy - 9, 'grey.4', { shadow: null });
    const wide = sk.offset > 0.3;
    text(ctx, wide ? `WIDE ${sk.offset.toFixed(1)}M` : 'ON THE LINE', gx + gw, gy - 9, wide ? 'orange.3' : 'green.2', { align: 'right', shadow: null });
  }
}
