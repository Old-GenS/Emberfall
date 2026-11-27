## Goal

Make long battles less passive with three changes. None of them changes combat balance.

1. **Visible enrage.** After 30 s of battle time, damage already ramps up (`BALANCE.combat.enrageAt` / `enrageRamp`), but nothing shows it. Add four things:
   - a banner;
   - a red vignette that deepens as enrage grows;
   - a red glow on enemies and bigger damage numbers;
   - more intense music and an `×1.4`-style enrage chip in the battle controls.
2. **Battle speed** cycles 1× → 2× → 3× → 1× and is remembered in the save, instead of resetting to 1× every fight.
3. **Realm events.** About every 12 s of battle time, a realm-flavoured visual event plays (Ember Rain, Spore Bloom, Shardfall, Tide Surge, Void Rift) and leaves a glowing **spark** in the arena. Clicking or tapping the spark gives +15 ultimate charge. The events are visual only; the spark is the one gameplay effect, and only for players who tap it.

## Files to touch

- `src/combat.ts`: `enrageMultiplier()`, public `elapsed`, `grantUltCharge()`
- `src/state.ts`: `battleSpeed` in the save
- `src/realm-events.ts`: new, event scheduling, visuals, the spark and hit-testing
- `src/art.ts`: enrage visuals, drawing the realm events, `toDesign` / `toClient` coordinate helpers
- `src/main.ts`: speed cycling and persistence, enrage music and chip, the realm-events lifecycle, tap handling, the `?debug=1` hook
- `src/ui.ts`: enrage chip markup in the battle controls
- `src/style.css`: enrage chip style, pointer cursor over a spark
- `tools/battle-fx-check.mjs`: new, automated browser check
- `package.json`: add script `check:fx`

## Steps

1. Run `npm ci`.

2. **`src/combat.ts`:**
   - Export `enrageMultiplier(time: number): number`, which returns `time > BALANCE.combat.enrageAt ? 1 + (time - BALANCE.combat.enrageAt) * BALANCE.combat.enrageRamp : 1`. Make the existing damage line (`if (this.time > BALANCE.combat.enrageAt) dmg *= …`) use it, so the behaviour is identical.
   - Add to `Battle` a public getter `elapsed` (returns `this.time`).
   - Add a public `grantUltCharge(amount: number): void`, which adds `amount` to the hero's `ultCharge`, clamped to 0–100. It does nothing if the battle has ended or the hero is dead.
   - Change nothing else in combat.

3. **`src/state.ts`:** add `battleSpeed: 1 | 2 | 3` to `SaveData`, defaulting to 1. `loadSave` keeps it when it's 1, 2 or 3, otherwise uses 1. `resetSave` keeps it, like the audio settings.

4. **Speed (`src/main.ts`):**
   - `startBattle` and the restart path set `speed = getSave().battleSpeed` instead of `speed = 1`.
   - The speed button cycles 1 → 2 → 3 → 1 and saves `battleSpeed`. Its label is `${speed}×`, and its `active` class is on when `speed > 1`.
   - The initial label rendered by `src/ui.ts` shows the saved speed.

5. **Enrage:**
   - **`src/art.ts`:** `SceneRenderer` computes `m = enrageMultiplier(battle.elapsed)` each frame.
     - When `m` first exceeds 1 in a battle, record `enrageStartedAt` (a public field, `null` until then; reset when a new battle starts) and play a canvas banner centred in the arena: `THE VALE GROWS RESTLESS` (display font, 34 px, `#ffd2a6` with a dark stroke), with `All damage rises every second` under it (16 px). Fade in 0.3 s, hold 2 s, fade out 0.6 s.
     - While `m > 1`:
       - draw a red edge vignette over the arena (radial gradient, transparent centre, `rgba(255,40,30,a)` at the edges, `a = min(0.42, (m - 1) * 0.25)`, pulsing ±15% at 1.2 Hz);
       - draw a red glow (`#ff3b2f`, alpha `min(0.5, (m - 1) * 0.3)`) behind each living enemy, before the unit;
       - scale the font of damage floaters created while enraged by `min(1.6, 1 + (m - 1) * 0.35)`.
   - **`src/ui.ts`:** in the battle controls, before the pause button, add `<div class="wave-chip enrage-chip" id="enrage-chip" hidden>${icon('flame')} <span id="enrage-mult">×1.0</span></div>`.
   - **`src/main.ts`:** in `updateHud`, when `enrageMultiplier(battle.elapsed) > 1`, show `#enrage-chip` and set `#enrage-mult` to `×{m.toFixed(1)}`. When enrage first starts in a battle, call `audio.playMusic(themeForBattle(), true)` once.
   - **`src/style.css`:** `.enrage-chip` has a red tint (border `rgba(255,80,60,.6)`, colour `#ffb59a`) and a gentle pulse, with no animation under `prefers-reduced-motion`.

