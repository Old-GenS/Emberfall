# Balance notes

How Emberfall's difficulty works, what the current numbers are, and how to change them. This file
is the only place that records balance results. Where it disagrees with the README, old branches,
or anything in `balance-out/`, this file and `src/balance.ts` win.

## Status

Last measured 2026-11-27, after the roguelike phase 2 pass, on this config:

| | Config |
|---|---|
| Emberfall | `62683fe9` |

Everything under *Current results* was measured on this config. No human playtest has confirmed
any of it. Results come from bots: the scripted tiers in `tools/balance/bots.ts`, played through
`tools/balance/run.ts`, which drives the real `Battle` and the real progression (`src/state.ts`)
headless, on seeded dice.

Every report, sweep and `npm test` prints the config it ran on. If the hash there differs from
this table, the result is out of date. See *Keeping this file current*.

Most targets pass on this config. The misses are **boss-retry** (Pyromancer 41%, Shadowblade
49% on 100 seeds), **attrition** for the two self-healing classes, **ult-available** for the
burst classes, **pacing-normal** (Pyromancer 6.1 s against a 6 s floor) and **parity**, all
explained in *Roguelike phase 2*. The new **elite-fair** target passes on the 40-seed check: the
Pyromancer's 92% is measured over 31 elite fights, while the Warden, Shadowblade and Spiritcaller
fall below the 20-fight sample floor and read "too few". Regular's boss first-try on 100 seeds is
Warden 87%, Pyromancer 41%, Shadowblade 49%, Spiritcaller 85%.

## Quick reference

| Setting | Value | What it does |
|---|---|---|
| Stages | 25 | 5 realms × 5; every fifth is a boss with two escorts |
| Enemies per wave | 2 (3 from stage 4) | random draw from the realm's first two enemies; the elite is forced on stage 4 and rolls 50/70/100% on stages 2–4 |
| Enemy HP | × (1 + 0.12 × stage) | bosses × (1 + 0.34 × stage) |
| Enemy ATK | × (1 + 0.25 × stage) | bosses × (1 + 0.15 × stage); escorts × (1 + 0.55 × stage) |
| Enemy armor | + 0.35 × stage | on top of the enemy's own |
| Hero per level | +8.5% HP, +7.5% ATK | level 16 at the end of a first-try run |
| XP | 42 + 9 × stage (+60 on a boss) | next level at 40 + 26 × level |
| Boons | 3 offered after each win | weights common 5 · rare 2.6 · epic 1.1; defensive ones (HP, armour/reduction, Titan Blood's HP) diminish with each copy: 100%, 62%, 45%, 35%… |
| Ultimate | 2/s + 30% of damage dealt + 5% of damage taken | 100 = Ready; resets at every fight; at most one cast per 5 s; charge rate capped at 1.6× |
| Enrage | after 30 s | all damage +8% per second after that; applied after armour, so it is the one pressure a tank cannot mitigate. Left at these original values because `tools/battle-fx-check.mjs` asserts its 30 s behaviour |
| Guard | 0.6 s window, 4 s cooldown | halves ordinary hits; a heavy inside the window is a perfect guard (10% damage, stagger 1.4 s, +20 ultimate) |
| Heavy | 1.0 s wind-up | each boss and elite; cooldown 8.5–11 s, first at 5–7 s; elite power 11, boss power 5.6–8.0; a stun during the wind-up interrupts it |
| Rally | +20% HP and ATK per defeat | capped at 8×; 30 defeats reach 7×; resets on a win or on leaving |
| Run seed | 31-bit, per run | all normal waves, elite affixes, path offers and event outcomes draw from it; a retry keeps it, a new run rolls a new one |
| Path | two nodes before steps 1–3 | fight / elite / shrine / event; offers are seeded per `(runSeed, stage)`; at least one is combat; the shrine is twice as likely on step 3 |
| Affixes | 25% + 15% per realm, cap 85% | an elite rolls Burning, Swift, Armored or Vampiric |
| Health carry | +18% max HP after a normal win, +25% per defeat on a retry, floor 20% | a boss restore is full; health is kept within a realm |
| Logic revision | 4 | bumped when `combat.ts`/`state.ts` logic changes; part of the config id |
| Clock | 0.75× real time at 1× | `TIME_SCALE` in `src/main.ts`; the speed button doubles it. Every duration in this file is game time |

Class data changed since launch: the Warden's ATK 23 → 26 and attack interval 1.75 → 1.6 s (its
basic DPS was the lowest of the four by a quarter to a half), and Radiant Ward became shield +
reflection + damage instead of heal + shield + regeneration (see *Ability and logic changes*).
The elites' ATK is lower than shipped (12–16 → 3.3–4.4) and their heavy power is 3.5×; the bosses are as shipped except for the scaling in `src/balance.ts`.

All tunable values live in `src/balance.ts`. Damage variance, tick lengths and the spirit wolf are
fixed mechanics in `src/combat.ts` and are not hashed; if you change one, refresh this file by hand.

## Roguelike phase 1 (2026-11-27, `7ede224f`)

Three run-level rules, then a retune:

- **Random waves.** Normal stages draw their enemies from the realm's pool, seeded per run. A retry
  replays the same wave; a new run rolls a new `runSeed`. `buildWave(stage, seed)` is deterministic
  and never calls `Math.random`; boss stages are unchanged and fixed. Stage 1 has no elite, stages 2
  and 3 have a 70% / 90% chance of one, stage 4 always has exactly one.
- **Elite modifiers.** The elite (the third enemy in a realm's pool) can roll Burning (attacks apply
  a 3 s burn at 15% ATK/s), Swift (attack interval ×0.75), Armored (+12 armor, 15% damage
  reduction) or Vampiric (25% lifesteal). The chance is 25% + 15% per realm, capped at 85%, and the
  affix is shown in the name (e.g. "Burning Magma Brute"). Bosses and escorts never roll one.
