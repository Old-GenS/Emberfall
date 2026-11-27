/**
 * `npm run balance -- <mode> [options]`  (default mode: report)
 *
 *   report    [--seeds N] [--tiers a,b|all] [--classes a,b|all] [--per-stage] [--json file]
 *             Tier × class results from seeded runs of the real game.
 *   scaling   Hero and enemy numbers by stage, with no simulation: where the pressure is.
 *   check     [--seeds N] [--doc file]
 *             Plays a shorter run set, prints every balance target against what was measured, and
 *             verifies docs/balance.md records the current config hash. Exit 1 on any failure.
 *   sweep     --set <path>=v1,v2,… [--set <path>=…] [--seeds N] [--tiers a,b]
 *             Tries values for one setting in src/balance.ts (or every combination of several)
 *             and reports the same numbers. A proposal only: a person decides whether to apply it.
 */
import { writeFileSync } from 'node:fs';
import { LOCATIONS, type ClassId } from '../../src/data';
import { allClasses, classByIdOrThrow, seedsUpTo, simulate, summarize, summarizeStages, tierById, type RunResult } from './run';
import { TIERS } from './bots';
import { f0, f1, pc, sec, table } from './report';
import { scalingReport } from './scaling';
import { check } from './check';
import { sweep } from './sweep';

interface Opts { mode: string; flags: Set<string>; values: Record<string, string>; sets: string[]; positional: string[] }

function parse(argv: string[]): Opts {
  const o: Opts = { mode: 'report', flags: new Set(), values: {}, sets: [], positional: [] };
  const known = new Set(['seeds', 'tiers', 'classes', 'json', 'set', 'values', 'doc', 'stages-for']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (key === 'set') { o.sets.push(argv[++i] ?? ''); continue; }
      if (known.has(key)) { o.values[key] = argv[++i] ?? ''; continue; }
      if (key.startsWith('no-')) { o.flags.delete(key.slice(3)); continue; }
      o.flags.add(key); continue;
    }
    if (i === 0) o.mode = a; else o.positional.push(a);
  }
  return o;
}

const list = (v: string | undefined, all: () => string[]): string[] => (!v || v === 'all' ? all() : v.split(',').map((s) => s.trim()).filter(Boolean));

function pickTiers(o: Opts) {
  const ids = list(o.values.tiers, () => TIERS.map((t) => t.id));
  return ids.map(tierById);
}
function pickClasses(o: Opts): ClassId[] {
  return list(o.values.classes, allClasses).map(classByIdOrThrow);
}
function pickSeeds(o: Opts, dflt: number): number[] {
  return seedsUpTo(Math.max(1, Number(o.values.seeds) || dflt));
}

/* --------------------------------- report ---------------------------------- */

function report(o: Opts): void {
  const tiers = pickTiers(o);
  const classes = pickClasses(o);
  const seeds = pickSeeds(o, 100);
  console.log(`\nEmberfall balance report — ${seeds.length} seed(s) per tier × class, step ${(1 / 30).toFixed(4)}s\n`);
  const started = Date.now();
  const results = simulate({ tiers, classes, seeds });
  const metrics = [];
  for (const t of tiers) for (const c of classes) metrics.push(summarize(t.id, c, results.filter((r) => r.tier === t.id && r.classId === c)));
  console.log(table(
    ['Tier', 'Class', 'Runs', 'Done', 'Stage', 'Retries', 'Walled', 'Boss 1st', 'Norm 1st', 'Elite 1st', 'Elites', 'Shrines', 'Events', 'HP N', 'HP B', 'HP@B', 'Guard/f', 'Ult≥1 N', 'Ult≥1 B', 'Ults/f', 'Norm dur', 'Boss dur', 'Boss p90', 'Lv'],
    metrics.map((m) => [m.tier, m.classId, m.runs, pc(m.completionPct), f1(m.meanStageReached), f1(m.meanRetries), m.walled, pc(m.firstTryBossPct), pc(m.firstTryNormalPct), m.eliteFights >= 20 ? pc(m.eliteFirstTryPct) : 'too few', f1(m.elites), f1(m.shrines), f1(m.events), pc(m.hpLeftNormalPct), pc(m.hpLeftBossPct), pc(m.bossEntryHpPct), f1(m.perfectPerFight), pc(m.ultReadyNormalPct), pc(m.ultReadyBossPct), f1(m.ultsPerFight), sec(m.normalDur), sec(m.bossDur), sec(m.bossDurP90), f1(m.meanLevel)]),
  ));
  console.log('\n(Done = runs that reached the ending · Stage = mean stage reached, 25 = done · Retries = defeats per run · Walled = runs that hit a stage they could not clear ·');
  console.log(' Boss/Norm/Elite 1st = first-try win rate on boss / normal (non-elite) / elite nodes · Elites/Shrines/Events = mean cleared nodes per run · HP N/B = mean health left after a won first-try fight · HP@B = mean health entering a first-try boss · Guard/f = perfect guards per fight ·');
  console.log(' Ult≥1 = fights in which the ultimate reached Ready at least once · Ults/f = ults cast per fight ·)');
  console.log(' durations are means over first-try wins · Lv = final level)\n');

  if (o.flags.has('per-stage') || o.values['stages-for']) {
    const tier = o.values['stages-for'] ?? 'regular';
    for (const c of classes) {
      const runs = results.filter((r) => r.tier === tier && r.classId === c);
      console.log(`\n${tier} × ${c} — by stage\n`);
      console.log(table(['Stage', 'Realm', 'Boss', 'Reached', '1st try', 'Tries', 'Dur', 'Ult≥1'], summarizeStages(runs).map((s) => [
        String(s.stage + 1).padStart(2, '0'), LOCATIONS[Math.floor(s.stage / 5)].name.replace(/^The /, ''), s.boss ? 'BOSS' : '', s.reached, pc(s.firstTryPct), f1(s.meanTries), sec(s.meanDur), pc(s.ultReadyPct),
      ])));
    }
  }

  if (o.values.json) {
    writeFileSync(o.values.json, JSON.stringify({ seeds: seeds.length, metrics, results }, null, 0));
    console.log(`\nwrote ${o.values.json}`);
  }
  console.log(`\n${results.length} runs in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

/* ---------------------------------- main ----------------------------------- */

const o = parse(process.argv.slice(2));
try {
  switch (o.mode) {
    case 'report': report(o); break;
    case 'scaling': console.log(scalingReport()); break;
    case 'check': process.exitCode = check(o) ? 0 : 1; break;
    case 'sweep': sweep(o); break;
    default: throw new Error(`unknown mode "${o.mode}" (report, scaling, check, sweep)`);
  }
} catch (err) {
  console.error(`balance: ${(err as Error).message}`);
  process.exitCode = 2;
}
export type { RunResult };
