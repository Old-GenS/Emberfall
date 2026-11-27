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
const EVENT_KINDS = ['ember', 'spore', 'snow', 'bubble', 'ash'];

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
    // A short-lived concrete port on loopback (this sandbox refuses OS-assigned listen(0) ports).
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

    const text = async (selector) => (await page.locator(selector).textContent()) ?? '';
    const visible = async (selector) => page.locator(selector).isVisible();
    // Grab the arena canvas directly: an element screenshot in this environment takes several
    // seconds, long enough for a 2.5 s realm event to finish before the frame is captured.
    const shotArena = async (name) => {
      const data = await page.evaluate(() => document.getElementById('battle-canvas').toDataURL('image/png'));
      fs.writeFileSync(path.join(SPRITE_OUT, name), Buffer.from(data.split(',')[1], 'base64'));
    };
    const spark = () => page.evaluate(() => {
      const s = window.__emberfall?.realmEvents?.spark;
      return s ? { x: s.x, y: s.y, age: s.age } : null;
    });
    const ultCharge = () => page.evaluate(() => window.__emberfall?.battle?.hero?.ultCharge ?? -1);

    // Start a Warden battle. A pointer click supplies the gesture Chromium's autoplay policy wants.
    await page.goto(`${base}?debug=1`, { waitUntil: 'load' });
    await page.click('[data-nav="classes"]');
    await page.click('[data-choose="warden"]');
    await page.waitForTimeout(1200);
    assert(await page.evaluate(() => !!window.__emberfall), '__emberfall debug hook is missing');

    const checks = [
      ['Speed cycles', async () => {
        const labels = [];
        for (let i = 0; i < 3; i++) {
          await page.click('#speed-btn');
          labels.push(await text('#speed-btn'));
        }
        assert(labels.join(',') === '2×,3×,1×', `labels were ${labels.join(',')}`);
        return `labels ${labels.join(' -> ')}`;
      }],
      ['Speed persists', async () => {
        await page.click('#speed-btn');
        await page.click('#speed-btn');
        assert(await text('#speed-btn') === '3×', 'could not set 3× before reload');
        await page.reload({ waitUntil: 'load' });
        await page.click('[data-nav="map"]');
        await page.locator('.btn[data-battle]').first().click();
        await page.waitForTimeout(1200);
        const label = await text('#speed-btn');
        assert(label === '3×', `after reload the speed button read ${label}`);
        await page.click('#speed-btn');
        assert(await text('#speed-btn') === '1×', 'could not reset to 1×');
        return '3× survived reload and battle start; reset to 1×';
      }],
      ['No enrage before 30 s', async () => {
        assert(await page.locator('#enrage-chip').isHidden(), '#enrage-chip is visible');
        const started = await page.evaluate(() => window.__emberfall.renderer.enrageStartedAt);
        assert(started === null, `enrageStartedAt was ${String(started)}`);
        return 'chip hidden, enrageStartedAt null';
      }],
      ['Enrage shows', async () => {
        // Keep this battle alive while the enrage/event checks run; combat outcome is not under test.
        await page.evaluate(() => {
          const b = window.__emberfall.battle;
          b.hero.stats.maxHp = 1e9;
          b.hero.hp = 1e9;
          for (const e of b.enemies) {
            e.stats.maxHp = 1e9;
            e.hp = 1e9;
          }
        });
        await page.evaluate(() => { window.__emberfall.battle.time = 36; });
        await page.waitForTimeout(600);
        assert(await visible('#enrage-chip'), '#enrage-chip stayed hidden');
        const mult = await text('#enrage-mult');
        assert(/^×1\.[0-9]$/.test(mult), `#enrage-mult was ${mult}`);
        const started = await page.evaluate(() => window.__emberfall.renderer.enrageStartedAt);
        assert(started !== null, 'enrageStartedAt is still null');
        const intense = await page.evaluate(() => window.__emberfall.audio.intensity === true);
        assert(intense, 'audio.intensity is not true');
        await shotArena('fx-enrage.png');
        return `chip ${mult}, enrageStartedAt ${Number(started).toFixed(2)}, music intense`;
      }],
      ['Events play', async () => {
        const seen = [];
        for (const kind of EVENT_KINDS) {
          await page.evaluate((k) => window.__emberfall.realmEvents.forceEvent(k), kind);
          await page.waitForTimeout(1200);
          seen.push(await page.evaluate(() => {
            const ev = window.__emberfall.realmEvents;
            return ev.current ? `${ev.current.kind}@${ev.current.age.toFixed(2)}` : 'null';
          }));
          await shotArena(`fx-${kind}.png`);
          await page.waitForTimeout(1600);
        }
        const played = await page.evaluate(() => window.__emberfall.realmEvents.eventsPlayed);
        assert(played >= 5, `eventsPlayed was ${played}`);
        assert(pageErrors.length === 0, `page error: ${pageErrors[0]}`);
        return `${played} events played, five screenshots (${seen.join(', ')})`;
      }],
      ['A spark appears', async () => {
        // Clear any nearly-expired spark, then force one more event so this check always sees
        // a spark that is comfortably inside its 5 s life.
        await page.evaluate(() => {
          const ev = window.__emberfall.realmEvents;
          const s = ev.spark;
          if (s) ev.hit(s.x, s.y + Math.sin(s.age * 3) * 4);
          ev.forceEvent();
        });
        // Events age in battle time (0.75 s per real second), so a 2.5 s event needs ~3.4 s.
        await page.waitForTimeout(3800);
        let s = await spark();
        if (!s) {
          const diag = await page.evaluate(() => {
            const b = window.__emberfall.battle;
            const ev = window.__emberfall.realmEvents;
            return `ended ${b.ended}, victory ${b.victory}, heroAlive ${b.hero.alive}, hp ${Math.round(b.hero.hp)}, enemies ${b.enemies.map((e) => `${e.alive}:${Math.round(e.hp)}`).join('/')}, current ${ev.current ? `${ev.current.kind}@${ev.current.age.toFixed(2)}` : 'null'}`;
          });
          throw new Error(`no spark after the events (${diag})`);
        }
        return `spark at ${Math.round(s.x)},${Math.round(s.y)} age ${s.age.toFixed(2)} after one more event`;
      }],
      ['A miss doesn\'t collect', async () => {
        const s = await spark();
        assert(s, 'there is no spark to miss');
        const point = await page.evaluate(({ x, y }) => window.__emberfall.renderer.toClient(x, y), { x: s.x - 150, y: s.y });
        await page.mouse.click(point.x, point.y);
        await page.waitForTimeout(250);
        assert(await spark(), 'the spark was collected by a miss');
        return `clicked 150 px left at ${Math.round(point.x)},${Math.round(point.y)}`;
      }],
      ['Collecting a spark', async () => {
        await page.evaluate(() => { window.__emberfall.battle.hero.ultCharge = 10; });
        const s = await spark();
        assert(s, 'there is no spark to collect');
        const point = await page.evaluate(({ x, y }) => window.__emberfall.renderer.toClient(x, y), { x: s.x, y: s.y });
        await page.mouse.click(point.x, point.y);
        await page.waitForTimeout(300);
        if (await spark()) {
          const diag = await page.evaluate(({ px, py }) => {
            const el = document.elementFromPoint(px, py);
            const p = window.__emberfall.renderer.toDesign(px, py);
            return `${el?.tagName ?? 'none'}#${el?.id ?? ''}.${el?.className ?? ''} @ design ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          }, { px: point.x, py: point.y });
          throw new Error(`the spark still exists after the tap (${diag})`);
        }
        const charge = await ultCharge();
        assert(charge >= 24, `ultCharge was ${charge}`);
        return `spark collected, ultCharge ${Math.round(charge)}`;
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

  console.log(`battle-fx-check: ${passed}/${TOTAL} pass`);
  process.exitCode = passed === TOTAL ? 0 : 1;
}

await main();
