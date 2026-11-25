/**
 * The config id in docs/balance.md: a short hash of every value that changes how the game plays.
 *
 * It covers src/balance.ts, the mechanical fields of the class and enemy tables (not names, text
 * or colours), and every boon's measured effect on a reference hero (boons are code, so their
 * effect is hashed, not their source). A result in the doc is only current for the hash it names.
 */
import { createHash } from 'node:crypto';
import { BALANCE } from '../../src/balance';
import { BOONS, CLASSES, LOCATIONS, type Stats } from '../../src/data';
import { boonEffects } from './bots';

/** Keys that describe a thing (names, text, colours) rather than how it plays. */
const FLAVOUR = new Set([
  'name', 'desc', 'icon', 'lore', 'tagline', 'title', 'colors', 'palette', 'blurb', 'subtitle',
  'stageNames', 'music', 'particle', 'passive',
]);

function mechanical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mechanical);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!FLAVOUR.has(k) && typeof v !== 'function') out[k] = mechanical(v);
    }
    return out;
  }
  return value;
}

/** A hero with round numbers, so each boon's effect shows as plain deltas. */
const REFERENCE: Stats = {
  maxHp: 300, atk: 25, armor: 10, crit: 0.1, critMult: 1.5, speed: 1.7, dodge: 0.03,
  regen: 0, lifesteal: 0, damageReduction: 0, abilityPower: 1, ultRate: 1,
};

export function balancePayload(): string {
  return JSON.stringify({
    balance: BALANCE,
    classes: mechanical(CLASSES),
    locations: mechanical(LOCATIONS),
    // The first and the third copy: a boon that diminishes with copies shows up in the second.
    boons: { first: boonEffects(REFERENCE, 0), third: boonEffects(REFERENCE, 2) },
  });
}

/** Eight hex characters; printed by `npm run balance -- check` and recorded in the doc's Status. */
export function balanceFingerprint(): string {
  return createHash('sha256').update(balancePayload()).digest('hex').slice(0, 8);
}

/** The config id recorded in a balance doc's Status section, or undefined when it has none. */
export function docFingerprint(markdown: string): string | undefined {
  const section = /##\s*Status([\s\S]*?)(?=\n##\s|$)/.exec(markdown)?.[1] ?? '';
  return /`([0-9a-f]{8})`/.exec(section)?.[1];
}
