## Goal

Let the battle draw each unit from a painted image when one exists, and fall back to the existing procedural drawing when it doesn't. The images don't exist yet, so this run builds three pieces and tests them with generated stand-in images:

- the loader and renderer;
- a tool that turns raw images (flat green or magenta background) into trimmed transparent WebP files plus a manifest;
- painted-mode checks in `npm run sprites`.

The art spec is `docs/unit-art.md`; read it but don't change it.

## Files to touch

- `package.json`, `package-lock.json`: add devDependency `sharp@0.35.5` (exact) and scripts `units:prepare`, `units:test`
- `.gitignore`: add `art/units/`
- `tools/units/ids.ts`: new, the list of unit art ids
- `tools/units/prepare.ts`: new, background removal, trim and manifest
- `tools/units/fixture.ts`: new, generates stand-in raw images for testing
- `src/sprites/painted.ts`: new, art registry, loader and painted renderer
- `src/sprites/finish.ts`: use painted art when present
- `src/sprites/index.ts`: re-export the painted API
- `tools/sprite-sheet/entry.ts`, `tools/sprite-sheet/run.mjs`: add `--painted` mode

## Steps

### Lead, sequential (steps 1–2)

1. Run `npm ci`. Then run `npm install --save-dev --save-exact sharp@0.35.5`. Add `art/units/` to `.gitignore`. Add these scripts to `package.json`:
   - `"units:prepare": "esbuild tools/units/prepare.ts --bundle --platform=node --format=esm --packages=external --outfile=node_modules/.cache/units/prepare.mjs --log-level=warning && node node_modules/.cache/units/prepare.mjs"`
   - `"units:fixture": "esbuild tools/units/fixture.ts --bundle --platform=node --format=esm --packages=external --outfile=node_modules/.cache/units/fixture.mjs --log-level=warning && node node_modules/.cache/units/fixture.mjs"`
   - `"units:test": "npm run -s units:fixture -- /tmp/units-raw && npm run -s units:prepare -- --in /tmp/units-raw --out /tmp/units-out && UNITS_DIR=/tmp/units-out npm run -s sprites -- --painted"`

2. Create `src/sprites/painted.ts` with exactly this public API. Bodies are stubs that W2 fills in; the stub `drawPainted` returns `false`.
   ```ts
   import type { Unit } from '../combat';
   export interface UnitArtMeta { file: string; w: number; h: number; footX: number }
   export interface UnitArtManifest { version: 1; units: Record<string, UnitArtMeta> }
   /** Target height in local unit space (feet at y = 0) for each art id. */
   export const PAINTED_HEIGHT: Record<string, number> = { /* table below */ };
   export function artIdFor(u: Unit): string | null;
   export function registerUnitArt(id: string, img: CanvasImageSource, meta: UnitArtMeta): void;
   export function hasPaintedArt(u: Unit): boolean;
   export function loadUnitArtManifest(baseUrl?: string): void;   // default './assets/units'
   export function drawPainted(ctx: CanvasRenderingContext2D, u: Unit, time: number): boolean;
   ```
   Fill `PAINTED_HEIGHT` with:
   `warden 241, pyromancer 192, shadowblade 174, spiritcaller 215, cinder-imp 132, ash-hound 109, magma-brute 177, molten-warden 220, bramble-stalker 157, spore-wisp 104, hollow-treant 174, pale-stag 217, rime-wolf 109, frost-wraith 150, ice-golem 181, winters-herald 176, drowned-acolyte 148, tide-revenant 213, coral-sentinel 129, leviathan-eye 187, void-knight 216, ash-seraph 176, dusk-wyrm 171, ashen-king 245, spirit-wolf 110`.
   Add `export { artIdFor, registerUnitArt, hasPaintedArt, loadUnitArtManifest, type UnitArtMeta, type UnitArtManifest } from './painted';` to `src/sprites/index.ts`. Create `tools/units/ids.ts` exporting `UNIT_ART_IDS: string[]`: the 25 keys of `PAINTED_HEIGHT` in the order above. Run `npm run build`; it must exit 0.

## Parallel work

After step 2, run three workstreams in parallel, one subagent each, each with only its own files. Each runs only its own acceptance command. The VM has 2 GB of RAM, so only one browser at a time.

