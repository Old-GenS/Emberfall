## Goal

Roguelike phase 1 for Emberfall. Three changes:

1. **Random waves.** Normal stages draw their enemies at random from the realm's pool, seeded per run, so a retry faces the same wave but a new run doesn't. Bosses and their escorts stay fixed.
2. **Elite modifiers.** A realm's elite (the third enemy in `location.enemies`) can roll an affix: Burning, Swift, Armored or Vampiric. The affix is shown in its name. Affixes get likelier in later realms.
3. **Health carries over within a realm.**
   - The hero starts each stage with the health they ended the last one on, plus a small heal after each win.
   - Beating a boss restores full health.
   - A defeat retries the stage from the health you entered it with, plus a little more per defeat, so there's no death spiral.

Then re-tune so the existing balance targets still pass, plus one new attrition target.

## Files to touch

- `src/data.ts`: `AffixDef` / `AFFIXES`, `EnemyInstance.affix`, seeded `buildWave(globalStage, runSeed)`
- `src/balance.ts`: `run` section, `logic: 3`, tuning
- `src/state.ts`: `runSeed`, `hpPct` in `SaveData`; `completeStage(endHpPct)`, `startHpPct(rally)`, `newRunSeed`
- `src/combat.ts`: apply the affix in `makeEnemyUnit`; Burning basic attacks
- `src/main.ts`: pass the seed, set the hero's starting health, result-overlay chips
- `src/ui.ts`: map health chip, affix names in the map's wave preview
- `src/style.css`: styles for the new chips
- `tools/balance/run.ts`, `tools/balance/scaling.ts`, `tools/balance/check.ts`, `tools/balance/cli.ts`: carry health, seed, new metric and target
- `tools/run-check.ts`: new node check
- `package.json`: script `check:run`
- `docs/balance.md`: a section on this pass, Status config id, refreshed tables

## Steps

1. Run `npm ci`.

2. **`src/balance.ts`:** set `logic: 3` and add:

   ```ts
   /** Roguelike run rules: random waves, elite affixes, health carried within a realm. */
   run: {
     eliteChance: [0, 0.5, 0.7, 1],   // by stageInLoc 0..3: chance the wave contains the realm's elite (at most one)
     affixChance: 0.25, affixPerRealm: 0.15, affixCap: 0.85, // chance an elite rolls an affix: base + realm index × per, capped
     healOnWin: 0.15,                  // share of max HP restored after a normal win (on top of the HP left)
     retryHeal: 0.25,                  // extra share of max HP per defeat on the retry's starting health
     minStartHp: 0.2,                  // the hero never starts a stage below this share of max HP
   },
   ```

3. **`src/data.ts`:**
   - Add:

     ```ts
     export type AffixId = 'burning' | 'swift' | 'armored' | 'vampiric';
     export interface AffixDef { id: AffixId; name: string; desc: string }
     export const AFFIXES: AffixDef[] = [
       { id: 'burning', name: 'Burning', desc: 'Its attacks set you ablaze.' },
       { id: 'swift', name: 'Swift', desc: 'Attacks a third faster.' },
       { id: 'armored', name: 'Armored', desc: 'Heavy plating: more armor and 15% less damage taken.' },
       { id: 'vampiric', name: 'Vampiric', desc: 'Heals for a quarter of the damage it deals.' },
     ];
     ```

   - `EnemyInstance` gains `affix?: AffixId`. When set, `name` is `` `${affix.name} ${def.name}` `` (e.g. "Burning Magma Brute").
   - Add a small seeded PRNG: `export function seededRandom(seed: number): () => number` (mulberry32).
   - `buildWave(globalStage: number, runSeed: number): EnemyInstance[]`:
     - Draw from `seededRandom((runSeed >>> 0) * 31 + globalStage * 7919 + 1)`. Never use `Math.random` here.
     - **Boss stages:** exactly as now (the boss plus the first `bossEscorts` enemies), with no affixes and no randomness.
     - **Normal stages:**
       - `count = enemyCountFor(stageInLoc)` as now.
       - With chance `eliteChance[stageInLoc]` (always at 1), one slot holds the elite (`location.enemies[2]`), at a random slot index.
       - Every other slot is a random pick of `location.enemies[0]` or `[1]`.
       - Keep the existing `hpScale` / `atkScale` formulas, indexed by slot `i` as now.
       - The elite rolls an affix with chance `min(affixCap, affixChance + realmIndex × affixPerRealm)`, picked uniformly from `AFFIXES`. `realmIndex` is `Math.floor(globalStage / 5)`.
   - Export `enemyCountFor` if it isn't already.

