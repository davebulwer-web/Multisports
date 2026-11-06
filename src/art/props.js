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
  return buildSheet('props', anims, { w: S, h: S, pivot: { x: 8, y: 15 }, cols: 8 });
}
