// GYMNASTIC VAULTING — run, hurdle, block, spin, stick. Pick a vault, sprint
// at the table holding RIGHT, press DOWN to hurdle onto the springboard's
// sweet spot and SPACE as your hands meet the table. You spin tucked (or
// piked) until UP opens you out: open so you come down upright, then hold
// the landing with LEFT/RIGHT. Two vaults; the average of the scores counts.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, dither, panel, text, meter, circle, pixLine, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { GV, runStep, boardContact, blockQuality, afterBlock, rotationAt, landingError, Stick, judge, fmtGym } from '../sim/gymvault.js';
import { assets, playerSheet } from '../assets.js';
import { topBar, banner } from '../hud.js';
import { drawBoardRow } from '../boards.js';
import { hash } from '../winter.js';

const PX = 20;                       // pixels per metre
const FLOOR = 196;
const BOARD = GV.runway;             // sweet spot of the springboard
const TABLE = BOARD + GV.tableAt;    // near edge of the table
const TABLE_W = 1.0, TABLE_H = 1.35;
const HANDS = TABLE + TABLE_W / 2;   // where the hands land
const LAND = TABLE + TABLE_W + 2.4;  // where the feet come down
const DEG = Math.PI / 180;
const toPx = (m) => 30 + m * PX;
const smooth = (u) => u * u * (3 - 2 * u);