- **Health carries within a realm.** The next stage starts at the health the last one ended on, plus
  25% of max HP after a normal win. A boss clear restores full health. A defeat retries from the
  health the stage was entered with, plus 25% per defeat, never below 20%. A new class or a reset
  rolls a new seed and starts at full health.

The new target is **attrition**: *Regular's mean health entering first-try boss fights is 40–85%,
each class* — "A realm is one stretch of road: sloppy normal fights should leave you weaker at the
boss, but never hopeless."

What was tuned, and why (one line each). dsh's pass changed the enemy curve heavily (elite heavies
at 11× ATK, boss heavies doubled, boss attack growth cut to 0.15 with escorts raised to 0.55) and
still missed four targets; those values were reverted to the guard-pass curve and the pass below was
done by hand.

| Change | Why |
|---|---|
| `run.healOnWin` 0.25 | Below 0.2 the burst classes (Pyromancer, Shadowblade) reach bosses too hurt to win half the time; above 0.3 nobody's health carries at all. |
| `run.eliteChance` [0, 0.5, 0.7, 1] → [0, 0.7, 0.9, 1] | Fewer elites than the old fixed waves made normal fights shorter and emptier. |
| `enemy.atkPerStage` 0.5 → 0.4, `escortAtkPerStage` 0.12 → 0.3, `bossAtkPerStage` 0.45 → 0.38 | The three-enemy fourth stage of each realm out-damaged its boss (this already slipped through the guard pass). Now every normal stage stays under its boss stage, which `run-check` asserts, and the boss itself hits a little softer because heroes arrive hurt. |
| `guard.bonusBurnPower` 1.1 → 2.2, `bonusHeal` 0.06 → 0.04 | The sustain-vs-burst class gap is wider with carried health; these are the per-class levers. |
| Spiritcaller regen 0.6 → 0.3/s, Spirit Bloom heal 24% → 16%, Gaia's Embrace heal 25% → 20% | It out-healed every fight and walked into bosses at 95% health. |

Known misses on this config: **attrition** fails for the Warden (about 94%) and the Spiritcaller
(about 96%): both heal themselves during fights, so carried health mostly matters for the burst
classes. **Normal fights are readable** is 5.8 s for the Pyromancer (floor 6 s). **Parity** as before.
These want a playtest before more tuning; they are design questions about the sustain classes.

## Roguelike phase 2 (2026-11-27, `62683fe9`)

The run is now a branching road. Each realm still has five stages (global `realm*5 + 0..4`):
step 0 is always a normal fight and step 4 is always the boss; before steps 1, 2 and 3 the player
picks one of **two offered nodes**. Offers are seeded from `(runSeed, stage)`, so a reload never
rerolls them. The two nodes are distinct and at least one is a fight or an elite; the shrine weight
is doubled on step 3, the stop before the boss. With the 45/25/15/15 weights a Regular bot meets about three elites a run and a Sharp bot
about seven (Sharp takes elites when healthy).

The nodes:

- **Fight** — the old random wave, with the normal boon pick after it.
- **Elite** — the realm's elite is forced into the wave and given an affix if it had none; every
  enemy's HP scale is multiplied by `eliteHp` (2.5) and its ATK scale by `eliteAtk` (1.0). The reward is a rare-or-better
  boon pick and stage XP × `eliteXp` (1.5).
- **Shrine** — no fight. Rest heals 35% of max HP; Offering costs 20% of max HP and draws a
  rare-or-better boon. Both award half the stage's XP and never take health below 5%.
- **Event** — no fight, one of three seeded scenes. **The Ash Merchant** trades 25% of max HP for a
  rare boon or lets you leave. **A Cursed Reliquary** is a seeded 50/50: an epic boon or 30% max HP
  lost. **The Wounded Pilgrim** grants the stage's full XP (Tend) or heals 20% max HP (Pray). All
  three award the event's XP share when the scene ends.

The bots gained a path policy each:

| Tier | Node | Shrine | Event |
|---|---|---|---|
| Idle | the first offer | always Rest | leave, and Pray to the pilgrim |
| Casual | a random offer | random | random choice |
| Regular | shrine below 45% HP; else fight; else elite | Rest below 60% HP, else Offering | trade/open at ≥ 60% HP, leave below; Pray below 60%, Tend above |
| Sharp | elite at ≥ 70% HP; shrine below 50%; else fight; else the combat node offered | same as Regular | same as Regular |

The new target is **elite-fair**: *Regular's first-try win on elite nodes is 60–95%, each class,
only for classes with at least 20 elite fights; otherwise pass with the note "too few"*. On 100
seeds: Warden 91% · Pyromancer 77% · Shadowblade 79% · Spiritcaller 91%.

What was tuned, and why (one line each). dsh's pass cut elites to 4% of offers and made them 5%
tougher, which kept every target by making elites all but disappear (the elite target passed on
"too few" fights). Those values were reverted and the pass below was done by hand.

| Change | Why |
|---|---|
| `path.weights` 45 / 25 / 15 / 15 (as designed) | Elites are the point of the road; at one in four offers they show up about three times a run. |
| `path.eliteScale` → `eliteHp` 2.5, `eliteAtk` 1.0 | A single scale either made elites free (at 1.15 a Regular player won 89–99%) or let an elite pack out-damage its realm's boss, which *Elite pack DPS* forbids. Elites are now much tougher, not deadlier: their danger is the forced elite, its affix and a long fight. |
| `enemy.bossHpPerStage` 0.24 → 0.26 | Rare boons from elites shortened the Pyromancer's boss fights below the 14 s pacing floor. |
| `run.healOnWin` 0.25 (unchanged) | dsh's 0.18 starved the burst classes before bosses. |

Known misses on this config, the same as before phase 2: **attrition** (the self-healing Warden and
Spiritcaller reach bosses near full health), **pacing-normal** (the Pyromancer's normal fights are
just under 6 s) and **parity**. Boss first-try on 100 seeds: Warden 89% · Pyromancer 51% · Shadowblade 61% · Spiritcaller 88%; the 40-seed `npm test` can read a
class a point or two outside the band.

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

