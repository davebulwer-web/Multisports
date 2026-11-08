# Sprites: export, edit, import

## Format

Each sheet is two files in `assets/sprites/`:

- `<name>.png`: RGBA frames on a fixed grid, 8 per row.
- `<name>.json`: Aseprite "Array" export: `frames[]` (rect + `duration` in ms) and `meta.frameTags[]` (animation name, `from`, `to`).

Multisports also reads two optional extras from `meta.multisports`:

| Key | Meaning | If missing |
|---|---|---|
| `pivot` `{x,y}` | Point inside each frame that sits on the ground (the feet). | An Aseprite slice named `pivot`, otherwise bottom-centre. |
| `anchors` `{frameIndex: {handF:[x,y], handB, head, hip, footF, footB}}` | Where props attach. The javelin, barbell, bow and gun are drawn at `handF`; ski jump skis are drawn under `footF`/`footB`. | Borrowed from the built-in rig, so keep hands and feet roughly where the rig puts them. |

| Sheet | Frame | Used for |
|---|---|---|
| `athlete` | 40×64, pivot (20,62) | Every athlete. Recoloured per player. |
| `props` | 16×16 | Medals, judges' lights, crowd fans (2 frames each: seated/cheering), the ceremony `torch` and `dove` (2 frames). |
| `scenery` | 64×48, pivot (32,47) | Pines (`pine_12/18/26`, picked by size), caber marquee (`tent`), clay trap houses (`trap_left/right`), stadium floodlight (`tower`), beach `palm`, `lifeguard` hut and the opening ceremony `cauldron`. Drawn by the centre of their base. |
| `boards` | 96×16, drawn by the top-left | Advertising boards, one frame per brand, tagged with the brand id (`zapcola`, `sprintex` …). See *Advertising boards* below. |

If a sheet's files are missing, the game bakes it from the rig at startup, so it always runs.

## Workflow

1. `npm run export-sprites` (or download from **Sprite Studio**) to get the current PNG + JSON.
2. Open the PNG in your editor and paint over it with **`assets/palette.gpl`** loaded.
   - **Aseprite:** *File → Import Sprite Sheet* (40×64 grid), then *File → Export Sprite Sheet* with *Array* + *Tags* ticked. Name your tags the same as the originals.
   - **Any other editor:** keep the grid and edit the PNG in place. The existing JSON still describes it.
3. Save over `assets/sprites/athlete.png` (and the JSON if you changed frames or timings), then reload the game. You can use Sprite Studio's *Try your own art* box to preview first.
4. Re-running the exporter **won't overwrite** a PNG that differs from the last rig export. Use `--force` if you want to throw away your edits.

### More frames, bigger frames

- **Smoother animation:** add frames to a tag and update `from`/`to` (Aseprite does this for you). Per-frame `duration` controls the timing.
- **Bigger or more detailed frames:** change the frame size in the JSON and set `meta.multisports.pivot` to the new feet position. The game draws frames at their native size, relative to the pivot.
- **The sprint run animation speed** follows the runner's speed, so give `run` an even number of frames for a clean stride.

## Palette and recolouring

The palette extends the classic 16-colour 8-bit home-computer palette into shade ramps (see `src/art/palette.js`). For example, `red.0`–`red.3` run from shadow to highlight.

Four **key ramps** are swapped per player at load time by exact RGB match:

| Ramp | Hex (dark → light) | Swapped for |
|---|---|---|
| `kitA` | `#7a1030 #c0204a #f05a78` | Vest colour |
| `kitB` | `#103a7a #2060c0 #5a90f0` | Shorts colour |
| `skin` | `#8a4a2a #c07850 #e8a878` | Skin tone |
| `hair` | `#2a1608 #50301a` | Hair colour |

Paint kit and skin with these exact colours and every player variant will work. Any other palette colour stays as it is. Kits and skin tones are defined in `KITS` and `SKINS` in `palette.js`.

## The pose rig

`src/art/athlete.js` describes poses as joint angles (0° = limb pointing down, +90° = forward, 180° = up) and rasterises them with automatic shading and a dark outline. It's a quick way to block out new animations: add a pose, add a tag in `animations()`, then export and paint over it.