6. **Realm events (`src/realm-events.ts`):**
   - Export `class RealmEvents` with:
     - `constructor(kind: ParticleKind, accent: string)`;
     - `update(dt: number, battle: Battle)`, where `dt` is battle time;
     - `draw(ctx: CanvasRenderingContext2D, time: number)`, in design coordinates (960×540);
     - `hit(x: number, y: number): boolean`, in design coordinates;
     - `forceEvent(kind?: ParticleKind): void`;
     - read-only `spark: { x: number; y: number; age: number } | null`;
     - read-only `eventsPlayed: number`.
   - **Schedule:** the first event at 10 s of battle time, then every `12 + ((index * 7) % 5) - 2` seconds. Nothing is scheduled once `battle.ended`.
   - **Event visuals.** Each lasts 2.5 s, uses `Math.random` freely (visual only), and shows its name as small top-centre canvas text (display font, 18 px, `#f3e2c0`, fading over 1.6 s):
     - `ember`: **Ember Rain**. 40 glowing embers fall diagonally across the arena, with a brief warm sky flash.
     - `spore`: **Spore Bloom**. Six glowing puffs burst from random points along the floor (y ≈ 430–470), with spores drifting up.
     - `snow`: **Shardfall**. Ice shards fall vertically with light streaks, with a brief cold flash.
     - `bubble`: **Tide Surge**. A translucent teal wave band sweeps left to right across the floor, with rising bubbles.
     - `ash`: **Void Rift**. A purple tear opens mid-air near the centre, with swirling ash, and closes after 2.5 s.
   - **Spark:**
     - At an event's end, if there's no spark, spawn one at a random point with x in [300, 660] and y in [300, 420].
     - It's drawn as a pulsing orb in `accent` with a soft halo and a small 4-point star, bobbing ±4 px.
     - It lasts 5 s, fading over the last 1 s. At most one at a time.
     - `hit(x, y)` returns true (and collects the spark) when the point is within 34 design px of it. Collecting plays a burst ring and a `+15 Ultimate` floating text drawn by `RealmEvents`.

7. **Wiring (`src/art.ts` and `src/main.ts`):**
   - `SceneRenderer` gets `setRealmEvents(ev: RealmEvents | null)` and draws `ev.draw(ctx, this.time)` after the units and before the floaters, inside the design transform.
   - It also gets `toDesign(clientX, clientY): { x, y }` and `toClient(x, y): { x, y }`. Both use the same `s`, `ox` and `oy` as `draw`, accounting for the canvas's device-pixel scale and its bounding rect.
   - In `startBattle`, create `new RealmEvents(location.particle, location.palette.accent)`, hand it to the renderer, and reset it on restart.
   - In the loop, advance it with the same battle-time steps as `battle.update`, and only when the battle is not paused, no modal is open and the battle hasn't ended.
   - On `pointerdown` on the arena canvas, convert to design coordinates. If `realmEvents.hit` returns true: call `battle.grantUltCharge(15)`, play `audio.sfx('heal')` and call `ev.preventDefault()`. Do nothing while paused.
   - On `pointermove`, set the canvas cursor to `pointer` when within 34 px of a spark, otherwise reset it.

8. **Debug hook (`src/main.ts`):** when `location.search` contains `debug=1`, keep `window.__emberfall = { battle, renderer, realmEvents, audio }` up to date at every battle start. Nothing else changes in debug mode.

