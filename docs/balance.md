# Balance notes

How Emberfall's difficulty works, what the current numbers are, and how to change them. This file
is the only place that records balance results. Where it disagrees with the README, old branches,
or anything in `balance-out/`, this file and `src/balance.ts` win.

## Status

Last measured 2026-11-24, after a first balance pass, on this config:

| | Config |
|---|---|
| Emberfall | `4465c252` |

Everything under *Current results* was measured on this config. No human playtest has confirmed
any of it. Results come from bots: the scripted tiers in `tools/balance/bots.ts`, played through
`tools/balance/run.ts`, which drives the real `Battle` and the real progression (`src/state.ts`)
headless, on seeded dice.

Every report, sweep and `npm test` prints the config it ran on. If the hash there differs from
this table, the result is out of date. See *Keeping this file current*.

Three of the eleven targets below fail on this config: the Warden and the Spiritcaller never lose a
boss, and the Warden takes 3.4 times as long to win one. Both are class design, not tuning, and both
are older than this config; the balance pass before it failed six.

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
| Logic revision | 1 | bumped when `combat.ts`/`state.ts` logic changes; part of the config id |
| Clock | 0.75× real time at 1× | `TIME_SCALE` in `src/main.ts`; the speed button doubles it. Every duration in this file is game time |

Class data changed since launch: the Warden's ATK 23 → 26 and attack interval 1.75 → 1.6 s (its
basic DPS was the lowest of the four by a quarter to a half), and Radiant Ward became shield +
reflection + damage instead of heal + shield + regeneration (see *Ability and logic changes*).
Everything else in `src/data.ts` is as shipped.

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
| Bosses occasionally need a retry | first-try 50–90%, each class | "Bosses occasionally require a retry": above 90% they never do, below 50% the boss is a wall | **fails**: Pyromancer 61% and Shadowblade 84% are in band; Warden and Spiritcaller 100% |
| Normal stages flow | first-try ≥ 90%, each class | Retries belong to bosses | ok |
| Nobody gets stuck | 0 walled runs, every tier | "Retry as many times as you like" and no way to drop a boon: a wall means abandoning the run | ok (Idle finishes 100%) |
| The ultimate is there to be used | Ready in ≥ 75% of normal and ≥ 95% of boss fights, each class | It is the one in-combat decision; a button that never glows is not a decision | ok: 80–93% normal, 100% boss |
| Pressing it changes something | boss first-try ≥ 8 points above Casual (class mean) | If never touching it changes no outcome, the decision is decorative | ok: 60.8 points |
| The reward screen counts | Idle: ≥ 2 more retries per run, or ≥ 10 points fewer finishes | The other decision has to count — but never cost the run (see above) | ok: 52 vs 1 retry |
| Normal fights are readable | mean 6–30 s, each class | Long enough to see the skills, short enough not to reach for the speed button. Game time: ×1.33 on screen at the default pace | ok |
| Boss fights are set pieces | mean 14–60 s, each class | Longer than a normal fight, and short enough to want to try again after a loss. The floor is 14 s because the mean over 40 seeds moves by about half a second | ok: Warden 49.8 s, Pyromancer 15.3 s |
| Classes feel alike in length | boss duration max ÷ min ≤ 2 | No class should take twice as long as another | **fails**: 3.25× (Warden 49.8 s, Pyromancer 15.3 s) |
| The doc is current | Status hash = current | Results are only true for the config they were measured on | ok |

## Current results

### Tiers

100 seeds per cell, step 1/30 s. Durations are means over first-try wins; "Ult ≥ 1" is the share
of fights in which the ultimate reached Ready at least once (N = normal stages, B = bosses);
"ults/f" is ults cast per first-try fight.

