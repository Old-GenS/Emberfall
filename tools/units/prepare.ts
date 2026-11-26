import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { UNIT_ART_IDS } from './ids';

interface UnitArtMeta {
  file: string;
  w: number;
  h: number;
  footX: number;
}

interface RawImage {
  data: Buffer;
  width: number;
  height: number;
}

interface Patch {
  x: number;
  y: number;
}

interface UnitOptions {
  flip?: boolean;
  hueKey?: boolean;
}

type KeyType = 'green' | 'magenta' | 'other';

const PATCH_SIZE = 12;
const PAD = 4;
const MAX_SIDE = 1024;
const MAX_HEIGHT = 640;

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

function keyTypeOf(B: { r: number; g: number; b: number }): KeyType {
  if (B.g > B.r + 40 && B.g > B.b + 40) return 'green';
  if (Math.min(B.r, B.b) > B.g + 40) return 'magenta';
  return 'other';
}

function patchesFor(width: number, height: number): Patch[] {
  const s = Math.max(1, Math.min(PATCH_SIZE, width, height));
  return [
    { x: 0, y: 0 },
    { x: width - s, y: 0 },
    { x: 0, y: height - s },
    { x: width - s, y: height - s },
  ];
}

function patchMeanAlpha(img: RawImage, patch: Patch, size: number): number {
  let sum = 0;
  for (let y = patch.y; y < patch.y + size; y++) {
    for (let x = patch.x; x < patch.x + size; x++) {
      sum += img.data[(y * img.width + x) * 4 + 3]!;
    }
  }
  return sum / (size * size);
}

function allCornerMeanAlpha(img: RawImage): number {
  const s = Math.max(1, Math.min(PATCH_SIZE, img.width, img.height));
  const patches = patchesFor(img.width, img.height);
  let sum = 0;
  for (const p of patches) {
    for (let y = p.y; y < p.y + s; y++) {
      for (let x = p.x; x < p.x + s; x++) {
        sum += img.data[(y * img.width + x) * 4 + 3]!;
      }
    }
  }
  return sum / (patches.length * s * s);
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const n = values.length;
  if (n === 0) return 0;
  return n % 2 === 1 ? values[(n - 1) / 2]! : (values[n / 2 - 1]! + values[n / 2]!) / 2;
}

function cornerBackground(img: RawImage): { r: number; g: number; b: number } {
  const s = Math.max(1, Math.min(PATCH_SIZE, img.width, img.height));
  const patches = patchesFor(img.width, img.height);
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (const p of patches) {
    for (let y = p.y; y < p.y + s; y++) {
      for (let x = p.x; x < p.x + s; x++) {
        const i = (y * img.width + x) * 4;
        rs.push(img.data[i]!);
        gs.push(img.data[i + 1]!);
        bs.push(img.data[i + 2]!);
      }
    }
  }
  return { r: median(rs), g: median(gs), b: median(bs) };
}

/** Root-mean-square distance of the corner pixels from their median colour: how noisy the screen is. */
function cornerNoise(img: RawImage, B: { r: number; g: number; b: number }): number {
  const s = Math.max(1, Math.min(PATCH_SIZE, img.width, img.height));
  const patches = patchesFor(img.width, img.height);
  let sum = 0;
  let n = 0;
  for (const p of patches) {
    for (let y = p.y; y < p.y + s; y++) {
      for (let x = p.x; x < p.x + s; x++) {
        const i = (y * img.width + x) * 4;
        const dr = img.data[i]! - B.r;
        const dg = img.data[i + 1]! - B.g;
        const db = img.data[i + 2]! - B.b;
        sum += dr * dr + dg * dg + db * db;
        n++;
      }
    }
  }
  return Math.sqrt(sum / Math.max(1, n));
}

/**
 * Squared-up green screen left behind: pixels anywhere in the frame whose green dominates red and
 * blue by a wide margin. The corner-median key misses the screen where it is tinted by a painted
 * ground shadow (the Ashen King's feet, the wolf's flank). Only runs for a green screen, so the
 * Spiritcaller — keyed from pink, and green itself — is untouched by it.
 */
function keyResidualGreen(img: RawImage, B: { r: number; g: number; b: number }): void {
  if (!(B.g > 150 && B.g - B.r > 80 && B.g - B.b > 80)) return;
  const { data, width, height } = img;
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (g > 90 && g - Math.max(r, b) > 55) data[i + 3] = 0;
  }
}

