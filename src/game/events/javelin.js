// JAVELIN — power (run-up + plant) and angle event. Three attempts, best counts.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, panel, text, meter, pixLine, circle, W } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { JAVELIN, simulateThrow } from '../sim/javelin.js';
import { makeRng } from '../sim/rng.js';
import { drawStadium, drawGrass } from '../stadium.js';
import { playerSheet } from '../assets.js';
import { topBar, banner, fmtDist } from '../hud.js';

const PX = 5;          // pixels per metre
const ORIGIN = 150;    // world px of the foul line
const GROUND = 178;    // screen y of the runway surface
const JAV_LEN = 2.7;   // metres
const ATTEMPTS = 3;
const toPx = (m) => ORIGIN + m * PX;

export class JavelinScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.rng = makeRng();
    this.attempts = [];
    this.anim = new Anim(playerSheet(o.player), 'idle');
    this.newAttempt();
  }

  newAttempt() {
    this.state = 'ready';
    this.stateT = 0;
    this.x = -JAVELIN.runway; // athlete position in metres (relative to foul line)
    this.v = 0;
    this.wind = Math.round((this.rng() * 6 - 3) * 10) / 10;
    this.angle = 0;
    this.needleT = 0;
    this.flight = null;
    this.flightT = 0;
    this.foul = false;
    this.excite = 0.15;
    this.anim.play('idle');
  }

  get best() {
    const v = this.attempts.filter((a) => a.value != null).map((a) => a.value);
    return v.length ? Math.max(...v) : null;
  }

  update(dt, input) {
    this.stateT += dt;
    switch (this.state) {
      case 'ready':
        if (input.wasPressed('a')) { this.state = 'run'; this.stateT = 0; this.anim.play('jav_run'); }
        break;
      case 'run':
        this.v = Math.min(JAVELIN.vmax, this.v + JAVELIN.accel * dt);
        this.x += this.v * dt;
        this.anim.speed = 0.5 + this.v / JAVELIN.vmax;
        if (!input.isDown('a')) {
          this.plantX = this.x;
          this.runSpeed = this.v;
          this.state = 'angle';
          this.stateT = 0;
          this.needleT = 0;
          this.anim.play('jav_throw', { loop: false, restart: true });
          this.anim.speed = 0; // hold the withdraw pose while aiming
          sfx.step(true);
        } else if (this.x > 0) {
          this.foul = true;
          this.endAttempt(null, 'OVER THE LINE');
          this.anim.play('stumble');
        }
        break;
      case 'angle': {
        // momentum carries the thrower forward while aiming
        this.v = Math.max(0, this.v - 20 * dt);
        this.x += this.v * dt;
        if (this.x > 0) this.foul = true; // stepped over the line
        this.needleT += dt;
        this.angle = 35 - 35 * Math.cos((2 * Math.PI * this.needleT) / 1.3);
        if (input.wasPressed('a') || this.needleT > 2.6) {
          this.state = 'throw';
          this.stateT = 0;
          this.anim.speed = 1;
        }
        break;
      }
      case 'throw':
        this.v = Math.max(0, this.v - 20 * dt);
        this.x += this.v * dt;
        if (this.x > 0) this.foul = true; // stepped over the line
        if (this.anim.index >= this.anim.t.from + 3 && !this.flight) {
          this.flight = simulateThrow({ runSpeed: this.runSpeed, angle: this.angle, wind: this.wind, plantX: this.plantX });
          this.flightT = 0;
          sfx.whoosh();
          this.state = 'flight';
        }
        break;
      case 'flight': {
        this.flightT += dt;
        this.excite = 0.3 + Math.min(0.5, this.flightT / 6);
        if (this.flightT >= this.flight.flightTime) {
          sfx.thud();
          const ok = this.flight.valid && !this.foul;
          this.endAttempt(ok ? this.flight.distance : null, this.foul ? 'FOUL' : this.flight.valid ? null : 'FLAT LANDING');
          if (ok) sfx.crowd(0.8, 2);
        }
        break;
      }
      case 'landed':
        if (this.stateT > 1.2) this.anim.play(this.lastValue != null ? 'celebrate' : 'dejected');
        if (this.stateT > 3 || (this.stateT > 0.8 && input.confirm())) {
          if (this.attempts.length >= ATTEMPTS) return this.o.onDone(this.best);
          this.newAttempt();
        }
        break;
    }
    this.anim.update(dt * 1000);
  }

  endAttempt(value, reason) {
    this.attempts.push({ value, reason });
    this.lastValue = value;
    this.lastReason = reason;
    this.state = 'landed';
    this.stateT = 0;
    this.newRecord = value != null && (this.o.record == null || value > this.o.record);
    if (value == null) sfx.bad();
    else if (this.newRecord) sfx.fanfare();
    this.excite = value != null ? 0.85 : 0.1;
  }

  javAt() {
    if (!this.flight) return null;
    const p = this.flight.path;
    let i = Math.min(p.length - 1, Math.floor((this.flightT / this.flight.flightTime) * p.length));
    return p[i];
  }

  draw(ctx) {
    const jp = this.state === 'flight' || this.state === 'landed' ? this.javAt() : null;
    const focus = jp ? toPx(jp.x) - 200 : toPx(this.x) - 150;
    const camX = Math.max(0, Math.min(toPx(110) - W, focus));
    drawStadium(ctx, camX, { excite: this.excite, t: this.game.time });
    drawGrass(ctx, camX);
    this.drawField(ctx, camX);

    // athlete
    const ax = toPx(this.x) - camX;
    fill(ctx, 'grass.0', ax - 6, GROUND, 13, 2);
    this.anim.draw(ctx, ax, GROUND + 1);
    const hand = this.anim.anchor('handF');
    if (!this.flight && hand && this.state !== 'landed') {
      const ang = this.state === 'ready' || this.state === 'run' ? 14 : this.angle;
      this.drawJavelin(ctx, ax + hand.x, GROUND + 1 + hand.y, ang, 0.45);
    }
    if (jp) {
      const x = toPx(jp.x) - camX, y = GROUND - jp.y * PX;
      if (this.state === 'landed' && !this.flight.valid) this.drawJavelin(ctx, x, GROUND - 1, 0, 0.5);
      else {
        fill(ctx, 'grass.0', x - 8, GROUND + 3, 12, 2); // shadow on the grass
        this.drawJavelin(ctx, x, y, jp.att, 1); // tip at the flight point
      }
    }

    const right = this.attempts.length < ATTEMPTS || this.state !== 'landed'
      ? `ATTEMPT ${Math.min(ATTEMPTS, this.attempts.length + (this.state === 'landed' ? 0 : 1))}/${ATTEMPTS}` : 'FINAL';
    topBar(ctx, 'JAVELIN', this.o.player.name, right);
    this.drawHud(ctx, jp);

    if (this.state === 'ready') banner(ctx, 'HOLD SPACE', 30, 'yellow.2', 'RELEASE TO PLANT. DO NOT CROSS THE LINE');
    if (this.state === 'landed') {
      const v = this.lastValue;
      banner(ctx, v != null ? fmtDist(v) : this.lastReason, 30, v != null ? 'yellow.2' : 'lamp.2',
        v != null ? (this.newRecord ? 'NEW RECORD!' : `WIND ${this.wind > 0 ? '+' : ''}${this.wind.toFixed(1)}`) : 'NO MARK');
    }
  }

  /** Draw a javelin. (x,y) is a point on the shaft at fraction `at` from the tip. */
  drawJavelin(ctx, x, y, angleDeg, at) {
    const a = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(a) * JAV_LEN * PX * 1.4, dy = -Math.sin(a) * JAV_LEN * PX * 1.4;
    const tipX = x + dx * at, tipY = y + dy * at;
    const tailX = tipX - dx, tailY = tipY - dy;
    pixLine(ctx, tailX, tailY + 1, tipX, tipY + 1, 'grey.0');
    pixLine(ctx, tailX, tailY - 1, tipX, tipY - 1, 'grey.1');
    pixLine(ctx, tailX, tailY, tipX, tipY, 'grey.5');
    pixLine(ctx, tipX - dx * 0.15, tipY - dy * 0.15, tipX, tipY, 'grey.6');
    pixLine(ctx, tipX - dx * 0.5, tipY - dy * 0.5, tipX - dx * 0.4, tipY - dy * 0.4, 'red.2');
  }

  drawField(ctx, camX) {
    // runway
    fill(ctx, 'track.1', toPx(-30) - camX, GROUND - 6, (30) * PX, 12);
    fill(ctx, 'grey.6', toPx(-30) - camX, GROUND - 7, 30 * PX, 1);
    fill(ctx, 'grey.6', toPx(-30) - camX, GROUND + 6, 30 * PX, 1);
    // foul line arc
    fill(ctx, 'grey.6', toPx(0) - camX, GROUND - 7, 2, 14);
    fill(ctx, 'lamp.1', toPx(0) - camX + 2, GROUND - 7, 1, 14);
    // distance lines
    for (let m = 10; m <= 100; m += 10) {
      const x = toPx(m) - camX;
      if (x < -20 || x > W + 20) continue;
      for (let y = GROUND - 8; y < 214; y += 3) fill(ctx, 'grey.5', x, y, 1, 2);
      text(ctx, `${m}`, x, 206, 'grey.6', { align: 'center', shadow: 'grass.0' });
    }
    const flag = (m, color, label) => {
      if (m == null) return;
      const x = toPx(m) - camX;
      fill(ctx, 'grey.4', x, GROUND - 22, 1, 22);
      fill(ctx, color, x + 1, GROUND - 22, 8, 5);
      text(ctx, label, x + 1, GROUND - 31, color, { align: 'center' });
    };
    flag(this.o.record, 'yellow.1', 'WR');
    flag(this.best, 'cyan.1', 'PB');
  }

  drawHud(ctx, jp) {
    const y = 14;
    // attempts
    panel(ctx, W - 92, y, 88, 32, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (let i = 0; i < ATTEMPTS; i++) {
      const a = this.attempts[i];
      const s = a ? (a.value != null ? fmtDist(a.value) : a.reason === 'FLAT LANDING' ? 'FLAT' : 'FOUL') : '--';
      text(ctx, `${i + 1} ${s}`, W - 88, y + 3 + i * 9, a && a.value == null ? 'lamp.2' : 'grey.6');
    }
    // wind sock
    panel(ctx, 4, y, 76, 20, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    const w = this.wind;
    text(ctx, 'WIND', 8, y + 3, 'grey.4', { shadow: null });
    text(ctx, `${w >= 0 ? '+' : ''}${w.toFixed(1)}`, 8, y + 11, w >= 0 ? 'green.2' : 'lamp.2');
    const sx = 46;
    fill(ctx, 'grey.4', sx, y + 3, 1, 14);
    const len = 4 + Math.abs(w) * 3;
    const dir = w >= 0 ? 1 : -1;
    for (let i = 0; i < len; i++) {
      fill(ctx, Math.floor(i / 3) % 2 ? 'grey.6' : 'lamp.1', sx + dir * (i + 1), y + 4 + Math.floor(i / 6), 1, Math.max(2, 4 - Math.floor(i / 4)));
    }

    // bottom: run speed + angle dial
    const by = 190;
    panel(ctx, 4, by, 150, 22, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'RUN', 8, by + 3, 'grey.4', { shadow: null });
    meter(ctx, 30, by + 3, 70, 6, this.v / JAVELIN.vmax, { fg: this.v > 7.5 ? 'yellow.1' : 'green.2' });
    const toLine = -this.x;
    text(ctx, 'LINE', 8, by + 12, 'grey.4', { shadow: null });
    text(ctx, toLine >= 0 ? `${toLine.toFixed(1)}M` : 'OVER', 34, by + 12, toLine < 1.5 ? 'orange.3' : 'grey.6');

    // angle dial
    const cx = 120, cy = by + 19, r = 15;
    for (let a = 0; a <= 90; a += 6) {
      const rr = (a * Math.PI) / 180;
      const good = a >= 30 && a <= 40;
      fill(ctx, good ? 'green.2' : 'grey.3', cx + Math.cos(rr) * r, cy - Math.sin(rr) * r, 1, 1);
    }
    const showA = this.state === 'angle' || this.state === 'throw' || this.state === 'flight' || this.state === 'landed';
    if (showA) {
      const rr = (this.angle * Math.PI) / 180;
      pixLine(ctx, cx, cy, cx + Math.cos(rr) * (r - 2), cy - Math.sin(rr) * (r - 2), 'yellow.2');
      text(ctx, `${Math.round(this.angle)}`, cx + 18, by + 3, 'yellow.2');
    }
    circle(ctx, cx, cy, 1, 'grey.6');
    if (this.state === 'angle') banner(ctx, 'ANGLE!', 30, 'green.3', 'PRESS SPACE TO RELEASE');
    if (jp) text(ctx, `${Math.max(0, jp.x).toFixed(1)}M`, W - 8, by + 8, 'grey.6', { align: 'right' });
  }
}
