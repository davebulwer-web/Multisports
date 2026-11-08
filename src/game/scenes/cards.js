// Between-event scenes: info cards, event results, standings, podium.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, text, W, H } from '../../engine/gfx.js';
import { sfx, playSong } from '../../engine/audio.js';
import { backdrop, card, prompt } from '../ui.js';
import { playerSheet, drawProp } from '../assets.js';
import { standings } from '../sim/scoring.js';
import { anthemFor, anthemSong } from '../anthems.js';
import { drawFlagIcon } from './ceremony.js';
import { nationByCode } from '../../art/flags.js';

const MEDAL = { 1: 'medal_gold', 2: 'medal_silver', 3: 'medal_bronze' };

export class CardScene extends Scene {
  constructor(game, title, lines, onNext, { big = false } = {}) {
    super(game);
    Object.assign(this, { title, lines, onNext, big, t: 0 });
  }
  enter() { sfx.select(); }
  update(dt, input) {
    this.t += dt;
    if (this.t > 0.3 && input.confirm()) { sfx.select(); this.onNext(); }
  }
  draw(ctx) {
    backdrop(ctx, this.game.time);
    const h = 30 + this.lines.length * 10;
    const y = Math.max(8, (H - h) / 2 - 8);
    card(ctx, 16, y, W - 32, h, this.title);
    this.lines.forEach((l, i) =>
      text(ctx, l, W / 2, y + 22 + i * 10, i === 0 ? 'cyan.2' : 'grey.6', { align: 'center', scale: this.big && l && i === 1 ? 2 : 1 }));
    prompt(ctx, this.t);
  }
}

export class ResultsScene extends Scene {
  constructor(game, ev, ranked, onNext, { practice = false } = {}) {
    super(game);
    Object.assign(this, { ev, ranked, onNext, practice, t: 0 });
    this.anims = ranked.map((r) => new Anim(playerSheet(r.id), r.place === 1 ? 'celebrate' : 'idle'));
  }
  enter() { sfx.jingle(); }
  update(dt, input) {
    this.t += dt;
    this.anims.forEach((a) => a.update(dt * 1000));
    if (this.t > 0.6 && input.confirm()) { sfx.select(); this.onNext(); }
  }
  draw(ctx) {
    backdrop(ctx, this.game.time, 0.6);
    const y = 14;
    const rowH = 30;
    card(ctx, 16, y, W - 32, 24 + this.ranked.length * rowH, `${this.ev.name} RESULTS`);
    this.ranked.forEach((r, i) => {
      const ry = y + 20 + i * rowH;
      if (Math.min(1, this.t * 3 - i * 0.4) <= 0) return; // reveal one by one
      fill(ctx, i % 2 ? 'blue.0' : 'blue.1', 18, ry, W - 36, rowH - 2);
      text(ctx, r.place ? `${r.place}` : '-', 30, ry + 10, 'yellow.2', { scale: 1 });
      ctx.save();
      ctx.beginPath();
      ctx.rect(18, ry, W - 36, rowH - 2);
      ctx.clip();
      this.anims[i].draw(ctx, 58, ry + 50);
      ctx.restore();
      text(ctx, r.id.name + (r.id.cpu ? ' (CPU)' : ''), 80, ry + 10, 'grey.6');
      text(ctx, this.ev.format(r.value), 250, ry + 10, r.value == null ? 'lamp.2' : 'cyan.2', { align: 'right' });
      if (MEDAL[r.place]) drawProp(ctx, MEDAL[r.place], 272, ry + 22);
      if (!this.practice) text(ctx, `+${r.points}`, W - 28, ry + 10, 'green.2', { align: 'right' });
    });
    prompt(ctx, this.t);
  }
}