## Finished frames (`assets/art/`)

A PNG at `assets/art/<sheet>/<tag>_<n>.png` replaces that one frame of the rig when the sheet is exported (the name matches the frame's `filename` in the JSON, without the sheet name). Each file must be exactly one frame (40×64 for athletes) and use only palette colours, keeping the key ramps for kit, skin and hair. Then run `npm run export-sprites`.

This is the best place for finished art: the rest of the sheet still bakes from the rig, so adding a new event's animations doesn't clash with hand-finished frames, and the exporter doesn't have to skip `athlete.png`.

### PixelLab

`tools/pixellab-enhance.mjs` sends rig frames to PixelLab's *edit image* model, which redraws them with more detail in the same pose, then snaps the colours to the athlete palette and writes the overrides:

```
PIXELLAB_API_KEY=... npm run pixellab -- caber_hold dive_edge_1
PIXELLAB_API_KEY=... npm run pixellab -- --seed 3 --desc "barefoot cliff diver ..." dive_tuck
PIXELLAB_API_KEY=... npm run pixellab -- --sheet scenery --desc "palm tree ..." palm
```

Arguments are tags or single frames. Existing overrides are skipped unless `--force`. Each frame costs one generation. Check every result (compact poses like a pike or tuck sometimes come back in the wrong pose; try another `--seed`), then export. Keep the key in the environment, never in a file. Behind an HTTPS proxy, run Node with `NODE_USE_ENV_PROXY=1`.

Every athlete, props and scenery frame was made this way (the diving pike was also trimmed to the rig outline). Athlete frames snap to the athlete colours; `--sheet props` or `--sheet scenery` snaps to the full palette instead.

## Advertising boards

The trackside hoardings come from the `boards` sheet: one 96×16 frame per invented 80s sponsor. The brands live in **`src/art/brands.js`**, each with a name, a tagline, the season tabs it suits (`summer`, `winter`, `world`, `beach`, `challenge`, or `any` for everywhere), a background style, palette colours, a lettering style (`plain`, `tall`, `wide`, `italic`, `outline`) and a prompt for its logo.

- **Lettering** is drawn by `src/art/boards.js` from the game's 5×7 font (names) and a 3×5 font (taglines), so every word stays readable. The baker throws (and the tests fail) if a name or tagline doesn't fit.
- **Logos** are 16×16 PixelLab art stored as palette rows in `src/art/logos.js`. To make or redo them:

  ```
  PIXELLAB_API_KEY=... npm run pixellab-logos                     # every brand without a logo
  PIXELLAB_API_KEY=... npm run pixellab-logos -- --force --seed 3 zapcola
  npm run export-sprites -- boards
  ```

  Each logo costs one generation. You can also edit the rows in `logos.js` by hand: `.` is transparent, any other character is a palette index.
- **Hand-painted boards:** like every sheet, `assets/art/boards/<brand>_0.png` (96×16, palette colours) replaces that board at export.
- **Where they appear:** `drawBoardRow()` in `src/game/boards.js` draws a scrolling row from a season's pool (its own brands plus the `any` ones). The stadium events (including the hammer) and rowing use the summer pool, speed skating and figure skating the winter pool, caber and log rolling the world pool, the assault course and gym tests the challenge pool, and footbag and BMX the beach pool; the title screen cycles through every brand. Each row is shuffled per event and per competition, so no two neighbouring boards repeat. To add a sponsor, add a brand, run the logo tool, then export.

## Opening ceremony

The ceremony (`src/game/scenes/ceremony.js`) uses the athlete tags `march` (flag bearer, pole drawn at `handF`), `torch_run` and `torch_raise` (the `torch` prop is drawn at `handF`), and `wave`, plus the `dove` prop and the `cauldron` scenery frame. Flames, fireworks and the stairs are drawn in code. Flags are shape rules in `src/art/flags.js`, so they scale to any size and stay in the palette; add a nation there and it appears in the setup screen's NATION column.

