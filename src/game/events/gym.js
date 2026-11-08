// GYM TESTS — squat thrusts, then parallel bar dips, 30 seconds each. DOWN
// and UP move you between the two lines; a rep only counts when you reach
// both. Press the next way right as you hit the end to spring off it, but
// springing tires you, and tired muscles slow down.
import { Scene } from '../../engine/game.js';
import { fill, dither, panel, text, meter, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { GYM, Exercise } from '../sim/gym.js';
import { assets, playerSheet } from '../assets.js';
import { topBar, banner } from '../hud.js';
import { drawBoardRow } from '../boards.js';
import { hash } from '../winter.js';

const FLOOR = 186;
const HX = 196;          // where the hands sit (floor for squats, the bar for dips)
const BAR_Y = 150;
const PARTS = ['squat', 'dips'];

export const fmtReps = (n) => (n == null ? '--' : `${n} REPS`);

export class GymScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.sheet = playerSheet(o.player);
    this.part = 0;
    this.results = [];
    this.t = 0;
    this.pops = [];
    this.excite = 0.2;
    this.start(0);
  }

  start(i) {
    this.part = i;
    this.ex = new Exercise(PARTS[i]);
    this.state = 'ready';
    this.stateT = 0;
  }

  get total() { return this.results.reduce((a, b) => a + b, 0) + (this.state === 'go' ? this.ex.reps : 0); }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    this.pops = this.pops.filter((p) => (p.t += dt) < 0.8);
    const ex = this.ex;
    switch (this.state) {
      case 'ready':
        if (this.stateT > 0.4 && input.confirm()) { this.state = 'go'; this.stateT = 0; sfx.gun(); }
        break;
      case 'go': {
        for (const [key, d] of [['down', 1], ['up', -1]]) {
          if (!input.wasPressed(key)) continue;
          const r = ex.move(d);
          if (r?.type === 'short') { sfx.bad(); this.pop('NO REP', 'lamp.2'); }
          else if (r?.spring) sfx.step(true);
        }
        for (const e of ex.update(dt)) {
          if (e.type === 'rep') { sfx.blip(); this.pop(`${e.n}`, 'yellow.2'); }
          if (e.type === 'time') {
            sfx.gun();
            this.results.push(ex.reps);
            this.state = this.part + 1 < PARTS.length ? 'between' : 'done';
            this.stateT = 0;
            if (this.state === 'done') this.finish();
          }
        }
        this.excite = Math.min(0.8, 0.2 + ex.reps / 40);
        break;
      }
      case 'between':
        if (this.stateT > 3 || (this.stateT > 1 && input.confirm())) this.start(this.part + 1);
        break;
      case 'done':
        if (this.stateT > 5 || (this.stateT > 1 && input.confirm())) this.o.onDone(this.total);
        break;
    }
  }

  pop(msg, col) { this.pops.push({ msg, col, t: 0 }); }

  finish() {
    this.newRecord = this.o.record == null || this.total > this.o.record;
    if (this.newRecord) sfx.fanfare(); else sfx.jingle();
    sfx.crowd(0.7, 1.6);
    this.excite = 0.9;
  }

  // ---- drawing --------------------------------------------------------------

  draw(ctx) {
    this.drawHall(ctx);
    if (PARTS[this.part] === 'squat') this.drawSquat(ctx); else this.drawDips(ctx);
    this.drawJudge(ctx);
    for (const p of this.pops) text(ctx, p.msg, HX - 20, 92 - p.t * 16, p.col, { align: 'center', scale: p.msg.length < 3 ? 2 : 1 });

    const ex = this.ex;
    topBar(ctx, 'GYM TESTS', this.o.player.name, fmtReps(this.total));
    this.drawHud(ctx);
    if (this.state === 'ready') banner(ctx, ex.ex.name, 36, 'yellow.2', 'PRESS SPACE. DOWN AND UP IN TURN, TO BOTH LINES');
    if (this.state === 'go' && this.stateT < 2.5) text(ctx, this.part === 0 ? 'DOWN KICKS BACK, UP BRINGS THE LEGS IN' : 'DOWN LOWERS, UP PUSHES BACK UP', W / 2, 40, 'grey.6', { align: 'center' });
    if (this.state === 'between') banner(ctx, fmtReps(this.results[0]), 36, 'yellow.2', 'NEXT: PARALLEL BAR DIPS');
    if (this.state === 'done') banner(ctx, fmtReps(this.total), 36, 'yellow.2', this.newRecord ? 'NEW RECORD!' : `SQUATS ${this.results[0]}  DIPS ${this.results[1]}`);
  }

  drawHall(ctx) {
    // painted block wall, wall bars, a row of boards and a wooden floor
    fill(ctx, 'grey.4', 0, 0, W, FLOOR);
    for (let y = 12; y < 110; y += 8) {
      fill(ctx, 'grey.3', 0, y, W, 1);
      for (let x = (y / 8) % 2 ? 0 : 12; x < W; x += 24) fill(ctx, 'grey.3', x, y, 1, 8);
    }
    for (let i = 0; i < 4; i++) {
      const x = 14 + i * 22;
      fill(ctx, 'orange.1', x, 24, 2, 110); fill(ctx, 'orange.1', x + 16, 24, 2, 110);
      for (let y = 30; y < 132; y += 7) fill(ctx, 'orange.2', x, y, 18, 2);
    }
    // spectators on a balcony
    dither(ctx, 'grey.2', 'grey.1', 110, 52, W - 110, 34);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < (W - 110) / 9; c++) {
        const h = hash(c * 19 + r * 3);
        if (h < 0.2) continue;
        const tag = assets.props.tags[`fan_${Math.floor(h * 8)}`];
        const cheer = hash(c + r * 61) < this.excite;
        assets.props.draw(ctx, tag.from + (cheer && Math.floor(this.t * 4 + h * 4) % 2 ? 1 : 0), 114 + c * 9 + r * 4, 54 + r * 8);
      }
    }
    fill(ctx, 'grey.6', 110, 86, W - 110, 2);
    fill(ctx, 'grey.6', 0, 135, W, 1);
    drawBoardRow(ctx, 0, 136, { season: 'challenge', salt: 'gym' });
    fill(ctx, 'grey.2', 0, 152, W, FLOOR - 152);
    fill(ctx, 'orange.2', 0, FLOOR, W, H - FLOOR);
    for (let x = 0; x < W; x += 32) fill(ctx, 'orange.1', x, FLOOR, 1, H - FLOOR);
    fill(ctx, 'orange.3', 0, FLOOR, W, 1);
  }

  /** Frame 0..2 from the body position, drawn so the hands stay put at (hx, hy). */
  drawPose(ctx, tag, hx, hy) {
    const sh = this.sheet, t = sh.tag(tag);
    const p = this.ex.p, k = p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
    const idx = Math.min(t.to, t.from + k);
    const hand = sh.anchor(idx, 'handF') || { x: 8, y: -2 };
    sh.draw(ctx, idx, hx - hand.x, hy - hand.y);
    return idx;
  }

  drawSquat(ctx) {
    // mat, then the chalk lines the feet must reach
    fill(ctx, 'blue.1', HX - 52, FLOOR - 1, 64, 3);
    fill(ctx, 'grey.6', HX - 44, FLOOR + 2, 2, 4);   // out line (legs back)
    fill(ctx, 'grey.6', HX - 14, FLOOR + 2, 2, 4);   // in line (feet under)
    if (this.state === 'done' || this.state === 'between') {
      const sh = this.sheet; sh.draw(ctx, sh.tag('celebrate').from + (Math.floor(this.t * 4) % 2), HX - 10, FLOOR + 1);
      return;
    }
    this.drawPose(ctx, 'gym_sq', HX, FLOOR);
  }

  drawDips(ctx) {
    // parallel bars: the far bar behind the athlete, the near bar in front
    const post = (x) => { fill(ctx, 'grey.1', x, BAR_Y, 3, FLOOR - BAR_Y); fill(ctx, 'grey.0', x - 3, FLOOR - 2, 9, 3); };
    post(HX - 30); post(HX + 26);
    fill(ctx, 'orange.1', HX - 34, BAR_Y - 3, 66, 2);
    if (this.state === 'done') {
      const sh = this.sheet; sh.draw(ctx, sh.tag('celebrate').from + (Math.floor(this.t * 4) % 2), HX - 50, FLOOR + 1);
    } else this.drawPose(ctx, 'gym_dip', HX, BAR_Y);
    fill(ctx, 'grey.0', HX - 35, BAR_Y - 1, 68, 4);
    fill(ctx, 'orange.2', HX - 34, BAR_Y, 66, 2);
    // depth line: the shoulders must come down to here
    fill(ctx, 'lamp.1', HX + 34, BAR_Y - 2, 6, 1);
  }

  drawJudge(ctx) {
    // a referee with a flip counter
    const jx = 300;
    panel(ctx, jx, 150, 46, 30, { bg: 'grey.0', edge: 'grey.3', shadow: 'grey.0' });
    const n = this.state === 'go' ? this.ex.reps : this.results[this.part] ?? 0;
    text(ctx, String(n).padStart(2, '0'), jx + 23, 155, 'yellow.2', { align: 'center', scale: 2 });
    text(ctx, 'REPS', jx + 23, 171, 'grey.5', { align: 'center', shadow: null });
  }

  drawHud(ctx) {
    const ex = this.ex, by = 14;
    panel(ctx, 4, by, 150, 40, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    const left = Math.max(0, GYM.time - ex.t);
    text(ctx, ex.ex.name, 8, by + 3, 'yellow.2', { shadow: null });
    text(ctx, `${left.toFixed(1)}S`, 150, by + 3, left < 5 ? 'lamp.2' : 'grey.6', { align: 'right', shadow: null });
    // range bar: both lines must be reached for a rep
    const x = 8, y = by + 14, w = 142;
    fill(ctx, 'grey.2', x, y, w, 6);
    fill(ctx, 'green.1', x, y, w * GYM.inLine, 6);
    fill(ctx, 'green.1', x + w * GYM.outLine, y, w * (1 - GYM.outLine), 6);
    const m = Math.round(x + ex.p * (w - 1));
    const spring = ex.dir === 0 && ex.t - ex.arrivedAt <= GYM.spring && ex.t > 0.2;
    fill(ctx, spring ? 'yellow.2' : 'grey.6', m - 1, y - 2, 3, 10);
    text(ctx, this.part === 0 ? 'IN' : 'UP', x, y + 8, 'grey.4', { shadow: null });
    text(ctx, this.part === 0 ? 'OUT' : 'DOWN', x + w, y + 8, 'grey.4', { align: 'right', shadow: null });
    text(ctx, 'TIRED', 8, by + 31, 'grey.4', { shadow: null });
    meter(ctx, 42, by + 32, 108, 4, ex.fatigue, { fg: ex.fatigue > 0.6 ? 'lamp.1' : 'orange.2' });
  }
}
