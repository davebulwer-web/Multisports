// CANOE SLALOM — steering against the current. Seen from above, the river
// runs up the screen. Each stroke pushes the kayak on and turns it: LEFT
// paddles on the right side and turns you left, RIGHT the opposite way, so
// alternate to go straight. DOWN back-paddles. Green gates are taken going
// downstream, red gates going back upstream from the eddy below a rock.
import { Scene } from '../../engine/game.js';
import { fill, dither, panel, text, circle, pixLine, P, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { SLALOM, Kayak, flowAt, fmtSlalom } from '../sim/slalom.js';
import { assets } from '../assets.js';
import { topBar, banner } from '../hud.js';
import { hash } from '../winter.js';
import { KITS, SKINS } from '../../art/palette.js';

const PX = 10;                         // pixels per metre
const RX = Math.round(W / 2 - (SLALOM.width * PX) / 2) - 30; // screen x of the left bank
const BOAT_Y = 158;                     // screen y the camera keeps the boat at
const GATES = SLALOM.gates;

export class SlalomScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.k = new Kayak();
    this.state = 'ready';
    this.stateT = 0;
    this.t = 0;
    this.camS = this.k.s;
    this.pops = [];
    this.lastStroke = null;
    const kit = KITS[(o.player.kit ?? 0) % KITS.length], skin = SKINS[(o.player.skin ?? 1) % SKINS.length];
    this.cols = { vest: kit.vest, skin: skin.skin[1], hair: skin.hair[1] };
    this.foam = Array.from({ length: 90 }, (_, i) => ({ x: hash(i) * SLALOM.width, s: -10 + hash(i + 300) * 30 }));
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    const k = this.k;
    this.pops = this.pops.filter((p) => (p.t += dt) < 1.4);
    if (this.state === 'ready') {
      if (this.stateT > 0.4 && input.confirm()) { this.state = 'go'; this.stateT = 0; sfx.gun(); }
    } else if (this.state === 'go') {
      if (input.wasPressed('left') && k.paddle(-1)) sfx.step(true);
      if (input.wasPressed('right') && k.paddle(1)) sfx.step(true);
      if (input.wasPressed('down') && k.paddle(0)) sfx.step(false);
      for (const e of k.update(dt)) this.onEvent(e);
    } else if (this.state === 'done') {
      if (this.stateT > 5 || (this.stateT > 1 && input.confirm())) this.o.onDone(k.time);
    }
    // foam drifts with the water: shows the current and the eddies
    for (const f of this.foam) {
      const v = flowAt(f.x, f.s);
      f.x += v.x * dt; f.s += v.s * dt;
      const rel = f.s - this.camS;
      if (rel > 18 || rel < -8 || f.x < 0.3 || f.x > SLALOM.width - 0.3) {
        f.x = 0.5 + Math.random() * (SLALOM.width - 1);
        f.s = this.camS + (rel > 18 ? -7 : -7 + Math.random() * 25);
      }
    }
    this.camS += (k.s - this.camS) * Math.min(1, dt * 3);
  }

  onEvent(e) {
    const g = GATES[e.gate];
    const at = (msg, col) => this.pops.push({ msg, col, t: 0, x: g ? g.x : this.k.x, s: g ? g.s : this.k.s });
    switch (e.type) {
      case 'gate': sfx.blip(); at(`GATE ${e.gate + 1}`, e.clean ? 'green.2' : 'yellow.2'); break;
      case 'touch': sfx.clang(); at('TOUCH +2', 'orange.3'); break;
      case 'miss': sfx.bad(); at(`MISSED ${e.gate + 1} +50`, 'lamp.2'); break;
      case 'bump': if (this.t - (this.bumpT || 0) > 0.5) { this.bumpT = this.t; sfx.thud(); } break;
      case 'finish':
        this.state = 'done'; this.stateT = 0;
        this.newRecord = this.o.record == null || this.k.time < this.o.record;
        if (this.newRecord) sfx.fanfare(); else sfx.jingle();
        sfx.crowd(0.6, 1.5);
        break;
    }
  }

  // ---- drawing ------------------------------------------------------------

  sx(x) { return RX + x * PX; }
  sy(s) { return BOAT_Y - (s - this.camS) * PX; }

  draw(ctx) {
    this.drawRiver(ctx);
    this.drawBoat(ctx);
    for (const p of this.pops) text(ctx, p.msg, Math.max(40, Math.min(RX + SLALOM.width * PX, this.sx(p.x))), this.sy(p.s) - 12 - p.t * 10, p.col, { align: 'center' });

    const k = this.k;
    topBar(ctx, 'CANOE SLALOM', this.o.player.name, fmtSlalom(k.t));
    this.drawCard(ctx);
    if (this.state === 'ready') banner(ctx, 'READY', 60, 'yellow.2', 'PRESS SPACE TO START');
    if (this.state === 'go' && this.stateT < 5) {
      text(ctx, 'LEFT/RIGHT: STROKE AND TURN', W / 2 - 30, 26, 'grey.6', { align: 'center' });
      text(ctx, 'ALTERNATE TO GO STRAIGHT', W / 2 - 30, 35, 'grey.6', { align: 'center' });
    }
    if (this.state === 'done') this.drawEnd(ctx);
  }

  drawRiver(ctx) {
    const left = RX, right = RX + SLALOM.width * PX;
    // banks
    dither(ctx, 'grass.1', 'grass.2', 0, 0, W, H);
    fill(ctx, 'grey.4', left - 4, 0, 4, H);
    fill(ctx, 'grey.4', right, 0, 4, H);
    fill(ctx, 'grey.3', left - 1, 0, 1, H);
    fill(ctx, 'grey.3', right, 0, 1, H);
    // spectators along the banks
    const s0 = Math.floor(this.camS / 1.2) - 25;
    for (let i = s0; i < s0 + 40; i++) {
      for (const side of [0, 1]) {
        const h = hash(i * 3 + side * 7919);
        if (h < 0.35) continue;
        const tag = assets.props?.tags[`fan_${Math.floor(h * 8)}`];
        if (!tag) continue;
        const y = this.sy(i * 1.2) - 8;
        if (y < -16 || y > H) continue;
        const x = side ? right + 8 + (h * 40 % 14) : left - 22 - (h * 40 % 14);
        assets.props.draw(ctx, tag.from + (Math.floor(this.t * 3 + h * 5) % 2), x, y);
      }
    }
    // water: lighter streaks where it runs fast, darker swirl in the eddies
    fill(ctx, 'cyan.0', left, 0, right - left, H);
    for (let y = 0; y < H; y += 2) {
      const s = this.camS + (BOAT_Y - y) / PX;
      for (let x = left; x < right; x += 6) {
        const f = flowAt((x - left) / PX, s);
        const hsh = hash(Math.floor(x / 6) * 977 + Math.floor(s * 3));
        if (f.s > 1.6 && hsh < 0.2) fill(ctx, 'cyan.1', x + (hsh * 40 % 4), y, 4, 1);
        else if (f.s < 0.2 && hsh < 0.5) dither(ctx, 'cyan.0', 'blue.1', x, y, 6, 2);
      }
    }
    for (const f of this.foam) {
      const x = this.sx(f.x), y = this.sy(f.s);
      fill(ctx, 'cyan.2', x, y, 2, 1);
      fill(ctx, 'blue.3', x, y + 1, 1, 1);
    }
    // start and finish lines
    for (const [s, col] of [[0, 'grey.6'], [SLALOM.finish, 'yellow.2']]) {
      const y = this.sy(s);
      if (y > -4 && y < H) for (let x = left; x < right; x += 4) fill(ctx, col, x, y, 2, 1);
    }
    // rocks with white water piling on their upstream side
    for (const r of SLALOM.rocks) {
      const x = this.sx(r.x), y = this.sy(r.s);
      if (y < -20 || y > H + 20) continue;
      circle(ctx, x, y + 2, r.r * PX + 2, 'cyan.2');
      circle(ctx, x, y, r.r * PX, 'grey.2');
      circle(ctx, x - 2, y - 2, r.r * PX * 0.6, 'grey.3');
      fill(ctx, 'grey.4', x - 3, y - 4, 2, 1);
    }
    // gates
    const k = this.k;
    GATES.forEach((g, i) => {
      const y = this.sy(g.s);
      if (y < -20 || y > H + 20) return;
      const xl = this.sx(g.x - SLALOM.gateW / 2), xr = this.sx(g.x + SLALOM.gateW / 2);
      const st = k.gates[i];
      const col = g.up ? 'lamp.1' : 'green.2';
      pixLine(ctx, this.sx(0), y - 5, this.sx(SLALOM.width), y - 5, 'grey.2'); // wire
      fill(ctx, 'grey.2', xl, y - 5, 1, 3);
      fill(ctx, 'grey.2', xr, y - 5, 1, 3);
      for (const x of [xl, xr]) {
        // hanging pole seen from above: striped, with its shadow on the water
        fill(ctx, 'blue.1', x, y + 1, 4, 4);
        fill(ctx, 'grey.0', x - 2, y - 3, 5, 5);
        fill(ctx, col, x - 1, y - 2, 3, 3);
        fill(ctx, 'grey.6', x - 1, y - 2, 1, 1);
        fill(ctx, 'grey.6', x + 1, y, 1, 1);
      }
      const next = i === k.next;
      const label = `${i + 1}${g.up ? ' UP' : ''}`;
      text(ctx, label, (xl + xr) / 2, y - 11, st.done ? 'grey.4' : st.missed ? 'lamp.0' : next ? 'yellow.2' : g.up ? 'lamp.2' : 'grey.6', { align: 'center' });
      if (next && Math.floor(this.t * 3) % 2 === 0) {
        // arrow showing which way to go through
        const ax = (xl + xr) / 2, ay = y + (g.up ? 6 : -4);
        if (g.up) { fill(ctx, 'yellow.2', ax - 2, ay + 1, 5, 1); fill(ctx, 'yellow.2', ax - 1, ay, 3, 1); fill(ctx, 'yellow.2', ax, ay - 1, 1, 1); }
        else { fill(ctx, 'yellow.2', ax - 2, ay - 1, 5, 1); fill(ctx, 'yellow.2', ax - 1, ay, 3, 1); fill(ctx, 'yellow.2', ax, ay + 1, 1, 1); }
      }
    });
  }

  /** Kayak and paddler, rasterised pixel by pixel so it stays crisp at any heading. */
  drawBoat(ctx) {
    const k = this.k;
    const cx = this.sx(k.x), cy = this.sy(k.s);
    const bx = Math.sin(k.h), by = -Math.cos(k.h);   // bow, screen
    const rx = Math.cos(k.h), ry = Math.sin(k.h);    // boat's right, screen
    const half = (SLALOM.boat / 2) * PX;
    const R = Math.ceil(half) + 10;
    // wake
    fill(ctx, 'cyan.2', cx - bx * half - 1, cy - by * half - 1, 2, 2);
    const cols = this.cols;
    for (let y = -R; y <= R; y++) {
      for (let x = -R; x <= R; x++) {
        const a = x * bx + y * by, b = x * rx + y * ry;
        if (Math.abs(a) > half) continue;
        const wHalf = 3.2 * Math.sqrt(Math.max(0, 1 - (a / half) ** 2));
        if (Math.abs(b) > wHalf) continue;
        let key = Math.abs(b) > wHalf - 1 ? 'grey.1' : b < -0.5 ? 'yellow.2' : 'yellow.1';
        if (Math.abs(a) < 4 && Math.abs(b) < 2.6) key = 'grey.1';
        if (a > half - 3) key = 'lamp.1';
        ctx.fillStyle = P(key);
        ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
      }
    }
    // paddler: shoulders across, head on top
    const at = (a, b) => [Math.round(cx + bx * a + rx * b), Math.round(cy + by * a + ry * b)];
    for (let b = -2; b <= 2; b++) { const [x, y] = at(0, b); fill(ctx, cols.vest[1], x, y, 1, 1); const [x2, y2] = at(-1, b); fill(ctx, cols.vest[0], x2, y2, 1, 1); }
    const [hx, hy] = at(0.5, 0);
    circle(ctx, hx, hy, 1.4, cols.hair);
    fill(ctx, cols.skin, ...at(1.5, 0), 1, 1);
    // paddle: sweeps from bow to stern on the stroke side
    const st = k.stroke;
    let pa = 2, side = 0;
    if (st) { const u = st.t / SLALOM.stroke.time; side = st.side === 0 ? (Math.floor(this.t * 6) % 2 ? 1 : -1) : -st.side; pa = st.side === 0 ? -6 + 12 * u : 6 - 12 * u; }
    const tip = (s) => at(side === s ? pa : 2 - pa * 0.3, s * 10);
    const [x0, y0] = tip(-1), [x1, y1] = tip(1);
    pixLine(ctx, x0, y0, x1, y1, 'grey.5');
    for (const [s, [x, y]] of [[-1, [x0, y0]], [1, [x1, y1]]]) {
      fill(ctx, side === s ? 'grey.6' : 'lamp.1', x - 1, y - 1, 3, 3);
      if (side === s) { fill(ctx, 'cyan.2', x - 2, y + 1, 1, 1); fill(ctx, 'cyan.2', x + 2, y - 1, 1, 1); }
    }
  }

  drawCard(ctx) {
    const k = this.k, w = 98, x = W - w - 4, y = 14;
    panel(ctx, x, y, w, 52, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'TIME', x + 4, y + 3, 'grey.4', { shadow: null });
    text(ctx, k.t.toFixed(1), x + w - 4, y + 3, 'grey.6', { align: 'right' });
    text(ctx, 'PENALTY', x + 4, y + 12, 'grey.4', { shadow: null });
    text(ctx, `+${k.penalty}`, x + w - 4, y + 12, k.penalty ? 'orange.3' : 'grey.6', { align: 'right' });
    GATES.forEach((g, i) => {
      const st = k.gates[i];
      const gx = x + 4 + (i % 6) * 15, gy = y + 23 + Math.floor(i / 6) * 13;
      const bg = st.missed ? 'lamp.0' : st.done ? (st.touched ? 'yellow.0' : 'green.0') : i === k.next ? 'blue.2' : 'grey.2';
      fill(ctx, bg, gx, gy, 13, 11);
      text(ctx, `${i + 1}`, gx + 7, gy + 2, g.up ? 'lamp.2' : 'grey.6', { align: 'center', shadow: null });
    });
  }

  drawEnd(ctx) {
    const k = this.k, x = W / 2 - 30, y = 70;
    panel(ctx, x - 90, y - 6, 180, 64, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
    text(ctx, 'FINISH', x, y, 'yellow.2', { align: 'center', scale: 2 });
    text(ctx, `RUN ${k.t.toFixed(2)}  PENALTY +${k.penalty}`, x, y + 20, 'grey.6', { align: 'center' });
    const miss = k.gates.filter((g) => g.missed).length, touch = k.gates.filter((g) => g.touched).length;
    text(ctx, `${miss} MISSED  ${touch} TOUCHED`, x, y + 30, 'grey.5', { align: 'center' });
    text(ctx, `${fmtSlalom(k.time)}${this.newRecord ? ' RECORD!' : ''}`, x, y + 42, this.newRecord ? 'green.2' : 'cyan.2', { align: 'center' });
  }
}
