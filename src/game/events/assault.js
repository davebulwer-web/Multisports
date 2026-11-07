// ASSAULT COURSE — a run of obstacles, each with its own timing. Hold SPACE
// to run. Jump the wall (UP) from the yellow take-off zone, climb the net
// (UP) as it swings in, walk the beam (hold SPACE) balancing with
// LEFT/RIGHT, leap for the rope (UP) as it swings back, and let go (SPACE)
// at the far end of the swing to clear the water.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, bands, panel, text, meter, pixLine, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { ASSAULT, Assault, fmtAssault } from '../sim/assault.js';
import { makeRng } from '../sim/rng.js';
import { assets, playerSheet, drawScenery } from '../assets.js';
import { topBar, banner } from '../hud.js';
import { hash } from '../winter.js';

const PX = 22;
const GROUND = 190;
const DEG = Math.PI / 180;
const C = ASSAULT;
const NET_TOP = { dx: 1.5, h: 3 };

const HINTS = {
  wall: 'UP TO JUMP FROM THE YELLOW ZONE',
  net: 'UP AS THE NET SWINGS IN TOWARDS YOU',
  beam: 'HOLD SPACE TO WALK, LEFT/RIGHT TO BALANCE',
  edge: 'UP TO LEAP AS THE ROPE SWINGS BACK',
  rope: 'SPACE TO LET GO AT THE FAR END',
};

