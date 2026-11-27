/**
 * The bots: what a player decides in Emberfall, reduced to policies. There are four decisions in
 * this game — the class, which boon to take, when to release the ultimate, and when to guard — so
 * a "tier" is a (boon policy, ultimate policy, guard policy) triple. Tiers are meant to be
 * recognisable kinds of player:
 *
 *   Idle    skips every boon, never touches the ultimate, never guards
 *   Casual  takes whatever boon, never notices the ultimate or the guard
 *   Regular takes whatever boon, fires the ultimate as soon as it glows, guards a heavy sloppily
 *   Sharp   picks the boon that fits the class, holds the ultimate for the moment it matters, and
 *           guards every heavy at the last moment
 *
 * The scripted bots in drumline's balance.md are the model: simple rules, so a thinking player
 * should do at least as well as Sharp.
 */
import { BOONS, classById, type BoonDef, type ClassId, type EventDef, type NodeType, type Stats } from '../../src/data';

export type UltPolicy = 'never' | 'asap' | 'smart';
export type BoonPolicy = 'skip' | 'random' | 'best';
/** `sloppy` commits to the right timing with probability 0.65 and otherwise never presses for that telegraph. */
export type GuardPolicy = 'never' | 'sloppy' | 'perfect';
export type ShrineChoice = 'rest' | 'offering';

/** What a tier does on the branching path: which node, and which shrine/event choice. */
export interface PathPolicy {
  /** Pick one of the two offered nodes. `hp` is the carried health share, 0..1. */
  chooseNode(offered: NodeType[], hp: number): NodeType;
  chooseShrine(hp: number): ShrineChoice;
  /** The chosen event choice id. */
  chooseEvent(event: EventDef, hp: number): string;
}

export interface Tier {
  id: string;
  label: string;
  boons: BoonPolicy;
  ult: UltPolicy;
  guard: GuardPolicy;
  path: PathPolicy;
  blurb: string;
}

/* ------------------------------- path policies ------------------------------ */

const regularPath: PathPolicy = {
  chooseNode: (offered, hp) => {
    if (offered.includes('shrine') && hp < 0.45) return 'shrine';
    if (offered.includes('fight')) return 'fight';
    if (offered.includes('elite')) return 'elite';
    return offered[0];
  },
  chooseShrine: (hp) => (hp < 0.6 ? 'rest' : 'offering'),
  chooseEvent: (event, hp) => {
    if (event.id === 'merchant') return hp >= 0.6 ? 'trade' : 'leave';
    if (event.id === 'reliquary') return hp >= 0.6 ? 'open' : 'leave';
    return hp < 0.6 ? 'pray' : 'tend';
  },
};

const sharpPath: PathPolicy = {
  chooseNode: (offered, hp) => {
    if (offered.includes('elite') && hp >= 0.7) return 'elite';
    if (offered.includes('shrine') && hp < 0.5) return 'shrine';
    if (offered.includes('fight')) return 'fight';
    const combat = offered.find((t) => t === 'fight' || t === 'elite');
    return combat ?? offered[0];
  },
  chooseShrine: regularPath.chooseShrine,
  chooseEvent: regularPath.chooseEvent,
};

export const TIERS: Tier[] = [
  { id: 'idle', label: 'Idle', boons: 'skip', ult: 'never', guard: 'never', blurb: 'Skips every boon, never uses the ultimate, never guards. The floor: if this wins, nothing the player does matters.', path: {
    chooseNode: (offered) => offered[0],
    chooseShrine: () => 'rest',
    chooseEvent: (event) => (event.id === 'pilgrim' ? 'pray' : 'leave'),
  } },
  { id: 'casual', label: 'Casual', boons: 'random', ult: 'never', guard: 'never', blurb: 'Takes a random boon, never notices the ultimate button or the guard.', path: {
    chooseNode: (offered) => offered[Math.floor(Math.random() * offered.length)],
    chooseShrine: () => (Math.random() < 0.5 ? 'rest' : 'offering'),
    chooseEvent: (event) => event.choices[Math.floor(Math.random() * event.choices.length)].id,
  } },
  { id: 'regular', label: 'Regular', boons: 'random', ult: 'asap', guard: 'sloppy', path: regularPath, blurb: 'Takes a random boon, presses the ultimate the moment it is ready, and catches most heavies with a sloppy guard.' },
  { id: 'sharp', label: 'Sharp', boons: 'best', ult: 'smart', guard: 'perfect', path: sharpPath, blurb: 'Picks the boon that fits its class, holds the ultimate for a boss, a pack, or low health, and times every guard.' },
];

