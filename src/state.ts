import { BOONS, BOONS as ALL_BOONS, CLASSES, EVENTS, eventFor, nodeOffer, seededRandom, type BoonDef, type ClassDef, type ClassId, type NodeType, type Stats, classById, stageInfo } from './data';
import { BALANCE } from './balance';

export interface SaveData {
  version: 1;
  classId: ClassId | null;
  level: number;
  xp: number;
  stage: number;        // next stage to play (0..24); 25 = victory
  boons: string[];
  sound: boolean;       // false = sound effects muted
  music: boolean;       // false = music muted
  sfxVolume: number;    // 0..1, kept while muted
  musicVolume: number;  // 0..1, kept while muted
  seenIntro: boolean;
  battleSpeed: 1 | 2 | 3; // remembered battle pace, cycled by the speed button
  runSeed: number;      // seeds this run's random waves; a retry keeps it, a new run rolls a new one
  hpPct: number;        // hero health share entering the next stage, 0..1
  node: NodeType | null; // the chosen node for the current stage, null when not chosen
  /** The node played at each cleared stage index ('fight' | 'elite' | 'shrine' | 'event' | 'boss'). */
  path: string[];
}

const SAVE_KEY = 'emberfall-save-v1';

export function newRunSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export const defaultSave = (): SaveData => ({
  version: 1, classId: null, level: 1, xp: 0, stage: 0, boons: [],
  sound: true, music: true, sfxVolume: 1, musicVolume: 1, seenIntro: false, battleSpeed: 1,
  runSeed: newRunSeed(), hpPct: 1, node: null, path: [],
});

const volume = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1);

export function normalizeSave(data: Partial<SaveData>): SaveData {
  const base = defaultSave();
  const classId = data.classId && CLASSES.some(c => c.id === data.classId) ? data.classId : null;
  const boons = Array.isArray(data.boons) ? data.boons.filter(id => typeof id === 'string' && ALL_BOONS.some(b => b.id === id)) : [];
  const runSeed = typeof data.runSeed === 'number' && Number.isInteger(data.runSeed) && data.runSeed >= 0 ? data.runSeed : newRunSeed();
  const stage = Math.min(25, Math.max(0, Math.floor(Number(data.stage) || 0)));
  const validNode = data.node === 'fight' || data.node === 'elite' || data.node === 'shrine' || data.node === 'event' ? data.node : null;
  const pathEntries = ['fight', 'elite', 'shrine', 'event', 'boss'];
  const pathValid = Array.isArray(data.path) && data.path.length === stage
    && data.path.every((p, i) => typeof p === 'string' && pathEntries.includes(p) && (i % 5 === 4 ? p === 'boss' : p !== 'boss'));
  const path = pathValid
    ? (data.path as string[])
    : Array.from({ length: stage }, (_, i) => (i % 5 === 4 ? 'boss' : 'fight'));
  return {
    ...base,
    ...data,
    classId,
    level: Math.min(BALANCE.hero.maxLevel, Math.max(1, Number(data.level) || 1)),
    xp: Math.max(0, Number(data.xp) || 0),
    stage,
    boons,
    sound: data.sound !== false,
    music: data.music !== false,
    sfxVolume: volume(data.sfxVolume),
    musicVolume: volume(data.musicVolume),
    seenIntro: data.seenIntro === true,
    battleSpeed: data.battleSpeed === 1 || data.battleSpeed === 2 || data.battleSpeed === 3 ? data.battleSpeed : 1,
    runSeed,
    hpPct: typeof data.hpPct === 'number' && Number.isFinite(data.hpPct) ? Math.min(1, Math.max(0, data.hpPct)) : 1,
    node: validNode,
    path,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SAVE_KEY) : null;
    if (!raw) return defaultSave();
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.version !== 1) return defaultSave();
    return normalizeSave(data);
  } catch {
    return defaultSave();
  }
}

let save = loadSave();
const listeners = new Set<() => void>();

export const getSave = (): SaveData => save;
export const hasHero = (): boolean => save.classId !== null;

export function updateSave(patch: Partial<SaveData>, persist = true): void {
  save = { ...save, ...patch };
  if (persist) persistSave();
  listeners.forEach(l => l());
}

export function persistSave(): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

