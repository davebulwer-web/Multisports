// Small seeded PRNG (mulberry32) so simulations are reproducible in tests.
export function makeRng(seed = (Math.random() * 2 ** 32) >>> 0) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (lo, hi) => lo + (hi - lo) * rng();
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  /** roughly normal, mean 0, sd 1 */
  rng.normal = () => (rng() + rng() + rng() + rng() - 2) * 1.73;
  return rng;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
