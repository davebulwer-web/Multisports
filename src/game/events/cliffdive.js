// CLIFF DIVING — timing in the air. Pick a dive, press Space at the top of
// the arm swing to take off and keep holding it to tuck or pike (fast spin).
// Let go to open out: the open body turns slowly, so open at the moment the
// slow turn will bring you upright, feet first, at the water. Hold UP with
// your arms out to slow the turn a little more. Three different dives;
// five judges, middle three count, times the degree of difficulty.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, dither, bands, panel, text, pixLine, circle, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { DIVE, Diver, takeoffQuality, judge, entryWord } from '../sim/dive.js';
import { makeRng } from '../sim/rng.js';
import { assets, playerSheet } from '../assets.js';
import { topBar, banner, fmtPts } from '../hud.js';
import { hash } from '../winter.js';

const S = 9;               // pixels per metre
const EDGE_X = 150;        // screen x of the platform edge
const PLAT = 0.3;          // where the diver's feet start, metres from the edge (+ = over the water)
const SLOW = 0.8;          // gentle slow motion so the dive is readable
const ROUNDS = DIVE.rounds;
const SHAPE_TAG = { open: 'dive_open', arms: 'dive_arms', pike: 'dive_pike', tuck: 'dive_tuck' };

export class CliffDiveScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.rng = makeRng();
    this.scores = [];      // {dive, points, marks, ...}
    this.used = new Set();
    this.anim = new Anim(playerSheet(o.player), 'dive_edge');
    this.t = 0;
    this.choice = 0;
    this.camY = DIVE.height;
    this.splash = [];
    this.newRound();
  }

  get total() { return Math.round(this.scores.reduce((a, s) => a + s.points, 0) * 10) / 10; }

  newRound() {
    this.state = 'pick';
    this.stateT = 0;
    this.d = null;
    this.score = null;
    this.choice = DIVE.dives.findIndex((dv) => !this.used.has(dv.id));
    this.excite = 0.15;
    this.setEdgeFrame(2);
  }

  setEdgeFrame(k) {
    this.anim.play('dive_edge');
    this.anim.index = this.anim.t.from + k;
    this.anim.speed = 0;
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    switch (this.state) {
      case 'pick': {
        const step = (input.wasPressed('down') ? 1 : 0) - (input.wasPressed('up') ? 1 : 0);
        if (step) {
          let c = this.choice;
          for (let i = 0; i < DIVE.dives.length; i++) {
            c = (c + step + DIVE.dives.length) % DIVE.dives.length;
            if (!this.used.has(DIVE.dives[c].id)) break;
          }
          this.choice = c;
          sfx.blip();
        }
        if (input.wasPressed('a') && this.stateT > 0.3) {
          const dive = DIVE.dives[this.choice];
          this.used.add(dive.id);
          this.d = new Diver(dive);
          this.state = 'edge';
          this.stateT = 0;
          sfx.select();
        }
        break;
      }
      case 'edge': {
        this.swing = -Math.cos((2 * Math.PI * this.stateT) / DIVE.swing);
        this.setEdgeFrame(this.swing < -0.33 ? 0 : this.swing < 0.33 ? 1 : 2);
        if (input.wasPressed('a') && this.stateT > 0.25) {
          const q = takeoffQuality(this.swing);
          this.d.takeoff(q);
          this.note = q > 0.9 ? { msg: 'GREAT TAKE-OFF', col: 'green.2' } : q > 0.5 ? { msg: 'GOOD TAKE-OFF', col: 'yellow.2' } : { msg: 'WEAK TAKE-OFF', col: 'lamp.2' };
          this.state = 'air';
          this.stateT = 0;
          sfx.whoosh();
        }
        break;
      }
      case 'air': {
        const d = this.d;
        d.update(dt * SLOW, { tuck: input.isDown('a'), arms: input.isDown('up') });
        this.anim.play(SHAPE_TAG[d.shape]);
        this.anim.speed = 1;
        if (d.phase === 'in') this.splashDown();
        break;
      }
      case 'in':
        if (this.stateT > 1.5) this.showScore();
        break;
      case 'score':
        if (this.stateT > 6 || (this.stateT > 0.8 && input.confirm())) {
          if (this.scores.length >= ROUNDS) return this.o.onDone(this.total);
          this.newRound();
        }
        break;
    }
    // camera follows the diver down; holds at the top and at the water
    const target = this.d && this.d.phase !== 'edge' ? this.d.y + 2 : DIVE.height;
    const lo = (192 - 108) / S, hi = DIVE.height + (150 - 108) / S;
    const want = Math.max(lo, Math.min(hi, target));
    this.camY += (want - this.camY) * Math.min(1, dt * 8);
    for (const p of this.splash) { p.t += dt; p.vy -= 22 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.splash = this.splash.filter((p) => p.y > 0 || p.t < 0.1);
    this.anim.update(dt * 1000);
  }

  splashDown() {
    const r = this.d.result;
    this.state = 'in';
    this.stateT = 0;
    this.word = entryWord(r);
    const e = Math.abs(r.error);
    const big = e > 20 || r.tucked;
    const n = big ? 40 : e > 8 ? 18 : 8;
    for (let i = 0; i < n; i++) {
      this.splash.push({ x: this.d.x, y: 0.1, vx: (this.rng() - 0.5) * (big ? 6 : 2.5), vy: 3 + this.rng() * (big ? 10 : 5), t: 0 });
    }
    big ? sfx.thud() : sfx.smash();
    sfx.crowd(big ? 0.3 : 0.6, 1.2);
    this.excite = big ? 0.2 : 0.7;
  }

  showScore() {
    const dive = this.d.dive;
    const j = judge(this.d.result, dive.dd, this.rng);
    this.score = { dive, ...j, word: this.word };
    this.scores.push(this.score);
    this.state = 'score';
    this.stateT = 0;
    const last = this.scores.length >= ROUNDS;
    this.newRecord = last && (this.o.record == null || this.total > this.o.record);
    if (this.newRecord) sfx.fanfare();
    else if (j.sum >= 21) sfx.jingle();
    else if (j.sum < 9) sfx.fail();
  }

  // ---- drawing ------------------------------------------------------------

  sx(m) { return EDGE_X + (m + PLAT) * S; }
  sy(m) { return Math.round(108 - (m - this.camY) * S); }

  draw(ctx) {
    this.drawBackdrop(ctx);
    this.drawCliff(ctx);
    this.drawDiver(ctx);
    this.drawWater(ctx);
    for (const p of this.splash) fill(ctx, p.t < 0.5 ? 'grey.6' : 'cyan.2', this.sx(p.x), this.sy(p.y), 2, 2);

    topBar(ctx, 'CLIFF DIVING', this.o.player.name, `DIVE ${Math.min(ROUNDS, this.scores.length + (this.state === 'score' ? 0 : 1))}/${ROUNDS}`);
    this.drawCard(ctx);
    if (this.d) this.drawDiveName(ctx);
    if (this.state === 'pick') this.drawPicker(ctx);
    if (this.state === 'edge') this.drawSwing(ctx);
    if (this.state === 'air') this.drawRotation(ctx);
    if (this.state === 'air' && this.note && this.stateT < 1.2) text(ctx, this.note.msg, W / 2, 58, this.note.col, { align: 'center' });
    if (this.state === 'in' && this.stateT > 0.3) {
      const e = Math.abs(this.d.result.error);
      banner(ctx, this.word, 40, e < 15 && !this.d.result.tucked ? 'yellow.2' : 'lamp.2', `${Math.round(this.d.result.error) >= 0 ? '+' : ''}${Math.round(this.d.result.error)} DEGREES FROM UPRIGHT`);
    }
    if (this.state === 'score') this.drawScore(ctx);
  }

  drawBackdrop(ctx) {
    const water = this.sy(0);
    const horizon = Math.round(water * 0.3 + 62);
    bands(ctx, ['sky.0', 'sky.1', 'sky.2', 'sky.3'], 0, 0, W, Math.max(1, horizon));
    // sun haze and a few gulls
    circle(ctx, 300, horizon - 70, 10, 'yellow.2');
    for (let i = 0; i < 3; i++) {
      const gx = Math.round((i * 97 + this.t * (8 + i * 3)) % (W + 40)) - 20, gy = horizon - 40 - i * 17 + Math.round(Math.sin(this.t * 2 + i) * 2);
      fill(ctx, 'grey.6', gx, gy, 2, 1); fill(ctx, 'grey.6', gx + 3, gy, 2, 1); fill(ctx, 'grey.4', gx + 2, gy + 1, 1, 1);
    }
    // distant headland
    for (let x = 220; x < W; x += 2) {
      const h = Math.round(10 + Math.sin(x / 31) * 4 + (x - 220) * 0.12);
      fill(ctx, 'blue.2', x, horizon - h, 2, h);
    }
    // open sea down to the near water
    fill(ctx, 'blue.2', 0, horizon, W, Math.max(0, water - horizon));
    for (let y = horizon + 2; y < water; y += 5) {
      for (let x = (y * 7) % 23; x < W; x += 23) fill(ctx, 'blue.3', x + Math.round(Math.sin(this.t + y) * 2), y, 6, 1);
    }
    // spectator boats
    for (let i = 0; i < 3; i++) {
      const bx = 230 + i * 52, by = Math.round(water - 4 - i * 3 + Math.sin(this.t * 1.5 + i) * 1);
      if (by > H + 10) continue;
      fill(ctx, i % 2 ? 'grey.6' : 'lamp.1', bx, by, 34, 5);
      fill(ctx, 'grey.2', bx + 2, by + 5, 30, 1);
      for (let k = 0; k < 3; k++) {
        const fan = (i * 3 + k) % 8, tag = assets.props.tags[`fan_${fan}`];
        const cheer = hash(i * 9 + k) < this.excite && Math.floor(this.t * 4 + k) % 2 === 0;
        assets.props.draw(ctx, tag.from + (cheer ? 1 : 0), bx + 6 + k * 10, by + 2);
      }
    }
  }

  cliffX(y) { // the face's x at height y (metres), always behind the platform
    return -1.2 - (DIVE.height - y) * 0.05 - hash(Math.floor(y * 2)) * 0.5 - Math.sin(y * 0.7) * 0.4;
  }

  drawCliff(ctx) {
    const top = DIVE.height;
    for (let sy = Math.max(0, this.sy(top)); sy < H; sy += 2) {
      const y = this.camY + (108 - sy) / S;
      if (y < -4) break;
      const x1 = Math.round(this.sx(this.cliffX(y)));
      if (x1 <= 0) continue;
      fill(ctx, 'orange.1', 0, sy, x1, 2);
      dither(ctx, 'orange.1', 'orange.0', 0, sy, Math.max(0, x1 - 20), 2);
      fill(ctx, 'orange.2', x1 - 3, sy, 3, 2);
      if (hash(Math.floor(y * 2) + 500) < 0.18) fill(ctx, 'orange.0', x1 - 22, sy, 18, 1); // strata
      if (hash(Math.floor(y * 2) + 900) < 0.06) { fill(ctx, 'green.1', x1 - 8, sy - 1, 7, 2); fill(ctx, 'green.2', x1 - 6, sy - 2, 3, 1); }
    }
    // grass on top and spectators
    const ty = this.sy(top);
    if (ty > -10) {
      const x0 = Math.round(this.sx(this.cliffX(top)));
      fill(ctx, 'green.1', 0, ty - 1, x0, 3);
      fill(ctx, 'green.2', 0, ty - 2, x0 - 2, 1);
      for (let i = 0; i < 10; i++) {
        const fan = i % 8, tag = assets.props.tags[`fan_${fan}`];
        const cheer = hash(i + 40) < this.excite && Math.floor(this.t * 4 + i) % 2 === 0;
        assets.props.draw(ctx, tag.from + (cheer ? 1 : 0), 8 + i * 10, ty - 1);
      }
      // diving platform out over the edge
      const px0 = x0 - 4, px1 = Math.round(this.sx(0.75));
      fill(ctx, 'orange.3', px0, ty, px1 - px0, 2);
      fill(ctx, 'orange.0', px0, ty + 2, px1 - px0, 1);
      pixLine(ctx, px0 + 2, ty + 3, px0 + 2 + 0, ty + 12, 'grey.3');
      pixLine(ctx, px1 - 6, ty + 3, px0 + 2, ty + 14, 'grey.3');
      fill(ctx, 'grey.4', px0 + 1, ty - 9, 1, 9);
      fill(ctx, 'grey.4', px0 + 1, ty - 9, 10, 1);
    }
  }

  drawWater(ctx) {
    const wy = this.sy(0);
    if (wy >= H) return;
    // translucent foreground water band covers whatever is below the surface
    fill(ctx, 'blue.2', 0, wy, W, H - wy);
    dither(ctx, 'blue.2', 'blue.1', 0, wy + 8, W, H - wy - 8);
    for (let x = 0; x < W; x += 2) {
      const o = Math.round(Math.sin(x / 9 + this.t * 3) * 1.2);
      fill(ctx, 'cyan.1', x, wy + o, 2, 1);
    }
    for (let i = 0; i < 12; i++) fill(ctx, 'cyan.2', (i * 37 + Math.round(this.t * 6)) % W, wy + 4 + (i % 4) * 4, 5, 1);
    // ripples where the diver went in
    if (this.state === 'in' || this.state === 'score') {
      const cx = this.sx(this.d.x), r = Math.min(30, 4 + this.stateT * 18 + (this.state === 'score' ? 20 : 0));
      fill(ctx, 'grey.6', cx - r, wy, 2, 1); fill(ctx, 'grey.6', cx + r - 2, wy, 2, 1);
    }
  }

  drawDiver(ctx) {
    const back = this.d ? this.d.dive.back : false;
    const flip = back;
    if (!this.d || this.d.phase === 'edge') {
      // feet on the platform, toes at the edge (heels for a back dive)
      this.anim.draw(ctx, this.sx(0), this.sy(DIVE.height), { flip });
      return;
    }
    const d = this.d;
    if (d.phase === 'in') {
      if (this.stateT < 0.9) return;
      // treading water: head and shoulders above the surface
      const wy = this.sy(0);
      this.anim.play('dive_tread');
      this.anim.speed = 1;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, wy + 1);
      ctx.clip();
      this.anim.draw(ctx, this.sx(d.x), wy + 30, { flip: false });
      ctx.restore();
      return;
    }
    const hip = this.anim.anchor('hip') || { x: 0, y: -21 };
    const hx = this.sx(d.x), hy = this.sy(d.y) + hip.y;
    ctx.save();
    ctx.translate(Math.round(hx), Math.round(hy));
    ctx.rotate((d.angle * Math.PI) / 180);
    this.anim.draw(ctx, flip ? hip.x : -hip.x, -hip.y, { flip });
    ctx.restore();
  }

  drawCard(ctx) {
    const w = 120, x = W - w - 4, y = 14;
    panel(ctx, x, y, w, 38, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (let i = 0; i < ROUNDS; i++) {
      const s = this.scores[i];
      text(ctx, `${i + 1} ${s ? `${s.dive.short}` : '--'}`, x + 4, y + 3 + i * 9, 'grey.5', { shadow: null });
      if (s) text(ctx, s.points.toFixed(1), x + w - 4, y + 3 + i * 9, 'grey.6', { align: 'right' });
    }
    text(ctx, `TOTAL ${this.total.toFixed(1)}`, x + w - 4, y + 30, 'cyan.2', { align: 'right' });
  }

  drawDiveName(ctx) {
    const dv = this.d.dive;
    panel(ctx, 4, 14, 140, 20, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, dv.name, 8, 17, 'yellow.2', { shadow: null });
    text(ctx, `DD ${dv.dd.toFixed(1)}  ${dv.back ? 'FACING THE CLIFF' : 'FACING THE SEA'}`, 8, 25, 'grey.4', { shadow: null });
  }

  drawPicker(ctx) {
    const w = 196, h = 22 + DIVE.dives.length * 10, x = W - w - 8, y = 64;
    panel(ctx, x, y, w, h, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
    text(ctx, 'CHOOSE YOUR DIVE', x + w / 2, y + 4, 'yellow.2', { align: 'center' });
    DIVE.dives.forEach((dv, i) => {
      const used = this.used.has(dv.id), sel = i === this.choice;
      const yy = y + 16 + i * 10;
      if (sel) fill(ctx, 'blue.1', x + 3, yy - 1, w - 6, 9);
      text(ctx, dv.name, x + 6, yy, used ? 'grey.3' : sel ? 'grey.6' : 'grey.5', { shadow: null });
      text(ctx, used ? 'DONE' : dv.dd.toFixed(1), x + w - 6, yy, used ? 'grey.3' : 'cyan.2', { align: 'right', shadow: null });
    });
    text(ctx, 'UP/DOWN, SPACE TO GO. EACH DIVE ONCE', x + w / 2, y + h + 4, 'grey.6', { align: 'center' });
  }

  drawSwing(ctx) {
    const x = W / 2 + 20, y = 196, w = 120;
    panel(ctx, x - 4, y - 12, w + 8, 22, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'SPACE AT THE TOP', x + w / 2, y - 9, 'grey.5', { align: 'center', shadow: null });
    fill(ctx, 'grey.2', x, y, w, 5);
    const gx = x + ((0.35 + 1) / 2) * w;
    fill(ctx, 'yellow.0', gx, y, x + w - gx, 5);
    fill(ctx, 'green.1', x + ((0.8 + 1) / 2) * w, y, x + w - (x + ((0.8 + 1) / 2) * w), 5);
    const m = Math.round(x + ((this.swing + 1) / 2) * (w - 1));
    fill(ctx, 'grey.6', m - 1, y - 2, 3, 9);
    fill(ctx, 'grey.0', m, y - 1, 1, 7);
    if (this.scores.length === 0 && this.stateT < 4) text(ctx, 'HOLD SPACE TO SPIN, LET GO TO OPEN OUT', W / 2 - 40, 58, 'grey.6', { align: 'center' });
  }

  /** Somersault bar: the cursor is how far you've turned; the hollow mark is
   * where you'd finish if you opened out right now. Open when they meet. */
  drawRotation(ctx) {
    const d = this.d, x = 150, y = 196, w = 200;
    panel(ctx, x - 4, y - 12, w + 8, 22, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    const max = d.target + 180;
    const px = (deg) => x + Math.max(0, Math.min(1, deg / max)) * (w - 1);
    fill(ctx, 'grey.2', x, y, w, 5);
    fill(ctx, 'cyan.1', x, y, Math.round(px(d.angle) - x), 5);
    fill(ctx, 'green.2', Math.round(px(d.target - 12)), y + 3, Math.round(px(d.target + 12) - px(d.target - 12)), 2);
    for (let n = 1; n <= d.dive.n; n++) fill(ctx, 'grey.5', Math.round(px(n * 360)), y - 1, 1, 7);
    // projection: angle reached if you open now and stay open to the water
    const tRem = (d.vy + Math.sqrt(d.vy * d.vy + 2 * DIVE.g * Math.max(0, d.y))) / DIVE.g;
    const proj = d.angle + (d.L / DIVE.inertia.open) * tRem;
    const pm = Math.round(px(proj));
    fill(ctx, 'yellow.2', pm - 1, y - 3, 3, 1); fill(ctx, 'yellow.2', pm - 1, y + 7, 3, 1);
    fill(ctx, 'yellow.2', pm - 1, y - 3, 1, 11); fill(ctx, 'yellow.2', pm + 1, y - 3, 1, 11);
    text(ctx, `SOMERSAULTS ${(d.angle / 360).toFixed(1)}/${d.dive.n}`, x, y - 9, 'grey.5', { shadow: null });
    text(ctx, d.shape === 'arms' ? 'ARMS OUT' : d.shape === 'open' ? 'OPEN' : d.shape.toUpperCase(), x + w, y - 9, d.shape === 'open' || d.shape === 'arms' ? 'green.2' : 'orange.3', { align: 'right', shadow: null });
  }

  drawScore(ctx) {
    const s = this.score, w = 236, h = 70, x = W / 2 - w / 2 + 30, y = 52;
    panel(ctx, x, y, w, h, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
    text(ctx, s.word, x + 8, y + 6, s.sum >= 18 ? 'yellow.2' : 'lamp.2');
    text(ctx, `DD ${s.dive.dd.toFixed(1)}`, x + w - 8, y + 6, 'grey.5', { align: 'right' });
    text(ctx, 'JUDGES', x + 8, y + 20, 'grey.4', { shadow: null });
    s.marks.forEach((m, i) => {
      const dropped = s.dropped.includes(i);
      text(ctx, m.toFixed(1), x + 60 + i * 30, y + 20, dropped ? 'grey.3' : 'cyan.2', { shadow: dropped ? null : undefined });
    });
    text(ctx, `MIDDLE 3: ${s.sum.toFixed(1)} X ${s.dive.dd.toFixed(1)}`, x + 8, y + 32, 'grey.4', { shadow: null });
    text(ctx, s.points.toFixed(1), x + w - 8, y + 32, 'grey.6', { align: 'right' });
    fill(ctx, 'grey.3', x + 6, y + 44, w - 12, 1);
    const last = this.scores.length >= ROUNDS;
    text(ctx, `TOTAL ${fmtPts(this.total)}${last && this.newRecord ? '  RECORD!' : ''}`, x + w / 2, y + 52, last && this.newRecord ? 'green.2' : 'yellow.2', { align: 'center' });
  }
}
