// HAMMER THROW — rhythm and release. Two wind-ups, then up to five turns.
// Press SPACE as the ball sweeps through the low point (the green arc) to
// drive it faster; press UP to let go while it's in the yellow release arc.
// Too early hits the cage, too late lands outside the sector, and a sixth
// turn takes you out of the circle. Three throws, best counts.
import { Scene } from '../../engine/game.js';
import { fill, panel, text, meter, pixLine, circle, W } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { HAMMER, Hammer, turnQuality } from '../sim/hammer.js';
import { drawStadium, drawGrass } from '../stadium.js';
import { playerSheet } from '../assets.js';
import { topBar, banner, fmtDist } from '../hud.js';

const ATTEMPTS = 3;
const CX = 66;          // screen x of the circle
const GROUND = 168;     // screen y of the circle
const PX = 3.3;         // field pixels per metre
const RX = 30, RY = 9;  // ellipse the ball swings round, in pixels
const DEG = Math.PI / 180;

export class HammerScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.sheet = playerSheet(o.player);
    this.attempts = [];
    this.t = 0;
    this.newAttempt();
  }

  newAttempt() {
    this.h = new Hammer();
    this.state = 'ready';
    this.stateT = 0;
    this.pops = [];
    this.flight = null;
    this.trail = [];
    this.excite = 0.15;
  }

  get best() {
    const v = this.attempts.filter((a) => a.value != null).map((a) => a.value);
    return v.length ? Math.max(...v) : null;
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    this.pops = this.pops.filter((p) => (p.t += dt) < 0.9);
    const h = this.h;
    switch (this.state) {
      case 'ready':
        if (this.stateT > 0.4 && input.wasPressed('a')) { this.state = 'throw'; this.stateT = 0; sfx.ready(); }
        break;
      case 'throw': {
        if (input.wasPressed('a')) {
          const r = h.press();
          if (r && !r.wind) {
            sfx.step(r.q >= 1);
            this.pops.push(r.extra ? { msg: 'STUMBLE', col: 'lamp.2', t: 0 }
              : { msg: r.q >= 1 ? 'PERFECT' : r.q > 0.5 ? 'GOOD' : r.q > 0 ? 'LATE' : 'MISSED', col: r.q >= 1 ? 'green.2' : r.q > 0 ? 'yellow.2' : 'lamp.2', t: 0 });
            if (r.q > 0 && Math.abs(h.fromLow) > HAMMER.perfect) this.pops.at(-1).msg = h.fromLow > 0 ? 'LATE' : 'EARLY';
          }
        }
        if (input.wasPressed('up')) {
          const r = h.release();
          if (r) {
            sfx.whoosh();
            this.flight = { ...r, t: 0, x0: this.ballScreen().x, y0: this.ballScreen().y };
            const a = r.elev * DEG;
            this.flight.vx = r.v * Math.cos(a) * 0.93;
            this.flight.vy = r.v * Math.sin(a);
            this.flight.T = r.foul && r.dirErr < 0 ? 0.35 : (this.flight.vy + Math.sqrt(this.flight.vy ** 2 + 2 * HAMMER.g * HAMMER.h)) / HAMMER.g;
            this.state = 'flight'; this.stateT = 0;
          }
        }
        for (const e of h.update(dt)) {
          if (e.type === 'turn' || e.type === 'spin') sfx.beat();
          if (e.type === 'foul') { this.endAttempt(null, e.why); sfx.bad(); }
        }
        this.trail.push(this.ballScreen());
        if (this.trail.length > 8) this.trail.shift();
        break;
      }
      case 'flight': {
        const f = this.flight;
        f.t += dt;
        this.excite = 0.3 + Math.min(0.5, f.t / 5);
        if (f.t >= f.T) {
          f.t = f.T;
          sfx.thud();
          if (f.foul) { this.endAttempt(null, f.why); }
          else { this.endAttempt(f.distance, null); sfx.crowd(0.8, 2); }
        }
        break;
      }
      case 'landed':
        if (this.stateT > 3 || (this.stateT > 0.8 && input.confirm())) {
          if (this.attempts.length >= ATTEMPTS) return this.o.onDone(this.best);
          this.newAttempt();
        }
        break;
    }
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

  /** Ball position on the swing ellipse: low point (angle 0) behind, release towards the field. */
  ballScreen(a = this.h.a) {
    const h = this.h;
    const tilt = h.state === 'wind' ? 0.2 : 0.55; // the plane steepens once spinning
    const x = CX - Math.cos(a) * RX;
    const depth = Math.sin(a); // + = towards the camera
    const y = GROUND - 22 + Math.cos(a) * RY * tilt * 2 + depth * RY * 0.6 - (h.state === 'wind' ? (1 - Math.cos(a)) * 12 : 0);
    return { x, y, depth };
  }

  // ---- drawing --------------------------------------------------------------

  draw(ctx) {
    drawStadium(ctx, 0, { excite: this.excite, t: this.t, salt: 'hammer' });
    drawGrass(ctx, 0);
    this.drawField(ctx);
    this.drawCage(ctx, false);
    const b = this.ballScreen();
    const showBall = this.state === 'throw' || this.state === 'ready';
    if (showBall && b.depth < 0) this.drawHammer(ctx, b);
    this.drawThrower(ctx);
    if (showBall && b.depth >= 0) this.drawHammer(ctx, b);
    this.drawCage(ctx, true);
    if (this.flight) this.drawFlight(ctx);
    for (const p of this.pops) text(ctx, p.msg, CX, GROUND - 70 - p.t * 14, p.col, { align: 'center' });

    const right = this.attempts.length < ATTEMPTS || this.state !== 'landed'
      ? `THROW ${Math.min(ATTEMPTS, this.attempts.length + (this.state === 'landed' ? 0 : 1))}/${ATTEMPTS}` : 'FINAL';
    topBar(ctx, 'HAMMER', this.o.player.name, right);
    this.drawHud(ctx);
    if (this.state === 'ready') banner(ctx, 'PRESS SPACE', 30, 'yellow.2', 'SPACE IN THE GREEN, UP IN THE YELLOW');
    if (this.state === 'landed') {
      const v = this.lastValue;
      banner(ctx, v != null ? fmtDist(v) : 'FOUL', 30, v != null ? 'yellow.2' : 'lamp.2', v != null ? (this.newRecord ? 'NEW RECORD!' : `${this.h.stats.perfect} PERFECT TURNS`) : this.lastReason);
    }
  }

  drawField(ctx) {
    // the circle, the sector lines fanning out and the distance arcs
    const x0 = CX, y0 = GROUND;
    for (let m = 20; m <= 90; m += 10) {
      const x = x0 + m * PX;
      for (let y = GROUND - 8; y < 214; y += 3) fill(ctx, 'grey.5', x, y + ((m / 10) % 2), 1, 2);
      text(ctx, `${m}`, x, 206, 'grey.6', { align: 'center', shadow: 'grass.0' });
    }
    pixLine(ctx, x0, y0 - 2, W, y0 - 12, 'grey.6');
    pixLine(ctx, x0, y0 + 2, W, y0 + 34, 'grey.6');
    fill(ctx, 'grey.4', x0 - 14, y0 - 3, 28, 6);
    fill(ctx, 'grey.3', x0 - 12, y0 - 2, 24, 4);
    fill(ctx, 'grey.6', x0 - 14, y0 - 3, 28, 1);
    const flag = (m, color, label) => {
      if (m == null) return;
      const x = x0 + m * PX;
      fill(ctx, 'grey.4', x, GROUND - 22, 1, 22);
      fill(ctx, color, x + 1, GROUND - 22, 8, 5);
      text(ctx, label, x + 1, GROUND - 31, color, { align: 'center' });
    };
    flag(this.o.record, 'yellow.1', 'WR');
    flag(this.best, 'cyan.1', 'PB');
  }

  drawCage(ctx, front) {
    // a C-shaped net round the back of the circle, open towards the field
    const top = GROUND - 62;
    const posts = front ? [[-24, 6], [12, 8]] : [[-30, -6], [-12, -10], [8, -8]];
    for (const [dx, dy] of posts) {
      const x = CX + dx, y = GROUND + dy;
      fill(ctx, 'grey.5', x, top + dy, 1, y - top - dy);
      if (!front) for (let yy = top + dy + 2; yy < y; yy += 4) fill(ctx, 'grey.3', x - 8, yy, 8, 1);
    }
    if (!front) {
      // the net between the back posts
      for (let x = CX - 30; x < CX + 8; x += 2) for (let y = top - 4; y < GROUND - 6; y += 2) if (((x + y) >> 1) % 2) fill(ctx, 'grey.1', x, y, 1, 1);
    }
  }

  drawThrower(ctx) {
    const h = this.h, tag = this.sheet.tag(this.state === 'ready' ? 'hm_wind' : this.state === 'throw' ? (h.state === 'wind' ? 'hm_wind' : 'hm_spin') : 'hm_release');
    let idx = tag.from, flip = false;
    if (this.state === 'throw' && h.state === 'spin') {
      // face the ball: arms out when it's to the side, across the body in front/behind
      const side = -Math.cos(h.a), across = Math.abs(side) < 0.5;
      idx = tag.from + (across ? 1 : 0);
      flip = across ? Math.sin(h.a) < 0 : side < 0;
    } else if (this.state === 'landed' && this.lastValue == null) idx = this.sheet.tag('dejected').from;
    else if (this.state === 'landed' && this.stateT > 1) idx = this.sheet.tag('celebrate').from + (Math.floor(this.t * 4) % 2);
    fill(ctx, 'grass.0', CX - 6, GROUND + 1, 13, 2);
    this.sheet.draw(ctx, idx, CX, GROUND + 1, { flip });
    this.handIdx = idx; this.handFlip = flip;
  }

  drawHammer(ctx, b) {
    const a = this.sheet.anchor(this.handIdx ?? 0, 'handF') || { x: 6, y: -30 };
    const hx = CX + (this.handFlip ? -a.x : a.x), hy = GROUND + 1 + a.y;
    for (let i = 0; i < this.trail.length - 1; i++) {
      const p = this.trail[i];
      if (this.h.w > 9) fill(ctx, i % 2 ? 'grey.5' : 'grey.4', p.x, p.y, 1, 1);
    }
    pixLine(ctx, hx, hy, b.x, b.y, 'grey.1');
    circle(ctx, b.x, b.y, 3, 'grey.0');
    circle(ctx, b.x - 0.5, b.y - 0.5, 2, 'grey.2');
    fill(ctx, 'grey.5', b.x - 1, b.y - 2, 1, 1);
  }

  drawFlight(ctx) {
    const f = this.flight;
    if (f.foul && f.dirErr < 0) {
      // straight into the net
      const u = Math.min(1, f.t / f.T);
      circle(ctx, f.x0 + 10 * u, f.y0 - 4 * u, 2.5, 'grey.1');
      return;
    }
    const d = f.vx * f.t, y = HAMMER.h + f.vy * f.t - 0.5 * HAMMER.g * f.t * f.t;
    const sx = CX + d * PX, sy = GROUND - Math.max(0, y) * PX * (f.foul ? 1 : 1) + (f.foul ? d * 0.4 : 0);
    fill(ctx, 'grass.0', sx - 3, GROUND + 2 + (f.foul ? d * 0.4 : 0), 7, 2);
    pixLine(ctx, sx, sy, sx - 4, sy + 2, 'grey.4'); // trailing wire
    circle(ctx, sx, sy, 2.5, 'grey.1');
    circle(ctx, sx - 0.5, sy - 0.5, 1.5, 'grey.3');
    if (this.state === 'landed' && !f.foul) {
      fill(ctx, 'orange.1', sx - 4, GROUND + 3, 9, 2);
      text(ctx, fmtDist(f.distance), sx, GROUND + 8, 'yellow.2', { align: 'center' });
    }
  }

  drawHud(ctx) {
    const h = this.h, y = 14;
    panel(ctx, W - 92, y, 88, 32, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (let i = 0; i < ATTEMPTS; i++) {
      const a = this.attempts[i];
      text(ctx, `${i + 1} ${a ? (a.value != null ? fmtDist(a.value) : 'FOUL') : '--'}`, W - 88, y + 3 + i * 9, a && a.value == null ? 'lamp.2' : 'grey.6');
    }
    // swing dial: the ball's angle round the circle, with the drive arc
    // (low point) in green and the release arc in yellow
    const cx = 34, cy = y + 30, r = 22;
    panel(ctx, 4, y, 60, 60, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (let d = 0; d < 360; d += 4) {
      const a = d * DEG;
      const fromLow = Math.abs(((a + Math.PI) % (2 * Math.PI)) - Math.PI);
      const rel = Math.abs(((a - HAMMER.aim + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      const col = turnQuality(fromLow) >= 1 ? 'green.2' : turnQuality(fromLow) > 0 ? 'green.1' : rel <= HAMMER.sector ? 'yellow.2' : 'grey.3';
      fill(ctx, col, cx - Math.cos(a) * r, cy + Math.sin(a) * r, 2, 2);
    }
    if (this.state === 'throw') {
      const a = h.a;
      pixLine(ctx, cx, cy, cx - Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3), 'grey.6');
      circle(ctx, cx - Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3), 2, 'grey.6');
    }
    circle(ctx, cx, cy, 1, 'grey.5');
    // turns + speed + balance
    const by = 190;
    panel(ctx, 4, by, 176, 22, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'TURN', 8, by + 3, 'grey.4', { shadow: null });
    for (let i = 0; i < HAMMER.maxTurns; i++) {
      const on = h.state === 'spin' && i <= h.turn;
      fill(ctx, i === HAMMER.maxTurns - 1 ? (on ? 'lamp.2' : 'lamp.0') : on ? 'yellow.2' : 'grey.3', 36 + i * 7, by + 4, 5, 5);
    }
    text(ctx, 'SPEED', 8, by + 12, 'grey.4', { shadow: null });
    meter(ctx, 40, by + 13, 70, 4, (h.speed - 10) / (HAMMER.wMax * HAMMER.r - 10), { fg: 'cyan.1' });
    text(ctx, `${h.speed.toFixed(1)}M/S`, 114, by + 12, 'cyan.2', { shadow: null });
    text(ctx, 'BALANCE', 76, by + 3, 'grey.4', { shadow: null });
    meter(ctx, 122, by + 4, 52, 4, 1 - h.balance, { fg: h.balance > 0.6 ? 'lamp.1' : 'green.2' });
    if (this.state === 'throw' && h.state === 'wind') text(ctx, 'WIND-UPS... GET READY', W / 2, 40, 'grey.6', { align: 'center' });
    if (this.state === 'throw' && h.state === 'spin' && h.turn >= HAMMER.maxTurns - 2) text(ctx, h.turn >= HAMMER.maxTurns - 1 ? 'LAST TURN! UP IN THE YELLOW' : 'UP IN THE YELLOW TO RELEASE', W / 2, 40, Math.floor(this.t * 4) % 2 ? 'yellow.2' : 'grey.6', { align: 'center' });
  }
}
