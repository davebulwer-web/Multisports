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
  rocket: () => tone({ freq: 500, to: 1800, dur: 0.5, type: 'triangle', vol: 0.18 }),
  pop: () => { noise({ dur: 0.5, vol: 0.7, filter: 700, q: 0.4 }); noise({ dur: 0.9, vol: 0.25, filter: 4000, q: 0.6, delay: 0.08 }); },
  ignite: () => { noise({ dur: 1.4, vol: 0.9, filter: 500, q: 0.3 }); tone({ freq: 80, to: 160, dur: 0.6, type: 'triangle', vol: 0.5 }); },
  jingle: () => melody([60, 64, 67, 72, 67, 72], 0.1, 'triangle', 0.7),
};

// ---------------------------------------------------------------------------
// Tiny tracker for background tunes. A song is a set of tracks, each a list
// of steps: a MIDI note, 0 for a rest, or null to hold the previous note.
// Drum tracks use 'k' (kick), 's' (snare), 'h' (hat) instead of notes.

/**
 * Start a song. Returns { stop() }. Notes are scheduled a little ahead on a
 * timer, so the tune can loop and be stopped cleanly at any point.
 * @param {{bpm:number, stepsPerBeat?:number, loop?:boolean, tracks:{wave?:string, vol?:number, steps:(number|string|null)[]}[]}} song
 */
export function playSong(song) {
  const c = ensure();
  if (!c || muted) return { stop() {}, playing: false };
  const bus = c.createGain();
  bus.gain.value = 1;
  bus.connect(master);
  const stepDur = 60 / song.bpm / (song.stepsPerBeat || 2);
  const len = Math.max(...song.tracks.map((t) => t.steps.length));
  let step = 0;
  let next = c.currentTime + 0.08;
  const nodes = new Set();
  const voice = (freq, t0, dur, type, vol) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    g.gain.setValueAtTime(vol, t0 + Math.max(0.01, dur - 0.04));
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g).connect(bus);
    o.start(t0); o.stop(t0 + dur + 0.02);
    nodes.add(o); o.onended = () => nodes.delete(o);
  };
  const drum = (kind, t0, vol) => {
    if (kind === 'k') {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(150, t0);
      o.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
      g.gain.setValueAtTime(vol * 1.4, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
      o.connect(g).connect(bus); o.start(t0); o.stop(t0 + 0.16);
      nodes.add(o); o.onended = () => nodes.delete(o);
      return;
    }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf;
    f.type = kind === 'h' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'h' ? 6000 : 1800;
    const dur = kind === 'h' ? 0.04 : 0.11;
    g.gain.setValueAtTime(vol * (kind === 'h' ? 0.5 : 1), t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
    nodes.add(s); s.onended = () => nodes.delete(s);
  };
  const schedule = () => {
    while (next < c.currentTime + 0.3) {
      if (step >= len) {
        if (!song.loop) { clearInterval(timer); return; }
        step = 0;
      }
      for (const tr of song.tracks) {
        const n = tr.steps[step];
        if (n === null || n === undefined || n === 0) continue;
        if (typeof n === 'string') { drum(n, next, tr.vol ?? 0.5); continue; }
        let hold = 1;
        while (step + hold < len && tr.steps[step + hold] === null) hold++;
        voice(NOTE(n), next, hold * stepDur * 0.92, tr.wave || 'square', tr.vol ?? 0.3);
      }
      step++;
      next += stepDur;
    }
  };
  schedule();
  const timer = setInterval(schedule, 60);
  return {
    playing: true,
    stop(fade = 0.4) {
      clearInterval(timer);
      const t = c.currentTime;
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + fade);
      setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch { /* already stopped */ } } bus.disconnect(); }, fade * 1000 + 50);
    },
  };
}
