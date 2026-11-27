import { chromium } from 'playwright-core';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SPRITE_OUT = path.join(ROOT, 'sprite-out');
const PREFIX = '/Emberfall/';
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
  '.webmanifest': 'application/manifest+json; charset=utf-8',
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
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

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
      if (!pathname.startsWith(PREFIX)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const rel = pathname.slice(PREFIX.length) || 'index.html';
      let file = path.resolve(DIST, rel);
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

function walkFiles(dir, prefix) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

function pngInfo(bytes) {
  const header = bytes.slice(0, 24);
  const signatureOk = PNG_SIGNATURE.every((b, i) => header[i] === b);
  if (!signatureOk || header.length < 24) return { png: false };
  return {
    png: true,
    width: header.readUInt32BE(16),
    height: header.readUInt32BE(20),
  };
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
  let manifestInfo = null;

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
    const origin = `http://127.0.0.1:${port}`;
    const base = `${origin}${PREFIX}`;

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
      executablePath,
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (err) => pageErrors.push(oneLine(err)));

    const visible = async (selector) => page.locator(selector).first().isVisible();
    const toastInfo = () => page.evaluate(() => {
      const el = document.querySelector('.pwa-toast');
      if (!el) return null;
      return {
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
        text: el.textContent ?? '',
        reload: !!el.querySelector('[data-pwa="reload"]'),
      };
    });
    const shotArena = async (name) => {
      const data = await page.evaluate(() => document.getElementById('battle-canvas').toDataURL('image/png'));
      fs.writeFileSync(path.join(SPRITE_OUT, name), Buffer.from(data.split(',')[1], 'base64'));
    };

    await page.goto(`${base}?debug=1`, { waitUntil: 'load' });

    const checks = [
      ['Manifest linked', async () => {
        const linked = await page.evaluate(async () => {
          const link = document.querySelector('link[rel="manifest"]');
          if (!link) return { error: 'no link[rel=manifest]' };
          const href = link.getAttribute('href') ?? '';
          const resolved = new URL(href, document.baseURI).href;
          const res = await fetch(resolved);
          const text = await res.text();
          let json = null;
          try { json = JSON.parse(text); } catch { /* reported below */ }
          return { href, resolved, status: res.status, json };
        });
        assert(!linked.error, linked.error);
        const pathname = new URL(linked.resolved).pathname;
        assert(pathname.startsWith(PREFIX), `resolved href ${pathname} is outside ${PREFIX}`);
        assert(linked.status === 200, `manifest returned ${linked.status}`);
        assert(linked.json, 'manifest is not valid JSON');
        const m = linked.json;
        assert(m.short_name === 'Emberfall', `short_name is ${JSON.stringify(m.short_name)}`);
        assert(m.display === 'fullscreen', `display is ${JSON.stringify(m.display)}`);
        assert(m.start_url === './', `start_url is ${JSON.stringify(m.start_url)}`);
        assert(m.scope === './', `scope is ${JSON.stringify(m.scope)}`);
        const icons = Array.isArray(m.icons) ? m.icons : [];
        const hasIcon = (sizes, purpose) => icons.some((i) =>
          i.sizes === sizes &&
          String(i.purpose ?? 'any').split(/\s+/).includes(purpose) &&
          i.type === 'image/png');
        assert(hasIcon('192x192', 'any'), 'no 192x192 purpose:any PNG icon');
        assert(hasIcon('512x512', 'any'), 'no 512x512 purpose:any PNG icon');
        assert(hasIcon('512x512', 'maskable'), 'no 512x512 purpose:maskable PNG icon');
        manifestInfo = { resolved: linked.resolved, json: m };
        return `${linked.href} -> ${pathname}, ${icons.length} icons, start_url/scope "./"`;
      }],
      ['Icons valid', async () => {
        assert(manifestInfo, 'manifest was not available');
        const links = await page.evaluate(() => {
          const apple = document.querySelector('link[rel="apple-touch-icon"]');
          const favicon = document.querySelector('link[rel="icon"][type="image/png"]');
          return {
            apple: apple ? new URL(apple.getAttribute('href') ?? '', document.baseURI).href : null,
            favicon: favicon ? new URL(favicon.getAttribute('href') ?? '', document.baseURI).href : null,
          };
        });
        assert(links.apple, 'no apple-touch-icon link');
        assert(links.favicon, 'no favicon PNG link');
        const wanted = [
          ...manifestInfo.json.icons.map((icon) => ({
            url: new URL(icon.src, manifestInfo.resolved).href,
            size: Number(String(icon.sizes).split('x')[0]),
            name: icon.src,
          })),
          { url: links.apple, size: 180, name: 'apple-touch-icon' },
          { url: links.favicon, size: 32, name: 'favicon-32' },
        ];
        const seen = [];
        for (const item of wanted) {
          const fetched = await page.evaluate(async (url) => {
            const res = await fetch(url);
            const buf = new Uint8Array(await res.arrayBuffer());
            return { status: res.status, type: res.headers.get('content-type') ?? '', bytes: Array.from(buf.slice(0, 24)) };
          }, item.url);
          assert(fetched.status === 200, `${item.name} returned ${fetched.status}`);
          assert(fetched.bytes.length >= 24, `${item.name} is too small to be a PNG`);
          const info = pngInfo(Buffer.from(fetched.bytes));
          assert(info.png, `${item.name} is not a PNG`);
          assert(info.width === item.size && info.height === item.size,
            `${item.name} is ${info.width}x${info.height}, expected ${item.size}x${item.size}`);
          seen.push(`${item.name} ${info.width}x${info.height}`);
        }
        return seen.join(', ');
      }],
      ['Service worker active', async () => {
        const sw = await page.evaluate(async () => {
          const timeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('navigator.serviceWorker.ready timed out after 15 s')), 15000);
          });
          const reg = await Promise.race([navigator.serviceWorker.ready, timeout]);
          const worker = reg.active;
          if (worker && worker.state !== 'activated') {
            await Promise.race([
              new Promise((resolve) => {
                worker.addEventListener('statechange', () => {
                  if (worker.state === 'activated') resolve();
                });
                if (worker.state === 'activated') resolve();
              }),
              new Promise((_, reject) => {
                setTimeout(() => reject(new Error('worker did not reach activated within 15 s')), 15000);
              }),
            ]);
          }
          return { scope: reg.scope, active: !!reg.active, state: reg.active?.state ?? null };
        });
        assert(sw.scope.endsWith(PREFIX), `scope ${sw.scope} does not end with ${PREFIX}`);
        assert(sw.active, 'there is no active worker');
        assert(sw.state === 'activated', `worker state is ${String(sw.state)}`);
        return `scope ${sw.scope}, state ${sw.state}`;
      }],
      ['Everything precached', async () => {
        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
        const rels = ['index.html'];
        for (const dir of ['units', 'realms', 'fx', 'portraits', 'fonts']) {
          const full = path.join(DIST, 'assets', dir);
          if (exists(full)) rels.push(...walkFiles(full, `assets/${dir}`));
        }
        for (const entry of fs.readdirSync(path.join(DIST, 'assets'), { withFileTypes: true })) {
          if (entry.isFile() && /\.(js|css)$/.test(entry.name)) rels.push(`assets/${entry.name}`);
        }
        const unique = [...new Set(rels)];
        const missing = await page.evaluate(async (files) => {
          const root = new URL('./', location.href).href;
          const absent = [];
          for (const rel of files) {
            const hit = await caches.match(new URL(rel, root).href, { ignoreSearch: true });
            if (!hit) absent.push(rel);
          }
          return absent;
        }, unique);
        assert(missing.length === 0, `${missing.length} not cached: ${missing.slice(0, 5).join(', ')}`);
        return `${unique.length} files found in Cache Storage`;
      }],
      ['Offline title', async () => {
        await context.setOffline(true);
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('[data-nav="classes"]', { state: 'visible', timeout: 15000 });
        assert(pageErrors.length === 0, `page error: ${pageErrors[0]}`);
        return 'title screen rendered offline';
      }],
      ['Offline battle', async () => {
        await page.click('[data-nav="classes"]');
        await page.click('[data-choose="warden"]');
        await page.waitForTimeout(2000);
        const battle = await page.evaluate(() => {
          const b = window.__emberfall?.battle;
          return b ? { ended: b.ended, victory: b.victory } : null;
        });
        assert(battle, 'window.__emberfall.battle is missing');
        assert(!battle.ended, 'the battle already ended');
        const fetched = await page.evaluate(async () => {
          const out = {};
          for (const rel of ['./assets/units/warden.webp', './assets/realms/ashen-reach.jpg']) {
            try {
              const res = await fetch(rel);
              out[rel] = { ok: res.ok, status: res.status };
            } catch (err) {
              out[rel] = { ok: false, status: 0, error: String(err) };
            }
          }
          return out;
        });
        const unit = fetched['./assets/units/warden.webp'];
        const realm = fetched['./assets/realms/ashen-reach.jpg'];
        assert(unit.ok, `warden.webp fetch failed (${unit.status})`);
        assert(realm.ok, `ashen-reach.jpg fetch failed (${realm.status})`);
        await shotArena('pwa-offline.png');
        return 'battle running, unit + realm fetched, screenshot saved';
      }],
      ['Update toast waits for battle', async () => {
        await page.evaluate(() => window.__emberfallPwa.needRefresh());
        await page.waitForTimeout(2500);
        assert(!(await visible('.pwa-toast')), 'a toast appeared during the battle');
        await context.setOffline(false);
        await page.click('#pause-btn');
        await page.click('[data-pause="quit"]');
        await page.waitForTimeout(2500);
        const info = await toastInfo();
        assert(info, 'no .pwa-toast after leaving the battle');
        assert(info.visible, 'the .pwa-toast is not visible');
        assert(/new version/i.test(info.text), `toast said ${JSON.stringify(info.text)}`);
        assert(info.reload, 'the toast has no Reload button');
        return 'hidden during battle, shown with Reload on the map';
      }],
      ['Phone fit', async () => {
        const phone = await context.newPage();
        phone.on('pageerror', (err) => pageErrors.push(oneLine(err)));
        await phone.setViewportSize({ width: 390, height: 844 });
        await phone.goto(`${base}?debug=1`, { waitUntil: 'load' });
        await phone.evaluate(() => window.__emberfallPwa.offlineReady());
        const toastVisible = await phone.locator('.pwa-toast').first().isVisible();
        assert(toastVisible, 'the offline toast is not visible at 390 px');
        const scrollWidth = await phone.evaluate(() => document.documentElement.scrollWidth);
        assert(scrollWidth <= 390, `documentElement.scrollWidth is ${scrollWidth}`);
        return `toast visible, scrollWidth ${scrollWidth}`;
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

  console.log(`pwa-check: ${passed}/${TOTAL} pass`);
  process.exitCode = passed === TOTAL ? 0 : 1;
}

await main();
