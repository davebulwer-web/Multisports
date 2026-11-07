// Small props: medals, judges' lights, crowd figures. 16x16 frames.

import { Bitmap } from './raster.js';
import { C } from './palette.js';
import { buildSheet } from './sheet.js';

const S = 16;

function medal(base, hi) {
  const b = new Bitmap(S, S);
  // ribbon
  b.limb(5, 0, 7, 6, 1.2, C('blue.2'));
  b.limb(11, 0, 9, 6, 1.2, C('red.2'));
  b.disc(8, 10.5, 4.6, C(base));
  b.disc(8, 10.5, 2.6, C(hi));
  b.shade();
  b.set(7, 9, C('grey.6'));
  b.outline(C('grey.1'));
  return b;
}

function light(on) {
  const b = new Bitmap(S, S);
  b.rect(6, 9, 4, 7, C('grey.2'));
  b.disc(8, 6, 5, C('grey.2'));
  b.disc(8, 6, 3.8, C(on === 'white' ? 'grey.5' : on === 'red' ? 'lamp.1' : 'grey.1'));
  if (on) b.shade();
  if (on) b.set(7, 4, C('grey.6'));
  b.outline(C('grey.0'));
  return b;
}

const CROWD_SHIRTS = ['red.2', 'blue.2', 'yellow.1', 'green.2', 'cyan.1', 'purple.2', 'grey.5', 'orange.2'];
const CROWD_SKIN = ['skin.1', 'orange.2', 'orange.1', 'red.2'];

function spectator(i, armsUp) {
  const b = new Bitmap(S, S);
  const shirt = C(CROWD_SHIRTS[i % CROWD_SHIRTS.length]);
  const skin = C(CROWD_SKIN[(i * 3) % CROWD_SKIN.length]);
  b.rect(5, 9, 6, 7, shirt);
  b.disc(8, 6, 2.6, skin);
  b.rect(6, 3, 4, 1, C(i % 2 ? 'hair.0' : 'grey.2'));
  if (armsUp) {
    b.line(5, 9, 3, 4, skin);
    b.line(10, 9, 12, 4, skin);
  }
  b.shade();
  return b;
}

// Ceremonial torch, handle at the bottom centre, cup at the top (the flame
// is drawn live by the game so it can flicker).
function torch() {
  const b = new Bitmap(S, S);
  b.limb(8, 15, 8, 6, 1.1, C('orange.2'), 1.8);
  b.rect(7, 9, 3, 1, C('orange.3'));
  b.disc(8, 5, 2.6, C('orange.3'));
  b.rect(5, 3, 7, 2, C('orange.2'));
  b.shade();
  b.set(7, 4, C('yellow.2'));
  b.outline(C('grey.1'));
  return b;
}

// Dove in flight, facing right: wings up / wings down.
function dove(up) {
  const b = new Bitmap(S, S);
  b.limb(3, 10, 11, 9, 1.8, C('grey.6'), 1.4); // body
  b.disc(12, 8, 1.6, C('grey.6'));             // head
  b.set(14, 8, C('orange.3'));                  // beak
  b.limb(2, 10, 0, 9, 1, C('grey.5'));          // tail
  if (up) { b.limb(6, 9, 4, 2, 1.4, C('grey.5'), 0.8); b.limb(8, 9, 7, 3, 1.2, C('grey.6'), 0.6); }
  else { b.limb(6, 10, 3, 14, 1.4, C('grey.5'), 0.8); b.limb(8, 10, 8, 14, 1.2, C('grey.6'), 0.6); }
  b.shade();
  b.set(12, 7, C('grey.0'));
  b.outline(C('grey.2'));
  return b;
}

export function bakeProps() {
  const one = (tag, bmp, duration = 100) => ({ tag, frames: [{ bmp, duration }] });
  const anims = [
    one('medal_gold', medal('yellow.1', 'yellow.2')),
    one('medal_silver', medal('grey.4', 'grey.5')),
    one('medal_bronze', medal('orange.2', 'orange.3')),
    one('light_off', light(null)),
    one('light_white', light('white')),
    one('light_red', light('red')),
  ];
  for (let i = 0; i < 8; i++) {
    anims.push({
      tag: `fan_${i}`,
      frames: [
        { bmp: spectator(i, false), duration: 300 },
        { bmp: spectator(i, true), duration: 300 },
      ],
    });
  }
  anims.push(one('torch', torch()));
  anims.push({ tag: 'dove', frames: [{ bmp: dove(true), duration: 120 }, { bmp: dove(false), duration: 120 }] });
  return buildSheet('props', anims, { w: S, h: S, pivot: { x: 8, y: 15 }, cols: 8 });
}
