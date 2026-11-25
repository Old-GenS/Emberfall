# Balance notes

How Emberfall's difficulty works, what the current numbers are, and how to change them. This file
is the only place that records balance results. Where it disagrees with the README, old branches,
or anything in `balance-out/`, this file and `src/balance.ts` win.

## Status

Last measured 2026-11-24, after a first balance pass, on this config:

| | Config |
|---|---|
| Emberfall | `2aee208f` |

Everything under *Current results* was measured on this config. No human playtest has confirmed
any of it. Results come from bots: the scripted tiers in `tools/balance/bots.ts`, played through
`tools/balance/run.ts`, which drives the real `Battle` and the real progression (`src/state.ts`)
headless, on seeded dice.

Every report, sweep and `npm test` prints the config it ran on. If the hash there differs from
this table, the result is out of date. See *Keeping this file current*.

Three of the eleven targets below fail on this config, and all three are class design rather
than tuning: the Warden and the Spiritcaller never lose a boss, and the Warden takes three times
as long to win one. The pass before this one failed six.

## Quick reference

| Setting | Value | What it does |
|---|---|---|
| Stages | 25 | 5 realms × 5; every fifth is a boss with two escorts |
| Enemies per wave | 2, then 3 | 3 from each realm's fourth stage |
| Enemy HP | × (1 + 0.155 × stage) | bosses × (1 + 0.24 × stage) |
| Enemy ATK | × (1 + 0.115 × stage) | bosses × (1 + 0.45 × stage) |
| Enemy armor | + 0.35 × stage | on top of the enemy's own |
| Hero per level | +8.5% HP, +7.5% ATK | level 16 at the end of a first-try run |
| XP | 42 + 9 × stage (+60 on a boss) | next level at 40 + 26 × level |
| Boons | 3 offered after each win | weights common 5 · rare 2.6 · epic 1.1 |
| Ultimate | 2/s + 30% of damage dealt + 5% of damage taken | 100 = Ready; resets at every fight |
| Enrage | after 30 s | all damage +8% per second after that: ×2.6 at 50 s, ×3.4 at 60 s |
| Rally | +20% HP and ATK per defeat | capped at 8×; 30 defeats reach 7×; resets on a win or on leaving |
| Clock | 0.75× real time at 1× | `TIME_SCALE` in `src/main.ts`; the speed button doubles it. Every duration in this file is game time |

Class data changed in the pass: the Warden's ATK 23 → 26 and attack interval 1.75 → 1.6 s (its
basic DPS was the lowest of the four by a quarter to a half). Everything else in `src/data.ts`
is as shipped.

All tunable values live in `src/balance.ts`. Damage variance, tick lengths and the spirit wolf are
fixed mechanics in `src/combat.ts` and are not hashed; if you change one, refresh this file by hand.

## How the numbers work

Enemy HP and ATK are linear in the stage; the hero's are linear in level; level is linear in XP;
and XP is fixed per stage. So on a first-try run every hero is the same level at the same stage
and reaches level 16 exactly. The only thing that differs between two runs is the boons, and
boons are multiplicative (`+15% ATK` is ×1.15, and they stack as ×1.15 × 1.15 …). Twenty-four
picks turn into roughly ×2 to ×4 in whatever the player favoured. That is where all the hero's
growth is: the level curve alone turns a starting 23 ATK into 49 by stage 25 while normal
enemies' HP grows ×5 and bosses' ×6.8 before escorts.

`npm run balance -- scaling` prints the whole table. The shape of it:

| Stage | Hero Lv | Enemies | Enemy HP | Enemy ATK | Armor | Pack DPS | Warden time-to-kill | Pyromancer time-to-kill | Threat/s Warden · Pyromancer |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 2 | 147 | 8.5 | 3.0 | 7.5 | 8.9 s | 8.5 s | 2.0% · 2.8% |
| 5 boss | 3 | 3 | 1,051 | 22.4 | 6.7 | 29.9 | 57.4 s | 54.8 s | 6.7% · 9.6% |
| 10 boss | 6 | 3 | 1,785 | 39.4 | 7.1 | 55.3 | 81.8 s | 78.2 s | 10.2% · 14.6% |
| 15 boss | 9 | 3 | 2,739 | 60.1 | 10.2 | 85.1 | 111.1 s | 106.0 s | 13.3% · 19.1% |
| 20 boss | 13 | 3 | 4,119 | 82.4 | 13.3 | 110.9 | 144.7 s | 138.0 s | 14.4% · 20.7% |
| 25 boss | 16 | 3 | 6,562 | 117.5 | 17.1 | 161.1 | 212.7 s | 203.1 s | 18.6% · 26.7% |

Time-to-kill is basic attacks only, so skills, boons and the enrage make it much shorter (the
real Warden boss fight is 50 s, not 213). Threat is enemy basic DPS over hero HP, before armour,
reduction, heals and boons. Normal stages are unchanged from the first measurement and were
never the problem; the boss rows are where the pass put the pressure — boss threat is now 7–27%
of health per second before mitigation, and the enrage after 30 s makes a long fight decisive
for both sides.

## The bots

A tier is a pair of policies for the two decisions a player makes. Everything else — class
stats, skills, enemy waves, XP, boon offers — is the real game.

| Tier | Boons | Ultimate | Who it stands for |
|---|---|---|---|
| Idle | skips every one | never | the UI's "Skip Boon" button; the floor |
| Casual | a random one | never | a player who never notices the button |
| Regular | a random one | the moment it is Ready | a player who presses the glowing button |
| Sharp | the one that fits the class (weighted stat deltas in `bots.ts`) | held for a boss, a pack, or low HP | a player who thinks about both |

`npm run balance -- report --seeds 100 --per-stage` plays every tier × class × seed. 100 seeds
take about 14 s. `--json` writes everything to a file; `balance-out/` is scratch and ignored by git.

## Targets

`npm test` plays 40 seeds per tier and class, prints every target against what it measured, and
fails if one is missed. The targets say what kind of game this is meant to be; they come from the
README's own claims. If a change breaks one, either the change went too far or the target needs
to move — and moving a target is a decision, recorded here.

| Target | Wants | Why | On this config |
|---|---|---|---|
| Regular finishes | ≥ 95% of runs, each class | A relaxed auto-battler: any boon, press the button, see the ending | ok |
| Bosses occasionally need a retry | first-try 50–90%, each class | "Bosses occasionally require a retry": above 90% they never do, below 50% the boss is a wall | **fails**: Pyromancer 63% and Shadowblade 83% are in band; Warden and Spiritcaller 100% |
| Normal stages flow | first-try ≥ 90%, each class | Retries belong to bosses | ok |
| Nobody gets stuck | 0 walled runs, every tier | "Retry as many times as you like" and no way to drop a boon: a wall means abandoning the run | ok (Idle finishes 100%) |
| The ultimate is there to be used | Ready in ≥ 75% of normal and ≥ 95% of boss fights, each class | It is the one in-combat decision; a button that never glows is not a decision | ok: 80–92% normal, 100% boss |
| Pressing it changes something | boss first-try ≥ 8 points above Casual (class mean) | If never touching it changes no outcome, the decision is decorative | ok: 60.8 points |
| The reward screen counts | Idle: ≥ 2 more retries per run, or ≥ 10 points fewer finishes | The other decision has to count — but never cost the run (see above) | ok: 51.7 vs 0.9 retries |
| Normal fights are readable | mean 6–30 s, each class | Long enough to see the skills, short enough not to reach for the speed button. Game time: ×1.33 on screen at the default pace | ok |
| Boss fights are set pieces | mean 15–60 s, each class | Longer than a normal fight; the enrage now starts at 30 s | ok: Warden 49.7 s, others 16–39 s |
| Classes feel alike in length | boss duration max ÷ min ≤ 2 | No class should take twice as long as another | **fails**: 3.08× (Warden 49.7 s, Pyromancer 16.1 s) |
| The doc is current | Status hash = current | Results are only true for the config they were measured on | ok |

