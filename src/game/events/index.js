// Event registry. Add a new event by writing a Scene + sim module and
// listing it here; menus, competition flow and scoring pick it up.
// `season` files it under a tab in the event menus (summer, winter, world,
// beach, challenge — see SEASONS in ../programme.js). An unknown season gets its own
// tab automatically, and an event with no season goes under OTHER.
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
import { PoleVaultScene } from './polevault.js';
import { SlalomScene } from './slalom.js';
import { SkatingScene } from './skating.js';
import { AssaultScene } from './assault.js';
import { HammerScene } from './hammer.js';
import { RowingScene } from './rowing.js';
import { FigureScene } from './figure.js';
import { LogRollScene } from './logroll.js';
import { BmxScene } from './bmx.js';
import { GymScene, fmtReps } from './gym.js';
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
import { cpuVault } from '../sim/vault.js';
import { cpuSlalom, fmtSlalom } from '../sim/slalom.js';
import { cpuSkate, fmtSkate } from '../sim/skate.js';
import { cpuAssault, fmtAssault } from '../sim/assault.js';
import { cpuHammer } from '../sim/hammer.js';
import { cpuRow, fmtRow } from '../sim/row.js';
import { cpuFigure } from '../sim/figure.js';
import { cpuLog } from '../sim/logroll.js';
import { cpuBmx } from '../sim/bmx.js';
import { cpuGym } from '../sim/gym.js';
import { fmtTime, fmtDist, fmtKg, fmtPts, fmtClays } from '../hud.js';

