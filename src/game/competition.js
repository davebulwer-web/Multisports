// Runs a competition: for each event, every human takes a turn (hot-seat),
// CPU rivals get simulated results, then points/medals are awarded.
import { EVENTS } from './events/index.js';
import { reshuffleBoards } from './boards.js';
import { rankResults } from './sim/scoring.js';
import { makeRng } from './sim/rng.js';
import { getRecord, submitRecord } from './records.js';
import { CardScene, ResultsScene, StandingsScene, PodiumScene } from './scenes/cards.js';

export const CPU_NAMES = ['ACE', 'BLAZE', 'DYNAMO', 'ROCKET', 'VIPER', 'TITAN', 'COMET', 'FLASH'];

export function makePlayer({ name, kit, skin, cpu = false, skill = 0.6 }) {
  return { name, kit, skin, cpu, skill, points: 0, golds: 0, silvers: 0, bronzes: 0, results: {} };
}

export class Competition {
  /**
   * @param {import('../engine/game.js').Game} game
   * @param {object[]} players from makePlayer
   * @param {object[]} events subset of EVENTS
   * @param {{practice?:boolean, onExit:()=>void}} opts
   */
  constructor(game, players, events = EVENTS, opts) {
    this.game = game;
    this.players = players;
    this.events = events;
    this.opts = opts;
    this.eventIdx = -1;
    this.rng = makeRng();
  }

  get event() { return this.events[this.eventIdx]; }
  get humans() { return this.players.filter((p) => !p.cpu); }

  start() { this.nextEvent(); }

  nextEvent() {
    this.eventIdx++;
    reshuffleBoards();
    if (this.eventIdx >= this.events.length) {
      if (this.opts.practice) return this.opts.onExit();
      return this.game.setScene(new PodiumScene(this.game, this));
    }
    const ev = this.event;
    this.values = new Map();
    for (const p of this.players) if (p.cpu) this.values.set(p, ev.cpu(p.skill, this.rng));
    this.turn = 0;
    const lines = [`SKILL: ${ev.skill}`, '', ...ev.help, '', `RECORD ${ev.format(getRecord(ev))}`];
    const title = this.opts.practice ? `PRACTICE - ${ev.name}` : `EVENT ${this.eventIdx + 1} OF ${this.events.length}: ${ev.name}`;
    this.game.setScene(new CardScene(this.game, title, lines, () => this.nextTurn()));
  }

  nextTurn() {
    const humans = this.humans;
    if (this.turn >= humans.length) return this.finishEvent();
    const p = humans[this.turn];
    const ev = this.event;
    const go = () => {
      const cpus = this.players.filter((q) => q.cpu);
      const pacers = ev.id === 'sprint'
        ? (cpus.length
            ? cpus.slice(0, 3).map((q) => ({ player: q, time: this.values.get(q) ?? 13 }))
            : [{ player: { name: 'RECORD', kit: 7, skin: 2 }, time: getRecord(ev) }, { player: { name: 'PACER', kit: 2, skin: 3 }, time: 12.2 }])
        : [];
      this.game.setScene(new ev.Scene(this.game, {
        player: p,
        pacers,
        record: getRecord(ev),
        onDone: (value) => {
          this.values.set(p, value);
          submitRecord(ev, value, p.name);
          this.turn++;
          this.nextTurn();
        },
      }));
    };
    if (humans.length === 1) return go();
    this.game.setScene(new CardScene(this.game, ev.name, ['', `${p.name}`, '', 'GET READY!'], go, { big: true }));
  }

  finishEvent() {
    const ev = this.event;
    const ranked = rankResults(this.players.map((p) => ({ id: p, value: this.values.get(p) ?? null })), ev.better);
    for (const r of ranked) {
      const p = r.id;
      p.results[ev.id] = r.value;
      if (this.opts.practice) continue;
      p.points += r.points;
      if (r.place === 1) p.golds++;
      else if (r.place === 2) p.silvers++;
      else if (r.place === 3) p.bronzes++;
    }
    this.game.setScene(new ResultsScene(this.game, ev, ranked, () => {
      if (this.opts.practice || this.eventIdx === this.events.length - 1) return this.nextEvent();
      this.game.setScene(new StandingsScene(this.game, this, () => this.nextEvent()));
    }, { practice: this.opts.practice }));
  }
}
