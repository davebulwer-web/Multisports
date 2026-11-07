// Registry of every built-in sprite sheet. The game and the export tool both
// read this list; add a new baker here and it shows up everywhere.
import { bakeAthlete } from './athlete.js';
import { bakeProps } from './props.js';
import { bakeScenery } from './scenery.js';
import { bakeBoards } from './boards.js';

export const SHEETS = {
  athlete: { bake: bakeAthlete, recolour: true },
  props: { bake: bakeProps, recolour: false },
  scenery: { bake: bakeScenery, recolour: false },
  boards: { bake: bakeBoards, recolour: false },
};