| Tier | Class | Finishes | Retries/run | Walled | Boss 1st | Normal 1st | Ult ≥ 1 N · B | ults/f | Normal | Boss | Boss p90 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Idle | Warden | 100% | 38.8 | 0 | 0% | 94% | 93% · 100% | 0.0 | 26.7 s | 38.3 s | 39.1 s |
| Idle | Pyromancer | 100% | 75.2 | 0 | 0% | 66% | 83% · 92% | 0.0 | 15.7 s | 0.0 s | 0.0 s |
| Idle | Shadowblade | 100% | 56.7 | 0 | 0% | 79% | 91% · 72% | 0.0 | 16.8 s | 31.9 s | 31.9 s |
| Idle | Spiritcaller | 100% | 42.8 | 0 | 0% | 86% | 80% · 60% | 0.0 | 23.3 s | 40.6 s | 40.6 s |
| Casual | Warden | 100% | 3.6 | 0 | 51% | 100% | 92% · 100% | 0.0 | 17.7 s | 44.7 s | 55.6 s |
| Casual | Pyromancer | 100% | 14.8 | 0 | 1% | 100% | 88% · 100% | 0.0 | 11.4 s | 30.2 s | 33.0 s |
| Casual | Shadowblade | 100% | 8.3 | 0 | 16% | 100% | 92% · 100% | 0.0 | 11.9 s | 31.4 s | 37.9 s |
| Casual | Spiritcaller | 100% | 7.9 | 0 | 26% | 100% | 80% · 100% | 0.0 | 16.7 s | 43.8 s | 53.5 s |
| Regular | Warden | 100% | 0.0 | 0 | 100% | 100% | 92% · 100% | 4.0 | 17.5 s | 49.8 s | 60.0 s |
| Regular | Pyromancer | 100% | 2.3 | 0 | 61% | 100% | 89% · 100% | 1.5 | 6.5 s | 15.3 s | 22.2 s |
| Regular | Shadowblade | 100% | 0.9 | 0 | 84% | 100% | 92% · 100% | 1.9 | 7.3 s | 16.3 s | 21.8 s |
| Regular | Spiritcaller | 100% | 0.1 | 0 | 99% | 100% | 80% · 100% | 2.2 | 11.7 s | 38.4 s | 48.5 s |
| Sharp | Warden | 100% | 0.0 | 0 | 100% | 100% | 93% · 100% | 0.2 | 23.8 s | 58.4 s | 73.9 s |
| Sharp | Pyromancer | 100% | 1.4 | 0 | 76% | 100% | 90% · 100% | 0.8 | 6.5 s | 8.5 s | 13.9 s |
| Sharp | Shadowblade | 100% | 1.1 | 0 | 80% | 100% | 92% · 100% | 1.4 | 6.5 s | 13.1 s | 19.6 s |
| Sharp | Spiritcaller | 100% | 0.1 | 0 | 98% | 100% | 80% · 100% | 1.3 | 19.3 s | 41.3 s | 50.8 s |

