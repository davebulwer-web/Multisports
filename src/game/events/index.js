// Event registry. Add a new event by writing a Scene + sim module and
// listing it here; menus, competition flow and scoring pick it up.
import { SprintScene } from './sprint.js';
import { JavelinScene } from './javelin.js';
import { WeightliftingScene } from './weightlifting.js';
import { ArcheryScene } from './archery.js';
import { ClayScene } from './clay.js';
import { SkiJumpScene } from './skijump.js';
import { BiathlonScene } from './biathlon.js';
import { CurlingScene } from './curling.js';
import { BobsleighScene } from './bobsleigh.js';
import { CaberScene } from './caber.js';
import { CliffDiveScene } from './cliffdive.js';
import { FootbagScene } from './footbag.js';
import { SurfScene } from './surfing.js';
import { HalfPipeScene } from './halfpipe.js';
import { cpuSprint } from '../sim/sprint.js';
import { cpuJavelin } from '../sim/javelin.js';
import { cpuLift } from '../sim/lift.js';
import { cpuArchery } from '../sim/archery.js';
import { cpuClay, totalClays } from '../sim/clay.js';
import { cpuSki } from '../sim/ski.js';
import { cpuBiathlon, fmtRace } from '../sim/biathlon.js';
import { cpuCurling, maxScore } from '../sim/curling.js';
import { cpuBob, fmtBob } from '../sim/bob.js';
import { cpuCaber } from '../sim/caber.js';
import { cpuDive } from '../sim/dive.js';
import { cpuFootbag } from '../sim/footbag.js';
import { cpuSurf } from '../sim/surf.js';
import { cpuPipe } from '../sim/halfpipe.js';
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
  {
    id: 'curling',
    name: 'CURLING',
    skill: 'JUDGEMENT + SWEEPING',
    better: 'higher',
    format: fmtPts,
    cpu: cpuCurling,
    Scene: CurlingScene,
    baseRecord: 26,
    help: [
      'UP/DOWN MOVES YOUR BROOM. [ ] PICKS THE CURL.',
      'SPACE, THEN SPACE AGAIN TO SET THE WEIGHT.',
      'HOLD SPACE TO SWEEP: FURTHER AND STRAIGHTER.',
      'YOUR STONES CLOSER THAN ALL OF THEIRS SCORE.',
      `BUTTON 4 DOWN TO 12-FOOT 1. 4 ENDS, MAX ${maxScore()}.`,
    ],
  },
  {
    id: 'bobsleigh',
    name: 'BOBSLEIGH',
    skill: 'PUSH + LINE',
    better: 'lower',
    format: fmtBob,
    cpu: cpuBob,
    Scene: BobsleighScene,
    baseRecord: 52.5,
    help: [
      'HOLD SPACE TO PUSH. PRESS DOWN TO JUMP IN',
      'JUST BEFORE THE RED LINE. LATE COSTS SPEED.',
      'IN THE BENDS THE SLED SWINGS UP THE WALL.',
      'STEER [ ] TO KEEP IT ON THE GREEN MARK.',
      'SWINGING AND STEERING SCRUB SPEED. TOO HIGH: ROLL.',
    ],
  },
  {
    id: 'caber',
    name: 'CABER TOSS',
    skill: 'BALANCE + TIMING',
    better: 'higher',
    format: fmtPts,
    cpu: cpuCaber,
    Scene: CaberScene,
    baseRecord: 270,
    help: [
      'HOLD SPACE TO RUN. RUNNING HARDER TIPS THE CABER',
      'BACK, EASING OFF LETS IT TOPPLE FORWARD.',
      'KEEP IT FROM FALLING SIDEWAYS WITH [ ].',
      'LET IT TIP INTO THE GREEN, THEN PRESS UP TO TOSS.',
      'STRAIGHT AT 12 O\'CLOCK SCORES 100. 3 TOSSES.',
    ],
  },
  {
    id: 'cliffdive',
    name: 'CLIFF DIVING',
    skill: 'TIMING IN THE AIR',
    better: 'higher',
    format: fmtPts,
    cpu: cpuDive,
    Scene: CliffDiveScene,
    baseRecord: 280,
    help: [
      'PICK A DIVE. HARDER DIVES SCORE MORE.',
      'SPACE AT THE TOP OF THE ARM SWING TO JUMP.',
      'HOLD SPACE TO TUCK OR PIKE AND SPIN FAST.',
      'LET GO TO OPEN OUT: ENTER FEET FIRST, UPRIGHT.',
      'HOLD UP TO SLOW THE SPIN. 3 DIVES, 5 JUDGES.',
    ],
  },
  {
    id: 'footbag',
    name: 'FOOTBAG',
    skill: 'TIMING + RHYTHM',
    better: 'higher',
    format: fmtPts,
    cpu: cpuFootbag,
    Scene: FootbagScene,
    baseRecord: 1400,
    help: [
      'KEEP THE BAG UP FOR 60 SECONDS. KICK AS IT FALLS',
      'PAST: DOWN = FOOT, SPACE = KNEE, UP = HEAD.',
      'STEP WITH [ ] TO STAY UNDER IT. MISSES COST TIME.',
      'MIX THEM UP AND KEEP THE STRING GOING FOR MORE.',
      'X SPINS WHILE IT\'S HIGH: KICK CLEAN AFTER FOR A BONUS.',
    ],
  },
  {
    id: 'surfing',
    name: 'SURFING',
    skill: 'BALANCE + LINE',
    better: 'higher',
    format: fmtPts,
    cpu: cpuSurf,
    Scene: SurfScene,
    baseRecord: 600,
    help: [
      'SPACE TO POP UP AS THE WAVE LIFTS YOU.',
      'THE BOARD TURNS TOWARDS THE ARROWS YOU HOLD.',
      'DROP FOR SPEED. TURN OFF THE BOTTOM AND THE LIP.',
      'CUT BACK ON THE SHOULDER. LET THE CURL CATCH YOU',
      'FOR A TUBE. LAND AIRS FACING DOWN. 2 WAVES.',
    ],
  },
  {
    id: 'halfpipe',
    name: 'HALF-PIPE',
    skill: 'PUMPING + AIR CONTROL',
    better: 'higher',
    format: fmtPts,
    cpu: cpuPipe,
    Scene: HalfPipeScene,
    baseRecord: 2100,
    help: [
      'PRESS SPACE AS YOU ROLL OFF THE FLAT INTO EACH',
      'WALL (THE YELLOW MARKS) TO PUMP UP SPEED.',
      'IN THE AIR HOLD [ ] TO SPIN, UP TO GRAB.',
      'LET GO AND LAND FACING ALONG THE RAMP OR SLAM.',
      'BIGGER, NEW TRICKS SCORE MORE. 2 RUNS OF 35S.',
    ],
  },
];

export const eventById = (id) => EVENTS.find((e) => e.id === id);