export class VaultingScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.choice = 0;
    this.scores = [];
    this.t = 0;
    this.camX = 0;
    this.excite = 0.2;
    this.anim = new Anim(playerSheet(o.player), 'idle');
    this.newVault();
  }

  get vault() { return GV.vaults[this.choice]; }
  get average() { return this.scores.length ? Math.round((this.scores.reduce((a, b) => a + b, 0) / GV.vaultsEach) * 1000) / 1000 : null; }

  newVault() {
    this.state = 'setup';
    this.stateT = 0;
    this.x = 0; this.v = 0; this.y = 0;
    this.rot = 0;
    this.board = null; this.blockErr = undefined; this.block = null;
    this.fl = null; this.tOpen = null; this.stick = null; this.score = null;
    this.anim.play('idle');
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    switch (this.state) {
      case 'setup':
        if (input.wasPressed('left')) { this.choice = Math.max(0, this.choice - 1); sfx.blip(); }
        if (input.wasPressed('right')) { this.choice = Math.min(GV.vaults.length - 1, this.choice + 1); sfx.blip(); }
        if (this.stateT > 0.3 && input.confirm()) { this.state = 'run'; this.stateT = 0; sfx.ready(); }
        break;
      case 'run':
        this.v = runStep(this.v, input.isDown('right'), dt);
        this.x += this.v * dt;
        if (this.v > 0.3) { this.anim.play('run'); this.anim.speed = 0.4 + this.v / GV.vmax; } else this.anim.play('idle');
        if (input.wasPressed('down') && this.v > 1) this.hurdle();
        else if (this.x > BOARD + 0.2) { this.x = BOARD + 0.2; this.balk('RAN PAST THE BOARD'); }
        break;
      case 'hurdle': {
        const u = Math.min(1, this.stateT / GV.hurdle);
        this.x = this.x0 + this.v * GV.hurdle * u;
        this.y = Math.sin(u * Math.PI) * 0.45;
        if (u >= 1) {
          this.board = boardContact(this.x0, this.v);
          if (this.board.balk) return this.balk(this.board.balk);
          sfx.thud();
          this.state = 'pre'; this.stateT = 0;
          this.boardX = this.x;
          this.anim.play('vt_block');
        }
        break;
      }
      case 'pre': {
        // board to table: rotate forward onto the hands
        const tc = GV.preflight, t = this.stateT;
        if (this.blockErr === undefined && input.wasPressed('a')) this.blockErr = t - tc;
        const u = Math.min(1, t / tc);
        this.rot = 180 * smooth(u);
        this.hipX = this.boardX + (HANDS - this.boardX) * u;
        this.hipY = 1.0 + (GV.comBlock - 1.0) * Math.sin(u * Math.PI / 2);
        if (t >= tc + 0.2 || (this.blockErr !== undefined && t >= tc)) this.blockOff();
        break;
      }
      case 'post': this.updatePost(dt, input); break;
      case 'stick': {
        const u = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
        const ev = this.stick.update(dt, u);
        if (ev?.type === 'step') { this.landX += 0.25 * ev.dir; sfx.step(false); }
        if (ev?.type === 'fall') sfx.bad();
        if (this.stick.done) this.scoreVault();
        break;
      }
      case 'result':
        if (this.stateT > 1.2) this.anim.play(this.score && !this.res?.fell && this.score >= this.vault.d + 8.5 ? 'celebrate' : this.res?.fell || !this.score ? 'dejected' : 'idle');
        if (this.stateT > 4 || (this.stateT > 1 && input.confirm())) {
          if (this.scores.length >= GV.vaultsEach) return this.o.onDone(this.average);
          this.newVault();
        }
        break;
    }
    const focus = this.state === 'run' || this.state === 'setup' ? toPx(this.x) - 150 : toPx(TABLE) - W / 2 + 20;
    this.camX += (Math.max(0, focus) - this.camX) * Math.min(1, dt * 5);
    this.excite = this.state === 'post' ? 0.5 : this.state === 'result' ? (this.score >= 13 ? 0.9 : 0.3) : 0.2;
    this.anim.update(dt * 1000);
  }

  hurdle() {
    this.state = 'hurdle'; this.stateT = 0;
    this.x0 = this.x;
    this.anim.play('vt_hurdle'); this.anim.speed = 1;
    sfx.step(true);
  }

  blockOff() {
    if (this.blockErr === undefined) this.blockErr = null;
    this.block = blockQuality(this.blockErr);
    this.fl = afterBlock({ speed: this.v, board: this.board.q, block: this.block }, this.vault);
    this.state = 'post'; this.stateT = 0;
    this.tOpen = null;
    this.vy = Math.sqrt(2 * GV.g * this.fl.rise);
    this.anim.play(this.vault.name.includes('PIKE') ? 'vt_pike' : 'vt_tuck');
    if (this.blockErr != null && Math.abs(this.blockErr) < 0.08) sfx.clang(); else sfx.step(false);
    sfx.whoosh();
  }

  updatePost(dt, input) {
    const fl = this.fl, t = Math.min(this.stateT, fl.T);
    if (this.tOpen == null && input.wasPressed('up')) { this.tOpen = t; this.anim.play('vt_block'); sfx.blip(); }
    this.rot = rotationAt(t, fl, this.tOpen);
    this.hipX = HANDS + (LAND - HANDS) * (t / fl.T);
    this.hipY = GV.comBlock + this.vy * t - 0.5 * GV.g * t * t;
    if (this.stateT >= fl.T) {
      this.landErr = landingError(fl, this.vault, this.tOpen ?? fl.T);
      this.stick = new Stick(this.landErr);
      this.landX = LAND;
      sfx.thud();
      this.anim.play(this.stick.fell ? 'stumble' : 'vt_land');
      this.state = 'stick'; this.stateT = 0;
    }
  }

  balk(why) {
    this.anim.play('stumble');
    this.res = { balk: why };
    this.finish(0);
  }

  scoreVault() {
    const st = this.stick;
    this.res = judge({ vault: this.vault, board: this.board.q, block: this.block, rise: this.fl.rise, landErr: this.landErr, steps: st.steps, fell: st.fell });
    this.res.fell = st.fell;
    this.res.steps = st.steps;
    this.finish(this.res.total);
  }

  finish(score) {
    this.score = score;
    this.scores.push(score);
    this.state = 'result'; this.stateT = 0;
    const last = this.scores.length >= GV.vaultsEach;
    this.newRecord = last && (this.o.record == null || this.average > this.o.record);
    if (this.newRecord) sfx.fanfare();
    else if (score >= 13) { sfx.jingle(); sfx.crowd(0.7, 1.6); }
    else if (!score || this.res?.fell) sfx.bad();
    else sfx.crowd(0.4, 1);
  }

  // ---- drawing --------------------------------------------------------------

  sx(m) { return toPx(m) - this.camX; }
  sy(m) { return FLOOR - m * PX; }

  draw(ctx) {
    this.drawArena(ctx);
    this.drawApparatus(ctx);
    this.drawAthlete(ctx);

    topBar(ctx, 'VAULTING', this.o.player.name, `VAULT ${Math.min(GV.vaultsEach, this.scores.length + (this.state === 'result' ? 0 : 1))}/${GV.vaultsEach}`);
    this.drawCard(ctx);
    if (this.state === 'setup') this.drawSetup(ctx);
    if (this.state === 'run' || this.state === 'hurdle') this.drawRunHud(ctx);
    if (this.state === 'pre' || this.state === 'post' || this.state === 'stick') this.drawDial(ctx);
    if (this.state === 'run' && this.scores.length === 0 && this.stateT < 3) text(ctx, 'PRESS DOWN TO HURDLE ONTO THE BOARD', W / 2, 124, 'grey.6', { align: 'center' });
    if (this.state === 'stick') text(ctx, 'HOLD IT! LEFT/RIGHT', W / 2, 124, 'yellow.2', { align: 'center' });
    if (this.state === 'result') {
      const r = this.res;
      if (r.balk) banner(ctx, 'BALK', 40, 'lamp.2', r.balk);
      else banner(ctx, fmtGym(r.total), 40, r.fell ? 'lamp.2' : 'yellow.2', this.newRecord ? `AVERAGE ${fmtGym(this.average)}  NEW RECORD!` : this.summary(r));
    }
  }

  summary(r) {
    const land = r.fell ? 'FALL' : r.steps ? `${r.steps} STEP${r.steps > 1 ? 'S' : ''}` : Math.abs(this.landErr) < 15 ? 'STUCK IT!' : 'LANDED';
    const rot = this.landErr < -15 ? 'UNDER-ROTATED' : this.landErr > 15 ? 'OVER-ROTATED' : null;
    return [`D ${r.d.toFixed(1)}`, `E ${r.e.toFixed(3)}`, rot || land].join('  ');
  }

  drawArena(ctx) {
    // indoor arena: dark stands with fans, a lit board row, blue podium floor
    fill(ctx, 'blue.0', 0, 0, W, 112);
    for (let i = 0; i < 6; i++) { const x = ((i * 71 - this.camX * 0.1) % (W + 40) + W + 40) % (W + 40) - 20; circle(ctx, x, 16, 3, 'grey.5'); circle(ctx, x, 16, 1, 'grey.6'); }
    dither(ctx, 'grey.2', 'grey.1', 0, 30, W, 70);
    const sx = this.camX * 0.5;
    for (let r = 0; r < 6; r++) {
      const y = 36 + r * 10;
      fill(ctx, 'grey.3', 0, y + 8, W, 1);
      const c0 = Math.floor(sx / 9) - 1;
      for (let c = c0; c < c0 + W / 9 + 3; c++) {
        const h = hash(c * 19 + r * 7);
        if (h < 0.12) continue;
        const tag = assets.props.tags[`fan_${Math.floor(h * 8)}`];
        const cheer = hash(c + r * 61) < this.excite;
        assets.props.draw(ctx, tag.from + (cheer && Math.floor(this.t * 4 + h * 4) % 2 ? 1 : 0), Math.round(c * 9 + (r % 2) * 4 - sx), y);
      }
    }
    fill(ctx, 'grey.0', 0, 99, W, 1);
    drawBoardRow(ctx, this.camX, 100, { season: 'summer', salt: 'vaulting' });
    fill(ctx, 'grey.1', 0, 116, W, FLOOR - 116);
    dither(ctx, 'blue.1', 'grey.1', 0, 116, W, 30);
    fill(ctx, 'blue.1', 0, 146, W, FLOOR - 146);
    fill(ctx, 'blue.2', 0, FLOOR - 4, W, 4);
    fill(ctx, 'blue.0', 0, FLOOR, W, H - FLOOR);
    fill(ctx, 'blue.3', 0, FLOOR - 4, W, 1);
  }

  drawApparatus(ctx) {
    // runway carpet with metre marks
    const r0 = this.sx(-1), r1 = this.sx(BOARD - 0.6);
    fill(ctx, 'grey.4', r0, FLOOR - 4, r1 - r0, 3);
    for (let m = 5; m < BOARD; m += 5) {
      const x = this.sx(BOARD - m);
      fill(ctx, 'grey.6', x, FLOOR - 4, 1, 3);
      text(ctx, `${m}`, x, FLOOR + 3, 'grey.5', { align: 'center', shadow: null });
    }
    // springboard: a wedge rising towards the table, red sweet spot
    const bx0 = this.sx(BOARD - 0.6), bx1 = this.sx(BOARD + 0.4);
    for (let x = bx0; x <= bx1; x++) {
      const h = Math.round(2 + ((x - bx0) / (bx1 - bx0)) * 5);
      fill(ctx, 'grey.6', x, FLOOR - 4 - h, 1, h);
    }
    fill(ctx, 'grey.2', bx0, FLOOR - 4, bx1 - bx0 + 1, 1);
    fill(ctx, 'lamp.1', this.sx(BOARD) - 2, FLOOR - 4 - Math.round(2 + (0.6 / 1.0) * 5) - 1, 5, 1);
    // vaulting table: padded top on a stem
    const tx = this.sx(TABLE), tw = TABLE_W * PX, ty = this.sy(TABLE_H);
    fill(ctx, 'grey.1', tx + tw / 2 - 3, ty + 6, 6, FLOOR - 4 - ty - 6);
    fill(ctx, 'grey.0', tx + tw / 2 - 9, FLOOR - 6, 18, 3);
    fill(ctx, 'grey.0', tx - 1, ty - 1, tw + 2, 8);
    fill(ctx, 'grey.5', tx, ty, tw, 6);
    fill(ctx, 'grey.6', tx + 1, ty, tw - 2, 1);
    fill(ctx, 'blue.2', tx, ty + 4, tw, 2);
    // landing mats with a white landing zone line
    const mx = this.sx(TABLE + TABLE_W + 0.3), mw = 5.5 * PX;
    fill(ctx, 'grey.0', mx - 1, FLOOR - 10, mw + 2, 7);
    fill(ctx, 'blue.2', mx, FLOOR - 9, mw, 6);
    fill(ctx, 'blue.3', mx, FLOOR - 9, mw, 1);
    fill(ctx, 'grey.6', this.sx(LAND) - 6, FLOOR - 9, 1, 2);
    fill(ctx, 'grey.6', this.sx(LAND) + 6, FLOOR - 9, 1, 2);
    // judges' table
    const jx = this.sx(LAND + 4);
    fill(ctx, 'grey.0', jx, FLOOR - 22, 40, 18);
    fill(ctx, 'grey.2', jx + 1, FLOOR - 21, 38, 1);
    for (let i = 0; i < 3; i++) circle(ctx, jx + 8 + i * 12, FLOOR - 26, 3, 'grey.3');
  }

  drawRot(ctx, x, y, ang, key) {
    const a = this.anim.anchor(key) || { x: 0, y: -21 };
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ang * DEG);
    this.anim.draw(ctx, -a.x, -a.y);
    ctx.restore();
  }

  drawAthlete(ctx) {
    const st = this.state;
    if (st === 'pre' || st === 'post') return this.drawRot(ctx, this.sx(this.hipX), this.sy(this.hipY), this.rot, 'hip');
    const onMat = st === 'stick' || (st === 'result' && this.stick);
    const x = onMat ? this.landX : this.x, base = onMat ? FLOOR - 9 : FLOOR - 4 - (st === 'hurdle' ? this.y * PX : 0);
    if (st === 'stick' && !this.stick.fell) {
      // lean the landing pose about the feet
      ctx.save();
      ctx.translate(Math.round(this.sx(x)), base + 1);
      ctx.rotate(this.stick.lean * 22 * DEG);
      this.anim.draw(ctx, 0, 0);
      ctx.restore();
      return;
    }
    fill(ctx, 'grey.0', this.sx(x) - 5, base, 11, 1);
    this.anim.draw(ctx, this.sx(x), base + 1);
  }

  drawSetup(ctx) {
    const x = W / 2 - 110, y = 120;
    panel(ctx, x, y, 220, 62, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
    text(ctx, this.scores.length ? `VAULT ${this.scores.length + 1}` : 'CHOOSE YOUR VAULT', W / 2, y + 4, 'yellow.2', { align: 'center' });
    const v = this.vault;
    text(ctx, `< ${v.name} >`, W / 2, y + 18, 'cyan.2', { align: 'center' });
    text(ctx, `DIFFICULTY ${v.d.toFixed(1)}`, W / 2, y + 29, 'grey.6', { align: 'center', shadow: null });
    text(ctx, v.need > 720 ? 'NEEDS A FAST RUN AND A BIG BLOCK' : v.spin < 1 ? 'PIKED: SPINS SLOWER, OPEN LATER' : 'ONE SALTO, TUCKED', W / 2, y + 39, 'grey.5', { align: 'center', shadow: null });
    text(ctx, 'HOLD RIGHT TO RUN. SPACE TO START', W / 2, y + 51, 'green.2', { align: 'center' });
  }

  drawRunHud(ctx) {
    const by = 14;
    panel(ctx, 4, by, 150, 30, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'SPEED', 8, by + 3, 'grey.4', { shadow: null });
    meter(ctx, 42, by + 3, 106, 6, this.v / GV.vmax, { fg: this.v > 7.5 ? 'yellow.1' : 'cyan.1' });
    text(ctx, `BOARD ${Math.max(0, BOARD - this.x).toFixed(1)}M`, 148, by + 21, BOARD - this.x < 4 ? 'orange.3' : 'grey.6', { align: 'right', shadow: null });
    text(ctx, this.vault.name, 8, by + 12, 'grey.5', { shadow: null });
  }

  /**
   * Rotation dial: the line is the body (head end bright), the green wedge
   * is upright. Open before the line reaches it: the spin carries on a little.
   */
  drawDial(ctx) {
    const cx = 34, cy = 52, r = 16;
    panel(ctx, 4, 14, 150, 64, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    circle(ctx, cx, cy, r + 1, 'grey.3');
    circle(ctx, cx, cy, r, 'grey.0');
    for (let a = -15; a <= 15; a += 3) fill(ctx, 'green.2', cx + Math.round(Math.sin(a * DEG) * (r - 2)), cy - Math.round(Math.cos(a * DEG) * (r - 2)), 2, 2);
    const a = this.rot * DEG;
    pixLine(ctx, cx - Math.sin(a) * (r - 4), cy + Math.cos(a) * (r - 4), cx + Math.sin(a) * (r - 3), cy - Math.cos(a) * (r - 3), 'grey.6');
    circle(ctx, cx + Math.sin(a) * (r - 4), cy - Math.cos(a) * (r - 4), 2, 'yellow.2');
    const turns = Math.max(0, Math.floor((this.rot + 15 - 360) / 360));
    const need = Math.round((this.vault.need - 360) / 360);
    text(ctx, 'SALTOS', 58, 22, 'grey.4', { shadow: null });
    text(ctx, `${Math.min(turns, need)}/${need}`, 148, 22, 'grey.6', { align: 'right', shadow: null });
    const tag = this.state === 'pre' ? 'SPACE ON THE TABLE' : this.state === 'post' ? (this.tOpen == null ? 'UP TO OPEN OUT' : 'OPEN') : 'LANDING';
    text(ctx, tag, 58, 34, this.state === 'post' && this.tOpen == null ? 'yellow.2' : 'grey.5', { shadow: null });
    if (this.block != null) {
      text(ctx, 'BOARD', 58, 48, 'grey.4', { shadow: null });
      meter(ctx, 92, 48, 56, 4, this.board.q, { fg: 'green.2' });
      text(ctx, 'BLOCK', 58, 58, 'grey.4', { shadow: null });
      meter(ctx, 92, 58, 56, 4, this.block, { fg: 'green.2' });
    }
  }

  drawCard(ctx) {
    const w = 84, x = W - w - 4, y = 14;
    panel(ctx, x, y, w, 12 + GV.vaultsEach * 8, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (let i = 0; i < GV.vaultsEach; i++) {
      const s = this.scores[i];
      text(ctx, `${i + 1} ${s == null ? '--' : fmtGym(s)}`, x + 4, y + 3 + i * 8, s == null ? 'grey.5' : s ? 'green.2' : 'lamp.2', { shadow: null });
    }
    text(ctx, `AVG ${this.scores.length >= GV.vaultsEach ? fmtGym(this.average) : '--'}`, x + w - 4, y + 3 + GV.vaultsEach * 8, 'cyan.2', { align: 'right', shadow: null });
  }
}
