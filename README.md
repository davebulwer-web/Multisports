# Multisports

A browser multi-event sports game in the spirit of the mid-80s home-computer sports compilations and the all-rounder TV contests of the 70s and 80s. Every event tests a **different skill** (rhythm, timing, power and angle, balance) rather than how fast you can hammer a key.

Plain JavaScript ES modules on a 384×216 pixel canvas, with **no build step and no dependencies**.

## Play

```sh
npm start          # serves the folder on http://localhost:8080
```

(Any static server works. ES modules won't load from `file://`.)

**GitHub Pages:** Settings → Pages → *Deploy from a branch* → `main` / root. That's all it needs.

### Controls

| Action | Keys | Gamepad |
|---|---|---|
| Left / Right | ← → or A D | D-pad / stick |
| Up / Down | ↑ ↓ or W S | D-pad / stick |
| Action | Space, Z or J | A |
| Back | X, Esc or K | B |
| Confirm | Enter | Start |

### Events

| Event | Skill | How it plays |
|---|---|---|
| **100m Sprint** | Rhythm | Alternate ← → on the beat. The beat speeds up as you do. Early presses overstride, the same foot twice slips, and going before the gun twice disqualifies you. Mashing is slower than keeping the rhythm. |
| **Javelin** | Power + angle | Hold Space to run up and let go to plant. You slide on after planting, so plant just short of the line. Then lock the release angle; around 33–37° is best. Wind affects the throw, and a flat landing scores no mark. Three throws. |
| **Weightlifting** | Timing + balance | Pick the weight, hit the pull gauge, then the drive gauge. After that, keep the bar centred with ← → for 3 seconds. Two of the three judges' lights make a good lift. Heavier bars give tighter windows and more wobble. |
| **Archery** | Fine control | Hold Space to draw the bow, then keep holding while you steady the sight. It sways with your breathing and has momentum, so nudge it with the arrow keys rather than yanking it. Aim off into the wind and let go to shoot. Hold too long and your arms start to shake. Six arrows, scored 10 (gold) to 1, out of 60. |

### Competition

You can have one to four hot-seat humans plus CPU rivals. Each event scores **10 / 7 / 4 / 2 / 1** for places 1–5, ties share the higher place, and fouls score 0. There are standings after each event and a podium at the end. **Practice** mode plays a single event. Records are kept in the browser (localStorage).

## Art and animation

Sprites live in `assets/sprites/` as **PNG spritesheets + Aseprite-style JSON**, all in one palette (`assets/palette.gpl`). They start out baked from a pose rig, so you can paint over them at any detail you like. See **[docs/SPRITES.md](docs/SPRITES.md)**.

- `npm run export-sprites` re-bakes the rig art. It won't overwrite a PNG you've edited unless you pass `--force`.
- `studio.html` (also on the title menu) previews every animation in any kit and skin. It downloads the rig PNG/JSON/palette and lets you preview your own edited sheet before you copy it in.

## Code map

```
index.html, studio.html
src/
  main.js             boot
  engine/             loop, input (ms-accurate press timestamps), font, audio synth, sprites, gfx helpers
  art/                palette, raster, pose rig (athlete.js), props, sheet packer  (no DOM; shared with Node)
  game/
    sim/              pure event models (sprint, javelin, lift, archery), scoring, rng (unit tested)
    events/           one Scene per event + registry (events/index.js)
    scenes/           title, setup, practice, cards/results/standings/podium
    competition.js    turn order, CPU results, points
tools/                export-sprites.mjs, png.mjs, serve.mjs
tests/                node --test
```

**Adding an event:** write a pure model in `src/game/sim/`, a Scene in `src/game/events/` that calls `onDone(value|null)`, and register it in `src/game/events/index.js`. Menus, competition, scoring and records will pick it up automatically.

```sh
npm test
```
