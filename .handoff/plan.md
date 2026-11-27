## Goal

Give the player a real in-combat decision. Two halves:

1. **Telegraphed heavy attacks.** Every boss and every realm's large "elite" enemy has one heavy attack. It winds up visibly for about 1.5 s of battle time, then lands hard. A stun during the wind-up interrupts it.
2. **Guard.** Each class gets a second player-controlled button (beside the ultimate), on a short cooldown. Pressing it opens a short guard window:
   - A heavy attack that lands inside the window is a **perfect guard**: almost no damage, ultimate charge, the attacker is staggered, and a class-specific bonus applies.
   - Any other hit inside the window is halved.
   - Mistimed or skipped, the heavy attack lands in full.

Then re-tune the balance so that bosses are winnable by playing well, rather than by grinding Rally. Normal fights should cost real health.

## Files to touch

Workstream A (combat and balance):
- `src/data.ts`: `HeavyDef`, `GuardDef`, `EnemyDef.heavy`, `ClassDef.guard`, data for 5 bosses + 5 elites + 4 classes
- `src/balance.ts`: `guard` section, `logic: 2`, re-tuned numbers
- `src/combat.ts`: wind-up/telegraph state, interrupt, guard, new events, debug helpers
- `tools/balance/bots.ts`, `tools/balance/run.ts`, `tools/balance/check.ts`: guard policies, new metric and targets
- `docs/balance.md`: Status config id, a section on the guard mechanic and new targets, results

Workstream B (UI and visuals):
- `src/ui.ts`: guard button, intro and how-to text
- `src/main.ts`: guard input (button, keys), HUD state, sfx and log for the new events
- `src/art.ts`: telegraph visuals, guard and perfect-guard visuals
- `src/style.css`: guard button styles (desktop and phone)
- `src/hovercard.ts`: `skill:<classId>:guard` content
- `tools/guard-check.mjs`: new browser check
- `package.json`: script `check:guard`

## Steps

### 0. Setup (lead, before delegating)

Run `npm ci`. Then implement **section A1 (data types) and A2 (combat API)** yourself, exactly as below, and run `npx tsc --noEmit -p .` (it must pass) **before** delegating anything. Both workstreams build on this API.

### A1. Data (`src/data.ts`)

```ts
export interface HeavyDef {
  id: string; name: string; desc: string;
  power: number;     // damage = attacker atk × power
  windup: number;    // seconds of battle time from telegraph to impact
  cooldown: number;  // seconds between heavies (counted from impact or interrupt)
  first: number;     // seconds into the battle before the first heavy may start
  target: 'enemy' | 'allEnemies';
}
export interface GuardDef {
  id: string; name: string; desc: string; icon: IconName;
  bonus: 'shield' | 'burn' | 'counter' | 'heal';
}
```

- Add `heavy?: HeavyDef` to `EnemyDef`.
- Add `guard: GuardDef` to `ClassDef`.
- Each class's `icon` must be an `IconName` that already exists. Use one the class already uses (passive, ability or ultimate icon).

Class guards:

| class | id | name | bonus | desc |
|---|---|---|---|---|
| warden | `bulwark` | Bulwark | `shield` | Raise your shield. Blocks half of any hit; time it to a heavy blow to stagger the foe and gain a ward. |
| pyromancer | `blink` | Blink | `burn` | Step through flame. Halves any hit; time it to a heavy blow to stagger the foe and set it ablaze. |
| shadowblade | `riposte` | Riposte | `counter` | Parry. Halves any hit; time it to a heavy blow to stagger the foe and strike back with a critical blow. |
| spiritcaller | `spirit-ward` | Spirit Ward | `heal` | Call a spirit shield. Halves any hit; time it to a heavy blow to stagger the foe and mend your wounds. |

Heavies (starting numbers; workstream A tunes them):

| enemy id | heavy id | name | power | windup | cooldown | first | target |
|---|---|---|---|---|---|---|---|
| molten-warden | `eruption` | Eruption | 3.0 | 1.5 | 9 | 6 | enemy |
| pale-stag | `stampede` | Moonlit Stampede | 2.8 | 1.4 | 8.5 | 6 | enemy |
| winters-herald | `glacial-spear` | Glacial Spear | 3.0 | 1.4 | 9 | 6 | enemy |
| leviathan-eye | `tidal-crush` | Tidal Crush | 3.2 | 1.5 | 9 | 6 | allEnemies |
| ashen-king | `kings-judgment` | King's Judgment | 4.0 | 1.6 | 10 | 7 | enemy |
| magma-brute | `overhead-smash` | Overhead Smash | 2.6 | 1.6 | 11 | 5 | enemy |
| hollow-treant | `crushing-bough` | Crushing Bough | 2.6 | 1.6 | 11 | 5 | enemy |
| ice-golem | `glacier-fist` | Glacier Fist | 2.6 | 1.6 | 11 | 5 | enemy |
| coral-sentinel | `shell-crash` | Shell Crash | 2.6 | 1.6 | 11 | 5 | enemy |
| dusk-wyrm | `tail-sweep` | Tail Sweep | 2.6 | 1.6 | 11 | 5 | enemy |

