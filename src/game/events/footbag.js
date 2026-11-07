// FOOTBAG — timing and rhythm. Keep the bag up for a minute on the sand:
// DOWN kicks with the foot, SPACE with the knee, UP heads it, each as the
// bag falls through that height. Step with LEFT/RIGHT to stay under it and
// press X to spin while it's high. Mix the surfaces, keep the string going.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, panel, text, meter, circle, W, H } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { FOOTBAG, Footbag, stringMult } from '../sim/footbag.js';
import { makeRng } from '../sim/rng.js';
import { playerSheet } from '../assets.js';
import { topBar, banner, fmtPts } from '../hud.js';
import { beachSky, beachSea, beachSand } from '../beach.js';

const GROUND = 186;
const PX = 24;                  // pixels per metre sideways
const S = FOOTBAG.surfaces;
// Bag height on screen: the contact heights land on the sprite's foot, knee
// and forehead, linear in between and above.
const KNOTS = [[0, 0], [S.toe.h, 9], [S.knee.h, 21], [S.head.h, 42]];
function hpx(h) {
  for (let i = 1; i < KNOTS.length; i++) {
    const [h0, p0] = KNOTS[i - 1], [h1, p1] = KNOTS[i];
    if (h <= h1) return p0 + ((h - h0) / (h1 - h0)) * (p1 - p0);
  }
  return 42 + (h - S.head.h) * 26;
}
const KEYS = { toe: 'DOWN', knee: 'SPACE', head: 'UP' };

