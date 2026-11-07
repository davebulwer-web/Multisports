// WEIGHTLIFTING (clean & jerk) — timing + balance event.
// Choose a weight, hit the pull gauge, hit the drive gauge, then keep the bar
// balanced overhead for the judges. Three attempts, best good lift counts.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, panel, text, circle, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { LIFT, gauge, gaugePeriod, zone, grade, Balance, goodLift, difficulty } from '../sim/lift.js';
import { makeRng } from '../sim/rng.js';
import { drawStadium } from '../stadium.js';
import { playerSheet, drawProp } from '../assets.js';
import { topBar, banner, fmtKg } from '../hud.js';

const ATTEMPTS = 3;
const FLOOR = 170;
const AX = W / 2 - 20;

export class WeightliftingScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.rng = makeRng();
    this.attempts = [];
    this.kg = 140;
    this.minKg = LIFT.minKg;
    this.anim = new Anim(playerSheet(o.player), 'idle');
    this.newAttempt();
  }

  get best() {
    const ok = this.attempts.filter((a) => a.good).map((a) => a.kg);
    return ok.length ? Math.max(...ok) : null;
  }

  newAttempt() {
    this.state = 'choose';
    this.stateT = 0;
    this.kg = Math.max(this.kg, this.minKg);
    this.lights = [null, null, null];
    this.balance = null;
    this.qClean = this.qJerk = null;
    this.barOffset = 0;
    this.excite = 0.15;
    this.anim.play('idle');
  }

  setState(s) { this.state = s; this.stateT = 0; this.gaugeV = 0; }

  update(dt, input) {
    this.stateT += dt;
    const per = gaugePeriod(this.kg);
    switch (this.state) {
      case 'choose':
        if (input.wasPressed('up')) { this.kg = Math.min(LIFT.maxKg, this.kg + LIFT.stepKg); sfx.blip(); }
        if (input.wasPressed('down')) { this.kg = Math.max(this.minKg, this.kg - LIFT.stepKg); sfx.blip(); }
        if (input.wasPressed('right')) { this.kg = Math.min(LIFT.maxKg, this.kg + 10); sfx.blip(); }
        if (input.wasPressed('left')) { this.kg = Math.max(this.minKg, this.kg - 10); sfx.blip(); }
        if (input.confirm()) { sfx.select(); this.setState('approach'); this.anim.play('lift_ready'); }
        break;
      case 'approach':
        if (this.stateT > 0.8) this.setState('clean');
        break;
      case 'clean':
      case 'jerk': {
        const z = zone(this.kg, this.state);
        this.gaugeV = gauge(this.stateT, per);
        const timeout = this.stateT > per * 2.5;
        if (input.wasPressed('a') || timeout) {
          const q = timeout ? null : grade(this.gaugeV, z);
          if (q == null) return this.fail(this.state === 'clean' ? 'MISSED THE PULL' : 'MISSED THE DRIVE');
          sfx.step(true);
          if (this.state === 'clean') {
            this.qClean = q;
            this.anim.play('lift_pull', { loop: false, restart: true });
            this.setState('pulling');
          } else {
            this.qJerk = q;
            this.anim.play('lift_jerk', { restart: true });
            const sign = () => (this.rng() < 0.5 ? -1 : 1);
            const off = (1 - this.qClean) * 0.25 * sign() + (1 - this.qJerk) * 0.4 * sign();
            this.balance = new Balance(this.kg, off, this.rng);
            sfx.clang();
            this.setState('hold');
          }
        }
        break;
      }
      case 'pulling':
        if (this.anim.done) { this.anim.play('lift_rack'); this.setState('rack'); }
        break;
      case 'rack':
        if (this.stateT > 0.5) { this.anim.play('lift_dip'); this.setState('jerk'); }
        break;
      case 'hold': {
        const b = this.balance;
        const steer = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
        b.update(dt, steer);
        this.barOffset = b.x;
        if (this.stateT > 0.35) this.anim.play(b.x < -0.3 ? 'lift_wobble_l' : b.x > 0.3 ? 'lift_wobble_r' : 'lift_hold');
        this.excite = 0.3 + Math.min(0.5, this.stateT / LIFT.holdTime);
        if (b.failed) return this.fail('LOST BALANCE');
        if (b.time >= LIFT.holdTime) {
          this.verdict = b.verdict();
          this.setState('verdict');
          sfx.blip();
        }
        break;
      }
      case 'verdict': {
        const shown = Math.min(3, Math.floor(this.stateT / 0.4));
        for (let i = 0; i < shown; i++) this.lights[i] = this.verdict[i] ? 'white' : 'red';
        if (this.stateT > 1.4 && !this.decided) {
          this.decided = true;
          const good = goodLift(this.verdict);
          this.record(good);
          this.anim.play(good ? 'celebrate' : 'lift_drop');
          if (good) { sfx.crowd(0.9, 2.5); this.excite = 0.9; } else sfx.fail();
        }
        if (this.stateT > 3.4 || (this.stateT > 1.8 && input.confirm())) this.next();
        break;
      }
      case 'failed':
        if (this.stateT > 2.6 || (this.stateT > 1 && input.confirm())) this.next();
        break;
    }
    this.anim.update(dt * 1000);
  }

  fail(reason) {
    this.failReason = reason;
    this.lights = ['red', 'red', 'red'];
    this.anim.play('lift_drop');
    sfx.thud();
    sfx.fail();
    this.record(false);
    this.setState('failed');
    this.excite = 0.05;
  }

  record(good) {
    this.attempts.push({ kg: this.kg, good });
    this.lastGood = good;
    if (good) {
      this.newRecord = this.o.record == null || this.kg > this.o.record;
      this.minKg = this.kg + LIFT.stepKg;
      if (this.newRecord) sfx.fanfare();
    } else {
      this.minKg = this.kg;
      this.newRecord = false;
    }
  }

  next() {
    this.decided = false;
    if (this.attempts.length >= ATTEMPTS) return this.o.onDone(this.best);
    this.newAttempt();
  }

  draw(ctx) {
    drawStadium(ctx, 40, { excite: this.excite, t: this.game.time, salt: 'weightlifting' });
    // stage
    fill(ctx, 'grey.1', 0, 112, W, H - 112);
    fill(ctx, 'blue.0', 0, 112, W, 40);
    fill(ctx, 'orange.1', AX - 70, FLOOR - 4, 140, 6);
    fill(ctx, 'orange.2', AX - 70, FLOOR - 4, 140, 1);
    for (let i = 0; i < 7; i++) fill(ctx, 'orange.0', AX - 70 + i * 20, FLOOR - 3, 1, 5);
    fill(ctx, 'grey.0', AX - 70, FLOOR + 2, 140, 1);
    fill(ctx, 'grey.2', AX - 74, FLOOR + 3, 148, 3);

    // judges
    panel(ctx, W - 108, 120, 100, 34, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
    text(ctx, 'JUDGES', W - 58, 123, 'grey.4', { align: 'center', shadow: null });
    for (let i = 0; i < 3; i++) drawProp(ctx, `light_${this.lights[i] || 'off'}`, W - 88 + i * 30, 152);

    // athlete + bar
    fill(ctx, 'grey.0', AX - 8, FLOOR - 2, 17, 2);
    this.anim.draw(ctx, AX, FLOOR - 1);
    this.drawBar(ctx);

    topBar(ctx, 'WEIGHTLIFTING', this.o.player.name, `ATTEMPT ${Math.min(ATTEMPTS, this.attempts.length + (this.state === 'choose' ? 1 : 0)) || 1}/${ATTEMPTS}`);
    this.drawHud(ctx);
  }

  drawBar(ctx) {
    const s = this.state;
    const hand = this.anim.anchor('handF');
    const onFloor = (x) => this.drawPlates(ctx, x, FLOOR - 4 - this.plateR());
    if (s === 'choose' || s === 'approach') return onFloor(AX + 10);
    if (this.anim.tagName === 'lift_drop' || !hand || (s === 'verdict' && this.decided)) return onFloor(AX + 14);
    if (s === 'clean') return onFloor(AX + hand.x);
    this.drawPlates(ctx, AX + hand.x + Math.round(this.barOffset * 7), FLOOR - 1 + hand.y);
  }

  plateR() { return 7 + Math.round((this.kg - 100) / 30); }

  drawPlates(ctx, x, y) {
    const r = this.plateR();
    const outer = this.kg >= 180 ? 'lamp.1' : this.kg >= 140 ? 'blue.2' : 'yellow.1';
    const inner = this.kg >= 200 ? 'blue.2' : this.kg >= 160 ? 'yellow.1' : 'green.1';
    circle(ctx, x, y, r + 1, 'grey.0');
    circle(ctx, x, y, r, outer);
    circle(ctx, x, y, r - 2, inner);
    circle(ctx, x, y, Math.max(1, r - 4), outer);
    circle(ctx, x, y, 2, 'grey.5');
    fill(ctx, 'grey.6', x - 1, y - 1, 1, 1);
    // bar end poking out toward the viewer
    fill(ctx, 'grey.4', x - 1, y - 1, 3, 2);
  }

  drawHud(ctx) {
    // weight board
    panel(ctx, 6, 120, 92, 34, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
    text(ctx, 'BAR', 10, 123, 'grey.4', { shadow: null });
    text(ctx, `${this.kg.toFixed(1)}`, 52, 132, 'yellow.2', { align: 'center', scale: 2 });
    text(ctx, 'KG', 90, 146, 'grey.4', { align: 'right', shadow: null });
    // attempts
    panel(ctx, W - 92, 14, 88, 32, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (let i = 0; i < ATTEMPTS; i++) {
      const a = this.attempts[i];
      text(ctx, a ? `${i + 1} ${a.kg.toFixed(1)} ${a.good ? 'OK' : 'X'}` : `${i + 1} --`, W - 88, 17 + i * 9, a ? (a.good ? 'green.2' : 'lamp.2') : 'grey.5');
    }

    const by = 184;
    const s = this.state;
    if (s === 'choose') {
      banner(ctx, 'CHOOSE WEIGHT', 30, 'yellow.2', '^~ 2.5KG   [] 10KG   SPACE TO LIFT');
      const d = difficulty(this.kg);
      panel(ctx, 110, by, 164, 26, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
      text(ctx, 'DIFFICULTY', 116, by + 4, 'grey.4', { shadow: null });
      const segs = 12;
      for (let i = 0; i < segs; i++) {
        const on = i < Math.ceil((d / 1.2) * segs);
        fill(ctx, on ? (i < 5 ? 'green.2' : i < 9 ? 'yellow.1' : 'lamp.1') : 'grey.2', 116 + i * 12, by + 14, 10, 6);
      }
      if (this.best != null) text(ctx, `BEST ${fmtKg(this.best)}`, 268, by + 4, 'cyan.2', { align: 'right', shadow: null });
    }
    if (s === 'clean' || s === 'jerk') {
      const z = zone(this.kg, s);
      const gx = 110, gw = 164;
      panel(ctx, gx - 6, by - 2, gw + 12, 30, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
      text(ctx, s === 'clean' ? 'PULL - HIT THE TOP' : 'DRIVE - HIT THE ZONE', gx, by + 1, 'grey.5', { shadow: null });
      fill(ctx, 'grey.0', gx, by + 12, gw, 10);
      fill(ctx, 'green.1', gx + z.lo * gw, by + 12, (z.hi - z.lo) * gw, 10);
      fill(ctx, 'yellow.1', gx + (z.centre - z.half * 0.3) * gw, by + 12, z.half * 0.6 * gw, 10);
      const m = gx + this.gaugeV * gw;
      fill(ctx, 'lamp.2', m - 1, by + 10, 3, 14);
      banner(ctx, s === 'clean' ? 'CLEAN!' : 'JERK!', 30, 'green.3', 'PRESS SPACE IN THE GREEN');
    }
    if (s === 'hold' && this.balance) {
      const gx = 110, gw = 164, cx = gx + gw / 2;
      panel(ctx, gx - 6, by - 2, gw + 12, 30, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
      text(ctx, 'BALANCE [ ]', gx, by + 1, 'grey.5', { shadow: null });
      text(ctx, `${Math.max(0, LIFT.holdTime - this.balance.time).toFixed(1)}`, gx + gw, by + 1, 'yellow.2', { align: 'right', shadow: null });
      fill(ctx, 'grey.0', gx, by + 12, gw, 10);
      const tol = LIFT.judgeTolerance;
      fill(ctx, 'lamp.0', gx, by + 12, gw, 10);
      fill(ctx, 'yellow.0', cx - (tol[2] * gw) / 2, by + 12, tol[2] * gw, 10);
      fill(ctx, 'green.0', cx - (tol[1] * gw) / 2, by + 12, tol[1] * gw, 10);
      fill(ctx, 'green.1', cx - (tol[0] * gw) / 2, by + 12, tol[0] * gw, 10);
      fill(ctx, 'grey.6', cx, by + 11, 1, 12);
      const m = cx + (this.balance.x * gw) / 2;
      fill(ctx, 'lamp.2', m - 1, by + 10, 3, 14);
      if (this.stateT < 0.8) banner(ctx, 'HOLD IT!', 30, 'yellow.2', 'LEFT / RIGHT TO STAY UNDER THE BAR');
    }
    if (s === 'failed') banner(ctx, 'NO LIFT', 30, 'lamp.2', this.failReason);
    if (s === 'verdict' && this.decided) {
      banner(ctx, this.lastGood ? 'GOOD LIFT!' : 'NO LIFT', 30, this.lastGood ? 'yellow.2' : 'lamp.2',
        this.lastGood ? (this.newRecord ? 'NEW RECORD!' : `${this.verdict.filter(Boolean).length} WHITE LIGHTS`) : 'JUDGES SAY NO');
    }
  }
}
