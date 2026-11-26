#!/usr/bin/env node
// Checks the prepared unit images against the fixture art's known key colour.
// Usage: node tools/units/check-units.mjs <preparedDir> <unflippedDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OPTIONS_PATH = path.join(ROOT, 'tools/units/options.json');

// The fixture picks its screen from the unit's main colour (see tools/units/fixture.ts): a
// green-dominant main colour is drawn on magenta, everything else on green. These main colours
// mirror src/data.ts, which the fixture imports.
const MAIN_COLORS = {
  warden: '#ffcf7a',
  pyromancer: '#ff9d5c',
  shadowblade: '#b48cff',
  spiritcaller: '#8dffc2',
  'cinder-imp': '#ff7a45',
  'ash-hound': '#c96a3c',
  'magma-brute': '#e2603a',
  'molten-warden': '#ffb14d',
  'bramble-stalker': '#6fbf7a',
  'spore-wisp': '#9ff4b8',
  'hollow-treant': '#5c8f5a',
  'pale-stag': '#e7ffe9',
  'rime-wolf': '#bfe9ff',
  'frost-wraith': '#9fd8ff',
  'ice-golem': '#a9d8ee',
  'winters-herald': '#d8f6ff',
  'drowned-acolyte': '#6fd4cd',
  'tide-revenant': '#5fb8c9',
  'coral-sentinel': '#ff9a9a',
  'leviathan-eye': '#7cf0d8',
  'void-knight': '#a98bff',
  'ash-seraph': '#ff9ad9',
  'dusk-wyrm': '#7d64e8',
  'ashen-king': '#ffcf7a',
  'spirit-wolf': '#6ef2b1',
};

function hexRgb(hex) {
  const h = hex.replace(/^#/, '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function fixtureBackground(id) {
  const main = MAIN_COLORS[id];
  if (!main) return null;
  const { r, g, b } = hexRgb(main);
  return g > r && g > b ? '#ff00ff' : '#00ff00';
}

function keyTypeOf(background) {
  const { r, g, b } = hexRgb(background);
  if (g > r + 40 && g > b + 40) return 'green';
  if (Math.min(r, b) > g + 40) return 'magenta';
  return 'other';
}

function unitIdOf(name) {
  return name.endsWith('-attack') ? name.slice(0, -'-attack'.length) : name;
}

async function loadPixels(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function spillPercent(pixels, keyType) {
  const { data, width, height } = pixels;
  let opaque = 0;
  let spilled = 0;
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    if (data[i + 3] <= 40) continue;
    opaque++;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const excess = keyType === 'green' ? g - Math.max(r, b) : Math.min(r, b) - g;
    if (excess > 40) spilled++;
  }
  return opaque === 0 ? 0 : (spilled / opaque) * 100;
}

function shadowOverhang(pixels) {
  const { data, width, height } = pixels;
  const bottomStart = Math.floor(height * 0.94);
  const refStart = Math.floor(height * 0.88);
  let refMin = Infinity;
  let refMax = -Infinity;
  for (let y = refStart; y < bottomStart; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= 40) continue;
      if (x < refMin) refMin = x;
      if (x > refMax) refMax = x;
    }
  }
  if (refMin === Infinity) {
    return { ok: false, detail: 'no opaque pixels in rows 88-94%' };
  }
  const lo = refMin - 25;
  const hi = refMax + 25;
  let bad = 0;
  let worst = 0;
  for (let y = bottomStart; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= 40) continue;
      if (x < lo) {
        bad++;
        if (lo - x > worst) worst = lo - x;
      } else if (x > hi) {
        bad++;
        if (x - hi > worst) worst = x - hi;
      }
    }
  }
  return bad === 0
    ? { ok: true, detail: 'no shadow outside the feet' }
    : { ok: false, detail: `${bad} px outside by up to ${worst} px` };
}

function mirrorMatches(a, b) {
  if (a.width !== b.width || a.height !== b.height) {
    return { ok: false, detail: `size ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  }
  // Lossy WebP noise doesn't mirror, so compare loosely: a missing or wrong flip moves the whole
  // figure and fails both limits by a wide margin.
  let sum = 0;
  let bad = 0;
  const n = a.width * a.height;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      const j = (y * b.width + (b.width - 1 - x)) * 4;
      // Compare what is visible: colour weighted by opacity, plus opacity itself.
      const aa = a.data[i + 3] / 255;
      const ba = b.data[j + 3] / 255;
      let worst = Math.abs(a.data[i + 3] - b.data[j + 3]);
      sum += worst;
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(a.data[i + c] * aa - b.data[j + c] * ba);
        sum += d;
        if (d > worst) worst = d;
      }
      if (worst > 12) bad++;
    }
  }
  const mean = sum / (n * 4);
  const badPct = (100 * bad) / n;
  const detail = `mean diff ${mean.toFixed(2)}, ${badPct.toFixed(2)}% px off by >12`;
  return mean <= 1.5 && badPct <= 0.5 ? { ok: true, detail } : { ok: false, detail };
}

function loadUnitOptions() {
  try {
    const parsed = JSON.parse(fs.readFileSync(OPTIONS_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function main() {
  const args = process.argv.slice(2).filter(arg => arg !== '--');
  if (args.length < 2) {
    console.error('usage: node tools/units/check-units.mjs <preparedDir> <unflippedDir>');
    process.exitCode = 1;
    return;
  }
  const [preparedDir, unflippedDir] = args;
  const options = loadUnitOptions();
  let passed = 0;
  let total = 0;
  const record = (ok, detail) => {
    total++;
    if (ok) passed++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${detail}`);
  };

  let files;
  try {
    files = fs.readdirSync(preparedDir).filter(name => name.endsWith('.webp')).sort();
  } catch (err) {
    console.error(`error: cannot read prepared directory ${preparedDir}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  for (const file of files) {
    const name = file.slice(0, -'.webp'.length);
    const id = unitIdOf(name);
    const background = fixtureBackground(id);
    if (background === null) {
      record(false, `spill ${name}: no fixture background for ${id}`);
      record(false, `shadow ${name}: no fixture background for ${id}`);
      continue;
    }
    const keyType = keyTypeOf(background);
    const pixels = await loadPixels(path.join(preparedDir, file));
    const excluded = options[id] && options[id].hueKey === false;
    if (excluded) continue;

    const spill = spillPercent(pixels, keyType);
    record(
      spill <= 0.3,
      `spill ${name}: ${spill.toFixed(3)}% <= 0.30%`,
    );

    const shadow = shadowOverhang(pixels);
    record(shadow.ok, `shadow ${name}: ${shadow.detail}`);
  }

  for (const id of Object.keys(options).sort()) {
    if (!options[id] || options[id].flip !== true) continue;
    let a;
    let b;
    try {
      a = await loadPixels(path.join(preparedDir, `${id}.webp`));
      b = await loadPixels(path.join(unflippedDir, `${id}.webp`));
    } catch (err) {
      record(false, `flip ${id}: ${err.message}`);
      continue;
    }
    const match = mirrorMatches(a, b);
    record(match.ok, `flip ${id}: ${match.detail}`);
  }

  console.log(`check-units: ${passed}/${total} pass`);
  if (passed !== total) process.exitCode = 1;
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