9. **`tools/battle-fx-check.mjs`** (Node ESM, `playwright-core`, Node built-ins otherwise):
   - Serve `dist/` with a `node:http` static server on an ephemeral port.
   - Launch Chromium headless with `args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']` and `executablePath` set to `process.env.CHROMIUM_PATH` or the first that exists of `/usr/lib64/chromium-browser/chromium-browser`, `/usr/bin/chromium-browser`, `/usr/bin/chromium`. The viewport is 1280×800.
   - Collect page errors throughout. Open `/?debug=1`, click `[data-nav="classes"]`, click `[data-choose="warden"]` and wait 1200 ms. Then print `PASS`/`FAIL` with a detail for each check:
     1. **Speed cycles:** clicking `#speed-btn` three times gives the labels `2×`, `3×`, `1×` in turn.
     2. **Speed persists:** set it to `3×` (two clicks), reload `/?debug=1`, click `[data-nav="map"]`, then the first `.btn[data-battle]`, and wait 1200 ms. `#speed-btn` reads `3×`. Set it back to `1×` with one click.
     3. **No enrage before 30 s:** `#enrage-chip` is hidden and `__emberfall.renderer.enrageStartedAt === null`.
     4. **Enrage shows:** set `__emberfall.battle.time = 36` and wait 600 ms. `#enrage-chip` is visible, `#enrage-mult` matches `/^×1\.[0-9]$/`, `enrageStartedAt !== null`, and `__emberfall.audio.intensity === true`. Save a screenshot of the arena to `sprite-out/fx-enrage.png`.
     5. **Events play:** for each kind in `['ember', 'spore', 'snow', 'bubble', 'ash']`, call `__emberfall.realmEvents.forceEvent(kind)`, wait 1200 ms, screenshot the arena to `sprite-out/fx-<kind>.png`, and wait another 1600 ms. Afterwards `eventsPlayed >= 5` and no page errors occurred.
     6. **A spark appears:** after check 5, `realmEvents.spark` is not null (force one more event and wait 2700 ms if needed).
     7. **A miss doesn't collect:** read `battle.hero.ultCharge`, then click the arena at the point that `renderer.toClient` gives for a design point 150 px left of the spark. The spark still exists.
     8. **Collecting a spark:** set `battle.hero.ultCharge = 10`, then click at `renderer.toClient(spark.x, spark.y)`. Within 300 ms the spark is null and `ultCharge >= 24`.
     9. **No page errors** over the whole run.
   - Print `battle-fx-check: N/N pass` last and exit 1 on any failure. Always close the browser and the server.

10. Add the script `"check:fx": "npm run build && node tools/battle-fx-check.mjs"` to `package.json`.

## Acceptance

- `npm run check:fx` exits 0 and its last line is `battle-fx-check: 9/9 pass`.
- `npm run check:hover` exits 0 and its last line is `hovercard-check: 8/8 pass`.
- `npm run sprites` exits 0 and its last line is `sprites: 25/25 pass`.
- `npm test` prints `2 of 11 targets fail:` listing exactly `boss-retry` and `parity` (balance unchanged).
- `test -f sprite-out/fx-enrage.png && test -f sprite-out/fx-ember.png && test -f sprite-out/fx-ash.png` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- A step may touch a file outside **Files to touch** when it has to. List every such file in the report under "outside the plan", one line each saying why.
- The only checks to run are the **Acceptance** commands. Do not write or run extra end-to-end tests. The check scripts' own static servers are the only servers allowed; do not start a dev server. If something outside Acceptance fails, note it in the report and finish.
- No balance changes: don't change `src/balance.ts`, `src/data.ts`, enemy or hero numbers, or any combat rule beyond the three additions in step 2. Realm events deal no damage and apply no status.
- Do not change the sprites, unit art, hover card or audio menu.

## Out of scope

- Boss telegraphs or new boss mechanics, combo counters, slow motion or screen shake changes.
- Changes to tools/balance or the balance targets.

## If blocked

- If Chromium will not launch, try `dnf install -y chromium` once. If it still fails, stop and report.
- If `battle.time` cannot be set from the page because the build renames or freezes it, add the smallest debug-only setter on the `window.__emberfall` object and report it.
