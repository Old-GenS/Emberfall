import { CLASSES, LOCATIONS } from '../../src/data';
import type { BodyKind, ClassId } from '../../src/data';
import type { Unit } from '../../src/combat';
import { drawFinishedUnit, type UnitLight } from '../../src/sprites/index';

export interface SheetUnit {
  uid: number;
  name: string;
  side: 'hero' | 'enemy' | 'ally';
  classId?: ClassId;
  body: BodyKind;
  colors: { main: string; dark: string; glow: string; accent?: string; cloth?: string };
  boss: boolean;
  alive: true;
  effects: never[];
  shield: 0;
  scale: number;
  facing: 1 | -1;
  anim: { attack: number; hit: number; heal: number; spawn: number; cast: number };
  light: UnitLight;
}

export type Pose = 'idleA' | 'idleB' | 'attack' | 'cast';

const lightOf = (index: number): UnitLight => ({
  accent: LOCATIONS[index].palette.accent,
  ground: LOCATIONS[index].palette.ground,
});

const units: SheetUnit[] = [];

for (const c of CLASSES) {
  units.push({
    uid: units.length,
    name: c.name,
    side: 'hero',
    classId: c.id,
    body: 'knight',
    colors: {
      main: c.colors.main,
      dark: c.colors.cloth,
      glow: c.colors.glow,
      accent: c.colors.accent,
      cloth: c.colors.cloth,
    },
    boss: false,
    alive: true,
    effects: [],
    shield: 0,
    scale: 1.05,
    facing: 1,
    anim: { attack: 0, hit: 0, heal: 0, spawn: 1, cast: 0 },
    light: lightOf(0),
  });
}

for (let li = 0; li < LOCATIONS.length; li++) {
  const loc = LOCATIONS[li];
  for (const e of loc.enemies) {
    units.push({
      uid: units.length,
      name: e.name,
      side: 'enemy',
      body: e.body,
      colors: e.colors,
      boss: false,
      alive: true,
      effects: [],
      shield: 0,
      scale: 0.96 * (e.scale ?? 1),
      facing: -1,
      anim: { attack: 0, hit: 0, heal: 0, spawn: 1, cast: 0 },
      light: lightOf(li),
    });
  }
  const boss = loc.boss;
  units.push({
    uid: units.length,
    name: boss.name,
    side: 'enemy',
    body: boss.body,
    colors: boss.colors,
    boss: true,
    alive: true,
    effects: [],
    shield: 0,
    scale: 0.92 * (boss.scale ?? 1),
    facing: -1,
    anim: { attack: 0, hit: 0, heal: 0, spawn: 1, cast: 0 },
    light: lightOf(li),
  });
}

units.push({
  uid: units.length,
  name: 'Spirit Wolf',
  side: 'ally',
  body: 'wolf',
  colors: { main: '#6ef2b1', dark: '#1e5c40', glow: '#e7ffd4' },
  boss: false,
  alive: true,
  effects: [],
  shield: 0,
  scale: 0.84,
  facing: 1,
  anim: { attack: 0, hit: 0, heal: 0, spawn: 1, cast: 0 },
  light: lightOf(1),
});

const POSE_TIME: Record<Pose, number> = { idleA: 1.3, idleB: 2.45, attack: 1.3, cast: 1.3 };

function render(canvas: HTMLCanvasElement, index: number, pose: Pose): void {
  const u = units[index];
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(280, 560);
  ctx.scale(u.facing * u.scale, u.scale);
  u.anim.attack = pose === 'attack' ? 0.8 : 0;
  u.anim.cast = pose === 'cast' ? 0.8 : 0;
  u.anim.hit = 0;
  u.anim.heal = 0;
  u.anim.spawn = 1;
  drawFinishedUnit(ctx, u as unknown as Unit, POSE_TIME[pose], u.light);
  ctx.restore();
}

declare global {
  interface Window {
    spriteSheet: {
      names(): string[];
      render(canvas: HTMLCanvasElement, index: number, pose: Pose): void;
    };
  }
}

window.spriteSheet = {
  names: () => units.map((u) => u.name),
  render,
};
