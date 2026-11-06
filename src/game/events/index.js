// Event registry. Add a new event by writing a Scene + sim module and
// listing it here; menus, competition flow and scoring pick it up.
import { SprintScene } from './sprint.js';
import { JavelinScene } from './javelin.js';
import { WeightliftingScene } from './weightlifting.js';
import { ArcheryScene } from './archery.js';
import { ClayScene } from './clay.js';
import { SkiJumpScene } from './skijump.js';
import { BiathlonScene } from './biathlon.js';
import { cpuSprint } from '../sim/sprint.js';
import { cpuJavelin } from '../sim/javelin.js';
import { cpuLift } from '../sim/lift.js';
import { cpuArchery } from '../sim/archery.js';
import { cpuClay, totalClays } from '../sim/clay.js';
import { cpuSki } from '../sim/ski.js';
import { cpuBiathlon, fmtRace } from '../sim/biathlon.js';
import { fmtTime, fmtDist, fmtKg, fmtPts, fmtClays } from '../hud.js';

export const EVENTS = [
  {
    id: 'sprint',
    name: '100M SPRINT',
    skill: 'RHYTHM',
    better: 'lower',
    format: fmtTime,
    cpu: cpuSprint,
    Scene: SprintScene,
    baseRecord: 10.6,
    help: [
      'WAIT FOR THE GUN. GO EARLY TWICE AND YOU ARE OUT.',
      'STRIDE WITH [ AND ] IN TURN.',
      'PRESS ON THE BEAT: WATCH THE BAR, LISTEN FOR THE TICK.',
      'THE BEAT GETS FASTER AS YOU DO.',
      'RUSHING OR USING THE SAME FOOT TWICE SLOWS YOU.',
    ],
  },
  {
    id: 'javelin',
    name: 'JAVELIN',
    skill: 'POWER + ANGLE',
    better: 'higher',
    format: fmtDist,
    cpu: cpuJavelin,
    Scene: JavelinScene,
    baseRecord: 84,
    help: [
      'HOLD SPACE TO RUN UP. MORE SPEED = MORE DISTANCE.',
      'LET GO TO PLANT. YOU SLIDE ON A LITTLE AFTERWARDS,',
      'SO PLANT JUST SHORT OF THE RED LINE.',
      'PRESS SPACE AGAIN TO SET THE RELEASE ANGLE.',
      'TOO FLAT AND THE TIP WON\'T LAND FIRST. 3 THROWS.',
    ],
  },
  {
    id: 'lift',
    name: 'WEIGHTLIFTING',
    skill: 'TIMING + BALANCE',
    better: 'higher',
    format: fmtKg,
    cpu: cpuLift,
    Scene: WeightliftingScene,
    baseRecord: 215,
    help: [
      'PICK A WEIGHT. HEAVIER = TIGHTER WINDOWS.',
      'CLEAN: PRESS SPACE AT THE TOP OF THE PULL.',
      'JERK: PRESS SPACE IN THE DRIVE ZONE.',
      'HOLD: USE [ ] TO KEEP THE BAR CENTRED FOR 3 SECONDS.',
      '2 OF 3 WHITE LIGHTS IS A GOOD LIFT. 3 ATTEMPTS.',
    ],
  },
  {
    id: 'archery',
    name: 'ARCHERY',
    skill: 'FINE CONTROL',
    better: 'higher',
    format: fmtPts,
    cpu: cpuArchery,
    Scene: ArcheryScene,
    baseRecord: 57,
    help: [
      'HOLD SPACE TO DRAW THE BOW. KEEP HOLDING TO AIM.',
      'THE SIGHT SWAYS AS YOU BREATHE: STEER WITH ARROWS.',
      'SMALL NUDGES. THE SIGHT HAS MOMENTUM.',
      'AIM OFF INTO THE WIND. LET GO OF SPACE TO SHOOT.',
      'HOLD TOO LONG AND YOUR ARMS SHAKE. 6 ARROWS.',
    ],
  },
  {
    id: 'clay',
    name: 'CLAY PIGEON',
    skill: 'REACTION + TRACKING',
    better: 'higher',
    format: fmtClays,
    cpu: cpuClay,
    Scene: ClayScene,
    baseRecord: totalClays() - 1,
    help: [
      'PRESS SPACE TO CALL PULL. THE CLAY COMES FROM',
      'THE LEFT OR RIGHT TRAP. SWING AFTER IT WITH ARROWS.',
      'THE SHOT TAKES TIME TO ARRIVE: AIM AHEAD OF THE CLAY,',
      'FURTHER AHEAD THE FURTHER AWAY IT IS. SPACE FIRES.',
      '6 SINGLES THEN 3 DOUBLES. 2 SHELLS EACH ROUND.',
    ],
  },
  {
    id: 'skijump',
    name: 'SKI JUMP',
    skill: 'TIMING + BALANCE',
    better: 'higher',
    format: fmtPts,
    cpu: cpuSki,
    Scene: SkiJumpScene,
    baseRecord: 285,
    help: [
      'SPACE TO PUSH OFF. HOLD DOWN TO TUCK FOR SPEED.',
      'PRESS SPACE RIGHT ON THE LIP TO SPRING.',
      'IN THE AIR, KEEP YOUR LEAN IN THE GREEN WITH [ ].',
      'PRESS SPACE JUST BEFORE TOUCHDOWN TO TELEMARK.',
      'TOO EARLY KILLS YOUR LIFT. 2 JUMPS: DISTANCE + STYLE.',
    ],
  },
  {
    id: 'biathlon',
    name: 'BIATHLON',
    skill: 'PACING + STEADY AIM',
    better: 'lower',
    format: fmtRace,
    cpu: cpuBiathlon,
    Scene: BiathlonScene,
    baseRecord: 95,
    help: [
      'HOLD ] TO PUSH ON THE SKIS. WATCH YOUR HEART RATE:',
      'IN THE RED YOU BURN OUT AND SLOW DOWN.',
      'AT THE RANGE, AIM WITH ARROWS AND FIRE WITH SPACE.',
      'BREATHING AND HEARTBEAT SHAKE THE SIGHT. WAIT TO CALM.',
      'PRONE THEN STANDING. EACH MISS ADDS 10 SECONDS.',
    ],
  },
];

export const eventById = (id) => EVENTS.find((e) => e.id === id);
