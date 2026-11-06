// Title, player setup and practice event selection.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, panel, text, W, H } from '../../engine/gfx.js';
import { sfx, toggleMute, isMuted } from '../../engine/audio.js';
import { KITS, SKINS } from '../../art/palette.js';
import { backdrop, card, prompt } from '../ui.js';
import { athleteSheet } from '../assets.js';
import { EVENTS } from '../events/index.js';
import { allRecords } from '../records.js';
import { Competition, makePlayer, CPU_NAMES } from '../competition.js';

/** Vertical menu helper. */
class Menu {
  constructor(items) { this.items = items; this.sel = 0; }
  update(input) {
    if (input.wasPressed('up')) { this.sel = (this.sel + this.items.length - 1) % this.items.length; sfx.blip(); }
    if (input.wasPressed('down')) { this.sel = (this.sel + 1) % this.items.length; sfx.blip(); }
    if (input.confirm()) { sfx.select(); this.items[this.sel].action(); }
  }
  draw(ctx, x, y, gap = 12) {
    this.items.forEach((it, i) => {
      const on = i === this.sel;
      const label = typeof it.label === 'function' ? it.label() : it.label;
      if (on) fill(ctx, 'blue.2', x - 70, y + i * gap - 2, 140, 11);
      text(ctx, (on ? '> ' : '') + label + (on ? ' <' : ''), x, y + i * gap, on ? 'yellow.2' : 'grey.5', { align: 'center' });
    });
  }
}

export class TitleScene extends Scene {
  constructor(game) {
    super(game);
    this.t = 0;
    this.runners = Array.from({ length: 4 }, (_, i) => ({
      anim: new Anim(athleteSheet(i * 2 % KITS.length, i % SKINS.length), 'run'),
      x: -40 - i * 70,
      v: 70 + i * 9,
    }));
    this.menu = new Menu([
      { label: 'COMPETITION', action: () => game.setScene(new SetupScene(game)) },
      { label: 'PRACTICE', action: () => game.setScene(new PracticeScene(game)) },
      { label: 'SPRITE STUDIO', action: () => { window.location.href = 'studio.html'; } },
      { label: () => `SOUND: ${isMuted() ? 'OFF' : 'ON'}`, action: () => toggleMute() },
    ]);
  }
  update(dt, input) {
    this.t += dt;
    for (const r of this.runners) {
      r.x += r.v * dt;
      if (r.x > W + 40) r.x = -40 - Math.random() * 120;
      r.anim.update(dt * 1000);
    }
    this.menu.update(input);
  }
  draw(ctx) {
    backdrop(ctx, this.game.time, 0.35);
    // logo: TV-style stripes behind the title
    const y = 18;
    const stripes = ['red.1', 'orange.2', 'yellow.1', 'green.1', 'cyan.0', 'blue.2'];
    stripes.forEach((s, i) => fill(ctx, s, 0, y + i * 6, W, 6));
    fill(ctx, 'grey.0', 0, y + 36, W, 1);
    const wob = (i) => Math.round(Math.sin(this.t * 3 + i * 0.5) * 1.5);
    const title = 'MULTISPORTS';
    const sx = W / 2 - (title.length * 24) / 2;
    [...title].forEach((ch, i) => {
      text(ctx, ch, sx + i * 24 + 2, y + 4 + wob(i) + 2, 'grey.0', { scale: 4, shadow: null });
      text(ctx, ch, sx + i * 24, y + 4 + wob(i), 'grey.6', { scale: 4, shadow: 'blue.0' });
    });
    fill(ctx, 'blue.0', 0, y + 37, W, 13);
    fill(ctx, 'grey.0', 0, y + 50, W, 1);
    text(ctx, 'THE ALL-ROUND SPORTS CHALLENGE', W / 2, y + 40, 'yellow.2', { align: 'center' });
    panel(ctx, W / 2 - 80, 82, 160, 54, { bg: 'blue.0', edge: 'blue.2', shadow: 'grey.0' });
    this.menu.draw(ctx, W / 2, 88);
    for (const r of this.runners) r.anim.draw(ctx, r.x, 196);
    // records strip
    const recs = allRecords();
    const i = Math.floor(this.t / 3) % recs.length;
    const rc = recs[i];
    fill(ctx, 'grass.0', 0, 140, W, 11);
    text(ctx, `RECORD  ${rc.ev.name}  ${rc.ev.format(rc.value)}  ${rc.name}`, W / 2, 142, 'cyan.2', { align: 'center' });
    text(ctx, 'ARROWS + SPACE   ENTER TO CONFIRM', W / 2, H - 9, 'grass.3', { align: 'center', shadow: 'grass.0' });
  }
}