Give each a short flavour `desc` in the style of the existing enemy abilities.

### A2. Combat API (`src/combat.ts`)

Add `BALANCE.guard` to `src/balance.ts` (starting values; A tunes them):

```ts
guard: {
  window: 0.6,        // seconds the guard stays up after the press
  cooldown: 4,        // seconds between presses
  guardTaken: 0.5,    // damage multiplier for non-heavy hits while guarding
  perfectTaken: 0.1,  // damage multiplier for a heavy that lands while guarding
  perfectUlt: 20,     // ultimate charge for a perfect guard
  stagger: 1.4,       // stun on the attacker after a perfect guard (NOT reduced by bossStunFactor)
  bonusShield: 0.1,   // warden: shield of maxHp × this
  bonusHeal: 0.08,    // spiritcaller: heal maxHp × this
  bonusCounter: 1.5,  // shadowblade: counter-hit of atk × this, forced crit
  bonusBurnDuration: 3, bonusBurnPower: 0.25, // pyromancer: burn of atk × power per second
},
```

Set `BALANCE.logic` to `2`.

New public members on `Battle`:

```ts
export interface Telegraph { id: number; source: Unit; heavy: HeavyDef; remaining: number; total: number }
telegraphs: Telegraph[];      // active wind-ups, read every frame by the renderer and the bots
guardCd: number;              // seconds until guard can be pressed again (0 = ready)
guardActive: number;          // seconds of guard window left (0 = not guarding)
get guardReady(): boolean;    // !ended && hero alive && guardCd <= 0
guardStats: { presses: number; perfect: number; guarded: number; heavyTaken: number; interrupted: number };
useGuard(): boolean;          // false if not ready; else guardActive = window, guardCd = cooldown, presses++, emit 'guard'
forceTelegraph(source?: Unit): boolean; // debug/check helper, see below
```

New `CombatEvent` members:

```ts
| { type: 'telegraph'; id: number; source: Unit; heavy: HeavyDef; duration: number }
| { type: 'heavy'; source: Unit; target: Unit; heavy: HeavyDef; outcome: 'perfect' | 'guarded' | 'hit' }
| { type: 'interrupt'; source: Unit; heavy: HeavyDef }
| { type: 'guard'; unit: Unit }
```

Behaviour:
- `Unit` gains `heavyCd: number`, set at creation to `def.heavy.first` for enemies with a heavy, `Infinity` otherwise. `makeEnemyUnit` needs the def's heavy, so store `heavy?: HeavyDef` on `Unit` too.
- **Each update, for a living enemy with a heavy that is not stunned and not winding up:**
  - decrease `heavyCd`;
  - when it reaches ≤ 0, push a telegraph (`remaining = total = heavy.windup`, ids from a counter starting at 1) and emit `telegraph`.
- **While a unit has an active telegraph, it neither basic-attacks nor casts.** Its `attackTimer` does not run down.
- Each update, decrease every telegraph's `remaining`.
- **Interrupt:** if the source is stunned or dead, remove the telegraph. Emit `interrupt` (stunned only), increment `guardStats.interrupted`, and set `heavyCd = heavy.cooldown * 0.5`.
- **Impact:** when `remaining <= 0`, remove the telegraph and set `heavyCd = heavy.cooldown`. Targets are the hero (`enemy`), or hero and allies (`allEnemies`). For each living target:
  - The outcome is `perfect` if the target is the hero and `guardActive > 0`, otherwise `hit`. Allies always take `hit`.
  - Emit `heavy` with the outcome before dealing damage.
  - Deal `source.atk × atkMult × heavy.power × rand(0.95, 1.05)` through `dealDamage`, with `kind: 'ability'` and `ability: heavy.name`. It cannot be dodged (add an `unavoidable` option to `dealDamage` that skips the dodge roll).
  - For `perfect`, multiply the damage by `perfectTaken`, then:
    - give `perfectUlt` charge through `grantUltCharge`;
    - stun the source for `guard.stagger`, pushed directly so `bossStunFactor` does not shrink it;
    - apply the class bonus: shield via `addShield`; heal via `heal(..., true)`; counter via `dealDamage(hero, source, atk × bonusCounter, { crit: true, forceCrit: true, kind: 'attack' })`; burn via `applyStatus`;
    - increment `perfect`.
  - For `hit` on the hero, increment `heavyTaken`.
  - Only one guard result per impact: an `allEnemies` heavy counts once.
