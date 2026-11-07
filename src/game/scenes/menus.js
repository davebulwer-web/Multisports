// Title, player setup, event selection (choose / practice) and records.
import { Scene } from '../../engine/game.js';
import { Anim } from '../../engine/sprites.js';
import { fill, panel, text, W, H } from '../../engine/gfx.js';
import { textWidth } from '../../engine/font.js';
import { sfx, toggleMute, isMuted } from '../../engine/audio.js';
import { KITS, SKINS } from '../../art/palette.js';
import { backdrop, card, prompt } from '../ui.js';
import { athleteSheet } from '../assets.js';
import { EVENTS } from '../events/index.js';
import { allRecords, getRecord, getRecordHolder } from '../records.js';
import { groupBySeason, allEventsInOrder, toggleEvent, toggleGroup, programmeEvents } from '../programme.js';
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
    const title = () => new TitleScene(game);
    this.menu = new Menu([
      {
        label: `ALL ${EVENTS.length} EVENTS`,
        action: () => game.setScene(new SetupScene(game, { events: allEventsInOrder(EVENTS), onBack: title })),
      },
      { label: 'CHOOSE EVENTS', action: () => game.setScene(new EventPickerScene(game, 'choose')) },
      { label: 'PRACTICE', action: () => game.setScene(new EventPickerScene(game, 'practice')) },
      { label: 'WORLD RECORDS', action: () => game.setScene(new RecordsScene(game)) },
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
    panel(ctx, W / 2 - 80, 78, 160, 78, { bg: 'blue.0', edge: 'blue.2', shadow: 'grey.0' });
    this.menu.draw(ctx, W / 2, 84);
    for (const r of this.runners) r.anim.draw(ctx, r.x, 196);
    // records strip
    const recs = allRecords();
    const i = Math.floor(this.t / 3) % recs.length;
    const rc = recs[i];
    fill(ctx, 'grass.0', 0, 160, W, 11);
    text(ctx, `RECORD  ${rc.ev.name}  ${rc.ev.format(rc.value)}  ${rc.name}`, W / 2, 162, 'cyan.2', { align: 'center' });
    text(ctx, 'ARROWS + SPACE   ENTER TO CONFIRM', W / 2, H - 9, 'grass.3', { align: 'center', shadow: 'grass.0' });
  }
}

const TYPES = ['HUMAN', 'CPU', 'OFF'];

// The line-up is remembered between visits (and used for practice).
let savedSlots = null;

function defaultSlots() {
  return [0, 1, 2, 3].map((i) => ({
    type: i === 0 ? 'HUMAN' : i < 3 ? 'CPU' : 'OFF',
    name: i === 0 ? 'PLAYER 1' : CPU_NAMES[(i * 3) % CPU_NAMES.length],
    kit: [0, 1, 2, 3][i],
    skin: [1, 3, 0, 2][i],
    skill: 0.35 + Math.random() * 0.45,
  }));
}

/** Humans from the last line-up (or a lone PLAYER 1), for practice. */
function practicePlayers() {
  let humans = (savedSlots || []).filter((s) => s.type === 'HUMAN');
  if (!humans.length) humans = defaultSlots().slice(0, 1);
  return humans.map((s) => makePlayer({ name: s.name, kit: s.kit, skin: s.skin }));
}

export class SetupScene extends Scene {
  /** @param {{events: object[], onBack: () => Scene}} opts */
  constructor(game, { events, onBack }) {
    super(game);
    this.t = 0;
    this.events = events;
    this.onBack = onBack;
    savedSlots ||= defaultSlots();
    this.slots = savedSlots;
    this.row = 0;
    this.col = 0; // 0 type, 1 name, 2 kit, 3 skin
    this.editing = false;
    this.anims = [];
    this.slots.forEach((_, i) => this.refresh(i));
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
    if (input.wasPressed('b')) { sfx.back(); return this.game.setScene(this.onBack()); }
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
    const comp = new Competition(this.game, players, this.events, { onExit: () => this.game.setScene(new TitleScene(this.game)) });
    comp.start();
  }