const TYPES = ['HUMAN', 'CPU', 'OFF'];

export class SetupScene extends Scene {
  constructor(game) {
    super(game);
    this.t = 0;
    this.slots = [0, 1, 2, 3].map((i) => ({
      type: i === 0 ? 'HUMAN' : i < 3 ? 'CPU' : 'OFF',
      name: i === 0 ? 'PLAYER 1' : CPU_NAMES[(i * 3) % CPU_NAMES.length],
      kit: [0, 1, 2, 3][i],
      skin: [1, 3, 0, 2][i],
      skill: 0.35 + Math.random() * 0.45,
    }));
    this.row = 0;
    this.col = 0; // 0 type, 1 name, 2 kit, 3 skin
    this.editing = false;
    this.anims = this.slots.map((s) => new Anim(athleteSheet(s.kit, s.skin), 'idle'));
  }

  refresh(i) {
    const s = this.slots[i];
    this.anims[i] = new Anim(athleteSheet(s.kit, s.skin), s.type === 'OFF' ? 'dejected' : 'idle');
  }

  update(dt, input) {
    this.t += dt;
    this.anims.forEach((a) => a.update(dt * 1000));
    if (this.editing) {
      const s = this.slots[this.row];
      for (const ch of input.text) {
        if (ch === '\b') s.name = s.name.slice(0, -1);
        else if (/^[a-z0-9 .\-!']$/i.test(ch) && s.name.length < 10) s.name += ch.toUpperCase();
      }
      if (input.wasPressed('start')) { this.editing = false; sfx.select(); if (!s.name.trim()) s.name = `PLAYER ${this.row + 1}`; }
      return;
    }
    const rows = this.slots.length + 1;
    if (input.wasPressed('up')) { this.row = (this.row + rows - 1) % rows; sfx.blip(); }
    if (input.wasPressed('down')) { this.row = (this.row + 1) % rows; sfx.blip(); }
    if (input.wasPressed('left')) { this.col = (this.col + 3) % 4; sfx.blip(); }
    if (input.wasPressed('right')) { this.col = (this.col + 1) % 4; sfx.blip(); }
    if (input.wasPressed('b')) { sfx.back(); return this.game.setScene(new TitleScene(this.game)); }
    if (!input.confirm()) return;
    sfx.select();
    if (this.row === this.slots.length) return this.begin();
    const s = this.slots[this.row];
    if (this.col === 0) {
      s.type = TYPES[(TYPES.indexOf(s.type) + 1) % TYPES.length];
      if (s.type === 'HUMAN' && CPU_NAMES.includes(s.name)) s.name = `PLAYER ${this.row + 1}`;
      if (s.type === 'CPU' && !CPU_NAMES.includes(s.name)) s.name = CPU_NAMES[(this.row * 3) % CPU_NAMES.length];
    } else if (this.col === 1) {
      if (s.type === 'HUMAN') { this.editing = true; s.name = ''; }
    } else if (this.col === 2) s.kit = (s.kit + 1) % KITS.length;
    else s.skin = (s.skin + 1) % SKINS.length;
    this.refresh(this.row);
  }

  begin() {
    const active = this.slots.filter((s) => s.type !== 'OFF');
    if (!active.some((s) => s.type === 'HUMAN')) { sfx.bad(); this.warn = 'NEED AT LEAST ONE HUMAN'; return; }
    const players = active.map((s) => makePlayer({ name: s.name, kit: s.kit, skin: s.skin, cpu: s.type === 'CPU', skill: s.skill }));
    const comp = new Competition(this.game, players, EVENTS, { onExit: () => this.game.setScene(new TitleScene(this.game)) });
    comp.start();
  }

  draw(ctx) {
    backdrop(ctx, this.game.time);
    card(ctx, 12, 8, W - 24, 196, 'COMPETITORS');
    const cols = [{ x: 40, label: 'TYPE' }, { x: 110, label: 'NAME' }, { x: 210, label: 'KIT' }, { x: 290, label: 'SKIN' }];
    cols.forEach((c, i) => text(ctx, c.label, c.x, 28, this.col === i && this.row < 4 ? 'yellow.2' : 'grey.4'));
    this.slots.forEach((s, i) => {
      const y = 40 + i * 36;
      const on = this.row === i;
      fill(ctx, on ? 'blue.1' : 'blue.0', 16, y, W - 32, 34);
      const val = [s.type, s.name + (this.editing && on && Math.floor(this.t * 3) % 2 ? '_' : ''), KITS[s.kit].name, SKINS[s.skin].name];
      val.forEach((v, c) => {
        const hi = on && this.col === c;
        if (hi) fill(ctx, 'blue.2', cols[c].x - 3, y + 11, Math.max(40, v.length * 6 + 5), 11);
        text(ctx, v, cols[c].x, y + 13, s.type === 'OFF' && c > 0 ? 'grey.3' : hi ? 'yellow.2' : 'grey.6');
      });
      if (s.type !== 'OFF') this.anims[i].draw(ctx, W - 36, y + 33);
      if (s.type === 'CPU') text(ctx, `SKILL ${Math.round(s.skill * 10)}`, 110, y + 24, 'grey.4', { shadow: null });
    });
    const sy = 40 + 4 * 36 + 2;
    const on = this.row === 4;
    fill(ctx, on ? 'red.1' : 'blue.0', W / 2 - 50, sy, 100, 12);
    text(ctx, 'START', W / 2, sy + 3, on ? 'yellow.2' : 'grey.5', { align: 'center' });
    const help = this.editing ? 'TYPE A NAME, ENTER TO FINISH' : this.warn || 'ARROWS MOVE  SPACE CHANGES  X BACK';
    text(ctx, help, W / 2, H - 9, this.warn ? 'lamp.2' : 'grey.6', { align: 'center' });
  }
}

export class PracticeScene extends Scene {
  constructor(game) {
    super(game);
    this.t = 0;
    this.player = makePlayer({ name: 'PLAYER 1', kit: 0, skin: 1 });
    this.menu = new Menu([
      ...EVENTS.map((ev) => ({
        label: `${ev.name}`,
        action: () => {
          const p = makePlayer({ name: this.player.name, kit: this.player.kit, skin: this.player.skin });
          new Competition(game, [p], [ev], { practice: true, onExit: () => game.setScene(new PracticeScene(game)) }).start();
        },
      })),
      { label: 'BACK', action: () => game.setScene(new TitleScene(game)) },
    ]);
  }
  update(dt, input) {
    this.t += dt;
    if (input.wasPressed('b')) { sfx.back(); return this.game.setScene(new TitleScene(this.game)); }
    this.menu.update(input);
  }
  draw(ctx) {
    backdrop(ctx, this.game.time);
    const skillY = 56 + 14 * (EVENTS.length + 1) + 2; // below the last menu row (BACK)
    card(ctx, W / 2 - 110, 30, 220, skillY - 30 + 16, 'PRACTICE');
    this.menu.draw(ctx, W / 2, 56, 14);
    const ev = EVENTS[this.menu.sel];
    if (ev) text(ctx, `SKILL: ${ev.skill}`, W / 2, skillY, 'cyan.2', { align: 'center' });
  }
}
