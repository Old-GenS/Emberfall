# Balance notes

How Emberfall's difficulty works, what the current numbers are, and how to change them. This file
is the only place that records balance results. Where it disagrees with the README, old branches,
or anything in `balance-out/`, this file and `src/balance.ts` win.

## Status

Last measured 2026-11-24, after a first balance pass, on this config:

| | Config |
|---|---|
| Emberfall | `23a09cbb` |

Everything under *Current results* was measured on this config. No human playtest has confirmed
any of it. Results come from bots: the scripted tiers in `tools/balance/bots.ts`, played through
`tools/balance/run.ts`, which drives the real `Battle` and the real progression (`src/state.ts`)
headless, on seeded dice.

Every report, sweep and `npm test` prints the config it ran on. If the hash there differs from
this table, the result is out of date. See *Keeping this file current*.

Three of the eleven targets below fail on this config: the Warden and the Spiritcaller almost never lose a
boss, and the Warden takes 3.4 times as long to win one. Both are class design, not tuning; the nine attempts to tune the Warden
into losing are recorded under *The Warden investigation*. The balance pass before it failed six.

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
| Boons | 3 offered after each win | weights common 5 · rare 2.6 · epic 1.1; defensive ones (HP, armour/reduction, Titan Blood's HP) diminish with each copy: 100%, 62%, 45%, 35%… |
| Ultimate | 2/s + 30% of damage dealt + 5% of damage taken | 100 = Ready; resets at every fight; at most one cast per 5 s; charge rate capped at 1.6× |
| Enrage | after 30 s | all damage +8% per second after that: ×2.6 at 50 s, ×3.4 at 60 s; applied after armour, so it is the one pressure a tank cannot mitigate |
| Rally | +20% HP and ATK per defeat | capped at 8×; 30 defeats reach 7×; resets on a win or on leaving |
| Logic revision | 2 | bumped when `combat.ts`/`state.ts` logic changes; part of the config id |
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
| Bosses occasionally need a retry | first-try 50–90%, each class | "Bosses occasionally require a retry": above 90% they never do, below 50% the boss is a wall | **fails**: Pyromancer 49% and Shadowblade 74% are in band; Warden 99% and Spiritcaller 98% |
| Normal stages flow | first-try ≥ 90%, each class | Retries belong to bosses | ok |
| Nobody gets stuck | 0 walled runs, every tier | "Retry as many times as you like" and no way to drop a boon: a wall means abandoning the run | ok (Idle finishes 100%) |
| The ultimate is there to be used | Ready in ≥ 75% of normal and ≥ 95% of boss fights, each class | It is the one in-combat decision; a button that never glows is not a decision | ok: 80–93% normal, 100% boss; 1.3–3.3 casts per fight |
| Pressing it changes something | boss first-try ≥ 8 points above Casual (class mean) | If never touching it changes no outcome, the decision is decorative | ok: 60.8 points |
| The reward screen counts | Idle: ≥ 2 more retries per run, or ≥ 10 points fewer finishes | The other decision has to count — but never cost the run (see above) | ok: 53 vs 1 retry |
| Normal fights are readable | mean 6–30 s, each class | Long enough to see the skills, short enough not to reach for the speed button. Game time: ×1.33 on screen at the default pace | ok |
| Boss fights are set pieces | mean 14–60 s, each class | Longer than a normal fight, and short enough to want to try again after a loss. The floor is 14 s because the mean over 40 seeds moves by about half a second | ok: Warden 49.6 s, Pyromancer 16.9 s |
| Classes feel alike in length | boss duration max ÷ min ≤ 2 | No class should take twice as long as another | **fails**: 2.62× (Warden 49.6 s, Pyromancer 16.9 s) |
| The doc is current | Status hash = current | Results are only true for the config they were measured on | ok |

## Current results

### Tiers

100 seeds per cell, step 1/30 s. Durations are means over first-try wins; "Ult ≥ 1" is the share
of fights in which the ultimate reached Ready at least once (N = normal stages, B = bosses);
"ults/f" is ults cast per first-try fight.

| Tier | Class | Finishes | Retries/run | Walled | Boss 1st | Normal 1st | Ult ≥ 1 N · B | ults/f | Normal | Boss | Boss p90 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Idle | Warden | 100% | 43.4 | 0 | 0% | 88% | 93% · 100% | 0.0 | 26.1 s | 0.0 s | 0.0 s |
| Idle | Pyromancer | 100% | 72.9 | 0 | 0% | 66% | 83% · 94% | 0.0 | 15.7 s | 0.0 s | 0.0 s |
| Idle | Shadowblade | 100% | 55.0 | 0 | 0% | 79% | 91% · 69% | 0.0 | 16.8 s | 31.9 s | 31.9 s |
| Idle | Spiritcaller | 100% | 41.4 | 0 | 0% | 86% | 80% · 65% | 0.0 | 23.3 s | 40.6 s | 40.6 s |
| Casual | Warden | 100% | 6.5 | 0 | 24% | 100% | 92% · 100% | 0.0 | 18.0 s | 42.5 s | 50.5 s |
| Casual | Pyromancer | 100% | 15.4 | 0 | 1% | 100% | 88% · 100% | 0.0 | 11.3 s | 28.7 s | 33.0 s |
| Casual | Shadowblade | 100% | 8.4 | 0 | 14% | 100% | 92% · 100% | 0.0 | 11.9 s | 30.8 s | 37.9 s |
| Casual | Spiritcaller | 100% | 8.0 | 0 | 20% | 100% | 80% · 100% | 0.0 | 16.7 s | 41.4 s | 48.1 s |
| Regular | Warden | 100% | 0.1 | 0 | 99% | 100% | 93% · 100% | 3.3 | 17.7 s | 49.6 s | 60.4 s |
| Regular | Pyromancer | 100% | 3.3 | 0 | 49% | 100% | 89% · 100% | 1.3 | 6.6 s | 16.9 s | 23.6 s |
| Regular | Shadowblade | 100% | 1.5 | 0 | 74% | 100% | 92% · 100% | 1.7 | 8.0 s | 19.2 s | 25.9 s |
| Regular | Spiritcaller | 100% | 0.1 | 0 | 98% | 100% | 80% · 100% | 2.1 | 11.9 s | 39.7 s | 50.2 s |
| Sharp | Warden | 100% | 0.1 | 0 | 98% | 100% | 93% · 100% | 0.6 | 24.1 s | 59.3 s | 75.2 s |
| Sharp | Pyromancer | 100% | 2.1 | 0 | 65% | 100% | 90% · 100% | 0.7 | 6.6 s | 9.6 s | 15.9 s |
| Sharp | Shadowblade | 100% | 1.6 | 0 | 73% | 100% | 92% · 100% | 1.3 | 6.5 s | 15.7 s | 21.1 s |
| Sharp | Spiritcaller | 100% | 0.2 | 0 | 96% | 100% | 81% · 100% | 1.2 | 19.6 s | 43.4 s | 54.6 s |

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
| 2 | Ashen Reach |  | 100% · 15.8s · 96% | 100% · 9.2s · 28% | 100% · 10.1s · 72% | 100% · 11.5s · 0% |
| 3 | Ashen Reach |  | 100% · 14.2s · 91% | 100% · 8.7s · 65% | 100% · 9.4s · 89% | 100% · 11.7s · 1% |
| 4 | Ashen Reach |  | 100% · 20.2s · 100% | 100% · 8.6s · 100% | 100% · 11.6s · 100% | 100% · 13.3s · 100% |
| 5 | Ashen Reach | BOSS | 100% · 39.3s · 100% | 51% · 17.9s · 100% | 86% · 17.8s · 100% | 100% · 33.1s · 100% |
| 6 | Whisperwood |  | 100% · 8.6s · 64% | 100% · 6.6s · 77% | 100% · 6.9s · 83% | 100% · 9.0s · 4% |
| 7 | Whisperwood |  | 100% · 17.2s · 100% | 100% · 7.7s · 100% | 100% · 7.8s · 100% | 100% · 12.7s · 98% |
| 8 | Whisperwood |  | 100% · 19.5s · 100% | 100% · 7.9s · 100% | 100% · 7.5s · 100% | 100% · 13.3s · 100% |
| 9 | Whisperwood |  | 100% · 22.7s · 100% | 100% · 7.8s · 100% | 100% · 11.4s · 100% | 100% · 14.5s · 100% |
| 10 | Whisperwood | BOSS | 99% · 48.5s · 100% | 22% · 14.8s · 100% | 57% · 18.1s · 100% | 99% · 38.8s · 100% |
| 11 | Frostveil Peaks |  | 100% · 12.5s · 100% | 100% · 4.5s · 100% | 100% · 5.2s · 100% | 100% · 9.3s · 98% |
| 12 | Frostveil Peaks |  | 100% · 21.0s · 100% | 100% · 8.1s · 100% | 100% · 6.9s · 100% | 100% · 15.0s · 100% |
| 13 | Frostveil Peaks |  | 100% · 22.6s · 100% | 100% · 7.7s · 100% | 100% · 7.9s · 100% | 100% · 15.4s · 100% |
| 14 | Frostveil Peaks |  | 100% · 27.3s · 100% | 100% · 7.7s · 100% | 100% · 10.0s · 100% | 100% · 15.6s · 100% |
| 15 | Frostveil Peaks | BOSS | 100% · 54.3s · 100% | 53% · 17.4s · 100% | 75% · 19.5s · 100% | 99% · 43.7s · 100% |
| 16 | Sunken Sanctum |  | 100% · 13.7s · 100% | 100% · 3.8s · 100% | 100% · 5.1s · 100% | 100% · 8.8s · 100% |
| 17 | Sunken Sanctum |  | 100% · 20.8s · 100% | 100% · 6.4s · 100% | 100% · 7.1s · 100% | 100% · 13.5s · 100% |
| 18 | Sunken Sanctum |  | 100% · 18.7s · 100% | 100% · 6.1s · 100% | 100% · 6.3s · 100% | 100% · 12.3s · 100% |
| 19 | Sunken Sanctum |  | 100% · 24.7s · 100% | 100% · 6.6s · 100% | 100% · 9.9s · 100% | 100% · 13.3s · 100% |
| 20 | Sunken Sanctum | BOSS | 100% · 49.0s · 100% | 69% · 15.8s · 100% | 90% · 18.5s · 100% | 99% · 37.5s · 100% |
| 21 | Ember Throne |  | 100% · 13.3s · 100% | 100% · 3.4s · 100% | 100% · 6.2s · 100% | 100% · 8.9s · 100% |
| 22 | Ember Throne |  | 100% · 16.0s · 100% | 100% · 4.8s · 100% | 100% · 6.3s · 100% | 100% · 10.7s · 100% |
| 23 | Ember Throne |  | 100% · 17.1s · 100% | 100% · 4.6s · 100% | 100% · 6.8s · 100% | 100% · 10.7s · 100% |
| 24 | Ember Throne |  | 100% · 20.5s · 100% | 100% · 4.8s · 100% | 100% · 10.0s · 100% | 100% · 10.5s · 100% |
| 25 | Ember Throne | BOSS | 97% · 57.0s · 100% | 51% · 17.8s · 100% | 64% · 22.8s · 100% | 92% · 46.1s · 100% |

The ultimate is Ready in every boss fight and in almost every fight from stage 4 on; only the
Spiritcaller's first realm mostly goes without (it has the least damage to charge from). The
first boss (stage 5) is the hardest for the squishy classes — 52% and 78% first-try — before
boons have accumulated; the Pyromancer's hardest is the Whisperwood boss at 31%.

## Findings

1. **Bosses need a retry for two classes, barely for a third.** Pyromancer 49% and Shadowblade 74%
   first-try on bosses, 3.3 and 1.5 retries per run; Spiritcaller 98%. Normal stages are never
   replayed by anyone. Warden stays at 99% (see 5 and *The Warden investigation*).
2. **The ultimate is a moment now.** Ready in 80–93% of normal fights and every boss fight, but
   cast 1.3–3.3 times per fight instead of 4–42: a 5 s minimum interval and a cap on charge rate
   replaced a rotation. Never pressing it costs 61.8 points of boss first-try (class mean).
3. **Nobody gets stuck.** Rally at +20% per defeat carries the boonless Idle tier through every
   run (41–73 retries a run). It is a grind, not a trap.
4. **Boss fights are 15–50 s for everyone** and the enrage now applies after armour, so it is
   the one pressure a tank cannot mitigate. Warden p90 is 60 s.
5. **The Warden almost never loses, and it is not a number.** A boon-carrying Warden beats the
   Ashen King with a median lowest-health of 93%: it is never in danger. Nine tuning attempts are
   recorded under *The Warden investigation*; the conclusion is that the kit is multiplicatively
   defensive and 24 multiplicative boons on top of it pass anything a flat-damage boss can do.
6. **Parity 2.62×** (Warden 49.6 s, Pyromancer 16.9 s). Down from 3.25×: the ultimate interval
   removed the burst classes' extra casts, and halving the Ashen King's swing evened the fights.
7. **The always-ready ultimate still makes burst classes' late normal fights short.** Pyromancer
   stages 21–24 run 3.3–4.9 s against a class mean of 6.6 s. Her kit; see *Open questions*.
8. **Two cliffs were found and removed.** (a) The ultimate had no interval and charge rate was
   uncapped: one Warden run reached `ultRate` 3.05 and cast every 1.4 s (18–42 casts a boss
   fight, shields worth 630–1470% of its health). (b) The Ashen King hit for 248 against a
   no-boon health pool of 265–865: three swings and any squishy hero was dead, so the fight had
   no middle, only "instant" or "comfortable". Its swing is now 130 at twice the rate.
9. **Unchanged:** level is a restatement of stage (every run ends at 16); flat regeneration is
   dead late; boon choice still does not change outcomes (Sharp ≈ Regular).

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

- **The Warden.** See *The Warden investigation*: nine tuning levers failed; the class needs a
  design change (share-of-HP boss damage weighted to long fights, sustain-as-reaction, or a
  Warden-specific enrage). Until then it is the one class a boss cannot beat, and a player who
  picks it is choosing the easy mode whether or not the game says so.
- **Radiant Ward's shield gate.** `wantsUtility()` will not cast a shield above 20% of health; a
  Warden's shield rarely drops that far. Correct for the skill, a symptom of the Warden never being
  hurt.
- **Boss HP against the Pyromancer.** `enemy.bossHpPerStage` 0.28 would lengthen her fights but drops
  her boss first-try below the 50% floor at the old ultimate rate. Re-sweep after any ultimate change;
  she is at 49% now, on the floor.
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
- **Parity.** 2.62×. Either the Warden's damage kit grows by about a third, or the target moves to
  about 3. A Warden player spends two and a half times as long on bosses as a Pyromancer.
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