function keyBackground(img: RawImage, hueKey: boolean): KeyType {
  const B = cornerBackground(img);
  const keyType = keyTypeOf(B);
  const useHue = hueKey && keyType !== 'other';
  // A pure screen (0,255,0 everywhere) keys with a 36-wide core; a textured one (the Spiritcaller
  // was exported on mottled pink, rms noise 28 per channel) needs the core to cover its noise, or
  // about half the background survives as a semi-opaque haze. Scale both edges with the noise.
  const noise = cornerNoise(img, B);
  const core = Math.max(36, noise * 2.5);
  const soft = Math.max(48, noise * 2);
  // A screen with a gradient or vignette (the Spiritcaller: pink from 169,0,51 to 241,102,157) cannot
  // be keyed by distance to one colour without eating the subject. Key such a screen by hue instead:
  // a pixel is background when its dominant channel is the screen's dominant channel by a wide
  // margin, and the screen's weakest channel is weak in it too. Grey and dark subject pixels fail
  // both tests whatever their brightness.
  const chans = [B.r, B.g, B.b];
  const dom = chans.indexOf(Math.max(...chans));
  const weak = chans.indexOf(Math.min(...chans));
  const byHue = noise > 12;
  const { data, width, height } = img;
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const dr = r - B.r;
    const dg = g - B.g;
    const db = b - B.b;
    const d = Math.sqrt(dr * dr + dg * dg + db * db);
    let a = clamp((d - core) / soft, 0, 1);
    if (byHue) {
      const c = [r, g, b];
      const margin = (c[dom]! - Math.max(...c.filter((_, k) => k !== dom))) / 255;
      const weakness = 1 - c[weak]! / 255;
      const bg = Math.min(margin / 0.25, (weakness - 0.35) / 0.25);
      a = clamp(1 - bg, 0, 1) * Math.max(a, bg > 0.5 ? 0 : 1);
    }
    if (useHue) {
      const ex = keyType === 'green' ? g - Math.max(r, b) : Math.min(r, b) - g;
      const ref = keyType === 'green' ? g : Math.min(r, b);
      if (ex > 24) {
        const k = ex / Math.max(ref, 1);
        const aHue = 1 - clamp((k - 0.45) / 0.35, 0, 1);
        a = Math.min(a, aHue);
      }
    }
    const alpha = Math.min(data[i + 3]!, Math.round(a * 255));
    data[i + 3] = alpha;
    if (a > 0.05 && a < 1) {
      data[i] = clamp(Math.round((r - (1 - a) * B.r) / a), 0, 255);
      data[i + 1] = clamp(Math.round((g - (1 - a) * B.g) / a), 0, 255);
      data[i + 2] = clamp(Math.round((b - (1 - a) * B.b) / a), 0, 255);
    }
  }
  return keyType;
}

/** Zero the alpha of 4-connected opaque components smaller than 2% of the largest. */
function removeSpecks(img: RawImage): void {
  const { data, width, height } = img;
  const n = width * height;
  const labels = new Int32Array(n);
  const stack = new Int32Array(n);
  const sizes: number[] = [0];
  let largest = 0;

  const opaque = (p: number): boolean => data[p * 4 + 3]! > 40;

  for (let start = 0; start < n; start++) {
    if (labels[start] !== 0 || !opaque(start)) continue;
    const label = sizes.length;
    labels[start] = label;
    let sp = 0;
    stack[sp++] = start;
    let size = 0;
    while (sp > 0) {
      const p = stack[--sp]!;
      size++;
      const x = p % width;
      const y = (p / width) | 0;
      if (x > 0) {
        const q = p - 1;
        if (labels[q] === 0 && opaque(q)) { labels[q] = label; stack[sp++] = q; }
      }
      if (x + 1 < width) {
        const q = p + 1;
        if (labels[q] === 0 && opaque(q)) { labels[q] = label; stack[sp++] = q; }
      }
      if (y > 0) {
        const q = p - width;
        if (labels[q] === 0 && opaque(q)) { labels[q] = label; stack[sp++] = q; }
      }
      if (y + 1 < height) {
        const q = p + width;
        if (labels[q] === 0 && opaque(q)) { labels[q] = label; stack[sp++] = q; }
      }
    }
    sizes.push(size);
    if (size > largest) largest = size;
  }

  const threshold = largest * 0.02;
  for (let p = 0; p < n; p++) {
    const label = labels[p]!;
    if (label !== 0 && sizes[label]! < threshold) data[p * 4 + 3] = 0;
  }
}