export class FootbagScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.rng = makeRng();
    this.fb = new Footbag(this.rng);
    this.anim = new Anim(playerSheet(o.player), 'hack_ready');
    this.state = 'ready';
    this.stateT = 0;
    this.t = 0;
    this.pops = [];
    this.excite = 0.15;
    this.flip = false;
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    this.pops = this.pops.filter((p) => (p.t += dt) < 1.1);
    if (this.state === 'ready') {
      if (this.stateT > 0.4 && input.confirm()) { this.state = 'play'; this.stateT = 0; sfx.ready(); }
      this.anim.update(dt * 1000);
      return;
    }
    if (this.state === 'done') {
      if (this.stateT > 5 || (this.stateT > 1 && input.confirm())) this.o.onDone(this.fb.score);
      this.anim.update(dt * 1000);
      return;
    }
    const fb = this.fb;
    const move = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const kick = input.wasPressed('down') ? 'toe' : input.wasPressed('a') ? 'knee' : input.wasPressed('up') ? 'head' : null;
    for (const e of fb.update(dt, { move, kick, spin: input.wasPressed('b') })) this.onEvent(e);
    this.excite = Math.max(0.1, Math.min(0.9, fb.string / 25));

    const pose = fb.pose === 'spin' ? 'hack_spin' : fb.pose === 'ready' ? 'hack_ready' : `hack_${fb.pose}`;
    this.anim.play(pose);
    if (fb.spinning) this.flip = Math.floor((1 - fb.spinT / FOOTBAG.spin) * 4) % 2 === 1;
    else this.flip = false;
    this.anim.update(dt * 1000);
  }

  onEvent(e) {
    const fb = this.fb;
    const at = (msg, col) => this.pops.push({ msg, col, t: 0, x: fb.bag.x, h: fb.bag.h });
    switch (e.type) {
      case 'kick':
        sfx.step(e.q > 0.35);
        if (e.spun) { at(`SPIN! +${e.pts}`, 'yellow.2'); sfx.jingle(); }
        else at(`${S[e.surface].label} ${e.grade === 'PERFECT' ? 'PERFECT' : ''} +${e.pts}`, e.grade === 'PERFECT' ? 'green.2' : e.grade === 'GOOD' ? 'grey.6' : 'orange.3');
        break;
      case 'whiff': sfx.blip(); at('MISS', 'grey.4'); break;
      case 'spin': sfx.whoosh(); break;
      case 'drop':
        sfx.bad();
        at(e.string >= 10 ? `DROPPED - STRING ${e.string}` : 'DROPPED', 'lamp.2');
        break;
      case 'serve': sfx.step(true); break;
      case 'end':
        this.state = 'done'; this.stateT = 0;
        this.newRecord = this.o.record == null || fb.score > this.o.record;
        this.anim.play(fb.score > 300 ? 'celebrate' : 'dejected');
        if (this.newRecord) sfx.fanfare(); else sfx.jingle();
        sfx.crowd(0.6, 1.5);
        this.excite = 0.8;
        break;
    }
  }

  // ---- drawing ------------------------------------------------------------

  sx(m) { return W / 2 - 30 + m * PX; }

  draw(ctx) {
    const fb = this.fb;
    beachSky(ctx, this.t, 92);
    beachSea(ctx, this.t, 92, 132);
    beachSand(ctx, this.t, 132, H, { excite: this.excite });
    // the circle of sand you play in
    const px = this.sx(fb.px);
    fill(ctx, 'orange.2', px - 9, GROUND, 19, 2);
    this.anim.draw(ctx, px, GROUND + 1, { flip: this.flip });

    // the bag (in front of the body: kicks happen just ahead of the hips)
    const b = fb.bag;
    const by = GROUND - hpx(b.h) - 1;
    const bx = this.sx(b.x) + (b.h > 1.2 ? 4 : 10);
    if (b.h > 0.3 && !fb.down) fill(ctx, 'orange.1', bx - 1, GROUND, 4, 1); // shadow
    circle(ctx, bx, by, 2, 'grey.1');
    fill(ctx, 'lamp.1', bx - 1, by - 1, 3, 3);
    fill(ctx, 'yellow.2', bx - 1, by - 1, 1, 1);
    fill(ctx, 'green.2', bx + 1, by + 1, 1, 1);

    for (const p of this.pops) {
      const y = GROUND - hpx(p.h) - 10 - p.t * 14;
      text(ctx, p.msg, Math.max(40, Math.min(W - 40, this.sx(p.x) + 10)), y, p.col, { align: 'center' });
    }

    topBar(ctx, 'FOOTBAG', this.o.player.name, `${Math.ceil(fb.timeLeft)}S`);
    this.drawPanel(ctx);
    this.drawGuide(ctx);
    if (this.state === 'ready') banner(ctx, 'READY', 64, 'yellow.2', 'PRESS SPACE TO START THE CLOCK');
    if (this.state === 'play' && this.stateT < 4) text(ctx, 'STEP WITH LEFT/RIGHT  X TO SPIN', W / 2, 58, 'grey.6', { align: 'center' });
    if (this.state === 'done') this.drawEnd(ctx);
  }

  drawPanel(ctx) {
    const fb = this.fb, w = 110, x = W - w - 4, y = 14;
    panel(ctx, x, y, w, 38, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, 'SCORE', x + 4, y + 3, 'grey.4', { shadow: null });
    text(ctx, `${fb.score}`, x + w - 4, y + 3, 'yellow.2', { align: 'right' });
    text(ctx, 'STRING', x + 4, y + 12, 'grey.4', { shadow: null });
    text(ctx, `${fb.string}  X${stringMult(fb.string).toFixed(1)}`, x + w - 4, y + 12, fb.string >= 10 ? 'green.2' : 'grey.6', { align: 'right' });
    text(ctx, 'BEST', x + 4, y + 21, 'grey.4', { shadow: null });
    text(ctx, `${fb.best}`, x + w - 4, y + 21, 'grey.6', { align: 'right' });
    meter(ctx, x + 4, y + 31, w - 8, 3, fb.timeLeft / FOOTBAG.time, { fg: fb.timeLeft < 10 ? 'lamp.1' : 'cyan.1' });
  }

  /** Height gauge: where the bag is against the three contact zones. */
  drawGuide(ctx) {
    const fb = this.fb, x = 6, top = 22, bot = GROUND - 2;
    const span = hpx(2.6);
    const y = (h) => bot - (hpx(h) / span) * (bot - top);
    panel(ctx, x, top - 4, 46, bot - top + 8, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (const [k, s] of Object.entries(S)) {
      const y0 = y(s.h + s.win), y1 = y(s.h - s.win);
      fill(ctx, 'green.0', x + 3, y0, 8, y1 - y0);
      fill(ctx, 'green.1', x + 3, y(s.h), 8, 1);
      text(ctx, KEYS[k], x + 13, y(s.h) - 3, 'grey.5', { shadow: null });
    }
    if (!fb.down) {
      const by = Math.round(y(Math.min(2.6, fb.bag.h)));
      const near = Math.abs(fb.bag.x - fb.px) < 0.25;
      fill(ctx, near ? 'yellow.2' : 'orange.3', x + 2, by - 1, 10, 3);
    }
  }

  drawEnd(ctx) {
    const fb = this.fb, x = W / 2, y = 70;
    panel(ctx, x - 90, y - 6, 180, 64, { bg: 'grey.1', edge: 'grey.3', shadow: 'grey.0' });
    text(ctx, 'TIME!', x, y, 'yellow.2', { align: 'center', scale: 2 });
    text(ctx, `${fb.kicks} KICKS  BEST STRING ${fb.best}`, x, y + 20, 'grey.6', { align: 'center' });
    text(ctx, `${fb.drops} DROPS`, x, y + 30, 'grey.5', { align: 'center' });
    text(ctx, `${fmtPts(fb.score)}${this.newRecord ? ' RECORD!' : ''}`, x, y + 42, this.newRecord ? 'green.2' : 'cyan.2', { align: 'center' });
  }
}
