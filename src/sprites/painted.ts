import type { Unit } from '../combat';
import { LOCATIONS } from '../data';

export interface UnitArtMeta { file: string; w: number; h: number; footX: number }
export interface UnitArtManifest { version: 1; units: Record<string, UnitArtMeta> }

/** Target height in local unit space (feet at y = 0) for each art id. */
export const PAINTED_HEIGHT: Record<string, number> = {
  warden: 241,
  pyromancer: 192,
  shadowblade: 174,
  spiritcaller: 215,
  'cinder-imp': 132,
  'ash-hound': 109,
  'magma-brute': 177,
  'molten-warden': 220,
  'bramble-stalker': 157,
  'spore-wisp': 104,
  'hollow-treant': 174,
  'pale-stag': 217,
  'rime-wolf': 109,
  'frost-wraith': 150,
  'ice-golem': 181,
  'winters-herald': 176,
  'drowned-acolyte': 148,
  'tide-revenant': 213,
  'coral-sentinel': 129,
  'leviathan-eye': 187,
  'void-knight': 216,
  'ash-seraph': 176,
  'dusk-wyrm': 171,
  'ashen-king': 245,
  'spirit-wolf': 110,
};

interface RegisteredArt {
  img: CanvasImageSource;
  meta: UnitArtMeta;
}

const registered = new Map<string, RegisteredArt>();

/* Enemy and boss names are unique across LOCATIONS, so one lookup is enough. */
const ENEMY_ID_BY_NAME = (() => {
  const byName = new Map<string, string>();
  for (const location of LOCATIONS) {
    for (const enemy of location.enemies) byName.set(enemy.name, enemy.id);
    byName.set(location.boss.name, location.boss.id);
  }
  return byName;
})();

const FLOATERS = new Set(['spore-wisp', 'frost-wraith', 'ash-seraph']);

let manifestStarted = false;
let manifestReady = false;
let manifestBase = './assets/units';
let manifestUnits: Record<string, UnitArtMeta> = {};
const requested = new Set<string>();

export function artIdFor(u: Unit): string | null {
  if (u.side === 'hero') return u.classId ?? null;
  if (u.side === 'ally') return 'spirit-wolf';
  if (u.side === 'enemy') return ENEMY_ID_BY_NAME.get(u.name) ?? null;
  return null;
}

export function registerUnitArt(id: string, img: CanvasImageSource, meta: UnitArtMeta): void {
  registered.set(id, { img, meta });
}

export function hasPaintedArt(u: Unit): boolean {
  const id = artIdFor(u);
  return id !== null && registered.has(id);
}

export function loadUnitArtManifest(baseUrl = './assets/units'): void {
  if (manifestStarted) return;
  manifestStarted = true;
  manifestBase = baseUrl;
  if (typeof fetch !== 'function') return;

  fetch(`${baseUrl}/manifest.json`)
    .then(response => {
      if (!response.ok) throw new Error(`manifest ${response.status}`);
      return response.json() as Promise<UnitArtManifest>;
    })
    .then(manifest => {
      if (!manifest || typeof manifest !== 'object' || !manifest.units || typeof manifest.units !== 'object') return;
      manifestUnits = manifest.units;
      manifestReady = true;
    })
    .catch(() => {
      /* No manifest (or bad JSON) simply leaves the game fully procedural. */
    });
}

/** Ask for an id's image(s) once the manifest is known. Missing ones are skipped. */
function requestArt(id: string): void {
  if (!manifestReady || requested.has(id) || registered.has(id)) return;
  const meta = manifestUnits[id];
  if (!meta) return;
  requested.add(id);
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.onload = () => registerUnitArt(id, img, meta);
  img.onerror = () => { /* keep the procedural fallback for this id */ };
  img.src = `${manifestBase}/${meta.file}`;
}

function drawOne(ctx: CanvasRenderingContext2D, entry: RegisteredArt, height: number): void {
  const { img, meta } = entry;
  const s = height / meta.h;
  ctx.drawImage(img, -meta.footX * s, -meta.h * s, meta.w * s, meta.h * s);
}

function drawFrame(ctx: CanvasRenderingContext2D, id: string, height: number, attack: number, alpha: number): void {
  const idle = registered.get(id);
  if (!idle) return;
  const attackArt = registered.get(`${id}-attack`);
  if (!attackArt) {
    ctx.globalAlpha = alpha;
    drawOne(ctx, idle, height);
    return;
  }
  const f = Math.max(0, Math.min(1, (attack - 0.15) / 0.25));
  if (f < 1) {
    ctx.globalAlpha = alpha * (1 - f);
    drawOne(ctx, idle, height);
  }
  if (f > 0) {
    ctx.globalAlpha = alpha * f;
    drawOne(ctx, attackArt, height);
  }
}

/** `#rgb` / `#rrggbb` with an explicit alpha, for the glow gradient stops. */
function withAlpha(colour: string, alpha: number): string {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour.trim());
  if (!match) return colour;
  let hex = match[1];
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function drawPainted(ctx: CanvasRenderingContext2D, u: Unit, time: number): boolean {
  const id = artIdFor(u);
  if (!id) return false;

  requestArt(id);
  requestArt(`${id}-attack`);

  const idle = registered.get(id);
  const height = PAINTED_HEIGHT[id];
  if (!idle || height === undefined) return false;

  const attack = u.anim.attack;
  const cast = u.anim.cast;
  const uid = u.uid;
  const b = Math.sin(time * 2.2 + uid * 1.3);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  if (FLOATERS.has(id)) ctx.translate(0, -10 - 6 * Math.sin(time * 1.8 + uid));
  ctx.translate(12 * attack, -8 * cast);
  ctx.rotate(0.012 * Math.sin(time * 1.3 + uid) + 0.17 * attack);
  ctx.scale(
    (1 - 0.008 * b) * (1 + 0.06 * attack) * (1 + 0.04 * cast),
    (1 + 0.018 * b) * (1 - 0.04 * attack) * (1 + 0.04 * cast),
  );

  drawFrame(ctx, id, height, attack, 1);

  if (cast > 0) {
    const cx = 0.15 * height;
    const cy = -0.62 * height;
    const radius = 0.45 * height;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0, withAlpha(u.colors.glow, 0.55 * cast));
    glow.addColorStop(1, withAlpha(u.colors.glow, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    drawFrame(ctx, id, height, attack, 0.22 * cast);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  return true;
}
