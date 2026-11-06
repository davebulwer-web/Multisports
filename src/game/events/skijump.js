// SKI JUMP — timing, balance and landing. Push off, tuck down the inrun and
// press Space right on the lip to spring. In the air the flight position is
// unstable: keep your lean in the green with the arrows. Press Space again
// just before touchdown for a telemark. Two jumps; distance + style points.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, dither, panel, text, bands, pixLine, circle, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { SKI, INRUN, SkiJumper, groundY, slopeAt, xAtDistance, scoreJump } from '../sim/ski.js';
import { makeRng } from '../sim/rng.js';
import { assets, playerSheet } from '../assets.js';
import { topBar, banner, fmtPts } from '../hud.js';

const S = 4;            // pixels per metre
const SX = 150, SY = 92; // where the camera target sits on screen
const ROUNDS = SKI.rounds;
const MARKS = [80, 90, 100, 110, 130];
const LANDINGS = { telemark: 'TELEMARK', early: 'EARLY TELEMARK', late: 'LATE TELEMARK', feet: 'NO TELEMARK', fall: 'FALL' };

const hash = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export class SkiJumpScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.rng = makeRng();
    this.jumps = [];
    this.round = -1;
    this.anim = new Anim(playerSheet(o.player), 'ski_upright');
    this.flakes = Array.from({ length: 70 }, (_, i) => ({ x: hash(i) * W, y: hash(i + 500) * H, z: 0.4 + hash(i + 900) * 0.8 }));
    this.spray = [];
    this.t = 0;
    this.nextJump();
  }

  get total() { return Math.round(this.jumps.reduce((a, j) => a + j.points, 0) * 10) / 10; }

  nextJump() {
    this.round++;
    this.state = 'gate';
    this.stateT = 0;
    this.wind = Math.round((this.rng() * 2 - 1) * SKI.wind * 10) / 10;
    this.j = new SkiJumper(this.rng, this.wind);
    this.anim.play('ski_upright');
    this.camX = this.j.x; this.camY = this.j.y;
    this.note = null;
    this.score = null;
  }

  /** Map a press timestamp onto the jumper's clock. */
  simTime(input, act) {
    const ms = input.pressTime(act);
    const back = ms == null ? 0 : Math.min(0, Math.max(-50, ms - this.game.frameStart));
    return this.j.t + back / 1000;
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    const j = this.j;
    const lean = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const tuck = input.isDown('down');

    switch (this.state) {
      case 'gate':
        if (input.wasPressed('a') && this.stateT > 0.3) {
          j.start();
          sfx.select();
          this.state = 'inrun';
          this.stateT = 0;
        }
        break;
      case 'inrun':
        if (input.wasPressed('a')) j.jump(this.simTime(input, 'a'));
        j.update(dt, { tuck });
        this.anim.play(tuck ? 'ski_tuck' : 'ski_upright');
        if (j.phase === 'air') { this.state = 'air'; this.stateT = 0; sfx.whoosh(); }
        break;
      case 'air': {
        if (input.wasPressed('a')) {
          const t = this.simTime(input, 'a');
          if (!j.takeoff) j.jump(t);
          else j.telemark(t);
        }
        const hadTakeoff = !!j.takeoff;
        j.update(dt, { lean });
        if (!hadTakeoff && j.takeoff) this.takeoffNote();
        if (j.phase === 'landed') this.landed();
        else this.anim.play(this.flightTag());
        break;
      }
      case 'landed':
        j.slide(dt);
        if (this.stateT > 1.4) this.showScore();
        break;
      case 'score':
        j.slide(dt);
        if (this.stateT > 6 || (this.stateT > 0.8 && input.confirm())) {
          if (this.round + 1 >= ROUNDS) return this.o.onDone(this.total);
          this.nextJump();
        }
        break;
    }

    // camera leads a little in the direction of travel
    const vx = j.phase === 'air' || j.phase === 'landed' ? j.vx : Math.cos(INRUN.angleAt(j.s)) * j.v;
    const tx = j.x + vx * 0.35, ty = j.y;
    const k = Math.min(1, dt * 5);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;

    for (const p of this.spray) { p.t += dt; p.vy += 140 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.spray = this.spray.filter((p) => p.t < 0.8);
    for (const f of this.flakes) { f.y += (10 + f.z * 14) * dt; f.x += Math.sin(this.t * 0.8 + f.z * 9) * 6 * dt - this.wind * 4 * f.z * dt; }
    this.anim.update(dt * 1000);
  }

  flightTag() {
    const j = this.j;
    if (j.crashed) return 'ski_fall';
    if (j.t - j.lipT < 0.35) return 'ski_takeoff';
    if (j.telemarkT != null) return 'ski_feet';
    return j.lean < -9 ? 'ski_fly_back' : j.lean > 9 ? 'ski_fly_fwd' : 'ski_fly';
  }

  takeoffNote() {
    const { offset, quality } = this.j.takeoff;
    if (offset == null) { this.note = { msg: 'NO SPRING!', col: 'lamp.2' }; sfx.bad(); return; }
    const ms = Math.round(Math.abs(offset) * 1000);
    const word = quality > 0.9 ? 'PERFECT' : quality > 0.6 ? 'GOOD' : offset < 0 ? 'EARLY' : 'LATE';
    this.note = { msg: `${word} TAKE-OFF`, sub: quality > 0.9 ? '' : `${ms}MS ${offset < 0 ? 'EARLY' : 'LATE'}`, col: quality > 0.6 ? 'yellow.2' : 'lamp.2' };
    if (quality > 0.9) sfx.select();
  }

  landed() {
    const j = this.j;
    this.state = 'landed';
    this.stateT = 0;
    const fell = j.landing === 'fall';
    this.anim.play(fell ? 'ski_fall' : j.landing === 'telemark' || j.landing === 'early' || j.landing === 'late' ? 'ski_land' : 'ski_feet', { loop: false });
    fell ? sfx.thud() : sfx.step(true);
    sfx.crowd(fell ? 0.3 : 0.6, 1.4);
    for (let i = 0; i < 16; i++) {
      this.spray.push({ x: 0, y: 0, wx: j.x, wy: j.y, vx: (this.rng() * 2 - 0.5) * 50, vy: -20 - this.rng() * 50, t: this.rng() * 0.2 });
    }
  }

  showScore() {
    this.state = 'score';
    this.stateT = 0;
    this.score = scoreJump(this.j.result, this.rng);
    this.jumps.push(this.score);
    const last = this.round + 1 >= ROUNDS;
    if (last) {
      this.newRecord = this.o.record == null || this.total > this.o.record;
      if (this.newRecord) sfx.fanfare();
      else if (this.score.landing !== 'fall') sfx.jingle();
    } else if (this.score.landing === 'fall') sfx.fail();
  }

  // ---- drawing ------------------------------------------------------------

  sx(wx) { return SX + (wx - this.camX) * S; }
  sy(wy) { return SY - (wy - this.camY) * S; }
  wx(sx) { return this.camX + (sx - SX) / S; }

  draw(ctx) {
    this.drawSky(ctx);
    this.drawTrees(ctx);
    this.drawHill(ctx);
    this.drawInrun(ctx);
    this.drawMarkers(ctx);
    this.drawCrowd(ctx);
    this.drawJumper(ctx);
    for (const p of this.spray) fill(ctx, p.t < 0.4 ? 'grey.6' : 'grey.5', this.sx(p.wx) + p.x, this.sy(p.wy) + p.y - 2, 1, 1);
    for (const f of this.flakes) {
      const x = (((f.x - this.camX * S * 0.3 * f.z) % W) + W) % W;
      const y = (((f.y + this.camY * S * 0.3 * f.z) % H) + H) % H;
      fill(ctx, f.z > 0.9 ? 'grey.6' : 'grey.5', x, y, 1, 1);
    }

    topBar(ctx, 'SKI JUMP', this.o.player.name, `JUMP ${this.round + 1}/${ROUNDS}`);
    this.drawWind(ctx);
    this.drawCard(ctx);
    if (this.state === 'inrun' || this.state === 'air') this.drawSpeed(ctx);
    if (this.state === 'air' && this.j.takeoff && !this.j.crashed) this.drawBalance(ctx);
    if (this.note && this.state === 'air' && this.stateT < 1.6) {
      text(ctx, this.note.msg, W / 2, 40, this.note.col, { align: 'center' });
      if (this.note.sub) text(ctx, this.note.sub, W / 2, 49, 'grey.5', { align: 'center' });
    }

    if (this.state === 'gate') {
      const first = this.round === 0;
      banner(ctx, first ? 'READY' : 'JUMP 2', 112, 'yellow.2', first ? 'SPACE TO GO. HOLD DOWN TO TUCK' : `${fmtPts(this.total)} SO FAR. SPACE TO GO`);
    }
    if (this.state === 'inrun' && this.stateT < 2.5 && this.round === 0) {
      text(ctx, 'PRESS SPACE ON THE LIP TO JUMP', W / 2, 40, 'grey.6', { align: 'center' });
    }
    if (this.state === 'air' && this.j.takeoff && this.round === 0 && this.stateT > 1.6 && this.stateT < 3.4) {
      text(ctx, 'SPACE JUST BEFORE LANDING', W / 2, 40, 'grey.6', { align: 'center' });
    }
    if (this.state === 'landed') {
      const r = this.j.result;
      banner(ctx, `${r.distance.toFixed(1)}M`, 40, r.landing === 'fall' ? 'lamp.2' : 'yellow.2', LANDINGS[r.landing]);
    }
    if (this.state === 'score') this.drawScore(ctx);
  }

  drawSky(ctx) {
    bands(ctx, ['sky.0', 'sky.1', 'sky.2', 'sky.3', 'grey.5'], 0, 0, W, H);
    // far mountains, slow parallax
    const px = this.camX * S * 0.12, py = this.camY * S * 0.08;
    const peak = (u, w) => 1 - Math.abs(((u / w) % 1 + 1) % 1 - 0.5) * 2; // triangle wave 0..1
    for (let x = 0; x < W; x += 2) {
      const u = x + px;
      const h = 40 + peak(u, 120) * 46 + peak(u + 37, 47) * 16 + peak(u + 11, 19) * 5;
      const top = Math.round(150 - h + py);
      fill(ctx, 'blue.2', x, top, 2, H - top);
      if (peak(u + 60, 240) > 0.5) fill(ctx, 'blue.1', x, top + 6, 2, H - top - 6); // shaded faces
      const cap = Math.max(0, Math.round(h - 62));
      fill(ctx, 'grey.6', x, top, 2, Math.min(cap, 16));
      if (cap > 2) dither(ctx, 'grey.6', 'blue.3', x, top + Math.min(cap, 16), 2, 2);
    }
    // nearer ridge
    const qx = this.camX * S * 0.3, qy = this.camY * S * 0.2;
    for (let x = 0; x < W; x += 2) {
      const u = x + qx;
      const top = Math.round(176 - 30 - Math.sin(u / 37) * 12 - Math.sin(u / 11) * 3 + qy);
      fill(ctx, 'sky.3', x, top, 2, H - top);
      fill(ctx, 'grey.6', x, top, 2, 1);
    }
  }

  drawTrees(ctx) {
    // pines along the hillside behind the landing slope
    const x0 = Math.floor(this.wx(-40) / 7), x1 = Math.ceil(this.wx(W + 40) / 7);
    for (let i = x0; i <= x1; i++) {
      const wx = i * 7 + hash(i) * 4;
      const sx = this.sx(wx), base = this.sy(groundY(wx)) + 1;
      const h = 14 + Math.floor(hash(i + 77) * 12);
      this.pine(ctx, sx, base - 2 - Math.floor(hash(i + 31) * 6), h);
    }
  }

  pine(ctx, x, base, h) {
    x = Math.round(x);
    fill(ctx, 'brown.0', x, base - 3, 1, 3);
    for (let k = 0; k < h; k++) {
      const w = Math.max(0, Math.floor(((h - k) / h) * (h / 3)) + ((k % 4) === 0 ? 1 : 0));
      const y = base - 3 - k;
      fill(ctx, 'green.0', x - w, y, w * 2 + 1, 1);
      if (k % 4 === 0 && w > 1) fill(ctx, 'grey.6', x - w, y, 2, 1);
      if (k % 4 === 1 && w > 1) fill(ctx, 'grey.5', x + w - 1, y, 1, 1);
    }
    fill(ctx, 'grey.6', x, base - 3 - h, 1, 1);
  }

  drawHill(ctx) {
    for (let x = 0; x < W; x += 2) {
      const wx = this.wx(x + 1);
      const top = Math.round(this.sy(groundY(wx)));
      if (top >= H) continue;
      const y0 = Math.max(top, 0);
      fill(ctx, 'grey.6', x, y0, 2, H - y0);
      // softly shaded snow: blue shadow lower down
      dither(ctx, 'grey.6', 'grey.5', x, top + 6, 2, 10);
      fill(ctx, 'grey.5', x, top + 16, 2, Math.max(0, H - top - 16));
      dither(ctx, 'grey.5', 'sky.3', x, top + 30, 2, Math.max(0, H - top - 30));
      // groomed landing area between the knoll and the outrun
      if (wx > 0 && wx < 190 && ((Math.floor(wx * 2) % 6) === 0)) fill(ctx, 'sky.3', x, top + 3, 2, 1);
    }
  }

  drawInrun(ctx) {
    const pts = INRUN.pts;
    // supports down to the hillside
    for (let i = 0; i < pts.length; i += 24) {
      const p = pts[i];
      const x = Math.round(this.sx(p.x)), y = this.sy(p.y), g = this.sy(groundY(p.x));
      if (x < -4 || x > W + 4) continue;
      fill(ctx, 'grey.2', x - 1, y + 4, 2, g - y - 2);
      fill(ctx, 'grey.3', x - 1, y + 4, 1, g - y - 2);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i];
      const x = this.sx(p.x), y = this.sy(p.y);
      if (x < -4 || x > W + 4) continue;
      fill(ctx, 'grey.2', x, y + 1, 2, 4);   // deck
      fill(ctx, 'grey.6', x, y - 1, 2, 2);   // snow on the track
      fill(ctx, 'cyan.1', x, y, 2, 1);       // icy tracks
    }
    // start gate hut
    const g = pts[0];
    const gx = Math.round(this.sx(g.x)), gy = Math.round(this.sy(g.y));
    fill(ctx, 'red.1', gx - 16, gy - 18, 14, 18);
    fill(ctx, 'grey.6', gx - 18, gy - 20, 18, 3);
    fill(ctx, 'grey.1', gx - 12, gy - 13, 5, 5);
    // lip
    const lx = Math.round(this.sx(0)), ly = Math.round(this.sy(0));
    fill(ctx, 'grey.2', lx - 1, ly - 1, 2, 7);
  }

  drawMarkers(ctx) {
    const mark = (d, col, label) => {
      const x = Math.round(this.sx(xAtDistance(d))), y = Math.round(this.sy(groundY(xAtDistance(d))));
      if (x < -10 || x > W + 10) return;
      fill(ctx, col, x - 1, y - 1, 3, 3);
      fill(ctx, 'grey.2', x, y - 12, 1, 11);
      fill(ctx, col, x + 1, y - 12, 5, 4);
      text(ctx, label, x + 2, y - 22, col, { shadow: 'grey.0' });
    };
    for (const d of MARKS) mark(d, 'grey.3', `${d}`);
    mark(SKI.K, 'lamp.1', 'K');
    mark(SKI.HS, 'blue.2', 'HS');
  }

  drawCrowd(ctx) {
    const start = xAtDistance(SKI.HS) + 30;
    const fx = Math.round(this.sx(start)) - 4;
    if (fx > W) return;
    const excite = this.state === 'landed' || this.state === 'score' ? 0.7 : 0.15;
    for (let i = 0; i < 26; i++) {
      const wx = start + i * 2.25;
      const x = this.sx(wx), y = this.sy(groundY(wx)) - 4;
      if (x < -10 || x > W + 10) continue;
      const fan = i % 8, cheering = hash(i + 40) < excite;
      const tag = assets.props.tags[`fan_${fan}`];
      const frame = cheering && Math.floor(this.t * 4 + i) % 2 === 0 ? 1 : 0;
      assets.props.draw(ctx, tag.from + frame, x, y);
    }
    // fence in front of them
    const ex = this.sx(start + 26 * 2.25);
    for (let x = Math.max(0, fx); x < Math.min(W, ex); x++) {
      const y = this.sy(groundY(this.wx(x))) - 3;
      fill(ctx, x % 8 < 4 ? 'lamp.1' : 'grey.6', x, y, 1, 3);
    }
  }

  drawJumper(ctx) {
    const j = this.j;
    const fx = this.sx(j.x), fy = this.sy(j.y);
    // ski angle (radians, downhill positive)
    let a;
    if (j.phase === 'gate' || j.phase === 'inrun') a = INRUN.angleAt(j.s);
    else if (j.phase === 'air') a = Math.atan2(-j.vy, j.vx) - (j.crashed ? -0.6 : 0.16);
    else a = slopeAt(j.x);
    const fall = this.anim.tagName === 'ski_fall';
    const dx = Math.cos(a), dy = Math.sin(a);
    const ski = (ox, oy, col, tip) => {
      const bx = fx + ox - dx * 10, by = fy + oy - dy * 10;
      const ex = fx + ox + dx * 14, ey = fy + oy + dy * 14;
      pixLine(ctx, bx, by, ex, ey, col);
      fill(ctx, tip, ex, ey - 1, 1, 1); // upturned tip
    };
    if (!fall) ski(-1, -1, 'lamp.0', 'lamp.0');
    // sprite feet sit on the skis
    const foot = this.anim.anchor('footF') || { x: 0, y: 0 };
    this.anim.draw(ctx, fx - foot.x, fy - foot.y - 2 + (fall && this.j.phase === 'landed' ? 7 : 0));
    if (!fall) ski(0, 0, 'lamp.1', 'lamp.2');
    else { ski(-6, 2, 'lamp.1', 'lamp.2'); }
  }

  drawWind(ctx) {
    const w = this.wind, x = 4, y = 14;
    panel(ctx, x, y, 70, 20, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, w >= 0 ? 'HEADWIND' : 'TAILWIND', x + 4, y + 3, 'grey.4', { shadow: null });
    text(ctx, `${Math.abs(w).toFixed(1)}M/S`, x + 4, y + 11, w >= 0 ? 'green.2' : 'lamp.2');
    // arrow: headwind blows back at the jumper (to the left)
    const ax = x + 50, ay = y + 14, dir = w >= 0 ? -1 : 1, len = 3 + Math.round(Math.abs(w) * 4);
    for (let i = 0; i < len; i++) fill(ctx, 'grey.5', ax + dir * i, ay, 1, 1);
    fill(ctx, 'grey.5', ax + dir * (len - 2), ay - 1, 1, 3);
  }

  drawCard(ctx) {
    const w = 96, x = W - w - 4, y = 14;
    panel(ctx, x, y, w, 20, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    this.jumps.forEach((jp, i) => text(ctx, `${jp.distance.toFixed(1)}M`, x + 4 + i * 46, y + 3, jp.landing === 'fall' ? 'lamp.2' : 'grey.5', { shadow: null }));
    if (!this.jumps.length) text(ctx, `K${SKI.K} HS${SKI.HS}`, x + 4, y + 3, 'grey.4', { shadow: null });
    text(ctx, 'TOTAL', x + 4, y + 11, 'grey.4', { shadow: null });
    text(ctx, this.total.toFixed(1), x + w - 4, y + 11, 'cyan.2', { align: 'right' });
  }

  drawSpeed(ctx) {
    const j = this.j;
    const x = 4, y = 38;
    panel(ctx, x, y, 70, 20, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    if (j.phase === 'air') {
      text(ctx, 'DISTANCE', x + 4, y + 3, 'grey.4', { shadow: null });
      text(ctx, `${Math.max(0, j.distance).toFixed(1)}M`, x + 4, y + 11, 'yellow.2');
    } else {
      text(ctx, 'SPEED', x + 4, y + 3, 'grey.4', { shadow: null });
      text(ctx, `${j.speedKmh.toFixed(1)}KM/H`, x + 4, y + 11, 'yellow.2');
    }
  }

  /** Lean meter: keep the marker in the green. */
  drawBalance(ctx) {
    const j = this.j, w = 140, x = W / 2 - w / 2, y = H - 16;
    panel(ctx, x - 4, y - 10, w + 8, 20, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    const range = SKI.lean.crash;
    const px = (deg) => x + w / 2 + (deg / range) * (w / 2);
    fill(ctx, 'lamp.0', x, y, w, 5);
    fill(ctx, 'yellow.0', px(-14), y, px(14) - px(-14), 5);
    fill(ctx, 'green.1', px(-6), y, px(6) - px(-6), 5);
    const m = Math.round(px(Math.max(-range, Math.min(range, j.lean))));
    fill(ctx, 'grey.6', m - 1, y - 2, 3, 9);
    fill(ctx, 'grey.0', m, y - 1, 1, 7);
    text(ctx, 'BACK', x, y - 8, 'grey.4', { shadow: null });
    text(ctx, 'LEAN', W / 2, y - 8, 'grey.5', { align: 'center', shadow: null });
    text(ctx, 'FWD', x + w, y - 8, 'grey.4', { align: 'right', shadow: null });
  }

  drawScore(ctx) {
    const s = this.score, w = 236, h = 74, x = W / 2 - w / 2, y = 36;
    panel(ctx, x, y, w, h, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
    text(ctx, `${s.distance.toFixed(1)}M`, x + 8, y + 6, s.landing === 'fall' ? 'lamp.2' : 'yellow.2', { scale: 2 });
    text(ctx, LANDINGS[s.landing], x + w - 8, y + 10, s.landing === 'telemark' ? 'green.2' : 'grey.5', { align: 'right' });
    text(ctx, 'DISTANCE', x + 8, y + 26, 'grey.4', { shadow: null });
    text(ctx, s.distPoints.toFixed(1), x + w - 8, y + 26, 'grey.6', { align: 'right' });
    text(ctx, 'JUDGES', x + 8, y + 36, 'grey.4', { shadow: null });
    s.style.marks.forEach((m, i) => {
      const dropped = s.style.dropped.includes(i);
      text(ctx, m.toFixed(1), x + 58 + i * 28, y + 36, dropped ? 'grey.3' : 'cyan.2', { shadow: dropped ? null : undefined });
    });
    text(ctx, s.style.total.toFixed(1), x + w - 8, y + 46, 'grey.6', { align: 'right' });
    text(ctx, 'STYLE (MIDDLE 3)', x + 8, y + 46, 'grey.4', { shadow: null });
    fill(ctx, 'grey.3', x + 6, y + 56, w - 12, 1);
    const last = this.round + 1 >= ROUNDS;
    text(ctx, `JUMP ${s.points.toFixed(1)}`, x + 8, y + 61, 'yellow.2');
    text(ctx, `TOTAL ${this.total.toFixed(1)}${last && this.newRecord ? '  RECORD!' : ''}`, x + w - 8, y + 61, last && this.newRecord ? 'green.2' : 'yellow.2', { align: 'right' });
  }
}