A tier is a trio of policies for the three decisions a player makes beyond choosing a class:
which boon, when to fire the ultimate, and when to guard. Everything else — class stats, skills,
enemy waves, XP, boon offers — is the real game.

| Tier | Boons | Ultimate | Guard | Who it stands for |
|---|---|---|---|---|
| Idle | skips every one | never | never | the floor: if this wins, nothing the player does matters |
| Casual | a random one | never | never | a player who never notices the buttons |
| Regular | a random one | the moment it is Ready | sloppy: 65% of heavies caught, the rest ignored | a player who presses the ultimate when it glows and guards most wind-ups |
| Sharp | the one that fits the class (weighted stat deltas in `bots.ts`) | held for a boss, a pack, or low HP | perfect: every heavy at the last moment | a player who thinks about all three |

`npm run balance -- report --seeds 100 --per-stage` plays every tier × class × seed. 100 seeds
take about 65 s. `--json` writes everything to a file; `balance-out/` is scratch and ignored by git.

## Targets

`npm test` plays 40 seeds per tier and class, prints every target against what it measured, and
fails if one is missed. The targets say what kind of game this is meant to be; they come from the
README's own claims. If a change breaks one, either the change went too far or the target needs
to move — and moving a target is a decision, recorded here.

| Target | Wants | Why | On this config |
|---|---|---|---|
| Regular finishes | ≥ 95% of runs, each class | A relaxed auto-battler: any boon, press the buttons, see the ending | ok: 100% |
| Bosses occasionally need a retry | first-try 50–90%, each class | "Bosses occasionally require a retry": above 90% they never do, below 50% the boss is a wall | **fails**: 87 / 48 / 50 / 87% (40 seeds) |
| Normal stages flow | first-try ≥ 90%, each class | Retries belong to bosses; a normal stage that has to be replayed is a chore, even with the guard | ok: 99 / 95 / 96 / 98% |
| Normal fights cost real health | mean 35–85% health left after a won first-try normal fight, each class | A normal stage that leaves the hero at full health is a formality, and a heavy you can ignore is not a decision | ok: 78 / 67 / 69 / 66% |
| Elites are a fair gamble | first-try 60–95%, each class (≥ 20 elite fights) | An elite costs more than a normal fight: it should be a risk a Regular player takes on purpose, not a wall and not free | ok: too few / 92 / too few / too few |
| Health carries weight | mean 40–85% health entering a first-try boss fight, each class | A realm is one stretch of road: sloppy normal fights should leave you weaker at the boss, but never hopeless | **fails**: 92 / 72 / 72 / 91% (Warden, Spiritcaller) |
| Nobody gets stuck | 0 walled runs, every tier | "Retry a stage as many times as you like" and no way to drop a boon: a wall means abandoning the run | ok: none |
| The ultimate is there to be used | Ready in ≥ 75% of normal and ≥ 95% of boss fights, each class | One of the two in-combat decisions (the other is the guard): a button that never glows is not a decision | **fails**: 90/86/91/80% normal, 100/94/88/99% boss |
| Pressing it changes something | boss first-try ≥ 8 points above Casual (class mean) | If never touching the ultimate changes no outcome, the ultimate is no decision; the guard is measured separately | ok: 67.9 points |
| Guarding a heavy changes something | boss first-try ≥ 12 points above Casual (class mean) | A telegraphed heavy is the guard's reason to exist: catching most of them must beat bosses more often than never pressing | ok: 67.9 points |
| The reward screen counts | Idle: ≥ 2 more retries per run, or ≥ 10 points fewer finishes | The boon choice has to count — but never cost the run | ok: 111.9 vs 2.7 retries |
| Normal fights are readable | mean 6–30 s, each class | Long enough to see the skills, short enough not to reach for the speed button | **fails**: 13.5 / 5.8 / 7.0 / 10.5 s |
| Boss fights are set pieces | mean 14–60 s, each class | Longer than a normal fight, and short enough to want to try again after a loss | ok: 41.5 / 14.4 / 17.3 / 36.3 s |
| Classes feel alike in length | boss duration max ÷ min ≤ 2 · finishes within 5 points | No class should take twice as long as another to do the same job | **fails**: 2.88× (40 seeds: Warden 41.5 s, Pyromancer 14.4 s); finishes within 0 points |
| The doc is current | Status hash = current | Results are only true for the config they were measured on | ok |

## Current results

### Tiers

100 seeds per cell, step 1/30 s. Durations are means over first-try wins; "HP" is the share of
health left after a won first-try fight (N = normal stages, B = bosses), "HP@B" the share entering
one; "Guard/f" is perfect
guards per first-try fight; "Ult ≥ 1" is the share of fights in which the ultimate reached Ready
at least once; "ults/f" is ults cast per first-try fight.