4. **`src/combat.ts` `makeEnemyUnit`:** apply `inst.affix` to the unit:
   - `swift`: `stats.speed *= 0.75`;
   - `armored`: `armor += 12` and `damageReduction = 0.15`;
   - `vampiric`: `lifesteal = 0.25`;
   - `burning`: store `affix` on the `Unit` (new optional field `affix?: AffixId`). In `basicAttack`, a unit with `affix === 'burning'` applies a burn to its target: `{ kind: 'burn', duration: 3, power: u.stats.atk * 0.15 }`, the same way the Pyromancer passive does.

   Change nothing else in combat.

5. **`src/state.ts`:**
   - `SaveData` gains `runSeed: number` and `hpPct: number`. `hpPct` is the hero's health share entering the next stage, from 0 to 1.
   - `defaultSave()` sets `runSeed: newRunSeed()` and `hpPct: 1`. `newRunSeed()` returns `Math.floor(Math.random() * 2 ** 31)`.
   - `loadSave` keeps a valid `runSeed` (a non-negative integer) or makes a new one, and clamps `hpPct` into [0, 1], defaulting to 1.
   - `selectClass` also sets `runSeed: newRunSeed()` and `hpPct: 1`.
   - `resetSave` starts with a new seed and full health.
   - `completeStage(endHpPct = 1)`: before advancing, set `hpPct` to `1` if the cleared stage is a boss (`cleared % 5 === 4`), else `min(1, endHpPct + BALANCE.run.healOnWin)`. The return value is unchanged.
   - `export function startHpPct(rally: number): number` returns `min(1, max(BALANCE.run.minStartHp, save.hpPct + defeats × BALANCE.run.retryHeal))`, where `defeats = Math.round((rally - 1) / BALANCE.rally.step)`.

6. **`src/main.ts`:**
   - `startBattle`: `buildWave(save.stage, save.runSeed)`.
   - After creating the `Battle` (after Rally is applied to max HP), set `battle.hero.hp = Math.max(1, Math.round(battle.hero.stats.maxHp * startHpPct(rally)))`.
   - `handleBattleEnd` victory: call `completeStage(battle.hero.hp / battle.hero.stats.maxHp)`.
   - **Victory overlay:**
     - after a non-final normal stage, add a reward chip `${icon('heart' or an existing health icon)} <b>Health ${pct}%</b>`, showing the new `hpPct` after the heal, e.g. "Health 72% (+15%)";
     - after a boss, add a chip "Fully restored".
   - **Defeat overlay:** add a chip "Next try starts at {startHpPct(rally)}% health", using the rally value the retry will use.
   - Use only icon names that already exist in `src/ui.ts`.

7. **`src/ui.ts` `renderMap`:**
   - `buildWave(save.stage, save.runSeed)`.
   - The hero panel shows a health chip/bar with `Math.round(save.hpPct × 100)%`, styled like the existing panel stats.
   - The wave preview lists the instance names, which now include affixes. Put an affixed elite's name in a highlighted colour and give it a `title` with the affix `desc`.

8. **`src/style.css`:** styles for the map health bar/chip and an `.affix` name highlight (ember orange), consistent with the existing look.

9. **Balance tooling:**
   - `tools/balance/run.ts`:
     - `playRun` uses the save's `runSeed`. `selectClass` sets it, and `Math.random` is already seeded per run, so runs stay reproducible.
     - `fight` builds `buildWave(stage, getSave().runSeed)` and sets the hero's starting HP exactly as `main.ts` does (`startHpPct(rally)` after Rally).
     - After a win, call `completeStage(hero.hp / maxHp)`.
     - Record `startHpPct` on `FightRec`. Add `bossEntryHpPct` (mean `startHpPct` of first-try boss fights) to `ClassMetrics`.
   - `tools/balance/scaling.ts`: pass a fixed seed (`1`) to `buildWave`.
     - Export a function `packDpsByStage(seed: number): number[]` that returns the "Pack DPS" column it already computes, so `run-check` can reuse it.
   - `tools/balance/check.ts`: add a target:
     - `attrition`, **"Health carries weight"**: Regular's mean health entering first-try boss fights is 40–85%, each class.
     - Why: "A realm is one stretch of road: sloppy normal fights should leave you weaker at the boss, but never hopeless."
   - `tools/balance/cli.ts`: show `bossEntryHpPct` as a column (`HP@B`) in the report.

10. **Tune** with `npm run balance -- report|sweep|check`. All targets must pass except `parity`, which already fails; leave parity as it is or improve it.
    - You may change: `BALANCE.run.*`, `enemy.atkPerStage`, `enemy.hpPerStage`, `enemy.bossHpPerStage`, `enemy.bossAtkPerStage`, `enemy.escortAtkPerStage`, and the heavy `power` values in `src/data.ts`.
    - You may not change: hero classes, abilities, guard values, boons, target thresholds or the enrage.
    - **Hard rule:** in every realm, every normal stage's pack DPS (mean over seeds 1..50 from `packDpsByStage`) must stay below that realm's boss stage pack DPS. `run-check` asserts it.

