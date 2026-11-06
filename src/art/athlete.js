// Athlete pose rig. Poses are described with joint angles and rasterised into
// 40x64 frames, then shaded and outlined. This is the *starting point* for
// the art: export the result (npm run export-sprites) and paint over the PNG
// for hand-finished animation. The game prefers PNGs in assets/sprites/.
//
// Angle convention (degrees, athlete faces right):
//   limb angle 0 = pointing straight down, +90 = pointing forward,
//   180 = straight up, -90 = pointing backward.
//   knee: bend amount, shin swings backward from the thigh.
//   elbow: bend amount, forearm swings forward/up from the upper arm.
//   torso: lean, 0 = upright, + = leaning forward.

import { Bitmap } from './raster.js';
import { C } from './palette.js';
import { buildSheet } from './sheet.js';

export const FRAME_W = 40;
export const FRAME_H = 64;
export const PIVOT = { x: 20, y: 62 }; // where the feet touch the ground

const L = { torso: 12, neck: 4.5, thigh: 10, shin: 10, upperArm: 8, foreArm: 8, shoulderDrop: 1.5 };
const rad = (d) => (d * Math.PI) / 180;
const dir = (deg) => [Math.sin(rad(deg)), Math.cos(rad(deg))];

/** Compute joint positions for a pose. */
export function skeleton(p) {
  const hip = p.hip;
  const [ts, tc] = dir(p.torso || 0);
  const up = [ts, -tc]; // torso points up
  const along = (o, v, len) => [o[0] + v[0] * len, o[1] + v[1] * len];
  const neck = along(hip, up, L.torso);
  const shoulder = along(hip, up, L.torso - L.shoulderDrop);
  const head = along(neck, up, L.neck - 0.5);
  const leg = ([thigh, knee]) => {
    const k = along(hip, dir(thigh), L.thigh);
    const shinA = thigh - knee;
    const a = along(k, dir(shinA), L.shin);
    return { knee: k, ankle: a, shinA };
  };
  const arm = ([s, e]) => {
    const el = along(shoulder, dir(s), L.upperArm);
    const h = along(el, dir(s + e), L.foreArm);
    return { elbow: el, hand: h };
  };
  return {
    hip, neck, shoulder, head,
    legF: leg(p.legF), legB: leg(p.legB),
    armF: arm(p.armF), armB: arm(p.armB),
  };
}

function drawLeg(b, hip, lg, front, footFlat) {
  const skin = C(front ? 'skin.1' : 'skin.0');
  const shorts = C(front ? 'kitB.1' : 'kitB.0');
  const shoe = C(front ? 'grey.5' : 'grey.3');
  const sole = C('grey.2');
  b.limb(hip[0], hip[1], lg.knee[0], lg.knee[1], 2.3, skin, 2.0);
  b.limb(lg.knee[0], lg.knee[1], lg.ankle[0], lg.ankle[1], 1.9, skin, 1.4);
  // shorts cover upper ~45% of thigh
  const mid = [hip[0] + (lg.knee[0] - hip[0]) * 0.5, hip[1] + (lg.knee[1] - hip[1]) * 0.5];
  b.limb(hip[0], hip[1], mid[0], mid[1], 2.9, shorts, 2.6);
  // foot: perpendicular-ish to shin, pointing forward
  const fa = footFlat ? 90 : lg.shinA + 90;
  const [fs, fc] = dir(fa);
  const toe = [lg.ankle[0] + fs * 3.5, lg.ankle[1] + fc * 3.5];
  b.limb(lg.ankle[0], lg.ankle[1] + 0.5, toe[0], toe[1] + 0.5, 1.3, shoe);
  b.set(toe[0], toe[1] + 1.5, sole);
}