export function resetSave(): void {
  const keep = { sound: save.sound, music: save.music, sfxVolume: save.sfxVolume, musicVolume: save.musicVolume, battleSpeed: save.battleSpeed };
  save = { ...defaultSave(), ...keep };
  persistSave();
  listeners.forEach(l => l());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ------------------------------ Progression ------------------------------- */

export const xpToNext = (level: number): number => BALANCE.xp.toNextBase + level * BALANCE.xp.toNextPerLevel;

export function xpProgress(): { cur: number; need: number; pct: number } {
  const need = xpToNext(save.level);
  return { cur: save.xp, need, pct: Math.min(1, save.xp / need) };
}

/** Awards XP; returns number of levels gained. */
export function awardXp(amount: number): number {
  let gained = 0;
  let xp = save.xp + amount;
  let level = save.level;
  while (xp >= xpToNext(level) && level < BALANCE.hero.maxLevel) {
    xp -= xpToNext(level);
    level++;
    gained++;
  }
  updateSave({ xp, level });
  return gained;
}

export function heroStats(): Stats {
  const cls = save.classId ? classById(save.classId) : CLASSES[0];
  return statsFor(cls, save.level, save.boons);
}

export function statsFor(cls: ClassDef, level: number, boonIds: string[]): Stats {
  const lvl = Math.max(0, level - 1);
  const s: Stats = {
    ...cls.stats,
    maxHp: Math.round(cls.stats.maxHp * (1 + lvl * BALANCE.hero.hpPerLevel)),
    atk: Math.round(cls.stats.atk * (1 + lvl * BALANCE.hero.atkPerLevel) * 10) / 10,
  };
  const seen = new Map<string, number>();
  for (const id of boonIds) {
    const b = ALL_BOONS.find(x => x.id === id);
    if (!b) continue;
    const copies = seen.get(id) ?? 0;
    seen.set(id, copies + 1);
    b.apply(s, copies);
  }
  s.maxHp = Math.round(s.maxHp);
  s.atk = Math.round(s.atk * 10) / 10;
  s.crit = Math.min(BALANCE.hero.critCap, s.crit);
  s.dodge = Math.min(BALANCE.hero.dodgeCap, s.dodge);
  s.damageReduction = Math.min(BALANCE.hero.damageReductionCap, s.damageReduction);
  s.ultRate = Math.min(BALANCE.hero.ultRateCap, s.ultRate);
  return s;
}

/* -------------------------------- Rewards --------------------------------- */

let pendingReward: { xp: number; levelUps: number; stageCleared: number } | null = null;

export function stageRewardXp(globalStage: number): number {
  const { stageBase, perStage, bossBonus } = BALANCE.xp;
  return stageBase + globalStage * perStage + (globalStage % 5 === 4 ? bossBonus : 0);
}

export function setPendingReward(r: { xp: number; levelUps: number; stageCleared: number }): void {
  pendingReward = r;
}
export function takePendingReward() {
  const r = pendingReward;
  pendingReward = null;
  return r;
}

export function completeStage(endHpPct = 1): { xp: number; levelUps: number; stageCleared: number } {
  const cleared = save.stage;
  const node = currentNode();
  const share = node === 'elite' ? BALANCE.path.eliteXp : 1;
  const xp = stageRewardXp(cleared) * share;
  const hpPct = cleared % 5 === 4 ? 1 : Math.min(1, Math.max(0, endHpPct) + BALANCE.run.healOnWin);
  updateSave({ stage: Math.min(cleared + 1, 25), hpPct, path: [...save.path, node ?? 'fight'], node: null });
  const levelUps = awardXp(xp);
  return { xp, levelUps, stageCleared: cleared };
}

/* ----------------------------- Branching path ----------------------------- */

/** The node for the current stage: a fixed fight / boss, or the player's chosen node. */
export function currentNode(): NodeType | 'boss' | null {
  if (save.stage >= 25) return null;
  const step = save.stage % 5;
  if (step === 0) return 'fight';
  if (step === 4) return 'boss';
  return save.node;
}

/** Steps 1-3, before the player has picked the next stop. */
export function needsPathChoice(): boolean {
  if (save.stage >= 25) return false;
  const step = save.stage % 5;
  return step >= 1 && step <= 3 && save.node === null;
}

/** Picks one of the two offered nodes. False when it is not on offer. */
export function choosePath(node: NodeType): boolean {
  if (!needsPathChoice()) return false;
  if (!nodeOffer(save.stage, save.runSeed).includes(node)) return false;
  updateSave({ node });
  return true;
}

export function shrineRest(): void {
  updateSave({ hpPct: Math.min(1, save.hpPct + BALANCE.path.restHeal) });
}

export function shrineOffering(): void {
  updateSave({ hpPct: Math.max(BALANCE.path.hpFloor, save.hpPct - BALANCE.path.offeringCost) });
}

/** Applies an event choice's health effect and returns the text and reward the UI must show next. */
export function resolveEvent(choiceId: string): { text: string; boon: null | 'rare' | 'epic'; xpShare: number } {
  const event = eventFor(save.stage, save.runSeed);
  const share = BALANCE.path.nonCombatXp;
  const floor = BALANCE.path.hpFloor;
  if (event.id === 'merchant') {
    if (choiceId === 'trade') {
      updateSave({ hpPct: Math.max(floor, save.hpPct - 0.25) });
      return { text: 'The merchant drinks what you offer and presses a cold glass card into your hand. "A fair trade," it says, smiling with too many teeth.', boon: 'rare', xpShare: share };
    }
    return { text: 'The merchant watches you go, already counting someone else’s blood.', boon: null, xpShare: share };
  }
  if (event.id === 'reliquary') {
    if (choiceId === 'open') {
      const rand = seededRandom(save.runSeed * 29 + save.stage * 977 + 11);
      if (rand() < 0.5) {
        return { text: 'The lid gives way. Light pours out and settles in your chest like a second heartbeat. The reliquary is empty; you are not.', boon: 'epic', xpShare: share };
      }
      updateSave({ hpPct: Math.max(floor, save.hpPct - 0.3) });
      return { text: 'Smoke claws out of the glass and drinks deep before it fades. Whatever was inside is gone — and it took something of you with it.', boon: null, xpShare: share };
    }
    return { text: 'You leave the reliquary humming behind you. It sounds almost disappointed.', boon: null, xpShare: share };
  }
  if (choiceId === 'tend') {
    return { text: 'You bind the pilgrim’s wound with clean linen and a little of your own fire. They press a worn map into your hand: the road ahead, marked in full.', boon: null, xpShare: 1 };
  }
  updateSave({ hpPct: Math.min(1, save.hpPct + 0.2) });
  return { text: 'You kneel beside the pilgrim and pray to whatever still listens. Warmth returns to your limbs, slow as dawn.', boon: null, xpShare: share };
}

/** Ends a shrine or event: awards reduced XP, records the node and advances the stage. */
export function completeNonCombat(xpShare?: number): { xp: number; levelUps: number; stageCleared: number } {
  const cleared = save.stage;
  const node = save.node ?? 'fight';
  const xp = stageRewardXp(cleared) * (xpShare ?? BALANCE.path.nonCombatXp);
  updateSave({ stage: Math.min(cleared + 1, 25), path: [...save.path, node], node: null });
  const levelUps = awardXp(xp);
  return { xp, levelUps, stageCleared: cleared };
}

/** Health share the next attempt at the current stage starts with, given the incoming Rally value. */
export function startHpPct(rally: number): number {
  const defeats = Math.max(0, Math.round((rally - 1) / BALANCE.rally.step));
  return Math.min(1, Math.max(BALANCE.run.minStartHp, save.hpPct + defeats * BALANCE.run.retryHeal));
}

const RARITY_RANK: Record<BoonDef['rarity'], number> = { common: 0, rare: 1, epic: 2 };

export function pickBoonChoices(count = BALANCE.boons.offered, exclude: string[] = [], minRarity?: 'rare' | 'epic'): BoonDef[] {
  const cls = save.classId!;
  const all = BOONS.filter(b => (!b.classes || b.classes.includes(cls))
    && (!minRarity || RARITY_RANK[b.rarity] >= RARITY_RANK[minRarity]));
  // A reroll avoids the cards just shown, unless that would leave too few to fill the hand.
  const fresh = all.filter(b => !exclude.includes(b.id));
  const pool = fresh.length >= count ? fresh : all;
  const weights: Record<string, number> = BALANCE.boons.weight;
  const chosen: BoonDef[] = [];
  const available = [...pool];
  while (chosen.length < count && available.length) {
    const total = available.reduce((a, b) => a + weights[b.rarity], 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < available.length; i++) {
      r -= weights[available[i].rarity];
      if (r <= 0) { idx = i; break; }
    }
    chosen.push(available.splice(idx, 1)[0]);
  }
  return chosen;
}

export function applyBoon(id: string): void {
  updateSave({ boons: [...save.boons, id] });
}

export function levelLabel(level: number): string {
  const titles = ['Wanderer', 'Wayfarer', 'Keeper', 'Champion', 'Luminary', 'Myth'];
  return titles[Math.min(titles.length - 1, Math.floor((level - 1) / 4))];
}

export function currentLocation() {
  return stageInfo(Math.min(save.stage, 24));
}

export function isVictory(): boolean {
  return save.stage >= 25;
}

export function selectClass(id: ClassId): void {
  updateSave({ classId: id, level: 1, xp: 0, stage: 0, boons: [], runSeed: newRunSeed(), hpPct: 1, node: null, path: [] });
}
