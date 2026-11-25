import { BOONS, BOONS as ALL_BOONS, CLASSES, type BoonDef, type ClassDef, type ClassId, type Stats, classById, stageInfo } from './data';
import { BALANCE } from './balance';

export interface SaveData {
  version: 1;
  classId: ClassId | null;
  level: number;
  xp: number;
  stage: number;        // next stage to play (0..24); 25 = victory
  boons: string[];
  sound: boolean;
  music: boolean;
  seenIntro: boolean;
}

const SAVE_KEY = 'emberfall-save-v1';

export const defaultSave = (): SaveData => ({
  version: 1, classId: null, level: 1, xp: 0, stage: 0, boons: [],
  sound: true, music: true, seenIntro: false,
});

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.version !== 1) return defaultSave();
    const base = defaultSave();
    const classId = data.classId && CLASSES.some(c => c.id === data.classId) ? data.classId : null;
    const boons = Array.isArray(data.boons) ? data.boons.filter(id => typeof id === 'string' && ALL_BOONS.some(b => b.id === id)) : [];
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
      seenIntro: data.seenIntro === true,
    };
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
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

export function resetSave(): void {
  const keep = { sound: save.sound, music: save.music };
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
  for (const id of boonIds) {
    const b = ALL_BOONS.find(x => x.id === id);
    if (b) b.apply(s);
  }
  s.maxHp = Math.round(s.maxHp);
  s.atk = Math.round(s.atk * 10) / 10;
  s.crit = Math.min(BALANCE.hero.critCap, s.crit);
  s.dodge = Math.min(BALANCE.hero.dodgeCap, s.dodge);
  s.damageReduction = Math.min(BALANCE.hero.damageReductionCap, s.damageReduction);
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

export function completeStage(): { xp: number; levelUps: number; stageCleared: number } {
  const cleared = save.stage;
  const xp = stageRewardXp(cleared);
  updateSave({ stage: Math.min(cleared + 1, 25) });
  const levelUps = awardXp(xp);
  return { xp, levelUps, stageCleared: cleared };
}

export function pickBoonChoices(count = BALANCE.boons.offered): BoonDef[] {
  const cls = save.classId!;
  const pool = BOONS.filter(b => !b.classes || b.classes.includes(cls));
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
  updateSave({ classId: id, level: 1, xp: 0, stage: 0, boons: [] });
}
