// ARCHERY — fine control event. Draw, steady the swaying sight against your
// breathing, aim off for the wind, and loose. Six arrows, total score counts.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, panel, text, meter, pixLine, circle, W } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { ARCHERY, Aim, loose } from '../sim/archery.js';
import { makeRng } from '../sim/rng.js';
import { drawStadium, drawGrass } from '../stadium.js';
import { playerSheet } from '../assets.js';
import { topBar, banner, fmtPts, windSock } from '../hud.js';

const GROUND = 184;                // archer's feet
const ARCHER_X = 56;
const BOSS = { x: 344, y: 146 };   // the distant target, centre of the face
const SCOPE = { x: 152, y: 50, size: 116 };
const CX = SCOPE.x + SCOPE.size / 2, CY = SCOPE.y + SCOPE.size / 2;
const R = 46;                      // face radius in the scope, pixels
const LET_DOWN = 0.25;             // releasing before this much draw lowers the bow instead of shooting
const FLIGHT = 0.55;               // seconds the arrow is in the air

// Five colour zones from the outside in, two rings each.
const ZONES = ['grey.6', 'grey.1', 'blue.2', 'lamp.1', 'yellow.2'];
const LINES = ['grey.4', 'grey.3', 'blue.1', 'lamp.0', 'yellow.0'];

