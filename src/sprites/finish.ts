import type { Unit } from '../combat';
import { drawHeroGothic } from './heroes';
import { drawCreatureGothic } from './creatures';
import { drawPainted, hasPaintedArt, loadUnitArtManifest } from './painted';

export interface UnitLight { accent: string; ground: string }

/* ------------------------------ finish pass ------------------------------ */

interface UidCache {
  canvas: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  rim: HTMLCanvasElement;
  key: string;
  k: number;
}

const cache = new Map<number, UidCache>();
let manifestRequested = false;

/* A single 128x128 grain tile, built once from a seeded LCG. The values stay
 * close to neutral grey so the overlay only breaks up the flat fills. */
let grainCanvas: HTMLCanvasElement | null = null;
const patternCache = new WeakMap<CanvasRenderingContext2D, CanvasPattern>();

function grain(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  if (!g) return c;
  const img = g.createImageData(128, 128);
  let seed = 0x9e3779b9;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const v = 112 + (seed % 33);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainCanvas = c;
  return c;
}

function grainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  let p = patternCache.get(ctx);
  if (!p) {
    p = ctx.createPattern(grain(), 'repeat') ?? undefined;
    if (p) patternCache.set(ctx, p);
  }
  return p ?? null;
}

type RGB = [number, number, number];

function parseColor(colour: string): RGB {
  const s = colour.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return [
        parseInt(h[0] + h[0], 16),
        parseInt(h[1] + h[1], 16),
        parseInt(h[2] + h[2], 16),
      ];
    }
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const rgb = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i.exec(s);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return [233, 196, 106];
}

