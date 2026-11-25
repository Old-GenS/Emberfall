/**
 * The run engine: plays complete runs of the real game, headless.
 *
 * It drives the real `Battle` (src/combat.ts) and the real progression (src/state.ts: XP, levels,
 * boon offers), following the same flow as src/main.ts: hero stats from the save, Rally applied on
 * a retry, a boon after every win, Rally reset on a win. What it adds is the bot policies (which
 * boon, when to fire the ultimate) and bookkeeping. No DOM, no renderer, no audio.
 */
import { CLASSES, TOTAL_STAGES, buildWave, type ClassId } from '../../src/data';
import { Battle } from '../../src/combat';
import { BALANCE } from '../../src/balance';
import { applyBoon, completeStage, getSave, heroStats, pickBoonChoices, resetSave, selectClass } from '../../src/state';
import { TIERS, chooseBoon, wantsUlt, type BoonPolicy, type Tier, type UltPolicy } from './bots';
import { hashSeed, seedRandom } from './rng';

/** Simulation step. The game steps once per frame with dt capped at 50 ms; 30 Hz sits inside that. */
export const DT = 1 / 30;
/** A stage the bot cannot clear in this many tries counts as a wall (the Rally bonus caps out). */
export const MAX_RETRIES = 30;

export interface FightRec {
  stage: number;
  boss: boolean;
  /** 0 on the first try of a stage, then 1, 2, … while the bot keeps losing. */
  attempt: number;
  win: boolean;
  dur: number;
  ults: number;
  ultReady: boolean;
  maxCharge: number;
}

export interface RunResult {
  tier: string;
  classId: ClassId;
  seed: number;
  completed: boolean;
  stageReached: number;
  finalLevel: number;
  boons: number;
  retries: number;
  walled: boolean;
  fights: FightRec[];
}

/** One battle, as main.ts's startBattle() sets it up, with the bot deciding on the ultimate each step. */
export function fight(classId: ClassId, stage: number, rally: number, ult: UltPolicy): FightRec {
  const stats = heroStats();
  if (rally > 1) {
    stats.maxHp = Math.round(stats.maxHp * rally);
    stats.atk = Math.round(stats.atk * rally * 10) / 10;
  }
  const b = new Battle(classId, stats, buildWave(stage), stage);
  let ults = 0;
  let ultReady = false;
  let maxCharge = 0;
  // The enrage timer ends every battle; the guard is only here so a bug cannot hang the harness.
  for (let guard = 0; !b.ended && guard < 30 * 900; guard++) {
    b.update(DT);
    const c = b.hero.ultCharge;
    if (c > maxCharge) maxCharge = c;
    if (c >= 100) ultReady = true;
    const fire = ult === 'asap' ? c >= 100 : ult === 'smart' && wantsUlt(b, classId);
    if (fire && b.useUltimate()) ults++;
  }
  return { stage, boss: stage % 5 === 4, attempt: 0, win: b.victory, dur: b.time, ults, ultReady, maxCharge };
}

/** One full run: from a fresh save to the ending or a wall, on one seed. */
export function playRun(classId: ClassId, tier: Tier, seed: number, maxRetries = MAX_RETRIES): RunResult {
  seedRandom(hashSeed(tier.id, classId, seed));
  resetSave();
  selectClass(classId);
  const fights: FightRec[] = [];
  let rally = 1;
  let walled = false;
  while (getSave().stage < TOTAL_STAGES) {
    const stage = getSave().stage;
    let attempt = 0;
    let rec = fight(classId, stage, rally, tier.ult);
    rec.attempt = 0;
    fights.push(rec);
    while (!rec.win && attempt + 1 < maxRetries) {
      attempt++;
      rally = Math.min(BALANCE.rally.cap, rally + BALANCE.rally.step);
      rec = { ...fight(classId, stage, rally, tier.ult), attempt };
      fights.push(rec);
    }
    if (!rec.win) { walled = true; break; }
    completeStage();
    takeBoon(tier.boons, classId);
    rally = 1;
  }
  const save = getSave();
  return {
    tier: tier.id, classId, seed,
    completed: save.stage >= TOTAL_STAGES, stageReached: save.stage,
    finalLevel: save.level, boons: save.boons.length,
    retries: fights.filter((f) => !f.win).length, walled, fights,
  };
}

/** The boon step after a win: three offers, the policy picks one, or skips (the UI's "Skip Boon"). */
function takeBoon(policy: BoonPolicy, classId: ClassId): void {
  if (policy === 'skip') return;
  const offered = pickBoonChoices();
  const pick = chooseBoon(policy, classId, heroStats(), offered);
  if (pick) applyBoon(pick.id);
}