## Current results

### Tiers

100 seeds per cell, step 1/30 s. Durations are means over first-try wins; "Ult ≥ 1" is the share
of fights in which the ultimate reached Ready at least once (N = normal stages, B = bosses);
"ults/f" is ults cast per first-try fight.

| Tier | Class | Finishes | Retries/run | Walled | Boss 1st | Normal 1st | Ult ≥ 1 N · B | ults/f | Normal | Boss | Boss p90 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Idle | Warden | 100% | 30.2 | 0 | 20% | 96% | 93% · 100% | 0.0 | 27.8 s | 46.5 s | 47.4 s |
| Idle | Pyromancer | 100% | 76.9 | 0 | 0% | 67% | 84% · 92% | 0.0 | 15.8 s | 0.0 s | 0.0 s |
| Idle | Shadowblade | 100% | 57.7 | 0 | 0% | 80% | 92% · 69% | 0.0 | 16.9 s | 31.9 s | 31.9 s |
| Idle | Spiritcaller | 100% | 42.2 | 0 | 0% | 85% | 80% · 60% | 0.0 | 23.0 s | 0.0 s | 0.0 s |
| Casual | Warden | 100% | 2.2 | 0 | 66% | 100% | 93% · 100% | 0.0 | 17.2 s | 50.2 s | 61.1 s |
| Casual | Pyromancer | 100% | 13.7 | 0 | 2% | 100% | 87% · 100% | 0.0 | 10.8 s | 24.2 s | 29.8 s |
| Casual | Shadowblade | 100% | 8.6 | 0 | 14% | 100% | 92% · 100% | 0.0 | 11.6 s | 32.5 s | 39.0 s |
| Casual | Spiritcaller | 100% | 8.0 | 0 | 23% | 100% | 80% · 100% | 0.0 | 16.0 s | 42.9 s | 53.6 s |
| Regular | Warden | 100% | 0.0 | 0 | 100% | 100% | 92% · 100% | 4.0 | 17.2 s | 50.1 s | 61.0 s |
| Regular | Pyromancer | 100% | 2.1 | 0 | 63% | 100% | 87% · 100% | 1.6 | 6.5 s | 17.0 s | 25.4 s |
| Regular | Shadowblade | 100% | 0.9 | 0 | 83% | 100% | 92% · 100% | 1.9 | 7.2 s | 17.0 s | 24.6 s |
| Regular | Spiritcaller | 100% | 0.0 | 0 | 100% | 100% | 80% · 100% | 2.2 | 11.2 s | 38.8 s | 47.0 s |
| Sharp | Warden | 100% | 0.0 | 0 | 100% | 100% | 93% · 100% | 0.2 | 22.6 s | 62.1 s | 79.7 s |
| Sharp | Pyromancer | 100% | 1.2 | 0 | 79% | 100% | 89% · 100% | 0.8 | 6.3 s | 8.8 s | 14.1 s |
| Sharp | Shadowblade | 100% | 1.2 | 0 | 79% | 100% | 92% · 100% | 1.4 | 6.1 s | 13.2 s | 19.2 s |
| Sharp | Spiritcaller | 100% | 0.1 | 0 | 98% | 100% | 81% · 100% | 1.5 | 17.4 s | 41.5 s | 51.8 s |

