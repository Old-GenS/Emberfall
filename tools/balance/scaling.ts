/**
 * Hero and enemy numbers by stage, with no dice: where the pressure is, and whether it grows.
 *
 * Enemy figures come from the real wave builder; hero figures are the real per-level stats with no
 * boons, at the level a first-try run has when it first reaches the stage. "Basic DPS" ignores
 * skills (so it is a floor for the hero) and is adjusted for enemy armour; "pack DPS" ignores enemy
 * skills (so it is a floor for the enemies) and the hero's armour (so it is a ceiling on threat).
 * Time-to-kill is therefore an upper bound and threat a lower bound — both show the trend.
 */
import { CLASSES, LOCATIONS, TOTAL_STAGES, buildWave, classById, type ClassId, type EnemyInstance } from '../../src/data';
import { makeEnemyUnit } from '../../src/combat';
import { statsFor, stageRewardXp, xpToNext } from '../../src/state';
import { f0, f1, pc, table } from './report';

const realmName = (stage: number): string => LOCATIONS[Math.floor(stage / 5)].name.replace(/^The /, '');

/** The level a run is at when it first enters `stage`, assuming every earlier stage was cleared first try. */
export function levelAtStage(stage: number): number {
  let level = 1;
  let xp = 0;
  for (let s = 0; s < stage; s++) {
    xp += stageRewardXp(s);
    while (xp >= xpToNext(level) && level < 50) { xp -= xpToNext(level); level++; }
  }
  return level;
}

/** Mean damage per second of basic attacks against armour `armor`, before skills. */
export function basicDps(atk: number, crit: number, critMult: number, speed: number, armor: number): number {
  const perHit = atk * (1 + crit * (critMult - 1));
  return (perHit / speed) * (100 / (100 + armor));
}

export interface StageRow {
  stage: number;
  realm: string;
  boss: boolean;
  level: number;
  enemies: number;
  enemyHp: number;
  enemyAtk: number;
  enemyArmor: number;
  enemyDps: number;
  /** per class: basic DPS after armour, seconds to kill the wave, share of hero HP lost per second */
  hero: Record<ClassId, { atk: number; hp: number; dps: number; ttk: number; threat: number }>;
}

export function stageRows(): StageRow[] {
  const rows: StageRow[] = [];
  for (let stage = 0; stage < TOTAL_STAGES; stage++) {
    const wave = buildWave(stage, 1);
    const units = wave.map((inst) => makeEnemyUnit(inst, stage));
    const level = levelAtStage(stage);
    const enemyHp = units.reduce((n, u) => n + u.stats.maxHp, 0);
    const enemyAtk = units.reduce((n, u) => n + u.stats.atk, 0) / units.length;
    const enemyArmor = units.reduce((n, u) => n + u.stats.armor, 0) / units.length;
    const enemyDps = packDpsForWave(wave, stage);
    const hero = {} as StageRow['hero'];
    for (const c of CLASSES) {
      const s = statsFor(c, level, []);
      const dps = basicDps(s.atk, s.crit, s.critMult, s.speed, enemyArmor);
      hero[c.id] = { atk: s.atk, hp: s.maxHp, dps, ttk: enemyHp / dps, threat: enemyDps / s.maxHp };
    }
    rows.push({ stage, realm: realmName(stage), boss: stage % 5 === 4, level, enemies: units.length, enemyHp, enemyAtk, enemyArmor, enemyDps, hero });
  }
  return rows;
}

/** Pack DPS (enemy basic attacks, before hero armour) for one wave at one stage. */
export function packDpsForWave(wave: EnemyInstance[], stage: number): number {
  return wave
    .map((inst) => makeEnemyUnit(inst, stage))
    .reduce((n, u) => n + basicDps(u.stats.atk, u.stats.crit, u.stats.critMult, u.stats.speed, 0), 0);
}

/** Pack DPS for every stage on one wave seed. */
export function packDpsByStage(seed: number): number[] {
  const out: number[] = [];
  for (let stage = 0; stage < TOTAL_STAGES; stage++) out.push(packDpsForWave(buildWave(stage, seed), stage));
  return out;
}

export function scalingReport(): string {
  const rows = stageRows();
  const out: string[] = [];
  out.push("Enemies by stage (real waves; a first-try run's level is shown for reference)\n");
  out.push(table(['Stage', 'Realm', 'Boss', 'Hero Lv', 'Enemies', 'Enemy HP', 'Enemy ATK', 'Armor', 'Pack DPS'], rows.map((r) => [
    String(r.stage + 1).padStart(2, '0'), r.realm, r.boss ? 'BOSS' : '', r.level, r.enemies, f0(r.enemyHp), f1(r.enemyAtk), f1(r.enemyArmor), f1(r.enemyDps),
  ])));
  for (const c of CLASSES) {
    out.push(`\n${classById(c.id).name} by stage (base stats, no boons; skills ignored)\n`);
    out.push(table(['Stage', 'Boss', 'Lv', 'ATK', 'HP', 'Basic DPS', 'Time to kill', 'Threat/s'], rows.map((r) => {
      const h = r.hero[c.id];
      return [String(r.stage + 1).padStart(2, '0'), r.boss ? 'BOSS' : '', r.level, f1(h.atk), f0(h.hp), f1(h.dps), `${f1(h.ttk)}s`, pc(h.threat * 100)];
    })));
  }
  out.push('\n(Basic DPS = basic attacks only, after enemy armour · Time to kill = enemy HP ÷ basic DPS, an upper bound ·');
  out.push(' Threat/s = enemy pack DPS ÷ hero HP before armour and reduction, the share of health lost per second, a lower bound)');
  return out.join('\n');
}
