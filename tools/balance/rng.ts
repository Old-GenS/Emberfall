/**
 * Seeded dice. The game rolls through Math.random() (crits, dodges, damage variance, first-attack
 * timing, boon offers), so a harness run is made replayable by replacing Math.random with a
 * seeded generator before a run starts. Nothing in the game code has to know about this.
 */

/** mulberry32: small, fast, good enough for a game sim, and identical across platforms. */
export function seedRandom(seed: number): void {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 32-bit seed from a few run identifiers (FNV-1a), so "regular/warden/7" always plays the same. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    for (const ch of String(part)) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x1f;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
