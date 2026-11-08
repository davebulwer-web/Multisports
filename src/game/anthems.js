// National anthems as short chiptune clips, for the medal podium and the
// line-up screen. Only melodies that are long out of copyright are used (all
// were composed before 1900); a nation whose anthem is still in copyright, or
// that we haven't transcribed yet, gets an original victory fanfare instead.
//
// Notation: whitespace-separated `NOTE/LEN` tokens, where LEN is in sixteenth
// notes and NOTE is like C5, F#4, Bb3, or r for a rest. `|` marks a bar line.
// A first bar shorter than the metre is a pickup (anacrusis).
// No DOM code here (shared with Node tests).

import { parseSteps } from './music.js';

/** 'G4/4 r/2 | C5/2' -> [{note:'G4', len:4}, {note:'r', len:2}, '|', ...] */
export function parseTokens(str) {
  return str.trim().split(/\s+/).map((tok) => {
    if (tok === '|') return '|';
    const m = /^(r|[A-G](?:#|b)?\d)\/(\d+)$/.exec(tok);
    if (!m) throw new Error(`bad token ${tok}`);
    return { note: m[1], len: Number(m[2]) };
  });
}

/** Tokens -> sixteenth-note steps in the tracker's format (note, then holds). */
export function toSteps(str) {
  const out = [];
  for (const t of parseTokens(str)) {
    if (t === '|') continue;
    const head = t.note === 'r' ? 0 : parseSteps(t.note)[0];
    out.push(head);
    for (let i = 1; i < t.len; i++) out.push(t.note === 'r' ? 0 : null);
  }
  return out;
}

/** Lengths of each bar (sixteenths), for checking a transcription adds up. */
export function barLengths(str) {
  const bars = [0];
  for (const t of parseTokens(str)) {
    if (t === '|') bars.push(0);
    else bars[bars.length - 1] += t.len;
  }
  if (bars[bars.length - 1] === 0) bars.pop();
  return bars;
}

// ---------------------------------------------------------------------------
// The anthems. `beats` is the metre (crotchets per bar), `short` how many
// sixteenths the line-up screen plays (the opening phrase). Where a clip skips
// part of the anthem, `bars` says which ones it keeps.

export const ANTHEMS = {
  GBR: {
    title: 'GOD SAVE THE KING', composer: 'Traditional, c. 1745', bpm: 92, beats: 3, short: 72,
    lead: `G4/4 G4/4 A4/4 | F#4/6 G4/2 A4/4 | B4/4 B4/4 C5/4 | B4/6 A4/2 G4/4 | A4/4 G4/4 F#4/4 | G4/12 |
           D5/4 D5/4 D5/4 | D5/6 C5/2 B4/4 | C5/4 C5/4 C5/4 | C5/6 B4/2 A4/4 | B4/4 C5/2 B4/2 A4/2 G4/2 | B4/6 C5/2 D5/4 | E5/2 C5/2 B4/4 A4/4 | G4/12`,
    bass: `G2/4 B2/4 C3/4 | D3/8 D2/4 | G2/4 E2/4 C2/4 | D2/8 E2/4 | C2/4 D2/8 | G2/12 |
           G2/4 F#2/4 G2/4 | D2/8 G2/4 | C3/4 B2/4 A2/4 | D3/8 D2/4 | G2/4 A2/2 G2/2 F#2/2 E2/2 | D2/8 B2/4 | C3/4 D3/4 D2/4 | G2/12`,
  },
  USA: {
    title: 'THE STAR-SPANGLED BANNER', composer: 'John Stafford Smith, 1773', bpm: 100, beats: 3, short: 52,
    lead: `G4/3 E4/1 | C4/4 E4/4 G4/4 | C5/8 E5/3 D5/1 | C5/4 E4/4 F#4/4 | G4/8 G4/2 G4/2 |
           E5/6 D5/2 C5/4 | B4/8 A4/2 B4/2 | C5/4 C5/4 G4/4 | E4/4 C4/8`,
    bass: `G2/4 | C3/8 B2/4 | A2/8 G#2/4 | A2/4 C3/4 D3/4 | G2/12 |
           C3/12 | G2/8 A2/4 | E2/4 F2/4 G2/4 | C2/12`,
  },
  FRA: {
    title: 'LA MARSEILLAISE', composer: 'Rouget de Lisle, 1792', bpm: 112, beats: 4, short: 76,
    lead: `D4/3 D4/1 | G4/4 G4/4 A4/4 A4/4 | D5/6 B4/2 G4/3 G4/1 B4/3 G4/1 | E4/4 C5/8 A4/3 F#4/1 | G4/8 r/4 D4/3 D4/1 |
           G4/4 G4/4 A4/4 A4/4 | D5/6 B4/2 G4/3 G4/1 B4/3 G4/1 | E4/4 C5/8 A4/3 F#4/1 | G4/16`,
    bass: `D2/4 | G2/4 B2/4 D2/4 C2/4 | G2/16 | C2/4 A2/4 D2/8 | G2/8 r/4 D2/4 |
           G2/4 B2/4 D2/4 C2/4 | G2/16 | C2/4 A2/4 D2/8 | G2/16`,
  },
  GER: {
    title: 'LIED DER DEUTSCHEN', composer: 'Joseph Haydn, 1797', bpm: 88, beats: 4, short: 64, bars: '1-4, 13-16',
    lead: `Eb4/6 F4/2 G4/4 F4/4 | Ab4/4 G4/4 F4/2 D4/2 Eb4/4 | C5/4 Bb4/4 Ab4/4 G4/4 | F4/4 G4/2 Eb4/2 Bb4/8 |
           Eb5/6 D5/2 D5/2 C5/2 Bb4/4 | C5/6 Bb4/2 Bb4/2 Ab4/2 G4/4 | F4/4 G4/2 Ab4/2 Bb4/2 C5/2 Ab4/2 F4/2 | Eb4/4 G4/2 F4/2 Eb4/8`,
    bass: `Eb2/8 Eb2/4 Bb2/4 | D2/4 Eb2/4 Bb2/4 Eb2/4 | Ab2/4 Eb2/4 F2/4 Eb2/4 | Ab2/4 A2/4 Bb2/8 |
           G2/4 G2/4 Ab2/4 Eb2/4 | Ab2/8 Bb2/4 Eb2/4 | Ab2/8 G2/4 Ab2/4 | Bb2/8 Eb2/8`,
  },
  ITA: {
    title: 'IL CANTO DEGLI ITALIANI', composer: 'Michele Novaro, 1847', bpm: 112, beats: 4, short: 64,
    lead: `F4/4 F4/3 G4/1 | F4/8 D5/4 D5/3 Eb5/1 | D5/8 D5/4 F5/3 Eb5/1 | D5/8 C5/4 D5/3 C5/1 | Bb4/8 F4/4 F4/3 G4/1 |
           F4/8 D5/4 D5/3 Eb5/1 | D5/8 D5/4 F5/3 Eb5/1 | D5/8 C5/4 D5/3 C5/1 | Bb4/16`,
    bass: `Bb2/8 | Bb2/8 F2/8 | Bb2/8 F2/8 | Bb2/8 F2/8 | Bb2/8 F2/8 |
           Bb2/8 F2/8 | Bb2/8 F2/8 | Bb2/8 F2/8 | Bb2/16`,
  },
  NED: {
    title: 'HET WILHELMUS', composer: 'Traditional, c. 1570', bpm: 96, beats: 4, short: 60,
    lead: `D4/4 | G4/4 G4/4 A4/2 B4/2 C5/2 A4/2 | B4/4 A4/2 B4/2 C5/4 B4/4 | A4/2 G4/2 A4/4 G4/8 | G4/8 D4/4 G4/4 |
           G4/4 A4/2 B4/2 C5/2 A4/2 B4/4 | A4/2 B4/2 C5/4 B4/4 A4/2 G4/2 | A4/4 G4/12`,
    bass: `D2/4 | G2/4 E2/4 C2/4 D2/4 | G2/4 F#2/4 E2/4 D2/4 | C2/4 D2/4 G2/8 | G2/8 D2/4 G2/4 |
           E2/4 C2/4 D2/4 G2/4 | F#2/4 E2/4 D2/4 C2/4 | D2/4 G2/12`,
  },
  AUT: {
    title: 'LAND DER BERGE, LAND AM STROME', composer: 'Attrib. W. A. Mozart, 1791', bpm: 92, beats: 3, short: 48,
    lead: `Bb4/8 Ab4/4 | G4/8 Ab4/2 Bb4/2 | C5/8 Bb4/4 | Bb4/4 Ab4/8 | Ab4/8 G4/4 | F4/8 G4/2 Ab4/2 | Bb4/8 Ab4/4 | Ab4/2 G4/2 G4/8 |
           A4/8 Bb4/4 | C5/8 D5/4 | Eb5/4 C5/4 A4/4 | Bb4/12`,
    bass: `Eb2/12 | Eb2/12 | Ab2/8 Bb2/4 | F2/12 | Bb2/12 | Bb2/12 | Bb2/12 | Eb2/12 |
           F2/12 | F2/8 Bb2/4 | Eb2/8 F2/4 | Bb2/12`,
  },
  ESP: {
    title: 'MARCHA REAL', composer: 'Traditional, 1761', bpm: 112, beats: 4, short: 64,
    lead: `C5/4 G4/4 E5/4 C5/2 G5/2 | F5/2 E5/2 D5/2 C5/2 C5/2 B4/2 A4/2 G4/2 | C5/4 D5/4 E5/6 G5/2 | F5/2 E5/2 D5/2 C5/2 G5/8 |
           G5/4 E5/3 G5/1 F5/4 D5/3 F5/1 | E5/4 C5/3 E5/1 D5/2 G4/2 A4/2 B4/2 | C5/4 D5/4 E5/3 F5/1 G5/2 F5/2 | E5/4 D5/4 C5/8`,
    bass: `C3/16 | F2/8 G2/8 | C3/4 G2/4 C3/4 B2/4 | A2/8 G2/8 |
           C3/8 G2/8 | C3/4 C3/4 G2/4 A2/4 | C3/4 B2/4 A2/4 F2/4 | G2/8 C2/8`,
  },
  POL: {
    title: 'MAZUREK DABROWSKIEGO', composer: 'Traditional mazurka, 1797', bpm: 120, beats: 3, short: 48,
    lead: `A4/3 Bb4/1 | C5/4 C5/4 C5/3 A4/1 | D5/2 C5/2 Bb4/2 A4/2 G4/3 G4/1 | C5/6 Bb4/2 Bb4/4 | A4/8 A4/3 Bb4/1 |
           C5/4 C5/4 C5/3 A4/1 | D5/2 C5/2 Bb4/2 A4/2 G4/3 G4/1 | C5/6 E4/2 G4/4 | F4/8 r/4`,
    bass: `C3/4 | F2/12 | Bb2/8 C3/4 | C3/12 | F2/12 |
           F2/12 | Bb2/8 C3/4 | C3/12 | F2/8 r/4`,
  },
  NOR: {
    title: 'JA, VI ELSKER', composer: 'Rikard Nordraak, 1864', bpm: 104, beats: 4, short: 64,
    lead: `F4/6 Eb4/2 D4/4 C4/4 | Bb3/4 C4/4 D4/4 Eb4/4 | F4/6 G4/2 F4/4 Eb4/4 | D4/16 |
           G4/6 F4/2 Eb4/4 D4/4 | C4/4 D4/4 Eb4/4 F4/4 | F4/6 G4/2 G4/4 A4/4 | Bb4/16`,
    bass: `F2/8 D2/4 C2/4 | Bb2/4 F2/4 Bb2/4 G2/4 | F2/8 F2/8 | Bb2/16 |
           G2/8 Eb2/4 D2/4 | C2/4 G2/4 C3/4 A2/4 | Bb2/8 Eb2/4 F2/4 | Bb2/16`,
  },
  DEN: {
    title: 'DER ER ET YNDIGT LAND', composer: 'Hans Ernst Kroyer, 1835', bpm: 100, beats: 4, short: 66,
    lead: `D4/2 | A4/6 A4/2 F#4/4 D4/4 | B4/14 D4/2 | D5/6 D5/2 C#5/4 B4/4 | B4/4 A4/12 |
           C#4/6 C#4/2 D4/4 E4/4 | F#4/4 G#4/4 A4/4 B4/4 | A4/8 G#4/8 | A4/16`,
    bass: `D2/2 | D2/16 | G2/16 | B2/8 A2/4 G2/4 | E2/4 A2/12 |
           A2/16 | D2/8 E2/8 | E2/16 | A2/16`,
  },
  CAN: {
    title: 'O CANADA', composer: 'Calixa Lavallee, 1880', bpm: 96, beats: 4, short: 64, bars: '1-4, last 4',
    lead: `G4/8 Bb4/6 Bb4/2 | Eb4/12 F4/4 | G4/4 Ab4/4 Bb4/4 C5/4 | F4/16 |
           Bb4/8 Eb5/6 Eb5/2 | C5/4 Ab4/4 G4/4 F4/4 | Bb4/8 D4/8 | Eb4/16`,
    bass: `Eb2/8 D2/8 | C2/4 G2/4 C3/4 Bb2/4 | Eb2/4 F2/4 G2/4 Ab2/4 | Bb2/16 |
           G2/8 G2/8 | Ab2/4 F2/4 G2/4 Ab2/4 | Bb2/8 Bb2/8 | Eb2/16`,
  },
  JPN: {
    title: 'KIMIGAYO', composer: 'Hayashi Hiromori, 1880', bpm: 72, beats: 4, short: 32, bars: '1-2, 9-11',
    lead: `D4/4 C4/4 D4/4 E4/4 | G4/4 E4/4 D4/8 |
           A4/4 C5/4 D5/8 | C5/4 D5/4 A4/4 G4/4 | A4/4 G4/2 E4/2 D4/8`,
    bass: `D2/4 C2/4 D2/4 E2/4 | G2/4 E2/4 D2/8 |
           F2/8 D2/8 | A2/4 D2/4 A2/4 G2/4 | A2/4 G2/4 D2/8`,
  },
  AUS: {
    title: 'ADVANCE AUSTRALIA FAIR', composer: 'Peter Dodds McCormick, 1878', bpm: 100, beats: 4, short: 64, bars: '1-8, last 2',
    lead: `G4/4 | C5/4 G4/4 E4/4 G4/4 | C5/6 C5/2 C5/4 E5/4 | D5/4 C5/4 B4/4 C5/4 | D5/12 G4/4 |
           C5/4 G4/4 E4/4 C4/4 | G4/6 G4/2 G4/4 E5/4 | D5/4 C5/4 B4/4 A4/4 | G4/12 C5/4 |
           E5/6 C5/2 D5/4 D5/2 B4/2 | C5/16`,
    bass: `G2/4 | C2/4 G2/4 E2/4 G2/4 | C2/4 C3/4 C2/4 E2/4 | G2/16 | G2/12 G2/4 |
           C2/4 G2/4 E2/4 C2/4 | G2/8 G2/4 C2/4 | D2/16 | G2/12 C3/4 |
           C3/8 G2/8 | C2/16`,
  },
};

// Nations whose anthem gets an original fanfare, and why.
export const FANFARE_REASONS = {
  CHN: 'March of the Volunteers (1935): copyright status unclear',
  JAM: 'Jamaica, Land We Love (1962): still in copyright',
  KEN: 'Ee Mungu Nguvu Yetu (1963): arrangement still in copyright',
  IRL: 'public domain, not transcribed yet',
  BEL: 'public domain, not transcribed yet',
  SWE: 'public domain, not transcribed yet',
  FIN: 'public domain, not transcribed yet',
  SUI: 'public domain, not transcribed yet',
  GRE: 'public domain, not transcribed yet',
  BRA: 'public domain, not transcribed yet',
};

// ---------------------------------------------------------------------------
// Original victory fanfares (written for Multisports). Each nation gets its own
// key and phrase order from its code, so no two sound quite the same.

const FANFARE_PHRASES = [
  // [lead, bass] in C; each is one 4/4 bar.
  ['C4/2 C4/2 G4/4 E4/2 G4/2 C5/4', 'C2/8 C3/8'],
  ['C5/2 C5/2 B4/2 C5/2 D5/4 G4/4', 'A2/8 G2/8'],
  ['E5/3 D5/1 C5/4 G4/3 A4/1 B4/4', 'C3/4 E2/4 G2/8'],
  ['A4/2 B4/2 C5/2 D5/2 E5/4 C5/4', 'F2/8 C3/8'],
  ['F5/3 E5/1 D5/4 B4/3 C5/1 D5/4', 'D3/8 G2/8'],
  ['G4/2 C5/2 E5/2 G5/2 E5/4 C5/4', 'C3/8 C2/8'],
];
const ENDING = ['D5/4 B4/4 G4/2 A4/2 B4/4 | C5/12 r/4', 'G2/8 G2/8 | C2/12 r/4'];

function codeSeed(code) {
  let h = 7;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Shift every note in a token string by `semis` semitones. */
export function transpose(str, semis) {
  const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  return str.replace(/([A-G])(#|b)?(\d)\//g, (_, l, acc, oct) => {
    const midi = parseSteps(`${l}${acc || ''}${oct}`)[0] + semis;
    return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}/`;
  });
}

export function fanfareFor(code) {
  const h = codeSeed(code);
  const pick = [h % 6, (h >> 3) % 6, (h >> 6) % 6];
  if (pick[1] === pick[0]) pick[1] = (pick[1] + 1) % 6;
  const key = [0, 2, -3, 5, -2, 3][(h >> 9) % 6];
  const lead = [...pick.map((i) => FANFARE_PHRASES[i][0]), ENDING[0]].join(' | ');
  const bass = [...pick.map((i) => FANFARE_PHRASES[i][1]), ENDING[1]].join(' | ');
  return {
    title: 'VICTORY FANFARE', composer: 'Original', fanfare: true, bpm: 120, beats: 4, short: 32,
    lead: transpose(lead, key), bass: transpose(bass, key),
  };
}

/** The anthem (or fanfare) for a nation code. */
export function anthemFor(code) {
  return ANTHEMS[code] || fanfareFor(code);
}

/**
 * A playSong() song for a nation. `short` keeps just the opening phrase, for
 * the line-up screen; otherwise it's the full podium clip.
 */
export function anthemSong(code, { short = false } = {}) {
  const a = anthemFor(code);
  let lead = toSteps(a.lead);
  let bass = toSteps(a.bass);
  if (short) { lead = lead.slice(0, a.short); bass = bass.slice(0, a.short); }
  // A kettle-drum kick on each downbeat (after any pickup), and a roll into
  // the final note.
  const bar = a.beats * 4;
  const pickup = barLengths(a.lead)[0] % bar;
  const drums = lead.map((_, i) => ((i - pickup) % bar === 0 && i >= pickup ? 'k' : 0));
  if (!short) for (let i = Math.max(0, lead.length - bar - 4); i < lead.length - bar; i += 1) drums[i] = 's';
  return {
    bpm: a.bpm,
    stepsPerBeat: 4,
    loop: false,
    tracks: [
      { wave: 'square', vol: 0.3, steps: lead },
      { wave: 'triangle', vol: 0.55, steps: bass },
      { vol: 0.25, steps: drums },
    ],
  };
}

/** Length of a nation's clip in seconds. */
export function anthemSeconds(code, { short = false } = {}) {
  const a = anthemFor(code);
  const steps = short ? a.short : toSteps(a.lead).length;
  return (steps * 60) / a.bpm / 4;
}
