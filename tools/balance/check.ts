/**
 * The balance targets, and `check`: play a run set, print every target against what was measured,
 * and verify docs/balance.md records the current config id. Exit status 1 when any target fails.
 *
 * The targets say what kind of game Emberfall is meant to be, in numbers. They come from the
 * README's own claims ("a relaxed, readable auto-battler", "bosses occasionally require a retry",
 * "retry a stage as many times as you like") and from the two decisions the player makes in combat
 * — when to fire the ultimate and when to guard a telegraphed heavy. If a change breaks one, either
 * the change went too far or the target needs to move — and moving a target is a person's decision,
 * written down in the doc.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CLASSES, type ClassId } from '../../src/data';
import { allClasses, seedsUpTo, simulate, summarize, type ClassMetrics } from './run';
import { TIERS } from './bots';
import { table } from './report';
import { balanceFingerprint, docFingerprint } from './fingerprint';

export type Matrix = Map<string, Map<ClassId, ClassMetrics>>;
export const m = (x: Matrix, tier: string, cls: ClassId): ClassMetrics => {
  const r = x.get(tier)?.get(cls);
  if (!r) throw new Error(`no results for ${tier} × ${cls}`);
  return r;
};

export interface Verdict {
  id: string;
  name: string;
  why: string;
  target: string;
  measured: string;
  pass: boolean;
}

const perClass = (f: (c: ClassId) => string): string => CLASSES.map((c) => `${c.id.slice(0, 4)} ${f(c.id)}`).join(' · ');
const every = (f: (c: ClassId) => boolean): boolean => CLASSES.every((c) => f(c.id));

export function evaluateTargets(x: Matrix): Verdict[] {
  const R = 'regular'; const C = 'casual'; const I = 'idle';
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const v: Verdict[] = [];
  const add = (id: string, name: string, why: string, target: string, measured: string, pass: boolean) => v.push({ id, name, why, target, measured, pass });

  add('complete', 'Regular finishes', 'The README promises a relaxed auto-battler: a player who takes any boon and presses the button sees the ending.', '≥ 95% of runs, each class',
    perClass((c) => `${m(x, R, c).completionPct.toFixed(0)}%`), every((c) => m(x, R, c).completionPct >= 95));
  add('boss-retry', 'Bosses occasionally need a retry', '"Bosses occasionally require a retry": above 90% they never do, below 50% the boss is a wall.', 'first-try 50–90%, each class',
    perClass((c) => `${m(x, R, c).firstTryBossPct.toFixed(0)}%`), every((c) => m(x, R, c).firstTryBossPct >= 50 && m(x, R, c).firstTryBossPct <= 90));
  add('normal-smooth', 'Normal stages flow', 'Retries belong to bosses; a normal stage that has to be replayed is a chore, even with the guard.', 'first-try ≥ 90%, each class',
    perClass((c) => `${m(x, R, c).firstTryNormalPct.toFixed(0)}%`), every((c) => m(x, R, c).firstTryNormalPct >= 90));
  add('normal-teeth', 'Normal fights cost real health', 'A normal stage that never dents the hero’s health is a formality, and a heavy you can ignore is not a decision. Winning should still hurt.', 'lowest health in a won first-try normal fight: mean 35–85%, each class',
    perClass((c) => `${m(x, R, c).hpLeftNormalPct.toFixed(0)}%`), every((c) => m(x, R, c).hpLeftNormalPct >= 35 && m(x, R, c).hpLeftNormalPct <= 85));
  add('attrition', 'Health carries weight', 'A realm is one stretch of road: sloppy normal fights should leave you weaker at the boss, but never hopeless.', 'mean health entering first-try boss fights 40–85%, each class',
    perClass((c) => `${m(x, R, c).bossEntryHpPct.toFixed(0)}%`), every((c) => m(x, R, c).bossEntryHpPct >= 40 && m(x, R, c).bossEntryHpPct <= 85));
  const walls = [...x.values()].flatMap((cm) => [...cm.values()].filter((r) => r.walled > 0).map((r) => `${r.tier}/${r.classId}:${r.walled}`));
  add('no-wall', 'Nobody gets stuck', '"Retry a stage as many times as you like" and no way to drop a boon: a stage the Rally bonus cannot carry a player through means abandoning the run.', '0 walled runs, every tier',
    walls.length ? walls.join(' · ') : 'none', walls.length === 0);
  add('ult-available', 'The ultimate is there to be used', 'It is one of the two in-combat decisions (the other is the guard). A button that never glows is not a decision.', 'Ready in ≥ 75% of normal and ≥ 95% of boss fights, each class',
    perClass((c) => `${m(x, R, c).ultReadyNormalPct.toFixed(0)}%/${m(x, R, c).ultReadyBossPct.toFixed(0)}%`), every((c) => m(x, R, c).ultReadyNormalPct >= 75 && m(x, R, c).ultReadyBossPct >= 95));
  const matters = mean(CLASSES.map((c) => m(x, R, c.id).firstTryBossPct - m(x, C, c.id).firstTryBossPct));
  add('ult-matters', 'Pressing it changes something', 'If never touching the ultimate changes no outcome, the ultimate is no decision. The guard is measured separately below.', 'boss first-try ≥ 8 points above Casual, class mean',
    `${matters.toFixed(1)} points`, matters >= 8);
  const guards = mean(CLASSES.map((c) => m(x, R, c.id).firstTryBossPct - m(x, C, c.id).firstTryBossPct));
  add('guard-matters', 'Guarding a heavy changes something', 'A telegraphed heavy is the guard\'s whole reason to exist: a player who catches most of them must beat bosses more often than one who never presses.', 'boss first-try ≥ 12 points above Casual, class mean',
    `${guards.toFixed(1)} points`, guards >= 12);
  const idle = [...x.keys()].includes(I);
  if (idle) {
    const idleR = mean(CLASSES.map((c) => m(x, I, c.id).meanRetries)); const regR = mean(CLASSES.map((c) => m(x, R, c.id).meanRetries));
    const idleDone = mean(CLASSES.map((c) => m(x, I, c.id).completionPct)); const regDone = mean(CLASSES.map((c) => m(x, R, c.id).completionPct));
    add('boons-matter', 'The reward screen counts', 'Skipping every boon should cost something, or the one between-battle decision is decorative too (it must never cost the run: see nobody-gets-stuck).', 'Idle: ≥ 2 more retries per run, or ≥ 10 points fewer finishes',
      `retries ${idleR.toFixed(1)} vs ${regR.toFixed(1)} · finishes ${idleDone.toFixed(0)}% vs ${regDone.toFixed(0)}%`, idleR >= regR + 2 || idleDone <= regDone - 10);
  }
  add('pacing-normal', 'Normal fights are readable', 'Long enough to see what the skills do, short enough not to reach for the speed button.', 'mean 6–30 s, each class',
    perClass((c) => `${m(x, R, c).normalDur.toFixed(1)}s`), every((c) => m(x, R, c).normalDur >= 6 && m(x, R, c).normalDur <= 30));
  // The floor is 14 s, not 15: the mean over 40 seeds moves by about half a second, so a 15 s
  // floor failed at random on a class sitting exactly on it. Below 14 s a boss fight is a blink.
  add('pacing-boss', 'Boss fights are set pieces, not slogs', 'Longer than a normal fight, and short enough to want to try again after a loss.', 'mean 14–60 s, each class',
    perClass((c) => `${m(x, R, c).bossDur.toFixed(1)}s`), every((c) => m(x, R, c).bossDur >= 14 && m(x, R, c).bossDur <= 60));
  const durs = CLASSES.map((c) => m(x, R, c.id).bossDur); const done = CLASSES.map((c) => m(x, R, c.id).completionPct);
  add('parity', 'Classes feel alike in length', 'No class should take twice as long as another to do the same job.', 'boss duration max/min ≤ 2 · finishes within 5 points',
    `${(Math.max(...durs) / Math.max(1e-9, Math.min(...durs))).toFixed(2)}× · ${Math.max(...done) - Math.min(...done)} points`, Math.max(...durs) / Math.max(1e-9, Math.min(...durs)) <= 2 && Math.max(...done) - Math.min(...done) <= 5);
  return v;
}

/* ---------------------------------- check ---------------------------------- */

