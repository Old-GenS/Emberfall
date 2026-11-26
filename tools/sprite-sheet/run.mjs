import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'sprite-out');
const BUNDLE = path.join(ROOT, 'node_modules/.cache/sprite-sheet/bundle.js');
const BASELINE = path.join(ROOT, 'tools/sprite-sheet/baseline.json');

const W = 560;
const H = 600;
const COLS = 6;
const CELL_W = 280;
const CELL_H = 300;
const POSES = ['idleA', 'idleB', 'attack', 'cast'];
const CHROMIUM_CANDIDATES = [
  '/usr/lib64/chromium-browser/chromium-browser',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

const exists = (p) => {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
};

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  return CHROMIUM_CANDIDATES.find(exists);
}

function measure(name, buffers) {
  const pixels = buffers.idleA;
  let opaque = 0;
  let keyed = 0;
  let minX = W;
  let maxX = -1;
  let minY = H;
  let maxY = -1;
  let edge = false;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (pixels[i + 3] <= 40) continue;
      opaque++;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      if ((g > 200 && r < 70 && b < 70) || (r > 200 && b > 200 && g < 70)) keyed++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x <= 1 || x >= W - 2 || y <= 1) edge = true;
    }
  }

  const w = maxX >= minX ? maxX - minX + 1 : 0;
  const h = maxY >= minY ? maxY - minY + 1 : 0;

  const delta = (a, b) => {
    let union = 0;
    let diff = 0;
    for (let i = 0; i < a.length; i += 4) {
      const ao = a[i + 3] > 40;
      const bo = b[i + 3] > 40;
      if (!ao && !bo) continue;
      union++;
      if (
        Math.abs(a[i] - b[i]) > 24 ||
        Math.abs(a[i + 1] - b[i + 1]) > 24 ||
        Math.abs(a[i + 2] - b[i + 2]) > 24 ||
        Math.abs(a[i + 3] - b[i + 3]) > 24
      ) {
        diff++;
      }
    }
    return union > 0 ? diff / union : 0;
  };

  return {
    name,
    opaque,
    h,
    w,
    edge,
    fringe: opaque > 0 ? keyed / opaque : 0,
    idle: delta(pixels, buffers.idleB),
    attack: delta(pixels, buffers.attack),
    cast: delta(pixels, buffers.cast),
  };
}

function printTable(rows, baseline, painted = false) {
  console.log(
    'unit'.padEnd(22) +
      'h/h0'.padStart(7) +
      'w/w0'.padStart(7) +
      'opaque'.padStart(8) +
      'edge'.padStart(6) +
      'idle'.padStart(8) +
      'attack'.padStart(8) +
      'cast'.padStart(8) +
      (painted ? 'painted'.padStart(9) + 'fringe'.padStart(8) : '') +
      '  result',
  );
  for (const r of rows) {
    const b = baseline?.[r.name];
    const hh = b ? (r.h / b.h).toFixed(2) : '-';
    const ww = b ? (r.w / b.w).toFixed(2) : '-';
    const result = baseline ? (r.failed.length ? `FAIL ${r.failed.join(',')}` : 'PASS') : '';
    console.log(
      r.name.slice(0, 21).padEnd(22) +
        hh.padStart(7) +
        ww.padStart(7) +
        String(r.opaque).padStart(8) +
        String(r.edge).padStart(6) +
        r.idle.toFixed(3).padStart(8) +
        r.attack.toFixed(3).padStart(8) +
        r.cast.toFixed(3).padStart(8) +
        (painted
          ? String(r.painted).padStart(9) + (r.fringe * 100).toFixed(3).padStart(8)
          : '') +
        '  ' +
        result,
    );
  }
}

