import { BOONS, BOONS as ALL_BOONS, CLASSES, type BoonDef, type ClassDef, type ClassId, type Stats, classById, stageInfo } from './data';
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
}

const SAVE_KEY = 'emberfall-save-v1';

export function newRunSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export const defaultSave = (): SaveData => ({
  version: 1, classId: null, level: 1, xp: 0, stage: 0, boons: [],
  sound: true, music: true, sfxVolume: 1, musicVolume: 1, seenIntro: false, battleSpeed: 1,
  runSeed: newRunSeed(), hpPct: 1,
});

const volume = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1);

export function normalizeSave(data: Partial<SaveData>): SaveData {
  const base = defaultSave();
  const classId = data.classId && CLASSES.some(c => c.id === data.classId) ? data.classId : null;
  const boons = Array.isArray(data.boons) ? data.boons.filter(id => typeof id === 'string' && ALL_BOONS.some(b => b.id === id)) : [];
  const runSeed = typeof data.runSeed === 'number' && Number.isInteger(data.runSeed) && data.runSeed >= 0 ? data.runSeed : newRunSeed();
  return {
    ...base,
    ...data,
    classId,
    level: Math.min(BALANCE.hero.maxLevel, Math.max(1, Number(data.level) || 1)),
    xp: Math.max(0, Number(data.xp) || 0),
    stage: Math.min(25, Math.max(0, Math.floor(Number(data.stage) || 0))),
    boons,
    sound: data.sound !== false,
    music: data.music !== false,
    sfxVolume: volume(data.sfxVolume),
    musicVolume: volume(data.musicVolume),
    seenIntro: data.seenIntro === true,
    battleSpeed: data.battleSpeed === 1 || data.battleSpeed === 2 || data.battleSpeed === 3 ? data.battleSpeed : 1,
    runSeed,
    hpPct: typeof data.hpPct === 'number' && Number.isFinite(data.hpPct) ? Math.min(1, Math.max(0, data.hpPct)) : 1,
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
  const xp = stageRewardXp(cleared);
  const hpPct = cleared % 5 === 4 ? 1 : Math.min(1, Math.max(0, endHpPct) + BALANCE.run.healOnWin);
  updateSave({ stage: Math.min(cleared + 1, 25), hpPct });
  const levelUps = awardXp(xp);
  return { xp, levelUps, stageCleared: cleared };
}

/** Health share the next attempt at the current stage starts with, given the incoming Rally value. */
export function startHpPct(rally: number): number {
  const defeats = Math.max(0, Math.round((rally - 1) / BALANCE.rally.step));
  return Math.min(1, Math.max(BALANCE.run.minStartHp, save.hpPct + defeats * BALANCE.run.retryHeal));
}

export function pickBoonChoices(count = BALANCE.boons.offered, exclude: string[] = []): BoonDef[] {
  const cls = save.classId!;
  const all = BOONS.filter(b => !b.classes || b.classes.includes(cls));
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
  updateSave({ classId: id, level: 1, xp: 0, stage: 0, boons: [], runSeed: newRunSeed(), hpPct: 1 });
}