- **Non-heavy hits** (`attack` / `ability` / `thorns`) on the hero while `guardActive > 0` are multiplied by `guardTaken`. Emit nothing extra, but increment `guarded` once per guard press (not once per hit).
- `guardCd` and `guardActive` count down each update. Stop at 0.
- `forceTelegraph(source?)`: start a telegraph now on `source`, or on the first living enemy. If that unit has no heavy, use `{ id: 'test-heavy', name: 'Heavy Blow', desc: '', power: 2, windup: 1.4, cooldown: 8, first: 0, target: 'enemy' }`. Return false if the battle has ended or there is no living enemy, or the unit is already winding up.
- Damage, abilities and everything else in combat stay as they are.

### Workstream A — balance and tooling (after step 0)

1. **Bots (`tools/balance/bots.ts`):**
   - Add `export type GuardPolicy = 'never' | 'sloppy' | 'perfect'` and a `guard` field on `Tier`.
   - Set `idle: never`, `casual: never`, `regular: sloppy`, `sharp: perfect`, and update the blurbs and the header comment. There are now four decisions: class, boon, ultimate, guard.
   - Remove "(the UI has a "Skip Boon" button)": the game has a reroll now and no skip. Keep the idle tier's `skip` policy as the floor.
2. **Simulator (`tools/balance/run.ts` `fight`):**
   - Each step, for every telegraph not decided yet, decide once:
     - `perfect`: press when `remaining <= BALANCE.guard.window * 0.6`.
     - `sloppy`: with probability 0.65 (`Math.random`, already seeded) behave like `perfect`; otherwise never press for that telegraph.
   - Press with `b.useGuard()`.
   - Record `hpLeftPct` (hero hp / maxHp at the end, 0 on a loss) and `perfect` / `heavyTaken` on `FightRec`.
3. **Targets (`tools/balance/check.ts`):**
   - Update the `ult-available` / `ult-matters` reasoning text. The ultimate is no longer the only decision.
   - Add:
     - `guard-matters`: boss first-try for Regular is ≥ 12 points above Casual (class mean).
     - `normal-teeth`: Regular's mean `hpLeftPct` after won first-try normal fights is 35–85%, for each class. Normal fights should cost health.
   - Add any summary fields needed to `summarize` in `run.ts`.
4. **Tune** with `npm run balance -- sweep` / `report` / `check`. All targets must pass, including the existing `boss-retry` and `parity`, which fail today.
   - You may change values in `src/balance.ts`.
   - You may change the `power` / `windup` / `cooldown` / `first` of heavies in `src/data.ts`, and the enemy `hp` / `atk` of bosses and elites only.
   - Do not change hero classes, abilities, boons or the targets' thresholds.
   - Prefer few, explainable changes.
5. **Doc (`docs/balance.md`):**
   - Add a section describing the guard and heavy mechanic, the guard policies and the two new targets.
   - Record what you changed while tuning and why, one line each.
   - Update the Status section to the date 2026-11-26 and the config id that `npm test` prints, and refresh any results tables it contains from a fresh `npm run balance -- report`.
6. Acceptance for A: `npm test` exits 0 and prints `all` … `targets pass`.

### Workstream B — UI, visuals, input (after step 0)

1. **Guard button (`src/ui.ts` `renderBattle`):**
   - In `.arena-bottom`, immediately before `.ult-wrap`, add:

     ```html
     <div class="guard-wrap" id="guard-wrap">
       <button class="guard-btn" id="guard-btn" data-tip="skill:${cls.id}:guard" aria-label="${cls.guard.name}">
         ${icon(cls.guard.icon)}
         <svg class="charge-ring" viewBox="0 0 68 68"><circle id="guard-ring" cx="34" cy="34" r="32" stroke-dasharray="201" stroke-dashoffset="0"/></svg>
         <span class="key" aria-hidden="true">F</span>
       </button>
       <div class="guard-info"><span class="k">✦ Guard</span><b>${cls.guard.name}</b></div>
     </div>
     ```

   - The how-to list gains one line: "When a foe glows red and a ring closes on you, press **Guard** (F or Shift) as the ring turns gold. A perfect guard staggers it and charges your ultimate."
   - The battle intro hint in `src/main.ts` becomes: "Skills fire on their own. Press **Guard** (F) as a red ring closes on you, and your **Ultimate** (Space) when it glows."
