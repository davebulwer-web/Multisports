# Publishing Podium '88

Podium '88 is a static web game: plain HTML, JavaScript modules and PNGs, with
no server code and no dependencies. Publishing it means putting those files on
a web host.

## 1. Build the package

```sh
npm run package
```

This writes two things into `dist/` (which git ignores):

| Output | Use it for |
|---|---|
| `dist/podium-88-<version>.zip` | itch.io, Newgrounds, Game Jolt, or any host that takes a zip with `index.html` at the top |
| `dist/podium-88/` | the same files unzipped, for any other static host (Netlify drop, your own server) |

Only what the browser needs goes in: `index.html`, `studio.html`, `src/` and
the baked sprite sheets, title backdrop and palette (about 330 KB zipped).
Tools, tests, docs and the per-frame source art in `assets/art/` stay out.
The build also scans every shipped file and refuses to finish if anything
looks like an API key.

Bump `version` in `package.json` before building a new release so each zip
has its own name.

To try the package before uploading, serve the folder and play it:

```sh
npx serve dist/podium-88      # or: cd dist/podium-88 && python3 -m http.server
```

(Opening `index.html` straight from disk won't work: browsers don't load ES
modules from `file://`. Every web host is fine.)

## 2a. itch.io

1. Sign in at itch.io and choose **Upload new project**.
2. **Kind of project:** HTML.
3. **Uploads:** upload `dist/podium-88-<version>.zip` and tick
   **This file will be played in the browser**.
4. **Embed options:**
   - Viewport: **1152 × 648** (exactly 3× the 384 × 216 screen, so the pixels
     stay crisp). The game picks the largest whole-number scale that fits.
   - Tick **Mobile friendly** only if you're happy for it to be shown on phones:
     the game needs a keyboard or gamepad.
   - Tick **Fullscreen button**.
   - Leave **Click to launch in fullscreen** unticked; the game plays fine inline.
5. Fill in the title, a short description, genre (Sports), tags
   (`retro`, `pixel-art`, `sports`, `local-multiplayer`, `8-bit`), and the
   screenshots in the project files.
6. Set **Visibility** to *Draft* first, open the page and play an event to
   check it, then switch to *Public*.

Records and line-ups are kept in the player's browser (`localStorage`), which
works inside the itch.io embed.

To update the game later, build a new zip and replace the upload (or add it
and remove the old one) on the same project page.

## 2b. GitHub Pages

The repo already deploys from `main` (root) at
<https://davebulwer-web.github.io/Multisports/>, so every merged PR is live.
No build step is needed for Pages: it serves the repo as it is. (It also
serves the tools and source art, which is harmless.)

## 3. Before you go public: rights checklist

Everything below was checked in the repo on 2026-11-13.

- **API keys.** No PixelLab key (or any other key) is in the code or anywhere in
  the git history. The PixelLab tools only read `PIXELLAB_API_KEY` from the
  environment. Keep it that way: never paste the key into a file.
- **Music and sound.** All audio is synthesised in the browser at run time
  (`src/engine/audio.js`, `src/game/music.js`). No audio files ship. The title
  theme, ceremony march and victory fanfares are original.
  `podium-theme.mp3` in the project files is only a recording for listening and
  is not part of the game.
- **National anthems.** Only melodies long out of copyright are used (GBR, USA,
  FRA, GER, ITA, NED, AUT, ESP, POL, NOR, DEN, CAN, JPN, AUS). Nations whose
  anthem may still be in copyright (CHN, JAM, KEN) get an original fanfare; see
  `FANFARE_REASONS` in `src/game/anthems.js`. The chiptune arrangements are our
  own. The melodies were checked against the CC BY 4.0 MIDI collection
  `Maicarons/openttd-national-anthem`; no MIDI is shipped and the tunes
  themselves are public domain, but a line in the credits is a courtesy.
- **PixelLab art.** Several sprites, the ad-board logos and the title backdrop
  were generated with PixelLab and then edited. Check PixelLab's current terms
  of service for your plan before selling the game or publishing it
  commercially; paid plans are generally the ones that grant commercial use.
  Keep your subscription active at least until the art you used was made, and
  note the date.
- **Names and brands.** The game name, sponsors on the advertising boards and
  logos are invented (`src/art/brands.js`); no real trademarks are used. Flags
  are drawn in code.
- **Fonts.** Drawn in code (`src/engine/font.js`); no font files.
- **Licence.** The repo has no `LICENSE` file, which means "all rights
  reserved" by default. That's fine for itch.io. If you'd like others to reuse
  the code, add a licence (MIT is the usual choice for code) and keep the art
  separate if you don't want that reused.
