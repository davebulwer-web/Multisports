// CABER TOSS — balance and timing. Run with the caber balanced on your hands:
// running harder pulls the base under it (it leans back), easing off lets
// it topple forward. Keep it from falling sideways with the arrows, let it
// tip into the toss zone and heave with UP. The judges score how straight
// it lands, on a clock face: 12:00 is perfect. Three tosses.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, dither, bands, panel, text, meter, pixLine, circle, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { CABER, Caber, fmtClock } from '../sim/caber.js';
import { makeRng } from '../sim/rng.js';
import { assets, playerSheet } from '../assets.js';
import { topBar, banner, fmtPts } from '../hud.js';
import { hash } from '../winter.js';

const PX = 22;          // pixels per metre
const GROUND = 196;     // screen y of the grass the athlete stands on
const START = 60;       // world px of the pick-up spot
const TOSSES = CABER.tosses;
const DEG = Math.PI / 180;
const L = CABER.length;
const toPx = (m) => START + m * PX;

export class CaberScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.rng = makeRng();
    this.results = [];
    this.anim = new Anim(playerSheet(o.player), 'caber_hold');
    this.t = 0;
    this.newToss();
  }

  get total() { return this.results.reduce((a, r) => a + r.points, 0); }

  newToss() {
    this.state = 'ready';
    this.stateT = 0;
    this.c = new Caber(this.rng);
    this.c.pitch = 2; this.c.roll = 0;
    this.fly = null;
    this.result = null;
    this.excite = 0.15;
    this.anim.play('caber_hold');
    this.camX = 0;
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    const c = this.c;
    const steer = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    switch (this.state) {
      case 'ready':
        if (input.wasPressed('a') && this.stateT > 0.3) {
          this.state = 'lift'; this.stateT = 0;
          this.anim.play('caber_lift');
          sfx.step(true);
        }
        break;
      case 'lift':
        if (this.stateT > 0.6) { this.state = 'run'; this.stateT = 0; this.anim.play('caber_hold'); }
        break;
      case 'run': {
        const run = input.isDown('a');
        c.update(dt, { run, steer });
        if (c.v > 0.3) {
          this.anim.play('caber_run');
          this.anim.speed = 0.4 + c.v / CABER.vmax;
        } else this.anim.play('caber_hold');
        if (c.dropped) { this.drop(); break; }
        if (input.wasPressed('up')) { this.toss(); break; }
        if (c.x >= CABER.runway) { this.foul('NO ROOM LEFT', 'TOSS BEFORE THE END OF THE RUN'); this.anim.play('dejected'); }
        break;
      }
      case 'flight': this.updateFlight(dt); break;
      case 'drop': {
        const f = this.fall;
        f.w += (Math.sign(f.a) || f.dir) * 320 * dt;
        f.a += f.w * dt;
        if (Math.abs(f.a) >= 90) {
          f.a = 90 * Math.sign(f.a);
          if (!f.landed) { f.landed = true; sfx.thud(); }
        }
        if (this.stateT > 2.6 || (this.stateT > 1 && input.confirm())) this.next();
        break;
      }
      case 'landed':
        if (this.stateT > 1.1) {
          this.state = 'score'; this.stateT = 0;
          const last = this.results.length >= TOSSES;
          this.anim.play(this.result.turned && this.result.points >= 70 ? 'celebrate' : 'dejected');
          if (last && (this.o.record == null || this.total > this.o.record)) { this.newRecord = true; sfx.fanfare(); }
          else if (this.result.turned) sfx.jingle();
          else sfx.fail();
        }
        break;
      case 'score':
        if (this.stateT > 5 || (this.stateT > 0.8 && input.confirm())) this.next();
        break;
    }
    // camera: athlete on the left third; follow the caber once it flies
    const focus = this.fly ? toPx(this.fly.Tx) - 190 : toPx(c.x) - 120;
    this.camX += (Math.max(0, focus) - this.camX) * Math.min(1, dt * 4);
    this.anim.update(dt * 1000);
  }

  next() {
    if (this.results.length >= TOSSES) return this.o.onDone(this.total);
    this.newToss();
  }

  foul(msg, sub) {
    this.results.push({ turned: false, points: 0, off: null, reason: msg });
    this.result = this.results[this.results.length - 1];
    this.fall = { a: this.c.pitch, w: 0, dir: 1, landed: false, msg, sub, bx: this.c.x };
    this.state = 'drop'; this.stateT = 0;
    sfx.bad();
  }

  drop() {
    const c = this.c;
    const msg = c.dropped === 'SIDEWAYS' ? 'FELL SIDEWAYS' : c.dropped === 'BACK' ? 'FELL BACK' : 'FELL FORWARD';
    const sub = c.dropped === 'FORWARD' ? 'RUN HARDER TO GET UNDER IT' : c.dropped === 'BACK' ? 'EASE OFF SOONER' : 'STEER WITH LEFT AND RIGHT';
    this.foul(msg, sub);
    this.fall.dir = c.dropped === 'BACK' ? -1 : 1;
    this.fall.w = c.pitchV;
    this.anim.play('stumble');
  }

  toss() {
    const c = this.c;
    const r = c.toss();
    this.result = { ...r, reason: r.turned ? null : 'NO TURN' };
    this.results.push(this.result);
    this.state = 'flight'; this.stateT = 0;
    this.anim.play('caber_toss', { loop: false, restart: true });
    this.anim.speed = 1;
    sfx.whoosh();
    const hand = this.anim.anchor('handF') || { x: 6, y: -30 };
    const b0 = { x: c.x + hand.x / PX, y: -hand.y / PX };
    const Tx = b0.x + L * Math.sin(150 * DEG) + 1.2;
    const k = 9.81 / (L / 2);
    const turn = r.turned ? Math.max(1.06, r.turn) : r.turn;
    this.fly = {
      phase: 1, t: 0, b0, pitch: c.pitch, Tx,
      b1: { x: Tx - L * Math.sin(150 * DEG), y: -L * Math.cos(150 * DEG) },
      psi: -30, w: turn * Math.sqrt(2 * k * (1 - Math.cos(30 * DEG))) / DEG, k,
      base: { ...b0 }, ang: c.pitch,
    };
  }

  updateFlight(dt) {
    const f = this.fly;
    f.t += dt;
    this.excite = 0.3 + Math.min(0.4, f.t / 3);
    if (f.phase === 1) {
      const u = Math.min(1, f.t / 0.6), e = u * (2 - u);
      f.ang = f.pitch + (150 - f.pitch) * e;
      f.base = { x: f.b0.x + (f.b1.x - f.b0.x) * e, y: f.b0.y + (f.b1.y - f.b0.y) * e + Math.sin(Math.PI * u) * 0.6 };
      if (u >= 1) { f.phase = 2; sfx.thud(); }
    } else if (f.phase === 2) {
      // pivot about the top end, now on the ground
      const acc = (f.k * Math.sin(f.psi * DEG)) / DEG;
      f.w += acc * dt;
      f.psi += f.w * dt;
      if (Math.abs(f.psi) >= 90) {
        f.psi = 90 * Math.sign(f.psi);
        f.phase = 3;
        sfx.thud();
        if (this.result.turned) sfx.crowd(0.7, 1.6); else sfx.bad();
        this.excite = this.result.turned ? 0.8 : 0.1;
        this.state = 'landed'; this.stateT = 0;
      }
      f.base = { x: f.Tx + L * Math.sin(f.psi * DEG), y: L * Math.cos(f.psi * DEG) };
      f.ang = f.psi + 180;
    }
  }

  // ---- drawing ------------------------------------------------------------

  sx(m) { return toPx(m) - this.camX; }

  draw(ctx) {
    this.drawScenery(ctx);
    const c = this.c;
    const ax = this.sx(c.x);
    fill(ctx, 'grass.0', ax - 7, GROUND, 15, 2);
    this.anim.draw(ctx, ax, GROUND + 1);
    const hand = this.anim.anchor('handF') || { x: 6, y: -30 };
    if (this.state === 'flight' || this.state === 'landed' || this.state === 'score') {
      const f = this.fly;
      this.drawCaber(ctx, this.sx(f.base.x), GROUND - f.base.y * PX, f.ang);
    } else if (this.state === 'drop') {
      const fl = this.fall;
      const bx = this.sx(fl.bx) + hand.x, by = fl.landed ? GROUND - 2 : GROUND + 1 + hand.y;
      this.drawCaber(ctx, bx, by, fl.a);
    } else {
      this.drawCaber(ctx, ax + hand.x, GROUND + 1 + hand.y, c.pitch);
    }

    const n = Math.min(TOSSES, this.results.length + (this.state === 'ready' || this.state === 'lift' || this.state === 'run' ? 1 : 0));
    topBar(ctx, 'CABER TOSS', this.o.player.name, `TOSS ${Math.max(1, n)}/${TOSSES}`);
    this.drawCard(ctx);
    if (this.state === 'run' || this.state === 'lift' || this.state === 'ready') this.drawGauges(ctx);

    if (this.state === 'ready') {
      banner(ctx, this.results.length ? `TOSS ${this.results.length + 1}` : 'READY', 34, 'yellow.2', 'HOLD SPACE TO RUN, LEFT/RIGHT TO STEER');
    }
    if (this.state === 'run' && this.stateT < 3 && this.results.length === 0) {
      text(ctx, 'LET IT TIP INTO THE GREEN, THEN PRESS UP', W / 2 - 40, 58, 'grey.6', { align: 'center' });
    }
    if (this.state === 'drop' && this.stateT > 0.4) banner(ctx, this.fall.msg, 34, 'lamp.2', this.fall.sub);
    if (this.state === 'score') this.drawClock(ctx);
  }

  /** Caber from its base at (x, y), `ang` degrees from upright (+ = forward). */
  drawCaber(ctx, x, y, ang) {
    const a = ang * DEG;
    const dx = Math.sin(a) * L * PX, dy = -Math.cos(a) * L * PX;
    const nx = Math.cos(a), ny = Math.sin(a); // across the pole
    const line = (o, col, frac = 1) => pixLine(ctx, x + nx * o, y + ny * o, x + nx * o + dx * frac, y + ny * o + dy * frac, col);
    line(-2, 'orange.0', 0.85);
    line(-1, 'orange.1');
    line(0, 'orange.2');
    line(1, 'orange.3');
    line(2, 'orange.1', 0.6);
    // bark rings
    for (let i = 1; i < 6; i++) {
      const px = x + dx * (i / 6), py = y + dy * (i / 6);
      pixLine(ctx, px - nx * 1.5, py - ny * 1.5, px + nx * 1.5, py + ny * 1.5, 'orange.0');
    }
  }

  drawScenery(ctx) {
    const cam = this.camX;
    bands(ctx, ['sky.1', 'sky.2', 'sky.3'], 0, 0, W, 120);
    // clouds
    for (let i = 0; i < 4; i++) {
      const x = Math.round(((i * 131 - cam * 0.05 - this.t * 2) % 520 + 520) % 520) - 70;
      fill(ctx, 'grey.6', x, 18 + i * 9, 34, 4);
      fill(ctx, 'grey.6', x + 8, 15 + i * 9, 18, 4);
      fill(ctx, 'grey.5', x + 2, 22 + i * 9, 30, 1);
    }
    // far hills (heather) and near hills (grass)
    for (let x = 0; x < W; x += 2) {
      const u = x + cam * 0.15;
      const top = Math.round(78 - Math.sin(u / 53) * 14 - Math.sin(u / 19) * 4);
      fill(ctx, 'purple.1', x, top, 2, 140 - top);
      if (hash(Math.floor(u / 2)) < 0.25) fill(ctx, 'purple.2', x, top + 3, 1, 1);
      const v = x + cam * 0.35;
      const t2 = Math.round(108 - Math.sin(v / 71) * 9 - Math.sin(v / 23) * 3);
      fill(ctx, 'green.0', x, t2, 2, 150 - t2);
    }
    // marquee tents
    for (let i = -1; i < 4; i++) {
      const x = Math.round(i * 230 - ((cam * 0.6) % 230)) + 40;
      fill(ctx, 'grey.5', x, 104, 56, 18);
      for (let k = 0; k < 56; k += 8) fill(ctx, 'lamp.1', x + k, 104, 4, 18);
      for (let k = 0; k < 28; k++) fill(ctx, k % 8 < 4 ? 'lamp.1' : 'grey.6', x + 28 - k, 96 + k * 0.3, 1, 8 - k * 0.28);
      for (let k = 0; k < 28; k++) fill(ctx, k % 8 < 4 ? 'lamp.1' : 'grey.6', x + 28 + k, 96 + k * 0.3, 1, 8 - k * 0.28);
      fill(ctx, 'grey.1', x + 24, 110, 8, 12);
      fill(ctx, 'grey.2', x + 28, 90, 1, 6);
      fill(ctx, 'yellow.1', x + 29, 90, 4, 3);
    }
    // field
    fill(ctx, 'grass.1', 0, 122, W, H - 122);
    for (let s = Math.floor(cam / 48) - 1; s < cam / 48 + W / 48 + 2; s++) {
      if (s % 2) continue;
      fill(ctx, 'grass.2', Math.round(s * 48 - cam), 122, 48, H - 122);
    }
    // crowd behind the rope
    const excite = this.excite;
    const c0 = Math.floor(cam * 0.8 / 9) - 1;
    for (let r = 0; r < 2; r++) {
      for (let c = c0; c < c0 + W / 9 + 3; c++) {
        const h = hash(c * 7 + r * 131);
        if (h < 0.15) continue;
        const fan = Math.floor(h * 8);
        const cheering = hash(c + r * 999) < excite;
        const frame = cheering && Math.floor(this.t * 4 + h * 4) % 2 === 0 ? 1 : 0;
        const tag = assets.props.tags[`fan_${fan}`];
        assets.props.draw(ctx, tag.from + frame, Math.round(c * 9 + r * 4 - cam * 0.8), 134 + r * 7);
      }
    }
    for (let x = 0; x < W; x++) {
      const wx = x + cam * 0.8;
      if (Math.floor(wx) % 40 === 0) fill(ctx, 'grey.6', x, 136, 1, 10);
      fill(ctx, 'grey.6', x, 139 + Math.round(Math.sin((wx % 40) / 40 * Math.PI) * 2), 1, 1);
    }
    // throwing area: start mark and end of the run
    const s0 = this.sx(0), s1 = this.sx(CABER.runway);
    fill(ctx, 'grey.6', s0, GROUND - 4, 1, 8);
    for (let y = GROUND - 6; y < H; y += 3) fill(ctx, 'lamp.1', s1, y, 2, 2);
    text(ctx, 'END', s1 + 1, GROUND + 8, 'lamp.2', { align: 'center', shadow: 'grass.0' });
  }

  drawCard(ctx) {
    const w = 104, x = W - w - 4, y = 14;
    panel(ctx, x, y, w, 38, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    const hideLast = this.state === 'flight' || this.state === 'landed';
    for (let i = 0; i < TOSSES; i++) {
      const r = hideLast && i === this.results.length - 1 ? null : this.results[i];
      const s = !r ? '--' : r.turned ? `${fmtClock(r.off)}  ${r.points}` : r.reason;
      text(ctx, `${i + 1} ${s}`, x + 4, y + 3 + i * 9, r && !r.turned ? 'lamp.2' : 'grey.6');
    }
    text(ctx, `TOTAL ${this.total - (hideLast ? this.result.points : 0)}`, x + w - 4, y + 30, 'cyan.2', { align: 'right' });
  }

  drawGauges(ctx) {
    const c = this.c, by = 190;
    // speed
    panel(ctx, 4, 14, 92, 22, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'SPEED', 8, 17, 'grey.4', { shadow: null });
    meter(ctx, 40, 17, 52, 5, c.v / CABER.vmax, { fg: 'green.2' });
    text(ctx, 'ROOM', 8, 26, 'grey.4', { shadow: null });
    const room = Math.max(0, c.toLine);
    text(ctx, `${room.toFixed(1)}M`, 40, 26, room < 3 ? 'orange.3' : 'grey.6');

    // forward/back lean: keep it alive, toss it in the green
    const w = 150, x = W / 2 - w / 2 - 30, y = by + 8;
    panel(ctx, x - 4, by - 4, w + 8, 22, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    const range = CABER.pitch.drop;
    const px = (d) => x + w / 2 + (d / range) * (w / 2);
    fill(ctx, 'lamp.0', x, y, w, 5);
    fill(ctx, 'grey.2', px(-24), y, px(30) - px(-24), 5);
    fill(ctx, 'green.1', px(CABER.sweet[0]), y, px(CABER.sweet[1]) - px(CABER.sweet[0]), 5);
    const m = Math.round(px(Math.max(-range, Math.min(range, c.pitch))));
    fill(ctx, 'grey.6', m - 1, y - 2, 3, 9);
    fill(ctx, 'grey.0', m, y - 1, 1, 7);
    text(ctx, 'BACK', x, by - 1, 'grey.4', { shadow: null });
    text(ctx, 'LEAN', W / 2 - 30, by - 1, 'grey.5', { align: 'center', shadow: null });
    text(ctx, 'FWD', x + w, by - 1, 'grey.4', { align: 'right', shadow: null });

    // sideways lean, seen from behind
    const gx = W / 2 + 70, gy = by - 4;
    panel(ctx, gx, gy, 60, 22, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'SIDE', gx + 4, gy + 3, 'grey.4', { shadow: null });
    const cx = gx + 42, cy = gy + 19;
    const ra = Math.max(-1, Math.min(1, c.roll / CABER.roll.drop));
    const danger = Math.abs(ra) > 0.6;
    pixLine(ctx, cx, cy, cx + ra * 14, cy - 15 + Math.abs(ra) * 3, danger ? 'lamp.2' : 'orange.3');
    fill(ctx, 'grey.4', cx - 8, cy, 17, 1);
  }

  drawClock(ctx) {
    const r = this.result, x = W / 2, y = 104;
    panel(ctx, x - 100, y - 44, 200, 92, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
    const R = 30, cx = x - 50, cy = y + 2;
    circle(ctx, cx, cy, R, 'grey.4');
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      fill(ctx, h === 0 ? 'yellow.2' : 'grey.5', Math.round(cx + Math.sin(a) * (R - 3)), Math.round(cy - Math.cos(a) * (R - 3)), 1, 1);
    }
    text(ctx, '12', cx, cy - R - 9, 'yellow.2', { align: 'center' });
    fill(ctx, 'grey.6', cx - 1, cy + R - 4, 3, 3); // thrower
    if (r.turned) {
      const a = (r.off / 720) * Math.PI * 2;
      pixLine(ctx, cx, cy, cx + Math.sin(a) * (R - 4), cy - Math.cos(a) * (R - 4), 'orange.3');
      pixLine(ctx, cx + 1, cy, cx + 1 + Math.sin(a) * (R - 4), cy - Math.cos(a) * (R - 4), 'orange.2');
      text(ctx, fmtClock(r.off), x + 46, y - 30, 'yellow.2', { align: 'center', scale: 2 });
      text(ctx, `${r.points} PTS`, x + 46, y - 8, 'cyan.2', { align: 'center' });
      const word = r.points >= 95 ? 'PERFECT' : r.points >= 85 ? 'GREAT TOSS' : r.points >= 65 ? 'GOOD TOSS' : 'OFF LINE';
      text(ctx, word, x + 46, y + 4, r.points >= 85 ? 'green.2' : 'grey.5', { align: 'center' });
    } else {
      text(ctx, 'NO TURN', x + 46, y - 30, 'lamp.2', { align: 'center', scale: 2 });
      text(ctx, 'MORE SPEED AND LEAN', x + 46, y - 8, 'grey.5', { align: 'center' });
    }
    const last = this.results.length >= TOSSES;
    text(ctx, `TOTAL ${fmtPts(this.total)}${last && this.newRecord ? ' RECORD!' : ''}`, x + 46, y + 24, last && this.newRecord ? 'green.2' : 'yellow.2', { align: 'center' });
  }
}