export class StandingsScene extends Scene {
  constructor(game, comp, onNext) {
    super(game);
    Object.assign(this, { comp, onNext, t: 0 });
  }
  update(dt, input) {
    this.t += dt;
    if (this.t > 0.4 && input.confirm()) { sfx.select(); this.onNext(); }
  }
  draw(ctx) {
    backdrop(ctx, this.game.time, 0.4);
    const list = standings(this.comp.players);
    const done = this.comp.eventIdx + 1, total = this.comp.events.length;
    card(ctx, 40, 20, W - 80, 30 + list.length * 18, `STANDINGS AFTER ${done} OF ${total}`);
    const max = Math.max(1, ...list.map((p) => p.points));
    list.forEach((p, i) => {
      const y = 42 + i * 18;
      text(ctx, `${i + 1}`, 52, y, 'yellow.2');
      text(ctx, p.name, 64, y, 'grey.6');
      const bw = Math.round((150 * p.points * Math.min(1, this.t * 1.5)) / max);
      fill(ctx, 'grey.0', 150, y - 1, 152, 9);
      fill(ctx, i === 0 ? 'yellow.1' : 'cyan.0', 151, y, bw, 7);
      text(ctx, `${p.points}`, W - 52, y, 'grey.6', { align: 'right' });
    });
    prompt(ctx, this.t, 'PRESS SPACE FOR THE NEXT EVENT');
  }
}

export class PodiumScene extends Scene {
  constructor(game, comp) {
    super(game);
    this.comp = comp;
    this.t = 0;
    this.list = standings(comp.players);
    this.anims = this.list.map((p, i) => new Anim(playerSheet(p), i === 0 ? 'celebrate' : 'idle'));
  }
  enter() { sfx.crowd(1, 3); }
  exit() { this.song?.stop(); }
  update(dt, input) {
    this.t += dt;
    // The champion's anthem strikes up once the cheering dies down.
    if (!this.song && this.t > 1.2) this.song = playSong(anthemSong(this.list[0].nation));
    this.anims.forEach((a) => a.update(dt * 1000));
    if (this.t > 1.5 && input.confirm()) { sfx.select(); this.comp.opts.onExit(); }
  }
  draw(ctx) {
    backdrop(ctx, 0, 0.95);
    const champ = this.list[0];
    card(ctx, 60, 14, W - 120, 34, 'CHAMPION OF CHAMPIONS');
    text(ctx, champ.name, W / 2, 31, 'yellow.2', { align: 'center', scale: 2 });
    // podium blocks: 2nd, 1st, 3rd
    const blocks = [
      { place: 2, x: W / 2 - 70, h: 34 },
      { place: 1, x: W / 2 - 22, h: 46 },
      { place: 3, x: W / 2 + 26, h: 28 },
    ];
    const base = 200;
    for (const b of blocks) {
      const p = this.list[b.place - 1];
      if (!p) continue;
      fill(ctx, 'grey.0', b.x - 1, base - b.h - 1, 46, b.h + 1);
      fill(ctx, 'grey.5', b.x, base - b.h, 44, b.h);
      fill(ctx, 'grey.6', b.x, base - b.h, 44, 2);
      this.anims[b.place - 1].draw(ctx, b.x + 22, base - b.h);
      drawProp(ctx, MEDAL[b.place], b.x + 22, base - 1);
      text(ctx, p.name, b.x + 22, base + 3, 'grey.6', { align: 'center' });
      text(ctx, `${p.points}`, b.x + 22, base - b.h + 4, 'blue.1', { align: 'center', shadow: null });
    }
    // whose anthem is playing
    const nation = nationByCode(champ.nation);
    const anthem = anthemFor(nation.code);
    const line = anthem.fanfare ? `VICTORY FANFARE FOR ${nation.name}` : `${nation.name}: ${anthem.title}`;
    const lw = line.length * 6 + 26;
    fill(ctx, 'grey.0', W / 2 - lw / 2 - 5, 50, lw + 10, 15);
    fill(ctx, 'blue.0', W / 2 - lw / 2 - 4, 51, lw + 8, 13);
    drawFlagIcon(ctx, nation.code, W / 2 - lw / 2, 52);
    text(ctx, line, W / 2 - lw / 2 + 26, 54, 'cyan.2');
    // others
    this.list.slice(3).forEach((p, i) => text(ctx, `${i + 4}. ${p.name} ${p.points}`, 12, 120 + i * 10, 'grey.5'));
    if (this.t > 1.5) prompt(ctx, this.t, 'PRESS SPACE');
  }
}
