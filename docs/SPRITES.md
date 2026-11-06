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
| `props` | 16×16 | Medals, judges' lights, crowd fans (2 frames each: seated/cheering). |

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