export class AssaultScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.a = new Assault(makeRng());
    this.anim = new Anim(playerSheet(o.player), 'idle');
    this.state = 'ready';
    this.stateT = 0;
    this.t = 0;
    this.camX = 0;
    this.pops = [];
    this.excite = 0.2;
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    this.pops = this.pops.filter((p) => (p.t += dt) < 1.2);
    const a = this.a;
    if (this.state === 'ready') {
      if (this.stateT > 0.4 && input.wasPressed('a')) { this.state = 'go'; this.stateT = 0; sfx.gun(); }
    } else if (this.state === 'go') {
      const steer = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
      const u = { run: input.isDown('a'), up: input.wasPressed('up'), act: input.wasPressed('a'), steer };
      for (const e of a.update(dt, u)) this.onEvent(e);
    } else if (this.state === 'done') {
      if (this.stateT > 5 || (this.stateT > 1 && input.confirm())) this.o.onDone(a.t);
    }
    this.pickAnim(dt);
    const focus = this.sx0(a.x) - 150;
    this.camX += (Math.max(0, focus) - this.camX) * Math.min(1, dt * 5);
    this.anim.update(dt * 1000);
  }

  pickAnim() {
    const a = this.a;
    if (this.state === 'done') { this.anim.play('celebrate'); return; }
    switch (a.state) {
      case 'run':
        if (a.v > 0.3) { this.anim.play('run'); this.anim.speed = 0.3 + a.v / C.vmax; } else this.anim.play('idle');
        break;
      case 'stun': case 'beamfall': this.anim.play('stumble'); break;
      case 'wall': this.anim.play(a.stateT < 0.25 ? 'ac_jump' : 'ac_climb'); this.anim.speed = 1; break;
      case 'net': case 'netover': this.anim.play('ac_climb'); this.anim.speed = a.state === 'net' ? 0 : 1; break;
      case 'beam': this.anim.play('ac_beam'); this.anim.speed = this.lastRun ? 1 : 0; break;
      case 'edge': this.anim.play('idle'); break;
      case 'rope': this.anim.play('ac_hang'); break;
      case 'fly': this.anim.play('ac_jump'); break;
      case 'swim': case 'wade': this.anim.play('ac_swim'); this.anim.speed = 1; break;
    }
  }

  onEvent(e) {
    const a = this.a;
    const pop = (msg, col) => this.pops.push({ msg, col, t: 0, x: a.x });
    switch (e.type) {
      case 'jump': sfx.whoosh(); if (e.q > 0.7) pop('GREAT JUMP', 'green.2'); break;
      case 'over': sfx.step(true); break;
      case 'wallfail': sfx.thud(); pop(e.why === 'TOO SLOW' ? 'TOO SLOW!' : e.why === 'SHORT' ? 'TOO EARLY!' : e.why === 'CRASH' ? 'JUMP!' : 'TOO LATE!', 'lamp.2'); break;
      case 'climb': sfx.step(true); break;
      case 'slip': sfx.bad(); pop('SLIPPED', 'orange.3'); break;
      case 'top': sfx.blip(); break;
      case 'beamfall': sfx.thud(); pop('FELL OFF!', 'lamp.2'); break;
      case 'beamdone': sfx.blip(); break;
      case 'grab': sfx.whoosh(); break;
      case 'miss': sfx.bad(); pop('MISSED IT!', 'lamp.2'); break;
      case 'release': sfx.whoosh(); break;
      case 'land': sfx.thud(); pop('CLEAR!', 'green.2'); break;
      case 'splash': sfx.smash(); pop('SPLASH!', 'cyan.2'); this.splashT = this.t; this.splashX = a.x; break;
      case 'finish':
        this.state = 'done'; this.stateT = 0;
        this.newRecord = this.o.record == null || a.t < this.o.record;
        if (this.newRecord) sfx.fanfare(); else sfx.jingle();
        sfx.crowd(0.7, 1.6);
        this.excite = 0.9;
        break;
    }
  }

  // ---- drawing ------------------------------------------------------------

  sx0(m) { return 30 + m * PX; }
  sx(m) { return this.sx0(m) - this.camX; }
  sy(m) { return GROUND - m * PX; }

  draw(ctx) {
    this.drawBack(ctx);
    this.drawCourse(ctx);
    this.drawAthlete(ctx);
    this.drawFront(ctx);
    for (const p of this.pops) text(ctx, p.msg, this.sx(p.x), 70 - p.t * 12, p.col, { align: 'center' });

    const a = this.a;
    topBar(ctx, 'ASSAULT COURSE', this.o.player.name, fmtAssault(a.t));
    this.drawProgress(ctx);
    this.drawGauge(ctx);
    if (this.state === 'ready') banner(ctx, 'READY', 50, 'yellow.2', 'HOLD SPACE TO RUN');
    if (this.state === 'go') {
      const key = a.state === 'run' && !a.done.wall && C.wall.x - a.x < 7 ? 'wall' : a.state === 'beam' ? 'beam' : a.state === 'net' ? 'net' : a.state === 'edge' ? 'edge' : a.state === 'rope' ? 'rope' : null;
      if (key) text(ctx, HINTS[key], W / 2, 40, 'grey.6', { align: 'center' });
    }
    if (this.state === 'done') {
      const s = a.stats, slips = s.wallFails + s.slips + s.beamFalls + s.splashes;
      banner(ctx, fmtAssault(a.t), 50, 'yellow.2', this.newRecord ? 'NEW RECORD!' : slips ? `${slips} MISHAP${slips > 1 ? 'S' : ''}` : 'CLEAN RUN!');
    }
  }

  drawBack(ctx) {
    const cam = this.camX;
    bands(ctx, ['sky.1', 'sky.2', 'sky.3'], 0, 0, W, 120);
    for (let x = 0; x < W; x += 2) {
      const u = x + cam * 0.15;
      const top = Math.round(84 - Math.sin(u / 61) * 12 - Math.sin(u / 23) * 4);
      fill(ctx, 'green.0', x, top, 2, 140 - top);
      const v = x + cam * 0.35;
      const t2 = Math.round(112 - Math.sin(v / 47) * 6);
      fill(ctx, 'grass.0', x, t2, 2, 150 - t2);
    }
    for (let i = -1; i < 5; i++) {
      const x = Math.round(i * 170 - ((cam * 0.5) % 170)) + 60;
      drawScenery(ctx, 'tent', x, 133);
    }
    fill(ctx, 'grass.1', 0, 134, W, H - 134);
    for (let s = Math.floor(cam / 40) - 1; s < cam / 40 + W / 40 + 2; s++) {
      if (s % 2) continue;
      fill(ctx, 'grass.2', Math.round(s * 40 - cam), 134, 40, H - 134);
    }
    // crowd behind the tape
    const c0 = Math.floor(cam * 0.8 / 9) - 1;
    for (let c = c0; c < c0 + W / 9 + 3; c++) {
      const h = hash(c * 17);
      if (h < 0.2) continue;
      const tag = assets.props.tags[`fan_${Math.floor(h * 8)}`];
      const cheer = hash(c + 55) < this.excite;
      assets.props.draw(ctx, tag.from + (cheer && Math.floor(this.t * 4 + h * 4) % 2 ? 1 : 0), Math.round(c * 9 - cam * 0.8), 140);
    }
    for (let x = 0; x < W; x++) if (Math.floor(x + cam) % 6 < 3) fill(ctx, 'lamp.1', x, 150, 1, 1);
    // running track of packed earth
    fill(ctx, 'orange.1', 0, GROUND - 4, W, 8);
    fill(ctx, 'orange.0', 0, GROUND + 4, W, 1);
  }

  drawCourse(ctx) {
    const a = this.a;
    // start and finish
    fill(ctx, 'grey.6', this.sx(0), GROUND - 4, 2, 8);
    const fx = this.sx(C.finish);
    fill(ctx, 'grey.5', fx, GROUND - 40, 2, 40);
    fill(ctx, 'grey.5', fx + 2, GROUND - 40, 1, 1);
    for (let k = 0; k < 6; k++) fill(ctx, k % 2 ? 'grey.6' : 'grey.0', fx - 1, GROUND - 40 + k * 6, 4, 3);
    // wall take-off zone
    const z0 = this.sx(C.wall.x - C.wall.zone[1]), z1 = this.sx(C.wall.x - C.wall.zone[0]);
    fill(ctx, 'yellow.1', z0, GROUND - 4, z1 - z0, 8);
    fill(ctx, 'yellow.2', z0, GROUND - 4, z1 - z0, 1);
    // wall
    const wx = this.sx(C.wall.x), wh = 2 * PX;
    fill(ctx, 'orange.1', wx, GROUND - wh, 9, wh);
    for (let y = GROUND - wh + 5; y < GROUND; y += 6) fill(ctx, 'orange.0', wx, y, 9, 1);
    fill(ctx, 'orange.3', wx, GROUND - wh, 9, 1);
    fill(ctx, 'orange.2', wx, GROUND - wh, 1, wh);
    fill(ctx, 'orange.0', wx + 8, GROUND - wh, 1, wh);
    // net: A-frame, the climbing face sways
    const nx = this.sx(C.net.x), top = { x: this.sx(C.net.x + NET_TOP.dx), y: this.sy(NET_TOP.h) };
    const sway = a.netSway * 3;
    fill(ctx, 'orange.0', top.x - 1, top.y - 2, 2, GROUND - top.y + 2);
    pixLine(ctx, top.x, top.y, this.sx(C.net.x + 3), GROUND, 'orange.0');
    for (let k = 0; k <= 6; k++) {
      const f = k / 6;
      const bx = nx + f * (top.x - nx) + sway * (1 - f) * 0.2;
      pixLine(ctx, bx, GROUND - f * (GROUND - top.y), top.x + 8, GROUND - f * (GROUND - top.y), 'grey.4');
    }
    for (let k = 0; k <= 4; k++) pixLine(ctx, nx + sway + k * 2, GROUND, top.x - 4 + k * 3, top.y, 'grey.5');
    pixLine(ctx, nx + sway, GROUND, top.x, top.y, 'grey.6');
    // beam
    const b0 = this.sx(C.beam.x0), b1 = this.sx(C.beam.x1), by = this.sy(1);
    for (const x of [b0 + 4, (b0 + b1) / 2, b1 - 6]) fill(ctx, 'orange.0', x, by, 2, GROUND - by);
    fill(ctx, 'orange.2', b0, by - 2, b1 - b0, 3);
    fill(ctx, 'orange.3', b0, by - 2, b1 - b0, 1);
    // water jump: platform edge, pit, far bank, rope frame
    const r = C.rope;
    const e0 = this.sx(r.edge), e1 = this.sx(r.bank);
    fill(ctx, 'brown.1', e0, GROUND - 3, e1 - e0, H - GROUND + 3);
    fill(ctx, 'cyan.0', e0 + 1, GROUND - 1, e1 - e0 - 2, H - GROUND + 1);
    for (let x = e0 + 2; x < e1 - 2; x += 5) fill(ctx, 'cyan.1', x + Math.round(Math.sin(this.t * 3 + x) * 1.5), GROUND, 3, 1);
    if (this.splashT && this.t - this.splashT < 0.6) {
      const u = (this.t - this.splashT) / 0.6, sxp = this.sx(this.splashX);
      for (let k = -3; k <= 3; k++) fill(ctx, 'cyan.2', sxp + k * 3 * (0.5 + u), GROUND - 12 * Math.sin(Math.PI * u) * (1 - Math.abs(k) / 4), 2, 2);
    }
    const px = this.sx(r.px), py = this.sy(r.py);
    for (const dx of [-40, 40]) fill(ctx, 'orange.0', px + dx, py - 2, 3, GROUND - py + 2);
    fill(ctx, 'orange.1', px - 40, py - 3, 83, 3);
    const end = a.ropeEnd;
    pixLine(ctx, px, py, this.sx(end.x), this.sy(end.y), 'orange.3');
    pixLine(ctx, px + 1, py, this.sx(end.x) + 1, this.sy(end.y), 'orange.2');
    if (a.state !== 'rope') fill(ctx, 'orange.1', this.sx(end.x) - 1, this.sy(end.y), 3, 3); // knot
  }

  drawRot(ctx, x, y, ang, key) {
    const an = key ? this.anim.anchor(key) || { x: 0, y: -40 } : { x: 0, y: 0 };
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ang);
    this.anim.draw(ctx, -an.x, -an.y);
    ctx.restore();
  }

  drawAthlete(ctx) {
    const a = this.a;
    let x = a.x, y = a.y;
    switch (a.state) {
      case 'wall': {
        const u = Math.min(1, a.stateT / a.climbT);
        x = C.wall.x - 1.6 + 2.2 * u; y = 2.1 * Math.sin(Math.PI * Math.min(1, u * 1.15));
        break;
      }
      case 'net': { const f = a.rung / C.net.rungs; x = C.net.x - 0.3 + NET_TOP.dx * f; y = (NET_TOP.h - 0.4) * f; break; }
      case 'netover': { const u = Math.min(1, a.stateT / C.net.over); x = C.net.x + NET_TOP.dx + 1.5 * u; y = NET_TOP.h * (1 - u) - 0.4 * Math.sin(Math.PI * u); break; }
      case 'beam': this.lastRun = this.prevX != null && a.x > this.prevX; this.prevX = a.x;
        this.drawRot(ctx, this.sx(x), this.sy(1) - 2, a.theta, null);
        return;
      case 'beamfall': { const u = Math.min(1, a.stateT / 0.4); y = 1 - u; break; }
      case 'rope': this.drawRot(ctx, this.sx(a.x), this.sy(a.y), -a.ropeA, 'handF'); return;
      case 'swim': { const u = a.stateT / C.rope.swim; x = a.x - (a.x - C.rope.edge) * u; y = -0.6; break; }
      case 'wade': { const u = a.stateT / C.rope.wade; x = a.x + (C.rope.bank - a.x) * u; y = -0.6; break; }
    }
    if (y <= 0.05 && a.state !== 'swim' && a.state !== 'wade') fill(ctx, 'orange.0', this.sx(x) - 6, GROUND, 13, 2);
    this.anim.draw(ctx, this.sx(x), this.sy(y) + 1);
  }

  drawFront(ctx) {
    // water in front of a swimmer
    const a = this.a;
    if (a.state === 'swim' || a.state === 'wade') {
      const e0 = this.sx(C.rope.edge), e1 = this.sx(C.rope.bank);
      fill(ctx, 'cyan.0', e0 + 1, GROUND + 2, e1 - e0 - 2, H - GROUND);
      fill(ctx, 'cyan.1', e0 + 1, GROUND + 2, e1 - e0 - 2, 1);
    }
  }

  drawProgress(ctx) {
    const x = 60, w = W - 120, y = 15, a = this.a;
    panel(ctx, x - 4, y - 3, w + 8, 14, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    fill(ctx, 'grey.2', x, y + 3, w, 2);
    const px = (m) => x + (m / C.finish) * w;
    const marks = [['WALL', C.wall.x, a.done.wall], ['NET', C.net.x, a.done.net], ['BEAM', C.beam.x0, a.done.beam], ['ROPE', C.rope.edge, a.done.rope]];
    for (const [label, m, done] of marks) {
      fill(ctx, done ? 'green.2' : 'grey.4', px(m), y, 2, 8);
      text(ctx, label, px(m) + 3, y, done ? 'green.2' : 'grey.5', { shadow: null });
    }
    fill(ctx, 'yellow.2', Math.round(px(Math.min(C.finish, a.x))) - 1, y + 1, 3, 6);
  }

  drawGauge(ctx) {
    const a = this.a, x = W / 2 - 70, y = 202, w = 140;
    if (this.state !== 'go') return;
    if (a.state === 'net') {
      panel(ctx, x - 4, y - 11, w + 8, 18, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
      text(ctx, 'NET', x, y - 9, 'grey.4', { shadow: null });
      const win = 1 - C.net.window;
      fill(ctx, 'grey.2', x, y, w, 4);
      fill(ctx, 'green.1', x + w / 2 + (win * w) / 2, y, w - (w / 2 + (win * w) / 2), 4);
      const m = x + w / 2 + (a.netSway * w) / 2;
      fill(ctx, a.netSway > win ? 'yellow.2' : 'grey.6', Math.round(m) - 1, y - 2, 3, 8);
      text(ctx, `${a.rung}/${C.net.rungs}`, x + w, y - 9, 'grey.6', { align: 'right', shadow: null });
    } else if (a.state === 'beam') {
      panel(ctx, x - 4, y - 11, w + 8, 18, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
      text(ctx, 'BALANCE', x, y - 9, 'grey.4', { shadow: null });
      fill(ctx, 'lamp.0', x, y, w, 4);
      fill(ctx, 'green.1', x + w * 0.3, y, w * 0.4, 4);
      const m = x + w / 2 + (a.theta / C.beam.fall) * (w / 2);
      fill(ctx, 'grey.6', Math.round(m) - 1, y - 2, 3, 8);
      meter(ctx, x + 60, y - 8, 60, 3, (a.x - C.beam.x0) / (C.beam.x1 - C.beam.x0), { fg: 'cyan.1' });
    } else if (a.state === 'run' || a.state === 'stun') {
      panel(ctx, x - 4, y - 11, w + 8, 18, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
      text(ctx, 'SPEED', x, y - 9, 'grey.4', { shadow: null });
      meter(ctx, x, y, w, 4, a.v / C.vmax, { fg: a.v >= C.wall.speed ? 'green.2' : 'cyan.1' });
      if (!a.done.wall) fill(ctx, 'yellow.2', x + (C.wall.speed / C.vmax) * w, y - 2, 1, 8);
    }
  }
}
