// 100m SPRINT — rhythm event.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, panel, text, meter, W } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { SprintRunner, SPRINT } from '../sim/sprint.js';
import { makeRng } from '../sim/rng.js';
import { drawStadium, drawGrass } from '../stadium.js';
import { playerSheet } from '../assets.js';
import { topBar, banner, fmtTime } from '../hud.js';

const PX = 14;            // pixels per metre
const START_X = 60;       // world px of the start line
const TRACK_Y = 116;
const LANE_H = 17;
const LANES = 4;
const MY_LANE = 1;

const GRADE_STYLE = {
  go: ['GO!', 'grey.6'], perfect: ['PERFECT', 'yellow.2'], good: ['GOOD', 'green.2'],
  early: ['RUSHED', 'lamp.2'], late: ['LATE', 'orange.3'], slip: ['SAME FOOT!', 'lamp.1'],
};

const KEY_FLASH = { go: 'green.2', perfect: 'green.3', good: 'green.2', early: 'lamp.1', late: 'orange.2', slip: 'lamp.1' };

/** Pacer runs a smooth speed curve that finishes in a target time. */
function pacerX(t, target, react = 0.17) {
  const tau = 1.15;
  const T = target - react;
  const vmax = 100 / (T - tau * (1 - Math.exp(-T / tau)));
  const tt = Math.max(0, t - react);
  return Math.min(100, vmax * (tt - tau * (1 - Math.exp(-tt / tau))));
}

export class SprintScene extends Scene {
  /**
   * @param {{player:object, pacers:{player:object,time:number}[], record:number|null, onDone:(v:number|null)=>void}} o
   */
  constructor(game, o) {
    super(game);
    this.o = o;
    this.rng = makeRng();
    this.falseStarts = 0;
    this.reset();
  }

  reset() {
    this.runner = new SprintRunner();
    this.state = 'marks';
    this.stateT = 0;
    this.setDelay = 1.1 + this.rng() * 1.1;
    this.gunMs = null;
    this.simT = 0;
    this.lastBeat = -1;
    this.popups = [];
    this.keyFlash = {};
    this.stumbleT = 0;
    this.anim = new Anim(playerSheet(this.o.player), 'idle');
    this.pacerAnims = this.o.pacers.map((p) => new Anim(playerSheet(p.player), 'idle'));
    this.excite = 0.15;
    this.msg = null;
  }

  enter() { sfx.ready(); }

  popup(label, color) {
    this.popups = [{ label, color, t: 0 }];
  }

  update(dt, input) {
    this.stateT += dt;
    const strides = (input.events || []).filter((e) => e.action === 'left' || e.action === 'right');
    switch (this.state) {
      case 'marks':
        if (this.stateT > 0.6) { this.anim.play('set'); this.pacerAnims.forEach((a) => a.play('set')); }
        if (strides.length) return this.falseStart();
        if (this.stateT > 1.3) { this.state = 'set'; this.stateT = 0; sfx.blip(); }
        break;
      case 'set':
        if (strides.length) return this.falseStart();
        if (this.stateT > this.setDelay) {
          this.state = 'run';
          this.stateT = 0;
          this.gunMs = this.game.frameStart;
          sfx.gun();
          sfx.crowd(0.6, 2);
          this.pacerAnims.forEach((a) => a.play('run'));
        }
        break;
      case 'false':
        if (this.stateT > 1.8) {
          if (this.falseStarts >= 2) return this.o.onDone(null);
          this.reset();
        }
        break;
      case 'run': {
        for (const e of strides) {
          const t = Math.max(0, (e.t - this.gunMs) / 1000);
          const r = this.runner.step(e.action, t);
          const [label, color] = GRADE_STYLE[r.grade] || [];
          if (label) this.popup(label, color);
          this.keyFlash[e.action] = { t: this.game.time, color: KEY_FLASH[r.grade] || 'grey.5' };
          if (r.grade === 'slip') { this.stumbleT = 0.25; sfx.bad(); }
          else sfx.step(r.grade === 'perfect' || r.grade === 'good' || r.grade === 'go');
        }
        this.simT = (this.game.frameStart - this.gunMs) / 1000;
        this.runner.update(this.simT);
        const r = this.runner;
        if (r.started && r.nextIdeal !== this.lastBeat && this.simT >= r.nextIdeal) {
          this.lastBeat = r.nextIdeal;
          sfx.beat();
        }
        this.stumbleT -= dt;
        if (this.stumbleT > 0) this.anim.play('stumble');
        else if (r.started) this.anim.play('run');
        this.anim.speed = Math.max(0.35, r.v / 9);
        this.pacerAnims.forEach((a, i) => {
          a.speed = pacerX(this.simT, this.o.pacers[i].time) >= 100 ? 0.5 : 1.2;
          if (pacerX(this.simT, this.o.pacers[i].time) >= 100) a.play('jog');
        });
        this.excite = Math.min(0.9, 0.2 + r.x / 120);
        if (r.finished) {
          this.state = 'done';
          this.stateT = 0;
          this.result = r.finishTime;
          this.newRecord = this.o.record == null || this.result < this.o.record;
          sfx.crowd(0.9, 2.5);
          if (this.newRecord) sfx.fanfare();
        }
        break;
      }
      case 'done':
        this.simT = (this.game.frameStart - this.gunMs) / 1000;
        this.runner.x = Math.min(this.runner.x + Math.max(0, 4 - this.stateT * 2) * dt, 112);
        this.anim.play(this.stateT > 1.2 ? (this.newRecord ? 'celebrate' : 'idle') : 'jog');
        this.excite = 0.9;
        if (this.stateT > 3.2 || (this.stateT > 1 && input.confirm())) this.o.onDone(this.result);
        break;
    }
    this.anim.update(dt * 1000);
    this.pacerAnims.forEach((a) => a.update(dt * 1000));
    this.popups.forEach((p) => (p.t += dt));
    this.popups = this.popups.filter((p) => p.t < 0.7);
  }