/**
 * Remove background tint from the thin opaque band that borders transparent pixels. Keying alone
 * leaves a dark, half-blended rim carrying the screen's hue (a magenta outline around vines); this
 * pulls that hue back to the body's own colour.
 */
function despillEdges(img: RawImage, keyType: KeyType, hueKey: boolean): void {
  if (!hueKey || keyType === 'other') return;
  const { data, width, height } = img;
  const n = width * height;
  const radius = Math.max(2, Math.round(0.004 * Math.max(width, height)));
  const dist = new Int16Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;

  for (let p = 0; p < n; p++) {
    if (data[p * 4 + 3]! <= 40) {
      dist[p] = 0;
      queue[tail++] = p;
    }
  }

  while (head < tail) {
    const p = queue[head++]!;
    const d = dist[p]!;
    if (d >= radius) continue;
    const x = p % width;
    const y = (p / width) | 0;
    const visit = (q: number): void => {
      if (dist[q] !== -1) return;
      dist[q] = d + 1;
      queue[tail++] = q;
    };
    if (x > 0) visit(p - 1);
    if (x + 1 < width) visit(p + 1);
    if (y > 0) visit(p - width);
    if (y + 1 < height) visit(p + width);
  }

  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (data[i + 3]! <= 40) continue;
    const d = dist[p]!;
    if (d < 1 || d > radius) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (keyType === 'green') {
      data[i + 1] = Math.min(g, Math.max(r, b));
    } else {
      const e = Math.max(0, Math.min(r, b) - g);
      data[i] = r - e;
      data[i + 2] = b - e;
    }
  }
}

function opaqueFraction(img: RawImage): number {
  let count = 0;
  const n = img.width * img.height;
  for (let p = 0; p < n; p++) {
    if (img.data[p * 4 + 3]! > 40) count++;
  }
  return count / n;
}

function trimToOpaque(img: RawImage): RawImage {
  const { data, width, height } = img;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('no opaque pixels to trim');

  const left = Math.max(0, minX - PAD);
  const top = Math.max(0, minY - PAD);
  const right = Math.min(width - 1, maxX + PAD);
  const bottom = Math.min(height - 1, maxY + PAD);
  const cw = right - left + 1;
  const ch = bottom - top + 1;
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const src = ((top + y) * width + left) * 4;
    data.copy(out, y * cw * 4, src, src + cw * 4);
  }
  return { data: out, width: cw, height: ch };
}

function flipHorizontal(img: RawImage): RawImage {
  const { data, width, height } = img;
  const out = Buffer.alloc(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = (y * width + (width - 1 - x)) * 4;
      data.copy(out, dst, src, src + 4);
    }
  }
  return { data: out, width, height };
}

/** % of opaque pixels that still carry more than 40 of the key hue. */
function spillPercent(img: RawImage, keyType: KeyType): number | null {
  if (keyType === 'other') return null;
  const { data, width, height } = img;
  let opaque = 0;
  let spilled = 0;
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    if (data[i + 3]! <= 40) continue;
    opaque++;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const excess = keyType === 'green' ? g - Math.max(r, b) : Math.min(r, b) - g;
    if (excess > 40) spilled++;
  }
  return opaque === 0 ? null : (spilled / opaque) * 100;
}

function zeroTransparentRgb(img: RawImage): void {
  const { data } = img;
  for (let p = 0; p < img.width * img.height; p++) {
    const i = p * 4;
    if (data[i + 3] !== 0) continue;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 0;
  }
}

function footXOf(img: RawImage): number {
  const { data, width, height } = img;
  const rows = Math.max(1, Math.ceil(height * 0.04));
  const startY = Math.max(0, height - rows);
  let sum = 0;
  let count = 0;
  for (let y = startY; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! > 40) {
        sum += x;
        count++;
      }
    }
  }
  return count === 0 ? Math.round(width / 2) : Math.round(sum / count);
}

async function resizeRaw(img: RawImage, height: number): Promise<RawImage> {
  // Resize in premultiplied alpha. Resampling RGBA directly lets the colour stashed in fully
  // transparent pixels (usually the screen) bleed back into the opaque edge, which re-creates the
  // halo despill just removed.
  const n = img.width * img.height;
  const pre = Buffer.alloc(img.data.length);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const a = img.data[i + 3]!;
    pre[i] = Math.round((img.data[i]! * a) / 255);
    pre[i + 1] = Math.round((img.data[i + 1]! * a) / 255);
    pre[i + 2] = Math.round((img.data[i + 2]! * a) / 255);
    pre[i + 3] = a;
  }
  const { data, info } = await sharp(pre, {
    raw: { width: img.width, height: img.height, channels: 4 },
  })
    .resize({ height, kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let p = 0; p < info.width * info.height; p++) {
    const i = p * 4;
    const a = data[i + 3]!;
    if (a === 0) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    } else {
      data[i] = clamp(Math.round((data[i]! * 255) / a), 0, 255);
      data[i + 1] = clamp(Math.round((data[i + 1]! * 255) / a), 0, 255);
      data[i + 2] = clamp(Math.round((data[i + 2]! * 255) / a), 0, 255);
    }
  }
  return { data, width: info.width, height: info.height };
}

