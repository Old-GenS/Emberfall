/**
 * Every number a balance change is likely to touch, in one place.
 *
 * docs/balance.md records how the game behaves on these values and hashes them into its config id,
 * and tools/balance/ sweeps them. Change a value here, never at its use site. The comments say what
 * a number does; the doc says what it currently does to the game.
 *
 * Not here, on purpose: damage variance, tick lengths and the spirit wolf's stats in combat.ts.
 * They are stable mechanics rather than tuning knobs; if you change one, refresh the doc by hand.
 */
export const BALANCE = {
  /**
   * Bumped whenever combat or progression *logic* changes without any number here changing
   * (src/combat.ts, src/state.ts, the battle flow in src/main.ts). The doc's config id covers logic
   * as well as numbers, so a logic fix still marks docs/balance.md as out of date.
   */
  logic: 4,
  /** Enemy waves. `stage` runs 0..24; five stages per realm, the fifth is the boss. */
  enemy: {
    hpPerStage: 0.155,                       // normal enemies: HP × (1 + stage × this)
    bossHpPerStage: 0.26,                    // bosses: HP × (1 + stage × this)
    atkPerStage: 0.4,                     // normal enemies: ATK × (1 + stage × this)
    bossAtkPerStage: 0.38,                    // bosses: ATK × (1 + stage × this)
    escortAtkPerStage: 0.3,                 // the enemies that accompany a boss
    escortHp: 0.8, escortHpStep: 0.08,       // escorts: HP × (this + index × step)
    waveHp: 0.94, waveHpStep: 0.05,          // a normal wave: HP × (this + index × step)
    armorPerStage: 0.35,                     // every enemy: armor + stage × this
    bossEscorts: 2,
    count: { normal: 2, many: 3, manyFromStageInLoc: 3 },  // 2 enemies; 3 from a realm's 4th stage
    firstCast: 2.5, castStagger: 2.2,        // enemy abilities: first cast, then each staggered
    crit: 0.06, dodge: 0.02, critMult: 1.5,  // when an EnemyDef gives none
  },
  hero: {
    hpPerLevel: 0.085, atkPerLevel: 0.075, maxLevel: 50,
    critCap: 0.75, dodgeCap: 0.6, damageReductionCap: 0.55,
    // Boons stack without limit, and uncapped charge rate let a Warden cast its ultimate every
    // 1.4 s; the other multiplicative stats are capped for the same reason.
    ultRateCap: 1.6,
  },
  xp: {
    toNextBase: 40, toNextPerLevel: 26,      // XP for the next level: base + level × per
    stageBase: 42, perStage: 9, bossBonus: 60,  // XP for a stage: base + stage × per, + bonus on a boss
  },
  boons: { offered: 3, weight: { common: 5, rare: 2.6, epic: 1.1 } },
  /** Ultimate charge: passive per second, plus this share of damage dealt and of damage taken. 100 = Ready.
 *  `minInterval` is a floor on the gap between two casts, whatever the charge rate. */
  ultimate: { passiveCharge: 2, chargeDealt: 0.3, chargeTaken: 0.05, minInterval: 5 },
  /** Guard: a short player-controlled window. A heavy that lands inside it is a perfect guard. */
  guard: {
    window: 0.6,        // seconds the guard stays up after the press
    cooldown: 4,        // seconds between presses
    guardTaken: 0.5,    // damage multiplier for non-heavy hits while guarding
    perfectTaken: 0.1,  // damage multiplier for a heavy that lands while guarding
    perfectUlt: 20,     // ultimate charge for a perfect guard
    stagger: 1.4,       // stun on the attacker after a perfect guard (NOT reduced by bossStunFactor)
    bonusShield: 0.04,    // warden: shield of maxHp × this
    bonusHeal: 0.04,    // spiritcaller: heal maxHp × this
    bonusCounter: 3,  // shadowblade: counter-hit of atk × this, forced crit
    bonusBurnDuration: 4, bonusBurnPower: 2.2, // pyromancer: burn of atk × power per second
  },
  combat: {
    enrageAt: 30, enrageRamp: 0.12,          // after this many seconds, all damage grows by ramp per second
    bossStunFactor: 0.55,                    // stuns last this share of their time on a boss
    pyroUltStun: 0.9, pyroBurnDuration: 3, pyroBurnPower: 0.12,   // Pyromancer: her meteor stuns; basic attacks burn
    shadowbladeCritBonus: 0.25,              // Shadowblade: extra critical damage (Lethality)
    firstAttackDelay: 0.6, firstAttackJitter: 0.5,  // a unit's first swing: delay + jitter × random
  },
  /** The mercy buff after a defeat (src/main.ts): HP and ATK × rally on the next try, +step per defeat. 30 defeats reach 7x. */
  rally: { step: 0.2, cap: 8 },
  /** Roguelike run rules: random waves, elite affixes, health carried within a realm. */
  run: {
    eliteChance: [0, 0.7, 0.9, 1],   // by stageInLoc 0..3: chance the wave contains the realm's elite (at most one)
    affixChance: 0.25, affixPerRealm: 0.15, affixCap: 0.85, // chance an elite rolls an affix: base + realm index × per, capped
    healOnWin: 0.25,                  // share of max HP restored after a normal win (on top of the HP left)
    retryHeal: 0.25,                  // extra share of max HP per defeat on the retry's starting health
    minStartHp: 0.2,                  // the hero never starts a stage below this share of max HP
  },
  /** Branching path (roguelike phase 2). */
  path: {
    weights: { fight: 45, elite: 25, shrine: 15, event: 15 }, // offer weights for steps 1-3
    preBossShrine: 2,     // shrine weight multiplier on step 3 (the stop before the boss)
    eliteHp: 2.5,         // elite node: every enemy's hpScale × this (tougher)…
    eliteAtk: 1.0,        // …and atkScale × this (a little deadlier; never out-hits the realm's boss)
    eliteXp: 1.5,         // elite node: stage XP × this
    restHeal: 0.35,       // shrine Rest: + this share of max HP
    offeringCost: 0.2,    // shrine Offering: − this share of max HP
    nonCombatXp: 0.5,     // shrine/event: stage XP × this
    hpFloor: 0.05,        // shrines and events never take health below this share
  },
};

export type Balance = typeof BALANCE;