2. **Input (`src/main.ts`):**
   - `pointerdown` on `#guard-btn` calls `useGuard()` and `ev.preventDefault()` (not `click`, for responsiveness).
   - Keys `f`, `F`, `ShiftLeft`, `ShiftRight` call it during a battle (same guards as the ultimate: not paused, no modal).
   - `useGuard()` calls `battle.useGuard()`; on success, `sfx('shield')`.
3. **HUD (`updateHud`):**
   - `#guard-btn` gets `ready` when `battle.guardReady` and `cooling` otherwise.
   - The ring's dashoffset is `201 × guardCd / BALANCE.guard.cooldown`.
   - `alert` is set when `battle.telegraphs.length > 0` and the guard is ready.
4. **Events (`src/main.ts` `onEvent`):**
   - `telegraph`: `sfx('boss')` and a log line `<b>{source}</b> winds up <b>{heavy}</b>!`.
   - `heavy` perfect: `sfx('crit')` and log `Perfect guard!`.
   - `heavy` hit: `sfx('hit')`.
   - `interrupt`: log `{source}'s {heavy} is broken!`.
   - Forward every event to the renderer as now.
5. **Visuals (`src/art.ts`):**
   - Every frame, for each `battle.telegraphs` entry:
     - Pulse a red glow (`#ff3b2f`) behind the source, alpha `0.25 + 0.55 × progress` (progress = 1 − remaining/total). Use the same technique as `drawEnrageGlow`, faster pulse.
     - Draw a red `!` (display font, 40 px, dark stroke) above the source.
     - Around the hero, draw a timing ring: a fixed inner circle of radius 48 and an outer circle that shrinks from radius 130 to 48 as progress goes 0→1, both as ground-plane ellipses (y radius × 0.42) at the hero's feet. They are red (`#ff5a4a`) while `remaining > BALANCE.guard.window`, gold (`#ffd56a`) inside the window.
   - `guard` event: `spawnFx('shield-ring', …)` on the hero, small (size 150, life 0.35).
   - `heavy` perfect: a floater `PERFECT` (`#ffe08a`, 28 px) over the hero, `spawnFx('holy-flare', …)` size 220, gold flash 0.18, `hitStop = max(hitStop, 0.12)`, plus a `ring`.
   - `heavy` hit on the hero: shake 14, red flash 0.15 (`flashColor '255,70,60'`), `spawnFx('crit-star', …)`.
   - `interrupt`: floater `INTERRUPTED` (`#cbbce6`) over the source.
6. **Styles (`src/style.css`):**
   - `.guard-wrap` / `.guard-btn` mirror `.ult-wrap` / `.ult-btn` sizing, with a steel-blue/silver look instead of gold.
   - `.ready` is bright and `.cooling` is dimmed.
   - `.alert` pulses red-gold (no animation under `prefers-reduced-motion`).
   - At 390 px viewport width, the arena-bottom row must not cause horizontal page scroll: hide `.guard-info` and `.ult-info` text if needed.
7. **Hover card (`src/hovercard.ts`):** `skill:<classId>:guard` shows the guard's name, the kicker `Guard · F`, the class `desc`, and one line naming the perfect-guard bonus.
8. **`tools/guard-check.mjs`** uses the same setup as `tools/battle-fx-check.mjs`: static server on `dist/`, Chromium, 1280×800, `?debug=1`, page errors collected, choose `warden`, wait 1200 ms. Then print PASS/FAIL per check:
   1. `#guard-btn` exists with `data-tip="skill:warden:guard"` and has class `ready`.
   2. **Telegraph shows:** `__emberfall.battle.forceTelegraph()` returns true. Within 300 ms `battle.telegraphs.length === 1`. Save a screenshot of the arena to `sprite-out/guard-telegraph.png` and check `#guard-btn` has class `alert`.
   3. **Perfect guard:**
      - Record `ultCharge`.
      - Poll until `telegraphs[0].remaining <= 0.3`, then press key `f`.
      - Wait 800 ms. Then `guardStats.perfect === 1`, `ultCharge` rose by ≥ 15 (or is 100), and the source has a `stun` effect or `guardStats.perfect` was counted.
      - Save `sprite-out/guard-perfect.png`.
   4. **Cooldown:** immediately after, `battle.useGuard()` returns false and `#guard-btn` has class `cooling`.
   5. **Unguarded heavy:** set `battle.guardCd = 0`, `forceTelegraph()` (on the next living enemy if the first is stunned), do not press, wait `total + 0.8 s` real time. `guardStats.heavyTaken === 1`.
   6. **Early press whiffs:** `guardCd = 0`, `forceTelegraph()`, press `f` at once (remaining > 1 s), wait for the impact. `heavyTaken === 2` and `perfect === 1`.
   7. **Interrupt:** `forceTelegraph()`, then push a stun onto the source with `source.effects.push({ kind: 'stun', remaining: 1, power: 1, tick: 0 })`. Within 300 ms the telegraph is gone and `guardStats.interrupted >= 1`.
   8. **Phone layout:** a new page at 390×844, the same flow to a battle. `document.documentElement.scrollWidth <= innerWidth` and `#guard-btn` and `#ult-btn` are both visible (non-zero bounding boxes inside the viewport).
   9. **No page errors.**

   Keep the battle alive throughout: before each step, set the hero's hp to max and every enemy's hp to max, so nothing dies mid-check. Print `guard-check: N/N pass` last; exit 1 on any failure. Always close the browser and the server.