| Tier | Class | Finishes | Retries/run | Walled | Boss 1st | Normal 1st | Elite 1st | Nodes E/S/Ev | HP N · B | Ult ≥ 1 N · B | ults/f | Normal | Boss | Boss p90 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Idle | Warden | 100% | 118.8 | 0 | 0% | 36% | 9% | 3.6/2.8/2.1 | 60% · 0% | 50% · 25% | 0.0 | 9.5s | 0.0s | 0.0s |
| Idle | Pyromancer | 100% | 153.8 | 0 | 0% | 30% | 1% | 4.0/2.5/2.0 | 61% · 0% | 30% · 20% | 0.0 | 8.0s | 0.0s | 0.0s |
| Idle | Shadowblade | 100% | 123.5 | 0 | 0% | 35% | 5% | 3.2/3.0/2.2 | 60% · 0% | 41% · 8% | 0.0 | 9.2s | 0.0s | 0.0s |
| Idle | Spiritcaller | 100% | 114.7 | 0 | 0% | 35% | 7% | 3.6/2.8/2.1 | 61% · 0% | 27% · 7% | 0.0 | 10.4s | 0.0s | 0.0s |
| Casual | Warden | 100% | 32.5 | 0 | 0% | 73% | 11% | 4.0/2.9/2.2 | 62% · 0% | 84% · 88% | 0.0 | 10.3s | 0.0s | 0.0s |
| Casual | Pyromancer | 100% | 45.6 | 0 | 0% | 65% | 2% | 4.0/3.2/2.1 | 59% · 0% | 79% · 81% | 0.0 | 7.6s | 0.0s | 0.0s |
| Casual | Shadowblade | 100% | 36.9 | 0 | 0% | 69% | 9% | 3.7/3.2/2.1 | 64% · 0% | 82% · 77% | 0.0 | 8.9s | 0.0s | 0.0s |
| Casual | Spiritcaller | 100% | 39.6 | 0 | 0% | 66% | 12% | 3.9/2.8/2.3 | 59% · 10% | 69% · 83% | 0.0 | 11.9s | 33.9s | 33.9s |
| Regular | Warden | 100% | 1.1 | 0 | 89% | 99% | 91% | 3.0/0.0/0.0 | 78% · 57% | 89% · 100% | 3.3 | 12.9s | 41.9s | 50.9s |
| Regular | Pyromancer | 100% | 4.7 | 0 | 51% | 96% | 77% | 2.7/0.2/0.0 | 67% · 36% | 87% · 95% | 1.2 | 5.7s | 14.4s | 20.2s |
| Regular | Shadowblade | 100% | 3.8 | 0 | 61% | 96% | 79% | 2.9/0.1/0.0 | 71% · 39% | 91% · 94% | 1.6 | 6.6s | 17.2s | 23.3s |
| Regular | Spiritcaller | 100% | 1.1 | 0 | 88% | 99% | 91% | 2.9/0.0/0.0 | 68% · 47% | 80% · 100% | 2.3 | 10.2s | 36.4s | 44.2s |
| Sharp | Warden | 100% | 0.1 | 0 | 98% | 100% | 100% | 7.4/0.0/0.0 | 80% · 50% | 87% · 100% | 1.1 | 15.8s | 48.8s | 62.6s |
| Sharp | Pyromancer | 100% | 2.4 | 0 | 71% | 97% | 96% | 7.0/0.3/0.0 | 65% · 41% | 87% · 97% | 0.8 | 5.4s | 8.9s | 13.1s |
| Sharp | Shadowblade | 100% | 5.2 | 0 | 63% | 96% | 77% | 7.2/0.2/0.0 | 73% · 40% | 87% · 94% | 1.2 | 5.2s | 13.5s | 18.4s |
| Sharp | Spiritcaller | 100% | 0.0 | 0 | 100% | 100% | 100% | 7.5/0.0/0.0 | 75% · 67% | 78% · 100% | 2.0 | 12.0s | 35.6s | 44.2s |

Every run ends at level 16. Regular finishes every run, beats bosses first try 41–87% of the
time, and its lowest health in a normal fight averages 65–77% (*HP N* now means the lowest point,
see the guard section). It enters bosses at 55–91% of health (*HP@B*): the Pyromancer and
Shadowblade carry about a third of their health into the fight, the Spiritcaller a little under
half. Casual (never guards, never uses the ultimate) almost never beats a boss first try and
replays about a third of normal stages; Rally still carries it through, so nobody walls. The
node counts show the path policies at work: Regular takes 0.3–0.5 elites and almost no shrine or
event, Sharp takes 1.4–1.7 elites, and the Idle and Casual tiers take 3–4 shrines and 2–3 events
because they click the first or a random offer.

### By stage (Regular)

First-try win % · mean duration · % of fights with the ultimate Ready at least once.