  falseStart() {
    this.falseStarts++;
    this.state = 'false';
    this.stateT = 0;
    this.anim.play('dejected');
    sfx.gun();
    sfx.bad();
    this.msg = this.falseStarts >= 2 ? ['DISQUALIFIED', 'SECOND FALSE START'] : ['FALSE START', 'ONE MORE AND YOU ARE OUT'];
  }

  laneY(l) { return TRACK_Y + l * LANE_H + LANE_H - 3; }

  draw(ctx) {
    const r = this.runner;
    const px = START_X + r.x * PX;
    const camX = Math.max(0, Math.min(START_X + 112 * PX - W, px - 130));
    drawStadium(ctx, camX, { excite: this.excite, t: this.game.time });
    drawGrass(ctx, camX);
    this.drawTrack(ctx, camX);

    // pacers behind, player in front (lanes are drawn top to bottom)
    const runners = this.o.pacers.map((p, i) => ({
      lane: i >= MY_LANE ? i + 1 : i,
      x: this.state === 'run' || this.state === 'done' ? pacerX(this.simT, p.time) : 0,
      anim: this.pacerAnims[i],
    }));
    runners.push({ lane: MY_LANE, x: r.x, anim: this.anim, me: true });
    runners.sort((a, b) => a.lane - b.lane);
    for (const ru of runners) {
      const x = START_X + ru.x * PX - camX;
      const y = this.laneY(ru.lane);
      fill(ctx, 'track.0', x - 6, y, 13, 2); // shadow
      ru.anim.draw(ctx, x, y + 1);
      if (ru.me) {
        this.popups.forEach((p, i) =>
          text(ctx, p.label, x, y - 58 - p.t * 14 - i * 9, p.color, { align: 'center' }));
      }
    }

    // HUD
    const timer = this.state === 'run' ? this.simT : this.state === 'done' ? this.result : 0;
    topBar(ctx, '100M SPRINT', this.o.player.name, fmtTime(timer));
    this.drawMeters(ctx);

    if (this.state === 'marks') banner(ctx, 'ON YOUR MARKS', 40);
    if (this.state === 'set') banner(ctx, 'SET', 40, 'orange.3');
    if (this.state === 'run' && this.simT < 0.6) banner(ctx, 'GO!', 40, 'green.3');
    if (this.state === 'false') banner(ctx, this.msg[0], 40, 'lamp.2', this.msg[1]);
    if (this.state === 'done') {
      banner(ctx, fmtTime(this.result), 34, 'yellow.2', this.newRecord ? 'NEW RECORD!' : `REACTION ${r.reaction.toFixed(3)}S`);
    }
  }