/* --------------------------------- ultimate -------------------------------- */

/**
 * Whether the `smart` policy releases the ultimate right now. A self-buff (the Warden's) is worth
 * holding until it is needed; a heal hybrid goes out when hurt or on a boss; an AoE nuke waits for
 * a pack or a boss; a single-target kill waits for a lone foe or a boss.
 */
export function wantsUlt(b: { hero: { ultCharge: number; hp: number; stats: Stats }; enemies: { alive: boolean; boss: boolean }[] }, cls: ClassId): boolean {
  const h = b.hero;
  if (h.ultCharge < 100) return false;
  const foes = b.enemies.filter((e) => e.alive);
  const boss = foes.some((e) => e.boss);
  const hpPct = h.hp / h.stats.maxHp;
  const ult = classById(cls).ultimate;
  if (ult.target === 'self') return hpPct < 0.6;
  if (ult.heal) return hpPct < 0.75 || boss;
  if (ult.target === 'allEnemies') return boss || foes.length >= 2;
  return boss || foes.length === 1;
}

/* ---------------------------------- boons ---------------------------------- */

/** How much a stat change is worth one point, before class weights: relative for multipliers, fixed for small fractions. */
const STAT_SCALE: Record<keyof Stats, (before: number) => number> = {
  maxHp: (b) => b, atk: (b) => b, armor: (b) => b, speed: (b) => b, critMult: (b) => b,
  abilityPower: (b) => b, ultRate: (b) => b,
  crit: () => 0.05, dodge: () => 0.05, damageReduction: () => 0.05, lifesteal: () => 0.05,
  regen: () => 1,
};

/** What each class wants. `speed` is the attack interval (lower is faster), so its delta is flipped. */
const CLASS_WEIGHTS: Record<ClassId, Partial<Record<keyof Stats, number>>> = {
  warden: { maxHp: 1, armor: 0.8, damageReduction: 1, regen: 0.6, atk: 0.6, ultRate: 0.6, abilityPower: 0.5 },
  pyromancer: { atk: 1, abilityPower: 1, crit: 0.8, critMult: 0.8, ultRate: 0.7, speed: 0.6, maxHp: 0.4 },
  shadowblade: { atk: 1, crit: 1, critMult: 1, speed: 0.8, dodge: 0.6, abilityPower: 0.5, maxHp: 0.3 },
  spiritcaller: { abilityPower: 0.9, maxHp: 0.8, regen: 0.8, atk: 0.8, ultRate: 0.6, armor: 0.4 },
};

const RARITY_PRIOR: Record<BoonDef['rarity'], number> = { epic: 0.3, rare: 0.15, common: 0 };

/** How much `boon` improves `stats` for `cls`: the weighted, scaled stat deltas plus a rarity prior. */
export function scoreBoon(cls: ClassId, stats: Stats, boon: BoonDef): number {
  const after: Stats = { ...stats };
  boon.apply(after, 0);
  let score = RARITY_PRIOR[boon.rarity];
  const w = CLASS_WEIGHTS[cls];
  (Object.keys(STAT_SCALE) as (keyof Stats)[]).forEach((k) => {
    const a = after[k]; const b = stats[k];
    const d = k === 'speed' ? (b - a) / Math.max(STAT_SCALE[k](b), 1e-9) : (a - b) / Math.max(STAT_SCALE[k](b), 1e-9);
    score += (w[k] ?? 0) * d;
  });
  return score;
}

/** The boon a policy takes from the three on offer. */
export function chooseBoon(policy: BoonPolicy, cls: ClassId, stats: Stats, offered: BoonDef[]): BoonDef | undefined {
  if (policy === 'skip' || offered.length === 0) return undefined;
  if (policy === 'random') return offered[Math.floor(Math.random() * offered.length)];
  return offered.reduce((best, b) => (scoreBoon(cls, stats, b) > scoreBoon(cls, stats, best) ? b : best));
}

/** Every boon's measured effect on a reference hero, for the config fingerprint (boons are code, not data). */
export function boonEffects(reference: Stats, copies = 0): Record<string, Stats> {
  const out: Record<string, Stats> = {};
  for (const b of BOONS) { const s: Stats = { ...reference }; b.apply(s, copies); out[b.id] = s; }
  return out;
}