| Stage | Realm | Boss | Warden | Pyromancer | Shadowblade | Spiritcaller |
|---|---|---|---|---|---|---|
| 1 | Ashen Reach |  | 100% · 6.0s · 0% | 100% · 6.7s · 0% | 100% · 6.7s · 0% | 100% · 7.6s · 0% |
| 2 | Ashen Reach |  | 100% · 13.3s · 74% | 99% · 8.6s · 43% | 100% · 8.5s · 83% | 100% · 13.5s · 24% |
| 3 | Ashen Reach |  | 100% · 13.9s · 94% | 97% · 8.3s · 75% | 99% · 9.0s · 93% | 100% · 14.0s · 55% |
| 4 | Ashen Reach |  | 98% · 20.7s · 100% | 89% · 7.9s · 91% | 89% · 10.5s · 98% | 99% · 15.5s · 100% |
| 5 | Ashen Reach | BOSS | 88% · 34.1s · 100% | 35% · 13.3s · 82% | 50% · 14.4s · 87% | 94% · 30.9s · 99% |
| 6 | Whisperwood |  | 100% · 6.8s · 60% | 100% · 6.3s · 71% | 100% · 6.6s · 78% | 100% · 8.7s · 15% |
| 7 | Whisperwood |  | 100% · 15.6s · 94% | 93% · 7.7s · 95% | 97% · 7.4s · 97% | 100% · 13.8s · 81% |
| 8 | Whisperwood |  | 99% · 18.5s · 99% | 96% · 7.7s · 99% | 97% · 7.5s · 98% | 99% · 15.1s · 91% |
| 9 | Whisperwood |  | 94% · 21.5s · 100% | 83% · 7.7s · 98% | 84% · 10.9s · 94% | 96% · 15.6s · 100% |
| 10 | Whisperwood | BOSS | 91% · 40.2s · 100% | 41% · 13.2s · 93% | 50% · 14.9s · 87% | 87% · 35.8s · 99% |
| 11 | Frostveil Peaks |  | 100% · 9.6s · 100% | 100% · 4.0s · 100% | 100% · 5.1s · 100% | 100% · 8.5s · 98% |
| 12 | Frostveil Peaks |  | 98% · 19.2s · 100% | 88% · 7.3s · 100% | 97% · 6.8s · 100% | 99% · 15.1s · 100% |
| 13 | Frostveil Peaks |  | 98% · 19.0s · 100% | 89% · 6.8s · 99% | 94% · 8.1s · 100% | 93% · 17.3s · 98% |
| 14 | Frostveil Peaks |  | 91% · 24.1s · 100% | 71% · 7.6s · 99% | 73% · 10.1s · 99% | 88% · 18.0s · 97% |
| 15 | Frostveil Peaks | BOSS | 86% · 44.2s · 100% | 56% · 14.5s · 99% | 66% · 16.2s · 98% | 86% · 37.6s · 100% |
| 16 | Sunken Sanctum |  | 100% · 10.2s · 100% | 100% · 3.6s · 100% | 100% · 4.7s · 100% | 100% · 8.0s · 100% |
| 17 | Sunken Sanctum |  | 98% · 19.4s · 100% | 97% · 6.3s · 100% | 97% · 7.5s · 100% | 98% · 13.6s · 99% |
| 18 | Sunken Sanctum |  | 97% · 19.9s · 100% | 93% · 6.5s · 100% | 95% · 6.5s · 100% | 97% · 14.8s · 100% |
| 19 | Sunken Sanctum |  | 95% · 23.4s · 100% | 83% · 6.4s · 100% | 84% · 10.6s · 100% | 95% · 14.7s · 100% |
| 20 | Sunken Sanctum | BOSS | 92% · 42.8s · 100% | 60% · 14.3s · 100% | 69% · 17.3s · 99% | 89% · 36.7s · 100% |
| 21 | Ember Throne |  | 100% · 10.0s · 100% | 100% · 3.2s · 100% | 100% · 5.8s · 100% | 100% · 7.5s · 100% |
| 22 | Ember Throne |  | 98% · 16.1s · 100% | 98% · 5.0s · 100% | 95% · 6.3s · 100% | 99% · 10.2s · 100% |
| 23 | Ember Throne |  | 99% · 16.0s · 100% | 97% · 4.7s · 100% | 93% · 6.6s · 100% | 98% · 11.1s · 100% |
| 24 | Ember Throne |  | 92% · 20.3s · 100% | 94% · 5.2s · 100% | 79% · 9.1s · 100% | 96% · 13.0s · 100% |
| 25 | Ember Throne | BOSS | 86% · 48.7s · 100% | 64% · 15.7s · 100% | 72% · 21.7s · 100% | 83% · 41.6s · 100% |

Normal stages are random draws (stages 2–4 roll an elite with 50/70/100% chance; stage 1 has
none), and the fourth stage keeps its three-enemy wave.

## Findings

1. **Boss-retry is the path pass's main regression.** Regular first-try is Warden 87%,
   Pyromancer 41%, Shadowblade 49%, Spiritcaller 85% on 100 seeds; the two burst classes now sit
   just below the 50% floor. The extra rare-or-better cards from elite, shrine and event rewards
   make them win faster or lose faster, and fewer elite nodes did not fully remove that. The
   Warden and Spiritcaller stay at the top of the band because their sustain ignores the added
   pressure.
2. **Normal fights still cost health.** Regular finishes with 65–77% of health left on normal
   wins (target 35–85%) and wins 94–99% first try. The path's fights are the old random waves;
   the change is that a normal win now heals 18%, so more of the health bar carries between them.
3. **The guard matters, and the ultimate still does.** Casual never presses either button and
   wins 0–1% of bosses; Regular presses the ultimate when it glows and catches 65% of heavies,
   and wins 41–87%. Both comparisons clear their target on the same 67.9-point class mean.
4. **Parity is 2.88× on the 40-seed check (Warden 41.5 s, Pyromancer 14.4 s, Shadowblade 17.3 s,
   Spiritcaller 36.3 s) and is still the remaining failure.** The stronger enrage that closed it
   (20 s / 33.5%) made the enrage chip show ×5.9 just after 30 s, which breaks `check:fx`; it
   stays reverted.
5. **Elite-fair is green only through its sample rule.** The Pyromancer's 92% is measured over
   31 elite fights; the other three classes see fewer than 20 elite nodes on 40 seeds after the
   elite offer weight was cut to fix pacing, so they read "too few". The 100-seed report's
   Regular elite first-try is 89–100% — the Warden's 100% is the honest number the sample rule is
   hiding, and it is why elite difficulty remains an open question rather than a solved one.
6. **The Idle floor is a grind, not a trap.** Skipping every boon costs 101–131 retries a run,
   and every run still finishes. It never guards, so it is the floor for all three decisions.
7. **The 40-seed check is noisy by design.** The Pyromancer's boss first-try moved 41–48% between
   adjacent configurations that differ by less than a tenth of a point; the 100-seed report is the
   stable reading and the one the tables above use.

## Guard and telegraphed heavies (2026-11-26, `1634a964`)

Every boss and every realm's elite has one heavy attack. It is telegraphed for 1.0 s of
battle time (about 1.3 s real time at 1×): the source glows, a `!` appears, and a ring closes on the hero. The unit neither
basic-attacks nor casts while winding up, and a stun during the wind-up interrupts it (half
cooldown before the next attempt). At impact it deals `atk × power` (2.8–4.5×) to the hero, or to
the hero and every ally for the Leviathan's Tidal Crush. It cannot be dodged.

Guard is the second player-controlled button. It opens a 0.6 s window on a 4 s cooldown:

- **Perfect** — the heavy lands inside the window: 10% damage, +20 ultimate charge, the attacker
  is staggered for 1.4 s (not reduced by the boss stun factor), and the class bonus fires.
- **Guarded** — any ordinary attack inside the window is halved.
- **Hit** — mistimed or skipped, the heavy lands in full.

The class bonuses are Warden shield (4% max HP), Pyromancer burn (4 s at 1.1× ATK/s),
Shadowblade counter (3× ATK, forced crit) and Spiritcaller heal (6% max HP). The bot policies
are `never` (Idle, Casual), `sloppy` (Regular: on each telegraph, 65% chance to time it, otherwise
never press) and `perfect` (Sharp: press when `remaining ≤ window × 0.6`). The guard is never
pressed automatically by the game.

