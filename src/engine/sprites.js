// Sprite sheet loading, recolouring and animation playback.
//
// Sheets are loaded from assets/sprites/<name>.png + <name>.json (Aseprite
// "Array" JSON). If a sheet is missing it is baked on the fly from the pose
// rig in src/art, so the game always runs even before any export.

import { SHEETS } from '../art/index.js';

export class Sheet {
  constructor(name, image, json) {
    this.name = name;
    this.image = image; // HTMLCanvasElement or HTMLImageElement
    this.frames = json.frames.map((f) => ({ ...f.frame, duration: f.duration ?? 100 }));
    this.tags = {};
    for (const t of json.meta.frameTags || []) this.tags[t.name] = t;
    const ms = json.meta.multisports || {};
    const pivotSlice = (json.meta.slices || []).find((s) => s.name === 'pivot');
    this.pivot =
      ms.pivot ||
      (pivotSlice?.keys?.[0]?.pivot
        ? { x: pivotSlice.keys[0].bounds.x + pivotSlice.keys[0].pivot.x, y: pivotSlice.keys[0].bounds.y + pivotSlice.keys[0].pivot.y }
        : { x: Math.floor(this.frames[0].w / 2), y: this.frames[0].h - 1 });
    this.anchors = ms.anchors || null;
    this.json = json;
  }

  tag(name) {
    const t = this.tags[name];
    if (!t) throw new Error(`Sheet ${this.name} has no animation tag "${name}"`);
    return t;
  }

  /** Anchor point (e.g. 'handF') of a frame, relative to the pivot. */
  anchor(frameIdx, key) {
    const a = this.anchors?.[frameIdx]?.[key];
    if (!a) return null;
    return { x: a[0] - this.pivot.x, y: a[1] - this.pivot.y };
  }

  /** Draw frame with its pivot at (x, y). */
  draw(ctx, frameIdx, x, y, { flip = false, alpha = 1 } = {}) {
    const f = this.frames[frameIdx];
    if (!f) return;
    const px = flip ? f.w - 1 - this.pivot.x : this.pivot.x;
    const dx = Math.round(x - px), dy = Math.round(y - this.pivot.y);
    if (alpha !== 1) ctx.globalAlpha = alpha;
    if (flip) {
      ctx.save();
      ctx.translate(dx + f.w, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(this.image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      ctx.restore();
    } else {
      ctx.drawImage(this.image, f.x, f.y, f.w, f.h, dx, dy, f.w, f.h);
    }
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  /** Copy of this sheet with exact-RGB colour replacement (Map hex->hex). */
  recolour(map) {
    const c = document.createElement('canvas');
    c.width = this.image.width;
    c.height = this.image.height;
    const x = c.getContext('2d');
    x.drawImage(this.image, 0, 0);
    const img = x.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const lut = new Map();
    for (const [from, to] of map) {
      const f = parseInt(from.slice(1), 16), t = parseInt(to.slice(1), 16);
      lut.set(f, t);
    }
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      const t = lut.get(k);
      if (t !== undefined) { d[i] = (t >> 16) & 255; d[i + 1] = (t >> 8) & 255; d[i + 2] = t & 255; }
    }
    x.putImageData(img, 0, 0);
    const s = Object.create(Sheet.prototype);
    Object.assign(s, this, { image: c });
    return s;
  }
}

export function bitmapToCanvas(bmp) {
  const c = document.createElement('canvas');
  c.width = bmp.w;
  c.height = bmp.h;
  const x = c.getContext('2d');
  x.putImageData(new ImageData(bmp.toRGBA(), bmp.w, bmp.h), 0, 0);
  return c;
}

function loadImage(url) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error(`image ${url}`));
    i.src = url;
  });
}

/** Bake a sheet from the built-in rig. */
export function bakeSheet(name) {
  const { bitmap, json } = SHEETS[name].bake();
  const s = new Sheet(name, bitmapToCanvas(bitmap), json);
  s.source = 'rig';
  return s;
}

/** Load a sheet from assets, falling back to the rig. */
export async function loadSheet(name, base = 'assets/sprites/') {
  try {
    const bust = `?v=${Date.now()}`;
    const res = await fetch(`${base}${name}.json${bust}`);
    if (!res.ok) throw new Error(res.status);
    const json = await res.json();
    const image = await loadImage(`${base}${json.meta.image || name + '.png'}${bust}`);
    const s = new Sheet(name, image, json);
    s.source = 'file';
    if (!s.anchors && SHEETS[name]) {
      // hand-edited sheet exported without our metadata: borrow rig anchors
      s.anchors = SHEETS[name].bake().json.meta.multisports.anchors;
    }
    return s;
  } catch (e) {
    console.info(`[sprites] ${name}: using built-in rig (${e.message})`);
    return bakeSheet(name);
  }
}

/** Plays one tag of a sheet. */
export class Anim {
  constructor(sheet, tag, { loop = true, speed = 1 } = {}) {
    this.sheet = sheet;
    this.loop = loop;
    this.speed = speed;
    this.play(tag);
  }

  play(tag, { restart = false, loop = this.loop } = {}) {
    if (tag === this.tagName && !restart) return this;
    this.tagName = tag;
    this.t = this.sheet.tag(tag);
    this.index = this.t.from;
    this.elapsed = 0;
    this.loop = loop;
    this.done = false;
    return this;
  }

  update(dtMs) {
    if (this.done) return;
    this.elapsed += dtMs * this.speed;
    let dur = this.sheet.frames[this.index].duration;
    while (this.elapsed >= dur) {
      this.elapsed -= dur;
      if (this.index < this.t.to) this.index++;
      else if (this.loop) this.index = this.t.from;
      else { this.done = true; this.elapsed = 0; break; }
      dur = this.sheet.frames[this.index].duration;
    }
  }

  draw(ctx, x, y, opts) { this.sheet.draw(ctx, this.index, x, y, opts); }
  anchor(key) { return this.sheet.anchor(this.index, key); }
}