export const EVENTS = [
  {
    id: 'sprint',
    season: 'summer',
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
    season: 'summer',
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
    season: 'summer',
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
    season: 'summer',
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
    season: 'summer',
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
  },  {
    id: 'polevault',
    season: 'summer',
    name: 'POLE VAULT',
    skill: 'SPEED CONTROL + TIMING',
    better: 'higher',
    format: fmtDist,
    cpu: cpuVault,
    Scene: PoleVaultScene,
    baseRecord: 5.9,
    help: [
      'PICK A POLE (LEFT/RIGHT) AND A HEIGHT (UP/DOWN).',
      'HOLD SPACE TO RUN, EASE OFF TO HIT THE POLE\'S SPEED.',
      'PRESS DOWN AT THE WHITE MARK TO PLANT THE POLE.',
      'SPACE AT FULL BEND TO ROCK BACK, UP TO PUSH OFF.',
      '6 JUMPS, OUT AFTER 3 FAILURES IN A ROW.',
    ],
  },
  {
    id: 'hammer',
    season: 'summer',
    name: 'HAMMER THROW',
    skill: 'RHYTHM + RELEASE',
    better: 'higher',
    format: fmtDist,
    cpu: cpuHammer,
    Scene: HammerScene,
    baseRecord: 86,
    help: [
      'SPACE TO START THE WIND-UPS, THEN ON EVERY TURN',
      'PRESS SPACE AS THE BALL SWEEPS THROUGH THE GREEN.',
      'ON TIME SPINS IT FASTER. ONE PRESS A TURN.',
      'PRESS UP TO LET GO WHILE IT IS IN THE YELLOW.',
      'A SIXTH TURN IS A FOUL. 3 THROWS, BEST COUNTS.',
    ],
  },
  {
    id: 'rowing',
    season: 'summer',
    name: 'ROWING',
    skill: 'RHYTHM + PACING',
    better: 'lower',
    format: fmtRow,
    cpu: cpuRow,
    Scene: RowingScene,
    baseRecord: 79,
    help: [
      '500 METRES AGAINST A RIVAL BOAT. HOLD SPACE TO DRIVE,',
      'LET GO AS THE SEAT REACHES THE BACK (THE GREEN).',
      'PRESS AGAIN AS IT ROLLS TO THE FRONT. HOLD ON TOO',
      'LONG AND YOU CATCH A CRAB. HOLD UP ON THE DRIVE FOR',
      'POWER: IT BURNS STAMINA, SO SAVE IT FOR THE END.',
    ],
  },

  {
    id: 'skijump',
    season: 'winter',
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
    season: 'winter',
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
    season: 'winter',
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
    season: 'winter',
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
  },  {
    id: 'skating',
    season: 'winter',
    name: 'SPEED SKATING',
    skill: 'RHYTHM + LEAN',
    better: 'lower',
    format: fmtSkate,
    cpu: cpuSkate,
    Scene: SkatingScene,
    baseRecord: 37.2,
    help: [
      '500 METRES. PUSH OFF WITH SPACE ON THE GUN.',
      'PUSH AGAIN AT THE END OF EACH GLIDE (THE GREEN).',
      'EARLY PUSHES ARE WEAK. LATE ONES WASTE SPEED.',
      'IN THE BENDS HOLD LEFT TO LEAN. KEEP IT IN THE GREEN:',
      'TOO LITTLE AND YOU GO WIDE, TOO MUCH AND YOU SLIP.',
    ],
  },
  {
    id: 'figure',
    season: 'winter',
    name: 'FIGURE SKATING',
    skill: 'RHYTHM + ROUTINE',
    better: 'higher',
    format: fmtPts,
    cpu: cpuFigure,
    Scene: FigureScene,
    baseRecord: 240,
    help: [
      'SKATE TO THE MUSIC: EVERY MOVE GOES ON A BEAT.',
      'SPACE STROKES FOR SPEED AND FLOW.',
      'UP TAKES OFF, SPACE ON THE NEXT BEAT LANDS.',
      'MORE SPEED = MORE TURNS. HOLD DOWN TO SPIN.',
      'MIX YOUR JUMPS: REPEATS SCORE LESS. 7 JUMPS MAX.',
    ],
  },

  {
    id: 'caber',
    season: 'world',
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
    season: 'world',
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
  },  {
    id: 'slalom',
    season: 'world',
    name: 'CANOE SLALOM',
    skill: 'STEERING + CURRENT',
    better: 'lower',
    format: fmtSlalom,
    cpu: cpuSlalom,
    Scene: SlalomScene,
    baseRecord: 95,
    help: [
      'EACH STROKE PUSHES YOU ON AND TURNS YOU: LEFT OR',
      'RIGHT TURNS THAT WAY, ALTERNATE TO GO STRAIGHT.',
      'DOWN BACK-PADDLES. GREEN GATES GOING DOWNSTREAM,',
      'RED GATES GOING BACK UP FROM THE EDDY BELOW A ROCK.',
      'TOUCH A POLE +2S. MISS A GATE +50S.',
    ],
  },
  {
    id: 'logroll',
    season: 'world',
    name: 'LOG ROLLING',
    skill: 'BALANCE + BLUFF',
    better: 'higher',
    format: fmtPts,
    cpu: cpuLog,
    Scene: LogRollScene,
    baseRecord: 260,
    help: [
      'STAY ON THE SPINNING LOG: LEFT/RIGHT TO BALANCE.',
      'UP AND DOWN CHANGE THE PACE OF THE LOG.',
      'YOUR FEET KEEP UP WITH YOUR OWN CHANGES FASTER',
      'THAN YOUR RIVAL CAN. CHANGE PACE AS THEY WOBBLE.',
      'FIRST TO 2 DUNKINGS. QUICK WINS SCORE MORE.',
    ],
  },

  {
    id: 'footbag',
    season: 'beach',
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
    season: 'beach',
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
    season: 'beach',
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
  {
    id: 'bmx',
    season: 'beach',
    name: 'BMX',
    skill: 'PUMPING + TRICKS',
    better: 'higher',
    format: fmtPts,
    cpu: cpuBmx,
    Scene: BmxScene,
    baseRecord: 500,
    help: [
      'HOLD DOWN ROLLING DOWN EACH BUMP TO PUMP FOR SPEED.',
      'PRESS UP JUST BEFORE A LIP TO POP OFF IT.',
      'IN THE AIR: SPACE SUPERMAN, DOWN CAN-CAN.',
      'LET GO IN TIME. LEFT/RIGHT TO MATCH THE LANDING.',
      'TRICKS SCORE ONLY IF YOU RIDE AWAY. 45 SECONDS.',
    ],
  },  {
    id: 'assault',
    season: 'challenge',
    name: 'ASSAULT COURSE',
    skill: 'TIMING ON EVERY OBSTACLE',
    better: 'lower',
    format: fmtAssault,
    cpu: cpuAssault,
    Scene: AssaultScene,
    baseRecord: 30.5,
    help: [
      'HOLD SPACE TO RUN. UP JUMPS THE WALL FROM THE ZONE.',
      'UP CLIMBS THE NET AS IT SWINGS IN TOWARDS YOU.',
      'BEAM: HOLD SPACE TO WALK, LEFT/RIGHT TO BALANCE.',
      'ROPE: UP AS IT SWINGS BACK, SPACE TO LET GO',
      'AT THE FAR END OF THE SWING TO CLEAR THE WATER.',
    ],
  },
  {
    id: 'gym',
    season: 'challenge',
    name: 'GYM TESTS',
    skill: 'TIMING + STAMINA',
    better: 'higher',
    format: fmtReps,
    cpu: cpuGym,
    Scene: GymScene,
    baseRecord: 55,
    help: [
      'SQUAT THRUSTS THEN BAR DIPS, 30 SECONDS EACH.',
      'DOWN AND UP IN TURN. REACH BOTH LINES OR NO REP.',
      'PRESS THE NEXT WAY RIGHT AS YOU HIT THE END',
      'TO SPRING OFF IT. SPRINGING TIRES YOU OUT,',
      'AND TIRED MUSCLES MOVE SLOWER. PACE YOURSELF.',
    ],
  },

];

export const eventById = (id) => EVENTS.find((e) => e.id === id);
