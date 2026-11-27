import { enrageMultiplier, type Battle, type CombatEvent, type Unit } from './combat';
import { type ClassDef, type LocationDef } from './data';
import type { RealmEvents } from './realm-events';
import { drawFinishedUnit, drawGothicHalo, type UnitLight } from './sprites/index';

export const DESIGN_W = 960;
export const DESIGN_H = 540;

const ASSET_BASE = './assets';

/* ------------------------- Preloaded Backdrop Cache ------------------------ */

const realmImages = new Map<string, HTMLImageElement>();

function getRealmImage(locId: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let img = realmImages.get(locId);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = `${ASSET_BASE}/realms/${locId}.jpg`;
    realmImages.set(locId, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

const FIRE_COLOR = '#ff9442';
/** Bursts that look right at any angle get a random rotation and a slow spin. */
const ROUND_FX = new Set<FxSpriteName>(['fire-burst', 'frost-shatter', 'shadow-strike', 'spirit-wisp', 'ult-explosion']);
/** Painted impact for each ability colour from abilityColor(). */
const IMPACT_BY_COLOR: Record<string, FxSpriteName> = {
  [FIRE_COLOR]: 'fire-burst',
  '#9fe8ff': 'frost-shatter',
  '#8dffc2': 'spirit-wisp',
  '#ffd77a': 'holy-flare',
  '#b48cff': 'shadow-strike',
  '#ff7ad9': 'shadow-strike',
};

/* ------------------------- Painted effect sprites ------------------------- */

/** Painted effects on pure black (public/assets/fx), drawn additively so black vanishes. */
export const FX_SPRITES = [
  'fire-burst', 'slash', 'slash-heavy', 'frost-shatter', 'holy-flare', 'shadow-strike',
  'spirit-wisp', 'heal-bloom', 'shield-ring', 'crit-star', 'ult-explosion',
] as const;
export type FxSpriteName = (typeof FX_SPRITES)[number];
const fxImages = new Map<string, HTMLImageElement>();

function getFxImage(name: FxSpriteName): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let img = fxImages.get(name);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = `${ASSET_BASE}/fx/${name}.webp`;
    fxImages.set(name, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** Eagerly warm all 5 realm backdrops & portraits once the browser is idle. */
export function preloadArtAssets(): void {
  if (typeof Image === 'undefined') return;
  const realms = ['ashen-reach', 'whisperwood', 'frostveil', 'sunken-sanctum', 'ember-throne'];
  const heroes = ['warden', 'pyromancer', 'shadowblade', 'spiritcaller'];
  for (const r of realms) getRealmImage(r);
  for (const f of FX_SPRITES) getFxImage(f);
  for (const h of heroes) {
    const img = new Image();
    img.decoding = 'async';
    img.src = `${ASSET_BASE}/portraits/${h}.jpg`;
  }
}

/* --------------------- Tarot Portraits & Realm Banners --------------------- */

const ROMAN_BY_CLASS: Record<string, string> = {
  warden: 'I',
  pyromancer: 'II',
  shadowblade: 'III',
  spiritcaller: 'IV',
};

/**
 * Renders the hero's illustrated Gothic Tarot & Stained-Glass portrait
 * framed with fractured gold-leaf filigree corners.
 */
export function classPortraitSVG(cls: ClassDef, decorative = true): string {
  const c = cls.colors;
  const numeral = ROMAN_BY_CLASS[cls.id] ?? 'I';
  const src = `${ASSET_BASE}/portraits/${cls.id}.jpg`;
  return `<div class="portrait-svg tarot-portrait ${decorative ? 'is-card' : 'is-medallion'}" style="--hero-main:${c.main};--hero-glow:${c.glow}" role="img" aria-label="${cls.name}">
    <img src="${src}" alt="${cls.name} — ${cls.title}" loading="eager" decoding="async" />
    ${decorative ? `<svg class="tarot-filigree" viewBox="0 0 200 240" preserveAspectRatio="none" aria-hidden="true">
      <path d="M8 28 L8 8 L28 8 M172 8 L192 8 L192 28 M8 212 L8 232 L28 232 M172 232 L192 232 L192 212" fill="none" stroke="${c.main}" stroke-width="1.8" stroke-opacity="0.72"/>
      <path d="M14 14 L22 14 L14 22 Z M186 14 L178 14 L186 22 Z" fill="${c.main}" fill-opacity="0.55"/>
      <line x1="34" y1="8" x2="166" y2="8" stroke="${c.main}" stroke-opacity="0.28" stroke-width="1"/>
      <path d="M100 3 L105 8 L100 13 L95 8 Z" fill="${c.main}" fill-opacity="0.85"/>
    </svg>
    <span class="tarot-numeral" aria-hidden="true">${numeral}</span>` : ''}
  </div>`;
}

/**
 * Renders a Gothic Stained-Glass Realm Banner using the illustrated realm stage art.
 */
export function locationEmblemSVG(loc: LocationDef): string {
  const p = loc.palette;
  const src = `${ASSET_BASE}/realms/${loc.id}.jpg`;
  return `<div class="loc-svg realm-illust" style="--realm-accent:${p.accent};background:${p.skyTop}" aria-hidden="true">
    <img src="${src}" alt="" loading="lazy" decoding="async" />
    <svg class="realm-filigree" viewBox="0 0 170 130" preserveAspectRatio="none">
      <rect x="3" y="3" width="164" height="124" fill="none" stroke="${p.accent}" stroke-opacity="0.32" stroke-width="1.2"/>
      <path d="M3 18 L18 3 M152 3 L167 18 M3 112 L18 127 M152 127 L167 112" stroke="${p.accent}" stroke-opacity="0.55" stroke-width="1.4"/>
    </svg>
  </div>`;
}

/* ------------------------ Fallback Gothic Canvas BG ------------------------ */

function buildFallbackBackground(loc: LocationDef): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = DESIGN_W;
  c.height = DESIGN_H;
  const g = c.getContext('2d')!;
  const p = loc.palette;
  const sky = g.createLinearGradient(0, 0, 0, DESIGN_H);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(0.68, p.skyBottom);
  sky.addColorStop(1, '#050409');
  g.fillStyle = sky;
  g.fillRect(0, 0, DESIGN_W, DESIGN_H);
  g.fillStyle = p.ground;
  g.fillRect(0, 395, DESIGN_W, 145);
  return c;
}

/* ----------------------- Bespoke VFX Data Structures ----------------------- */

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number;
  size: number; color: string; gravity: number;
  kind: 'spark' | 'ember' | 'smoke' | 'heal' | 'ring' | 'soul' | 'shard';
}

interface SlashArc {
  x: number; y: number; radius: number; angle: number; sweep: number;
  color: string; glow: string; life: number; maxLife: number; dir: number;
}

interface SpellBolt {
  x0: number; y0: number; x1: number; y1: number;
  color: string; glow: string; life: number; maxLife: number; size: number;
}

interface SkyPillar {
  x: number; y: number; width: number; color: string; glow: string;
  life: number; maxLife: number; meteor?: boolean;
}

interface BriarEruption {
  x: number; y: number; color: string; glow: string; life: number; maxLife: number; seed: number;
}

interface ExecutionMark {
  x: number; y: number; color: string; life: number; maxLife: number;
}

interface FxSprite {
  name: FxSpriteName; x: number; y: number; size: number; rot: number; spin: number;
  flip: boolean; life: number; maxLife: number; delay: number; grow: number;
}

interface Floater {
  x: number; y: number; text: string; color: string; life: number; maxLife: number;
  size: number; vy: number; banner?: boolean;
}

interface Ambient {
  x: number; y: number; vx: number; vy: number; size: number; phase: number; speed: number;
}

/* ------------------------------ SceneRenderer ------------------------------ */

export class SceneRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  private fallbackBg: HTMLCanvasElement | null = null;
  private bgLocId = '';
  private battle: Battle | null = null;
  location: LocationDef | null = null;
  private realmEvents: RealmEvents | null = null;
  /** Battle time at which enrage first became visible; null until then. */
  enrageStartedAt: number | null = null;
  /** Latest enrage damage multiplier, refreshed every frame. */
  private enrage = 1;

  private particles: Particle[] = [];
  private slashes: SlashArc[] = [];
  private bolts: SpellBolt[] = [];
  private pillars: SkyPillar[] = [];
  private briars: BriarEruption[] = [];
  private marks: ExecutionMark[] = [];
  private floaters: Floater[] = [];
  private fxSprites: FxSprite[] = [];
  private fxThrottle = new Map<string, number>();
  /** Seconds of hit-stop requested by a big hit; main.ts holds battle time while it runs down. */
  hitStop = 0;
  private ambient: Ambient[] = [];

  private shake = 0;
  private flash = 0;
  private vignettePulse = 0;
  private vignetteColor = '233,196,106';
  private floatStacks = new Map<number, { time: number; count: number }>();
  private flashColor = '255,255,255';
  private time = 0;
  speed = 1;
  private mobileView = false;
  private onResize = () => this.resize();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    preloadArtAssets();
    this.resize();
    window.addEventListener('resize', this.onResize);
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.mobileView = rect.width < 560;
  }

  setLocation(loc: LocationDef): void {
    if (this.bgLocId !== loc.id) {
      this.location = loc;
      getRealmImage(loc.id);
      this.fallbackBg = buildFallbackBackground(loc);
      this.bgLocId = loc.id;
      this.ambient = Array.from({ length: 60 }, () => this.newAmbient(true));
    }
  }

  setBattle(battle: Battle): void {
    this.battle = battle;
    this.enrageStartedAt = null;
    this.fxSprites = [];
    this.fxThrottle.clear();
    this.hitStop = 0;
    this.enrage = enrageMultiplier(battle.elapsed);
  }

  setRealmEvents(ev: RealmEvents | null): void {
    this.realmEvents = ev;
  }

  /** Convert a pointer's client coordinates to the 960x540 design space used by draw(). */
  toDesign(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const s = Math.min(cw / DESIGN_W, ch / DESIGN_H);
    const ox = (cw - DESIGN_W * s) / 2;
    const oy = ch - DESIGN_H * s;
    const px = (clientX - rect.left) * (cw / Math.max(1, rect.width));
    const py = (clientY - rect.top) * (ch / Math.max(1, rect.height));
    return { x: (px - ox) / s, y: (py - oy) / s };
  }

  /** Convert a design-space point to client coordinates. */
  toClient(x: number, y: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const s = Math.min(cw / DESIGN_W, ch / DESIGN_H);
    const ox = (cw - DESIGN_W * s) / 2;
    const oy = ch - DESIGN_H * s;
    return {
      x: rect.left + (x * s + ox) * (rect.width / Math.max(1, cw)),
      y: rect.top + (y * s + oy) * (rect.height / Math.max(1, ch)),
    };
  }

  private newAmbient(initial = false): Ambient {
    const kind = this.location?.particle ?? 'ember';
    const x = Math.random() * DESIGN_W;
    if (kind === 'snow') return { x, y: initial ? Math.random() * DESIGN_H : -10, vx: -14 - Math.random() * 22, vy: 20 + Math.random() * 34, size: 1.2 + Math.random() * 2.4, phase: Math.random() * 6.28, speed: 1 + Math.random() * 2 };
    if (kind === 'bubble') return { x, y: initial ? 180 + Math.random() * 360 : 548, vx: Math.random() * 8 - 4, vy: -14 - Math.random() * 24, size: 1.5 + Math.random() * 3.2, phase: Math.random() * 6.28, speed: 1 + Math.random() * 2 };
    if (kind === 'spore') return { x, y: initial ? Math.random() * DESIGN_H : 540, vx: (Math.random() - 0.5) * 12, vy: -5 - Math.random() * 14, size: 1.4 + Math.random() * 2.4, phase: Math.random() * 6.28, speed: 0.6 + Math.random() };
    return { x, y: initial ? Math.random() * DESIGN_H : 548, vx: (Math.random() - 0.5) * 16, vy: -22 - Math.random() * 38, size: 1.3 + Math.random() * 2.6, phase: Math.random() * 6.28, speed: 1.2 + Math.random() * 2.5 };
  }

  unitPosition(u: Unit): { x: number; y: number; scale: number } {
    const battle = this.battle;
    if (!battle || !this.location) return { x: 480, y: 456, scale: 1 };
    const boost = this.mobileView ? 1.22 : 1;
    if (u.side === 'hero') return { x: 226, y: 458, scale: 1.05 * boost };
    if (u.side === 'ally') {
      const i = Math.max(0, battle.allies.indexOf(u));
      return { x: 382 + i * 64, y: 468, scale: 0.84 * boost };
    }
    const i = battle.enemies.indexOf(u);
    const n = battle.enemies.length;
    const baseXs = n <= 1 ? [726] : n === 2 ? [710, 842] : [622, 744, 858];
    const x = baseXs[i] ?? 700 + i * 100;
    const y = 452 + (i % 2) * 16;
    return { x, y, scale: (u.boss ? 0.92 : 0.96) * (u.scale ?? 1) * boost };
  }

  private primaryFoeOf(source: Unit): Unit | undefined {
    if (!this.battle) return undefined;
    if (source.side === 'enemy') return this.battle.hero;
    const foes = this.battle.enemies.filter(e => e.alive);
    if (!foes.length) return undefined;
    return foes.reduce((a, b) => (a.hp < b.hp ? a : b));
  }

  onEvent(e: CombatEvent): void {
    if (!this.battle) return;
    switch (e.type) {
      case 'damage': {
        const pos = this.unitPosition(e.target);
        const srcPos = this.unitPosition(e.source);
        const facing = e.source.side === 'enemy' ? -1 : 1;
        const color = e.kind === 'dot' ? '#9bffb8' : e.crit ? '#ffe082' : e.kind === 'thorns' ? '#d4b8ff' : '#fff3e0';

        // Crisp weapon slash arc on direct melee hits!
        if (e.kind === 'attack' && getFxImage('slash')) {
          this.spawnFx('slash', pos.x - facing * 6, pos.y - 78 * pos.scale, (e.crit ? 170 : 128) * pos.scale, {
            flip: facing < 0, rot: (Math.random() - 0.5) * 0.5, life: e.crit ? 0.4 : 0.32,
          });
        } else if (e.kind === 'attack') {
          const slashCol = e.source.colors.main ?? '#ffe29a';
          const slashGlow = e.source.colors.glow ?? '#ffae42';
          this.slashes.push({
            x: pos.x - facing * 8,
            y: pos.y - 74 * pos.scale,
            radius: (e.crit ? 68 : 50) * pos.scale,
            angle: facing > 0 ? -0.65 : Math.PI - 0.65,
            sweep: 1.45,
            color: e.crit ? '#fff3c4' : slashCol,
            glow: slashGlow,
            life: 0.28,
            maxLife: 0.28,
            dir: facing,
          });
        }

        if (e.amount < 0.5) {
          this.damageFloater(e.target.uid, pos.x, pos.y - 154 * pos.scale - 48, 'WARDED', '#ffe09a', 15, -28);
        } else {
          const fontScale = this.enrageFontScale();
          this.damageFloater(
            e.target.uid,
            pos.x,
            pos.y - 154 * pos.scale - 48,
            e.crit ? `${Math.round(e.amount)}!` : `${Math.round(e.amount)}`,
            color,
            (e.crit ? 31 : e.kind === 'ult' ? 27 : 20) * fontScale,
            e.crit ? -60 : -44,
          );
        }

        const burst = e.kind === 'dot' ? 3 : e.kind === 'ult' ? 22 : e.crit ? 15 : 8;
        for (let i = 0; i < burst; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 35 + Math.random() * (e.crit ? 210 : 115);
          this.particles.push({
            x: pos.x + (Math.random() - 0.5) * 20,
            y: pos.y - 76 * pos.scale + (Math.random() - 0.5) * 38,
            vx: Math.cos(a) * sp + (pos.x > srcPos.x ? 25 : -25),
            vy: Math.sin(a) * sp - 36,
            life: 0.42 + Math.random() * 0.45,
            maxLife: 0.88,
            size: 1.8 + Math.random() * 2.8,
            color: e.kind === 'dot' ? '#8dffc2' : e.crit ? '#ffd86b' : '#ffd9b0',
            gravity: 270,
            kind: e.crit ? 'shard' : 'spark',
          });
        }
        if (e.crit) this.spawnFx('crit-star', pos.x, pos.y - 96 * pos.scale, 150 * pos.scale, { life: 0.36, grow: 0.5, rot: Math.random() * 0.6 });
        if (e.kind === 'ult' && this.throttle(`ult:${e.target.uid}`, 0.35)) {
          this.spawnFx('ult-explosion', pos.x, pos.y - 70 * pos.scale, 280 * pos.scale, { life: 0.7, grow: 0.7 });
        }
        if (e.kind !== 'dot') {
          // A tiny freeze sells the weight of crits and ultimates.
          if (e.crit || e.kind === 'ult') this.hitStop = Math.max(this.hitStop, e.kind === 'ult' ? 0.09 : 0.055);
          this.shake = Math.max(this.shake, e.crit ? 8 : e.kind === 'ult' ? 13 : 3);
          this.flash = Math.max(this.flash, e.crit ? 0.11 : 0.035);
          this.flashColor = e.kind === 'ult' ? '255,175,85' : e.crit ? '255,230,170' : '255,240,220';
          if (e.crit) {
            this.vignettePulse = Math.max(this.vignettePulse, 0.55);
            this.vignetteColor = '233,196,106';
          }
        }
        break;
      }
      case 'heal': {
        const pos = this.unitPosition(e.target);
        this.damageFloater(e.target.uid, pos.x, pos.y - 154 * pos.scale - 48, `+${Math.round(e.amount)}`, '#8dffc2', 21, -46);
        if (this.throttle(`heal:${e.target.uid}`, 1.2)) this.spawnFx('heal-bloom', pos.x, pos.y - 40 * pos.scale, 130 * pos.scale, { life: 0.9, grow: 0.5 });
        for (let i = 0; i < 10; i++) {
          this.particles.push({
            x: pos.x + (Math.random() - 0.5) * 52, y: pos.y - 26 - Math.random() * 76,
            vx: (Math.random() - 0.5) * 18, vy: -34 - Math.random() * 42,
            life: 0.65 + Math.random() * 0.5, maxLife: 1.15, size: 2 + Math.random() * 2.2,
            color: '#8dffc2', gravity: -32, kind: 'heal',
          });
        }
        break;
      }
      case 'shield': {
        const pos = this.unitPosition(e.target);
        this.ring(pos.x, pos.y - 74, '#ffe29a', 0.65, 58);
        this.spawnFx('shield-ring', pos.x, pos.y - 78 * pos.scale, 210 * pos.scale, { life: 0.7, grow: 0.35, spin: 0.4 });
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          this.particles.push({
            x: pos.x + Math.cos(a) * 40, y: pos.y - 78 + Math.sin(a) * 58,
            vx: Math.cos(a) * 22, vy: Math.sin(a) * 22,
            life: 0.55, maxLife: 0.55, size: 2.2, color: '#ffe09a', gravity: 0, kind: 'shard',
          });
        }
        break;
      }
      case 'dodge': {
        const pos = this.unitPosition(e.target);
        this.damageFloater(e.target.uid, pos.x, pos.y - 154 * pos.scale - 48, 'EVADED', '#d5cef0', 17, -32);
        break;
      }
      case 'cast': {
        this.choreographAbility(e.source, e.ability.id, e.ability.name, e.ability.icon, e.ult || e.ability.cooldown === 0);
        break;
      }
      case 'summon': {
        const pos = this.unitPosition(e.unit);
        this.pillars.push({ x: pos.x, y: pos.y, width: 64, color: '#8dffc2', glow: '#3ddc97', life: 0.7, maxLife: 0.7 });
        this.ring(pos.x, pos.y - 36, '#8dffc2', 0.85, 72);
        break;
      }
      case 'death': {
        const pos = this.unitPosition(e.unit);
        for (let i = 0; i < 20; i++) {
          const a = Math.random() * Math.PI * 2;
          this.particles.push({
            x: pos.x + (Math.random() - 0.5) * 26, y: pos.y - 64,
            vx: Math.cos(a) * 52, vy: Math.sin(a) * 46 - 58,
            life: 0.85 + Math.random() * 0.7, maxLife: 1.55, size: 2.2 + Math.random() * 2.6,
            color: e.unit.side === 'enemy' ? e.unit.colors.glow : '#ffe29a', gravity: -24, kind: 'soul',
          });
        }
        this.floaterAt(pos.x, pos.y - 142, 'VANQUISHED', '#cbbce6', 13);
        break;
      }
      case 'end':
        this.flash = e.victory ? 0.28 : 0.22;
        this.flashColor = e.victory ? '255,220,150' : '180,35,55';
        break;
    }
  }

  /** Bespoke per-skill visual choreography replacing identical expanding rings! */
  private choreographAbility(source: Unit, id: string, name: string, iconName: string, isUlt: boolean): void {
    if (!this.battle) return;
    const src = this.unitPosition(source);
    const facing = source.side === 'enemy' ? -1 : 1;
    const col = this.abilityColor(name + ' ' + iconName);
    const target = this.primaryFoeOf(source);
    const tgt = target ? this.unitPosition(target) : { x: src.x + facing * 380, y: src.y, scale: 1 };
    const aliveFoes = source.side === 'enemy' ? [this.battle.hero] : this.battle.enemies.filter(f => f.alive);

    if (isUlt) {
      this.flash = 0.28;
      this.flashColor = '255,195,120';
      this.shake = 11;
      this.vignettePulse = 0.95;
      this.vignetteColor = '233,180,85';
      this.floaters.push({
        x: DESIGN_W / 2,
        y: 84,
        text: `✦ ${name.toUpperCase()} ✦`,
        color: '#ffe8ad',
        life: 1.65,
        maxLife: 1.65,
        size: 24,
        vy: -8,
        banner: true,
      });
    } else if (source.side === 'hero') {
      this.floaters.push({ x: src.x, y: src.y + 30, text: name, color: col, life: 1.35, maxLife: 1.35, size: 14, vy: -10 });
    }

    // 1. FALLEN STAR (Meteor Ultimate)
    if (id === 'meteor') {
      for (const f of aliveFoes) {
        const fp = this.unitPosition(f);
        this.pillars.push({ x: fp.x, y: fp.y, width: 88, color: '#ffb347', glow: '#ff4e22', life: 0.85, maxLife: 0.85, meteor: true });
        this.spawnFx('fire-burst', fp.x, fp.y - 60 * fp.scale, 250 * fp.scale, { delay: 0.32, life: 0.8 });
      }
      return;
    }

    // 2. DEATH MARK (Shadowblade Ultimate — Crimson/Jade Execution Tarot Cross!)
    if (id === 'death-mark') {
      this.marks.push({ x: tgt.x, y: tgt.y - 82 * tgt.scale, color: '#ff4d79', life: 0.85, maxLife: 0.85 });
      this.spawnFx('shadow-strike', tgt.x, tgt.y - 82 * tgt.scale, 260 * tgt.scale, { delay: 0.12, life: 0.75, spin: 0.6 });
      this.slashes.push({ x: tgt.x, y: tgt.y - 80 * tgt.scale, radius: 92, angle: -0.8, sweep: 1.7, color: '#7df2c0', glow: '#b48cff', life: 0.42, maxLife: 0.42, dir: 1 });
      this.slashes.push({ x: tgt.x, y: tgt.y - 80 * tgt.scale, radius: 92, angle: 2.2, sweep: 1.7, color: '#ff5c8a', glow: '#b48cff', life: 0.42, maxLife: 0.42, dir: -1 });
      return;
    }

    // 3. BRIAR / NATURE ERUPTIONS (Thorn Lash, Gaia's Embrace, Entangling Roots, Bramble Lash)
    if (id === 'thorn-lash' || id === 'gaia-embrace' || id === 'roots' || id === 'lash') {
      const targets = id === 'thorn-lash' || id === 'gaia-embrace' ? aliveFoes : target ? [target] : [];
      for (const f of targets) {
        const fp = this.unitPosition(f);
        this.briars.push({ x: fp.x, y: fp.y + 4, color: '#6ef2b1', glow: '#e7ffd4', life: isUlt ? 1.0 : 0.7, maxLife: isUlt ? 1.0 : 0.7, seed: f.uid * 17 });
        this.spawnFx('spirit-wisp', fp.x, fp.y - 64 * fp.scale, (isUlt ? 210 : 150) * fp.scale, { delay: 0.15, life: 0.8 });
      }
      if (isUlt) this.pillars.push({ x: src.x, y: src.y, width: 80, color: '#8dffc2', glow: '#3ddc97', life: 0.85, maxLife: 0.85 });
      return;
    }

    // 4. SKY PILLARS (Dawnbreaker, Unbreakable, Blizzard, Crownfire, King's Law, Cinder Hymn, Maelstrom)
    if (id === 'dawnbreaker' || id === 'unbreakable' || id === 'blizzard' || id === 'crown-fire' || id === 'kingslaw' || id === 'cinder-hymn' || id === 'maelstrom') {
      const targets = id === 'unbreakable' ? [source] : (id === 'kingslaw' && target ? [target] : aliveFoes);
      for (const f of targets) {
        const fp = this.unitPosition(f);
        this.pillars.push({ x: fp.x, y: fp.y, width: isUlt ? 96 : 64, color: col, glow: '#ffffff', life: 0.72, maxLife: 0.72 });
        this.impactFx(col, fp.x, fp.y - 66 * fp.scale, (isUlt ? 230 : 170) * fp.scale, 0.18, 0.7);
      }
      return;
    }

    // 5. LETHAL X-SLASHES & HEAVY CLEAVES (Twin Fangs, Venom Strike, Shield Slam, Cleave, Void Cut)
    if (id === 'twin-fangs' || id === 'venom-strike' || id === 'shield-slam' || id === 'cleave' || id === 'void-cut' || id === 'antlers') {
      this.slashes.push({ x: tgt.x, y: tgt.y - 76 * tgt.scale, radius: 74, angle: facing > 0 ? -0.8 : 2.3, sweep: 1.6, color: col, glow: '#ffffff', life: 0.34, maxLife: 0.34, dir: 1 });
      if (id === 'twin-fangs' || id === 'cleave') {
        this.slashes.push({ x: tgt.x, y: tgt.y - 76 * tgt.scale, radius: 68, angle: facing > 0 ? 0.6 : 3.8, sweep: 1.5, color: '#7df2c0', glow: col, life: 0.38, maxLife: 0.38, dir: -1 });
      }
      if (id === 'shield-slam') this.ring(tgt.x, tgt.y - 70, '#ffe29a', 0.45, 68);
      this.spawnFx('slash-heavy', tgt.x, tgt.y - 80 * tgt.scale, 190 * tgt.scale, { flip: facing < 0, rot: (Math.random() - 0.5) * 0.4, life: 0.42 });
      if (col !== '#ffd27a') this.impactFx(col, tgt.x, tgt.y - 78 * tgt.scale, 130 * tgt.scale, 0.08, 0.5);
      return;
    }

    // 6. STREAKING ELEMENTAL PROJECTILES (Ember Lance, Flame Nova, Spit, Frost/Abyssal/Breath casts)
    if (id === 'ember-lance' || id === 'flame-nova' || id === 'spit' || id === 'chill' || id === 'hymn' || id === 'breath' || id === 'abyss-gaze' || id === 'barnacle' || id === 'burst') {
      const targets = id === 'flame-nova' || id === 'barnacle' || id === 'burst' ? aliveFoes : [target].filter(Boolean) as Unit[];
      for (const f of targets) {
        const fp = this.unitPosition(f);
        this.bolts.push({
          x0: src.x + facing * 28,
          y0: src.y - 82 * src.scale,
          x1: fp.x,
          y1: fp.y - 72 * fp.scale,
          color: col,
          glow: '#fff6d6',
          life: 0.32,
          maxLife: 0.32,
          size: id === 'ember-lance' || id === 'breath' ? 13 : 9,
        });
        // The bolt lands after its 0.32 s flight; fire spells burst on impact.
        this.impactFx(col, fp.x, fp.y - 72 * fp.scale, (id === 'flame-nova' ? 150 : 175) * fp.scale, 0.3, 0.65);
      }
      return;
    }

    // 7. SELF WARDS / BUFFS / HEALS (Radiant Ward, Cinder Veil, Smoke Step, Spirit Bloom)
    this.ring(src.x, src.y - 74, col, 0.65, 62);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      this.particles.push({
        x: src.x + Math.cos(a) * 32, y: src.y - 72 + Math.sin(a) * 32,
        vx: Math.cos(a) * 55, vy: Math.sin(a) * 55 - 24,
        life: 0.5 + Math.random() * 0.4, maxLife: 0.9, size: 2.2,
        color: col, gravity: 20, kind: 'ember',
      });
    }
  }

  private damageFloater(uid: number, x: number, y: number, text: string, color: string, size: number, vy: number): void {
    const now = this.time;
    const prev = this.floatStacks.get(uid);
    const count = prev && now - prev.time < 0.5 ? prev.count + 1 : 0;
    this.floatStacks.set(uid, { time: now, count });
    this.floaters.push({
      x: x + (Math.random() - 0.5) * 32,
      y: y - Math.min(count, 4) * 21,
      text, color, life: 1.1, maxLife: 1.1, size: Math.max(15, size - count * 1.5), vy,
    });
  }

  private floaterAt(x: number, y: number, text: string, color: string, size: number): void {
    this.floaters.push({ x, y, text, color, life: 1.2, maxLife: 1.2, size, vy: -26 });
  }

  private abilityColor(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('flame') || n.includes('ember') || n.includes('cinder') || n.includes('meteor') || n.includes('searing') || n.includes('furnace')) return FIRE_COLOR;
    if (n.includes('frost') || n.includes('ice') || n.includes('blizzard') || n.includes('chill') || n.includes('avalanche')) return '#9fe8ff';
    if (n.includes('spirit') || n.includes('bloom') || n.includes('gaia') || n.includes('thorn') || n.includes('wolf') || n.includes('bramble') || n.includes('spore')) return '#8dffc2';
    if (n.includes('shield') || n.includes('ward') || n.includes('unbreak') || n.includes('dawn')) return '#ffd77a';
    if (n.includes('venom') || n.includes('smoke') || n.includes('death') || n.includes('fang')) return '#b48cff';
    if (n.includes('void') || n.includes('dusk') || n.includes('crown')) return '#ff7ad9';
    if (n.includes('abyss') || n.includes('maelstrom') || n.includes('tide') || n.includes('drown')) return '#6ff4e0';
    return '#ffd27a';
  }

  private spawnFx(name: FxSpriteName, x: number, y: number, size: number, o: { flip?: boolean; rot?: number; spin?: number; life?: number; delay?: number; grow?: number } = {}): void {
    if (!getFxImage(name)) return;
    const life = o.life ?? 0.4;
    this.fxSprites.push({
      name, x, y, size, rot: o.rot ?? (ROUND_FX.has(name) ? Math.random() * Math.PI * 2 : 0),
      spin: o.spin ?? (ROUND_FX.has(name) ? 0.9 : 0), flip: !!o.flip, life, maxLife: life,
      delay: o.delay ?? 0, grow: o.grow ?? (ROUND_FX.has(name) ? 0.6 : 0.3),
    });
  }

  /** The painted impact for an ability colour, if there is one. */
  private impactFx(col: string, x: number, y: number, size: number, delay: number, life: number): void {
    const name = IMPACT_BY_COLOR[col];
    if (name) this.spawnFx(name, x, y, size, { delay, life });
  }

  /** True at most once per `gap` seconds for a key, so ticking heals don't stack effects. */
  private throttle(key: string, gap: number): boolean {
    const last = this.fxThrottle.get(key);
    if (last !== undefined && this.time - last < gap) return false;
    this.fxThrottle.set(key, this.time);
    return true;
  }

  private drawFxSprites(ctx: CanvasRenderingContext2D, dt: number): void {
    if (!this.fxSprites.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.fxSprites.length - 1; i >= 0; i--) {
      const f = this.fxSprites[i];
      if (f.delay > 0) { f.delay -= dt; continue; }
      f.life -= dt;
      if (f.life <= 0) { this.fxSprites.splice(i, 1); continue; }
      const img = getFxImage(f.name);
      if (!img) continue;
      const t = 1 - f.life / f.maxLife;
      // Pop in fast, then swell gently while fading out.
      const ease = 1 - (1 - t) ** 3;
      const scale = 0.7 + f.grow * ease;
      const alpha = t < 0.12 ? t / 0.12 : Math.max(0, 1 - ((t - 0.12) / 0.88) ** 1.6);
      const s = f.size * scale;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot + f.spin * t);
      if (f.flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
    ctx.restore();
  }

  private ring(x: number, y: number, color: string, life: number, size: number): void {
    this.particles.push({ x, y, vx: 0, vy: 0, life, maxLife: life, size, color, gravity: 0, kind: 'ring' });
  }

  /* --------------------------------- DRAW ---------------------------------- */

  draw(dt: number, battle: Battle | null): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.battle = battle;
    this.time += dt;

    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const s = Math.min(cw / DESIGN_W, ch / DESIGN_H);
    const ox = (cw - DESIGN_W * s) / 2;
    const oy = ch - DESIGN_H * s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.location?.palette.skyTop ?? '#06040a';
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(s, 0, 0, s, ox, oy);

    const shakeX = (Math.random() - 0.5) * this.shake;
    const shakeY = (Math.random() - 0.5) * this.shake;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Illustrated Gothic Stained-Glass Realm Backdrop (with fallback underneath)
    if (this.fallbackBg) ctx.drawImage(this.fallbackBg, -8, -8, DESIGN_W + 16, DESIGN_H + 16);
    const realmImg = this.location ? getRealmImage(this.location.id) : null;
    if (realmImg) {
      ctx.drawImage(realmImg, -8, -8, DESIGN_W + 16, DESIGN_H + 16);
    }

    // 2. Subtle animated atmospheric stained-glass god-rays & magma/moon pulse
    this.drawAtmosphericLighting(ctx);

    // 3. Ambient realm particles (embers, bioluminescent spores, snow, abyssal bubbles, astral ash)
    this.drawAmbient(ctx, dt);

    if (!battle) {
      ctx.restore();
      return;
    }

    // 4. Ground Briar Eruptions (behind/under units)
    this.drawBriars(ctx, dt);

    // Enrage starts as soon as battle time passes the threshold; the banner only plays once.
    this.enrage = enrageMultiplier(battle.elapsed);
    if (this.enrage > 1 && this.enrageStartedAt === null) this.enrageStartedAt = battle.elapsed;

    // 5. Units depth-sorted by Y. Living enemies get a red enrage glow behind them first.
    const all = [...battle.enemies, ...battle.allies, battle.hero];
    const sorted = all.filter(u => u.alive || u.deadTime < 2.2).sort((a, b) => this.unitPosition(a).y - this.unitPosition(b).y);
    if (this.enrage > 1) {
      for (const u of sorted) if (u.alive && u.side === 'enemy') this.drawEnrageGlow(ctx, u);
    }
    for (const u of sorted) this.drawUnit(ctx, u);

    // 6. Realm events play over the units and under the damage floaters.
    this.realmEvents?.draw(ctx, this.time);
    this.drawSkyPillars(ctx, dt);
    this.drawBolts(ctx, dt);
    this.drawSlashes(ctx, dt);
    this.drawFxSprites(ctx, dt);
    this.drawMarks(ctx, dt);
    this.drawParticles(ctx, dt);
    this.drawFloaters(ctx, dt);

    // 7. Chiaroscuro ground mist & gothic frame vignette
    this.drawStageVignette(ctx);
    if (this.enrage > 1) this.drawEnrageVignette(ctx);
    if (this.enrage > 1) this.drawEnrageBanner(ctx, battle.elapsed);

    ctx.restore();

    if (this.flash > 0.002) {
      ctx.globalAlpha = this.flash;
      ctx.fillStyle = `rgb(${this.flashColor})`;
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
      ctx.globalAlpha = 1;
    }
    this.shake = Math.max(0, this.shake - dt * 28);
    this.flash = Math.max(0, this.flash - dt * 1.7);
    this.vignettePulse = Math.max(0, this.vignettePulse - dt * 1.4);
  }

  private drawAtmosphericLighting(ctx: CanvasRenderingContext2D): void {
    const loc = this.location;
    if (!loc) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.4);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const ray = ctx.createRadialGradient(480, 90, 10, 480, 220, 460);
    ray.addColorStop(0, loc.palette.accent);
    ray.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.05 + pulse * 0.04;
    ctx.fillStyle = ray;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    ctx.restore();
  }

  private drawAmbient(ctx: CanvasRenderingContext2D, dt: number): void {
    const kind = this.location?.particle;
    const accent = this.location?.palette.accent ?? '#ffcf7a';
    for (const a of this.ambient) {
      a.phase += dt * a.speed;
      a.x += a.vx * dt + Math.sin(a.phase) * 7 * dt;
      a.y += a.vy * dt;
      const out = a.y < -20 || a.y > DESIGN_H + 20 || a.x < -20 || a.x > DESIGN_W + 20;
      if (out) Object.assign(a, this.newAmbient(false));
      ctx.fillStyle = accent;
      if (kind === 'snow') {
        ctx.globalAlpha = 0.65;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'bubble') {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.size * 1.5, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.globalAlpha = 0.45 + Math.sin(a.phase * 2) * 0.25;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - a.size * 1.8);
        ctx.lineTo(a.x + a.size, a.y);
        ctx.lineTo(a.x, a.y + a.size * 1.8);
        ctx.lineTo(a.x - a.size, a.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawStageVignette(ctx: CanvasRenderingContext2D): void {
    const p = this.location?.palette;
    if (p) {
      const fog = ctx.createLinearGradient(0, 445, 0, 540);
      fog.addColorStop(0, 'rgba(0,0,0,0)');
      fog.addColorStop(1, 'rgba(4,3,8,0.62)');
      ctx.fillStyle = fog;
      ctx.fillRect(0, 445, DESIGN_W, 95);
    }
    // Deep Darkest-Dungeon edge framing + golden/crimson pulse on crits & ults
    const vg = ctx.createRadialGradient(480, 270, 240, 480, 270, 610);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(3,2,7,0.68)');
    ctx.fillStyle = vg;
    ctx.fillRect(-8, -8, DESIGN_W + 16, DESIGN_H + 16);

    if (this.vignettePulse > 0.01) {
      const ug = ctx.createRadialGradient(480, 270, 220, 480, 270, 580);
      ug.addColorStop(0, 'rgba(0,0,0,0)');
      ug.addColorStop(1, `rgba(${this.vignetteColor},${this.vignettePulse * 0.34})`);
      ctx.fillStyle = ug;
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }
  }

  private enrageFontScale(): number {
    if (!this.battle) return 1;
    const m = enrageMultiplier(this.battle.elapsed);
    return m > 1 ? Math.min(1.6, 1 + (m - 1) * 0.35) : 1;
  }

  private drawEnrageGlow(ctx: CanvasRenderingContext2D, u: Unit): void {
    const pos = this.unitPosition(u);
    const alpha = Math.min(0.5, (this.enrage - 1) * 0.3);
    if (alpha <= 0) return;
    const r = 92 * pos.scale;
    const cx = pos.x;
    const cy = pos.y - 74 * pos.scale;
    const glow = ctx.createRadialGradient(cx, cy, 6, cx, cy, r);
    glow.addColorStop(0, `rgba(255,59,47,${alpha})`);
    glow.addColorStop(0.55, `rgba(255,59,47,${alpha * 0.45})`);
    glow.addColorStop(1, 'rgba(255,59,47,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  private drawEnrageVignette(ctx: CanvasRenderingContext2D): void {
    const pulse = 1 + 0.15 * Math.sin(this.time * Math.PI * 2 * 1.2);
    const alpha = Math.min(0.42, (this.enrage - 1) * 0.25) * pulse;
    if (alpha <= 0) return;
    const g = ctx.createRadialGradient(480, 270, 210, 480, 270, 610);
    g.addColorStop(0, 'rgba(255,40,30,0)');
    g.addColorStop(0.62, `rgba(255,40,30,${alpha * 0.22})`);
    g.addColorStop(1, `rgba(255,40,30,${alpha})`);
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(-8, -8, DESIGN_W + 16, DESIGN_H + 16);
    ctx.restore();
  }

  private drawEnrageBanner(ctx: CanvasRenderingContext2D, battleTime: number): void {
    if (this.enrageStartedAt === null) return;
    const age = battleTime - this.enrageStartedAt;
    const fadeIn = 0.3;
    const hold = 2;
    const fadeOut = 0.6;
    if (age > fadeIn + hold + fadeOut) return;
    const alpha = age < fadeIn
      ? age / fadeIn
      : age < fadeIn + hold
        ? 1
        : Math.max(0, 1 - (age - fadeIn - hold) / fadeOut);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    const cx = DESIGN_W / 2;
    ctx.font = '700 34px "Cinzel", "Palatino Linotype", Georgia, serif';
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#050309';
    ctx.strokeText('THE VALE GROWS RESTLESS', cx, 244);
    ctx.fillStyle = '#ffd2a6';
    ctx.fillText('THE VALE GROWS RESTLESS', cx, 244);
    ctx.font = '600 16px "Cinzel", "Palatino Linotype", Georgia, serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#050309';
    ctx.strokeText('All damage rises every second', cx, 276);
    ctx.fillStyle = '#f3d7b4';
    ctx.fillText('All damage rises every second', cx, 276);
    ctx.restore();
  }

  /* ------------------------------ VFX Renderers ---------------------------- */

  private drawSlashes(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const sl = this.slashes[i];
      sl.life -= dt;
      if (sl.life <= 0) { this.slashes.splice(i, 1); continue; }
      const t = sl.life / sl.maxLife;
      const prog = 1 - t;
      ctx.save();
      ctx.translate(sl.x, sl.y);
      ctx.globalAlpha = Math.min(1, t * 1.8);
      const start = sl.angle + prog * 0.25 * sl.dir;
      const end = start + sl.sweep;

      // Outer black sumi-ink backing crescent
      ctx.strokeStyle = '#050309';
      ctx.lineWidth = 15 * t;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, sl.radius, start, end);
      ctx.stroke();

      // Colored stained-glass energy blade arc
      ctx.shadowBlur = 16;
      ctx.shadowColor = sl.glow;
      ctx.strokeStyle = sl.color;
      ctx.lineWidth = 9 * t;
      ctx.beginPath();
      ctx.arc(0, 0, sl.radius, start + 0.04, end - 0.04);
      ctx.stroke();

      // Razor white-hot core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3 * t;
      ctx.beginPath();
      ctx.arc(0, 0, sl.radius, start + 0.14, end - 0.1);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawBolts(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      if (b.life <= 0) { this.bolts.splice(i, 1); continue; }
      const p = 1 - b.life / b.maxLife;
      const cx = b.x0 + (b.x1 - b.x0) * p;
      const cy = b.y0 + (b.y1 - b.y0) * p - Math.sin(p * Math.PI) * 32;
      const tailP = Math.max(0, p - 0.28);
      const tx = b.x0 + (b.x1 - b.x0) * tailP;
      const ty = b.y0 + (b.y1 - b.y0) * tailP - Math.sin(tailP * Math.PI) * 32;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#050309';
      ctx.lineWidth = b.size * 1.5;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(cx, cy); ctx.stroke();

      const grad = ctx.createLinearGradient(tx, ty, cx, cy);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.6, b.color);
      grad.addColorStop(1, b.glow);
      ctx.shadowBlur = 18;
      ctx.shadowColor = b.color;
      ctx.strokeStyle = grad;
      ctx.lineWidth = b.size;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(cx, cy); ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx, cy, b.size * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  private drawSkyPillars(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.pillars.length - 1; i >= 0; i--) {
      const pl = this.pillars[i];
      pl.life -= dt;
      if (pl.life <= 0) { this.pillars.splice(i, 1); continue; }
      const t = pl.life / pl.maxLife;
      ctx.save();

      if (pl.meteor) {
        const drop = 1 - t;
        const mx = pl.x - (1 - Math.min(1, drop * 2.1)) * 280;
        const my = pl.y - 45 - (1 - Math.min(1, drop * 2.1)) * 460;
        if (drop < 0.52) {
          // Falling blazing star
          ctx.strokeStyle = 'rgba(255,120,40,0.65)';
          ctx.lineWidth = 34;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(mx - 140, my - 230); ctx.lineTo(mx, my); ctx.stroke();
          ctx.fillStyle = '#050309';
          ctx.beginPath(); ctx.arc(mx, my, 28, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 30; ctx.shadowColor = '#ff5e1f';
          ctx.fillStyle = '#ff9838';
          ctx.beginPath(); ctx.arc(mx, my, 23, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff8d4';
          ctx.beginPath(); ctx.arc(mx + 3, my + 3, 12, 0, Math.PI * 2); ctx.fill();
        } else {
          // Impact pillar eruption
          const w = pl.width * t * 1.4;
          const g = ctx.createLinearGradient(pl.x - w / 2, 0, pl.x + w / 2, 0);
          g.addColorStop(0, 'rgba(255,80,30,0)');
          g.addColorStop(0.5, '#ffe89e');
          g.addColorStop(1, 'rgba(255,80,30,0)');
          ctx.globalAlpha = t * 1.4;
          ctx.fillStyle = g;
          ctx.fillRect(pl.x - w / 2, 0, w, pl.y + 8);
        }
      } else {
        const w = pl.width * (0.45 + 0.55 * Math.sin(t * Math.PI));
        const g = ctx.createLinearGradient(pl.x - w / 2, 0, pl.x + w / 2, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.3, pl.color);
        g.addColorStop(0.5, pl.glow);
        g.addColorStop(0.7, pl.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = Math.min(1, t * 1.35) * 0.82;
        ctx.fillStyle = g;
        ctx.fillRect(pl.x - w / 2, 0, w, pl.y + 8);
        // Ground rune ring
        ctx.strokeStyle = pl.color;
        ctx.lineWidth = 3 * t;
        ctx.beginPath();
        ctx.ellipse(pl.x, pl.y, w * 0.75, 14, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawBriars(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.briars.length - 1; i >= 0; i--) {
      const br = this.briars[i];
      br.life -= dt;
      if (br.life <= 0) { this.briars.splice(i, 1); continue; }
      const t = br.life / br.maxLife;
      const grow = Math.min(1, (1 - t) * 4.5);
      ctx.save();
      ctx.translate(br.x, br.y);
      ctx.globalAlpha = Math.min(1, t * 2);
      for (let v = -2; v <= 2; v++) {
        const h = (74 + ((br.seed + v * 13) % 34)) * grow;
        const lean = v * 16;
        ctx.beginPath();
        ctx.moveTo(v * 12, 0);
        ctx.quadraticCurveTo(v * 6 - lean * 0.4, -h * 0.55, lean, -h);
        ctx.strokeStyle = '#050309';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.strokeStyle = br.color;
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawMarks(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      m.life -= dt;
      if (m.life <= 0) { this.marks.splice(i, 1); continue; }
      const t = m.life / m.maxLife;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate((1 - t) * 0.6);
      ctx.globalAlpha = Math.min(1, t * 1.8);
      const r = 46 * (0.75 + t * 0.35);
      ctx.strokeStyle = '#050309';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(-r * 1.25, 0); ctx.lineTo(r * 1.25, 0);
      ctx.moveTo(0, -r * 1.25); ctx.lineTo(0, r * 1.25);
      ctx.stroke();
      ctx.strokeStyle = m.color;
      ctx.shadowBlur = 16; ctx.shadowColor = m.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      const t = p.life / p.maxLife;
      if (p.kind === 'ring') {
        ctx.globalAlpha = t * 0.75;
        ctx.strokeStyle = '#050309';
        ctx.lineWidth = 7 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.22 - t), 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3.2 * t;
        ctx.stroke();
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        ctx.globalAlpha = Math.min(1, t * 1.7);
        ctx.fillStyle = p.color;
        if (p.kind === 'shard') {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - p.size * 1.8);
          ctx.lineTo(p.x + p.size, p.y);
          ctx.lineTo(p.x, p.y + p.size * 1.8);
          ctx.lineTo(p.x - p.size, p.y);
          ctx.closePath();
          ctx.fill();
        } else if (p.kind === 'soul' || p.kind === 'heal') {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * t * 1.2, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillRect(p.x, p.y, p.size, p.size * 1.4);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFloaters(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) { this.floaters.splice(i, 1); continue; }
      const t = f.life / f.maxLife;
      f.y += f.vy * dt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 2.4);
      ctx.font = `700 ${f.size}px "Cinzel", "Palatino Linotype", Georgia, serif`;
      ctx.textAlign = 'center';
      if (f.banner) {
        const w = ctx.measureText(f.text).width + 48;
        ctx.fillStyle = 'rgba(8, 5, 14, 0.82)';
        this.roundRect(ctx, f.x - w / 2, f.y - 24, w, 34, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(233, 196, 106, 0.65)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.lineWidth = 4.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#050309';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  /* ------------------------------ Unit Renderer ---------------------------- */

  private drawUnit(ctx: CanvasRenderingContext2D, u: Unit): void {
    const pos = this.unitPosition(u);
    const deathT = u.alive ? 0 : Math.min(1, u.deadTime / 1.2);
    const alpha = u.alive ? Math.min(1, u.anim.spawn * 1.35) : Math.max(0, 1 - deathT);
    if (alpha <= 0) return;

    const facing = u.side === 'enemy' ? -1 : 1;
    const lunge = u.anim.attack * 34 * facing;
    const rise = (1 - u.anim.spawn) * -14;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(pos.x + lunge, pos.y + rise + deathT * 14);

    // Deep grounded sumi-ink contact shadow + subtle colored rim reflection on stone
    ctx.fillStyle = 'rgba(3, 2, 7, 0.68)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 50 * pos.scale, 13 * pos.scale, 0, 0, Math.PI * 2);
    ctx.fill();

    const s = pos.scale * (1 - deathT * 0.14);
    ctx.scale(facing * s, s);
    if (!u.alive) ctx.rotate(facing * deathT * 0.45);

    // Status affliction visuals (behind/around unit)
    const burning = u.effects.some(e => e.kind === 'burn');
    const poisoned = u.effects.some(e => e.kind === 'poison');
    const bleeding = u.effects.some(e => e.kind === 'bleed');
    const regen = u.effects.some(e => e.kind === 'regen');

    if (regen) {
      drawGothicHalo(ctx, 0, -68, 52, '#8dffc2', '#3ddc97', this.time * 1.5, 0.32);
    }

    const light: UnitLight = { accent: this.location?.palette.accent ?? '#e9c46a', ground: this.location?.palette.ground ?? '#120b10' };

    // Darkest-Dungeon lunge shadow smear when attacking!
    if (u.anim.attack > 0.25) {
      ctx.save();
      ctx.translate(-18 * u.anim.attack, 0);
      ctx.globalAlpha *= 0.28 * u.anim.attack;
      ctx.filter = 'brightness(0.2)';
      drawFinishedUnit(ctx, u, this.time, light);
      ctx.restore();
    }

    ctx.filter = u.anim.hit > 0.05 ? `brightness(${1 + u.anim.hit * 1.25})` : 'none';
    drawFinishedUnit(ctx, u, this.time, light);
    ctx.filter = 'none';

    if (burning) {
      for (let i = 0; i < 3; i++) {
        const yy = -26 - ((this.time * 64 + i * 34) % 108);
        const xx = Math.sin(this.time * 5 + i * 2 + u.uid) * 20;
        ctx.fillStyle = `rgba(255,${125 + i * 30},45,${0.65 - i * 0.12})`;
        ctx.beginPath();
        ctx.moveTo(xx, yy - 8); ctx.lineTo(xx + 5, yy); ctx.lineTo(xx, yy + 5); ctx.lineTo(xx - 5, yy);
        ctx.closePath(); ctx.fill();
      }
    }
    if (poisoned || bleeding) {
      ctx.fillStyle = poisoned ? 'rgba(130,255,150,0.72)' : 'rgba(255,70,95,0.75)';
      for (let i = 0; i < 3; i++) {
        const yy = -22 - ((this.time * 40 + i * 36) % 96);
        ctx.beginPath(); ctx.arc(Math.sin(this.time * 2 + i) * 18, yy, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (u.effects.some(e => e.kind === 'stun')) {
      ctx.strokeStyle = '#ffe28a';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 3; i++) {
        const a = this.time * 4.2 + (i * Math.PI * 2) / 3;
        const sx = Math.cos(a) * 26;
        const sy = -126 + Math.sin(a) * 6;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 5); ctx.lineTo(sx + 4, sy); ctx.lineTo(sx, sy + 5); ctx.lineTo(sx - 4, sy);
        ctx.closePath(); ctx.stroke();
      }
    }
    if (u.shield > 0) {
      ctx.strokeStyle = 'rgba(255, 224, 140, 0.72)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -132);
      ctx.lineTo(42, -104);
      ctx.lineTo(36, -34);
      ctx.lineTo(0, -6);
      ctx.lineTo(-36, -34);
      ctx.lineTo(-42, -104);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 224, 140, 0.08)';
      ctx.fill();
    }

    ctx.restore();

    // Gothic Stained-Glass HP Plate above unit
    if (u.alive && u.anim.spawn > 0.3) {
      this.drawGothicHealthBar(ctx, u, pos, lunge);
    }
  }

  private drawGothicHealthBar(
    ctx: CanvasRenderingContext2D,
    u: Unit,
    pos: { x: number; y: number; scale: number },
    lunge: number,
  ): void {
    ctx.save();
    const barW = u.boss ? 152 : 94;
    const barH = u.boss ? 10 : 7;
    const bx = pos.x - barW / 2 + lunge;
    const by = pos.y - (u.boss ? 182 : 168) * pos.scale - (u.boss ? 22 : 16);
    ctx.globalAlpha = Math.min(1, u.anim.spawn);

    // Obsidian iron backing plate
    ctx.fillStyle = 'rgba(6, 4, 11, 0.88)';
    ctx.fillRect(bx - 3, by - 3, barW + 6, barH + 6);
    ctx.strokeStyle = u.boss ? 'rgba(233, 196, 106, 0.75)' : 'rgba(233, 196, 106, 0.34)';
    ctx.lineWidth = u.boss ? 1.6 : 1.1;
    ctx.strokeRect(bx - 3, by - 3, barW + 6, barH + 6);

    // Stained-glass health fill
    const pct = Math.max(0, Math.min(1, u.hp / u.stats.maxHp));
    const hg = ctx.createLinearGradient(bx, by, bx, by + barH);
    if (u.side === 'enemy') {
      hg.addColorStop(0, u.boss ? '#ff8f9c' : '#ff8570');
      hg.addColorStop(0.5, u.boss ? '#d92b4b' : '#c9382b');
      hg.addColorStop(1, '#5e111b');
    } else {
      hg.addColorStop(0, '#b5ffd8');
      hg.addColorStop(0.5, '#3cc982');
      hg.addColorStop(1, '#145235');
    }
    ctx.fillStyle = hg;
    ctx.fillRect(bx, by, barW * pct, barH);

    // Shield overlay
    if (u.shield > 0) {
      const sw = barW * Math.min(1, u.shield / u.stats.maxHp);
      ctx.fillStyle = 'rgba(255, 228, 150, 0.88)';
      ctx.fillRect(bx, by, Math.min(barW, sw), Math.max(2, barH * 0.45));
    }

    // Stained-glass lead segment ticks
    ctx.fillStyle = 'rgba(5, 3, 9, 0.55)';
    for (let s = 1; s < 4; s++) {
      ctx.fillRect(bx + (barW * s) / 4, by, 1, barH);
    }

    // Diamond end-finials on boss/hero bars
    if (u.boss || u.side === 'hero') {
      ctx.fillStyle = '#e9c46a';
      for (const dx of [bx - 4, bx + barW + 4]) {
        ctx.beginPath();
        ctx.moveTo(dx, by + barH / 2 - 4);
        ctx.lineTo(dx + 4, by + barH / 2);
        ctx.lineTo(dx, by + barH / 2 + 4);
        ctx.lineTo(dx - 4, by + barH / 2);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Crisp engraved nameplate
    ctx.font = `600 ${u.boss ? 12.5 : 10.5}px "Cinzel", "Palatino Linotype", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = '#050309';
    const label = u.boss ? `✦ ${u.name} ✦` : u.name;
    ctx.strokeText(label, pos.x + lunge, by - 7);
    ctx.fillStyle = u.boss ? '#ffe09e' : 'rgba(242, 234, 248, 0.94)';
    ctx.fillText(label, pos.x + lunge, by - 7);
    ctx.restore();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