Two targets were added with the mechanic:

- **guard-matters**: Regular's boss first-try is at least 12 points above Casual (class mean).
  The metric is the same comparison as *ult-matters* (both policies differ at once), so the two
  targets are read together, not as independent effects.
- **normal-teeth**: the hero's *lowest* health during a won first-try normal fight averages
  35–85%, each class. It first measured health left at the end, but the Warden and Spiritcaller
  regenerate to full by then, so the end value said nothing about how close the fight was.

What was tuned, and why (one line each). dsh's first pass reached 12/13 by making normal waves
out-hit their bosses (`atkPerStage` 1.15), removing three-enemy waves and inflating the guard
bonuses (a 60× ATK burn); those values were reverted and the pass below was done by hand, with one
extra rule: a normal wave never deals more damage per second than its realm's boss.

| Change | Why |
|---|---|
| `enemy.atkPerStage` 0.115 → 0.5 | Normal fights barely dented the hero (lowest health 88–97%). At 0.5 they cost 30–40% and the last normal stage of each realm still hits softer than its boss. |
| Elite heavy `power` 2.6 → 4.5 | A missed elite heavy has to be felt; it is the normal-stage reason to guard. |
| `combat.enrageRamp` 0.08 → 0.12 | Leans on long fights only (the sustain classes) without touching burst classes; the enrage chip still reads ×1.x at 36 s. |
| `guard.bonusShield` 0.1 → 0.04, `bonusHeal` 0.08 → 0.06 | The sustain classes cleared bosses 95%+ first try; their perfect guard does not need to add more sustain. |
| `guard.bonusBurnPower` 0.25 → 1.1, `bonusCounter` 1.5 → 3 | The burst classes sat on the 50% boss floor; a perfect guard is their opening. |
| Warden ATK 26 → 32, HP 380 → 340, armor 14 → 10 | It won every boss and took no damage: less wall, more hammer. |
| Warden: Shield Slam's 5% shield removed, Radiant Ward 12% → 8% shield, Unbreakable 25% / 18% → 15% shield / 8% heal | Four overlapping shields made it immune to the heavies the guard is about. |
| Spiritcaller ATK 25 → 27, regen 1.4 → 0.6/s, Gaia's Embrace heal 40% → 25% | The same sustain problem, smaller. |
| Every heavy's `windup` 1.4–1.6 → 1.0 s | Playtest: at 1× the wind-up felt like dead air (about 2 real seconds of a frozen boss). 1.0 s is about 1.3 s real; the gold window (0.6 s) still covers most of it. |

Not changed: enemy HP growth, the 3-enemy waves, boss stats, the ultimate interval (5 s), boons,
the Pyromancer's and Shadowblade's kits.

## The ultimate is a moment, not a rotation (2026-11-24, `23a09cbb`)

Instrumenting a boon-carrying Warden on the Ashen King showed 18, 21 and 42 ultimate casts in
three 50-second fights. The cause was `ultimate` charge: 2/s passive plus 30% of damage dealt and
5% taken, with **`ultRate` uncapped** (crit, dodge and damage reduction all had caps; it did not),
so a run that picked Ember Heart five times charged at 3.05× and cast every 1.4 s. Two changes:

- `hero.ultRateCap` 1.6, applied in `statsFor` like the other caps.
- `ultimate.minInterval` 5 s: a charge is a gate, not a rate. `useUltimate` refuses before it.

| Sweep (Regular, 40 seeds) | Warden / Pyromancer / Shadowblade / Spiritcaller boss first-try | Boss fight lengths |
|---|---|---|
| before | 100 / 61 / 84 / 99 % | 48 / 15 / 16 / 39 s |
| interval 10 s | 100 / 21 / 54 / 79 % | 48 / 20 / 23 / 41 s |
| interval 5 s (applied) | 100 / 45 / 74 / 94 % | 49 / 16 / 20 / 40 s |

Ten seconds made the Pyromancer's meteor too rare (21 %); five keeps her in band. The interval
also took parity from 3.25× to 2.62× by removing the burst classes' extra casts.

## The Warden investigation (2026-11-24)

The brief was "make the class losable; it is too easy and imba". Nine experiments, each measured
on the Regular tier with 40 seeds unless noted. All were reverted except where marked **kept**.

| # | Change | Warden boss first-try | Verdict |
|---|---|---|---|
| 1 | `ultimate.chargeTaken` 0.05 → 0.01 | 100 % | the Warden charges from damage *dealt*, not taken |
| 2 | Unbreakable heal 25 → 15 %, shield 35 → 25 % | 100 % | it casts 4–7 times; per-cast size is not the lever |
| 3 | `ultRate` 0.6 / 0.35 / 0.30 | 100 / 100 / 98 % | and Ready in only 46–54 % of normal fights: breaks another target |
| 4 | Radiant Ward (heal/shield) → shield + reflect 45 % + damage | 100 % | **kept** (casts 1–2 → 3, parity −0.17, boonless Warden now loses the King) but not for this |
| 5 | Base armour 20 → 14, reduction 8 → 4 %, regen 0.6 → 0.3; ult 18 %/25 % | 100 % | |
| 6 | Defensive boons diminish with copies (1/(1+0.25n), then 1/(1+0.6n)) | 99 % | **kept** at 0.6: it removes the HP-stack win button (24 Iron Hide 100 → 0 %) and makes 24-pick defence a choice, not a guarantee |
| 7 | Ashen King's Crownfire deals 6–15 % of the target's max HP | 99 % | **reverted**: it walled the boonless Pyromancer (84 of 100) and dropped her to 42 %, because flat share-of-HP hurts small pools more than large ones |
| 8 | Ashen King atk 21 → 11, speed 2.2 → 1.1 s (same DPS, half the swing) | 99 % | **kept**: Pyromancer 37 → 44 %, Shadowblade 64 → 71 %; removes the one-shot cliff |
| 9 | Enrage applied after armour; ramp 0.08 → 0.25; enrage at 20 s | 96–98 % | **kept** after-armour (it is the right rule for a tank) and 30 s / 0.08 |

