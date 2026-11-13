# Podium '88

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
| **Long Jump** | Speed + take-off | Stride down the runway with ← → on the beat, just like the sprint, to build speed. Near the board hold ↑ to gather: the take-off angle climbs while you hold, and you take off when you let go. Let go on the white board: past its front edge is a foul, and every centimetre behind it is lost from the jump. About 20° is best; steeper costs speed, flatter loses height. In the air press ↓ just before you land to shoot your legs forward; too early drops them short, and never pressing it leaves you falling back. Three jumps, best counts. |
| **Javelin** | Power + angle | Hold Space to run up and let go to plant. You slide on after planting, so plant just short of the line. Then lock the release angle; around 33–37° is best. Wind affects the throw, and a flat landing scores no mark. Three throws. |
| **Weightlifting** | Timing + balance | Pick the weight, hit the pull gauge, then the drive gauge. After that, keep the bar centred with ← → for 3 seconds. Two of the three judges' lights make a good lift. Heavier bars give tighter windows and more wobble. |
| **Archery** | Fine control | Hold Space to draw the bow, then keep holding while you steady the sight. It sways with your breathing and has momentum, so nudge it with the arrow keys rather than yanking it. Aim off into the wind and let go to shoot. Hold too long and your arms start to shake. Six arrows, scored 10 (gold) to 1, out of 60. |
| **Clay Pigeon** | Reaction + tracking | Press Space to call for the clay, which comes from the left or right trap after a short random delay. Swing the sight after it with the arrow keys (it has momentum) and fire ahead of it, because the shot takes time to get there. The further away the clay, the more lead it needs, but the pattern also spreads wider. Six singles then three doubles, two shells per round, scored out of 12. |
| **Pistol Shooting** | Recoil + rhythm | Rapid fire at five turning targets: they face you for 8 seconds, then 6, then 4. Press Space to load, wait for the green lights, then bring the sight up with the arrow keys (it has momentum) and put one shot in each target, left to right. Every shot kicks the muzzle up, so ride the kick back down onto the next target before you fire: rush it and the shot goes high, dawdle and the targets turn away. The hand trembles more the longer the arm is up. Rings score 10 down to 5 and a second hole in the same target scores nothing. Three series, 150 is perfect. |
| **Pole Vault** | Speed control + timing | Pick a pole with ← → and a bar height with ↑ ↓. Each pole only bends properly in its own band of run-up speed (the green mark on the speed bar): hold Space to run and ease off to arrive in it, since flat out is too fast even for the stiff pole. Press ↓ at the white take-off mark to plant; too close and you run under the pole, too far and it won't carry you. Press Space as the pole reaches full bend to rock back, then ↑ as it straightens to push off. Every mistake wastes energy and height. Clear a bar to go higher; six jumps, and three failures in a row puts you out. Your best clearance counts. |
| **Hammer Throw** | Rhythm + release | Press Space for two wind-ups, then the thrower turns. On every turn press Space once as the ball sweeps through its low point (the green arc on the swing dial): on time spins it faster, off time adds less and costs balance, and a second press in the same turn is a stumble. Press ↑ to let go while the ball is in the yellow arc: early hits the cage, late lands outside the sector. A sixth turn takes you out of the circle. Three throws, best counts. |
| **Rowing** | Rhythm + pacing | 500 metres against a rival boat. Hold Space to drive (the seat slides back) and let go at the back of the slide; early wastes the stroke, holding on catches a crab. Press again as the seat rolls to the front: early is a rushed stroke that checks the boat, late lets it sit and slow. Hold ↑ during the drive for a power stroke, which burns stamina; run out and every stroke goes weak, so save it for the sprint. Two false starts disqualify you. Lowest time wins. |
| **Gymnastic Vault** | Timing + rotation | Pick a vault with ← →: front tuck, front pike (spins slower) or double front (needs a big take-off). Hold → to sprint at the table, press ↓ to hurdle so you land on the springboard's red sweet spot, and press Space as your hands meet the table to block off it. Speed, board and block decide how high you fly and how fast you spin. You spin until ↑ opens you out: open so the slow open turn brings you down upright (the dial shows your body), then hold the landing with ← →; too far either way and you take steps or fall. Score is difficulty plus execution (10 less deductions). Two vaults, averaged. |
| **Ski Jump** | Timing + balance | Press Space to push off and hold ↓ to tuck down the inrun for speed. Press Space again right on the lip to spring: early or late costs height and leaves you rotating. In the air the flight position is unstable, so keep your lean in the green with ← →. Press Space just before touchdown for a telemark landing, but not too early, because setting it kills your lift. Two jumps, each scored as distance points (60 at the 120 m K-point, 1.8 per metre) plus style from five judges (middle three count). Lean too far forward and you go over; land past the hill size without a telemark and you fall. |
| **Biathlon** | Pacing + steady aim | Ski three legs, holding → to push. Your heart rate climbs as you push (and faster on the climbs). Go past the redline and the burn slows you right down, so ease off to recover. At each range (prone, then standing) steer the sight onto five targets and fire with Space. The sight sways with your breathing and jumps with every heartbeat, so you either wait for your heart to settle or shoot quickly and risk misses. Prone only counts the inner ring; standing counts the whole target but sways more. Each miss adds 10 seconds. Lowest time wins. |
| **Curling** | Judgement + sweeping | A top-down sheet. Move the broom you're aiming at with ↑ ↓ and pick the turn with ← → (the stone curls more as it slows). Press Space, then press Space again to stop the swinging weight gauge in the guard, draw or takeout band. Once the stone is on its way, hold Space to sweep it before the tee line: it travels further and curls less. Stones collide, so you can knock theirs out. Four ends with a different set-up each (open house, centre guard, a stone on the button, guard plus shot stone), and two stones per end. Your stones that are closer than every opposition stone score their ring: button 4, 4-foot 3, 8-foot 2, 12-foot 1. Best possible score is 32. |
| **Figure Skating** | Rhythm + routine | A free skate to the waltz: every move is judged against the beat (the dots sliding into the line at the bottom). Space on a beat strokes for speed and flow. ↑ on a beat takes off, and Space on the next beat lands: the faster you're going, the more turns you get in (the panel shows single to quad). Land late, or not at all, and you fall. Hold ↓ to spin (it burns speed) and let go on a beat. The judges add up the elements (repeats are worth less, and jumps after the seventh score nothing) and mark the flow. |
| **Caber Toss** | Balance + timing | Press Space to pick up the caber, then hold Space to run with it balanced on your hands. Running harder pulls the base under it so it leans back; easing off lets it topple forward, so you balance it with your speed. It also drifts sideways, which you steer back with ← →. Near the end of the run, ease off to let it tip forward into the green zone and press ↑ to toss. Too slow or leaning back and it won't turn over. The judges score how straight it lands on a clock face: 12:00 scores 100, falling to 0 at 9:00 or 3:00. Sideways lean and wobble at the release send it off line. Three tosses, out of 300. |
| **Cliff Diving** | Timing in the air | Pick a dive (each one once, harder dives have a higher degree of difficulty). Press Space at the top of the arm swing to take off, and keep holding to tuck or pike, which spins you fast. Let go to open out: the open body only turns slowly, so open at the moment the slow turn will bring you upright, feet first, as you hit the water. The somersault bar shows how far you've turned and where you'd finish if you opened now. Hold ↑ to put your arms out and slow the turn a little more. Five judges mark the entry, take-off and how long you showed a straight line. The middle three count, multiplied by the degree of difficulty. Three dives. |
| **Canoe Slalom** | Steering + current | Seen from above, the river runs up the screen. Each stroke pushes the kayak on and turns it: ← turns left, → turns right, so alternate them to go straight, and ↓ back-paddles. Strokes take time, so mashing doesn't help. The current carries you on, drifts you sideways and swirls back upstream in the eddies below the big rocks. Take green gates going downstream and red gates going back upstream from the eddy. Touching a pole adds 2 seconds and missing a gate 50. |
| **Log Rolling** | Balance + bluff | You and a rival share a floating log. ← → lean you to keep your balance gauge out of the red. ↑ ↓ change the log's pace. Your feet catch up quickly with your own pace changes but more slowly with your rival's (and theirs with yours), so a sudden change, best made while they're already wobbling, tips them in. First to two dunkings wins; a round still going at 40 seconds goes to the steadier roller. 100 points a round won plus a bonus for winning it quickly. |
| **Footbag** | Timing + rhythm | A minute on the sand keeping the bag up. Each kicking surface has its own height: press ↓ to kick with the foot, Space for the knee and ↑ to head it, just as the bag falls through that height (the gauge on the left shows the zones). Step with ← → to stay under it: clean contacts pop it straight up, scuffed or stretched ones send it drifting. A miss leaves you off balance for a moment, so mashing drops the bag. Points grow with clean contacts, with mixing surfaces (three different in a row doubles them) and with the unbroken string (up to ×3). Press X while it's up high to spin, then kick it cleanly for a spin bonus. |
| **Surfing** | Balance + line | Seen from the beach, the wave peels to the right with the curl chasing you. Press Space to pop up as the wave lifts you (the green part of the bar). The board turns towards whichever arrows you hold. Dropping down the face gains speed, climbing loses it, and the wave's push fades out on the shoulder, so cut back towards the curl when you get too far ahead. Points for bottom turns, top turns and turns off the lip, cutbacks, tube rides (let the curl catch you mid-face, then outrun it) and airs (hit the lip fast, then turn to face down before you land). Repeats are worth less each time. Get caught in the white water and you wipe out. Two 30-second waves. |
| **Half-pipe** | Pumping + air control | Press Space as you roll off the flat into each wall (the yellow marks) to pump: well timed, it adds speed; mistimed, it loses some. Leave the coping with speed and you fly up: hold ← or → to spin and ↑ to grab. Let go of the grab before you land, and come down facing along the ramp: after a 180 or 540 you ride away forwards, after a 0 or 360 backwards (fakie). Anything in between is a slam. Airs score for height, spin and grabs; repeating a trick is worth less. Two 35-second runs. |
| **BMX** | Pumping + tricks | A dirt track by the beach against a 45-second clock. Hold ↓ as you roll down the back of each bump to pump for speed (holding it going uphill costs speed); Space pedals, but only on the flat and not very fast. Press ↑ just before each lip to pop off it. In the air, hold Space for a superman or ↓ for a can-can, let go in time to bring it back, and pitch the bike with ← → to match the landing slope. Come up short and you case the table top. Tricks only score when you ride away; reach the finish for a time bonus. |
| **Gym Tests** | Timing + stamina | Squat thrusts, then parallel bar dips, 30 seconds each. ↓ and ↑ in turn move you between the two lines (legs back and in; down and up on the bars), and a rep only counts if you reach both. Press the next way just as you hit the end to spring off it, which is quicker; turn back early and it's no rep. Springing tires you, and tired muscles move slower. Your score is the total reps. |

