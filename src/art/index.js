// Registry of every built-in sprite sheet. The game and the export tool both
// read this list; add a new baker here and it shows up everywhere.
import { bakeAthlete } from './athlete.js';
import { bakeProps } from './props.js';

export const SHEETS = {
  athlete: { bake: bakeAthlete, recolour: true },
  props: { bake: bakeProps, recolour: false },
};
