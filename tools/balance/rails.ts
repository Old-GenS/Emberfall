/**
 * Design rails: the ranges every tuning knob must stay inside, whatever the targets say.
 *
 * The targets in check.ts measure outcomes, and an optimiser (a person or an agent) can satisfy an
 * outcome by bending the game out of shape: normal waves that out-hit their boss, a 60× ATK burn,
 * elites offered 4% of the time so the elite target passes on "too few" fights. Each rail below is
 * a design decision, not a measurement. Moving a rail is a person's call, written down in
 * docs/balance.md under *Design rails*. If a target cannot be met inside the rails, the honest
 * result is a failing target, not a wider rail.
 */
import { BALANCE } from '../../src/balance';
import { CLASSES, LOCATIONS } from '../../src/data';

interface Rail { path: string; value: number; min: number; max: number }

const r = (path: string, value: number, min: number, max: number): Rail => ({ path, value, min, max });

/** Every rail with its current value. */
export function rails(): Rail[] {
  const B = BALANCE;
  const out: Rail[] = [
    // Enemy curve: normal waves grow, but never into a second boss.
    r('enemy.hpPerStage', B.enemy.hpPerStage, 0.1, 0.25),
    r('enemy.atkPerStage', B.enemy.atkPerStage, 0.1, 0.6),
    r('enemy.bossHpPerStage', B.enemy.bossHpPerStage, 0.15, 0.4),
    r('enemy.bossAtkPerStage', B.enemy.bossAtkPerStage, 0.25, 0.6),
    r('enemy.escortAtkPerStage', B.enemy.escortAtkPerStage, 0.1, 0.4),
    r('enemy.count.normal', B.enemy.count.normal, 2, 2),
    r('enemy.count.many', B.enemy.count.many, 3, 3), // three-enemy waves are part of the game
    // The ultimate is a moment, not a rotation, and not a rarity either.
    r('ultimate.minInterval', B.ultimate.minInterval, 3, 8),
    // Enrage: browser checks assert the chip reads ×1.x just after 30 s.
    r('combat.enrageAt', B.combat.enrageAt, 25, 40),
    r('combat.enrageRamp', B.combat.enrageRamp, 0.04, 0.2),
    // Guard: a timing skill with a payoff, not a win button.
    r('guard.window', B.guard.window, 0.4, 1.0),
    r('guard.cooldown', B.guard.cooldown, 2, 6),
    r('guard.perfectTaken', B.guard.perfectTaken, 0, 0.3),
    r('guard.perfectUlt', B.guard.perfectUlt, 10, 35),
    r('guard.bonusShield', B.guard.bonusShield, 0, 0.15),
    r('guard.bonusHeal', B.guard.bonusHeal, 0, 0.15),
    r('guard.bonusCounter', B.guard.bonusCounter, 0, 4),
    r('guard.bonusBurn total (power × duration, × ATK)', B.guard.bonusBurnPower * B.guard.bonusBurnDuration, 0, 12),
    // Health carry: it has to matter, and never become a death spiral.
    r('run.healOnWin', B.run.healOnWin, 0.1, 0.4),
    r('run.retryHeal', B.run.retryHeal, 0.1, 0.4),
    r('run.minStartHp', B.run.minStartHp, 0.1, 0.4),
    // The road: every node is a real option, and an elite is tougher, not a boss.
    r('path.weights.fight', B.path.weights.fight, 10, 70),
    r('path.weights.elite', B.path.weights.elite, 15, 50),
    r('path.weights.shrine', B.path.weights.shrine, 10, 40),
    r('path.weights.event', B.path.weights.event, 10, 40),
    r('path.eliteHp', B.path.eliteHp, 1.5, 4),
    r('path.eliteAtk', B.path.eliteAtk, 0.9, 1.25),
    r('path.eliteXp', B.path.eliteXp, 1.2, 2),
    r('path.restHeal', B.path.restHeal, 0.2, 0.5),
    r('path.offeringCost', B.path.offeringCost, 0.1, 0.35),
  ];
  // Heavies: telegraphed hits worth guarding, never one-shots, never dead air.
  for (const loc of LOCATIONS) {
    for (const def of [...loc.enemies, loc.boss]) {
      if (!def.heavy) continue;
      out.push(r(`${def.id}.heavy.power`, def.heavy.power, 2, 6));
      out.push(r(`${def.id}.heavy.windup`, def.heavy.windup, 0.8, 1.6));
      out.push(r(`${def.id}.heavy.cooldown`, def.heavy.cooldown, 6, 14));
    }
    // No enemy gutted to make a number pass (dsh once cut elite ATK 16 → 4).
    for (const def of loc.enemies) out.push(r(`${def.id}.atk`, def.atk, 6, 30));
    out.push(r(`${loc.boss.id}.atk`, loc.boss.atk, 8, 30));
  }
  // Heroes stay heroes: no class turned into a wall or a glass cannon to pass parity.
  for (const c of CLASSES) {
    out.push(r(`${c.id}.maxHp`, c.stats.maxHp, 250, 450));
    out.push(r(`${c.id}.atk`, c.stats.atk, 20, 40));
    out.push(r(`${c.id}.armor`, c.stats.armor, 4, 16));
  }
  return out;
}

/** Rails whose value is outside its range. */
export function brokenRails(): Rail[] {
  return rails().filter((x) => x.value < x.min - 1e-9 || x.value > x.max + 1e-9);
}

export const describeRail = (x: Rail): string => `${x.path} ${+x.value.toFixed(3)} (rail ${x.min}–${x.max})`;