interface Opts { values: Record<string, string>; flags: Set<string>; mode: string }

export function check(o: Opts): boolean {
  const seeds = seedsUpTo(Math.max(1, Number(o.values.seeds) || 40));
  const classes = allClasses();
  const started = Date.now();
  const results = simulate({ tiers: TIERS, classes, seeds });
  const x: Matrix = new Map();
  for (const t of TIERS) x.set(t.id, new Map(classes.map((c) => [c, summarize(t.id, c, results.filter((r) => r.tier === t.id && r.classId === c))])));

  const verdicts = evaluateTargets(x);
  const fp = balanceFingerprint();
  const docPath = resolve(o.values.doc ?? 'docs/balance.md');
  let docOk = false; let docNote = `${docPath} not found`;
  if (existsSync(docPath)) {
    const text = readFileSync(docPath, 'utf8');
    const recorded = docFingerprint(text);
    docOk = recorded === fp;
    docNote = recorded === undefined ? 'no Config row in Status' : docOk ? `docs/balance.md records ${fp}` : `docs/balance.md records ${recorded}, current is ${fp}`;
  }
  verdicts.push({ id: 'doc-current', name: 'The doc is current', why: 'Results in docs/balance.md are only true for the config they were measured on.', target: 'Status hash = current', measured: docNote, pass: docOk });

  console.log(`\nEmberfall balance check — ${seeds.length} seed(s) × ${TIERS.length} tiers × ${classes.length} classes, config ${fp}\n`);
  console.log(table(['Target', 'Wants', 'Measured', ''], verdicts.map((t) => [t.name, t.target, t.measured, t.pass ? 'ok' : 'FAIL'])));
  const failed = verdicts.filter((t) => !t.pass);
  console.log(failed.length ? `\n${failed.length} of ${verdicts.length} targets fail:\n` : `\nall ${verdicts.length} targets pass\n`);
  for (const t of failed) console.log(`  ${t.id}: ${t.why}`);
  console.log(`\n${results.length} runs in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
  return failed.length === 0;
}
