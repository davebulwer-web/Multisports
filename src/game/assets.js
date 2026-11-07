// Loaded sprite sheets plus per-player recoloured athletes.
import { loadSheet } from '../engine/sprites.js';
import { recolourMap } from '../art/palette.js';

export const assets = { athlete: null, props: null, scenery: null };
const athleteCache = new Map();

export async function loadAssets() {
  const [athlete, props, scenery] = await Promise.all([loadSheet('athlete'), loadSheet('props'), loadSheet('scenery')]);
  assets.athlete = athlete;
  assets.props = props;
  assets.scenery = scenery;
  athleteCache.clear();
}

/** Athlete sheet in a player's kit and skin tone. */
export function athleteSheet(kit = 0, skin = 1) {
  const key = `${kit}:${skin}`;
  if (!athleteCache.has(key)) athleteCache.set(key, assets.athlete.recolour(recolourMap(kit, skin)));
  return athleteCache.get(key);
}

export const playerSheet = (p) => athleteSheet(p.kit, p.skin);

/** Draw a single-frame prop by tag name (pivot at bottom centre). */
export function drawProp(ctx, tag, x, y, frameOffset = 0) {
  const t = assets.props.tag(tag);
  const idx = Math.min(t.to, t.from + frameOffset);
  assets.props.draw(ctx, idx, x, y);
}

/** Draw a scenery object (src/art/scenery.js) by the centre of its base. */
export function drawScenery(ctx, tag, x, y) {
  assets.scenery.draw(ctx, assets.scenery.tag(tag).from, x, y);
}