function drawArm(b, shoulder, a, front) {
  const skin = C(front ? 'skin.1' : 'skin.0');
  const sleeve = C(front ? 'kitA.1' : 'kitA.0');
  b.limb(shoulder[0], shoulder[1], a.elbow[0], a.elbow[1], 1.7, skin, 1.5);
  b.limb(a.elbow[0], a.elbow[1], a.hand[0], a.hand[1], 1.5, skin, 1.3);
  b.disc(a.hand[0], a.hand[1], 1.5, skin);
  b.disc(shoulder[0], shoulder[1], 2.2, sleeve); // vest shoulder strap
}

/** Rasterise one pose into a 40x64 frame. Returns {bmp, anchors}. */
export function drawPose(p) {
  const b = new Bitmap(FRAME_W, FRAME_H);
  const s = skeleton(p);
  drawArm(b, s.shoulder, s.armB, false);
  drawLeg(b, s.hip, s.legB, false, p.footFlatB);
  // torso: vest from hips to shoulders, shorts waistband at the hip
  b.limb(s.hip[0], s.hip[1] - 1, s.shoulder[0], s.shoulder[1], 3.4, C('kitA.1'), 3.6);
  b.disc(s.hip[0], s.hip[1], 3.4, C('kitB.1'));
  // neck + head with hair at the back/top
  b.limb(s.neck[0], s.neck[1] + 1, s.head[0], s.head[1], 1.4, C('skin.1'));
  const [hx, hy] = s.head;
  const hd = p.headTilt || 0;
  b.disc(hx - 0.6, hy - 0.4, 3.6, C('hair.1'));
  b.disc(hx + 0.7, hy + 0.6 + hd * 0.3, 3.1, C('skin.1'));
  drawLeg(b, s.hip, s.legF, true, p.footFlatF);
  drawArm(b, s.shoulder, s.armF, true);
  b.shade();
  // small details added after shading so they stay crisp
  b.set(hx + 2.4, hy - 0.2 + hd * 0.4, C('grey.0')); // eye
  if (p.bib !== false) {
    const bx = s.hip[0] + (s.shoulder[0] - s.hip[0]) * 0.55;
    const by = s.hip[1] + (s.shoulder[1] - s.hip[1]) * 0.55;
    b.rect(Math.round(bx), Math.round(by) - 1, 2, 3, C('grey.6'));
  }
  b.outline(C('grey.1'));
  const r = (pt) => [Math.round(pt[0]), Math.round(pt[1])];
  return { bmp: b, anchors: { handF: r(s.armF.hand), handB: r(s.armB.hand), head: r(s.head), hip: r(s.hip), footF: r(s.legF.ankle), footB: r(s.legB.ankle) } };
}

// ---------------------------------------------------------------------------
// Pose library
// ---------------------------------------------------------------------------

const STAND_HIP = [20, 41];
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPose = (a, b, t) => {
  const o = {};
  for (const k of Object.keys(a)) {
    if (Array.isArray(a[k])) o[k] = a[k].map((v, i) => lerp(v, b[k][i], t));
    else if (typeof a[k] === 'number') o[k] = lerp(a[k], b[k], t);
    else o[k] = a[k];
  }
  return o;
};

export const POSES = {
  stand: { hip: STAND_HIP, torso: 0, legF: [4, 2], legB: [-4, 2], armF: [8, 12], armB: [-6, 10], footFlatF: true, footFlatB: true },
  breathe: { hip: [20, 41.4], torso: 2, legF: [4, 3], legB: [-4, 3], armF: [10, 14], armB: [-6, 12], footFlatF: true, footFlatB: true },
  set: { hip: [17, 45], torso: 62, legF: [62, 112], legB: [10, 70], armF: [-6, 0], armB: [-2, 0], footFlatF: true, headTilt: 2 },
  celebrate: { hip: STAND_HIP, torso: -4, legF: [6, 2], legB: [-6, 2], armF: [160, 10], armB: [200, -10], footFlatF: true, footFlatB: true },
  dejected: { hip: [20, 42], torso: 22, legF: [4, 4], legB: [-4, 4], armF: [4, 6], armB: [-2, 6], footFlatF: true, footFlatB: true, headTilt: 3 },
  stumble: { hip: [21, 45], torso: 42, legF: [70, 70], legB: [-40, 60], armF: [100, 20], armB: [70, 30] },
};

