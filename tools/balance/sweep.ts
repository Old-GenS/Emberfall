/**
 * A sweep tries a list of values for one setting in src/balance.ts and reports the usual numbers for
 * each. It only suggests a value; a person decides whether to apply it (and then updates
 * docs/balance.md). Sweeps move one setting at a time, on bot play, so they are for coarse fixes.
 */
import { BALANCE } from '../../src/balance';
import type { ClassId } from '../../src/data';
import { allClasses, seedsUpTo, simulate, summarize, type RunResult } from './run';
import { TIERS, type Tier } from './bots';
import { f1, pc, table } from './report';

interface Opts { values: Record<string, string>; sets: string[]; flags: Set<string>; mode: string }

type Ots = { values: Record<string, string>; sets: string[] };
type Tree = Record<string, unknown> | number;
const isTree = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Set `a.b.c` on BALANCE to `value`; returns the previous value so the sweep can put it back. */
export function setPath(root: Record<string, unknown>, path: string, value: unknown): unknown {
  const parts = path.split('.');
  let node: Record<string, unknown> = root;
  for (const p of parts.slice(0, -1)) {
    const next = node[p];
    if (!isTree(next)) throw new Error(`no setting "${path}" in src/balance.ts (stopped at "${p}")`);
    node = next;
  }
  const last = parts[parts.length - 1];
  if (!(last in node)) throw new Error(`no setting "${path}" in src/balance.ts`);
  const prev = node[last];
  node[last] = value;
  return prev;
}

export function describePath(path: string): unknown {
  const parts = path.split('.');
  let node: Tree = BALANCE as unknown as Tree;
  for (const p of parts) {
    if (typeof node === 'number' || !(p in node)) throw new Error(`no setting "${path}" in src/balance.ts`);
    node = node[p] as Tree;
  }
  return node;
}

/** `path=v1,v2` → [path, values]. `--set path --values v1,v2` (one setting) still works. */
function parseSets(o: Ots): { path: string; values: number[] }[] {
  const sets = o.sets.map((spec) => {
    const eq = spec.indexOf('=');
    if (eq < 0) throw new Error(`--set expects <path>=v1,v2,… (got "${spec}")`);
    return { path: spec.slice(0, eq).trim(), values: spec.slice(eq + 1) };
  });
  if (sets.length === 0 && o.values.set) sets.push({ path: o.values.set, values: o.values.values ?? '' });
  if (sets.length === 0) throw new Error('sweep needs --set <path>=v1,v2,… (for example --set enemy.hpPerStage=0.12,0.155)');
  return sets.map(({ path, values }) => {
    const nums = values.split(',').map((s) => s.trim()).filter(Boolean).map(Number);
    if (!nums.length || nums.some((v) => !Number.isFinite(v))) throw new Error(`sweep needs a list of numbers for "${path}" (got "${values}")`);
    describePath(path);
    return { path, values: nums };
  });
}

/** Every combination of the given lists, in order. */
function cartesian<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap((combo) => list.map((v) => [...combo, v])), [[]]);
}

export function sweep(o: Opts): void {
  const sets = parseSets(o);
  const tiers: Tier[] = (o.values.tiers ?? 'regular').split(',').map((id) => TIERS.find((t) => t.id === id) ?? (() => { throw new Error(`unknown tier "${id}"`); })());
  const seeds = seedsUpTo(Math.max(1, Number(o.values.seeds) || 40));
  const classes = allClasses();
  const combos = cartesian(sets.map((s) => s.values));

  const rows: (string | number)[][] = [];
  for (const combo of combos) {
    const prevs = sets.map((s, i) => setPath(BALANCE as unknown as Record<string, unknown>, s.path, combo[i]));
    let results: RunResult[] = [];
    try {
      results = simulate({ tiers, classes, seeds });
    } finally {
      sets.forEach((s, i) => setPath(BALANCE as unknown as Record<string, unknown>, s.path, prevs[i]));
    }
    for (const tier of tiers) {
      const runs = results.filter((r) => r.tier === tier.id);
      const all = summarize(tier.id, 'all' as ClassId, runs);
      const perClass = classes.map((c) => summarize(tier.id, c, runs.filter((r) => r.classId === c)));
      rows.push([
        tier.id, ...combo.map(String), pc(all.completionPct), `${perClass.map((c) => c.firstTryBossPct.toFixed(0)).join('/')}`, `${perClass.map((c) => c.firstTryNormalPct.toFixed(0)).join('/')}`,
        f1(all.meanRetries), all.walled, pc(all.ultReadyNormalPct), pc(all.ultReadyBossPct), `${perClass.map((c) => c.hpLeftNormalPct.toFixed(0)).join('/')}`, `${perClass.map((c) => c.normalDur.toFixed(0)).join('/')}`, `${perClass.map((c) => c.bossDur.toFixed(0)).join('/')}`,
      ]);
    }
  }
  console.log(`\nSweep ${sets.map((s) => `${s.path} (currently ${JSON.stringify(describePath(s.path))})`).join(' × ')} — ${seeds.length} seed(s) per class, ${tiers.map((t) => t.id).join(', ')} tier\n`);
  console.log(table(['Tier', ...sets.map((s) => s.path), 'Done', 'Boss 1st', 'Norm 1st', 'Retries', 'Walled', 'Ult≥1 N', 'Ult≥1 B', 'HP N', 'Norm dur', 'Boss dur'], rows));
  console.log('\n(per-class cells are warden/pyromancer/shadowblade/spiritcaller · see `npm run balance -- report` for the column meanings)');
  console.log('A sweep proposes; a person decides. To apply a value: edit src/balance.ts, run `npm test`, update docs/balance.md.\n');
}