/* -------------------------------- aggregation ------------------------------- */

export const mean = (a: number[]): number => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const pct = (num: number, den: number): number => (den ? (100 * num) / den : 0);
export const quantile = (a: number[], q: number): number => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)));
  return s[i];
};

export interface ClassMetrics {
  tier: string;
  classId: ClassId;
  runs: number;
  completionPct: number;
  meanStageReached: number;
  meanRetries: number;
  walled: number;
  firstTryNormalPct: number;
  firstTryBossPct: number;
  ultReadyNormalPct: number;
  ultReadyBossPct: number;
  ultsPerFight: number;
  normalDur: number;
  bossDur: number;
  bossDurP90: number;
  meanLevel: number;
}

const win1 = (f: FightRec) => f.attempt === 0 && f.win;

/** Tier × class numbers from a set of runs that all share a tier and a class. */
export function summarize(tier: string, classId: ClassId, runs: RunResult[]): ClassMetrics {
  const first = runs.flatMap((r) => r.fights.filter((f) => f.attempt === 0));
  const normal = first.filter((f) => !f.boss);
  const boss = first.filter((f) => f.boss);
  const bossWinDur = boss.filter(win1).map((f) => f.dur);
  return {
    tier, classId, runs: runs.length,
    completionPct: pct(runs.filter((r) => r.completed).length, runs.length),
    meanStageReached: mean(runs.map((r) => r.stageReached)),
    meanRetries: mean(runs.map((r) => r.retries)),
    walled: runs.filter((r) => r.walled).length,
    firstTryNormalPct: pct(normal.filter(win1).length, normal.length),
    firstTryBossPct: pct(boss.filter(win1).length, boss.length),
    ultReadyNormalPct: pct(normal.filter((f) => f.ultReady).length, normal.length),
    ultReadyBossPct: pct(boss.filter((f) => f.ultReady).length, boss.length),
    ultsPerFight: mean(first.map((f) => f.ults)),
    normalDur: mean(normal.filter(win1).map((f) => f.dur)),
    bossDur: mean(bossWinDur),
    bossDurP90: quantile(bossWinDur, 0.9),
    meanLevel: mean(runs.map((r) => r.finalLevel)),
  };
}

export interface StageMetrics {
  stage: number;
  boss: boolean;
  reached: number;
  firstTryPct: number;
  meanTries: number;
  meanDur: number;
  ultReadyPct: number;
}

/** Per-stage numbers (first attempts and retries) for runs of one tier and class. */
export function summarizeStages(runs: RunResult[]): StageMetrics[] {
  const out: StageMetrics[] = [];
  for (let stage = 0; stage < TOTAL_STAGES; stage++) {
    const at = runs.flatMap((r) => r.fights.filter((f) => f.stage === stage));
    const reached = runs.filter((r) => r.stageReached >= stage || r.walled).length;
    const first = at.filter((f) => f.attempt === 0);
    out.push({
      stage, boss: stage % 5 === 4, reached,
      firstTryPct: pct(first.filter(win1).length, first.length),
      meanTries: mean(runs.filter((r) => r.fights.some((f) => f.stage === stage)).map((r) => r.fights.filter((f) => f.stage === stage).length)),
      meanDur: mean(first.filter(win1).map((f) => f.dur)),
      ultReadyPct: pct(first.filter((f) => f.ultReady).length, first.length),
    });
  }
  return out;
}

export interface SimOptions {
  tiers: Tier[];
  classes: ClassId[];
  /** Seed numbers 1..seeds, or an explicit list. */
  seeds: number[];
  maxRetries?: number;
}

/** Every (tier, class, seed) combination, played in sequence (the save is module state, so never in parallel). */
export function simulate(o: SimOptions): RunResult[] {
  const seeds = o.seeds;
  const out: RunResult[] = [];
  for (const tier of o.tiers) {
    for (const classId of o.classes) {
      for (const seed of seeds) out.push(playRun(classId, tier, seed, o.maxRetries));
    }
  }
  return out;
}

export const seedsUpTo = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);
export const allClasses = (): ClassId[] => CLASSES.map((c) => c.id);
export const tierById = (id: string): Tier => {
  const t = TIERS.find((x) => x.id === id);
  if (!t) throw new Error(`unknown tier "${id}" (known: ${TIERS.map((x) => x.id).join(', ')})`);
  return t;
};
export const classByIdOrThrow = (id: string): ClassId => {
  const c = CLASSES.find((x) => x.id === id);
  if (!c) throw new Error(`unknown class "${id}" (known: ${CLASSES.map((x) => x.id).join(', ')})`);
  return c.id;
};
