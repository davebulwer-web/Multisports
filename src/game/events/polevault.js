// POLE VAULT — speed control and timing. Pick a pole and a height, run in
// and arrive with the speed that pole wants, plant at the take-off mark,
// rock back at full bend and push off as the pole straightens. Clear a bar
// to go higher; three failures in a row and you're out.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, panel, text, meter, pixLine, W } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { VAULT, VaultComp, runStep, vaultResult } from '../sim/vault.js';
import { drawStadium, drawGrass } from '../stadium.js';
import { playerSheet } from '../assets.js';
import { topBar, banner, fmtDist } from '../hud.js';

const PX = 16;            // pixels per metre
const GROUND = 200;       // screen y of the runway
const BOX = VAULT.runway; // world metres of the box
const BAR_X = BOX + 0.5;  // the bar sits just past the box
const POLE = 5.0;         // pole length (m)
const DEG = Math.PI / 180;
const toPx = (m) => 40 + m * PX;
const smooth = (u) => u * u * (3 - 2 * u);

export class PoleVaultScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.comp = new VaultComp();
    this.pole = 2;
    this.anim = new Anim(playerSheet(o.player), 'idle');
    this.t = 0;
    this.camX = 0;
    this.excite = 0.15;
    this.newJump();
  }

  newJump() {
    this.state = 'setup';
    this.stateT = 0;
    this.x = 0; this.v = 0;
    this.res = null;
    this.rockErr = null; this.pushErr = null;
    this.barDrop = null;
    this.fly = null;
    this.anim.play('idle');
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    switch (this.state) {
      case 'setup': {
        const c = this.comp;
        if (input.wasPressed('up')) { c.setBar(c.bar + VAULT.step); sfx.blip(); }
        if (input.wasPressed('down')) { c.setBar(c.bar - VAULT.step); sfx.blip(); }
        if (input.wasPressed('left')) { this.pole = Math.max(0, this.pole - 1); sfx.blip(); }
        if (input.wasPressed('right')) { this.pole = Math.min(VAULT.poles.length - 1, this.pole + 1); sfx.blip(); }
        if (this.stateT > 0.3 && input.wasPressed('a')) { this.state = 'run'; this.stateT = 0; sfx.ready(); }
        break;
      }
      case 'run': {
        this.v = runStep(this.v, input.isDown('a'), dt);
        this.x += this.v * dt;
        if (this.v > 0.3) { this.anim.play('pv_run'); this.anim.speed = 0.4 + this.v / VAULT.vmax; }
        else this.anim.play('idle');
        if (input.wasPressed('down')) this.plant();
        else if (this.x > BOX - 0.6) {
          this.x = BOX - 0.6;
          this.finish(false, 'RAN THROUGH');
          this.anim.play('stumble');
        }
        break;
      }
      case 'pole': this.updatePole(dt, input); break;
      case 'fly': this.updateFly(dt); break;
      case 'fallback':
        if (this.stateT > 1.1 && !this.shown) { this.shown = true; this.finish(false, this.res.fail); }
        break;
      case 'result':
        if (this.barDrop) this.barDrop.t += dt;
        if (this.stateT > 1.2) this.anim.play(this.cleared ? 'celebrate' : 'dejected');
        if (this.stateT > 4 || (this.stateT > 0.9 && input.confirm())) {
          if (this.comp.over) return this.o.onDone(this.comp.best);
          this.newJump();
        }
        break;
    }
    const focus = this.fly ? toPx(BAR_X) - W / 2 : this.state === 'pole' || this.state === 'fallback' ? toPx(BOX) - W / 2 - 40 : toPx(this.x) - 140;
    this.camX += (Math.max(0, focus) - this.camX) * Math.min(1, dt * 5);
    this.anim.update(dt * 1000);
  }

  plant() {
    const dist = BOX - this.x;
    this.takeoffErr = VAULT.takeoff - dist;
    this.speed = this.v;
    this.state = 'pole'; this.stateT = 0;
    this.anim.play('pv_plant'); this.anim.speed = 1;
    sfx.step(true);
    // a hopeless plant shows straight away
    const pre = vaultResult({ speed: this.v, pole: this.pole, takeoffErr: this.takeoffErr, rockErr: 0, pushErr: 0, bar: this.comp.bar });
    this.preFail = pre.fail;
    this.phi0 = Math.atan2(2.3, Math.max(0.5, dist)) / DEG;
    this.hand0 = { x: this.x + 0.3, y: 2.3 };
  }

  get tTop() { return (this.rockErr == null ? VAULT.bendT + 0.35 : VAULT.bendT + this.rockErr) + VAULT.recoilT; }

  updatePole(dt, input) {
    const t = this.stateT;
    if (this.preFail) {
      if (t > 0.5) { this.res = { fail: this.preFail }; this.state = 'fallback'; this.stateT = 0; this.shown = false; sfx.bad(); this.anim.play('stumble'); }
      return;
    }
    if (t > 0.12 && this.anim.tagName === 'pv_plant') this.anim.play('pv_hang');
    if (this.rockErr == null && t > 0.15 && input.wasPressed('a')) {
      this.rockErr = t - VAULT.bendT;
      this.anim.play('pv_rock');
      sfx.whoosh();
    }
    if (this.rockErr == null && t > VAULT.bendT + 0.35 && this.anim.tagName !== 'pv_rock') this.anim.play('pv_rock');
    if (t > this.tTop - 0.2 && this.anim.tagName === 'pv_rock') this.anim.play('pv_push');
    const pressed = this.pushErr == null && t > 0.3 && input.wasPressed('up');
    if (pressed) this.pushErr = t - this.tTop;
    if (pressed || t > this.tTop + 0.3) this.release();
  }

  /** Where the top hand is and how bent the pole is at time t after the plant. */
  poleAt(t) {
    const top = this.tTop;
    const b = t < VAULT.bendT ? Math.sin((Math.PI / 2) * Math.min(1, t / VAULT.bendT)) : Math.max(0, Math.cos((Math.PI / 2) * Math.min(1, (t - VAULT.bendT) / Math.max(0.1, top - VAULT.bendT))));
    const phiEnd = this.res ? Math.asin(Math.min(1, Math.max(0.3, (this.res.peak - 0.7) / VAULT.grip))) / DEG : 88;
    const phi = this.phi0 + (phiEnd - this.phi0) * smooth(Math.min(1, t / top));
    const len = POLE * (1 - 0.3 * b);
    return { phi, bend: b, hand: { x: BOX - Math.cos(phi * DEG) * len, y: Math.sin(phi * DEG) * len } };
  }

  /** Body rotation (degrees, canvas) during the pole phase. */
  bodyAt(t) {
    if (this.rockErr == null && t < VAULT.bendT + 0.35) return -10 * Math.min(1, t / 0.4);
    const t0 = this.rockErr == null ? VAULT.bendT + 0.35 : VAULT.bendT + this.rockErr;
    return -10 - 170 * smooth(Math.min(1, Math.max(0, (t - t0) / (this.tTop - t0))));
  }

  release() {
    this.res = vaultResult({ speed: this.speed, pole: this.pole, takeoffErr: this.takeoffErr, rockErr: this.rockErr, pushErr: this.pushErr, bar: this.comp.bar });
    const p = this.poleAt(this.stateT);
    const body = this.bodyAt(this.stateT);
    // hip of the vaulter now, from the hand
    const ha = this.anim.anchor('handF') || { x: 0, y: -40 }, hp = this.anim.anchor('hip') || { x: 0, y: -21 };
    const dx = hp.x - ha.x, dy = hp.y - ha.y, a = body * DEG;
    const hip = { x: p.hand.x + (dx * Math.cos(a) - dy * Math.sin(a)) / PX, y: p.hand.y - (dx * Math.sin(a) + dy * Math.cos(a)) / PX };
    const peak = Math.max(hip.y + 0.1, this.res.peak);
    const tr = Math.sqrt((2 * (peak - hip.y)) / VAULT.g);
    this.fly = { t: 0, x0: hip.x, y0: hip.y, peak, tr, vx: Math.max(0.6, (BAR_X - hip.x) / Math.max(0.15, tr)), body, passed: false, poleT: this.stateT, landed: false };
    this.anim.play('pv_push');
    this.state = 'fly'; this.stateT = 0;
    if (this.pushErr != null) sfx.whoosh();
  }

  updateFly(dt) {
    const f = this.fly;
    f.t += dt;
    const x = f.x0 + f.vx * Math.min(f.t, f.tr + 0.9);
    const y = f.t < f.tr ? f.peak - 0.5 * VAULT.g * (f.tr - f.t) ** 2 : f.peak - 0.5 * VAULT.g * (f.t - f.tr) ** 2;
    f.x = x; f.y = Math.max(0.55, y);
    f.ang = f.body + (-270 - f.body) * smooth(Math.min(1, f.t / (f.tr + 0.35)));
    if (f.t > f.tr * 0.6) this.anim.play('pv_arch');
    this.excite = 0.3 + Math.min(0.4, f.t);
    if (!f.passed && x >= BAR_X - 0.1) {
      f.passed = true;
      if (!this.res.cleared) { this.barDrop = { t: 0 }; sfx.clang(); }
    }
    if (y <= 0.55 && f.t > f.tr && !f.landed) {
      f.landed = true;
      sfx.thud();
      this.finish(this.res.cleared, this.res.cleared ? null : 'KNOCKED THE BAR');
    }
  }

  finish(cleared, reason) {
    this.cleared = cleared;
    this.reason = reason;
    const bar = this.comp.bar;
    this.comp.record(cleared, reason);
    this.lastBar = bar;
    this.state = 'result'; this.stateT = 0;
    this.newRecord = cleared && (this.o.record == null || bar > this.o.record);
    if (this.newRecord) sfx.fanfare();
    else if (cleared) { sfx.jingle(); sfx.crowd(0.7, 1.6); }
    else sfx.bad();
    this.excite = cleared ? 0.85 : 0.1;
  }

  // ---- drawing ------------------------------------------------------------

  sx(m) { return toPx(m) - this.camX; }
  sy(m) { return GROUND - m * PX; }

  draw(ctx) {
    drawStadium(ctx, this.camX, { excite: this.excite, t: this.t });
    drawGrass(ctx, this.camX);
    this.drawField(ctx);

    const st = this.state;
    if (st === 'pole' && !this.preFail) this.drawPoleVaulter(ctx, this.stateT);
    else if (st === 'fly' || (st === 'result' && this.fly)) this.drawFlight(ctx);
    else if (st === 'pole' || st === 'fallback') this.drawFallBack(ctx);
    else {
      const ax = this.sx(this.x);
      fill(ctx, 'grass.0', ax - 6, GROUND, 13, 2);
      this.anim.draw(ctx, ax, GROUND + 1);
      const hf = this.anim.anchor('handF'), hb = this.anim.anchor('handB');
      if (st !== 'result' && hf && hb) {
        // carry: pole through both hands, tip forward and low
        const a = Math.atan2(hf.y - hb.y, hf.x - hb.x) * 0.3 - 6 * DEG;
        const x0 = ax + hb.x, y0 = GROUND + 1 + hb.y;
        this.drawPole(ctx, x0 - Math.cos(a) * 18, y0 - Math.sin(a) * 18, x0 + Math.cos(a) * (POLE * PX - 18), y0 + Math.sin(a) * (POLE * PX - 18), 0);
      }
    }
    this.drawBar(ctx, true);

    topBar(ctx, 'POLE VAULT', this.o.player.name, `JUMP ${Math.min(VAULT.jumps, this.comp.jumps.length + (st === 'result' ? 0 : 1))}/${VAULT.jumps}`);
    this.drawCard(ctx);
    if (st === 'setup') this.drawSetup(ctx);
    if (st === 'run' || st === 'pole') this.drawGauges(ctx);
    if (st === 'run' && this.stateT < 3 && this.comp.jumps.length === 0) text(ctx, 'PRESS DOWN AT THE WHITE MARK TO PLANT', W / 2, 40, 'grey.6', { align: 'center' });
    if (st === 'result') {
      const sub = this.res && !this.res.fail ? `PEAK ${this.res.peak.toFixed(2)}M` : this.reason === 'RAN THROUGH' ? 'PLANT BEFORE THE BOX' : this.hint();
      banner(ctx, this.cleared ? `${fmtDist(this.lastBar)} CLEARED` : this.reason, 30, this.cleared ? 'yellow.2' : 'lamp.2', this.cleared && this.newRecord ? 'NEW RECORD!' : sub);
    }
  }

  hint() {
    const r = this.reason;
    if (r === 'RAN UNDER') return 'PLANT FURTHER BACK';
    if (r === 'TOO FAR OUT') return 'PLANT CLOSER TO THE BOX';
    if (r === 'POLE WON\'T BEND') return 'MORE SPEED OR A SOFTER POLE';
    return '';
  }

  drawPole(ctx, x0, y0, x1, y1, bulge) {
    // quadratic bend, bulging forward/up from the chord
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = (y1 - y0) / len, ny = -(x1 - x0) / len;
    const cx = mx + nx * bulge, cy = my + ny * bulge;
    let px = x0, py = y0;
    for (let i = 1; i <= 12; i++) {
      const u = i / 12;
      const x = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * cx + u * u * x1;
      const y = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * cy + u * u * y1;
      pixLine(ctx, px, py + 1, x, y + 1, 'grey.1');
      pixLine(ctx, px, py, x, y, i > 9 ? 'yellow.2' : 'yellow.1');
      px = x; py = y;
    }
  }

  drawRot(ctx, x, y, ang, key) {
    const a = this.anim.anchor(key) || { x: 0, y: -30 };
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ang * DEG);
    this.anim.draw(ctx, -a.x, -a.y);
    ctx.restore();
  }

  drawPoleVaulter(ctx, t) {
    const p = this.poleAt(t);
    const hx = this.sx(p.hand.x), hy = this.sy(p.hand.y);
    // early in the plant the body is still moving from the take-off spot
    this.drawPole(ctx, this.sx(BOX), GROUND, hx, hy, -p.bend * 26);
    this.drawRot(ctx, hx, hy, this.bodyAt(t), 'handF');
  }

  drawFallBack(ctx) {
    const t = this.stateT, plantDone = this.state === 'fallback';
    const u = plantDone ? Math.min(1, t / 0.8) : 0;
    const phi = this.phi0 + 25 * Math.sin(Math.min(1, u * 1.6) * Math.PI / 2) * (1 - u * 0.6);
    const hx = this.sx(BOX) - Math.cos(phi * DEG) * POLE * PX, hy = GROUND - Math.sin(phi * DEG) * POLE * PX;
    this.drawPole(ctx, this.sx(BOX), GROUND, hx, hy, 0);
    const ax = this.sx(this.x - 0.6 * u);
    fill(ctx, 'grass.0', ax - 6, GROUND, 13, 2);
    this.anim.draw(ctx, ax, GROUND + 1);
  }

  drawFlight(ctx) {
    const f = this.fly;
    // the pole falls away behind
    const pu = Math.min(1, f.t / 0.9);
    const phi = 88 + 60 * pu * pu;
    this.drawPole(ctx, this.sx(BOX), GROUND, this.sx(BOX) - Math.cos(phi * DEG) * POLE * PX, GROUND - Math.sin(phi * DEG) * POLE * PX, 0);
    if (f.x == null) return;
    this.drawRot(ctx, this.sx(f.x), this.sy(f.y), f.ang, 'hip');
  }

  drawBar(ctx) {
    const x = this.sx(BAR_X), bar = this.state === 'setup' ? this.comp.bar : this.lastBar ?? this.comp.bar;
    const by = this.sy(this.state === 'result' || this.state === 'fly' ? (this.lastBar ?? this.comp.bar) : bar);
    // uprights
    for (const dx of [-3, 3]) {
      fill(ctx, 'grey.5', x + dx, this.sy(6.6), 1, GROUND - this.sy(6.6));
      for (let m = 1; m <= 6; m++) fill(ctx, 'grey.3', x + dx - 1, this.sy(m), 3, 1);
    }
    if (this.barDrop) {
      const t = this.barDrop.t, yy = Math.min(this.sy(0.9), by + 0.5 * 600 * t * t);
      pixLine(ctx, x - 9, yy + Math.min(6, t * 20), x + 9, yy, 'lamp.2');
      return;
    }
    fill(ctx, 'grey.6', x - 9, by, 19, 1);
    for (let k = -9; k < 10; k += 6) fill(ctx, 'lamp.1', x + k, by, 3, 1);
  }

  drawField(ctx) {
    const x0 = this.sx(-2), x1 = this.sx(BOX);
    fill(ctx, 'track.1', x0, GROUND - 5, x1 - x0, 8);
    fill(ctx, 'grey.6', x0, GROUND - 6, x1 - x0, 1);
    fill(ctx, 'track.0', x0, GROUND + 3, x1 - x0, 2);
    // distance marks every 5m, counted back from the box
    for (let m = 5; m <= BOX; m += 5) {
      const x = this.sx(BOX - m);
      fill(ctx, 'grey.5', x, GROUND - 5, 1, 2);
      if (m % 10 === 0) text(ctx, `${m}`, x, GROUND + 6, 'grey.6', { align: 'center', shadow: 'grass.0' });
    }
    // take-off checkmark
    const tx = this.sx(BOX - VAULT.takeoff);
    fill(ctx, 'grey.6', tx - 1, GROUND - 5, 3, 8);
    // box
    const bx = this.sx(BOX);
    fill(ctx, 'grey.2', bx - 6, GROUND - 1, 7, 3);
    fill(ctx, 'grey.0', bx, GROUND - 3, 1, 5);
    // landing mat
    const mx = this.sx(BOX + 0.4), mw = 5.2 * PX;
    fill(ctx, 'blue.0', mx, GROUND - 9, mw, 10);
    fill(ctx, 'blue.2', mx, GROUND - 10, mw, 2);
    fill(ctx, 'blue.3', mx + 2, GROUND - 10, mw - 4, 1);
    for (let k = 10; k < mw; k += 20) fill(ctx, 'blue.1', mx + k, GROUND - 8, 1, 8);
  }

  drawSetup(ctx) {
    const x = W / 2 - 80, y = 56;
    panel(ctx, x, y, 160, 62, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
    text(ctx, this.comp.jumps.length ? `JUMP ${this.comp.jumps.length + 1}` : 'SET UP', W / 2, y + 4, 'yellow.2', { align: 'center' });
    text(ctx, 'BAR', x + 8, y + 18, 'grey.4', { shadow: null });
    text(ctx, `UP ${fmtDist(this.comp.bar)} DOWN`, x + 152, y + 18, 'grey.6', { align: 'right' });
    text(ctx, 'POLE', x + 8, y + 30, 'grey.4', { shadow: null });
    const p = VAULT.poles[this.pole];
    text(ctx, `< ${p.name} >`, x + 152, y + 30, 'cyan.2', { align: 'right' });
    text(ctx, `RUN IN AT ${p.band[0].toFixed(1)}-${p.band[1].toFixed(1)} M/S`, W / 2, y + 41, 'grey.5', { align: 'center', shadow: null });
    text(ctx, 'HOLD SPACE TO RUN', W / 2, y + 52, 'green.2', { align: 'center' });
  }

  drawGauges(ctx) {
    const by = 14;
    panel(ctx, 4, by, 150, 30, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'SPEED', 8, by + 3, 'grey.4', { shadow: null });
    const mx = 42, mw = 106, v = this.state === 'pole' ? this.speed : this.v;
    meter(ctx, mx, by + 3, mw, 6, v / VAULT.vmax, { fg: 'cyan.1' });
    const [lo, hi] = VAULT.poles[this.pole].band;
    fill(ctx, 'green.2', mx + Math.round((lo / VAULT.vmax) * mw), by + 10, Math.round(((hi - lo) / VAULT.vmax) * mw), 2);
    text(ctx, `${v.toFixed(1)}`, 8, by + 12, lo <= v && v <= hi ? 'green.2' : 'grey.6', { shadow: null });
    text(ctx, `BOX ${Math.max(0, BOX - this.x).toFixed(1)}M`, 148, by + 20, BOX - this.x < VAULT.takeoff + 1.5 ? 'orange.3' : 'grey.6', { align: 'right', shadow: null });
    text(ctx, VAULT.poles[this.pole].name, 8, by + 20, 'grey.5', { shadow: null });

    if (this.state !== 'pole' || this.preFail) return;
    // timing strip: rock back at full bend, push as the pole straightens
    const x = 8, y = 62, w = 142, span = 2.0;
    const px = (t) => x + Math.min(1, t / span) * w;
    panel(ctx, x - 4, y - 12, w + 8, 20, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    fill(ctx, 'grey.2', x, y, w, 4);
    fill(ctx, 'green.1', px(VAULT.bendT - 0.1), y, px(VAULT.bendT + 0.1) - px(VAULT.bendT - 0.1), 4);
    text(ctx, 'ROCK', px(VAULT.bendT), y - 9, this.rockErr == null ? 'green.2' : 'grey.4', { align: 'center', shadow: null });
    if (this.rockErr != null) {
      const tt = this.tTop;
      fill(ctx, 'yellow.1', px(tt - 0.1), y, px(tt + 0.1) - px(tt - 0.1), 4);
      text(ctx, 'PUSH', px(tt), y - 9, 'yellow.2', { align: 'center', shadow: null });
    }
    const c = Math.round(px(this.stateT));
    fill(ctx, 'grey.6', c, y - 2, 1, 8);
  }

  drawCard(ctx) {
    const w = 88, x = W - w - 4, y = 14, n = this.comp.jumps.length;
    panel(ctx, x, y, w, 12 + VAULT.jumps * 8, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (let i = 0; i < VAULT.jumps; i++) {
      const j = this.comp.jumps[i];
      const s = j ? `${j.bar.toFixed(2)} ${j.cleared ? 'O' : 'X'}` : i === n ? `${this.comp.bar.toFixed(2)} ...` : '--';
      text(ctx, `${i + 1} ${s}`, x + 4, y + 3 + i * 8, j && !j.cleared ? 'lamp.2' : j ? 'green.2' : 'grey.5', { shadow: null });
    }
    text(ctx, `BEST ${this.comp.best == null ? '--' : this.comp.best.toFixed(2)}`, x + w - 4, y + 3 + VAULT.jumps * 8, 'cyan.2', { align: 'right', shadow: null });
  }
}
