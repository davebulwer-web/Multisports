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
| **Clay Pigeon** | Reaction + tracking | Press Space to call for the clay, which comes from the left or right trap after a short random delay. Swing the sight after it with the arrow keys (it has momentum) and fire ahead of it, because the shot takes time to get there. The further away the clay, the more lead it needs, but the pattern also spreads wider. Six singles then three doubles, two shells per round, scored out of 12. |
| **Ski Jump** | Timing + balance | Press Space to push off and hold ↓ to tuck down the inrun for speed. Press Space again right on the lip to spring: early or late costs height and leaves you rotating. In the air the flight position is unstable, so keep your lean in the green with ← →. Press Space just before touchdown for a telemark landing, but not too early, because setting it kills your lift. Two jumps, each scored as distance points (60 at the 120 m K-point, 1.8 per metre) plus style from five judges (middle three count). Lean too far forward and you go over; land past the hill size without a telemark and you fall. |
| **Biathlon** | Pacing + steady aim | Ski three legs, holding → to push. Your heart rate climbs as you push (and faster on the climbs). Go past the redline and the burn slows you right down, so ease off to recover. At each range (prone, then standing) steer the sight onto five targets and fire with Space. The sight sways with your breathing and jumps with every heartbeat, so you either wait for your heart to settle or shoot quickly and risk misses. Prone only counts the inner ring; standing counts the whole target but sways more. Each miss adds 10 seconds. Lowest time wins. |
| **Curling** | Judgement + sweeping | A top-down sheet. Move the broom you're aiming at with ↑ ↓ and pick the turn with ← → (the stone curls more as it slows). Press Space, then press Space again to stop the swinging weight gauge in the guard, draw or takeout band. Once the stone is on its way, hold Space to sweep it before the tee line: it travels further and curls less. Stones collide, so you can knock theirs out. Four ends with a different set-up each (open house, centre guard, a stone on the button, guard plus shot stone), and two stones per end. Your stones that are closer than every opposition stone score their ring: button 4, 4-foot 3, 8-foot 2, 12-foot 1. Best possible score is 32. |
| **Bobsleigh** | Push + line | Behind-the-sled view down an ice tube. Hold Space to push the sled and press ↓ to jump in just before the red line; loading in late costs speed. In the bends the sled swings up the outside wall like a pendulum. Steer with ← → to settle it on the green mark in the LINE gauge. Swinging about and hard steering both scrub speed, and swinging over the lip rolls the sled. Lowest time wins. |
| **Caber Toss** | Balance + timing | Press Space to pick up the caber, then hold Space to run with it balanced on your hands. Running harder pulls the base under it so it leans back; easing off lets it topple forward, so you balance it with your speed. It also drifts sideways, which you steer back with ← →. Near the end of the run, ease off to let it tip forward into the green zone and press ↑ to toss. Too slow or leaning back and it won't turn over. The judges score how straight it lands on a clock face: 12:00 scores 100, falling to 0 at 9:00 or 3:00. Sideways lean and wobble at the release send it off line. Three tosses, out of 300. |
| **Cliff Diving** | Timing in the air | Pick a dive (each one once, harder dives have a higher degree of difficulty). Press Space at the top of the arm swing to take off, and keep holding to tuck or pike, which spins you fast. Let go to open out: the open body only turns slowly, so open at the moment the slow turn will bring you upright, feet first, as you hit the water. The somersault bar shows how far you've turned and where you'd finish if you opened now. Hold ↑ to put your arms out and slow the turn a little more. Five judges mark the entry, take-off and how long you showed a straight line. The middle three count, multiplied by the degree of difficulty. Three dives. |
| **Footbag** | Timing + rhythm | A minute on the sand keeping the bag up. Each kicking surface has its own height: press ↓ to kick with the foot, Space for the knee and ↑ to head it, just as the bag falls through that height (the gauge on the left shows the zones). Step with ← → to stay under it: clean contacts pop it straight up, scuffed or stretched ones send it drifting. A miss leaves you off balance for a moment, so mashing drops the bag. Points grow with clean contacts, with mixing surfaces (three different in a row doubles them) and with the unbroken string (up to ×3). Press X while it's up high to spin, then kick it cleanly for a spin bonus. |
| **Surfing** | Balance + line | Seen from the beach, the wave peels to the right with the curl chasing you. Press Space to pop up as the wave lifts you (the green part of the bar). The board turns towards whichever arrows you hold. Dropping down the face gains speed, climbing loses it, and the wave's push fades out on the shoulder, so cut back towards the curl when you get too far ahead. Points for bottom turns, top turns and turns off the lip, cutbacks, tube rides (let the curl catch you mid-face, then outrun it) and airs (hit the lip fast, then turn to face down before you land). Repeats are worth less each time. Get caught in the white water and you wipe out. Two 30-second waves. |
| **Half-pipe** | Pumping + air control | Press Space as you roll off the flat into each wall (the yellow marks) to pump: well timed, it adds speed; mistimed, it loses some. Leave the coping with speed and you fly up: hold ← or → to spin and ↑ to grab. Let go of the grab before you land, and come down facing along the ramp: after a 180 or 540 you ride away forwards, after a 0 or 360 backwards (fakie). Anything in between is a slam. Airs score for height, spin and grabs; repeating a trick is worth less. Two 35-second runs. |

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
    sim/              pure event models (sprint, javelin, lift, archery, clay, ski, biathlon, curling, bob, caber, dive, footbag, surf, halfpipe), scoring, rng (unit tested)
    events/           one Scene per event + registry (events/index.js)
    scenes/           title, setup, practice, cards/results/standings/podium
    winter.js         shared winter scenery (sky, mountains, pines, snowfall)
    beach.js          shared beach scenery (sky, sea, sand, palms, lifeguard hut, crowd)
    competition.js    turn order, CPU results, points
tools/                export-sprites.mjs, png.mjs, serve.mjs
tests/                node --test
```

**Adding an event:** write a pure model in `src/game/sim/`, a Scene in `src/game/events/` that calls `onDone(value|null)`, and register it in `src/game/events/index.js`. Menus, competition, scoring and records will pick it up automatically.

```sh
npm test
```