**W1: image tools.** Owns `tools/units/prepare.ts` and `tools/units/fixture.ts`.
- `prepare.ts` (Node, `sharp`):
  - Arguments: `--in <dir>` (default `art/units`) and `--out <dir>` (default `public/assets/units`). Ignore a bare `--`. Create `--out` if missing.
  - Inputs: every file in `--in` named `<id>.png|jpg|jpeg|webp` or `<id>-attack.<same>`, where `<id>` is in `UNIT_ART_IDS`. Warn and skip any other file.
  - For each file:
    1. Load it as RGBA. If its longest side is over 1024, resize to 1024 (lanczos3).
    2. **Already transparent?** If the mean alpha of the four 12×12 corner patches is below 16, skip keying.
    3. **Key.** Background `B` is the per-channel median of all pixels in the four corner patches. For each pixel with colour `C`:
       - `d` = Euclidean RGB distance from `C` to `B`;
       - `a = clamp((d - 36) / 48, 0, 1)`;
       - `alpha = min(alpha, round(a * 255))`;
       - where `0.05 < a < 1`, un-mix the colour: `C' = clamp((C - (1 - a) * B) / a, 0, 255)`.
    4. **Specks.** Label 4-connected components of pixels with alpha > 40. Zero the alpha of every component smaller than 2% of the largest.
    5. **Trim** to the bounding box of alpha > 40, with 4 px padding.
    6. If the height is over 640, resize to height 640, keeping aspect ratio (lanczos3).
    7. **Feet.** `footX` = the mean x of pixels with alpha > 40 in the bottom 4% of rows (`w / 2` if there are none), rounded.
    8. Write `<out>/<name>.webp` (`quality 86`, `alphaQuality 100`, `effort 5`), where `<name>` is the input file name without extension.
  - Validation, per file:
    - after step 3, every corner patch has mean alpha < 8;
    - after step 4, the opaque fraction (alpha > 40) of the untrimmed image is between 0.03 and 0.90.
    A file that fails is reported and not written.
  - Write `<out>/manifest.json` as `{ "version": 1, "units": { "<name>": { "file": "<name>.webp", "w", "h", "footX" } } }`. Merge with an existing manifest, keeping only entries whose file still exists in `--out`. Keys are sorted.
  - Print one row per file: name, output size, `keyed` or `alpha`, opaque %, `ok` or the error. Exit 1 if any file failed.
- `fixture.ts` (Node, `sharp`): one positional argument, the output directory (created if missing; ignore a bare `--`).
  - Write a 1024×1024 PNG for each id in `UNIT_ART_IDS`, plus `warden-attack.png`.
  - Each is an SVG rendered with `sharp`, on a flat background: `#FF00FF` when the unit's main colour has green above red and above blue, otherwise `#00FF00`.
  - The character's main and dark colours come from `src/data.ts`: classes, enemies and bosses by id. `spirit-wolf` uses `#6ef2b1` / `#1e5c40`.
  - The figure has antialiased edges, a radial-gradient fill (main to dark) and its lowest point at y 990:
    - ids `ash-hound`, `rime-wolf`, `spirit-wolf`, `pale-stag`, `dusk-wyrm`: a quadruped (horizontal body ellipse about 560×240, four legs, a head circle at the right);
    - every other id: an upright figure (two legs, a torso ellipse about 300×420, a head circle, an arm holding a sword line toward +x).
    - `warden-attack` is the warden figure leaning 15° toward +x.
- W1 acceptance: `npm run -s units:fixture -- /tmp/units-raw && npm run -s units:prepare -- --in /tmp/units-raw --out /tmp/units-out` exits 0, prints 26 `ok` rows, and `/tmp/units-out/manifest.json` has 26 units.

**W2: painted renderer.** Owns `src/sprites/painted.ts` and `src/sprites/finish.ts`.
- `artIdFor(u)`:
  - hero: `u.classId`;
  - ally: `'spirit-wolf'`;
  - enemy: the `id` of the enemy or boss in `LOCATIONS` (from `src/data.ts`) whose `name === u.name`. Build the lookup once.
  - Otherwise `null`.
- `registerUnitArt` stores the image and meta by id (the id may end in `-attack`). `hasPaintedArt(u)` is true when the idle image for `artIdFor(u)` is registered.
- `loadUnitArtManifest(base = './assets/units')`, idempotent:
  - Fetches `${base}/manifest.json` once. A failed fetch or bad JSON is silently ignored, and the game stays procedural.
  - For each unit id it needs, creates `new Image()` with `src = ${base}/${meta.file}` only when `drawPainted` first asks for that id (and its `-attack` partner), and registers it on `load`.
- Call `loadUnitArtManifest()` once from `drawFinishedUnit` on first use, but only when `typeof document !== 'undefined'` and `window.location.protocol !== 'about:'`, so the sprite-sheet page (`about:blank`) never fetches.
- `drawPainted(ctx, u, time)` returns `false` if there is no art. Otherwise it draws in local space (feet at (0, 0), facing +x) and returns `true`:
  - Size: `s = PAINTED_HEIGHT[id] / meta.h`. The image is drawn at `(-footX * s, -meta.h * s, meta.w * s, meta.h * s)`, under these transforms around the pivot (0, 0), in order:
    - `b = sin(time * 2.2 + uid * 1.3)`;
    - floaters (`spore-wisp`, `frost-wraith`, `ash-seraph`): `translate(0, -10 - 6 * sin(time * 1.8 + uid))`;
    - `translate(12 * attack, -8 * cast)`;
    - `rotate(0.012 * sin(time * 1.3 + uid) + 0.17 * attack)`;
    - `scale((1 - 0.008 * b) * (1 + 0.06 * attack) * (1 + 0.04 * cast), (1 + 0.018 * b) * (1 - 0.04 * attack) * (1 + 0.04 * cast))`.
  - Attack frame: if `<id>-attack` is registered, draw the idle image at alpha `1 - f` and the attack image at alpha `f`, where `f = clamp((attack - 0.15) / 0.25, 0, 1)`. The attack image uses its own meta for size and feet.
  - Cast glow, after the image, only when `cast > 0`:
    - with `globalCompositeOperation = 'lighter'`, a radial gradient of `u.colors.glow` (alpha `0.55 * cast` at the centre, 0 at the edge), centred at `(0.15 * H, -0.62 * H)` with radius `0.45 * H`, where `H = PAINTED_HEIGHT[id]`;
    - then the image again with `'lighter'` at alpha `0.22 * cast`;
    - then restore `source-over`.
