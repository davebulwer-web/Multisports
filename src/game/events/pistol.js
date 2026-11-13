// PISTOL SHOOTING — rapid fire. Five targets turn to face you for 8, then 6,
// then 4 seconds: raise the pistol, put one shot in each target left to
// right, and ride the kick of every shot back down onto the next one.
// Rings score 10 down to 5. Three series, 150 is perfect.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, panel, text, bands, pixLine, circle, meter, W } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { PISTOL, Hand, Series } from '../sim/pistol.js';
import { makeRng } from '../sim/rng.js';
import { drawGrass } from '../stadium.js';
import { drawBoardRow } from '../boards.js';
import { playerSheet } from '../assets.js';
import { topBar, banner, fmtPts } from '../hud.js';

const GROUND = 204;      // shooter's feet
const SHOOTER_X = 30;
const FIELD_Y = 128;     // where the grass starts
const TY = PISTOL.targetY;
const SERIES = PISTOL.series.length;
const TURN = 0.18;       // seconds for a target to swing round

export class PistolScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.rng = makeRng();
    this.hand = new Hand(this.rng);
    this.scores = [];
    this.index = -1;
    this.t = 0;
    this.fx = [];
    this.anim = new Anim(playerSheet(o.player), 'pi_ready');
    this.next();
  }

  get total() { return this.scores.reduce((a, b) => a + b, 0) + (this.state === 'live' ? this.series.score : 0); }

  next() {
    this.index++;
    this.series = new Series(PISTOL.series[this.index]);
    this.state = 'ready';
    this.stateT = 0;
    this.turnT = 0;          // 0 = edge on, 1 = facing
    this.hand.x = PISTOL.start.x; this.hand.y = PISTOL.start.y;
    this.hand.vx = this.hand.vy = 0;
    this.anim.play('pi_ready');
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    const live = this.state === 'live';
    const sx = live ? (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0) : 0;
    const sy = live ? (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0) : 0;
    this.hand.update(dt, sx, sy, live);
    const facing = live && this.series.facing;
    this.turnT = Math.max(0, Math.min(1, this.turnT + (facing ? dt : -dt) / TURN));

    switch (this.state) {
      case 'ready':
        if (this.stateT > 0.4 && input.confirm()) { this.state = 'attention'; this.stateT = 0; this.waitFor = 1.2 + this.rng() * 0.8; sfx.ready(); }
        break;
      case 'attention':
        if (this.stateT >= this.waitFor) { this.state = 'live'; this.stateT = 0; sfx.whoosh(); }
        break;
      case 'live': {
        this.series.update(dt);
        if (this.hand.up > 0.05) this.anim.play('pi_aim');
        if (input.wasPressed('a') && !this.series.done) this.fire();
        if (this.series.done) {
          if (this.series.shots.length < PISTOL.targets.length) sfx.bad();
          this.scores.push(this.series.score);
          this.state = 'result';
          this.stateT = 0;
          this.anim.play('pi_ready');
          if (this.index + 1 >= SERIES) this.finish();
        }
        break;
      }
      case 'result':
        if (this.stateT > 2.4 || (this.stateT > 0.8 && input.confirm())) {
          if (this.index + 1 >= SERIES) return this.o.onDone(this.total);
          this.next();
        }
        break;
    }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < 0.5);
    this.anim.update(dt * 1000);
  }

  fire() {
    const a = this.hand.aim;
    const s = this.series.shot(a.x, a.y);
    this.hand.fire(this.rng);
    sfx.shot();
    this.fx.push({ kind: 'flash', t: 0 }, { kind: 'score', x: a.x, y: a.y, ring: s.ring, t: 0 });
  }

  finish() {
    this.newRecord = this.o.record == null || this.total > this.o.record;
    if (this.newRecord) sfx.fanfare(); else sfx.jingle();
    this.anim.play(this.total >= 120 ? 'celebrate' : 'dejected');
  }

  // ---- drawing --------------------------------------------------------------

  draw(ctx) {
    this.drawRange(ctx);
    PISTOL.targets.forEach((x, i) => this.drawTarget(ctx, x, i));
    this.drawShooter(ctx);
    for (const f of this.fx) {
      if (f.kind !== 'score') continue;
      text(ctx, f.ring ? `${f.ring}` : 'MISS', f.x, f.y - 30 - f.t * 20, f.ring >= 9 ? 'yellow.2' : f.ring ? 'grey.6' : 'lamp.2', { align: 'center' });
    }
    if (this.state === 'live' || this.state === 'attention') this.drawSight(ctx);

    topBar(ctx, 'PISTOL', this.o.player.name, `SERIES ${this.index + 1}/${SERIES}`);
    this.drawTimer(ctx);
    this.drawCard(ctx);

    const time = PISTOL.series[this.index];
    if (this.state === 'ready') {
      banner(ctx, `${time} SECONDS`, 112, 'yellow.2', this.index === 0 ? 'SPACE TO LOAD. ONE SHOT AT EACH TARGET' : 'PRESS SPACE TO LOAD');
    }
    if (this.state === 'attention') text(ctx, 'ATTENTION...', W / 2, 150, 'lamp.2', { align: 'center', scale: 2 });
    if (this.state === 'live' && this.index === 0 && this.stateT < 2.5) text(ctx, 'ARROWS AIM, SPACE FIRES. RIDE THE KICK DOWN', W / 2, 150, 'grey.6', { align: 'center' });
    if (this.state === 'result') {
      const last = this.index + 1 >= SERIES;
      const missed = PISTOL.targets.length - this.series.shots.length;
      const sub = last ? `TOTAL ${this.total}${this.newRecord ? '  NEW RECORD!' : ''}` : missed ? `${missed} SHOT${missed > 1 ? 'S' : ''} TOO LATE` : `TOTAL SO FAR ${this.total}`;
      banner(ctx, `SERIES ${this.series.score}`, 112, this.series.score >= 45 ? 'yellow.2' : 'grey.6', sub);
    }
  }

  drawRange(ctx) {
    bands(ctx, ['sky.0', 'sky.1', 'sky.2', 'sky.3'], 0, 0, W, 34);
    // earth bank behind the targets, a timber backstop and the target frame
    for (let x = 0; x < W; x += 2) {
      const h = 26 + Math.round(Math.sin(x / 37) * 3 + Math.sin(x / 11 + 2) * 1.5);
      fill(ctx, 'green.1', x, h, 2, 2);
      fill(ctx, 'grass.0', x, h + 2, 2, 40 - h);
    }
    fill(ctx, 'orange.1', 0, 40, W, 74);
    for (let y = 44; y < 114; y += 7) fill(ctx, 'orange.0', 0, y, W, 1);
    for (let x = 23; x < W; x += 56) fill(ctx, 'orange.0', x, 40, 1, 74);
    fill(ctx, 'orange.2', 0, 40, W, 1);
    fill(ctx, 'grey.1', 44, 110, W - 88, 4); // target carrier
    fill(ctx, 'grey.1', 0, 114, W, 1);
    drawBoardRow(ctx, 0, 115, { season: 'summer', salt: 'pistol' });
    drawGrass(ctx, 0, FIELD_Y + 3);
    fill(ctx, 'grey.0', 0, FIELD_Y + 2, W, 1);
    // firing point: a bench and the line
    fill(ctx, 'orange.2', 0, GROUND - 6, 80, 6);
    fill(ctx, 'orange.1', 0, GROUND, 80, 3);
    fill(ctx, 'grey.6', 80, GROUND - 6, 1, 9);
  }

  drawTarget(ctx, x, i) {
    const k = this.turnT;
    // lamp: green while the targets face you
    const lamp = k >= 1 ? 'green.2' : this.state === 'attention' ? 'lamp.1' : 'grey.2';
    circle(ctx, x, 54, 2, lamp);
    fill(ctx, 'grey.1', x - 1, 58, 3, 52 - (58 - 56)); // post
    const hw = Math.max(1, Math.round(22 * k));
    if (k <= 0) { fill(ctx, 'grey.5', x - 1, TY - 24, 2, 48); return; }
    fill(ctx, 'grey.1', x - hw - 1, TY - 25, hw * 2 + 2, 50);
    fill(ctx, 'grey.6', x - hw, TY - 24, hw * 2, 48);
    if (k < 1) return;
    // rings 5-6 on white, 7-10 in the black aiming mark
    const ringDots = (r, key) => {
      const n = Math.round(r * 6);
      for (let j = 0; j < n; j++) { const a = (j / n) * Math.PI * 2; fill(ctx, key, x + Math.round(Math.cos(a) * r), TY + Math.round(Math.sin(a) * r), 1, 1); }
    };
    ringDots(18, 'grey.3');
    ringDots(15, 'grey.3');
    circle(ctx, x, TY, 12, 'grey.0');
    ringDots(9, 'grey.3');
    ringDots(6, 'grey.3');
    ringDots(3, 'grey.3');
    // holes from this series
    for (const s of this.series.shots) {
      if (Math.abs(s.x - x) > 22) continue;
      const inBlack = Math.hypot(s.x - x, s.y - TY) <= 12;
      fill(ctx, inBlack ? 'grey.6' : 'grey.1', Math.round(s.x), Math.round(s.y), 1, 1);
      fill(ctx, inBlack ? 'grey.4' : 'grey.3', Math.round(s.x) + 1, Math.round(s.y), 1, 1);
    }
    const shot = this.series.shots.find((s) => s.target === i);
    if (shot) text(ctx, `${shot.ring}`, x, TY + 27, 'grey.6', { align: 'center' });
  }

  drawShooter(ctx) {
    this.anim.draw(ctx, SHOOTER_X, GROUND + 1);
    const tag = this.anim.tagName;
    if (tag !== 'pi_aim' && tag !== 'pi_ready') return;
    const h = this.anim.anchor('handF');
    if (!h) return;
    const hx = SHOOTER_X + h.x, hy = GROUND + 1 + h.y;
    const a = tag === 'pi_ready' ? 0.75 : Math.max(-0.9, this.hand.kick * 0.03);
    const dx = Math.cos(a), dy = Math.sin(a);
    fill(ctx, 'grey.1', hx - 1, hy, 2, 3);                                // grip
    pixLine(ctx, hx - dx, hy - dy - 1, hx + dx * 6, hy + dy * 6 - 1, 'grey.2'); // barrel
    pixLine(ctx, hx - dx, hy - dy - 2, hx + dx * 6, hy + dy * 6 - 2, 'grey.1');
    if (this.fx.some((f) => f.kind === 'flash' && f.t < 0.06)) circle(ctx, hx + dx * 8, hy + dy * 8 - 1, 2, 'yellow.2');
  }

  /** A bold red cross with a black outline: it shows up on the sky, the card and the black. */
  drawSight(ctx) {
    const { x: ax, y: ay } = this.hand.aim;
    const x = Math.round(ax), y = Math.round(ay);
    const col = this.state === 'live' && !this.series.done ? 'lamp.1' : 'grey.4';
    const arms = [[-9, -1, 6, 3], [4, -1, 6, 3], [-1, -9, 3, 6], [-1, 4, 3, 6]];
    for (const [dx, dy, w, h] of arms) fill(ctx, 'grey.0', x + dx - 1, y + dy - 1, w + 2, h + 2);
    for (const [dx, dy, w, h] of arms) {
      const inner = [dx + (w > 3 ? 0 : 1), dy + (h > 3 ? 0 : 1), w > 3 ? w : 1, h > 3 ? h : 1];
      fill(ctx, col, x + inner[0], y + inner[1], inner[2], inner[3]);
      fill(ctx, 'grey.6', x + inner[0] + (w > 3 ? (dx < 0 ? 0 : w - 1) : 0), y + inner[1] + (h > 3 ? (dy < 0 ? 0 : h - 1) : 0), 1, 1);
    }
    fill(ctx, 'grey.0', x - 1, y - 1, 3, 3);
    fill(ctx, col === 'lamp.1' ? 'lamp.2' : 'grey.5', x, y, 1, 1);
  }

  drawTimer(ctx) {
    const x = 4, y = 14, s = this.series, time = PISTOL.series[this.index];
    panel(ctx, x, y, 96, 24, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    const left = this.state === 'live' ? Math.max(0, time - s.t) : this.state === 'result' ? Math.max(0, time - s.t) : time;
    text(ctx, `${left.toFixed(1)}S`, x + 4, y + 3, left < 1.5 && this.state === 'live' ? 'lamp.2' : 'grey.6', { shadow: null });
    meter(ctx, x + 40, y + 4, 52, 5, left / time, { fg: left < 1.5 ? 'lamp.1' : 'green.2' });
    for (let i = 0; i < PISTOL.targets.length; i++) {
      const have = i >= s.shots.length;
      fill(ctx, have ? 'yellow.1' : 'grey.2', x + 4 + i * 7, y + 14, 3, 6);
      fill(ctx, have ? 'orange.3' : 'grey.3', x + 4 + i * 7, y + 13, 3, 1);
    }
  }

  drawCard(ctx) {
    const w = 76, x = W - w - 4, y = 14;
    panel(ctx, x, y, w, 12 + SERIES * 8, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    PISTOL.series.forEach((time, i) => {
      const sc = this.scores[i] ?? (i === this.index && this.state === 'live' ? this.series.score : null);
      text(ctx, `${time}S`, x + 4, y + 3 + i * 8, i === this.index ? 'yellow.2' : 'grey.4', { shadow: null });
      text(ctx, sc == null ? '--' : `${sc}`, x + w - 4, y + 3 + i * 8, 'grey.6', { align: 'right', shadow: null });
    });
    text(ctx, fmtPts(this.total), x + w - 4, y + 3 + SERIES * 8, 'cyan.2', { align: 'right', shadow: null });
  }
}