function check(rows, baseline, painted = false) {
  let passed = 0;
  for (const r of rows) {
    const failed = [];
    const b = baseline[r.name];
    if (!b) failed.push('no-baseline');
    if (r.opaque < 1200) failed.push('opaque');
    if (r.edge) failed.push('edge');
    if (b && !(r.h / b.h >= (painted ? 0.8 : 0.85) && r.h / b.h <= 1.3)) failed.push('height');
    if (!painted && b && r.w / b.w > 1.5) failed.push('width');
    if (r.idle < 0.02) failed.push('idle');
    if (r.attack < 0.06) failed.push('attack');
    if (r.cast < 0.03) failed.push('cast');
    if (painted) {
      if (!r.painted) failed.push('painted');
      if (r.fringe > 0.002) failed.push('fringe');
    }
    r.failed = failed;
    if (!failed.length) passed++;
  }
  return passed;
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const baselineMode = args.includes('baseline');
  const paintedMode = args.includes('--painted');
  fs.mkdirSync(OUT, { recursive: true });

  const executablePath = findChromium();
  if (!executablePath) throw new Error('No Chromium binary found (set CHROMIUM_PATH)');
  if (!exists(BUNDLE)) throw new Error(`Missing bundle: ${BUNDLE} (run npm run sprites)`);

  const arts = [];
  if (paintedMode) {
    const unitsDir = path.resolve(ROOT, process.env.UNITS_DIR ?? 'public/assets/units');
    const manifest = JSON.parse(fs.readFileSync(path.join(unitsDir, 'manifest.json'), 'utf8'));
    for (const [id, meta] of Object.entries(manifest.units)) {
      const webp = fs.readFileSync(path.join(unitsDir, meta.file));
      arts.push({ id, meta, dataUrl: `data:image/webp;base64,${webp.toString('base64')}` });
    }
  }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath });
  const page = await browser.newPage({ viewport: { width: COLS * CELL_W, height: 1500 } });
  page.setDefaultTimeout(180000);
  await page.setContent('<!doctype html><body style="margin:0;background:#1a1220"></body>');
  await page.addScriptTag({ path: BUNDLE });

  if (paintedMode) {
    await page.evaluate(async (entries) => {
      for (const entry of entries) {
        await window.spriteSheet.addArt(entry.id, entry.dataUrl, entry.meta);
      }
    }, arts);
  }

  const names = await page.evaluate(() => window.spriteSheet.names());

  await page.evaluate(
    ({ names, COLS, CELL_W, CELL_H }) => {
      const make = () => {
        const c = document.createElement('canvas');
        c.width = COLS * CELL_W;
        c.height = Math.ceil(names.length / COLS) * CELL_H;
        const x = c.getContext('2d');
        x.fillStyle = '#1a1220';
        x.fillRect(0, 0, c.width, c.height);
        return c;
      };
      window.__sheets = { idleA: make(), attack: make(), cast: make() };
    },
    { names, COLS, CELL_W, CELL_H },
  );

  const rows = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const encoded = await page.evaluate(
      ({ i, name, poses, COLS, CELL_W, CELL_H }) => {
        const out = {};
        const sheetFor = { idleA: 'idleA', attack: 'attack', cast: 'cast' };
        for (const pose of poses) {
          const canvas = document.createElement('canvas');
          canvas.width = 560;
          canvas.height = 600;
          window.spriteSheet.render(canvas, i, pose);
          const data = canvas.getContext('2d').getImageData(0, 0, 560, 600).data;
          let binary = '';
          const CHUNK = 0x8000;
          for (let k = 0; k < data.length; k += CHUNK) {
            binary += String.fromCharCode.apply(null, data.subarray(k, k + CHUNK));
          }
          out[pose] = btoa(binary);

          const sheetName = sheetFor[pose];
          if (sheetName) {
            const sheet = window.__sheets[sheetName];
            const x = sheet.getContext('2d');
            const cx = (i % COLS) * CELL_W;
            const cy = Math.floor(i / COLS) * CELL_H;
            x.fillStyle = '#1a1220';
            x.fillRect(cx, cy, CELL_W, CELL_H);
            x.drawImage(canvas, cx, cy, CELL_W, CELL_H);
            x.fillStyle = '#e9c46a';
            x.font = '13px sans-serif';
            x.textBaseline = 'top';
            x.fillText(name, cx + 6, cy + 6);
          }
        }
        return out;
      },
      { i, name, poses: POSES, COLS, CELL_W, CELL_H },
    );

    const buffers = {};
    for (const pose of POSES) buffers[pose] = Buffer.from(encoded[pose], 'base64');
    const row = measure(name, buffers);
    if (paintedMode) row.painted = await page.evaluate((index) => window.spriteSheet.isPainted(index), i);
    rows.push(row);
  }

  const urls = await page.evaluate(() => ({
    idle: window.__sheets.idleA.toDataURL('image/png'),
    attack: window.__sheets.attack.toDataURL('image/png'),
    cast: window.__sheets.cast.toDataURL('image/png'),
  }));
  const prefix = paintedMode ? 'painted-' : 'sheet-';
  fs.writeFileSync(path.join(OUT, `${prefix}idle.png`), Buffer.from(urls.idle.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, `${prefix}attack.png`), Buffer.from(urls.attack.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, `${prefix}cast.png`), Buffer.from(urls.cast.split(',')[1], 'base64'));
  if (!paintedMode) {
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(rows, null, 2) + '\n');
  }

  await browser.close();

  if (baselineMode && !paintedMode) {
    const baseline = {};
    for (const r of rows) baseline[r.name] = { h: r.h, w: r.w };
    fs.writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n');
    printTable(rows, null);
    console.log(`sprites: baseline written for ${rows.length} units`);
    return;
  }

  const baseline = exists(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
  const passed = check(rows, baseline, paintedMode);
  if (paintedMode) {
    fs.writeFileSync(path.join(OUT, 'painted-report.json'), JSON.stringify(rows, null, 2) + '\n');
  }
  printTable(rows, baseline, paintedMode);
  console.log(
    paintedMode
      ? `sprites (painted): ${passed}/${rows.length} pass`
      : `sprites: ${passed}/${rows.length} pass`,
  );
  if (passed !== rows.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