/** Sprint cycle: phase in [0,1). */
function runPose(phase, lean = 14, carry = null) {
  const leg = (ph) => {
    const a = ph * Math.PI * 2;
    const thigh = 18 + 48 * Math.sin(a);
    // knee folds most during recovery (thigh swinging forward from behind)
    const recover = Math.max(0, Math.cos(a));
    const knee = 18 + 95 * recover * (0.5 + 0.5 * Math.sin(a + 0.6));
    return [thigh, Math.max(8, knee)];
  };
  const a = phase * Math.PI * 2;
  const bob = -1.5 * Math.abs(Math.sin(a));
  const p = {
    hip: [20, 42 + bob],
    torso: lean,
    legF: leg(phase),
    legB: leg(phase + 0.5),
    armF: [-55 * Math.sin(a), 95],
    armB: [55 * Math.sin(a), 95],
  };
  if (carry) Object.assign(p, carry);
  return p;
}

const JAV_CARRY = { armF: [-150, 70] }; // javelin hand above the shoulder

const LIFT = {
  ready:  { hip: [16, 50], torso: 50, legF: [92, 118], legB: [86, 112], armF: [-4, 0], armB: [-2, 0], footFlatF: true, footFlatB: true },
  pull:   { hip: [19, 42], torso: 12, legF: [12, 14], legB: [8, 12], armF: [4, 0], armB: [6, 0], footFlatF: true, footFlatB: true },
  rack:   { hip: [20, 43], torso: 0, legF: [18, 22], legB: [10, 18], armF: [95, 150], armB: [92, 150], footFlatF: true, footFlatB: true },
  dip:    { hip: [20, 45], torso: 0, legF: [34, 46], legB: [26, 42], armF: [95, 150], armB: [92, 150], footFlatF: true, footFlatB: true },
  jerk:   { hip: [20, 46], torso: -4, legF: [48, 44], legB: [-36, 30], armF: [178, 0], armB: [182, 0], footFlatF: true },
  hold:   { hip: [20, 41], torso: 0, legF: [6, 2], legB: [-6, 2], armF: [178, 0], armB: [182, 0], footFlatF: true, footFlatB: true },
  wobbleL:{ hip: [19, 41], torso: -5, legF: [4, 2], legB: [-8, 2], armF: [172, 4], armB: [176, 4], footFlatF: true, footFlatB: true },
  wobbleR:{ hip: [21, 41], torso: 5, legF: [8, 2], legB: [-4, 2], armF: [186, -4], armB: [190, -4], footFlatF: true, footFlatB: true },
  drop:   { hip: [19, 44], torso: 18, legF: [20, 30], legB: [4, 26], armF: [70, 10], armB: [60, 10], footFlatF: true, footFlatB: true, headTilt: 2 },
};

// Archery: bow hand (armF) pushes out at the target, string hand (armB)
// draws back to the chin. Side-on stance, feet shoulder width.
const ARCH_STANCE = { hip: [20, 41], torso: -2, legF: [10, 2], legB: [-10, 2], footFlatF: true, footFlatB: true };
const ARCH = {
  raise: { ...ARCH_STANCE, armF: [70, 6], armB: [62, 40] },
  half:  { ...ARCH_STANCE, armF: [90, 0], armB: [-30, 125] },
  full:  { ...ARCH_STANCE, armF: [90, 0], armB: [-92, 172] },
  loose: { ...ARCH_STANCE, armF: [88, 0], armB: [-112, 150] },
};

// Clay shooting: gun held low and ready, then mounted to the shoulder.
// The scene draws the gun itself from handF, pointing at the sight.
const CLAY_POSE = {
  ready: { hip: [20, 41], torso: 4, legF: [12, 4], legB: [-8, 2], armF: [52, 70], armB: [30, 80], footFlatF: true, footFlatB: true },
  mount: { hip: [20, 41], torso: 8, legF: [14, 6], legB: [-8, 2], armF: [112, 40], armB: [84, 100], footFlatF: true, footFlatB: true },
};

