// Tiny chip-style synth: pulse/triangle/noise voices via WebAudio.
// No sample files needed; every effect is a short recipe below.

let ctx = null;
let master = null;
let muted = false;
let noiseBuf = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.18;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

/** Must be called from a user gesture once (browsers block autoplay). */
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export function toggleMute() { muted = !muted; return muted; }
export const isMuted = () => muted;

function tone({ freq = 440, to = null, dur = 0.1, type = 'square', vol = 1, delay = 0 }) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.1, vol = 1, filter = 2000, delay = 0, q = 0.7 }) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filter;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t0, Math.random() * 0.5);
  s.stop(t0 + dur + 0.02);
}

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
function melody(notes, step = 0.12, type = 'square', vol = 0.6) {
  notes.forEach((n, i) => { if (n) tone({ freq: NOTE(n), dur: step * 0.9, type, vol, delay: i * step }); });
}

export const sfx = {
  blip: () => tone({ freq: 880, dur: 0.05, vol: 0.5 }),
  select: () => tone({ freq: 660, to: 1320, dur: 0.08, vol: 0.5 }),
  back: () => tone({ freq: 440, to: 220, dur: 0.08, vol: 0.5 }),
  step: (good = true) => noise({ dur: 0.04, vol: good ? 0.7 : 0.4, filter: good ? 1800 : 600 }),
  beat: () => tone({ freq: 1200, dur: 0.02, type: 'triangle', vol: 0.3 }),
  bad: () => tone({ freq: 180, to: 90, dur: 0.18, vol: 0.6 }),
  ready: () => tone({ freq: 523, dur: 0.15, type: 'triangle' }),
  gun: () => { noise({ dur: 0.35, vol: 1.2, filter: 900, q: 0.3 }); tone({ freq: 120, to: 40, dur: 0.2, vol: 0.8 }); },
  whoosh: () => noise({ dur: 0.35, vol: 0.6, filter: 3000, q: 2 }),
  thud: () => { noise({ dur: 0.12, vol: 0.9, filter: 300 }); tone({ freq: 90, to: 50, dur: 0.12, type: 'triangle' }); },
  clang: () => { tone({ freq: 220, dur: 0.4, type: 'square', vol: 0.4 }); tone({ freq: 331, dur: 0.35, type: 'square', vol: 0.3 }); },
  shot: () => { noise({ dur: 0.25, vol: 1.1, filter: 1400, q: 0.5 }); tone({ freq: 90, to: 40, dur: 0.12, vol: 0.7 }); },
  smash: () => { noise({ dur: 0.18, vol: 0.8, filter: 3200, q: 1.2 }); tone({ freq: 1400, to: 600, dur: 0.06, vol: 0.3 }); },
  pull: () => tone({ freq: 300, to: 520, dur: 0.18, type: 'triangle', vol: 0.5 }),
  crowd: (vol = 0.5, dur = 1.2) => noise({ dur, vol, filter: 1200, q: 0.4 }),
  fanfare: () => melody([67, 72, 76, 79, 0, 76, 79, 79, 79], 0.11),
  fail: () => melody([64, 63, 62, 61], 0.16, 'triangle', 0.7),
  jingle: () => melody([60, 64, 67, 72, 67, 72], 0.1, 'triangle', 0.7),
};