### Competition

You can have one to four hot-seat humans plus CPU rivals. Each event scores **10 / 7 / 4 / 2 / 1** for places 1–5, ties share the higher place, and fouls score 0. There are standings after each event and a podium at the end. Records are kept in the browser (localStorage).

Each competitor picks a **nation** on the line-up screen. Full competitions open with an **opening ceremony**: the competitors parade in behind their flags, a torch runner lights the stadium cauldron, then doves and fireworks start the games, all to an original chiptune march. Any button skips it; practice goes straight to the event.

**Anthems.** Picking a nation on the line-up screen plays the opening phrase of its anthem, and the overall champion's anthem plays in full (a 10 to 25 second chiptune clip) on the medal podium. Only melodies long out of copyright are used. Nations whose anthem is still in copyright, or hasn't been transcribed yet, get an original victory fanfare instead; the list is in `FANFARE_REASONS` in `src/game/anthems.js`. To add an anthem, write its melody and bass in the note notation described at the top of that file; `npm test` checks every bar adds up.

The title menu offers:

- **All events**: every event, season by season (Summer, Winter, World, Beach, Challenge).
- **Choose events**: build your own programme. Pick events from any season tab and they run in the order you picked them; *Add all* takes a whole season in one go. Your programme and line-up are remembered until you reload.
- **Practice**: pick one event and play it with the humans from your last line-up, no points.
- **World records**: the record and holder for every event, by season.

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
    sim/              pure event models (sprint, javelin, lift, archery, clay, ski, biathlon, curling, caber, dive, footbag, surf, halfpipe, vault, slalom, hammer, row, figure, logroll, bmx, gym, pistol, longjump, gymvault), scoring, rng (unit tested)
    events/           one Scene per event + registry (events/index.js)
    scenes/           title, setup, event picker, records, cards/results/standings/podium
    programme.js      season tabs and custom event order
    winter.js         shared winter scenery (sky, mountains, pines, snowfall)
    beach.js          shared beach scenery (sky, sea, sand, palms, lifeguard hut, crowd)
    competition.js    turn order, CPU results, points
tools/                export-sprites.mjs, png.mjs, serve.mjs
tests/                node --test
```

**Adding an event:** write a pure model in `src/game/sim/`, a Scene in `src/game/events/` that calls `onDone(value|null)`, and register it in `src/game/events/index.js` with a `season` (`summer`, `winter`, `world`, `beach`, `challenge`, or a new name, which gets its own tab). Menus, competition, scoring and records will pick it up automatically.

```sh
npm test
```