- `finish.ts`:
  - In the raw render step, use `drawPainted(off, u, time)` first and fall back to the existing procedural call only when it returns `false`.
  - Add `hasPaintedArt(u) ? 1 : 0` to the cache key.
  - Skip the grain texture step (c) for painted units; keep grounding, grade and rim.
- W2 acceptance: `npm run build` exits 0, and `npm run sprites` still ends `sprites: 25/25 pass` (no art is loaded in that mode).

**W3: sprite-sheet painted mode.** Owns `tools/sprite-sheet/entry.ts` and `tools/sprite-sheet/run.mjs`. Use only the API from step 2.
- `entry.ts`: add `spriteSheet.addArt(id: string, dataUrl: string, meta: UnitArtMeta): Promise<void>`. It loads the data URL into an `Image`, awaits `decode()`, and calls `registerUnitArt`. Add `spriteSheet.isPainted(index): boolean`, which calls `hasPaintedArt`.
- `run.mjs`: parse `baseline` and `--painted` from `process.argv` (ignore a bare `--`). Without `--painted`, behaviour is exactly as now and no art is loaded. With `--painted`:
  - Read `${process.env.UNITS_DIR ?? 'public/assets/units'}/manifest.json`. For every entry, pass the WebP to `addArt` as a `data:image/webp;base64,…` URL before rendering.
  - Check each unit with the same rules as normal mode, except:
    - the `w / baseline.w` rule is dropped;
    - the height window is `0.80 <= h / baseline.h <= 1.30`;
    - it adds `painted`: `isPainted(index)` must be true;
    - it adds `fringe`: in `idleA`, pixels with alpha > 40 that are near pure key colours (`g > 200 && r < 70 && b < 70`, or `r > 200 && b > 200 && g < 70`) must be at most 0.2% of opaque pixels.
  - Write `sprite-out/painted-idle.png`, `painted-attack.png` and `painted-cast.png`, plus `sprite-out/painted-report.json`.
  - The last line is `sprites (painted): N/N pass`. Exit 1 on any failure.
- W3 acceptance: `npm run build` exits 0, and `npm run sprites` still ends `sprites: 25/25 pass`.

**Integration (lead, after all three):** run the full **Acceptance**. If `npm run units:test` fails, fix the cause in the owning file (the lead may edit any file in **Files to touch** here). Do not change thresholds.

## Acceptance

- `npm run build` exits 0.
- `npm run sprites` exits 0 and its last line is `sprites: 25/25 pass`.
- `npm run units:test` exits 0 and its last line is `sprites (painted): 25/25 pass`.
- `test -f sprite-out/painted-idle.png && test -f sprite-out/painted-attack.png && test -f /tmp/units-out/manifest.json` exits 0.
- `node -e "const m=require('/tmp/units-out/manifest.json'); process.exit(Object.keys(m.units).length===26?0:1)"` exits 0.
- `test ! -e public/assets/units` exits 0. No real art is committed in this run.
- `npm test` prints `2 of 11 targets fail:` listing exactly `boss-retry` and `parity` (unchanged).

## Constraints

- Do not commit, push, or switch branches.
- A step may touch a file outside **Files to touch** when it has to. List every such file in the report under "outside the plan", one line each saying why.
- The only checks to run are the **Acceptance** commands and each workstream's acceptance command. Do not write or run extra end-to-end tests, and do not start a dev server. If something outside Acceptance fails, note it in the report and finish.
- Do not change `src/sprites/heroes.ts`, `creatures.ts`, `bosses.ts`, `kit.ts`, `src/art.ts`, `src/combat.ts`, `src/data.ts`, `src/balance.ts`, `src/state.ts`, `src/ui.ts`, `src/main.ts`, `src/style.css`, `docs/unit-art.md` or `tools/sprite-sheet/baseline.json`.
- Do not loosen any threshold in `run.mjs`'s normal mode, or the painted-mode thresholds above.
- Write generated test images only under `/tmp`. Never write under `public/assets/units` or `art/units`.

## Out of scope

- Making or editing real painted art.
- Changes to the procedural designs, the backgrounds, the UI, ability VFX or unit positions.
- Animation beyond the transforms above (no skeletal rigs, no sprite-sheet frame animation besides the optional attack frame).

## If blocked

- If `sharp` fails to install or load, try `npm rebuild sharp` once. If it still fails, stop and report the error.
- If Chromium will not launch, try `dnf install -y chromium` once. If it still fails, stop and report.
- If a stand-in fixture unit can't pass the painted checks, report its numbers and the rule it fails. Do not change the thresholds or `PAINTED_HEIGHT`.