function blend(a: RGB, b: RGB): RGB {
  return [
    Math.round((a[0] + b[0]) / 2),
    Math.round((a[1] + b[1]) / 2),
    Math.round((a[2] + b[2]) / 2),
  ];
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function renderRaw(ctx: CanvasRenderingContext2D, u: Unit, time: number): void {
  if (drawPainted(ctx, u, time)) return;
  if (u.side === 'hero' && u.classId) drawHeroGothic(ctx, u.classId, u, time);
  else drawCreatureGothic(ctx, u.body, u.colors as any, u, time, u.side === 'ally');
}

function paintRaw(off: CanvasRenderingContext2D, u: Unit, time: number, k: number, w: number, h: number): void {
  off.setTransform(1, 0, 0, 1, 0, 0);
  off.clearRect(0, 0, w, h);
  off.save();
  off.setTransform(k, 0, 0, k, 180 * k, 340 * k);
  off.globalAlpha = 1;
  off.globalCompositeOperation = 'source-over';
  off.filter = 'none';
  renderRaw(off, u, time);
  off.restore();
}

function paintFinish(
  off: CanvasRenderingContext2D,
  mask: CanvasRenderingContext2D,
  rim: CanvasRenderingContext2D,
  u: Unit,
  time: number,
  light: UnitLight,
  k: number,
  w: number,
  h: number,
  painted: boolean,
): void {
  /* Raw sprite on the offscreen, plus a pristine alpha copy used by every
   * masking step below. */
  paintRaw(off, u, time, k, w, h);
  mask.setTransform(1, 0, 0, 1, 0, 0);
  mask.globalCompositeOperation = 'source-over';
  mask.globalAlpha = 1;
  mask.filter = 'none';
  mask.clearRect(0, 0, w, h);
  mask.drawImage(off.canvas, 0, 0);

  off.setTransform(1, 0, 0, 1, 0, 0);
  off.globalAlpha = 1;
  off.filter = 'none';

  /* (a) grounding: transparent at y -70, ground colour at y 0. */
  const ground = parseColor(light.ground);
  const grad = off.createLinearGradient(0, (340 - 70) * k, 0, 340 * k);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(${ground[0]},${ground[1]},${ground[2]},0.55)`);
  off.globalCompositeOperation = 'source-atop';
  off.fillStyle = grad;
  off.fillRect(0, 0, w, h);

  /* (b) grade: multiply the scene accent in, then clip back to the sprite. */
  const accent = parseColor(light.accent);
  off.globalCompositeOperation = 'multiply';
  off.globalAlpha = 0.1;
  off.fillStyle = `rgb(${accent[0]},${accent[1]},${accent[2]})`;
  off.fillRect(0, 0, w, h);
  off.globalCompositeOperation = 'destination-in';
  off.globalAlpha = 1;
  off.drawImage(mask.canvas, 0, 0);

  /* (c) texture: one 128x128 grain tile at low overlay alpha. Painted art
   * already carries its own paint texture, so it skips this step. */
  if (!painted) {
    const pat = grainPattern(off);
    if (pat) {
      off.globalCompositeOperation = 'overlay';
      off.globalAlpha = 0.16;
      off.fillStyle = pat;
      off.fillRect(0, 0, w, h);
      off.globalCompositeOperation = 'destination-in';
      off.globalAlpha = 1;
      off.drawImage(mask.canvas, 0, 0);
    }
  }

  /* (d) rim light: the mask minus itself shifted down-right. */
  const glow = parseColor(u.colors.glow ?? '#ffffff');
  const tint = blend(accent, glow);
  rim.setTransform(1, 0, 0, 1, 0, 0);
  rim.globalCompositeOperation = 'source-over';
  rim.globalAlpha = 1;
  rim.filter = 'none';
  rim.clearRect(0, 0, w, h);
  rim.drawImage(mask.canvas, 0, 0);
  rim.globalCompositeOperation = 'source-in';
  rim.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`;
  rim.fillRect(0, 0, w, h);
  rim.globalCompositeOperation = 'destination-out';
  rim.drawImage(mask.canvas, 2.2 * k, 2.6 * k);

  off.globalCompositeOperation = 'source-atop';
  off.globalAlpha = 0.55;
  off.drawImage(rim.canvas, 0, 0);
  off.globalCompositeOperation = 'source-over';
  off.globalAlpha = 1;
}

export function drawFinishedUnit(ctx: CanvasRenderingContext2D, u: Unit, time: number, light: UnitLight): void {
  if (!manifestRequested && typeof document !== 'undefined' && window.location.protocol !== 'about:') {
    manifestRequested = true;
    loadUnitArtManifest();
  }

  const m = ctx.getTransform();
  const k = Math.min(2.5, Math.hypot(m.a, m.b)) || 1;
  const a = u.anim;
  const painted = hasPaintedArt(u);
  const key = [u.uid, time, u.alive ? 1 : 0, a.attack, a.hit, a.heal, a.spawn, a.cast, painted ? 1 : 0].join('|');

  const w = Math.max(1, Math.ceil(360 * k));
  const h = Math.max(1, Math.ceil(380 * k));

  let entry = cache.get(u.uid);
  if (!entry || entry.canvas.width !== w || entry.canvas.height !== h) {
    entry = {
      canvas: makeCanvas(w, h),
      mask: makeCanvas(w, h),
      rim: makeCanvas(w, h),
      key: '',
      k,
    };
    cache.set(u.uid, entry);
  }

  if (entry.key !== key || entry.k !== k) {
    const off = entry.canvas.getContext('2d');
    const mask = entry.mask.getContext('2d');
    const rim = entry.rim.getContext('2d');
    if (off && mask && rim) {
      paintFinish(off, mask, rim, u, time, light, k, w, h, painted);
      entry.key = key;
      entry.k = k;
    }
  }

  /* Draw the finished sprite back in the caller's local space, keeping the
   * caller's filter and globalAlpha intact. */
  ctx.save();
  ctx.shadowColor = 'rgba(4,2,8,0.6)';
  ctx.shadowBlur = 5 * k;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.drawImage(entry.canvas, -180, -340, 360, 380);
  ctx.restore();
}