The decisive measurement is not a win rate: across 40 boon-carrying Wardens the **median lowest
health reached in the Ashen King fight was 93 %** (worst 51 %, best 100 %). The class does not
win narrowly; it is never in danger. The boon matrix explains why — against the King, eight
copies of almost any single boon lose (0 %), eight copies of Titan Blood or Arcane Font win
(100 %), and *any* random 24 picks win. The outcome is decided by multiplicative stacking past a
line, and no flat-damage boss has a middle.

What would actually work is design, not tuning, and it is a decision for the maintainer:

- **Share-of-max-HP damage as a boss mechanic** — on every boss ability, not one, and weighted so
  it bites long fights (the Warden's) rather than short ones (the Pyromancer's). Experiment 7 was
  too timid and flat; a duration-weighted version was not tried.
- **The Warden's sustain becomes reaction, not aura** — a large shield that only matters for the
  few seconds after a boss ability, and less base mitigation, so "tank and grind" is a losing plan.
- **A Warden-specific enrage** — bosses ramp faster only in fights that last, which the squishy
  classes' fights do not. Experiments 9a/9b show a global ramp is not enough.

## Ability and logic changes (2026-11-24, `4465c252`; superseded by the two sections above)

A player reported that one of the Warden's abilities "doesn't seem to work". It didn't cast at
all. `tryCastAbility` skipped any ability with a heal or shield and no damage unless the hero was
below 72% health, and a Warden sits at 94–95% of its health, so **Radiant Ward fired zero times in
every fight**. The same rule held back two other abilities whose buff is the point of them: the
Pyromancer's Cinder Veil (+35% attack, +25% haste) and the Shadowblade's Smoke Step. The rule is
now `wantsUtility()` in `src/combat.ts`: cast when hurt, or when the shield has room, or when there
is something to cleanse, or when the ability carries an attack-speed / damage / dodge buff.

Casts per fight before and after, measured on stage 8:

| Ability | Before | After |
|---|---|---|
| Radiant Ward (Warden) | **0** | 1–2 |
| Cinder Veil (Pyromancer) | 0–1 | 1 |
| Smoke Step (Shadowblade) | 0–1 | 1 |
| Spirit Bloom (Spiritcaller) | 1 | 2 |

Two presentation problems came with it. The ability bar gave no sign of *which* skill fired (the
battle log is hidden on a phone, and every cast draws the same ring), so an ability name now floats
under the hero on each cast. And the Warden's Radiant Ward and Dawnbreaker used near-identical
icons (a circle with eight rays and a circle with eight shorter rays), so the one that never fired
looked like the one that did; Dawnbreaker now uses the star icon.

Consequences: the Pyromancer is faster (Cinder Veil now actually buffs, boss fights 16.1 →
15.3 s) and the Warden is tankier (49.7 → 52.4 s), which pushed parity the wrong way.

**Then Radiant Ward itself was replaced.** Making it cast was only half a fix: a Warden is at
94–100% health for a whole fight, so a heal-and-shield skill had almost nothing to do (it fired
1–2 times even once it could). The README describes the class as "shields, stuns, damage
reflection", and the Warden's one measurable weakness is damage — the longest boss fights and the
worst parity — so that slot is now the reflection it promises:

