// Original chiptune tunes. Written for Multisports; each track is a string of
// eighth-note steps: a note (C5, F#4), '-' to hold, '.' for a rest, or a drum
// hit ('k' kick, 's' snare, 'h' hat).

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C5 - E5 .' -> [72, null, 76, 0] */
export function parseSteps(str) {
  return str.trim().split(/\s+/).map((tok) => {
    if (tok === '-') return null;
    if (tok === '.') return 0;
    if (/^[ksh]$/.test(tok)) return tok;
    const m = /^([A-G])(#|b)?(\d)$/.exec(tok);
    if (!m) throw new Error(`bad note ${tok}`);
    return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  });
}

// "Torchlight March": a stately fanfare in C for the opening ceremony.
// 16 bars of 4/4 in eighth notes (8 steps a bar).
const LEAD = `
  C5 - - G4 C5 - E5 -    G5 - - - - - . .
  A5 - G5 - E5 - C5 -    D5 - - - - - . .
  E5 - F5 - G5 - A5 -    G5 - E5 - C5 - E5 -
  D5 - C5 - B4 - D5 -    C5 - - - - - . .
  F5 - F5 - A5 - F5 -    E5 - E5 - G5 - E5 -
  D5 - E5 - F5 - D5 -    G5 - - - - - G4 -
  C5 - E5 - G5 - C6 -    B5 - A5 - G5 - E5 -
  F5 - D5 - B4 - D5 -    C5 - - - C5 . . .
`;
const HARMONY = `
  E4 - - . E4 - G4 -     B4 - - - - - . .
  F4 - E4 - C4 - A4 -    B4 - - - - - . .
  C5 - D5 - E5 - F5 -    E5 - C5 - G4 - C5 -
  B4 - A4 - G4 - B4 -    E4 - - - - - . .
  A4 - A4 - C5 - A4 -    G4 - G4 - E5 - C5 -
  B4 - C5 - D5 - B4 -    D5 - - - - - . .
  E4 - G4 - E5 - G5 -    G5 - E5 - E5 - C5 -
  A4 - B4 - G4 - B4 -    E4 - - - E4 . . .
`;
// One chord root per bar; the bass walks root / fifth / octave / fifth.
const ROOTS = ['C3', 'C3', 'F2', 'G2', 'C3', 'C3', 'G2', 'C3', 'F2', 'C3', 'G2', 'G2', 'C3', 'E2', 'G2', 'C3'];
const fifth = { C3: 'G2', F2: 'C3', G2: 'D3', E2: 'B2' };
const octave = { C3: 'C4', F2: 'F3', G2: 'G3', E2: 'E3' };
const BASS = ROOTS.map((r, i) => (i === ROOTS.length - 1
  ? `${r} - - - ${r} . . .`
  : `${r} . ${fifth[r]} . ${octave[r]} . ${fifth[r]} .`)).join(' ');
const DRUMS = ROOTS.map((_, i) => (i % 4 === 3
  ? 'k h s h k s s s'          // march roll into each phrase
  : 'k h s h k h s h')).join(' ');

export const TORCHLIGHT_MARCH = {
  bpm: 112,
  stepsPerBeat: 2,
  loop: true,
  tracks: [
    { wave: 'square', vol: 0.32, steps: parseSteps(LEAD) },
    { wave: 'square', vol: 0.12, steps: parseSteps(HARMONY) },
    { wave: 'triangle', vol: 0.55, steps: parseSteps(BASS) },
    { vol: 0.35, steps: parseSteps(DRUMS) },
  ],
};
