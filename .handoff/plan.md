## Goal

Roguelike phase 2 for Emberfall: a **branching path**. Each realm still has 5 steps (global stages `realm*5 + 0..4`):
- Step 0 is always a normal fight with no choice.
- Step 4 is always the boss.
- Before steps 1, 2 and 3, the player picks the next stop from **two offered nodes**.

The node types:

- **Fight**: the current random wave. Reward: a boon pick, as now.
- **Elite**: a harder wave (the realm's elite is guaranteed and always has an affix; enemies are tougher). Reward: a rare-or-better boon pick and more XP.
- **Shrine** (no fight): choose **Rest** (heal) or **Offering** (pay health for a rare-or-better boon pick).
- **Event** (no fight): a short scene with two choices, from three events. Outcomes are seeded per run.

Offers and event outcomes are deterministic per `(runSeed, stage)`, so reloading never rerolls them. Then re-tune only the new path numbers.

## Files to touch

Lead (step 0): `package.json` scripts, `src/data.ts`, `src/state.ts`, `src/balance.ts` (the API below).

Workstream A (logic, bots, balance):
- `src/data.ts` and `src/state.ts` beyond the step-0 API, if needed
- `src/balance.ts` (`path` numbers only)
- `tools/balance/bots.ts`, `run.ts`, `check.ts`, `cli.ts`, `scaling.ts`
- `tools/path-check.ts`
- `docs/balance.md`

Workstream B (UI):
- `src/ui.ts`, `src/main.ts`, `src/style.css`
- `tools/path-ui-check.mjs`

## Steps

### 0. Lead: setup and shared API (before delegating)

Run `npm ci`. Implement exactly this, then make sure `npx tsc --noEmit -p .` passes, before delegating anything.

**`package.json` scripts:**
- `"check:path": "esbuild tools/path-check.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/path-check/path-check.mjs --log-level=warning && node node_modules/.cache/path-check/path-check.mjs"`
- `"check:pathui": "npm run build && node tools/path-ui-check.mjs"`

**`src/balance.ts`:** `logic: 4`, plus:

```ts
/** Branching path (roguelike phase 2). */
path: {
  weights: { fight: 45, elite: 25, shrine: 15, event: 15 }, // offer weights for steps 1-3
  preBossShrine: 2,     // shrine weight multiplier on step 3 (the stop before the boss)
  eliteScale: 1.15,     // elite node: every enemy's hpScale and atkScale × this
  eliteXp: 1.5,         // elite node: stage XP × this
  restHeal: 0.35,       // shrine Rest: + this share of max HP
  offeringCost: 0.2,    // shrine Offering: − this share of max HP
  nonCombatXp: 0.5,     // shrine/event: stage XP × this
  hpFloor: 0.05,        // shrines and events never take health below this share
},
```

**`src/data.ts`:**

```ts
export type NodeType = 'fight' | 'elite' | 'shrine' | 'event';
export interface EventChoice { id: string; label: string; desc: string }
export interface EventDef { id: 'merchant' | 'reliquary' | 'pilgrim'; title: string; text: string; choices: [EventChoice, EventChoice] }
export const EVENTS: EventDef[];        // the three below
export function nodeOffer(globalStage: number, runSeed: number): NodeType[];
export function buildNodeWave(globalStage: number, runSeed: number, node: 'fight' | 'elite'): EnemyInstance[];
export function eventFor(globalStage: number, runSeed: number): EventDef;
```

- **`nodeOffer`:**
  - Returns `[]` for step 0 and step 4.
  - Otherwise returns two **distinct** types drawn by weight with `seededRandom((runSeed>>>0)*131 + globalStage*7907 + 3)`.
  - Shrine weight is multiplied by `preBossShrine` on step 3.
  - At least one of the two is `fight` or `elite`: if the draw gives two non-combat nodes, replace the second with `fight`.
  - Order as drawn.
- **`buildNodeWave(...,'fight')`** equals `buildWave(stage, seed)`.
- **`buildNodeWave(...,'elite')`:**
  - start from `buildWave`;
  - if no elite (`location.enemies[2]`) is present, replace slot 0 with it;
  - if the elite has no affix, give it one drawn with `seededRandom(seed*61 + stage*389 + 5)`, and update its name;
  - multiply every instance's `hpScale` and `atkScale` by `eliteScale`.
- **`eventFor`:** one of `EVENTS`, picked with `seededRandom(seed*17 + stage*1543 + 7)`.
- **The three events** (write short, flavourful text in the game's voice):
  - `merchant` "The Ash Merchant": choices `trade` ("Pay in blood": lose 25% max HP, then a rare-or-better boon pick) and `leave`.
  - `reliquary` "A Cursed Reliquary": choices `open` (seeded 50%: an **epic** boon pick, else lose 30% max HP) and `leave`.
  - `pilgrim` "The Wounded Pilgrim": choices `tend` (gain the stage's full XP) and `pray` (heal 20% max HP).

**`src/state.ts`:**
- `SaveData` gains:
  - `node: NodeType | null`: the chosen node for the current stage, null when not chosen;
  - `path: string[]`: the node played at each cleared stage index (`'fight' | 'elite' | 'shrine' | 'event' | 'boss'`), with length equal to `stage`.
- `normalizeSave` accepts old saves: `node` defaults to null; `path` is invalid or missing, or too short or long, so rebuild it as `'fight'`/`'boss'` up to `stage`.
- New-run resets (`selectClass` / `resetSave`) clear `node` and `path`.

```ts
export function currentNode(): NodeType | 'boss' | null; // 'fight' at step 0, 'boss' at step 4, else save.node
export function needsPathChoice(): boolean;               // steps 1-3 with save.node === null (and stage < 25)
export function choosePath(node: NodeType): boolean;      // false unless node is in nodeOffer(stage, runSeed)
export function shrineRest(): void;                       // hpPct += restHeal (cap 1)
export function shrineOffering(): void;                   // hpPct = max(hpFloor, hpPct − offeringCost)
export function resolveEvent(choiceId: string): { text: string; boon: null | 'rare' | 'epic'; xpShare: number };
// Applies the HP effect (respecting hpFloor) and returns what the UI must do next.
// Seeded: seededRandom(seed*29 + stage*977 + 11) for the reliquary.
export function completeNonCombat(xpShare?: number): { xp: number; levelUps: number; stageCleared: number };
// Shrine/event end: awards stageRewardXp × (xpShare ?? nonCombatXp), pushes save.node to path,
// advances the stage, sets node = null. hpPct unchanged.
```

- `completeStage(endHpPct)` also pushes `currentNode()` to `path` and sets `node = null`.
- Elite node XP: `completeStage` multiplies the XP by `eliteXp` when `currentNode() === 'elite'`.
- `pickBoonChoices(count?, exclude?, minRarity?: 'rare' | 'epic')` only offers boons at or above `minRarity` when given.

### Workstream A: logic, bots, balance (after step 0)

1. **Bots (`tools/balance/bots.ts`):** add a `PathPolicy` per tier.
   - `idle`: always the first offered node; shrine Rest; events `leave`/`pray`.
   - `casual`: a random node; random shrine and event choices.
   - `regular`:
     - nodes: `shrine` if offered and hp < 45%, else `fight` if offered, else `elite`;
     - shrine: Rest if hp < 60%, else Offering;
     - events: merchant `trade` if hp ≥ 60% else `leave`; reliquary `open` if hp ≥ 60% else `leave`; pilgrim `pray` if hp < 60% else `tend`.
   - `sharp`:
     - nodes: `elite` if offered and hp ≥ 70%; else `shrine` if offered and hp < 50%; else `fight` if offered; else whatever combat node is offered;
     - shrine and events: same as regular.
2. **Simulator (`tools/balance/run.ts`):**
   - `playRun` follows the same flow as the game: when `needsPathChoice()`, the policy picks and calls `choosePath`.
   - Fight and elite nodes fight with `buildNodeWave`. Shrine and event nodes call the state functions, then `completeNonCombat`.
   - Every boon pick goes through `chooseBoon`, using `pickBoonChoices(…, minRarity)` for elite, offering, merchant and reliquary rewards. Idle still skips boons.
   - Record `node` on `FightRec`.
   - Add metrics: `eliteFirstTryPct` (first-try win % on elite nodes), and node counts per run (`elites`, `shrines`, `events`) shown in the report.
3. **`tools/balance/scaling.ts`:** export `packDpsForWave(wave: EnemyInstance[], stage: number): number` using the same formula as the Pack DPS column.
4. **`tools/balance/check.ts`:** add target `elite-fair`, **"Elites are a fair gamble"**: Regular first-try win on elite nodes is 60–95%, each class (only for classes with at least 20 elite fights; otherwise a pass with the note "too few").
5. **Tune** with `npm run balance -- report|sweep|check`.
   - You may change **only `BALANCE.path.*` and `BALANCE.run.healOnWin`**.
   - Do not change any enemy, class, guard, heavy, boon or `enemy.*` number, or any target threshold.
   - After tuning, no target that passes today may fail. Today's failures are `boss-retry`, `attrition`, `ult-available`, `pacing-normal` and `parity`.
   - Report the before and after table.
6. **`tools/path-check.ts`** (node, bundled like `run-check`) prints PASS/FAIL per check, then `path-check: N/N pass`, and exits 1 on any failure:
   1. **Offers deterministic:** `nodeOffer(s, seed)` is equal across two calls, for stages 0..24 and seeds 1..50.
   2. **Offer rules:** over seeds 1..300:
      - steps 0 and 4 give `[]`;
      - steps 1–3 give exactly 2 distinct valid types;
      - at least one of them is fight or elite.
   3. **Offer mix:** over seeds 1..1000 at steps 1–3, each type appears in ≥ 5% of offers, and shrine appears more often at step 3 than at step 1.
   4. **Elite wave:**
      - `buildNodeWave(s, seed, 'elite')` contains exactly one elite with an affix, and its name starts with the affix name;
      - every scale is `eliteScale` × the fight wave's (where the instance is unchanged);
      - it is deterministic.
   5. **Shrine:** from hpPct 0.5, `shrineRest()` gives 0.85; from 0.9 it gives 1. From 0.5, `shrineOffering()` gives 0.3; from 0.1 it gives `hpFloor`.
   6. **Events:**
      - `eventFor` is deterministic;
      - all 3 events appear over seeds 1..200;
      - `resolveEvent` returns the documented boon/xp/HP effects for each choice;
      - the reliquary outcome is deterministic per seed, and both outcomes occur over seeds;
      - hpPct never goes below `hpFloor`.
   7. **Path state:**
      - `choosePath` rejects a node that isn't offered and accepts an offered one;
      - `currentNode()` is `'fight'` at step 0 and `'boss'` at step 4;
      - after `completeStage` and `completeNonCombat`, `path` has length `stage` and the right entries, and `node` is null;
      - `completeNonCombat` awards `nonCombatXp` × the stage XP;
      - an elite win awards `eliteXp` × the stage XP.
   8. **Boon floor:** `pickBoonChoices(3, [], 'rare')` never returns a common, and `'epic'` returns only epics (or fewer cards if there are fewer epics in the pool, but never a lower rarity).
   9. **Old saves:** `normalizeSave` on a save without `node`/`path` at stage 7 gives `node` null and `path` of length 7, with `'boss'` at index 4.
   10. **Elite pack DPS:** for every realm and every step 1–3, the mean pack DPS of elite node waves over seeds 1..50 (`packDpsForWave`) is below the boss stage's.
7. **`docs/balance.md`:**
   - add a section "Roguelike phase 2 (2026-11-27, `<config>`)": the nodes, rewards, events, bot path policies, the new target, and one line per tuning change with why;
   - update Status;
   - refresh the Tiers and By-stage tables from `npm run balance -- report --seeds 100 --per-stage`, in the existing format (add columns only if needed).

### Workstream B: UI (after step 0)

1. **Path choice:**
   - When `needsPathChoice()` is true, clicking any `[data-battle]` for the current stage (the March Forth button, the realm's Enter Trial and the current stage dot) opens a new **path screen** (`screen = 'path'`) instead of starting a battle.
   - Otherwise `[data-battle]` behaves exactly as now.
   - The path screen:
     - heading "Choose your road" with the realm and step;
     - two large cards `button.path-card[data-node="<type>"]`, each with an icon (existing `icon()` names only), the node name, a one-line description and the reward line (e.g. Elite: "Rare boon · +50% XP"; Shrine: "Rest or make an offering"; Event: "Something stirs ahead…");
     - the carried health shown;
     - a back button to the map.
   - Clicking a card calls `choosePath`:
     - `fight`/`elite`: start the battle (`startBattle` uses `buildNodeWave(stage, seed, currentNode())` for fight/elite nodes, the boss wave for boss);
     - `shrine`: open the shrine screen;
     - `event`: open the event screen.
2. **Shrine screen:**
   - two buttons, `[data-shrine="rest"]` ("Rest: heal 35%") and `[data-shrine="offering"]` ("Offering: −20% health, rare boon"), with the current health shown;
   - Rest calls `shrineRest()`, then `completeNonCombat()`, then the map with a toast;
   - Offering calls `shrineOffering()`, then `completeNonCombat()`, then the reward screen with `minRarity 'rare'`.
3. **Event screen:**
   - title, text, and the two choices as `[data-event-choice="<id>"]` buttons with their desc;
   - picking one calls `resolveEvent`, then shows the result text with a Continue button. Continue calls `completeNonCombat(xpShare)`, then opens the reward screen if `boon` (with that minRarity) or the map otherwise.
4. **Rewards:**
   - after an elite win, the reward screen offers `minRarity 'rare'`;
   - the reroll keeps the same floor;
   - the victory overlay after an elite shows a chip "Elite slain · rare boon".
5. **Map:**
   - each realm's stage dots show the node played for cleared stages: add `data-node="<path entry>"` on the dot and a small node icon or marker class (`.stage-node-elite` etc.);
   - the "Ahead" footer shows "Choose your road" when a choice is pending;
   - for a chosen elite, the wave preview uses `buildNodeWave`.
6. **`src/style.css`:** path cards, shrine and event screens, matching the existing card and tarot look, with no horizontal scroll at 390 px.
7. **Debug hook:** when `location.search` contains `debug=1`, expose `window.__emberfallPath = { nodeOffer, eventFor }` (from `src/data.ts`) for the check.
8. **`tools/path-ui-check.mjs`** uses the same setup as `tools/guard-check.mjs`: static server on `dist/`, Chromium, 1280×800, `?debug=1`, page errors collected. Edit the save in `localStorage` (`emberfall-save-v1`) and reload to set up states. Print PASS/FAIL per check:
   1. **Step 0 has no choice:** choosing `warden` from the class screen starts a battle directly.
   2. **Choice screen:**
      - set `stage: 1, node: null, runSeed: <seed>, path: ['fight']` and reload;
      - click `[data-nav="map"]`, then `.btn[data-battle]`;
      - exactly 2 `.path-card[data-node]` appear, matching `__emberfallPath.nodeOffer(1, seed)`;
      - save `sprite-out/path-choice.png`.
   3. **Shrine Rest:** find a seed whose step-1 offer contains `shrine`. Set `hpPct: 0.4`, pick shrine, then `[data-shrine="rest"]`. The save shows `hpPct` ≈ 0.75, `stage` 2 and `path[1] === 'shrine'`.
   4. **Shrine Offering:** same setup, choose offering. The reward screen shows 3 `.boon-card` with none having class `common`.
   5. **Event:** find a seed whose step-1 offer contains `event`, pick it. The event title matches `eventFor(1, seed).title`. Pick the second choice, click Continue, and the save `stage` is 2.
   6. **Elite:**
      - find a seed whose step-1 offer contains `elite`, and pick it;
      - the battle's enemies include one whose name starts with an affix name;
      - set every enemy's hp to 0 and claim the boon;
      - the reward cards have no `common`.
   7. **Map history:** after the above, the map has `[data-node="shrine"]` (or `"event"`/`"elite"`) on a cleared dot.
   8. **Phone fit:** at 390×844 the path screen and the shrine screen have `scrollWidth <= 390`.
   9. **No page errors.**

   Print `path-ui-check: 9/9 pass` last; exit 1 on any failure.

### Integration (lead, after both workstreams)

Run every Acceptance command, fix what fails, and write the report.

## Acceptance

- `npx tsc --noEmit -p .` exits 0.
- `npm run check:path` exits 0 and its last line is `path-check: 10/10 pass`.
- `npm run check:pathui` exits 0 and its last line is `path-ui-check: 9/9 pass`.
- `npm run check:run` exits 0 and its last line is `run-check: 9/9 pass`.
- `npm run check:guard` exits 0 and its last line is `guard-check: 9/9 pass`.
- `npm run check:fx` exits 0 and its last line is `battle-fx-check: 9/9 pass`.
- `npm run check:hover` exits 0 and its last line is `hovercard-check: 8/8 pass`.
- `npm run check:pwa` exits 0 and its last line is `pwa-check: 9/9 pass`.
- `npm run sprites` exits 0 and its last line is `sprites: 25/25 pass`.
- `npm test 2>&1 | grep -E '^  [a-z-]+:' | grep -vE '^  (boss-retry|attrition|ult-available|pacing-normal|parity|elite-fair):'` prints nothing. No target that passes today may fail.

## Parallel work

- **Lead first:** step 0 (`npm ci`, the scripts, the API in balance/data/state, and `npx tsc --noEmit -p .` passes). Do not delegate before this is done.
- **Workstream A, logic and balance:**
  - owns `tools/balance/*`, `tools/path-check.ts`, `docs/balance.md`, the `path` block in `src/balance.ts` and `run.healOnWin`;
  - may fix bugs in the step-0 code in `src/data.ts` / `src/state.ts`, and must say so;
  - its acceptance is `npm run check:path` 10/10 plus the `npm test` line above.
- **Workstream B, UI:**
  - owns `src/ui.ts`, `src/main.ts`, `src/style.css`, `tools/path-ui-check.mjs`;
  - uses the step-0 API as written and does not edit `src/data.ts`, `src/state.ts` or `src/balance.ts`;
  - its acceptance is `npm run check:pathui` 9/9.
- **Lead, integration:** after both finish, run the full Acceptance list.

## Constraints

- Do not commit, push, or switch branches.
- A step may touch a file outside **Files to touch** when it has to. List every such file in the report under "outside the plan", one line each saying why.
- The only checks to run are the Acceptance commands, plus `npm run balance -- report|sweep|scaling` for tuning in workstream A. Do not write or run extra end-to-end tests, and do not start a dev server; the check scripts' own static servers are the only servers allowed. If something outside Acceptance fails, note it in the report and finish.
- `buildWave` stays exactly as it is, and `run-check` must still pass unchanged.
- Tuning may change only `BALANCE.path.*` and `BALANCE.run.healOnWin`. No enemy, class, guard, heavy or boon numbers, and no target thresholds.
- Do not change the painted art, `src/art.ts`, `src/combat.ts`, `src/realm-events.ts`, `src/pwa.ts`, `vite.config.ts`, `tools/units/*`, `tools/fx/*` or `.github/`.
- Old saves must load, and a run in progress on an old save continues without errors.
- Use only icon names that already exist in `src/ui.ts`.

## Out of scope

- Permadeath, meta-progression, new enemies or art, more than three events, boon removal or swapping.
- Changing step 0 or the boss step.

## If blocked

- If after about 40 minutes of tuning a target that passes today still fails:
  - keep the best `path`/`healOnWin` values;
  - record the before/after table and the closest values tried in `docs/balance.md` and the report;
  - name the targets.
- If Chromium will not launch, try `dnf install -y chromium` once. If it still fails, stop and report.
- If a teammate or subagent tool is unavailable, do workstream A then workstream B yourself, in that order, and say so.