interface Prepared {
  name: string;
  keyed: boolean;
  opaquePct: number;
  spill: number | null;
  flip: boolean;
  w: number;
  h: number;
  footX: number;
  outputPath: string;
}

async function prepareFile(
  inputPath: string,
  name: string,
  outDir: string,
  options: UnitOptions,
): Promise<Prepared> {
  const hueKey = options.hueKey !== false;
  const flip = options.flip === true;
  let pipeline = sharp(inputPath, { failOn: 'none' });
  const metadata = await pipeline.metadata();
  const longest = Math.max(metadata.width ?? 0, metadata.height ?? 0);
  if (longest > MAX_SIDE) {
    pipeline = pipeline.resize({
      width: MAX_SIDE,
      height: MAX_SIDE,
      fit: 'inside',
      kernel: 'lanczos3',
      withoutEnlargement: true,
    });
  }
  const loaded = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img: RawImage = { data: loaded.data, width: loaded.info.width, height: loaded.info.height };

  let keyType: KeyType = 'other';
  const keyed = allCornerMeanAlpha(img) >= 16;
  if (keyed) {
    keyType = keyBackground(img, hueKey);
    keyResidualGreen(img, cornerBackground(img));
  }

  const s = Math.max(1, Math.min(PATCH_SIZE, img.width, img.height));
  for (const patch of patchesFor(img.width, img.height)) {
    const mean = patchMeanAlpha(img, patch, s);
    if (mean >= 8) {
      throw new Error(`corner alpha ${mean.toFixed(1)} after keying (must be < 8)`);
    }
  }

  removeSpecks(img);
  despillEdges(img, keyType, hueKey);
  const opaque = opaqueFraction(img);
  if (opaque < 0.03 || opaque > 0.90) {
    throw new Error(`opaque fraction ${(opaque * 100).toFixed(2)}% outside [3%, 90%]`);
  }

  let final = trimToOpaque(img);
  if (final.height > MAX_HEIGHT) final = await resizeRaw(final, MAX_HEIGHT);
  if (flip) final = flipHorizontal(final);
  zeroTransparentRgb(final);

  const footX = footXOf(final);
  const spill = spillPercent(final, keyType);
  const outputPath = path.join(outDir, `${name}.webp`);
  await sharp(final.data, {
    raw: { width: final.width, height: final.height, channels: 4 },
  })
    .webp({ quality: 86, alphaQuality: 100, effort: 5 })
    .toFile(outputPath);

  return {
    name,
    keyed,
    opaquePct: opaque * 100,
    spill,
    flip,
    w: final.width,
    h: final.height,
    footX,
    outputPath,
  };
}

interface Options {
  inDir: string;
  outDir: string;
  optionsPath: string;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    inDir: 'art/units',
    outDir: 'public/assets/units',
    optionsPath: 'tools/units/options.json',
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--') continue;
    if (arg === '--in' || arg === '--out' || arg === '--options') {
      const value = argv[i + 1];
      if (value === undefined || value === '--') {
        throw new Error(`missing value for ${arg}`);
      }
      i++;
      if (arg === '--in') opts.inDir = value;
      else if (arg === '--out') opts.outDir = value;
      else opts.optionsPath = value;
      continue;
    }
    console.warn(`warn: ignoring unknown argument ${arg}`);
  }
  return opts;
}

/** Read per-unit options; a missing file means every unit uses the defaults. */
async function loadOptions(
  optionsPath: string,
  ids: Set<string>,
): Promise<Map<string, UnitOptions>> {
  const options = new Map<string, UnitOptions>();
  let text: string;
  try {
    text = await fs.readFile(optionsPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return options;
    throw err;
  }
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`options file ${optionsPath} must contain a JSON object`);
  }
  for (const [id, raw] of Object.entries(parsed)) {
    if (!ids.has(id)) {
      console.warn(`warn: options: ignoring unknown unit id ${id}`);
      continue;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      console.warn(`warn: options: ignoring ${id} (value must be an object)`);
      continue;
    }
    const unit: UnitOptions = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key !== 'flip' && key !== 'hueKey') {
        console.warn(`warn: options: ignoring unknown key ${id}.${key}`);
        continue;
      }
      if (typeof value !== 'boolean') {
        console.warn(`warn: options: ignoring ${id}.${key} (must be a boolean)`);
        continue;
      }
      if (key === 'flip') unit.flip = value;
      else unit.hueKey = value;
    }
    options.set(id, unit);
  }
  return options;
}

