// BIATHLON — pacing and steady aim. Ski three legs holding → to push, but
// keep your heart rate out of the red or the burn slows you down. At each
// range, five targets: the sight sways with your breathing and jumps with
// every heartbeat, so a racing heart makes for a shaky rifle. Every miss
// adds a penalty. Lowest time wins.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, dither, panel, text, pixLine, circle, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { BIATHLON, Skier, RifleSight, trailY, fmtRace } from '../sim/biathlon.js';
import { makeRng } from '../sim/rng.js';
import { assets, playerSheet } from '../assets.js';
import { topBar, banner } from '../hud.js';
import { drawWinterSky, pine, hash, Snowfall } from '../winter.js';

const S = 4;              // pixels per metre
const SKIER_X = 120;      // skier's screen x while racing
const BASE = 168;         // screen y of trail height 0
const LEGS = BIATHLON.legs;
const SHOTS = 5;
const BOARD = { x: W / 2 - 52, y: 92 }; // centre of target 0 in the scope view

export class BiathlonScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.rng = makeRng();
    this.skier = new Skier();
    this.anim = new Anim(playerSheet(o.player), 'idle');
    this.snow = new Snowfall(50);
    this.leg = 0;
    this.time = 0;
    this.penalty = 0;
    this.shots = []; // true/false per shot fired
    this.state = 'start';
    this.stateT = 0;
    this.course = 0; // course distance at the start of the current leg
    this.beat = 0;
    this.t = 0;
  }

  get pos() { return this.course + this.skier.d; }
  get total() { return Math.round((this.time + this.penalty) * 10) / 10; }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    const sk = this.skier;
    // heartbeat (sound + pulsing heart icon)
    this.beat += dt;
    if (this.beat >= 60 / sk.hr) { this.beat = 0; this.pulse = 0.12; if (this.state === 'range') sfx.beat(); }
    this.pulse = Math.max(0, (this.pulse || 0) - dt);

    switch (this.state) {
      case 'start':
        sk.rest(dt);
        if (input.wasPressed('a') && this.stateT > 0.3) { sfx.gun(); this.go(); }
        break;
      case 'ski': {
        this.time += dt;
        const push = input.isDown('right') || input.isDown('a');
        sk.update(dt, push);
        this.anim.play('xc_stride');
        this.anim.speed = 0.4 + sk.v / 8;
        if (sk.d >= LEGS[this.leg]) {
          if (this.leg >= BIATHLON.ranges.length) return this.finish();
          this.course += LEGS[this.leg];
          this.enterRange();
        }
        break;
      }
      case 'range': {
        this.time += dt;
        sk.rest(dt);
        const sx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
        const sy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
        this.sight.update(dt, sk.hr, sx, sy);
        if (this.sight.target < SHOTS && input.wasPressed('a') && this.stateT > 0.6) {
          const r = this.sight.fire(sk.hr);
          this.shots.push(r.hit);
          this.marks.push({ ...r, i: this.sight.target - 1 });
          sfx.shot();
          if (r.hit) sfx.clang(); else this.penalty += BIATHLON.penalty;
          if (this.sight.target >= SHOTS) { this.doneAt = this.stateT; }
        }
        if (this.doneAt != null && this.stateT - this.doneAt > 1.4) this.go();
        break;
      }
      case 'finish':
        sk.d += sk.v * dt;
        sk.v = Math.max(0, sk.v - 3 * dt);
        if (this.stateT > 5 || (this.stateT > 1 && input.confirm())) return this.o.onDone(this.total);
        break;
    }
    this.snow.update(dt, 0.6);
    this.anim.update(dt * 1000);
  }

  go() {
    if (this.state === 'range') this.leg++;
    this.state = 'ski';
    this.stateT = 0;
    this.skier.d = 0;
    this.skier.offset = this.course;
  }

  enterRange() {
    const kind = BIATHLON.ranges[this.leg];
    this.state = 'range';
    this.stateT = 0;
    this.kind = kind;
    this.sight = new RifleSight(kind, this.rng);
    this.marks = [];
    this.doneAt = null;
    this.anim.play(kind === 'prone' ? 'bia_prone' : 'bia_stand');
    sfx.ready();
  }

  finish() {
    this.state = 'finish';
    this.stateT = 0;
    this.anim.play('celebrate');
    this.newRecord = this.o.record == null || this.total < this.o.record;
    if (this.newRecord) sfx.fanfare(); else sfx.jingle();
    sfx.crowd(0.6, 1.6);
  }

  // ---- drawing ------------------------------------------------------------

  sx(d) { return SKIER_X + (d - this.pos) * S; }
  sy(d) { return BASE - trailY(d) * S + (trailY(this.pos) * S) * 0.6; }

  draw(ctx) {
    if (this.state === 'range') this.drawRange(ctx);
    else this.drawTrail(ctx);
    topBar(ctx, 'BIATHLON', this.o.player.name, fmtRace(this.time));
    this.drawHeart(ctx);
    this.drawShots(ctx);

    if (this.state === 'start') banner(ctx, 'READY', 60, 'yellow.2', 'SPACE TO START. HOLD ] TO PUSH');
    if (this.state === 'ski') {
      const left = Math.max(0, Math.ceil(LEGS[this.leg] - this.skier.d));
      const what = this.leg < BIATHLON.ranges.length ? `${BIATHLON.ranges[this.leg].toUpperCase()} RANGE` : 'FINISH';
      panel(ctx, W - 106, 14, 102, 20, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
      text(ctx, what, W - 102, 17, 'grey.4', { shadow: null });
      text(ctx, `${left}M`, W - 102, 25, 'yellow.2');
      if (this.leg === 0 && this.stateT < 3) text(ctx, 'HOLD ] TO PUSH. LET GO TO RECOVER', W / 2, 44, 'grey.6', { align: 'center' });
      if (this.skier.burn > 0.05) text(ctx, 'BURNING! EASE OFF', W / 2, 54, 'lamp.2', { align: 'center' });
    }
    if (this.state === 'finish') {
      const misses = this.shots.filter((h) => !h).length;
      banner(ctx, fmtRace(this.total), 60, 'yellow.2', `SKI ${fmtRace(this.time)} + ${misses} MISS${misses === 1 ? '' : 'ES'}${this.newRecord ? '  NEW RECORD!' : ''}`);
    }
  }

  drawTrail(ctx) {
    drawWinterSky(ctx, this.pos * S, trailY(this.pos) * S * 0.4, { horizon: 140, ridge: 136 });
    // pines behind the trail
    const d0 = Math.floor((this.pos - SKIER_X / S - 10) / 5), d1 = Math.ceil((this.pos + (W - SKIER_X) / S + 10) / 5);
    for (let i = d0; i <= d1; i++) {
      if (hash(i + 3) < 0.35) continue;
      const d = i * 5 + hash(i) * 3;
      pine(ctx, this.sx(d), this.sy(d) - 5 - Math.floor(hash(i + 31) * 10), 14 + Math.floor(hash(i + 77) * 14));
    }
    // the trail
    for (let x = 0; x < W; x += 2) {
      const d = this.pos + (x + 1 - SKIER_X) / S;
      const top = Math.round(this.sy(d));
      fill(ctx, 'grey.6', x, top, 2, H - top);
      fill(ctx, 'sky.3', x, top + 3, 2, 1);   // groomed tracks
      fill(ctx, 'sky.3', x, top + 6, 2, 1);
      dither(ctx, 'grey.6', 'grey.5', x, top + 12, 2, 8);
      fill(ctx, 'grey.5', x, top + 20, 2, Math.max(0, H - top - 20));
    }
    // distance boards and the range / finish ahead
    const legEnd = this.course + LEGS[this.leg];
    for (let m = Math.ceil((this.pos - 40) / 50) * 50; m < this.pos + 80; m += 50) {
      if (m <= this.course || m >= legEnd) continue;
      const x = Math.round(this.sx(m)), y = Math.round(this.sy(m));
      fill(ctx, 'grey.2', x, y - 12, 1, 12);
      fill(ctx, 'blue.2', x - 6, y - 19, 13, 8);
      text(ctx, `${Math.round(legEnd - m)}`, x, y - 18, 'grey.6', { align: 'center', shadow: null });
    }
    this.drawGate(ctx, legEnd, this.leg < BIATHLON.ranges.length ? 'RANGE' : 'FINISH');
    if (this.leg > 0 || this.state !== 'start') this.drawGate(ctx, this.course, null);
    this.drawSkier(ctx);
    this.snow.draw(ctx, this.pos * S, 0);
  }

  drawGate(ctx, d, label) {
    const x = Math.round(this.sx(d)), y = Math.round(this.sy(d));
    if (x < -40 || x > W + 40) return;
    fill(ctx, 'grey.2', x - 18, y - 30, 2, 30);
    fill(ctx, 'grey.2', x + 18, y - 30, 2, 30);
    if (label) {
      fill(ctx, 'lamp.1', x - 20, y - 38, 42, 9);
      text(ctx, label, x + 1, y - 37, 'grey.6', { align: 'center', shadow: null });
    }
    if (label === 'FINISH') {
      for (let i = 0; i < 10; i++) fill(ctx, i % 2 ? 'grey.0' : 'grey.6', x - 1, y - i * 3 - 3, 2, 3);
      this.drawFans(ctx, x + 28, y);
    }
  }

  drawFans(ctx, x, y) {
    const excite = this.state === 'finish' ? 0.8 : 0.2;
    for (let i = 0; i < 12; i++) {
      const tag = assets.props.tags[`fan_${i % 8}`];
      const cheer = hash(i + 9) < excite && Math.floor(this.t * 4 + i) % 2 === 0;
      assets.props.draw(ctx, tag.from + (cheer ? 1 : 0), x + i * 9, y - 6);
    }
    for (let i = 0; i < 110; i++) fill(ctx, i % 8 < 4 ? 'lamp.1' : 'grey.6', x - 4 + i, y - 6, 1, 3);
  }

  /** Feet on the trail, skis along the slope, poles planted behind. */
  drawSkier(ctx) {
    const d = this.pos, fx = SKIER_X, fy = this.sy(d);
    const a = Math.atan2(this.sy(d + 1) - this.sy(d - 1), 2 * S);
    const dx = Math.cos(a), dy = Math.sin(a);
    const ski = (ox, col) => {
      pixLine(ctx, fx + ox - dx * 12, fy - dy * 12, fx + ox + dx * 14, fy + dy * 14, col);
      fill(ctx, col, fx + ox + dx * 14, fy + dy * 14 - 1, 1, 1);
    };
    ski(-2, 'blue.1');
    const px = fx, py = fy - 1;
    const pole = (key, col) => {
      const h = this.anim.anchor(key);
      if (!h) return;
      const hx = px + h.x, hy = py + h.y;
      const gy = this.sy(d + (hx - 10 - fx) / S);
      pixLine(ctx, hx, hy - 3, hx - 10, gy, col);
    };
    if (this.state !== 'finish') pole('handB', 'grey.3');
    // rifle carried on the back
    const hip = this.anim.anchor('hip'), head = this.anim.anchor('head');
    if (hip && head) pixLine(ctx, px + hip.x - 4, py + hip.y - 1, px + head.x - 6, py + head.y - 3, 'brown.1');
    this.anim.draw(ctx, px, py);
    if (this.state !== 'finish') pole('handF', 'grey.4');
    ski(0, 'blue.2');
  }

  drawRange(ctx) {
    drawWinterSky(ctx, this.course * S, 0, { horizon: 120, ridge: 120 });
    for (let i = 0; i < 26; i++) pine(ctx, i * 16 + hash(i) * 8, 152 + hash(i + 5) * 3, 12 + Math.floor(hash(i + 7) * 12));
    fill(ctx, 'grey.6', 0, 150, W, H - 150);
    // firing line: lane numbers on boards
    for (let i = 0; i < 6; i++) {
      const x = 110 + i * 46;
      fill(ctx, 'orange.1', x, 176, 30, 10);
      fill(ctx, 'orange.0', x, 185, 30, 1);
      text(ctx, `${i + 1}`, x + 15, 178, 'grey.6', { align: 'center', shadow: null });
    }
    dither(ctx, 'grey.6', 'grey.5', 0, 160, W, 6);
    // shooting mat and the athlete
    fill(ctx, 'green.0', 14, 196, 70, 4);
    const ax = 44, ay = 196;
    const prone = this.kind === 'prone';
    // rifle from the shoulder toward the targets
    const h = this.anim.anchor('handF');
    this.anim.draw(ctx, ax, ay);
    if (h) {
      const rx = ax + h.x, ry = ay + h.y + (prone ? 0 : 1);
      pixLine(ctx, rx - 9, ry + 2, rx + 12, ry - 1, 'brown.1');
      pixLine(ctx, rx + 2, ry, rx + 16, ry - 2, 'grey.1');
    }
    this.drawScope(ctx);
    if (this.stateT < 3) text(ctx, `${this.kind.toUpperCase()}: ARROWS TO AIM, SPACE TO FIRE`, W / 2, 166, 'blue.1', { align: 'center', shadow: null });
    else text(ctx, prone ? 'SMALL TARGETS: HIT THE INNER RING' : 'STANDING: WHOLE TARGET COUNTS, MORE SWAY', W / 2, 166, 'blue.1', { align: 'center', shadow: null });
    if (this.doneAt != null) {
      const hits = this.marks.filter((m) => m.hit).length;
      banner(ctx, `${hits} OF 5`, 128, hits === 5 ? 'green.2' : 'yellow.2', hits === 5 ? 'CLEAN!' : `+${(5 - hits) * BIATHLON.penalty}S PENALTY`);
    }
  }

  /** Zoomed view of the target plate with the swaying crosshair. */
  drawScope(ctx) {
    const sp = BIATHLON.sight.spacing, k = this.sight.k;
    const x0 = BOARD.x - 26, y0 = BOARD.y - 30, w = sp * 4 + 52, hgt = 60;
    panel(ctx, x0, y0, w, hgt, { bg: 'grey.6', edge: 'grey.5', shadow: 'grey.3' });
    for (let i = 0; i < SHOTS; i++) {
      const cx = BOARD.x + i * sp, cy = BOARD.y;
      const m = this.marks.find((q) => q.i === i);
      if (m?.hit) circle(ctx, cx, cy, 9, 'grey.5');     // flipped white
      else {
        circle(ctx, cx, cy, 9, 'grey.0');
        if (this.kind === 'prone') {
          // hit zone ring for prone
          for (let j = 0; j < 16; j++) { const a = (j / 16) * Math.PI * 2; fill(ctx, 'grey.2', cx + Math.cos(a) * k.hit, cy + Math.sin(a) * k.hit, 1, 1); }
        }
      }
      if (m) fill(ctx, m.hit ? 'grey.3' : 'lamp.2', cx + m.x - 1, cy + m.y - 1, 2, 2); // where it went
    }
    if (this.doneAt != null) return;
    const p = this.sight.pos(this.skier.hr);
    const cx = Math.round(BOARD.x + p.x), cy = Math.round(BOARD.y + p.y);
    const col = 'lamp.1';
    for (let j = 0; j < 20; j++) { const a = (j / 20) * Math.PI * 2; fill(ctx, col, cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, 1, 1); }
    fill(ctx, col, cx - 16, cy, 10, 1); fill(ctx, col, cx + 7, cy, 10, 1);
    fill(ctx, col, cx, cy - 16, 1, 10); fill(ctx, col, cx, cy + 7, 1, 10);
    fill(ctx, 'yellow.2', cx, cy, 1, 1);
  }

  /** Heart-rate panel: pulsing heart, bpm, zone bar with the redline. */
  drawHeart(ctx) {
    const sk = this.skier, x = 4, y = 14;
    panel(ctx, x, y, 92, 30, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    const big = this.pulse > 0;
    const hx = x + 8, hy = y + 7;
    circle(ctx, hx - 2, hy, big ? 3 : 2, 'lamp.1');
    circle(ctx, hx + 2, hy, big ? 3 : 2, 'lamp.1');
    for (let i = 0; i < (big ? 6 : 5); i++) fill(ctx, 'lamp.1', hx - (big ? 5 : 4) + i, hy + 1 + i, (big ? 11 : 9) - i * 2, 1);
    const red = sk.hr > BIATHLON.burn.redline;
    text(ctx, `${Math.round(sk.hr)} BPM`, x + 18, y + 4, red ? 'lamp.2' : sk.hr > 160 ? 'yellow.2' : 'green.2');
    // zone bar: 60..200 bpm
    const bx = x + 4, by = y + 17, bw = 84;
    const px = (bpm) => bx + ((bpm - 60) / 140) * bw;
    fill(ctx, 'green.0', bx, by, px(160) - bx, 4);
    fill(ctx, 'yellow.0', px(160), by, px(BIATHLON.burn.redline) - px(160), 4);
    fill(ctx, 'lamp.0', px(BIATHLON.burn.redline), by, bx + bw - px(BIATHLON.burn.redline), 4);
    const m = Math.round(px(Math.min(200, Math.max(60, sk.hr))));
    fill(ctx, 'grey.6', m - 1, by - 1, 3, 6);
    // burn
    if (sk.burn > 0.01) fill(ctx, 'orange.3', bx, by + 6, Math.round(bw * sk.burn), 2);
  }

  drawShots(ctx) {
    const x = W / 2 - 34, y = 199;
    if (this.state === 'start') return;
    panel(ctx, x, y, 68, 13, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (let i = 0; i < 10; i++) {
      const r = this.shots[i];
      const cx = x + 6 + i * 6 + (i >= 5 ? 2 : 0), cy = y + 6;
      circle(ctx, cx, cy, 2, r === true ? 'grey.6' : r === false ? 'lamp.1' : 'grey.3');
    }
  }
}