Every run ends at level 16. No Regular, Casual or Sharp run ever retried a normal stage. Three
things to read off this table: the ultimate is now decisive (Casual's boss first-try is 2–23%
for three classes against Regular's 63–100%, and a Casual Pyromancer retries 13.7 times a run);
the Idle floor is no longer a wall but a grind (30–77 retries a run); and the Warden casts its
ultimate four times per fight on average, because damage taken and thorns charge it.

### By stage (Regular)

First-try win % · mean duration · % of fights with the ultimate Ready at least once.

| Stage | Realm | Boss | Warden | Pyromancer | Shadowblade | Spiritcaller |
|---|---|---|---|---|---|---|
| 1 | Ashen Reach |  | 100% · 7.3s · 0% | 100% · 6.8s · 0% | 100% · 7.0s · 0% | 100% · 8.2s · 0% |
| 2 | Ashen Reach |  | 100% · 15.8s · 97% | 100% · 9.2s · 28% | 100% · 10.1s · 72% | 100% · 11.5s · 0% |
| 3 | Ashen Reach |  | 100% · 14.3s · 92% | 100% · 8.7s · 65% | 100% · 9.4s · 89% | 100% · 11.7s · 1% |
| 4 | Ashen Reach |  | 100% · 20.0s · 100% | 100% · 8.6s · 100% | 100% · 11.6s · 100% | 100% · 13.3s · 100% |
| 5 | Ashen Reach | BOSS | 100% · 38.9s · 100% | 51% · 18.0s · 100% | 86% · 17.8s · 100% | 100% · 33.2s · 100% |
| 6 | Whisperwood |  | 100% · 8.4s · 58% | 100% · 6.5s · 77% | 100% · 6.9s · 83% | 100% · 9.0s · 4% |
| 7 | Whisperwood |  | 100% · 17.1s · 100% | 100% · 7.7s · 100% | 100% · 7.7s · 100% | 100% · 12.7s · 98% |
| 8 | Whisperwood |  | 100% · 19.2s · 100% | 100% · 7.9s · 100% | 100% · 7.4s · 100% | 100% · 13.3s · 100% |
| 9 | Whisperwood |  | 100% · 22.5s · 100% | 100% · 7.8s · 100% | 100% · 11.2s · 100% | 100% · 14.6s · 100% |
| 10 | Whisperwood | BOSS | 100% · 48.9s · 100% | 27% · 14.6s · 100% | 64% · 17.1s · 100% | 99% · 38.5s · 100% |
| 11 | Frostveil Peaks |  | 100% · 12.3s · 100% | 100% · 4.6s · 100% | 100% · 5.2s · 100% | 100% · 9.2s · 97% |
| 12 | Frostveil Peaks |  | 100% · 20.6s · 100% | 100% · 7.9s · 100% | 100% · 6.9s · 100% | 100% · 14.8s · 100% |
| 13 | Frostveil Peaks |  | 100% · 22.5s · 100% | 100% · 7.6s · 100% | 100% · 8.0s · 100% | 100% · 15.3s · 100% |
| 14 | Frostveil Peaks |  | 100% · 26.4s · 100% | 100% · 7.6s · 100% | 100% · 9.8s · 100% | 100% · 15.7s · 100% |
| 15 | Frostveil Peaks | BOSS | 100% · 54.2s · 100% | 74% · 17.1s · 100% | 86% · 17.8s · 100% | 99% · 43.0s · 100% |
| 16 | Sunken Sanctum |  | 100% · 13.5s · 100% | 100% · 3.9s · 100% | 100% · 4.6s · 100% | 100% · 8.7s · 100% |
| 17 | Sunken Sanctum |  | 100% · 20.7s · 100% | 100% · 6.3s · 100% | 100% · 6.9s · 100% | 100% · 13.3s · 100% |
| 18 | Sunken Sanctum |  | 100% · 18.0s · 100% | 100% · 5.8s · 100% | 100% · 6.0s · 100% | 100% · 12.1s · 100% |
| 19 | Sunken Sanctum |  | 100% · 24.6s · 100% | 100% · 5.9s · 100% | 100% · 8.1s · 100% | 100% · 13.0s · 100% |
| 20 | Sunken Sanctum | BOSS | 100% · 49.6s · 100% | 84% · 13.9s · 100% | 93% · 14.6s · 100% | 100% · 35.4s · 100% |
| 21 | Ember Throne |  | 100% · 13.3s · 100% | 100% · 3.4s · 100% | 100% · 4.5s · 100% | 100% · 8.2s · 100% |
| 22 | Ember Throne |  | 100% · 16.3s · 100% | 100% · 4.6s · 100% | 100% · 4.4s · 100% | 100% · 10.0s · 100% |
| 23 | Ember Throne |  | 100% · 17.0s · 100% | 100% · 4.1s · 100% | 100% · 4.8s · 100% | 100% · 9.8s · 100% |
| 24 | Ember Throne |  | 100% · 20.7s · 100% | 100% · 4.0s · 100% | 100% · 6.2s · 100% | 100% · 10.3s · 100% |
| 25 | Ember Throne | BOSS | 100% · 57.5s · 100% | 71% · 13.6s · 100% | 89% · 14.3s · 100% | 96% · 42.2s · 100% |

The ultimate is Ready in every boss fight and in almost every fight from stage 4 on; only the
Spiritcaller's first realm mostly goes without (it has the least damage to charge from). The
first boss (stage 5) is the hardest for the squishy classes — 52% and 78% first-try — before
boons have accumulated; the Pyromancer's hardest is the Whisperwood boss at 31%.

## Findings

1. **Bosses occasionally need a retry, for two classes.** Pyromancer 61% and Shadowblade 84%
   first-try on bosses, 2.3 and 0.9 retries per run; normal stages are still never replayed.
   Warden and Spiritcaller remain at 100% (see 5).
2. **The ultimate is there, and it matters.** Ready in 80–93% of normal fights and every boss
   fight; never pressing it costs 57.1 points of boss first-try (class mean). A Casual
   Pyromancer retries 14.8 times a run, a Casual Shadowblade 8.3.
3. **Nobody gets stuck.** With Rally at +20% per defeat the boonless Idle tier finishes every
   run (it walls on the final boss at +12%). It is a grind, not a trap: 32–75 retries a run.
4. **The Warden's boss fights are 52 s, not 73** (p90 100 → 64 s), and every boss fight on
   Regular is under 60 s. The enrage at 30 s fires on the Warden's and Spiritcaller's boss
   fights and nowhere else.
5. **The Warden and the Spiritcaller never lose a boss.** No boss-ATK value up to ×3.5 of the
   old one moves them. Their ultimate is the mechanism: damage taken charges it, so the Warden
   casts Unbreakable 4.0 times a fight, and each cast heals 25% and shields 35%. That is class
   design, not a number. The redesign below made the *boonless* Warden genuinely vulnerable —
   Idle boss first-try fell from 18% to 0% — but boons still carry a Regular run to 100%.
6. **The Warden takes 3.2 times as long.** 49.8 s boss fights against the Pyromancer's 15.3 s
   (3.25×). Its damage bump and the reflection in Radiant Ward brought that down from 3.7×.
7. **The always-ready ultimate makes burst classes' late normal fights very short.** Pyromancer
   stages 21–24 are 3.3–4.9 s; the class mean of 6.5 s passes the target only because the early
   game is longer. A 280% AoE meteor against late waves of ~1,500 HP is most of the fight.
   `enemy.hpPerStage` 0.2 adds about half a second and cost two other targets (tried and
   reverted); this is the Pyromancer's kit.
8. **Unchanged from the first measurement:** level is a restatement of stage (every run ends at
   16); flat regeneration is dead late; boon choice does not change outcomes (Sharp ≈ Regular),
   though Sharp's fitted Pyromancer halves its boss fights (8.5 s) and its Sharp Warden holds a
   defensive ultimate it never needs (0.2 casts per fight, 64.5 s boss fights).

## Ability and logic changes (2026-11-24, `4465c252`)

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
is the opposite of a heal. Effects at 100 seeds: casts per fight 1–2 → 3, Warden boss fights
52.4 → 49.8 s, parity 3.42 → 3.25×, and a boonless Warden now **loses** the final boss (Idle boss
first-try 18% → 0%, retries 32 → 39). A Regular Warden still wins every boss, because its
ultimate — 25% heal plus a 35% shield, four casts a fight — is the sustain engine now.

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

- **The Warden's ultimate is now its sustain engine.** Unbreakable is cast 4.0 times a fight (damage
  taken charges it), healing 25% and shielding 35% each time. It is the reason a Regular Warden still
  wins every boss while a boonless one cannot. Charging less from damage taken, or a smaller heal,
  would make the Warden losable — and would make its ultimate a decision instead of a rhythm.
- **Radiant Ward still only fires 1–2 times a fight**, because `wantsUtility()` will not cast a
  shield at a hero whose shield is already above 20% of its health, and the Warden takes so little
  damage that the shield rarely drops. That is correct use of the skill, but it is a symptom: the
  real problem is that the Warden is never hurt (finding 5).
- **Boss HP against the Pyromancer.** Her boss fight sits on the pacing floor. `enemy.bossHpPerStage`
  0.28 puts it at 18 s but drops her boss first-try to 44%, below the 50% floor; 0.24 is the largest
  value that keeps both. One number cannot satisfy both targets for her.
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