// Ski jump. The scene draws the skis from footF/footB. Flight poses lean the
// whole body forward over the skis; the frame picked follows the lean error.
const SKI_POSE = {
  tuck:    { hip: [16, 50], torso: 76, legF: [72, 128], legB: [64, 124], armF: [-40, 8], armB: [-34, 8], footFlatF: true, footFlatB: true, headTilt: 2 },
  upright: { hip: [19, 44], torso: 34, legF: [30, 50], legB: [22, 46], armF: [-20, 20], armB: [-14, 20], footFlatF: true, footFlatB: true },
  takeoff: { hip: [20, 44], torso: 46, legF: [-6, 8], legB: [-12, 8], armF: [-50, 6], armB: [-44, 6], footFlatF: true, footFlatB: true },
  flyBack: { hip: [18, 46], torso: 38, legF: [-24, 0], legB: [-30, 0], armF: [-36, 0], armB: [-30, 0], footFlatF: true, footFlatB: true },
  fly:     { hip: [19, 48], torso: 54, legF: [-34, 0], legB: [-40, 0], armF: [-40, 0], armB: [-34, 0], footFlatF: true, footFlatB: true },
  flyFwd:  { hip: [20, 50], torso: 68, legF: [-44, 0], legB: [-50, 0], armF: [-50, 0], armB: [-44, 0], footFlatF: true, footFlatB: true, headTilt: 2 },
  land:    { hip: [20, 46], torso: 12, legF: [36, 44], legB: [-14, 78], armF: [72, 14], armB: [-58, 10], footFlatF: true, footFlatB: true },
  feet:    { hip: [19, 45], torso: 22, legF: [30, 52], legB: [24, 50], armF: [34, 30], armB: [-20, 30], footFlatF: true, footFlatB: true },
  fall:    { hip: [16, 57], torso: 86, legF: [-78, 14], legB: [-96, 8], armF: [132, 20], armB: [112, 30], headTilt: 3 },
};

// Biathlon: classic diagonal stride (long gliding legs, big opposite arm
// swing; the scene adds skis and poles), then prone and standing shooting.
function xcPose(phase) {
  const a = phase * Math.PI * 2;
  const leg = (ph) => {
    const s = Math.sin(ph * Math.PI * 2);
    return [8 + 34 * s, 10 + 22 * Math.max(0, -Math.cos(ph * Math.PI * 2))];
  };
  return {
    hip: [20, 43 - 0.8 * Math.abs(Math.sin(a))],
    torso: 34,
    legF: leg(phase), legB: leg(phase + 0.5),
    armF: [5 - 55 * Math.sin(a), 25], armB: [5 + 55 * Math.sin(a), 25],
    footFlatF: true, footFlatB: true,
  };
}
const BIA = {
  prone:  { hip: [21, 58], torso: 84, legF: [-82, 4], legB: [-88, 4], armF: [40, 100], armB: [10, 120], footFlatF: true, footFlatB: true, headTilt: 2 },
  stand:  { hip: [20, 41], torso: 0, legF: [10, 2], legB: [-10, 2], armF: [96, 50], armB: [40, 110], footFlatF: true, footFlatB: true },
};

const JAV = {
  withdraw: { hip: [20, 42], torso: -8, legF: [36, 10], legB: [-24, 20], armF: [-112, 6], armB: [70, 40] },
  block:    { hip: [19, 43], torso: -14, legF: [44, 0], legB: [-34, 40], armF: [-100, 0], armB: [90, 60], footFlatF: true },
  release:  { hip: [21, 43], torso: 14, legF: [34, 6], legB: [-40, 50], armF: [168, 10], armB: [20, 40], footFlatF: true },
  follow:   { hip: [18, 44], torso: 34, legF: [20, 20], legB: [-60, 70], armF: [70, 10], armB: [-30, 30], footFlatF: true },
};