export class ArcheryScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.rng = makeRng();
    this.arrows = []; // {x, y, score, x10}
    this.anim = new Anim(playerSheet(o.player), 'arch_draw');
    this.newArrow();
  }

  get total() { return this.arrows.reduce((s, a) => s + a.score, 0); }

  newArrow() {
    this.state = 'ready';
    this.stateT = 0;
    this.wind = Math.round((this.rng() * 6 - 3) * 10) / 10;
    this.aim = new Aim(this.rng);
    this.shot = null;
    this.note = null;
    this.excite = 0.1;
    this.pose('arch_draw', 0);
  }

  /** Show a fixed frame of a tag (draw frames follow the string, not the clock). */
  pose(tag, frame = 0) {
    this.anim.play(tag);
    this.anim.index = Math.min(this.anim.t.to, this.anim.t.from + frame);
  }

  update(dt, input) {
    this.stateT += dt;
    switch (this.state) {
      case 'ready':
        if (input.wasPressed('a')) { this.state = 'aim'; this.stateT = 0; sfx.blip(); }
        break;
      case 'aim': {
        const sx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
        const sy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
        const drawing = input.isDown('a');
        const wasFull = this.aim.fullDraw;
        this.aim.update(dt, drawing, sx, sy);
        if (!wasFull && this.aim.fullDraw) sfx.ready();
        if (this.aim.fullDraw) this.pose('arch_hold');
        else this.pose('arch_draw', Math.min(2, Math.floor(this.aim.draw * 3)));
        if (!drawing) {
          if (this.aim.draw < LET_DOWN) { // let down: no arrow lost
            this.aim = new Aim(this.rng);
            this.state = 'ready';
            this.pose('arch_draw', 0);
            break;
          }
          this.loose(this.aim.fullDraw ? null : 'UNDER-DRAWN');
        } else if (this.aim.timeUp) this.loose('TIME!');
        break;
      }
      case 'flight':
        if (this.stateT >= FLIGHT) {
          sfx.thud();
          this.arrows.push(this.shot);
          this.state = 'scored';
          this.stateT = 0;
          const s = this.shot.score;
          if (s >= 9) sfx.crowd(0.4 + (s - 9) * 0.4, 1.4);
          else if (s === 0) sfx.bad();
          this.excite = s >= 9 ? 0.4 + (s - 9) * 0.4 : 0.1;
          if (this.arrows.length === ARCHERY.arrows) {
            this.newRecord = this.o.record == null || this.total > this.o.record;
            if (this.newRecord) sfx.fanfare();
          }
        }
        break;
      case 'scored':
        if (this.stateT > 1 && this.arrows.length === ARCHERY.arrows) this.anim.play(this.total >= 48 ? 'celebrate' : 'dejected');
        if (this.stateT > 2.4 || (this.stateT > 0.6 && input.confirm())) {
          if (this.arrows.length >= ARCHERY.arrows) return this.o.onDone(this.total);
          this.newArrow();
        }
        break;
    }
    if (this.state === 'scored') this.anim.update(dt * 1000);
  }

  loose(note) {
    this.shot = loose(this.aim.pos, this.aim.draw, this.wind, this.rng);
    this.sightAtLoose = this.aim.pos;
    this.note = note;
    this.state = 'flight';
    this.stateT = 0;
    this.pose('arch_loose');
    sfx.whoosh();
  }

  draw(ctx) {
    drawStadium(ctx, 0, { excite: this.excite, t: this.game.time, salt: 'archery' });
    drawGrass(ctx, 0);
    this.drawRange(ctx);
    this.drawArcher(ctx);
    this.drawScope(ctx);

    const n = Math.min(ARCHERY.arrows, this.arrows.length + (this.state === 'scored' ? 0 : 1));
    topBar(ctx, 'ARCHERY', this.o.player.name, this.state === 'scored' && n === ARCHERY.arrows ? 'FINAL' : `ARROW ${n}/${ARCHERY.arrows}`);
    windSock(ctx, 4, 14, this.wind);
    this.drawCard(ctx);
    this.drawMeters(ctx);

    if (this.state === 'ready') banner(ctx, 'HOLD SPACE', 176, 'yellow.2', 'DRAW, STEADY WITH ARROWS, LET GO');
    if (this.state === 'scored') {
      const s = this.shot.score;
      const last = this.arrows.length === ARCHERY.arrows;
      const msg = s === 0 ? 'MISS' : s === 10 && this.shot.x10 ? 'X!' : `${s}`;
      const sub = last ? (this.newRecord ? `${fmtPts(this.total)}  NEW RECORD!` : `TOTAL ${fmtPts(this.total)}`) : this.note || `${fmtPts(this.total)} SO FAR`;
      banner(ctx, msg, 176, s >= 9 ? 'yellow.2' : s === 0 ? 'lamp.2' : 'grey.6', sub);
    }
  }

  drawRange(ctx) {
    // shooting lane from the line to the target
    fill(ctx, 'grass.3', 0, GROUND + 2, W, 1);
    fill(ctx, 'grey.6', ARCHER_X + 14, 150, 1, 66); // shooting line
    // straw boss on a stand, face on the front
    fill(ctx, 'brown.1', BOSS.x - 6, BOSS.y + 6, 2, 18);
    fill(ctx, 'brown.1', BOSS.x + 5, BOSS.y + 6, 2, 18);
    fill(ctx, 'orange.2', BOSS.x - 9, BOSS.y - 9, 19, 18);
    fill(ctx, 'orange.3', BOSS.x - 9, BOSS.y - 9, 19, 1);
    fill(ctx, 'orange.1', BOSS.x - 9, BOSS.y + 8, 19, 1);
    for (let i = 0; i < ZONES.length; i++) circle(ctx, BOSS.x, BOSS.y, 7 - i * 1.4, ZONES[i]);
    // flag above the target shows the wind too
    const w = this.wind;
    fill(ctx, 'grey.4', BOSS.x, BOSS.y - 30, 1, 21);
    const len = 2 + Math.round(Math.abs(w) * 2);
    fill(ctx, 'yellow.1', w >= 0 ? BOSS.x + 1 : BOSS.x - len, BOSS.y - 30, len, 3 - (Math.abs(w) < 1 ? 1 : 0));
    // arrow in flight
    if (this.state === 'flight') {
      const f = Math.min(1, this.stateT / FLIGHT);
      const x0 = ARCHER_X + 12, y0 = GROUND - 31;
      const x1 = BOSS.x + this.shot.x * 7, y1 = BOSS.y + this.shot.y * 7;
      const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f - Math.sin(f * Math.PI) * 6;
      pixLine(ctx, x - 5, y, x, y, 'grey.6');
    }
    // hits on the far boss once they land
    for (const a of this.arrows) {
      if (Math.hypot(a.x, a.y) < 1.3) fill(ctx, 'grey.0', BOSS.x + a.x * 7, BOSS.y + a.y * 7, 1, 1);
    }
  }

  drawArcher(ctx) {
    fill(ctx, 'grass.0', ARCHER_X - 7, GROUND, 15, 2);
    this.anim.draw(ctx, ARCHER_X, GROUND + 1);
    if (this.anim.tagName === 'celebrate' || this.anim.tagName === 'dejected') return;
    const hf = this.anim.anchor('handF'), hb = this.anim.anchor('handB');
    if (!hf) return;
    const gx = ARCHER_X + hf.x, gy = GROUND + 1 + hf.y;
    const d = this.state === 'aim' ? this.aim.draw : 0;
    const bend = 2 + 3 * d;
    const top = [gx - bend, gy - 13], bot = [gx - bend, gy + 13];
    for (const [tip, s] of [[top, -1], [bot, 1]]) {
      pixLine(ctx, gx, gy, gx + 1, gy + s * 6, 'orange.1');
      pixLine(ctx, gx + 1, gy + s * 6, tip[0], tip[1], 'orange.1');
      pixLine(ctx, gx - 1, gy, gx, gy + s * 6, 'orange.3');
    }
    const drawn = this.state === 'aim' && hb && d >= LET_DOWN / 2;
    if (drawn) {
      const sx = ARCHER_X + hb.x, sy = GROUND + 1 + hb.y;
      pixLine(ctx, top[0], top[1], sx, sy, 'grey.5');
      pixLine(ctx, sx, sy, bot[0], bot[1], 'grey.5');
      pixLine(ctx, sx, sy, gx + 5, gy, 'grey.6');
      fill(ctx, 'lamp.1', sx, sy - 1, 2, 1);
    } else {
      pixLine(ctx, top[0], top[1], bot[0], bot[1], 'grey.5');
    }
  }

  /** Close-up through the sight: the face moves, the crosshair stays put. */
  drawScope(ctx) {
    const { x, y, size } = SCOPE;
    const sight = this.state === 'flight' || this.state === 'scored' ? this.sightAtLoose : this.aim.pos;
    panel(ctx, x - 2, y - 2, size + 4, size + 4, { bg: 'grey.0', edge: 'grey.3', shadow: 'grey.1' });
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    fill(ctx, 'grass.0', x, y, size, size);
    const fx = CX - sight.x * R, fy = CY - sight.y * R;
    fill(ctx, 'orange.2', fx - R * 1.3, fy - R * 1.3, R * 2.6, R * 2.6); // straw boss
    fill(ctx, 'orange.3', fx - R * 1.3, fy - R * 1.3, R * 2.6, 1);
    for (let ring = 0; ring < 10; ring++) {
      const r = (R * (10 - ring)) / 10;
      const z = Math.floor(ring / 2);
      circle(ctx, fx, fy, r, LINES[z]);
      circle(ctx, fx, fy, r - 1, ZONES[z]);
    }
    circle(ctx, fx, fy, 1, 'yellow.0'); // X
    for (const a of this.arrows) this.hole(ctx, fx + a.x * R, fy + a.y * R, false);
    ctx.restore();
    // crosshair
    const col = this.state === 'aim' && this.aim.fullDraw ? 'green.3' : 'grey.6';
    fill(ctx, col, CX - 9, CY, 6, 1);
    fill(ctx, col, CX + 4, CY, 6, 1);
    fill(ctx, col, CX, CY - 9, 1, 6);
    fill(ctx, col, CX, CY + 4, 1, 6);
    fill(ctx, 'grey.0', CX, CY, 1, 1);
    // the fresh hole goes on top of the crosshair so you can see where it went
    if (this.state === 'scored' && this.shot) {
      const hx = CX + (this.shot.x - sight.x) * R, hy = CY + (this.shot.y - sight.y) * R;
      if (hx > x && hx < x + size && hy > y && hy < y + size) this.hole(ctx, hx, hy, true);
    }
  }

  hole(ctx, x, y, fresh) {
    fill(ctx, 'grey.0', x - 1, y - 1, 3, 3);
    fill(ctx, fresh ? 'cyan.2' : 'grey.5', x, y, 1, 1);
  }

  drawCard(ctx) {
    const x = W - 92, y = 14;
    panel(ctx, x, y, 88, 30, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (let i = 0; i < ARCHERY.arrows; i++) {
      const a = this.arrows[i];
      const s = a ? (a.score === 10 && a.x10 ? 'X' : `${a.score}`) : '-';
      const c = !a ? 'grey.3' : a.score >= 9 ? 'yellow.2' : a.score === 0 ? 'lamp.2' : 'grey.6';
      text(ctx, s, x + 8 + i * 14, y + 4, c, { align: 'center' });
    }
    text(ctx, 'TOTAL', x + 4, y + 18, 'grey.4', { shadow: null });
    text(ctx, `${this.total}`, x + 84, y + 18, 'cyan.2', { align: 'right' });
  }

  drawMeters(ctx) {
    const by = 190, x = SCOPE.x - 2;
    panel(ctx, x, by, SCOPE.size + 4, 22, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    const aiming = this.state === 'aim';
    const d = aiming ? this.aim.draw : this.state === 'ready' ? 0 : 1;
    text(ctx, 'DRAW', x + 4, by + 3, 'grey.4', { shadow: null });
    meter(ctx, x + 40, by + 3, 74, 6, d, { fg: d >= 1 ? 'green.2' : 'yellow.1' });
    // arms: full while fresh, drains as you hold, red once you are shaking
    const held = aiming ? this.aim.held : 0;
    const fresh = 1 - held / ARCHERY.steadyTime;
    const left = fresh > 0 ? fresh : 1 - (held - ARCHERY.steadyTime) / (ARCHERY.maxHold - ARCHERY.steadyTime);
    text(ctx, 'ARMS', x + 4, by + 12, 'grey.4', { shadow: null });
    meter(ctx, x + 40, by + 12, 74, 6, left, { fg: fresh > 0 ? 'cyan.1' : 'lamp.1' });
  }
}
