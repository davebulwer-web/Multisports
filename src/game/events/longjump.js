// LONG JUMP — speed and take-off. Stride down the runway in rhythm like the
// sprint, hold UP to gather for the jump and let go on the board: the take-off
// angle rises while you hold. Over the front of the board is a foul. In the
// air, DOWN shoots the legs forward for the landing. Three jumps, best counts.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, panel, text, meter, W } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { LJ, runUp, jumpResult } from '../sim/longjump.js';
import { drawStadium, drawGrass } from '../stadium.js';
import { playerSheet } from '../assets.js';
import { topBar, banner, fmtDist } from '../hud.js';

const PX = 16;            // pixels per metre
const GROUND = 198;       // screen y of the runway
const BOARD = LJ.runway;  // world metres of the board's front edge
const PIT = BOARD + 1.0;  // sand starts here
const toPx = (m) => 40 + m * PX;
const HIP = 1.0;          // hip height at take-off (m)

const GRADE = {
  go: ['GO!', 'grey.6'], perfect: ['PERFECT', 'yellow.2'], good: ['GOOD', 'green.2'],
  early: ['RUSHED', 'lamp.2'], late: ['LATE', 'orange.3'], slip: ['SAME FOOT!', 'lamp.1'],
};

export class LongJumpScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.jumps = [];  // distance or null (foul)
    this.t = 0;
    this.camX = 0;
    this.excite = 0.15;
    this.anim = new Anim(playerSheet(o.player), 'idle');
    this.newJump();
  }

  get best() {
    const ok = this.jumps.filter((d) => d != null);
    return ok.length ? Math.max(...ok) : null;
  }

  newJump() {
    this.runner = runUp();
    this.state = 'ready';
    this.stateT = 0;
    this.t0 = null;
    this.angle = 0;
    this.gatherT = 0;
    this.fly = null;
    this.res = null;
    this.behind = null;
    this.popup = null;
    this.lastBeat = -1;
    this.anim.play('idle');
  }

  /** Seconds since the first stride, from the input timestamps. */
  simTime(ms) { return Math.max(0, (ms - this.t0) / 1000); }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    const strides = (input.events || []).filter((e) => e.action === 'left' || e.action === 'right');
    const r = this.runner;
    switch (this.state) {
      case 'ready':
        if (strides.length && this.stateT > 0.3) {
          this.t0 = strides[0].t;
          this.state = 'run'; this.stateT = 0;
          this.stride(strides);
        }
        break;
      case 'run': {
        this.stride(strides);
        const now = this.simTime(this.game.frameStart);
        r.update(now);
        if (r.nextIdeal !== this.lastBeat && now >= r.nextIdeal) { this.lastBeat = r.nextIdeal; sfx.beat(); }
        this.anim.play('run');
        this.anim.speed = Math.max(0.35, r.v / 9);
        if (input.wasPressed('up')) { this.state = 'gather'; this.stateT = 0; this.angle = 4; }
        this.checkOverrun();
        break;
      }
      case 'gather': {
        // holding UP: carry on at the same speed while the take-off angle rises
        r.x += r.v * dt;
        this.angle = Math.min(LJ.angleMax, this.angle + LJ.angleRate * dt);
        if (!input.isDown('up') || this.angle >= LJ.angleMax) this.takeoff();
        else this.checkOverrun();
        break;
      }
      case 'air': this.updateAir(dt, input); break;
      case 'result':
        if (this.stateT > 1.0) this.anim.play(this.res && !this.res.foul && this.res.distance >= 8 ? 'celebrate' : this.res?.foul || !this.res ? 'dejected' : 'lj_sit');
        if (this.stateT > 3.5 || (this.stateT > 0.9 && input.confirm())) {
          if (this.jumps.length >= LJ.jumps) return this.o.onDone(this.best);
          this.newJump();
        }
        break;
    }
    if (this.popup) this.popup.t += dt;
    const focus = this.fly ? toPx(this.fly.x) - W / 2 + 30 : toPx(r.x) - 140;
    this.camX += (Math.max(0, focus) - this.camX) * Math.min(1, dt * 6);
    this.anim.update(dt * 1000);
  }

  stride(strides) {
    for (const e of strides) {
      const g = this.runner.step(e.action, this.simTime(e.t));
      const [label, color] = GRADE[g.grade] || [];
      if (label) this.popup = { label, color, t: 0 };
      if (g.grade === 'slip') sfx.bad(); else sfx.step(g.grade !== 'early' && g.grade !== 'late');
    }
  }

  checkOverrun() {
    if (this.runner.x > BOARD + LJ.overrun) {
      this.runner.x = BOARD + LJ.overrun;
      this.anim.play('stumble');
      this.finish({ foul: true, distance: null, why: 'NO JUMP' });
    }
  }

  takeoff() {
    const r = this.runner;
    const behind = BOARD - r.x;
    this.res = jumpResult({ speed: r.v, behind, angle: this.angle, early: null });
    this.behind = behind;
    const { vx, vy, t } = this.res;
    this.fly = { t: 0, x0: r.x, x: r.x, y: HIP, vx, vy, T: t, early: null, landed: false };
    this.state = 'air'; this.stateT = 0;
    this.anim.play('lj_takeoff'); this.anim.speed = 1;
    sfx.step(true);
    sfx.whoosh();
    if (behind < 0) sfx.bad();
  }

  updateAir(dt, input) {
    const f = this.fly;
    f.t += dt;
    if (f.t > 0.16 && this.anim.tagName === 'lj_takeoff') this.anim.play('lj_hang');
    if (f.early == null && input.wasPressed('down') && f.t < f.T) {
      f.early = f.T - f.t;
      this.anim.play('lj_reach');
    }
    const tt = Math.min(f.t, f.T);
    f.x = f.x0 + f.vx * tt;
    f.y = HIP + f.vy * tt - 0.5 * LJ.g * tt * tt;
    this.excite = 0.3 + Math.min(0.5, f.t);
    if (f.t >= f.T && !f.landed) {
      f.landed = true;
      const res = jumpResult({ speed: this.runner.v, behind: this.behind, angle: this.angle, early: f.early });
      f.land = f.x0 + res.air + res.gain; // where the heels mark the sand
      sfx.thud();
      this.anim.play('lj_sit');
      this.finish({ ...res, why: res.foul ? 'NO JUMP' : null });
    }
  }

  finish(res) {
    this.res = res;
    this.jumps.push(res.foul ? null : res.distance);
    this.state = 'result'; this.stateT = 0;
    this.newRecord = !res.foul && (this.o.record == null || res.distance > this.o.record);
    if (res.foul) sfx.bad();
    else if (this.newRecord) sfx.fanfare();
    else { sfx.jingle(); sfx.crowd(0.6, 1.4); }
    this.excite = res.foul ? 0.1 : 0.8;
  }

  // ---- drawing --------------------------------------------------------------

  sx(m) { return toPx(m) - this.camX; }
  sy(m) { return GROUND - m * PX; }

  draw(ctx) {
    drawStadium(ctx, this.camX, { excite: this.excite, t: this.t, salt: 'longjump' });
    drawGrass(ctx, this.camX);
    this.drawField(ctx);

    const f = this.fly;
    if (f) {
      // the hips follow the flight; the sprite is drawn by its hip anchor
      const hp = this.anim.anchor('hip') || { x: 0, y: -21 };
      const x = this.sx(f.x), y = f.landed ? GROUND + 1 : this.sy(f.y) - hp.y;
      if (f.landed && f.land != null) fill(ctx, 'orange.1', this.sx(f.land) - 2, GROUND - 1, 5, 2);
      fill(ctx, 'grey.1', x - 5, GROUND, 11, 1);
      if (f.landed && f.land != null) {
        const ft = this.anim.anchor('footF') || { x: 6, y: -2 };
        this.anim.draw(ctx, this.sx(f.land) - ft.x, GROUND + 1);
      } else this.anim.draw(ctx, x - hp.x, y);
    } else {
      const ax = this.sx(this.runner.x);
      fill(ctx, 'track.0', ax - 6, GROUND, 13, 2);
      this.anim.draw(ctx, ax, GROUND + 1);
      if (this.popup && this.popup.t < 0.7) text(ctx, this.popup.label, ax, GROUND - 70 - this.popup.t * 14, this.popup.color, { align: 'center' });
    }

    topBar(ctx, 'LONG JUMP', this.o.player.name, `JUMP ${Math.min(LJ.jumps, this.jumps.length + (this.state === 'result' ? 0 : 1))}/${LJ.jumps}`);
    this.drawCard(ctx);
    if (this.state === 'run' || this.state === 'gather' || this.state === 'ready') this.drawMeters(ctx);
    if (this.state === 'ready') banner(ctx, this.jumps.length ? `JUMP ${this.jumps.length + 1}` : 'LONG JUMP', 130, 'yellow.2', 'STRIDE WITH [ AND ] TO START');
    if (this.state === 'air' && this.fly.early == null && this.jumps.length === 0) text(ctx, 'PRESS DOWN JUST BEFORE YOU LAND', W / 2, 130, 'grey.6', { align: 'center' });
    if (this.state === 'result') {
      const r = this.res;
      if (r.foul) banner(ctx, r.why === 'NO JUMP' && this.behind == null ? 'NO JUMP' : 'FOUL', 40, 'lamp.2', this.behind == null ? 'TAKE OFF BEFORE THE SAND' : `${Math.round(-this.behind * 100)}CM OVER THE BOARD`);
      else banner(ctx, fmtDist(r.distance), 40, 'yellow.2', this.newRecord ? 'NEW RECORD!' : this.hint(r));
    }
  }

  hint(r) {
    const cm = Math.round(this.behind * 100);
    const parts = [`${this.angle.toFixed(0)}DEG`, cm > 20 ? `${cm}CM BEHIND` : `BOARD ${cm}CM`];
    if (this.fly?.early == null) parts.push('FELL BACK');
    else if (r.gain < 0.25) parts.push(this.fly.early > LJ.reachAt ? 'LEGS TOO EARLY' : 'LEGS TOO LATE');
    return parts.join('  ');
  }

  drawField(ctx) {
    const x0 = this.sx(-2), x1 = this.sx(PIT);
    fill(ctx, 'track.1', x0, GROUND - 5, x1 - x0, 8);
    fill(ctx, 'grey.6', x0, GROUND - 6, x1 - x0, 1);
    fill(ctx, 'track.0', x0, GROUND + 3, x1 - x0, 2);
    // marks every 5m back from the board
    for (let m = 5; m <= BOARD; m += 5) {
      const x = this.sx(BOARD - m);
      fill(ctx, 'grey.5', x, GROUND - 5, 1, 2);
      if (m % 10 === 0) text(ctx, `${m}`, x, GROUND + 6, 'grey.6', { align: 'center', shadow: 'grass.0' });
    }
    // take-off board (white) with the plasticine strip past it
    const bx = this.sx(BOARD);
    fill(ctx, 'grey.6', bx - 0.2 * PX, GROUND - 5, 0.2 * PX, 3);
    fill(ctx, 'grey.4', bx, GROUND - 5, 2, 3);
    // sand pit with distance boards
    const px0 = this.sx(PIT), pw = 10 * PX;
    fill(ctx, 'orange.2', px0, GROUND - 4, pw, 8);
    fill(ctx, 'orange.3', px0 + 2, GROUND - 5, pw - 4, 1);
    for (let k = 7; k < pw; k += 13) fill(ctx, 'orange.1', px0 + k, GROUND - 2 + (k % 3), 2, 1);
    for (let m = 6; m <= 9; m++) {
      const x = this.sx(BOARD + m);
      fill(ctx, 'grey.6', x, GROUND + 5, 1, 4);
      text(ctx, `${m}`, x, GROUND + 10, 'grey.6', { align: 'center', shadow: 'grass.0' });
    }
    // record marker flag
    if (this.o.record != null) {
      const x = this.sx(BOARD + this.o.record);
      fill(ctx, 'grey.5', x, GROUND - 16, 1, 12);
      fill(ctx, 'yellow.2', x + 1, GROUND - 16, 5, 3);
    }
    // judge's flag after a jump: white good, red foul
    if (this.state === 'result') {
      const x = bx + 10;
      fill(ctx, 'grey.4', x, GROUND - 22, 1, 18);
      fill(ctx, this.res.foul ? 'lamp.1' : 'grey.6', x + 1, GROUND - 22, 7, 5);
    }
  }

  drawMeters(ctx) {
    const r = this.runner, y = 18;
    panel(ctx, 4, y - 4, 178, 42, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    // rhythm: the ideal beat sits at two thirds of the bar
    const bx = 8, bw = 100, bh = 6;
    text(ctx, 'RHYTHM', bx, y - 1, 'grey.4', { shadow: null });
    const by = y + 7;
    fill(ctx, 'grey.0', bx, by, bw, bh);
    if (r.started && this.state === 'run') {
      const span = r.nextIdeal - r.lastStep, scale = (bw * 2) / 3 / span, ideal = bx + (bw * 2) / 3;
      const wpx = LJ.stride.window * scale;
      fill(ctx, 'green.1', ideal - wpx, by, wpx * 2, bh);
      fill(ctx, 'grey.6', ideal, by - 1, 1, bh + 2);
      const m = Math.min(bx + bw - 2, bx + (this.simTime(this.game.frameStart) - r.lastStep) * scale);
      fill(ctx, 'lamp.2', m - 1, by - 1, 3, bh + 2);
    }
    text(ctx, 'SPEED', 116, y - 1, 'grey.4', { shadow: null });
    meter(ctx, 116, by, 62, bh, r.v / LJ.stride.vmax, { fg: r.v > 10 ? 'yellow.1' : 'green.2' });
    // take-off angle: 20 degrees or so is best
    const ay = y + 17;
    text(ctx, 'ANGLE', bx, ay, 'grey.4', { shadow: null });
    const ax = 44, aw = 134;
    fill(ctx, 'grey.0', ax, ay, aw, 5);
    const at = (d) => ax + (d / LJ.angleMax) * aw;
    fill(ctx, 'green.1', at(LJ.best - 2), ay, at(LJ.best + 2) - at(LJ.best - 2), 5);
    if (this.state === 'gather') fill(ctx, 'yellow.2', ax, ay + 1, at(this.angle) - ax, 3);
    text(ctx, `BOARD ${Math.max(0, BOARD - r.x).toFixed(1)}M`, 178, y + 26,  BOARD - r.x < 4 ? 'orange.3' : 'grey.6', { align: 'right', shadow: null });
  }

  drawCard(ctx) {
    const w = 80, x = W - w - 4, y = 14;
    panel(ctx, x, y, w, 12 + LJ.jumps * 8, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (let i = 0; i < LJ.jumps; i++) {
      const done = i < this.jumps.length, d = this.jumps[i];
      text(ctx, `${i + 1} ${done ? fmtDist(d) : '--'}`, x + 4, y + 3 + i * 8, done && d == null ? 'lamp.2' : done ? 'green.2' : 'grey.5', { shadow: null });
    }
    text(ctx, `BEST ${this.best == null ? '--' : this.best.toFixed(2)}`, x + w - 4, y + 3 + LJ.jumps * 8, 'cyan.2', { align: 'right', shadow: null });
  }
}