  draw(ctx) {
    backdrop(ctx, this.game.time);
    const n = this.events.length;
    card(ctx, 12, 8, W - 24, 196, n === 1 ? `COMPETITORS - ${this.events[0].name}` : `COMPETITORS - ${n} EVENTS`);
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

// ---------------------------------------------------------------------------
// Event picker: season tabs down the left, your programme (or, in practice,
// how to play) on the right. Works for any number of events and seasons:
// lists scroll, tabs slide, and new events appear under their season.

let savedProgramme = []; // event ids, in running order
const pickerPos = { choose: { tab: 0, row: 0 }, practice: { tab: 0, row: 0 } };

const LIST_X = 14, LIST_W = 192, LIST_Y = 42, ROW = 11;
const SIDE_X = 214, SIDE_W = W - 14 - SIDE_X;

/** Draw season tabs from x to x+w, sliding so the current tab is visible. */
function drawTabs(ctx, groups, cur, x, y, w) {
  const widths = groups.map((g) => textWidth(g.name) + 10);
  let first = 0;
  const span = (a, b) => widths.slice(a, b + 1).reduce((s, v) => s + v + 2, 0);
  while (first < cur && span(first, cur) > w - 16) first++;
  let tx = x + (first > 0 ? 8 : 0);
  if (first > 0) text(ctx, '[', x, y + 2, 'grey.5');
  for (let i = first; i < groups.length; i++) {
    if (tx + widths[i] > x + w - (i < groups.length - 1 ? 8 : 0)) {
      text(ctx, ']', x + w - 6, y + 2, 'grey.5');
      break;
    }
    const g = groups[i], on = i === cur;
    fill(ctx, on ? g.tab : 'blue.1', tx, y - (on ? 1 : 0), widths[i], on ? 12 : 11);
    if (on) fill(ctx, g.color, tx, y - 1, widths[i], 1);
    text(ctx, g.name, tx + 5, y + 2, on ? g.color : 'grey.4');
    tx += widths[i] + 2;
  }
  fill(ctx, groups[cur].tab, x, y + 11, w, 1);
}

/** Simple word wrap for the help text. */
function wrap(str, max) {
  const out = [];
  let line = '';
  for (const word of str.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > max) { out.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

export class EventPickerScene extends Scene {
  /** @param {'choose'|'practice'} mode */
  constructor(game, mode) {
    super(game);
    this.mode = mode;
    this.t = 0;
    this.groups = groupBySeason(EVENTS);
    this.pos = pickerPos[mode];
    this.pos.tab = Math.min(this.pos.tab, this.groups.length - 1);
    this.scroll = 0;
    this.warn = '';
    this.clampRow();
  }

  get choose() { return this.mode === 'choose'; }
  get group() { return this.groups[this.pos.tab]; }
  /** Rows below the event list (choose mode only). */
  get footer() {
    if (!this.choose) return [];
    const ids = this.group.events.map((e) => e.id);
    const all = ids.every((id) => savedProgramme.includes(id));
    return [
      { label: `${all ? 'DROP' : 'ADD'} ALL ${this.group.name}`, act: () => { savedProgramme = toggleGroup(savedProgramme, ids); } },
      { label: 'CLEAR PROGRAMME', act: () => { savedProgramme = []; } },
      { label: 'START >', act: () => this.begin() },
    ];
  }
  get visible() { return this.choose ? 9 : 13; }
  get rowCount() { return this.group.events.length + this.footer.length; }

  clampRow() {
    const n = this.group.events.length;
    // keep the cursor on a footer row when switching tabs, else clamp into the list
    if (this.pos.row >= this.rowCount) this.pos.row = this.rowCount - 1;
    else if (this.pos.row >= n && !this.choose) this.pos.row = n - 1;
    if (this.pos.row < n) {
      if (this.pos.row < this.scroll) this.scroll = this.pos.row;
      if (this.pos.row >= this.scroll + this.visible) this.scroll = this.pos.row - this.visible + 1;
    }
    this.scroll = Math.max(0, Math.min(this.scroll, n - this.visible));
  }

  begin() {
    const events = programmeEvents(savedProgramme, EVENTS);
    if (!events.length) { sfx.bad(); this.warn = 'PICK AT LEAST ONE EVENT'; return; }
    sfx.select();
    this.game.setScene(new SetupScene(this.game, { events, onBack: () => new EventPickerScene(this.game, 'choose') }));
  }

  practise(ev) {
    sfx.select();
    const game = this.game;
    new Competition(game, practicePlayers(), [ev], {
      practice: true,
      onExit: () => game.setScene(new EventPickerScene(game, 'practice')),
    }).start();
  }

  update(dt, input) {
    this.t += dt;
    if (input.wasPressed('b')) { sfx.back(); return this.game.setScene(new TitleScene(this.game)); }
    const tabs = this.groups.length;
    if (input.wasPressed('left')) { this.pos.tab = (this.pos.tab + tabs - 1) % tabs; this.scroll = 0; sfx.blip(); }
    if (input.wasPressed('right')) { this.pos.tab = (this.pos.tab + 1) % tabs; this.scroll = 0; sfx.blip(); }
    if (input.wasPressed('up')) { this.pos.row = (this.pos.row + this.rowCount - 1) % this.rowCount; sfx.blip(); }
    if (input.wasPressed('down')) { this.pos.row = (this.pos.row + 1) % this.rowCount; sfx.blip(); }
    this.clampRow();
    const ev = this.group.events[this.pos.row];
    if (input.wasPressed('a')) {
      this.warn = '';
      if (ev && !this.choose) return this.practise(ev);
      if (ev) { savedProgramme = toggleEvent(savedProgramme, ev.id); sfx.select(); return; }
      const k = this.pos.row - this.group.events.length;
      if (k < this.footer.length - 1) sfx.select(); // START makes its own sound
      this.footer[k].act();
    } else if (input.wasPressed('start')) {
      if (this.choose) this.begin();
      else if (ev) this.practise(ev);
    }
  }

  draw(ctx) {
    backdrop(ctx, this.game.time);
    card(ctx, 8, 6, W - 16, 194, this.choose ? 'CHOOSE YOUR EVENTS' : 'PRACTICE ONE EVENT');
    drawTabs(ctx, this.groups, this.pos.tab, LIST_X, 26, W - 28);
    const g = this.group;
    const n = g.events.length;

    // event list
    g.events.slice(this.scroll, this.scroll + this.visible).forEach((ev, k) => {
      const i = this.scroll + k;
      const y = LIST_Y + k * ROW;
      const on = i === this.pos.row;
      if (on) fill(ctx, 'blue.2', LIST_X, y - 2, LIST_W, ROW);
      let nx = LIST_X + 6;
      if (this.choose) {
        const order = savedProgramme.indexOf(ev.id);
        if (order >= 0) {
          fill(ctx, 'red.1', LIST_X + 3, y - 1, 15, 9);
          text(ctx, `${order + 1}`, LIST_X + 11, y, 'yellow.2', { align: 'center', shadow: null });
        } else {
          fill(ctx, 'grey.3', LIST_X + 3, y - 1, 15, 9);
          fill(ctx, on ? 'blue.2' : 'blue.0', LIST_X + 4, y, 13, 7);
        }
        nx = LIST_X + 24;
      }
      text(ctx, ev.name, nx, y, on ? 'yellow.2' : 'grey.6');
    });
    if (this.scroll > 0) text(ctx, '^', LIST_X + LIST_W - 8, LIST_Y, 'grey.5');
    if (this.scroll + this.visible < n) text(ctx, '~', LIST_X + LIST_W - 8, LIST_Y + (this.visible - 1) * ROW, 'grey.5');

    // footer rows (choose mode)
    const fy = LIST_Y + this.visible * ROW + 4;
    this.footer.forEach((f, k) => {
      const y = fy + k * ROW;
      const on = this.pos.row === n + k;
      const isStart = k === this.footer.length - 1;
      if (on) fill(ctx, isStart ? 'red.1' : 'blue.2', LIST_X, y - 2, LIST_W, ROW);
      text(ctx, f.label, LIST_X + 6, y, on ? 'yellow.2' : isStart ? 'green.2' : 'grey.5');
    });

    // right-hand panel
    fill(ctx, 'blue.1', SIDE_X - 4, LIST_Y - 4, 1, 152);
    const cur = g.events[this.pos.row];
    if (this.choose) this.drawProgramme(ctx);
    else if (cur) {
      text(ctx, cur.name, SIDE_X, LIST_Y, g.color);
      wrap(cur.help.join(' '), Math.floor(SIDE_W / 6)).slice(0, 11)
        .forEach((l, i) => text(ctx, l, SIDE_X, LIST_Y + 14 + i * 9, 'grey.5', { shadow: null }));
    }
    if (cur) {
      const y = LIST_Y + 120;
      fill(ctx, 'blue.1', SIDE_X - 2, y - 4, SIDE_W + 2, 1);
      text(ctx, `SKILL ${cur.skill}`, SIDE_X, y, 'cyan.2');
      text(ctx, `RECORD ${cur.format(getRecord(cur))}`, SIDE_X, y + 10, 'grey.6');
      text(ctx, getRecordHolder(cur), SIDE_X + SIDE_W, y + 20, 'grey.4', { align: 'right' });
    }

    const help = this.warn || (this.choose
      ? '[ ] SEASON  SPACE PICK  ENTER START  X BACK'
      : '[ ] SEASON  ^~ EVENT  SPACE PLAY  X BACK');
    text(ctx, help, W / 2, H - 10, this.warn ? 'lamp.2' : 'grey.6', { align: 'center' });
  }

  drawProgramme(ctx) {
    const list = programmeEvents(savedProgramme, EVENTS);
    text(ctx, 'PROGRAMME', SIDE_X, LIST_Y, 'yellow.2');
    text(ctx, `${list.length}`, SIDE_X + SIDE_W, LIST_Y, 'grey.5', { align: 'right' });
    if (!list.length) {
      ['PICK EVENTS FROM ANY', 'SEASON. THEY RUN IN', 'THE ORDER YOU PICK.']
        .forEach((l, i) => text(ctx, l, SIDE_X, LIST_Y + 16 + i * 10, 'grey.4', { shadow: null }));
      return;
    }
    const seasonOf = (ev) => this.groups.find((gr) => gr.events.includes(ev));
    const max = 10;
    // keep the newest picks in view once the programme outgrows the panel
    const start = Math.max(0, list.length - max);
    if (start) text(ctx, `+${start} ABOVE`, SIDE_X + SIDE_W, LIST_Y + 12, 'grey.4', { align: 'right', shadow: null });
    list.slice(start).forEach((ev, k) => {
      const y = LIST_Y + 12 + (start ? 9 : 0) + k * 9;
      const s = seasonOf(ev);
      fill(ctx, s.tab, SIDE_X, y, 3, 7);
      text(ctx, `${start + k + 1}`.padStart(2, ' '), SIDE_X + 6, y, 'grey.4', { shadow: null });
      text(ctx, ev.name, SIDE_X + 22, y, s.color, { shadow: null });
    });
  }
}

// ---------------------------------------------------------------------------
// World records, one season per tab.

export class RecordsScene extends Scene {
  constructor(game) {
    super(game);
    this.groups = groupBySeason(EVENTS);
    this.tab = 0;
    this.t = 0;
  }
  update(dt, input) {
    this.t += dt;
    const n = this.groups.length;
    if (input.wasPressed('left')) { this.tab = (this.tab + n - 1) % n; sfx.blip(); }
    if (input.wasPressed('right')) { this.tab = (this.tab + 1) % n; sfx.blip(); }
    if (input.wasPressed('b') || (this.t > 0.2 && input.confirm())) {
      sfx.back();
      this.game.setScene(new TitleScene(this.game));
    }
  }
  draw(ctx) {
    backdrop(ctx, this.game.time);
    card(ctx, 8, 6, W - 16, 194, 'WORLD RECORDS');
    drawTabs(ctx, this.groups, this.tab, LIST_X, 26, W - 28);
    const g = this.groups[this.tab];
    text(ctx, 'EVENT', LIST_X + 6, LIST_Y, 'grey.4');
    text(ctx, 'RECORD', 250, LIST_Y, 'grey.4', { align: 'right' });
    text(ctx, 'HOLDER', 264, LIST_Y, 'grey.4');
    g.events.slice(0, 13).forEach((ev, i) => {
      const y = LIST_Y + 14 + i * 11;
      if (i % 2) fill(ctx, 'blue.1', LIST_X, y - 2, W - 28, ROW);
      text(ctx, ev.name, LIST_X + 6, y, g.color);
      text(ctx, ev.format(getRecord(ev)), 250, y, 'grey.6', { align: 'right' });
      text(ctx, getRecordHolder(ev), 264, y, 'cyan.2');
    });
    text(ctx, '[ ] SEASON   X BACK', W / 2, H - 10, 'grey.6', { align: 'center' });
  }
}
