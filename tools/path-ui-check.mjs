import { chromium } from 'playwright-core';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SPRITE_OUT = path.join(ROOT, 'sprite-out');
const CHROMIUM_CANDIDATES = [
  '/usr/lib64/chromium-browser/chromium-browser',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json; charset=utf-8',
};
const TOTAL = 9;
const SAVE_KEY = 'emberfall-save-v1';
// src/data.ts AFFIXES[].name — an elite node always names its champion after one of these.
const AFFIX_NAMES = ['Burning', 'Swift', 'Armored', 'Vampiric'];

const exists = (p) => {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
};

const oneLine = (err) => String(err instanceof Error ? err.message : err).split('\n')[0];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  return CHROMIUM_CANDIDATES.find(exists);
}

function staticServer() {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      let file = path.resolve(DIST, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (file !== DIST && !file.startsWith(`${DIST}${path.sep}`)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      const body = fs.readFileSync(file);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
}

/** A complete, valid save; normalizeSave fills anything else. */
const makeSave = (overrides = {}) => ({
  version: 1,
  classId: 'warden',
  level: 1,
  xp: 0,
  stage: 1,
  boons: [],
  sound: false,
  music: false,
  sfxVolume: 0,
  musicVolume: 0,
  seenIntro: true,
  battleSpeed: 1,
  runSeed: 1,
  hpPct: 1,
  node: null,
  path: ['fight'],
  ...overrides,
});

async function main() {
  if (!exists(DIST)) throw new Error(`Missing dist: ${DIST} (run npm run build)`);
  const executablePath = findChromium();
  if (!executablePath) throw new Error('No Chromium binary found (set CHROMIUM_PATH)');
  fs.mkdirSync(SPRITE_OUT, { recursive: true });

  const server = staticServer();
  let browser = null;
  let passed = 0;
  const pageErrors = [];

  try {
    let port = 0;
    for (let attempt = 0; attempt < 20 && !port; attempt++) {
      const candidate = 20000 + Math.floor(Math.random() * 40000);
      try {
        await new Promise((resolve, reject) => {
          const onError = (err) => { server.off('listening', onListening); reject(err); };
          const onListening = () => { server.off('error', onError); resolve(); };
          server.once('error', onError);
          server.once('listening', onListening);
          server.listen(candidate, '127.0.0.1');
        });
        port = candidate;
      } catch {
        // EADDRINUSE: try another short-lived port.
      }
    }
    assert(port, 'could not bind a local server port');
    const base = `http://127.0.0.1:${port}/`;

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
      executablePath,
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (err) => pageErrors.push(oneLine(err)));

    const setSave = async (save) => {
      await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: SAVE_KEY, value: save });
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('.title-screen');
    };
    const openMap = async () => {
      await page.click('[data-nav="map"]');
      await page.waitForSelector('.map-layout');
    };
    const openPathFromMap = async () => {
      await openMap();
      await page.locator('.btn[data-battle]').first().click();
      await page.waitForSelector('.path-screen .path-card[data-node]');
    };
    const readSave = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    const findSeed = (node, stage = 1) => page.evaluate(({ node, stage }) => {
      for (let seed = 1; seed <= 5000; seed++) {
        if (window.__emberfallPath.nodeOffer(stage, seed).includes(node)) return seed;
      }
      return 0;
    }, { node, stage });

    const checks = [
      ['Step 0 has no choice', async () => {
        await page.goto(`${base}?debug=1`, { waitUntil: 'load' });
        await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
        await page.reload({ waitUntil: 'load' });
        await page.click('[data-nav="classes"]');
        await page.click('[data-choose="warden"]');
        await page.waitForSelector('#battle-canvas');
        const inBattle = await page.evaluate(() => !!window.__emberfall?.battle);
        assert(inBattle, 'choosing warden did not start a battle');
        return 'warden starts the step-0 battle directly';
      }],
      ['Choice screen', async () => {
        const seed = 12345;
        await setSave(makeSave({ stage: 1, node: null, runSeed: seed, path: ['fight'], hpPct: 0.55 }));
        await openMap();
        await page.locator('.btn[data-battle]').first().click();
        await page.waitForSelector('.path-screen .path-card[data-node]');
        const nodes = await page.locator('.path-card[data-node]').evaluateAll((els) => els.map((el) => el.dataset.node));
        const expected = await page.evaluate((s) => window.__emberfallPath.nodeOffer(1, s), seed);
        assert(nodes.length === 2, `${nodes.length} path cards appeared`);
        assert(JSON.stringify(nodes) === JSON.stringify(expected), `cards ${nodes.join(',')} !== offer ${expected.join(',')}`);
        await page.screenshot({ path: path.join(SPRITE_OUT, 'path-choice.png'), fullPage: true });
        return `${nodes.join(' / ')} offered, path-choice.png saved`;
      }],
      ['Shrine Rest', async () => {
        const seed = await findSeed('shrine');
        assert(seed, 'no seed offered a step-1 shrine');
        await setSave(makeSave({ stage: 1, node: null, runSeed: seed, path: ['fight'], hpPct: 0.4 }));
        await openPathFromMap();
        await page.click('[data-node="shrine"]');
        await page.waitForSelector('[data-shrine="rest"]');
        await page.click('[data-shrine="rest"]');
        await page.waitForSelector('.map-layout');
        const save = await readSave();
        assert(Math.abs(save.hpPct - 0.75) < 0.01, `hpPct ${save.hpPct} !== 0.75`);
        assert(save.stage === 2, `stage ${save.stage} !== 2`);
        assert(save.path[1] === 'shrine', `path[1] ${save.path[1]} !== shrine`);
        return `hp ${save.hpPct.toFixed(2)}, stage ${save.stage}, path ${save.path.join(',')}`;
      }],
      ['Shrine Offering', async () => {
        const seed = await findSeed('shrine');
        await setSave(makeSave({ stage: 1, node: null, runSeed: seed, path: ['fight'], hpPct: 0.4 }));
        await openPathFromMap();
        await page.click('[data-node="shrine"]');
        await page.waitForSelector('[data-shrine="offering"]');
        await page.click('[data-shrine="offering"]');
        await page.waitForSelector('.boon-card');
        const classes = await page.locator('.boon-card').evaluateAll((els) => els.map((el) => el.className));
        assert(classes.length === 3, `${classes.length} boon cards, expected 3`);
        assert(classes.every((c) => !c.split(/\s+/).includes('common')), `a common card appeared: ${classes.join(' | ')}`);
        return `${classes.length} cards, rarities ${classes.map((c) => c.split(/\s+/).find((x) => x === 'rare' || x === 'epic')).join('/')}`;
      }],
      ['Event', async () => {
        const seed = await findSeed('event');
        assert(seed, 'no seed offered a step-1 event');
        await setSave(makeSave({ stage: 1, node: null, runSeed: seed, path: ['fight'], hpPct: 0.7 }));
        await openPathFromMap();
        await page.click('[data-node="event"]');
        await page.waitForSelector('[data-event-choice]');
        const shownTitle = (await page.textContent('.event-card h1'))?.trim();
        const expectedTitle = await page.evaluate((s) => window.__emberfallPath.eventFor(1, s).title, seed);
        assert(shownTitle === expectedTitle, `title ${shownTitle} !== ${expectedTitle}`);
        await page.locator('[data-event-choice]').nth(1).click();
        await page.waitForSelector('[data-event-continue]');
        await page.click('[data-event-continue]');
        await page.waitForSelector('.map-layout');
        const save = await readSave();
        assert(save.stage === 2, `stage ${save.stage} !== 2`);
        return `${shownTitle}, second choice, stage ${save.stage}`;
      }],
      ['Elite', async () => {
        const seed = await findSeed('elite');
        assert(seed, 'no seed offered a step-1 elite');
        await setSave(makeSave({ stage: 1, node: null, runSeed: seed, path: ['fight'], hpPct: 0.8 }));
        await openPathFromMap();
        await page.click('[data-node="elite"]');
        await page.waitForSelector('#battle-canvas');
        await page.waitForFunction(() => !!window.__emberfall?.battle);
        const names = await page.evaluate(() => window.__emberfall.battle.enemies.map((e) => e.name));
        assert(names.some((n) => AFFIX_NAMES.some((a) => n.startsWith(a))), `no affixed elite in: ${names.join(', ')}`);
        await page.evaluate(() => {
          const b = window.__emberfall.battle;
          for (const e of b.enemies) { e.hp = 0; e.alive = false; }
          b.update(0);
        });
        await page.waitForSelector('[data-result="spoils"]');
        const overlay = await page.textContent('.result-panel');
        assert(/Elite slain · rare boon/.test(overlay ?? ''), `elite chip missing from overlay: ${overlay}`);
        await page.click('[data-result="spoils"]');
        await page.waitForSelector('.boon-card');
        const classes = await page.locator('.boon-card').evaluateAll((els) => els.map((el) => el.className));
        assert(classes.length > 0, 'no reward cards after the elite');
        assert(classes.every((c) => !c.split(/\s+/).includes('common')), `a common card appeared: ${classes.join(' | ')}`);
        await page.locator('.boon-card').first().click();
        await page.waitForSelector('.map-layout');
        return `affixed elite (${names.find((n) => AFFIX_NAMES.some((a) => n.startsWith(a)))}) slain, ${classes.length} rare+ cards, chip shown`;
      }],
      ['Map history', async () => {
        const dotted = await page.locator('.stage-node.done[data-node]').evaluateAll((els) => els.map((el) => el.dataset.node));
        assert(dotted.includes('elite'), `cleared dots have data-node ${JSON.stringify(dotted)}`);
        const eliteDot = await page.locator('.stage-node.done[data-node="elite"]').count();
        assert(eliteDot >= 1, 'no cleared dot marked with the elite node');
        return `cleared nodes ${dotted.join(', ')}`;
      }],
      ['Phone fit', async () => {
        const seed = await findSeed('shrine');
        const phoneContext = await browser.newContext({
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        });
        try {
          const phone = await phoneContext.newPage();
          phone.setDefaultTimeout(15000);
          phone.on('pageerror', (err) => pageErrors.push(oneLine(err)));
          await phone.goto(`${base}?debug=1`, { waitUntil: 'load' });
          await phone.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
            key: SAVE_KEY,
            value: makeSave({ stage: 1, node: null, runSeed: seed, path: ['fight'], hpPct: 0.4 }),
          });
          await phone.reload({ waitUntil: 'load' });
          await phone.click('[data-nav="map"]');
          await phone.locator('.btn[data-battle]').first().click();
          await phone.waitForSelector('.path-screen .path-card[data-node]');
          const pathWidth = await phone.evaluate(() => document.documentElement.scrollWidth);
          assert(pathWidth <= 390, `path screen scrollWidth ${pathWidth} > 390`);
          await phone.click('[data-node="shrine"]');
          await phone.waitForSelector('[data-shrine="rest"]');
          const shrineWidth = await phone.evaluate(() => document.documentElement.scrollWidth);
          assert(shrineWidth <= 390, `shrine screen scrollWidth ${shrineWidth} > 390`);
          return `path ${pathWidth}/390, shrine ${shrineWidth}/390`;
        } finally {
          await phoneContext.close();
        }
      }],
      ['No page errors', async () => {
        assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`);
        return '0 page errors';
      }],
    ];

    for (let i = 0; i < checks.length; i++) {
      const [name, run] = checks[i];
      try {
        const detail = await run();
        passed++;
        console.log(`PASS ${i + 1}. ${name} — ${detail}`);
      } catch (err) {
        console.log(`FAIL ${i + 1}. ${name} — ${oneLine(err)}`);
      }
    }
  } catch (err) {
    console.log(`FAIL setup — ${oneLine(err)}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`path-ui-check: ${passed}/${TOTAL} pass`);
  process.exitCode = passed === TOTAL ? 0 : 1;
}

await main();
