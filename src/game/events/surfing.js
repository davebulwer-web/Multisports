// SURFING — balance and line. Seen from the beach: the wave peels to the
// right and the breaking curl chases you. Pop up as the wave lifts you, then
// steer with the arrows (the board turns towards the direction you hold).
// Drop down the face for speed, turn off the bottom and the lip, cut back
// when you outrun the curl, let it catch you mid-face for a tube ride, and
// launch off the lip for an air, turning to face down before you land.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, dither, bands, panel, text, meter, pixLine, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { SURF, Surfer, steepness } from '../sim/surf.js';
import { makeRng } from '../sim/rng.js';
import { playerSheet, assets } from '../assets.js';
import { topBar, banner, fmtPts } from '../hud.js';
import { beachSky } from '../beach.js';
import { hash } from '../winter.js';

const TR = 176;                 // screen y of the trough
const FACE = 100;               // pixels of face in the pocket
const PX = 14;                  // pixels per metre along the wave
const HORIZON = 50;
const DEG = Math.PI / 180;
const POP = { lift: 2.6, good: [1.5, 2.2] }; // take-off timing (s)

export class SurfScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.rng = makeRng();
    this.rides = [];
    this.anim = new Anim(playerSheet(o.player), 'surf_paddle');
    this.t = 0;
    this.newWave();
  }

  get total() { return this.rides.reduce((a, r) => a + r.score, 0); }

  newWave() {
    this.sf = new Surfer(this.rng);
    this.state = 'paddle';
    this.stateT = 0;
    this.feed = [];
    this.excite = 0.15;
    this.camX = this.sf.x - (230 - 30) / PX;
    this.anim.play('surf_paddle');
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    const sf = this.sf;
    this.feed = this.feed.filter((f) => (f.t += dt) < 3);
    switch (this.state) {
      case 'paddle': {
        const late = this.stateT >= POP.lift;
        if ((input.wasPressed('a') && this.stateT > 0.3) || late) {
          const [a, b] = POP.good;
          const tt = this.stateT;
          const q = tt < a ? Math.max(0, 1 - (a - tt) / 0.8) : tt > b ? Math.max(0, 1 - (tt - b) / 0.5) : 1;
          sf.v = 3.5 + 3.5 * q;
          if (late) sf.heading = -70;
          this.say(q >= 1 ? 'CLEAN TAKE-OFF' : tt < a ? 'EARLY TAKE-OFF' : 'LATE TAKE-OFF', q >= 1 ? 'green.2' : 'orange.3');
          this.state = 'ride'; this.stateT = 0;
          sfx.whoosh();
        }
        break;
      }
      case 'ride': {
        const dx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
        const dy = (input.isDown('up') ? 1 : 0) - (input.isDown('down') ? 1 : 0);
        for (const e of sf.update(dt, { dx, dy })) this.onEvent(e);
        const cos = Math.cos(sf.heading * DEG);
        this.anim.play(sf.air ? 'surf_air' : Math.abs(cos) < 0.6 || sf.y < 0.4 ? 'surf_carve' : 'surf_ride');
        this.excite = Math.max(0.1, this.excite - dt * 0.2);
        break;
      }
      case 'wipe':
        sf.cx += SURF.curl * dt;
        if (this.stateT > 2.4 || (this.stateT > 1 && input.confirm())) this.endRide();
        break;
      case 'end':
        if (this.stateT > 4 || (this.stateT > 0.8 && input.confirm())) {
          if (this.rides.length >= SURF.waves) return this.o.onDone(this.total);
          this.newWave();
        }
        break;
    }
    // camera: keep the surfer right of centre so the curl is in view behind
    if (this.state !== 'end') {
      const want = sf.x - (230 - Math.min(80, Math.max(0, -sf.d * 10))) / PX;
      this.camX += (want - this.camX) * Math.min(1, dt * 3);
    }
    this.anim.update(dt * 1000);
  }

  say(msg, col = 'grey.6', pts = null) { this.feed.push({ msg: pts != null ? `${msg} +${pts}` : msg, col, t: 0 }); }

  onEvent(e) {
    switch (e.type) {
      case 'move':
        this.say(e.move === 'tube' ? `TUBE ${e.secs.toFixed(1)}S` : e.name, e.move === 'air' || e.move === 'tube' ? 'yellow.2' : 'green.2', e.pts);
        sfx.step(true);
        if (e.move === 'air' || e.move === 'tube' || e.move === 'cutback') { sfx.crowd(0.5, 1); this.excite = 0.8; }
        break;
      case 'launch': sfx.whoosh(); break;
      case 'tube': this.say('IN THE TUBE!', 'cyan.2'); break;
      case 'wipeout':
        this.state = 'wipe'; this.stateT = 0;
        this.anim.play('stumble');
        sfx.thud(); sfx.bad();
        break;
      case 'closeout':
        this.say('WAVE CLOSES OUT', 'cyan.2', e.pts);
        this.endRide();
        break;
    }
  }

  endRide() {
    const sf = this.sf;
    this.rides.push({ score: sf.score, wipeout: sf.wipeout, moves: sf.moves });
    this.state = 'end'; this.stateT = 0;
    const last = this.rides.length >= SURF.waves;
    this.anim.play(sf.wipeout ? 'dejected' : 'celebrate');
    if (last && (this.o.record == null || this.total > this.o.record)) { this.newRecord = true; sfx.fanfare(); }
    else if (!sf.wipeout) sfx.jingle();
    else sfx.fail();
  }

  // ---- drawing ------------------------------------------------------------

  sx(x) { return (x - this.camX) * PX; }
  /** Face height in pixels at distance d ahead of the curl (it fades on the shoulder). */
  facePx(d) { return FACE * (0.55 + 0.45 * steepness(Math.max(0, d))); }
  sy(x, y) { return TR - (y / SURF.face) * this.facePx(x - this.sf.cx); }

  draw(ctx) {
    beachSky(ctx, this.t, HORIZON);
    // open sea behind the wave
    fill(ctx, 'sky.0', 0, HORIZON, W, TR - HORIZON);
    for (let y = HORIZON + 2; y < TR - 40; y += 5) {
      for (let x = (y * 11) % 29; x < W; x += 29) fill(ctx, 'sky.1', x + Math.round(Math.sin(this.t + y) * 2), y, 7, 1);
    }
    this.drawWave(ctx);
    if (this.state !== 'end') this.drawSurfer(ctx);
    this.drawCurtain(ctx);
    // inshore water and the beach at the bottom
    fill(ctx, 'cyan.1', 0, TR, W, H - TR);
    for (let y = TR + 3; y < H - 8; y += 5) {
      for (let x = ((y * 5 - Math.round(this.camX * PX * 0.5)) % 23 + 23) % 23; x < W; x += 23) fill(ctx, 'grey.6', x, y, 8, 1);
    }
    fill(ctx, 'orange.3', 0, H - 8, W, 8);
    fill(ctx, 'grey.6', 0, H - 8, W, 1);
    for (let i = 0; i < 18; i++) {
      const tag = assets.props.tags[`fan_${i % 8}`];
      const cheer = hash(i + 17) < this.excite && Math.floor(this.t * 4 + i) % 2 === 0;
      assets.props.draw(ctx, tag.from + (cheer ? 1 : 0), 10 + i * 21 + (i % 3) * 3, H);
    }

    const n = Math.min(SURF.waves, this.rides.length + (this.state === 'end' ? 0 : 1));
    topBar(ctx, 'SURFING', this.o.player.name, `WAVE ${Math.max(1, n)}/${SURF.waves}`);
    this.drawCard(ctx);
    if (this.state === 'ride' || this.state === 'paddle') this.drawGauges(ctx);
    this.feed.slice(-4).forEach((f, i, arr) => text(ctx, f.msg, W / 2, 46 + (i - arr.length + 4) * 9, f.col, { align: 'center' }));
    if (this.state === 'paddle') this.drawPop(ctx);
    if (this.state === 'wipe' && this.stateT > 0.3) banner(ctx, 'WIPEOUT!', 60, 'lamp.2', this.sf.wipeout);
    if (this.state === 'end') this.drawEnd(ctx);
  }

  drawWave(ctx) {
    const sf = this.sf;
    for (let x = 0; x < W; x += 2) {
      const wx = this.camX + x / PX, d = wx - sf.cx;
      const top = Math.round(TR - this.facePx(d));
      if (d < -3.2) {
        // white water
        const bub = Math.round(Math.sin(wx * 3 + this.t * 9) * 3 + hash(Math.floor(wx * 4)) * 5);
        fill(ctx, 'grey.5', x, top - 6 + bub, 2, TR - top + 6 - bub);
        dither(ctx, 'grey.6', 'grey.5', x, top - 6 + bub, 2, Math.round((TR - top) * 0.4));
        dither(ctx, 'grey.5', 'cyan.2', x, top + Math.round((TR - top) * 0.6), 2, Math.round((TR - top) * 0.4));
        continue;
      }
      const h = TR - top;
      // face: lighter and greener up near the lip, deep blue at the bottom
      fill(ctx, 'sky.0', x, top, 2, h);
      fill(ctx, 'cyan.0', x, top, 2, Math.round(h * 0.55));
      dither(ctx, 'cyan.0', 'sky.0', x, top + Math.round(h * 0.55), 2, 4);
      fill(ctx, 'cyan.1', x, top, 2, Math.round(h * 0.2));
      dither(ctx, 'cyan.1', 'cyan.0', x, top + Math.round(h * 0.2), 2, 3);
      fill(ctx, 'grey.6', x, top - 1, 2, 2);  // feathering lip
      if (d < 0) dither(ctx, 'sky.0', 'grey.1', x, top + 4, 2, h - 6); // inside the barrel
      // streaks running along the face
      if (hash(Math.floor(wx * 2) + 7) < 0.3) fill(ctx, 'cyan.2', x, top + Math.floor(hash(Math.floor(wx * 2)) * h * 0.8) + 3, 2, 1);
    }
  }

  /** The lip pitching over in front of the barrel (drawn over the surfer). */
  drawCurtain(ctx) {
    const sf = this.sf;
    for (let x = 0; x < W; x += 2) {
      const wx = this.camX + x / PX, d = wx - sf.cx;
      if (d >= 0 || d < -3.2) continue;
      const top = Math.round(TR - this.facePx(d));
      const reach = Math.sqrt(Math.min(1, -d / 3.2));
      const bottom = top + Math.round((TR - top) * reach);
      fill(ctx, 'cyan.2', x, top - 2, 2, 4);
      for (let y = top + 2; y < bottom; y += 2) if ((x + y) % 4 === 0) fill(ctx, 'cyan.2', x, y, 1, 1);
      fill(ctx, 'grey.6', x, bottom - 2, 2, 3);
      fill(ctx, 'cyan.2', x, bottom + 1, 2, 1);
    }
  }

  drawSurfer(ctx) {
    const sf = this.sf;
    const x = this.sx(sf.x);
    let y = sf.air ? TR - (sf.y / SURF.face) * FACE : this.sy(sf.x, sf.y);
    const cos = Math.cos(sf.heading * DEG), sin = Math.sin(sf.heading * DEG);
    const flip = cos < 0;
    // board angle on screen: steep headings are drawn a bit flatter
    const ang = Math.atan2(-sin * 0.75, Math.abs(cos) + 0.15) * (flip ? -1 : 1);
    if (this.state === 'wipe') {
      // tumbling in the foam
      const t = this.stateT;
      y = Math.min(TR, y + t * 40);
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(t * 7);
      this.drawBoard(ctx, 0, 0, 0);
      ctx.restore();
      if (t < 0.8) this.anim.draw(ctx, x + t * 10, y);
      fill(ctx, 'grey.6', x - 10, Math.round(y) - 2, 20, 3);
      return;
    }
    if (this.state === 'paddle') {
      y = this.sy(sf.x, sf.y) + 2;
      this.drawBoard(ctx, x, y, -0.15);
      this.anim.draw(ctx, x - 2, y);
      return;
    }
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ang * 0.45);
    this.anim.draw(ctx, 0, 0, { flip });
    ctx.restore();
    this.drawBoard(ctx, x, y + 1, ang);
    if (!sf.air && sf.v > 6) {
      // spray off the rail
      for (let i = 0; i < 4; i++) {
        const k = hash(Math.floor(this.t * 20) + i);
        fill(ctx, 'grey.6', x - Math.cos(ang) * (12 + k * 8) * (flip ? -1 : 1), y - k * 6 + 2, 1, 1);
      }
    }
  }

  drawBoard(ctx, x, y, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), L = 12;
    for (let o = -1; o <= 0; o++) pixLine(ctx, x - c * L, y - s * L + o, x + c * L, y + s * L + o, o ? 'yellow.2' : 'grey.6');
    pixLine(ctx, x - c * L, y - s * L + 1, x + c * L, y + s * L + 1, 'grey.2');
    pixLine(ctx, x - c * 3, y - s * 3, x + c * 3, y + s * 3, 'lamp.1');
  }

  drawCard(ctx) {
    const w = 104, x = W - w - 4, y = 14;
    panel(ctx, x, y, w, 29, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (let i = 0; i < SURF.waves; i++) {
      const r = this.rides[i] || (i === this.rides.length && this.state !== 'end' ? { score: this.sf.score, live: true } : null);
      const s = !r ? '--' : `${r.score}${r.wipeout ? ' WIPEOUT' : ''}`;
      text(ctx, `${i + 1} ${s}`, x + 4, y + 3 + i * 9, r && r.live ? 'yellow.2' : 'grey.6');
    }
    text(ctx, `TOTAL ${this.total + (this.state !== 'end' ? this.sf.score : 0)}`, x + w - 4, y + 21, 'cyan.2', { align: 'right' });
  }

  drawGauges(ctx) {
    const sf = this.sf;
    panel(ctx, 4, 14, 120, 29, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'SPEED', 8, 17, 'grey.4', { shadow: null });
    meter(ctx, 44, 17, 76, 5, sf.v / 12, { fg: 'green.2' });
    // where you are relative to the curl
    const gx = 44, gw = 76, lo = -3, hi = 26;
    const px = (d) => gx + ((d - lo) / (hi - lo)) * gw;
    text(ctx, 'CURL', 8, 27, 'grey.4', { shadow: null });
    fill(ctx, 'grey.2', gx, 28, gw, 5);
    fill(ctx, 'purple.1', px(lo), 28, px(0) - px(lo), 5);
    fill(ctx, 'green.1', px(0), 28, px(SURF.pocket) - px(0), 5);
    const m = Math.round(px(Math.max(lo, Math.min(hi, sf.d))));
    fill(ctx, 'grey.6', m - 1, 26, 3, 9);
    text(ctx, `${Math.ceil(sf.timeLeft)}S`, 8, 35, 'grey.6', { shadow: null });
  }

  drawPop(ctx) {
    const x = W / 2 - 60, y = 92;
    panel(ctx, x - 4, y - 14, 128, 26, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
    text(ctx, 'PADDLE... SPACE TO POP UP', x + 60, y - 10, 'yellow.2', { align: 'center', shadow: null });
    const w = 120, f = (t) => x + (t / POP.lift) * w;
    fill(ctx, 'grey.2', x, y, w, 5);
    fill(ctx, 'green.1', f(POP.good[0]), y, f(POP.good[1]) - f(POP.good[0]), 5);
    fill(ctx, 'grey.6', Math.round(f(Math.min(POP.lift, this.stateT))) - 1, y - 2, 3, 9);
  }

  drawEnd(ctx) {
    const r = this.rides[this.rides.length - 1], x = W / 2, y = 64;
    const rows = r.moves.slice(-5);
    panel(ctx, x - 100, y - 6, 200, 52 + rows.length * 9, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
    text(ctx, r.wipeout ? 'WIPED OUT' : 'GREAT RIDE', x, y, r.wipeout ? 'lamp.2' : 'yellow.2', { align: 'center', scale: 2 });
    text(ctx, `${r.moves.length} MANOEUVRE${r.moves.length === 1 ? "" : "S"}`, x, y + 18, 'grey.5', { align: 'center' });
    rows.forEach((m, i) => {
      text(ctx, m.name, x - 80, y + 29 + i * 9, 'grey.6');
      text(ctx, `${m.pts}`, x + 80, y + 29 + i * 9, 'cyan.2', { align: 'right' });
    });
    const last = this.rides.length >= SURF.waves;
    text(ctx, `WAVE ${r.score}   TOTAL ${fmtPts(this.total)}${last && this.newRecord ? ' RECORD!' : ''}`, x, y + 32 + rows.length * 9, last && this.newRecord ? 'green.2' : 'yellow.2', { align: 'center' });
  }
}