/** Animation definitions: tag -> list of [pose, durationMs]. */
export function animations() {
  const run = (n, ms, lean, carry) =>
    Array.from({ length: n }, (_, i) => [runPose(i / n, lean, carry), ms]);
  return [
    { tag: 'idle', frames: [[POSES.stand, 600], [POSES.breathe, 600]] },
    { tag: 'set', frames: [[POSES.set, 1000]] },
    { tag: 'run', frames: run(8, 70, 14) },
    { tag: 'stumble', frames: [[POSES.stumble, 200]] },
    { tag: 'jog', frames: run(8, 110, 6) },
    { tag: 'jav_run', frames: run(8, 80, 8, JAV_CARRY) },
    { tag: 'jav_throw', frames: [[JAV.withdraw, 90], [JAV.block, 90], [lerpPose(JAV.block, JAV.release, 0.5), 60], [JAV.release, 90], [JAV.follow, 200]] },
    { tag: 'arch_draw', frames: [[ARCH.raise, 150], [ARCH.half, 300], [ARCH.full, 450]] },
    { tag: 'arch_hold', frames: [[ARCH.full, 500]] },
    { tag: 'arch_loose', frames: [[ARCH.loose, 500]] },
    { tag: 'clay_ready', frames: [[CLAY_POSE.ready, 500]] },
    { tag: 'clay_mount', frames: [[CLAY_POSE.mount, 500]] },
    { tag: 'ski_tuck', frames: [[SKI_POSE.tuck, 500]] },
    { tag: 'ski_upright', frames: [[SKI_POSE.upright, 500]] },
    { tag: 'ski_takeoff', frames: [[SKI_POSE.takeoff, 500]] },
    { tag: 'ski_fly_back', frames: [[SKI_POSE.flyBack, 500]] },
    { tag: 'ski_fly', frames: [[SKI_POSE.fly, 500]] },
    { tag: 'ski_fly_fwd', frames: [[SKI_POSE.flyFwd, 500]] },
    { tag: 'ski_land', frames: [[lerpPose(SKI_POSE.feet, SKI_POSE.land, 0.5), 80], [SKI_POSE.land, 500]] },
    { tag: 'ski_feet', frames: [[SKI_POSE.feet, 500]] },
    { tag: 'ski_fall', frames: [[SKI_POSE.fall, 500]] },
    { tag: 'xc_stride', frames: Array.from({ length: 8 }, (_, i) => [xcPose(i / 8), 110]) },
    { tag: 'bia_prone', frames: [[BIA.prone, 500]] },
    { tag: 'bia_stand', frames: [[BIA.stand, 500]] },
    { tag: 'lift_ready', frames: [[LIFT.ready, 500]] },
    { tag: 'lift_pull', frames: [[lerpPose(LIFT.ready, LIFT.pull, 0.5), 100], [LIFT.pull, 100]] },
    { tag: 'lift_rack', frames: [[LIFT.rack, 400]] },
    { tag: 'lift_dip', frames: [[LIFT.dip, 150]] },
    { tag: 'lift_jerk', frames: [[LIFT.jerk, 400]] },
    { tag: 'lift_hold', frames: [[LIFT.hold, 400]] },
    { tag: 'lift_wobble_l', frames: [[LIFT.wobbleL, 200]] },
    { tag: 'lift_wobble_r', frames: [[LIFT.wobbleR, 200]] },
    { tag: 'lift_drop', frames: [[LIFT.drop, 400]] },
    { tag: 'celebrate', frames: [[POSES.celebrate, 250], [lerpPose(POSES.celebrate, POSES.stand, 0.25), 250]] },
    { tag: 'dejected', frames: [[POSES.dejected, 800]] },
  ];
}

/** Bake the full athlete sheet. */
export function bakeAthlete() {
  const anims = animations().map(({ tag, frames }) => ({
    tag,
    frames: frames.map(([pose, duration]) => ({ ...drawPose(pose), duration })),
  }));
  return buildSheet('athlete', anims, { w: FRAME_W, h: FRAME_H, pivot: PIVOT, cols: 8 });
}