  drawTrack(ctx, camX) {
    const y0 = TRACK_Y, y1 = TRACK_Y + LANES * LANE_H;
    fill(ctx, 'grey.6', 0, y0 - 2, W, 1);
    fill(ctx, 'track.1', 0, y0 - 1, W, y1 - y0 + 2);
    // subtle texture
    for (let i = 0; i < 40; i++) {
      const wx = Math.floor(camX / 7) * 7 + i * 11;
      fill(ctx, 'track.0', ((wx * 37) % 997) % W, y0 + ((wx * 13) % (y1 - y0)), 1, 1);
    }
    for (let l = 0; l <= LANES; l++) fill(ctx, 'grey.5', 0, y0 + l * LANE_H, W, 1);
    // start + finish + 10m marks
    const sx = START_X - camX;
    fill(ctx, 'grey.6', sx, y0, 2, y1 - y0);
    const fx = START_X + 100 * PX - camX;
    for (let y = y0; y < y1; y += 2) {
      fill(ctx, 'grey.6', fx, y, 2, 1); fill(ctx, 'grey.0', fx + 2, y, 2, 1);
      fill(ctx, 'grey.0', fx, y + 1, 2, 1); fill(ctx, 'grey.6', fx + 2, y + 1, 2, 1);
    }
    // finish gantry
    if (fx > -40 && fx < W + 40) {
      fill(ctx, 'grey.4', fx - 1, y0 - 34, 2, 34);
      fill(ctx, 'grey.4', fx + 3, y0 - 34, 2, 34);
      panel(ctx, fx - 22, y0 - 44, 48, 11, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
      text(ctx, 'FINISH', fx + 2, y0 - 42, 'yellow.2', { align: 'center' });
    }
    for (let m = 10; m < 100; m += 10) {
      const x = START_X + m * PX - camX;
      if (x < -20 || x > W + 20) continue;
      fill(ctx, 'grey.6', x, y1 + 1, 1, 3);
      text(ctx, `${m}`, x, y1 + 5, 'grass.3', { align: 'center', shadow: 'grass.0' });
    }
    for (let l = 0; l < LANES; l++) {
      text(ctx, `${l + 1}`, sx - 10, y0 + l * LANE_H + 5, 'grey.6', { shadow: 'track.0' });
    }
  }

  /**
   * Stride keys. The key for the next foot fills up as its beat approaches
   * and flashes bright inside the timing window, so the keys themselves
   * carry the rhythm. A pressed key flashes the grade colour of that stride.
   */
  drawKeys(ctx, y) {
    const r = this.runner;
    const running = this.state === 'run';
    const next = r.lastFoot === 'left' ? 'right' : r.lastFoot === 'right' ? 'left' : null;
    const W8 = SPRINT.window;
    const key = (foot, label, x) => {
      const flash = this.keyFlash[foot];
      const pressed = flash && this.game.time - flash.t < 0.15;
      const oy = pressed ? 1 : 0;
      let bg = 'grey.2', fg = 'grey.4', charge = 0, chargeCol = 'yellow.0';
      if (running && !r.started) {
        // gun has gone: both keys pulse to say "go"
        bg = Math.floor(this.simT * 8) % 2 ? 'green.1' : 'green.2';
        fg = 'grey.0';
      } else if (running && foot === next) {
        const dt = this.simT - r.nextIdeal;
        if (Math.abs(dt) <= W8) { bg = 'yellow.2'; fg = 'grey.0'; }           // press now
        else if (dt > W8) { bg = 'orange.2'; fg = 'grey.0'; }                 // late
        else { charge = Math.max(0, Math.min(1, r.beatPhase(this.simT))); fg = 'grey.6'; }
      }
      if (pressed) { bg = flash.color; fg = 'grey.0'; }
      fill(ctx, 'grey.0', x, y + 15, 18, 1);
      fill(ctx, bg, x, y - 2 + oy, 18, 17 - oy);
      if (charge > 0) {
        const h = Math.round(15 * charge);
        fill(ctx, chargeCol, x + 1, y + 14 - h + oy, 16, h);
      }
      fill(ctx, pressed ? 'grey.1' : 'grey.4', x, y - 2 + oy, 18, 1);
      text(ctx, label, x + 7, y + 4 + oy, fg, { shadow: null });
    };
    key('left', '[', 10);
    key('right', ']', 32);
  }

  drawMeters(ctx) {
    const r = this.runner;
    const y = 192;
    panel(ctx, 4, y - 6, W - 8, 28, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    const running = this.state === 'run';
    this.drawKeys(ctx, y);

    // rhythm bar: ideal beat sits at 2/3 of the bar
    const bx = 60, bw = 200, bh = 10;
    text(ctx, 'RHYTHM', bx, y - 3, 'grey.4', { shadow: null });
    const by = y + 5;
    fill(ctx, 'grey.4', bx - 1, by - 1, bw + 2, bh + 2);
    fill(ctx, 'grey.0', bx, by, bw, bh);
    if (r.started && running) {
      const span = r.nextIdeal - r.lastStep;
      const scale = (bw * 2) / 3 / span;
      const ideal = bx + (bw * 2) / 3;
      const wpx = SPRINT.window * scale;
      fill(ctx, 'green.1', ideal - wpx, by, wpx * 2, bh);
      fill(ctx, 'yellow.1', ideal - wpx * 0.45, by, wpx * 0.9, bh);
      fill(ctx, 'grey.6', ideal, by - 2, 1, bh + 4);
      const m = Math.min(bx + bw - 2, bx + (this.simT - r.lastStep) * scale);
      fill(ctx, 'lamp.2', m - 1, by - 2, 3, bh + 4);
    } else if (!r.started) {
      text(ctx, running ? 'GO! PRESS [ OR ]' : 'WAIT FOR THE GUN', bx + bw / 2, by + 2, 'grey.5', { align: 'center', shadow: null });
    }
    // speed + distance
    text(ctx, 'SPEED', 272, y - 3, 'grey.4', { shadow: null });
    meter(ctx, 272, by, 70, bh, r.v / SPRINT.vmax, { fg: r.v > 10 ? 'yellow.1' : 'green.2' });
    text(ctx, `${Math.floor(r.x)}M`, W - 10, by + 2, 'grey.6', { align: 'right' });
  }
}
