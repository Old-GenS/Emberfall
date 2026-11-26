import { chromium } from 'playwright-core';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
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
const TOTAL = 8;

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

async function cardBox(page) {
  const box = await page.locator('.hovercard').boundingBox();
  assert(box, 'hovercard has no bounding box');
  const viewport = page.viewportSize();
  assert(viewport, 'page has no viewport');
  const inside = box.x >= -0.5
    && box.y >= -0.5
    && box.x + box.width <= viewport.width + 0.5
    && box.y + box.height <= viewport.height + 0.5;
  assert(inside, `card ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)} outside ${viewport.width}x${viewport.height}`);
  return box;
}

async function cardText(page) {
  return (await page.locator('.hovercard').textContent()) ?? '';
}

async function hoverSettled(page, selector) {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  await target.hover();
}

async function main() {
  if (!exists(DIST)) throw new Error(`Missing dist: ${DIST} (run npm run build)`);
  const executablePath = findChromium();
  if (!executablePath) throw new Error('No Chromium binary found (set CHROMIUM_PATH)');

  const server = staticServer();
  let browser = null;
  let passed = 0;

  try {
    // A short-lived port on loopback. This sandbox refuses connections to OS-assigned
    // listen(0) ports, so pick a concrete free high port instead.
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

    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    const checks = [
      ['Desktop card on the Warden skill chip', async () => {
        await page.goto(base, { waitUntil: 'load' });
        await page.click('[data-nav="classes"]');
        await page.waitForSelector('[data-tip="skill:warden:0"]');
        await hoverSettled(page, '[data-tip="skill:warden:0"]');
        await page.waitForTimeout(300);
        assert(await page.locator('.hovercard').isVisible(), 'card is not visible');
        const text = await cardText(page);
        assert(text.includes('Shield Slam'), 'missing Shield Slam');
        assert(text.includes('130% ATK'), 'missing 130% ATK');
        assert(text.includes('Stun'), 'missing Stun');
        const box = await cardBox(page);
        return `visible ${Math.round(box.width)}x${Math.round(box.height)} at ${Math.round(box.x)},${Math.round(box.y)}`;
      }],
      ['Leaving the anchor hides the card', async () => {
        await page.mouse.move(5, 5);
        await page.waitForTimeout(300);
        assert(await page.locator('.hovercard').isHidden(), 'card is still visible');
        return 'hidden after pointer move';
      }],
      ['No Shield Slam title attribute on the class screen', async () => {
        const titles = await page.$$eval('[title]', (els) => els
          .map((el) => el.getAttribute('title') ?? '')
          .filter((title) => title.includes('Shield Slam')));
        assert(titles.length === 0, `${titles.length} matching title attribute(s)`);
        return '0 matching title attributes';
      }],
      ['Keyboard focus shows the ultimate card', async () => {
        await page.evaluate(() => {
          document.querySelector('[data-tip="skill:warden:ult"]').focus();
        });
        await page.waitForTimeout(100);
        assert(await page.locator('.hovercard').isVisible(), 'card is not visible');
        const text = await cardText(page);
        assert(text.includes('Ultimate'), 'missing Ultimate');
        return 'ultimate card shown on focus';
      }],
      ['Far-right card stays inside the viewport', async () => {
        await hoverSettled(page, '[data-tip="skill:spiritcaller:ult"]');
        await page.waitForTimeout(300);
        assert(await page.locator('.hovercard').isVisible(), 'card is not visible');
        const box = await cardBox(page);
        return `right edge ${Math.round(box.x + box.width)} of 1280`;
      }],
      ['Battle slot card and unpaused battle', async () => {
        await page.click('[data-choose="warden"]');
        await page.waitForTimeout(1500);
        await page.hover('#ab-0');
        await page.waitForTimeout(300);
        assert(await page.locator('.hovercard').isVisible(), 'card is not visible');
        const text = await cardText(page);
        assert(text.includes('Shield Slam'), 'missing Shield Slam');
        assert(text.includes('6.5s'), 'missing 6.5s');
        assert(await page.getAttribute('#ab-0', 'title') === null, '#ab-0 still has a title');
        const before = await page.locator('#ult-pct').textContent();
        await page.waitForTimeout(1500);
        const after = await page.locator('#ult-pct').textContent();
        assert(before !== after, `#ult-pct did not change (${before})`);
        return `#ult-pct ${before} -> ${after}`;
      }],
      ['Map boon card', async () => {
        await page.evaluate(() => {
          const raw = localStorage.getItem('emberfall-save-v1');
          const save = raw ? JSON.parse(raw) : {};
          save.version = 1;
          save.boons = ['keen-edge'];
          save.stage = 1;
          localStorage.setItem('emberfall-save-v1', JSON.stringify(save));
        });
        await page.reload({ waitUntil: 'load' });
        await page.click('[data-nav="map"]');
        await page.waitForSelector('[data-tip="boon:keen-edge"]');
        await hoverSettled(page, '[data-tip="boon:keen-edge"]');
        await page.waitForTimeout(300);
        assert(await page.locator('.hovercard').isVisible(), 'card is not visible');
        const text = await cardText(page);
        assert(text.includes('Keen Edge'), 'missing Keen Edge');
        assert(text.includes('Common boon'), 'missing Common boon');
        return 'Keen Edge / Common boon shown';
      }],
      ['Phone keeps inline tips and ignores taps', async () => {
        const phoneContext = await browser.newContext({
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        });
        try {
          const phone = await phoneContext.newPage();
          phone.setDefaultTimeout(15000);
          await phone.goto(base, { waitUntil: 'load' });
          await phone.tap('[data-nav="classes"]');
          await phone.waitForSelector('[data-class="warden"]');
          const inlineVisible = await phone.locator('[data-class="warden"] .skill-tip').first().isVisible();
          assert(inlineVisible, 'inline skill tip is not visible');
          await phone.tap('[data-tip="skill:warden:0"]');
          await phone.waitForTimeout(300);
          assert(await phone.locator('.hovercard').isHidden(), 'hovercard became visible after a tap');
          return 'inline tip visible, no hovercard after tap';
        } finally {
          await phoneContext.close();
        }
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

  console.log(`hovercard-check: ${passed}/${TOTAL} pass`);
  process.exitCode = passed === TOTAL ? 0 : 1;
}

await main();
