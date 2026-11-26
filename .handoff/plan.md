## Goal

Make `npm run units:prepare` handle three problems seen in real art:

1. **Cast shadows.** A shadow darker than the flat background survives keying (a green blob under a unit's feet). Add colour-difference ("hue") keying, so anything with the background's hue goes, however dark.
2. **Edge halos.** Dark, thin edges blended with the background keep a tint of it (a magenta outline around vines). Add an edge despill band.
3. **Facing.** Some images face left. Add per-unit options in a committed `tools/units/options.json`: `flip` mirrors the image, and `hueKey: false` turns off hue keying and despill for a unit whose own colours match its background.

Prove all three on the stand-in fixtures with a new automated check.

## Files to touch

- `tools/units/prepare.ts`: hue keying, edge despill, options (flip, hueKey), spill column
- `tools/units/options.json`: new, `{ "pale-stag": { "flip": true }, "shadowblade": { "flip": true, "hueKey": false } }`
- `tools/units/fixture.ts`: add a cast shadow and a dark outline to the stand-ins
- `tools/units/check-units.mjs`: new, spill, shadow and flip checks on prepared output
- `package.json`: extend `units:test`
- `docs/unit-art.md`: add a short "Per-unit options" section

## Steps

1. Run `npm ci`.

2. In `tools/units/prepare.ts`:
   - **Options.**
     - New argument `--options <path>`, default `tools/units/options.json`.
     - The file maps a unit id to `{ flip?: boolean; hueKey?: boolean }`. A missing file means no options.
     - A file named `<id>-attack.*` uses the options of `<id>`.
     - Unknown ids or keys print a warning and are ignored.
   - **Key type.** After computing background `B`:
     - `green` when `B.g > B.r + 40 && B.g > B.b + 40`;
     - `magenta` when `min(B.r, B.b) > B.g + 40`;
     - otherwise `other`.
     Hue keying and despill run only for `green` and `magenta`, and only when the unit's `hueKey` is not `false`.
   - **Hue keying**, in the keying step, combined with the existing distance alpha. For each pixel `C`:
     - green: `ex = C.g - max(C.r, C.b)`, `ref = C.g`;
     - magenta: `ex = min(C.r, C.b) - C.g`, `ref = min(C.r, C.b)`;
     - if `ex > 24`: `k = ex / max(ref, 1)` and `aHue = 1 - clamp((k - 0.45) / 0.35, 0, 1)`; otherwise `aHue = 1`;
     - final `a = min(aDistance, aHue)`, and `alpha = min(alpha, round(a * 255))`.
     Apply the existing un-mix `C' = clamp((C - (1 - a) * B) / a)` with this final `a` wherever `0.05 < a < 1`.
   - **Edge despill.** After speck removal and before trimming:
     - Find every pixel with alpha > 40 within `R = max(2, round(0.004 * max(width, height)))` px (4-neighbour steps, multi-source BFS) of a pixel with alpha ≤ 40.
     - For those pixels: green sets `g = min(g, max(r, b))`; magenta sets `e = max(0, min(r, b) - g)`, then `r -= e` and `b -= e`.
     - Same conditions as hue keying.
   - **Flip.** When `flip` is true, mirror the image horizontally after trimming and resizing, before computing `footX`.
   - **Report.** Add a `spill` column: the % of the final image's opaque pixels with key-hue excess > 40 (`g - max(r, b)` for green, `min(r, b) - g` for magenta), or `-` for `other` keys. Add a `flip` marker to the row when flipped. The pass/fail rules don't change.

3. In `tools/units/fixture.ts`:
   - Every stand-in on the `#00FF00` background gets a flat cast-shadow ellipse in `#0A6E0A` (about 420×46, centred under the feet, touching the figure's lowest point, drawn before the figure).
   - Every stand-in on `#FF00FF` gets a 3 px `#141018` outline stroke around its body shapes, plus three thin (2 px) `#141018` vine curves crossing from the body outward. Each curve touches the body.
   - Keep everything else (ids, the `warden-attack` file, colours, the y 990 lowest point of the figure itself).

4. Create `tools/units/check-units.mjs` (Node ESM, `sharp`, run from the repo root): `node tools/units/check-units.mjs <preparedDir> <unflippedDir>`.
   - For every `<name>.webp` in `<preparedDir>` whose id doesn't have `hueKey: false` in `tools/units/options.json`, the spill % must be ≤ 0.3%. Spill is as defined in step 2, with the key type from the name's fixture background, using the same rule as `fixture.ts`.
   - For the same files, the bottom 6% of rows must contain no opaque pixel more than 25 px horizontally outside the opaque x-range of the rows just above them (rows 88–94%). That proves the shadow is gone.
   - For each id with `flip: true` in `options.json`, `<preparedDir>/<id>.webp` must equal `<unflippedDir>/<id>.webp` mirrored: same size, and every RGBA channel within 2.
   - Print one line per check, then `check-units: N/N pass`. Exit 1 on any failure.

5. In `package.json`, set `units:test` to:
   `npm run -s units:fixture -- /tmp/units-raw && npm run -s units:prepare -- --in /tmp/units-raw --out /tmp/units-out && echo '{}' > /tmp/units-noopts.json && npm run -s units:prepare -- --in /tmp/units-raw --out /tmp/units-noflip --options /tmp/units-noopts.json && node tools/units/check-units.mjs /tmp/units-out /tmp/units-noflip && UNITS_DIR=/tmp/units-out npm run -s sprites -- --painted`

6. Create `tools/units/options.json` with exactly the content in **Files to touch**.

7. In `docs/unit-art.md`, after the "How to add art" section, add a section `## Per-unit options` of at most 6 lines. It explains `tools/units/options.json`: `flip` for art that faces left, and `hueKey: false` for a unit whose own colours match its background colour. It notes that options apply to the unit's `-attack` image too.

## Acceptance

- `npm run build` exits 0.
- `npm run units:test` exits 0. Its output contains the line `check-units: N/N pass` (with both numbers equal and N ≥ 27), and its last line is `sprites (painted): 25/25 pass`.
- `npm run sprites` exits 0 and its last line is `sprites: 25/25 pass`.
- `node -e "const o=require('./tools/units/options.json'); process.exit(o['pale-stag'].flip===true && o.shadowblade.flip===true && o.shadowblade.hueKey===false ? 0 : 1)"` exits 0.
- `git diff --quiet -- public/assets/units` exits 0. The committed art must not change in this run.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- A step may touch a file outside **Files to touch** when it has to. List every such file in the report under "outside the plan", one line each saying why.
- The only checks to run are the **Acceptance** commands. Do not write or run extra end-to-end tests, and do not start a dev server. If something outside Acceptance fails, note it in the report and finish.
- Write generated images only under `/tmp`. Never write to `public/assets/units` or `art/units`, and do not run `units:prepare` with its default `--out`.
- Do not change `src/`, `tools/sprite-sheet/`, or any threshold in `tools/sprite-sheet/run.mjs`.

## Out of scope

- Re-processing the real art (it is not in the repo clone).
- Changes to the renderer, the game, the sprite-sheet checks or the art prompts beyond the new docs section.

## If blocked

- If a fixture can't pass the spill or shadow check with the formulas above, report its numbers. Do not change the thresholds in step 2 or step 4.
