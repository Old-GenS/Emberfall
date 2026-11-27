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

    const battle = (fn, arg) => page.evaluate(fn, arg);
    // Grab the arena canvas directly: element screenshots are slow enough that a 1.4 s telegraph
    // can finish before the frame is captured.
    const shotArena = async (name) => {
      const data = await page.evaluate(() => document.getElementById('battle-canvas').toDataURL('image/png'));
      fs.writeFileSync(path.join(SPRITE_OUT, name), Buffer.from(data.split(',')[1], 'base64'));
    };
    // Keep the fight alive between checks: the hero is topped up and every foe becomes a punching
    // bag with a huge HP pool, so nothing dies mid-run.
    const keepAlive = () => battle(() => {
      const b = window.__emberfall.battle;
      b.hero.hp = b.hero.stats.maxHp;
      for (const e of b.enemies) {
        e.stats.maxHp = 1e9;
        e.hp = e.stats.maxHp;
      }
    });
    // Start a forced wind-up on the first enemy that is neither stunned nor already winding up.
    // Returns the fresh telegraph's total/remaining as read in the same page call as the start.
    const forceFreeTelegraph = async () => {
      for (let attempt = 0; attempt < 40; attempt++) {
        const info = await battle(() => {
          const b = window.__emberfall.battle;
          const free = b.enemies.find((e) => e.alive
            && !e.effects.some((x) => x.kind === 'stun')
            && !b.telegraphs.some((t) => t.source === e));
          if (!free || !b.forceTelegraph(free)) return null;
          const t = b.telegraphs.find((x) => x.source === free);
          return t ? { total: t.total, remaining: t.remaining } : null;
        });
        if (info) return info;
        await page.waitForTimeout(100);
      }
      return null;
    };
    const stats = () => battle(() => ({ ...window.__emberfall.battle.guardStats }));

    const checks = [
      ['Guard button', async () => {
        await keepAlive();
        const guard = page.locator('#guard-btn');
        assert(await guard.count() === 1, '#guard-btn is missing');
        const tip = await guard.getAttribute('data-tip');
        assert(tip === 'skill:warden:guard', `data-tip was ${String(tip)}`);
        const classes = await guard.getAttribute('class');
        assert((classes ?? '').split(/\s+/).includes('ready'), `class was ${String(classes)}`);
        return 'data-tip skill:warden:guard, ready';
      }],
      ['Telegraph shows', async () => {
        await keepAlive();
        // The Warden's opening Shield Slam can stun the first foe; a heavy started on a stunned
        // source is interrupted immediately. Wait until the first living enemy is clear, then force.
        for (let attempt = 0; attempt < 50; attempt++) {
          const free = await battle(() => {
            const first = window.__emberfall.battle.enemies.find((e) => e.alive);
            return !!first && !first.effects.some((x) => x.kind === 'stun');
          });
          if (free) break;
          await page.waitForTimeout(50);
        }
        const ok = await battle(() => window.__emberfall.battle.forceTelegraph());
        assert(ok === true, 'forceTelegraph() returned false');
        let count = 0;
        for (let attempt = 0; attempt < 15; attempt++) {
          count = await battle(() => window.__emberfall.battle.telegraphs.length);
          if (count === 1) break;
          await page.waitForTimeout(20);
        }
        assert(count === 1, `${count} telegraph(s) after 300 ms`);
        await page.waitForTimeout(100);
        await shotArena('guard-telegraph.png');
        const alert = await page.evaluate(() => document.getElementById('guard-btn').classList.contains('alert'));
        assert(alert, '#guard-btn did not gain class alert');
        return 'one telegraph, alert set, guard-telegraph.png saved';
      }],
      ['Perfect guard', async () => {
        await keepAlive();
        const before = await battle(() => window.__emberfall.battle.hero.ultCharge);
        const sourceUid = await battle(() => window.__emberfall.battle.telegraphs[0]?.source.uid ?? -1);
        // Press from inside the frame that first sees remaining <= 0.3: a round-trip to Playwright
        // can lose the race against a 0.6 s guard window when the page stalls.
        const pressed = await page.evaluate(() => new Promise((resolve) => {
          const tick = () => {
            const t = window.__emberfall.battle.telegraphs[0];
            if (!t) { resolve('gone'); return; }
            if (t.remaining <= 0.3) {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', bubbles: true, cancelable: true }));
              resolve('pressed');
              return;
            }
            requestAnimationFrame(tick);
          };
          tick();
        }));
        assert(pressed === 'pressed', `telegraph ${pressed} before the guard press`);
        await page.waitForTimeout(800);
        const after = await battle(() => window.__emberfall.battle.hero.ultCharge);
        const s = await stats();
        const stunned = sourceUid >= 0 && await battle((uid) => {
          const e = window.__emberfall.battle.enemies.find((x) => x.uid === uid);
          return !!e && e.effects.some((x) => x.kind === 'stun');
        }, sourceUid);
        assert(s.perfect === 1, `guardStats.perfect was ${s.perfect}`);
        assert(after >= before + 15 || after === 100, `ultCharge ${Math.round(before)} -> ${Math.round(after)}`);
        assert(stunned || s.perfect === 1, 'source was neither stunned nor counted');
        await shotArena('guard-perfect.png');
        return `perfect ${s.perfect}, ult ${Math.round(before)} -> ${Math.round(after)}${stunned ? ', source stunned' : ''}`;
      }],
      ['Cooldown', async () => {
        await keepAlive();
        const allowed = await battle(() => window.__emberfall.battle.useGuard());
        assert(allowed === false, 'useGuard() succeeded during cooldown');
        await page.waitForTimeout(50);
        const classes = await page.getAttribute('#guard-btn', 'class');
        assert((classes ?? '').split(/\s+/).includes('cooling'), `class was ${String(classes)}`);
        return 'useGuard false, cooling shown';
      }],
      ['Unguarded heavy', async () => {
        await keepAlive();
        await battle(() => {
          const b = window.__emberfall.battle;
          b.guardCd = 0;
          b.guardActive = 0;
          // A Warden auto-cast Shield Slam would stun the source and interrupt the wind-up.
          b.hero.abilityCds = b.hero.abilityCds.map(() => 999);
        });
        const forced = await forceFreeTelegraph();
        assert(forced, 'could not start a forced telegraph');
        await page.waitForTimeout(forced.total * 1000 + 800);
        const s = await stats();
        assert(s.heavyTaken === 1, `guardStats.heavyTaken was ${s.heavyTaken}`);
        return `heavy landed for full damage in ${forced.total.toFixed(2)} s wind-up`;
      }],
      ['Early press whiffs', async () => {
        await keepAlive();
        await battle(() => {
          const b = window.__emberfall.battle;
          b.guardCd = 0;
          b.guardActive = 0;
          b.hero.abilityCds = b.hero.abilityCds.map(() => 999);
        });
        const forced = await forceFreeTelegraph();
        assert(forced, 'could not start a forced telegraph');
        const remaining = forced.remaining;
        assert(remaining > 1, `press was not early (remaining ${remaining.toFixed(2)})`);
        await page.keyboard.press('f');
        await page.waitForTimeout(forced.total * 1000 + 800);
        const s = await stats();
        assert(s.heavyTaken === 2, `guardStats.heavyTaken was ${s.heavyTaken}`);
        assert(s.perfect === 1, `guardStats.perfect was ${s.perfect}`);
        return `pressed at ${remaining.toFixed(2)} s left, heavy still landed`;
      }],
      ['Interrupt', async () => {
        await keepAlive();
        const ok = await battle(() => {
          const b = window.__emberfall.battle;
          const free = b.enemies.find((e) => e.alive
            && !e.effects.some((x) => x.kind === 'stun')
            && !b.telegraphs.some((t) => t.source === e));
          if (!free || !b.forceTelegraph(free)) return false;
          const t = b.telegraphs.find((x) => x.source === free);
          if (!t) return false;
          t.source.effects.push({ kind: 'stun', remaining: 1, power: 1, tick: 0 });
          return true;
        });
        assert(ok, 'could not force a telegraph to interrupt');
        await page.waitForTimeout(300);
        const s = await stats();
        const left = await battle(() => window.__emberfall.battle.telegraphs.length);
        assert(left === 0, `${left} telegraph(s) still active`);
        assert(s.interrupted >= 1, `guardStats.interrupted was ${s.interrupted}`);
        return `telegraph cleared, interrupted ${s.interrupted}`;
      }],
      ['Phone layout', async () => {
        await keepAlive();
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
          await phone.click('[data-nav="classes"]');
          await phone.click('[data-choose="warden"]');
          await phone.waitForTimeout(1200);
          const dims = await phone.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
          }));
          assert(dims.scrollWidth <= dims.innerWidth, `scrollWidth ${dims.scrollWidth} > ${dims.innerWidth}`);
          const boxes = {
            guard: await phone.locator('#guard-btn').boundingBox(),
            ult: await phone.locator('#ult-btn').boundingBox(),
          };
          for (const [name, box] of Object.entries(boxes)) {
            assert(box && box.width > 0 && box.height > 0, `${name} button has no box`);
            assert(box.x >= 0 && box.y >= 0
              && box.x + box.width <= dims.innerWidth + 0.5
              && box.y + box.height <= dims.innerHeight + 0.5,
            `${name} button ${box.x},${box.y} ${box.width}x${box.height} outside ${dims.innerWidth}x${dims.innerHeight}`);
          }
          return `scrollWidth ${dims.scrollWidth}/${dims.innerWidth}, both buttons inside`;
        } finally {
          await phoneContext.close();
        }
      }],
      ['No page errors', async () => {
        await keepAlive();
        assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`);
        return '0 page errors';
      }],
    ];

    // Start a Warden battle. A pointer click supplies the gesture Chromium's autoplay policy wants.
    await page.goto(`${base}?debug=1`, { waitUntil: 'load' });
    await page.click('[data-nav="classes"]');
    await page.click('[data-choose="warden"]');
    await page.waitForTimeout(1200);
    assert(await page.evaluate(() => !!window.__emberfall), '__emberfall debug hook is missing');

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

  console.log(`guard-check: ${passed}/${TOTAL} pass`);
  process.exitCode = passed === TOTAL ? 0 : 1;
}

await main();