Every run ends at level 16. No Regular, Casual or Sharp run ever retried a normal stage. Three
things to read off this table: the ultimate is now decisive (Casual's boss first-try is 2–23%
for three classes against Regular's 63–100%, and a Casual Pyromancer retries 13.7 times a run);
the Idle floor is no longer a wall but a grind (30–77 retries a run); and the Warden casts its
ultimate four times per fight on average, because damage taken and thorns charge it.

### By stage (Regular)

First-try win % · mean duration · % of fights with the ultimate Ready at least once.

| Stage | Realm | Boss | Warden | Pyromancer | Shadowblade | Spiritcaller |
|---|---|---|---|---|---|---|
| 1 | Ashen Reach |  | 100% · 6.3s · 0% | 100% · 6.1s · 0% | 100% · 6.7s · 0% | 100% · 7.5s · 0% |
| 2 | Ashen Reach |  | 100% · 13.8s · 91% | 100% · 9.2s · 20% | 100% · 9.9s · 69% | 100% · 11.7s · 1% |
| 3 | Ashen Reach |  | 100% · 13.1s · 94% | 100% · 8.6s · 52% | 100% · 9.1s · 90% | 100% · 11.0s · 1% |
| 4 | Ashen Reach |  | 100% · 18.8s · 100% | 100% · 9.4s · 100% | 100% · 10.6s · 100% | 100% · 13.0s · 100% |
| 5 | Ashen Reach | BOSS | 100% · 40.0s · 100% | 52% · 18.5s · 100% | 78% · 18.3s · 100% | 100% · 33.7s · 100% |
| 6 | Whisperwood |  | 100% · 8.4s · 57% | 100% · 6.0s · 64% | 100% · 6.5s · 74% | 100% · 8.3s · 6% |
| 7 | Whisperwood |  | 100% · 16.7s · 100% | 100% · 8.1s · 100% | 100% · 7.0s · 100% | 100% · 12.0s · 100% |
| 8 | Whisperwood |  | 100% · 19.0s · 100% | 100% · 8.1s · 100% | 100% · 6.9s · 100% | 100% · 12.4s · 100% |
| 9 | Whisperwood |  | 100% · 22.0s · 100% | 100% · 8.1s · 100% | 100% · 12.0s · 100% | 100% · 13.6s · 100% |
| 10 | Whisperwood | BOSS | 100% · 50.0s · 100% | 31% · 16.3s · 100% | 61% · 18.0s · 100% | 99% · 39.0s · 100% |
| 11 | Frostveil Peaks |  | 100% · 12.1s · 100% | 100% · 4.0s · 100% | 100% · 5.2s · 100% | 100% · 8.9s · 100% |
| 12 | Frostveil Peaks |  | 100% · 20.8s · 100% | 100% · 8.4s · 100% | 100% · 6.5s · 100% | 100% · 14.4s · 100% |
| 13 | Frostveil Peaks |  | 100% · 21.7s · 100% | 100% · 8.1s · 100% | 100% · 7.4s · 100% | 100% · 14.7s · 100% |
| 14 | Frostveil Peaks |  | 100% · 26.0s · 100% | 100% · 7.9s · 100% | 100% · 9.8s · 100% | 100% · 15.3s · 100% |
| 15 | Frostveil Peaks | BOSS | 100% · 54.1s · 100% | 69% · 18.9s · 100% | 86% · 18.6s · 100% | 100% · 43.0s · 100% |
| 16 | Sunken Sanctum |  | 100% · 13.3s · 100% | 100% · 3.9s · 100% | 100% · 4.9s · 100% | 100% · 8.3s · 100% |
| 17 | Sunken Sanctum |  | 100% · 20.8s · 100% | 100% · 6.3s · 100% | 100% · 6.8s · 100% | 100% · 13.4s · 100% |
| 18 | Sunken Sanctum |  | 100% · 18.6s · 100% | 100% · 6.0s · 100% | 100% · 6.0s · 100% | 100% · 11.5s · 100% |
| 19 | Sunken Sanctum |  | 100% · 24.6s · 100% | 100% · 6.1s · 100% | 100% · 8.7s · 100% | 100% · 13.0s · 100% |
| 20 | Sunken Sanctum | BOSS | 100% · 49.6s · 100% | 87% · 15.5s · 100% | 98% · 15.2s · 100% | 100% · 36.2s · 100% |
| 21 | Ember Throne |  | 100% · 13.4s · 100% | 100% · 3.3s · 100% | 100% · 4.6s · 100% | 100% · 8.0s · 100% |
| 22 | Ember Throne |  | 100% · 16.6s · 100% | 100% · 4.7s · 100% | 100% · 4.4s · 100% | 100% · 9.3s · 100% |
| 23 | Ember Throne |  | 100% · 17.2s · 100% | 100% · 4.4s · 100% | 100% · 4.6s · 100% | 100% · 9.1s · 100% |
| 24 | Ember Throne |  | 100% · 21.1s · 100% | 100% · 4.0s · 100% | 100% · 6.6s · 100% | 100% · 9.4s · 100% |
| 25 | Ember Throne | BOSS | 100% · 56.5s · 100% | 77% · 16.3s · 100% | 92% · 15.6s · 100% | 100% · 42.1s · 100% |

The ultimate is Ready in every boss fight and in almost every fight from stage 4 on; only the
Spiritcaller's first realm mostly goes without (it has the least damage to charge from). The
first boss (stage 5) is the hardest for the squishy classes — 52% and 78% first-try — before
boons have accumulated; the Pyromancer's hardest is the Whisperwood boss at 31%.

## Findings

1. **Bosses now occasionally need a retry, for two classes.** Pyromancer 63% and Shadowblade 83%
   first-try on bosses, 2.1 and 0.9 retries per run; normal stages are still never replayed.
   Warden and Spiritcaller remain at 100% (see 5).
2. **The ultimate is there, and it matters.** Ready in 80–92% of normal fights and every boss
   fight; never pressing it costs 60.8 points of boss first-try (class mean). A Casual
   Pyromancer retries 13.7 times a run, a Casual Shadowblade 8.6.
3. **Nobody gets stuck.** With Rally at +20% per defeat the boonless Idle tier finishes every
   run (it walls on the final boss at +12%). It is a grind, not a trap: 30–77 retries a run.
4. **The Warden's boss fights are 50 s, not 73** (p90 100 → 61 s), and every boss fight on
   Regular is now under 60 s. The enrage at 30 s fires on the Warden's and Spiritcaller's boss
   fights and nowhere else.
5. **The Warden and the Spiritcaller never lose a boss.** No boss-ATK value up to ×3.5 of the
   old one moves them; a quarter off Radiant Ward's and Spirit Bloom's healing didn't either
   (tried and reverted). Their sustain plus the ultimate — which damage taken and thorns
   charge, so the Warden casts it four times per fight — is the mechanism, and it is class
   design, not a number.
6. **The Warden takes three times as long.** 49.7 s boss fights against the Pyromancer's 16.1 s
   (3.08×). Its damage bump brought that down from 3.7×; reaching 2× would take roughly double
   its damage, or a different target.
7. **The always-ready ultimate makes burst classes' late normal fights very short.** Pyromancer
   stages 21–24 are 3.3–4.7 s; the class mean of 6.5 s passes the target only because the early
   game is longer. A 280% AoE meteor against late waves of ~1,500 HP is most of the fight.
   `enemy.hpPerStage` 0.2 adds about half a second and cost two other targets (tried and
   reverted); this is the Pyromancer's kit.
8. **Unchanged from the first measurement:** level is a restatement of stage (every run ends at
   16); flat regeneration is dead late; boon choice does not change outcomes (Sharp ≈ Regular),
   though Sharp's fitted Pyromancer halves its boss fights (8.8 s) and its Sharp Warden holds a
   defensive ultimate it never needs (0.2 casts per fight, 62 s boss fights).

## First pass (applied 2026-11-24)

Each row was chosen from a sweep on the config it was applied to, then the whole set was
re-measured. `68d6a1f0` → `2aee208f`; targets failing 6 → 3.

| Setting | Was | Now | Evidence (Regular tier unless noted) |
|---|---|---|---|
| `ultimate.chargeDealt` | 0.085 | 0.3 | Ready in normal fights 45 → 87% |
| `ultimate.passiveCharge` | 0.75 | 2 | with the above; the Spiritcaller's 69% → 80% |
| `enemy.bossAtkPerStage` | 0.13 | 0.45 | Pyromancer boss first-try 99 → 63%, Shadowblade 100 → 83%; Warden and Spiritcaller stay at 100% |
| `enemy.bossHpPerStage` | 0.18 | 0.24 | burst classes' boss fights back over 15 s once the ultimate was always available (Pyromancer 14.3 → 17.0 s) |
| `combat.enrageAt`, `enrageRamp` | 70, 0.018 | 30, 0.08 | Warden boss fights 73 → 50 s, no outcome change |
| `rally.step`, `rally.cap` | 0.12, 2.2 | 0.2, 8 | Idle walls 80 → 0 within 30 retries; the cap is never reached, the step is what matters |
| Warden `stats` (`src/data.ts`) | ATK 23, speed 1.75 | ATK 26, speed 1.6 | lowest basic DPS of the four by 25–45%; parity 3.7× → 3.1×, boss 60 → 50 s |

Tried and reverted: Radiant Ward heal 18 → 14% and Spirit Bloom heal 24 → 18% (no effect on
boss first-try); `enemy.hpPerStage` 0.155 → 0.2 (Pyromancer late fights +0.5 s, but two Idle
walls and a sub-15 s boss fight came back).

## Remaining proposals

A sweep proposes; a person decides. To apply one, edit `src/balance.ts`, run `npm test`, and
update this file.

| Problem | Proposal | Why it is not done |
|---|---|---|
| Warden and Spiritcaller never lose a boss | a boss mechanic: damage as a share of max HP, reduced healing, or a dispel | design, not tuning — no setting reaches it |
| The Warden takes 3× as long | double its damage kit, or move the parity target to ~3 | a class rework, or a decision about what parity should mean |
| Pyromancer's late normal fights are 3–5 s | Fallen Star power 2.8 → ~2.0, or `enemy.hpPerStage` ~0.3 | the first is class work; the second costs two other targets |
| A Casual player retries 8–14 times a run | none yet | watch a playtest: the button now says "Ready · press Space" |

## How to retune

Change one setting at a time, then run `npm test` and read the table.

| Problem | Change first |
|---|---|
| The ultimate is never Ready | `ultimate.chargeDealt` (steps of 0.05), then `ultimate.passiveCharge` |
| Bosses never need a retry (Pyromancer, Shadowblade) | `enemy.bossAtkPerStage` (steps of 0.05) |
| Bosses never need a retry (Warden, Spiritcaller) | no setting reaches it; see *Open questions* |
| Boss fights too long | `combat.enrageAt`, then `combat.enrageRamp`; or `enemy.bossHpPerStage` |
| Burst classes' normal fights too short | their ultimates' `power` in `src/data.ts`; `enemy.hpPerStage` also works but moves everything else |
| Normal stages need retries | `enemy.hpPerStage`, `enemy.atkPerStage`, `enemy.count` |
| A player gets stuck | `rally.step` (the cap is rarely reached) |
| Levels feel pointless | `hero.hpPerLevel`, `hero.atkPerLevel` — XP itself cannot matter while it is fixed per stage |
| One class feels wrong | its `stats`, `abilities` and `ultimate` in `src/data.ts` |
| One boon feels wrong | its `apply` in `src/data.ts`; `npm run balance -- --tiers sharp,regular` shows whether picks change anything |

Run `npm run balance -- sweep --set <path>=v1,v2,… [--set <other>=…] [--tiers a,b] [--seeds N]`
to try values before changing them. Sweeps are bot play: use them for coarse fixes, then read
the per-stage table for the class you changed. The first pass went through four rounds of
"sweep, apply, `npm test`"; expect the same.

## Keeping this file current

Any change to `src/balance.ts`, to a numeric field in `src/data.ts` (class stats, abilities,
enemies), or to a boon's `apply` changes the config hash. `npm test` then fails on *The doc is
current* until the Status row above names the new hash. In the same change:

- Run `npm run balance -- --seeds 100 --per-stage` and re-create the two tables under *Current
  results* from its output (the per-stage one is a paste of the four "regular × … by stage"
  tables).
- Re-run every sweep you quote, and `npm test` for the targets column.
- Update *Status*, *Quick reference*, *Findings*, *First pass* and any value quoted elsewhere.
- Move a result that no longer applies to *History*, with its date and config.
- `npm run balance -- --json balance-out/report.json` is scratch; `balance-out/` is not tracked.
  Don't quote a number from it unless its hash matches *Status*.

The Pages workflow does not run `npm test`. With three targets red by design, that is still the
right call. When a decision (a Warden rework, a parity target, a boss mechanic) brings them
green, add `- run: npm test` before the build step in `.github/workflows/deploy.yml` so a stale
doc or a broken target blocks the deploy.

## Open questions

- **Human playtest, more than before.** Bosses hit ~3.5× harder than at launch. Is a Pyromancer
  retrying twice a run right for a "relaxed" game? Are her 3–5 s late fights too quick to read,
  even at the slower clock? Is a Warden boss fight at 50 s a set piece or a slog?
- **The ultimate is close to mandatory.** A player who never presses it retries bosses 8–14
  times a run as Pyromancer or Shadowblade. The button says "Ready · press Space" and the
  first-fight hint explains it; whether that is enough is a playtest question.
- **Boss pressure for the Warden and Spiritcaller.** If "bosses occasionally need a retry" is
  meant to hold for them, it needs a mechanic (share-of-max-HP damage, healing reduction, a
  dispel), not a stat. Their ultimates are also up constantly because damage taken and thorns
  charge them; charging less from damage taken would make the Warden's ultimate a decision again.
- **Parity.** Either the Warden's damage kit grows to about double, or the target moves to
  about 3. A Warden player currently spends three times as long on bosses as a Pyromancer.
- **Burst versus the ultimate.** Making the ultimate always available shortened the burst
  classes' fights; keeping them readable needs either weaker ultimates or more enemy HP, and
  more enemy HP costs the boonless floor. The two targets pull against each other.
- **The boonless floor is a grind, not a trap.** 30–77 retries a run. A "replace a boon" or
  "restart with your boons" option would fix it in the spirit of "no death penalty".
- **Should the ultimate carry over between fights?** It would let a player save it for a boss —
  the decision the README describes. Availability is now fine; this is about timing.
- **Level as a restatement of stage**, and **flat regeneration**: unchanged from the first
  measurement. A stat point per level, and regen as a share of max HP, would both be small
  changes with real effect.
- **The Sharp bot's Warden.** It holds a defensive ultimate for "low HP" and never gets there
  (0.2 casts per fight, 62 s boss fights). Either the bot's rule or the Warden's ultimate is
  wrong about what the class needs.

## History

**2026-11-24 — first balance pass (`68d6a1f0` → `2aee208f`).** Applied the first measurement's
sweeps in four rounds: ultimate charge ×2.7 from damage dealt and ×2.7 passive; boss ATK ×3.5,
boss HP +33%; enrage from 70 s / 1.8% to 30 s / 8%; Rally from +12% / 2.2× to +20% / 8×; Warden
ATK 23 → 26 and attack interval 1.75 → 1.6 s. Targets failing 6 → 3. The three left (Warden and
Spiritcaller never lose a boss; parity 3.08×) need class design or a decision, not a number.

**2026-11-24 — first measurement (`68d6a1f0`).** The harness, `src/balance.ts` and this file
were added after a review found the README's balance claims unverified. Four behaviour fixes
landed just before the constants moved and were confirmed not to change any seeded outcome
(640 runs, 22,168 fights, identical before and after): the result panel named the next realm
after a boss kill; enemy armour scaled on `stage + stage-in-realm`, which gave every realm's
boss more armour than the next realm's enemies; the 2× speed button was capped to 1.5× at
30 fps by the 50 ms step limit; and the ability bar showed `1` `2` `3` key hints on auto-cast
skills whose keys actually fire the ultimate. On that config: every boon-taking run finished,
boss first-try was 98–100% for every class, the ultimate was Ready in 38–48% of normal fights
and never on stages 1–8, pressing it was worth 3.5 points, Warden boss fights ran 72.9 s
(p90 100 s), and a boonless Pyromancer or Shadowblade could not pass the final boss at all.