9. `package.json`: `"check:guard": "npm run build && node tools/guard-check.mjs"`.
10. Acceptance for B: `npm run check:guard` ends `guard-check: 9/9 pass`.

### Integration (lead, after both workstreams)

Run every Acceptance command, fix anything that fails, and write the report.

## Acceptance

- `npx tsc --noEmit -p .` exits 0.
- `npm test` exits 0 and prints `all` and `targets pass` on one line.
- `npm run check:guard` exits 0 and its last line is `guard-check: 9/9 pass`.
- `npm run check:fx` exits 0 and its last line is `battle-fx-check: 9/9 pass`.
- `npm run check:hover` exits 0 and its last line is `hovercard-check: 8/8 pass`.
- `npm run sprites` exits 0 and its last line is `sprites: 25/25 pass`.
- `test -f sprite-out/guard-telegraph.png && test -f sprite-out/guard-perfect.png` exits 0.

## Parallel work

- **Lead first:** step 0 (`npm ci`, A1, A2, `npx tsc --noEmit -p .` passes). Do not delegate before this is done.
- **Workstream A, balance:**
  - owns `src/balance.ts`, `src/data.ts` (numbers only after step 0), `tools/balance/*`, `docs/balance.md`;
  - must not touch `src/combat.ts` except to fix a bug in the step-0 code, and must say so in its summary;
  - its acceptance is `npm test` exits 0.
- **Workstream B, UI:**
  - owns `src/ui.ts`, `src/main.ts`, `src/art.ts`, `src/style.css`, `src/hovercard.ts`, `tools/guard-check.mjs`, `package.json`;
  - uses the step-0 API as written and does not edit `src/combat.ts`, `src/data.ts` or `src/balance.ts`;
  - its acceptance is `npm run check:guard` ends `9/9 pass`.
- **Lead, integration:** after both finish, run the full Acceptance list.

## Constraints

- Do not commit, push, or switch branches.
- A step may touch a file outside **Files to touch** when it has to. List every such file in the report under "outside the plan", one line each saying why.
- The only checks to run are the Acceptance commands, plus `npm run balance -- report|sweep|scaling` for tuning in workstream A. Do not write or run extra end-to-end tests, and do not start a dev server; the check scripts' own static servers are the only servers allowed. If something outside Acceptance fails, note it in the report and finish.
- Do not change hero classes' stats, abilities or ultimates, the boons, the balance target thresholds, the painted unit art, `tools/units/*`, `src/sprites/*` or `src/realm-events.ts`.
- The battle-speed button, enrage, realm events and sparks, hit-stop and painted effects keep working as they do.
- The guard must never be pressed automatically in the game. Only the balance bots press it.

## Out of scope

- Making skills manual or an Auto toggle.
- New enemies, new boss phases, new art or sounds (use the existing `audio.sfx` names: hit, crit, slash, fire, ice, heal, shield, dodge, death, cast, ult, summon, victory, defeat, levelup, click, back, boss, select).
- Changes to the map, reward screen or save format, beyond what `ClassDef.guard` needs.

## If blocked

- If all balance targets cannot pass after a reasonable sweep (about 40 minutes of tuning):
  - stop tuning and keep the best configuration found;
  - make sure `guard-matters` and `normal-teeth` pass if at all possible;
  - record the measured table in `docs/balance.md` and the report, and name which targets still fail and the closest values tried.
- If Chromium will not launch, try `dnf install -y chromium` once. If it still fails, stop and report.
- If a teammate or subagent tool is unavailable, do workstream A then workstream B yourself, in that order, and say so in the report.