11. **`tools/run-check.ts`** is a node script with no browser, bundled like the balance CLI. Script: `"check:run": "esbuild tools/run-check.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/run-check/run-check.mjs --log-level=warning && node node_modules/.cache/run-check/run-check.mjs"`. It prints PASS/FAIL with a detail for each check:
    1. **Deterministic:** `buildWave(s, seed)` deep-equals a second call, for stages 0..24 and seeds 1..20 (compare def ids, names, affixes, scales).
    2. **Varied:** over seeds 1..200, stage 0 has ≥ 3 distinct compositions (sorted def ids), and so do stages 5, 10, 15 and 20.
    3. **Elite rules:** over seeds 1..200 for every realm:
       - `stageInLoc` 0 waves contain no elite;
       - `stageInLoc` 3 waves contain exactly one;
       - no wave contains two.
    4. **Bosses fixed:** stages 4, 9, 14, 19, 24 give identical waves (ids, names, scales) for seeds 1..50, with no affixes.
    5. **Affix rates:** over seeds 1..1000, the share of elites with an affix is 15–35% in realm 0 and ≥ 70% in realm 4. All four affixes appear.
    6. **Affix stats:** for each affix, `makeEnemyUnit` on an affixed elite differs from the plain one as specified (swift: speed lower; armored: armor +12 and DR 0.15; vampiric: lifesteal 0.25; burning: `unit.affix === 'burning'`).
    7. **Health carry:** with `resetSave()`, `selectClass('warden')`, then `updateSave({ hpPct: 0.5 })`:
       - `completeStage(0.4)` on stage 0 gives `hpPct` ≈ 0.55;
       - set stage 4, then `completeStage(0.1)` gives 1;
       - `startHpPct(1)` equals `hpPct`;
       - with `hpPct` 0.1, `startHpPct(1 + BALANCE.rally.step)` equals 0.35 and `startHpPct(1)` equals `minStartHp`.
    8. **Old saves:** `localStorage` is not available in node, so test the pure normalisation instead. Factor `loadSave`'s field validation into an exported `normalizeSave(data: Partial<SaveData>): SaveData` that `loadSave` uses. A save object without `runSeed` and `hpPct` gets a valid seed and `hpPct` 1.
    9. **Pack DPS rule:** for every realm, each normal stage's mean pack DPS over seeds 1..50 is below the boss stage's.

    Print `run-check: N/N pass` last; exit 1 on any failure. `src/state.ts` must not touch `localStorage` at import time in node; guard every access with `typeof localStorage !== 'undefined'` if needed. The balance tool already imports state, so follow its pattern.

12. **`docs/balance.md`:**
    - Add a section "Roguelike phase 1 (2026-11-27, `<config>`)": the three mechanics with their numbers, the attrition target, and one line per tuning change with why.
    - Update Status (date 2026-11-27, the config id `npm test` prints, one paragraph).
    - Refresh the Tiers and By-stage tables from `npm run balance -- report --seeds 100 --per-stage`, in the existing table format.

## Acceptance

- `npx tsc --noEmit -p .` exits 0.
- `npm run check:run` exits 0 and its last line is `run-check: 9/9 pass`.
- `npm test` prints `1 of 14 targets fail:` and the only failing id listed is `parity`.
- `npm run check:guard` exits 0 and its last line is `guard-check: 9/9 pass`.
- `npm run check:fx` exits 0 and its last line is `battle-fx-check: 9/9 pass`.
- `npm run check:hover` exits 0 and its last line is `hovercard-check: 8/8 pass`.
- `npm run sprites` exits 0 and its last line is `sprites: 25/25 pass`.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- A step may touch a file outside **Files to touch** when it has to. List every such file in the report under "outside the plan", one line each saying why.
- The only checks to run are the Acceptance commands, plus `npm run balance -- report|sweep|scaling` while tuning. Do not write or run extra end-to-end tests, and do not start a dev server; the check scripts' own static servers are the only servers allowed. If something outside Acceptance fails, note it in the report and finish.
- Do not change hero classes (stats, abilities, ultimates, guards), the guard or heavy mechanics, `BALANCE.guard`, `BALANCE.combat`, boons, the balance target thresholds, the painted art, `src/sprites/*`, `src/realm-events.ts`, `tools/units/*` or `tools/fx/*`.
- `buildWave` must be deterministic for a given `(stage, seed)`, and must never call `Math.random`.
- Old saves must load without errors.

## Out of scope

- Branching paths, shrines, events, permadeath, meta-progression, new enemies or art.
- Changing how Rally works, beyond reading it for `startHpPct`.

## If blocked

- If all non-parity targets cannot pass after about 40 minutes of tuning:
  - keep the best configuration found;
  - make sure `attrition`, `normal-smooth` and `no-wall` pass if at all possible;
  - record the measured table and the closest values tried in `docs/balance.md` and the report, and name which targets still fail.
- If Chromium will not launch for the browser checks, try `dnf install -y chromium` once. If it still fails, stop and report.