function unitIdOf(name: string): string {
  return name.endsWith('-attack') ? name.slice(0, -'-attack'.length) : name;
}

function inputName(file: string, ids: Set<string>): string | null {
  const match = /^(.*)\.(png|jpe?g|webp)$/i.exec(file);
  if (!match) return null;
  const base = match[1]!;
  const id = base.endsWith('-attack') ? base.slice(0, -'-attack'.length) : base;
  if (!ids.has(id)) return null;
  return base;
}

async function loadManifest(outDir: string): Promise<Record<string, UnitArtMeta>> {
  const manifestPath = path.join(outDir, 'manifest.json');
  try {
    const parsed = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
      units?: Record<string, UnitArtMeta>;
    };
    const units = parsed.units;
    if (!units || typeof units !== 'object') return {};
    const kept: Record<string, UnitArtMeta> = {};
    for (const key of Object.keys(units)) {
      const meta = units[key];
      if (!meta || typeof meta !== 'object') continue;
      if (typeof meta.file !== 'string' || typeof meta.w !== 'number' ||
          typeof meta.h !== 'number' || typeof meta.footX !== 'number') continue;
      if (!existsSync(path.join(outDir, meta.file))) continue;
      kept[key] = { file: meta.file, w: meta.w, h: meta.h, footX: meta.footX };
    }
    return kept;
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  let opts: Options;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }

  const ids = new Set(UNIT_ART_IDS);
  let unitOptions: Map<string, UnitOptions>;
  try {
    unitOptions = await loadOptions(opts.optionsPath, ids);
  } catch (err) {
    console.error(`error: cannot load options ${opts.optionsPath}: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }
  await fs.mkdir(opts.outDir, { recursive: true });

  let entries: string[] = [];
  try {
    entries = (await fs.readdir(opts.inDir, { withFileTypes: true }))
      .filter(entry => entry.isFile())
      .map(entry => entry.name)
      .sort();
  } catch (err) {
    console.error(`error: cannot read input directory ${opts.inDir}: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }

  let failed = false;
  const written: Record<string, UnitArtMeta> = {};

  for (const file of entries) {
    const name = inputName(file, ids);
    if (name === null) {
      console.warn(`warn: skip ${file} (not <id>.png|jpg|jpeg|webp for a known unit)`);
      continue;
    }
    try {
      const result = await prepareFile(
        path.join(opts.inDir, file),
        name,
        opts.outDir,
        unitOptions.get(unitIdOf(name)) ?? {},
      );
      written[name] = {
        file: `${name}.webp`,
        w: result.w,
        h: result.h,
        footX: result.footX,
      };
      console.log(
        `${name.padEnd(24)} ${`${result.w}x${result.h}`.padEnd(11)} ` +
        `${(result.keyed ? 'keyed' : 'alpha').padEnd(6)} ` +
        `${`${result.opaquePct.toFixed(1)}%`.padEnd(8)} ` +
        `${(result.spill === null ? '-' : `${result.spill.toFixed(1)}%`).padEnd(8)} ` +
        `${(result.flip ? 'flip' : '').padEnd(4)} ok`,
      );
    } catch (err) {
      failed = true;
      const message = err instanceof Error ? err.message : String(err);
      console.log(
        `${name.padEnd(24)} ${'-'.padEnd(11)} ${'-'.padEnd(6)} ${'-'.padEnd(8)} ` +
        `${'-'.padEnd(8)} ${'-'.padEnd(4)} error: ${message}`,
      );
    }
  }

  const merged = await loadManifest(opts.outDir);
  for (const key of Object.keys(written)) merged[key] = written[key]!;
  const sorted: Record<string, UnitArtMeta> = {};
  for (const key of Object.keys(merged).sort()) sorted[key] = merged[key]!;
  await fs.writeFile(
    path.join(opts.outDir, 'manifest.json'),
    `${JSON.stringify({ version: 1, units: sorted }, null, 2)}\n`,
  );

  if (failed) process.exitCode = 1;
}

void main();