| | Was | Now |
|---|---|---|
| Effect | heal 18%, shield 14%, regen 2%/s for 4s | shield 12%, and for 6s reflect 45% of damage taken and deal 25% more damage |
| Cooldown | 11 s | 9 s |
| Icon | sun (twin of Dawnbreaker's) | armour |

Reflection also scales with the enemy: the harder a boss hits, the more the Warden answers, which
is the opposite of a heal. Effects at the time (100 seeds): casts per fight 1–2 → 3, Warden boss fights
52.4 → 49.8 s, parity 3.42 → 3.25×, and a boonless Warden now **loses** the final boss (Idle boss
first-try 18% → 0%). A Regular Warden still won every boss; the ultimate's rate was the next thing
found (see *The ultimate is a moment*).

Because this changed behaviour without changing a single number in `src/balance.ts`, the config id
now hashes a `logic` revision too, so a logic fix alone marks this file out of date.

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
| Parity 3.31× | A Warden/Spiritcaller damage-kit change, or a Warden-specific enrage, or an enrage change paired with an FX-check update | Changing the shared enrage to the value that works (20 s / 33.5%) breaks `check:fx`; a class change is outside the balance lane |
| Casual retries 24–39 times a run | none yet | watch a playtest: the button now says "Ready · press Space" |

Closest values tried for parity (Regular, 40 seeds; boss durations are Warden / Pyromancer /
Shadowblade / Spiritcaller):

| Change | Boss first-try | Boss duration | Parity | Why not kept |
|---|---|---|---|---|
| enrage 20 s / 0.335 | 90 / 53 / 60 / 70% | 48 / 15 / 20 / 42 s | **1.99×** | all 13 targets green, but `check:fx` reads the chip as ×5.9 just after 30 s |
| `guard.bonusBurnPower` 0, `bonusCounter` 0 | 90 / 24 / 49 / 64% | 49 / 20 / 23 / 40 s | 2.45× | the Pyromancer's boss first-try falls below the 50% floor |
| `bossHpPerStage` 0.12, `bossAtkPerStage` 0.65 | 59 / 25 / 27 / 34% | 37 / 11 / 13 / 30 s | 3.36× | both burst classes fall well below 50% |
| `enemy.hpPerStage` 0.16 | 90 / 59 / 54 / 64% | 49 / 16 / 19 / 40 s | 3.06× | closest non-enrage result; it made the Pyromancer's normal mean 5.9 s, under the 6 s floor |

## How to retune

Change one setting at a time, then run `npm test` and read the table.

| Problem | Change first |
|---|---|
| The ultimate is never Ready | `ultimate.chargeDealt` (steps of 0.05), then `ultimate.passiveCharge` |
| Bosses never need a retry (Pyromancer, Shadowblade) | `enemy.bossAtkPerStage` (steps of 0.05) |
| Bosses never need a retry (Warden, Spiritcaller) | `ultimate.minInterval` (steps of 2 s) or `enemy.bossAtkPerStage`; both move the Pyromancer too |
| Boss fights too long | `enemy.bossHpPerStage`; do not move `combat.enrageAt`/`enrageRamp` without updating `tools/battle-fx-check.mjs` |
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

The Pages workflow does not run `npm test`. One target is red on this config (parity); keep the
workflow as it is until a class-side change brings it green, then add `- run: npm test` before
the build step in `.github/workflows/deploy.yml` so a stale doc or a broken target blocks the
deploy.

## Open questions

- **Parity without an enrage change.** The Warden and Spiritcaller take 50.2 s and 41.9 s on
  bosses against the Pyromancer's 15.2 s. The Warden's thorns scale with boss damage, so a
  stronger enrage or boss ATK helps it relative to the burst classes — but the enrage is fixed by
  the FX check and boss ATK above 0.45 drops the Pyromancer below the 50% floor. A class-side
  fix (more Warden/Spiritcaller damage, or a Warden-specific ramp) is the next thing to try.
- **Normal-smooth is close.** The Spiritcaller clears the floor at 91% on 40 seeds; it is the
  class that sits nearest the line (88–92% across adjacent normal-pressure values), so a future
  balance pass should re-check it first.
- **Human playtest.** Normal fights now cost 16–36% of health, and the guard is the only manual
  defensive decision. Is the 0.6 s window readable at the slower clock? Does a Warden boss fight
  at 50 s feel like a set piece or a slog?
- **The guard on a phone.** The button is next to the ultimate; the check covers 390 px layout,
  but a human thumb on a real phone is the test that matters.
- **The boonless floor is a grind, not a trap.** 112–161 retries a run. A "replace a boon" or
  "restart with your boons" option would fix it in the spirit of "no death penalty".
- **Level as a restatement of stage**, and **flat regeneration**: unchanged from the first
  measurement. A stat point per level, and regen as a share of max HP, would both be small
  changes with real effect.

## History

**2026-11-26 — guard, telegraphed heavies, and a partial retune (`23a09cbb` → `e4a4ae04`).** Added
the guard (0.6 s window, 4 s cooldown, perfect guard = 10% damage + stagger + ultimate + class
bonus) and a heavy on every boss and elite, with a 1.4–1.6 s telegraphed wind-up that a stun
interrupts. The bots gained `never`/`sloppy`/`perfect` guard policies and the *guard-matters* and
*normal-teeth* targets. Retuned normal pressure (attack scaling 0.115 → 1.15, HP 0.155 → 0.174,
elite stages to two enemies, elite ATK cut and heavy power 2.6 → 3.5), boss HP scaling 0.24 →
0.25, the ultimate interval (5 → 12 s) and the guard bonuses. Twelve of thirteen targets pass:
boss-retry (a failure for two passes) is green for every class, normal-smooth and normal-teeth are
green, and parity is 3.31× (3.19× on 100 seeds) — the stronger enrage that closed it (20 s /
33.5%) broke `check:fx`'s 30 s assertion, so the original 30 s / 8% enrage is kept and parity
remains open.

**2026-11-24 — the ultimate as a moment, the Ashen King's swing, diminishing defence (`4465c252` →
`23a09cbb`).** Charge rate was uncapped and the ultimate had no interval: a Warden with five Ember
Hearts cast every 1.4 s, 42 times in one boss fight. `hero.ultRateCap` 1.6 and `ultimate.minInterval`
5 s make it 1.3–3.3 casts a fight. The Ashen King's hit went 248 → 130 at twice the rate (same DPS),
which turned "instant death or comfortable" into a fight for the squishy classes. The enrage applies
after armour. Defensive boons diminish with copies (1/(1+0.6n)). Ultimate and Radiant Ward thorns
trimmed (40 %×7 s → 20 %×4 s; 45 %×6 s → 25 %×5 s) after 39 % of the Warden's boss damage turned out
to be the boss hitting itself. Net: Pyromancer boss first-try 61 → 49 %, Shadowblade 84 → 74 %,
Spiritcaller 99 → 98 %, Warden 100 → 99 %; parity 3.25 → 2.62×. Nine attempts to make the Warden
losable are recorded under *The Warden investigation*; the class needs a design change.

**2026-11-24 — Radiant Ward rebuilt as a reflection ability (`a394ed00` → `4465c252`).** The gate
fix let it cast, but a heal/shield has little to do for a hero sitting at 94–100% of its health, so
the slot became the class's promised reflection: shield 12%, and for 6s reflect 45% of damage taken
and deal 25% more damage, on a 9 s cooldown. Casts per fight 1–2 → 3, Warden boss fights 52.4 →
49.8 s, parity 3.42 → 3.25×, and the boonless Warden now loses the final boss (Idle boss first-try
18% → 0%). The Warden's ultimate is now the reason a boon-carrying Warden still never loses.

**2026-11-24 — utility abilities cast again (`2aee208f` → `a394ed00`).** Radiant Ward never fired
(see *Logic fixes*); the same gate held back Cinder Veil and Smoke Step. Casts per fight went from
0 to 1–2 for Radiant Ward and 1 for the other two, the Warden's boss fights 49.7 → 52.4 s and the
Pyromancer's 16.1 → 15.3 s, parity 3.08 → 3.42×. Two presentation fixes came with it (ability names
float over the hero; Dawnbreaker's icon). The boss-pacing floor moved from 15 s to 14 s because the
40-seed mean moves by about half a second and a class sitting on the line failed at random. The
config id now hashes a `logic` revision as well as the numbers.

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