// CLAY PIGEON — reaction and tracking. Call for the clay, swing the sight
// after it and fire ahead of it: the shot takes time to get there, and longer
// the further away the clay is. Six singles then three doubles, two shells
// per round. Score is clays broken.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, panel, text, bands, pixLine, circle, W } from '../../engine/gfx.js';
import { sfx } from '../../engine/audio.js';
import { CLAY, Clay, Sight, shotTo, breaks, totalClays } from '../sim/clay.js';
import { makeRng } from '../sim/rng.js';
import { drawGrass } from '../stadium.js';
import { playerSheet } from '../assets.js';
import { topBar, banner } from '../hud.js';

const GROUND = 202;     // shooter's feet
const SHOOTER_X = 38;
const FIELD_Y = 150;    // where the grass starts
const ROUNDS = CLAY.rounds.length;
const TOTAL = totalClays();

const hillY = (x) => 132 + Math.sin(x / 41) * 7 + Math.sin(x / 13 + 1) * 3;

export class ClayScene extends Scene {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.rng = makeRng();
    this.results = []; // true = broken, false = lost, in the order they resolved
    this.round = -1;
    this.sight = new Sight(200, 110);
    this.anim = new Anim(playerSheet(o.player), 'clay_ready');
    this.fx = []; // puffs, fragments and pattern rings
    this.nextRound();
  }

  get hits() { return this.results.filter(Boolean).length; }
  get kind() { return CLAY.rounds[this.round]; }

  nextRound() {
    this.round++;
    this.state = 'call';
    this.stateT = 0;
    this.clays = [];
    this.shots = [];
    this.shells = CLAY.shells;
    this.roundStart = this.results.length;
    this.anim.play('clay_mount');
  }

  update(dt, input) {
    this.stateT += dt;
    const sx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const sy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
    if (this.state !== 'result') this.sight.update(dt, sx, sy);

    switch (this.state) {
      case 'call':
        if (input.wasPressed('a') && this.stateT > 0.2) {
          sfx.pull();
          this.state = 'wait';
          this.stateT = 0;
          this.waitFor = 0.25 + this.rng() * 0.65; // the trap operator's reaction
        }
        break;
      case 'wait':
        if (this.stateT >= this.waitFor) {
          const sides = this.kind === 'double' ? ['left', 'right'] : [this.rng() < 0.5 ? 'left' : 'right'];
          this.clays = sides.map((s) => new Clay(this.rng, s));
          sfx.whoosh();
          this.state = 'live';
          this.stateT = 0;
        }
        break;
      case 'live': {
        if (input.wasPressed('a') && this.shells > 0) this.fire();
        for (const c of this.clays) {
          c.update(dt);
          if (c.state === 'lost' && !c.counted) { c.counted = true; this.results.push(false); }
        }
        for (const s of this.shots) {
          s.t -= dt;
          if (s.t > 0 || s.done) continue;
          s.done = true;
          this.fx.push({ kind: 'ring', x: s.x, y: s.y, r: s.r, t: 0 });
          const target = this.clays.find((c) => c.state === 'flying' && breaks(s.x, s.y, s.r, c.x, c.y));
          if (target) this.smash(target);
        }
        const flying = this.clays.some((c) => c.state === 'flying');
        const pending = this.shots.some((s) => !s.done);
        if (!flying && !pending) this.endRound();
        break;
      }
      case 'result':
        if (this.stateT > 1.6 || (this.stateT > 0.5 && input.confirm())) {
          if (this.round + 1 >= ROUNDS) return this.o.onDone(this.hits);
          this.nextRound();
        }
        break;
    }

    for (const f of this.fx) {
      f.t += dt;
      if (f.kind === 'bit') { f.vy += 120 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    }
    this.fx = this.fx.filter((f) => f.t < (f.kind === 'bit' ? 1.2 : f.kind === 'flash' ? 0.06 : 0.3));
    this.anim.update(dt * 1000);
  }

  fire() {
    this.shells--;
    const { delay, radius } = shotTo(this.sight.x, this.sight.y);
    this.shots.push({ x: this.sight.x, y: this.sight.y, r: radius, t: delay });
    this.fx.push({ kind: 'flash', t: 0 });
    sfx.shot();
  }

  smash(c) {
    c.state = 'hit';
    c.counted = true;
    this.results.push(true);
    sfx.smash();
    this.fx.push({ kind: 'puff', x: c.x, y: c.y, t: 0 });
    for (let i = 0; i < 7; i++) {
      const a = this.rng() * Math.PI * 2, v = 30 + this.rng() * 60;
      this.fx.push({ kind: 'bit', x: c.x, y: c.y, vx: c.vx * 0.3 + Math.cos(a) * v, vy: c.vy * 0.3 + Math.sin(a) * v, t: 0 });
    }
  }

  endRound() {
    this.state = 'result';
    this.stateT = 0;
    const got = this.results.slice(this.roundStart).filter(Boolean).length;
    this.roundHits = got;
    const last = this.round + 1 >= ROUNDS;
    if (last) {
      this.newRecord = this.o.record == null || this.hits > this.o.record;
      if (this.newRecord) sfx.fanfare();
      else if (got) sfx.jingle();
      this.anim.play(this.hits >= 9 ? 'celebrate' : 'dejected');
    } else if (!got) sfx.bad();
  }

  draw(ctx) {
    this.drawScenery(ctx);
    for (const c of this.clays) if (c.state === 'flying') this.drawClay(ctx, c);
    this.drawFx(ctx);
    this.drawShooter(ctx);
    if (this.state !== 'result') this.drawSight(ctx);

    topBar(ctx, 'CLAY PIGEON', this.o.player.name, `ROUND ${this.round + 1}/${ROUNDS}`);
    this.drawCard(ctx);
    this.drawShells(ctx);

    if (this.state === 'call') {
      const first = this.round === 0;
      banner(ctx, this.kind === 'double' ? 'DOUBLE' : 'CALL PULL!', 40, 'yellow.2',
        first ? 'SPACE TO CALL. AIM AHEAD OF IT, SPACE TO FIRE' : this.kind === 'double' ? 'TWO CLAYS, TWO SHELLS. SPACE TO CALL' : 'PRESS SPACE TO CALL');
    }
    if (this.state === 'result') {
      const n = this.kind === 'double' ? 2 : 1;
      const msg = this.roundHits === n ? (n === 2 ? 'PAIR!' : 'HIT!') : this.roundHits ? '1 OF 2' : 'MISS';
      const last = this.round + 1 >= ROUNDS;
      const sub = last ? `${this.hits} OF ${TOTAL}${this.newRecord ? '  NEW RECORD!' : ''}` : `${this.hits} BROKEN SO FAR`;
      banner(ctx, msg, 40, this.roundHits ? 'yellow.2' : 'lamp.2', sub);
    }
  }

  drawScenery(ctx) {
    bands(ctx, ['sky.0', 'sky.1', 'sky.2', 'sky.3'], 0, 0, W, FIELD_Y - 10);
    // distant hills
    for (let x = 0; x < W; x += 2) {
      const h = Math.round(hillY(x));
      fill(ctx, 'green.1', x, h, 2, 2);
      fill(ctx, 'grass.0', x, h + 2, 2, FIELD_Y - h);
    }
    // treeline
    for (let x = 6; x < W; x += 17) {
      const y = 143 + ((x * 7) % 5);
      circle(ctx, x, y, 6 + ((x * 3) % 3), 'green.0');
      circle(ctx, x - 1, y - 2, 3, 'grass.0');
    }
    drawGrass(ctx, 0, FIELD_Y);
    // trap houses
    for (const side of ['left', 'right']) {
      const t = CLAY.traps[side];
      fill(ctx, 'grey.2', t.x - 9, t.y - 4, 18, 12);
      fill(ctx, 'grey.4', t.x - 10, t.y - 6, 20, 2);
      fill(ctx, 'grey.0', side === 'left' ? t.x + 3 : t.x - 7, t.y - 2, 4, 3); // throwing slot
    }
    // shooting stand
    fill(ctx, 'orange.1', SHOOTER_X - 12, GROUND + 1, 26, 3);
  }

  drawClay(ctx, c) {
    const spin = Math.floor(c.t * 12) % 2;
    fill(ctx, 'orange.3', c.x - 2, c.y - 1, 5, 2);
    fill(ctx, 'orange.1', c.x - 2, c.y + 1, 5, 1);
    fill(ctx, 'grey.6', c.x - 1 + spin * 2, c.y - 1, 1, 1); // glint as it spins
  }

  drawFx(ctx) {
    for (const f of this.fx) {
      if (f.kind === 'bit') fill(ctx, f.t < 0.6 ? 'orange.2' : 'orange.1', f.x, f.y, 1, 1);
      else if (f.kind === 'puff') {
        const r = 2 + f.t * 16;
        circle(ctx, f.x, f.y, r, f.t < 0.15 ? 'orange.3' : 'grey.5');
      } else if (f.kind === 'ring') {
        // where the shot pattern went: lets you see how far you were behind
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          fill(ctx, 'grey.5', f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r, 1, 1);
        }
      }
    }
  }

  drawShooter(ctx) {
    this.anim.draw(ctx, SHOOTER_X, GROUND + 1);
    const tag = this.anim.tagName;
    if (tag === 'celebrate' || tag === 'dejected') return;
    const h = this.anim.anchor('handF');
    if (!h) return;
    const hx = SHOOTER_X + h.x, hy = GROUND + 1 + h.y;
    const a = Math.atan2(this.sight.y - hy, this.sight.x - hx);
    const dx = Math.cos(a), dy = Math.sin(a);
    pixLine(ctx, hx - dx * 7, hy - dy * 7 + 1, hx - dx * 2, hy - dy * 2, 'orange.1'); // stock
    pixLine(ctx, hx - dx * 2, hy - dy * 2, hx + dx * 11, hy + dy * 11, 'grey.1');     // barrels
    if (this.fx.some((f) => f.kind === 'flash')) circle(ctx, hx + dx * 13, hy + dy * 13, 2, 'yellow.2');
  }

  drawSight(ctx) {
    const { x, y } = this.sight;
    const r = shotTo(x, y).radius;
    const live = this.state === 'live';
    const col = live ? 'yellow.2' : 'grey.6';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      if (i % 4 === 0) continue; // gaps at the compass points
      fill(ctx, col, x + Math.cos(a) * r, y + Math.sin(a) * r, 1, 1);
    }
    fill(ctx, col, x, y, 1, 1);
  }

  drawCard(ctx) {
    const w = TOTAL * 7 + 10, x = W - w - 4, y = 14;
    panel(ctx, x, y, w, 24, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    for (let i = 0; i < TOTAL; i++) {
      const r = this.results[i];
      const cx = x + 6 + i * 7, cy = y + 6;
      if (r === true) { fill(ctx, 'orange.3', cx - 2, cy - 1, 5, 3); fill(ctx, 'orange.1', cx - 2, cy + 1, 5, 1); }
      else if (r === false) { pixLine(ctx, cx - 1, cy - 1, cx + 1, cy + 1, 'lamp.1'); pixLine(ctx, cx - 1, cy + 1, cx + 1, cy - 1, 'lamp.1'); }
      else fill(ctx, 'grey.3', cx, cy, 1, 1);
    }
    text(ctx, 'BROKEN', x + 4, y + 13, 'grey.4', { shadow: null });
    text(ctx, `${this.hits}`, x + w - 4, y + 13, 'cyan.2', { align: 'right' });
  }

  drawShells(ctx) {
    const x = 4, y = 14;
    panel(ctx, x, y, 66, 22, { bg: 'grey.1', edge: 'grey.2', shadow: 'grey.0' });
    text(ctx, this.kind === 'double' ? 'DOUBLE' : 'SINGLE', x + 4, y + 3, 'grey.4', { shadow: null });
    for (let i = 0; i < CLAY.shells; i++) {
      const sx = x + 4 + i * 8, sy = y + 12;
      const have = i < this.shells;
      fill(ctx, have ? 'lamp.1' : 'grey.2', sx, sy, 6, 3);
      fill(ctx, have ? 'yellow.1' : 'grey.3', sx + 6, sy, 2, 3);
    }
  }
}
