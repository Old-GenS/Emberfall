## Goal

Make Emberfall an installable, offline-capable PWA. It must work at its GitHub Pages URL (`https://old-gens.github.io/Emberfall/`, served from a sub-path), which works today because Vite uses `base: './'`.

- **Install:** a web app manifest and proper icons, generated from `tools/icon/source.png`.
- **Offline:** a service worker precaches the whole built game, including every image and font, so it plays with no connection after the first load.
- **Updates:** when a new version is deployed, show a small "New version ready — Reload" toast, never during a battle.

## Files to touch

- `package.json` / `package-lock.json`: devDependency `vite-plugin-pwa@2.0.0`; scripts `icons`, `check:pwa`
- `tools/icon/make-icons.mjs`: new, generates the PNG icons with `sharp` (already a devDependency)
- `public/icons/*.png`: generated icons (committed)
- `vite.config.ts`: the PWA plugin and manifest
- `index.html`: icon and apple-touch links
- `src/pwa.ts`: new, service-worker registration and the update/offline toasts
- `src/main.ts`: call `initPwa`; the debug hook
- `src/style.css`: toast styles
- `src/vite-env.d.ts`: PWA client types
- `tools/pwa-check.mjs`: new browser check
- `README.md`: a short "Install / play offline" section

## Steps

1. Run `npm ci`, then `npm install -D vite-plugin-pwa@2.0.0`. Its peer dependencies (`workbox-build`, `workbox-window`) install automatically with npm 7+; if they don't, install them as devDependencies too.

2. **Icons: `tools/icon/make-icons.mjs`** (Node ESM, `sharp`). It reads `tools/icon/source.png` (1024×1024, dark background with a centred round emblem) and writes:
   - `public/icons/icon-192.png` and `public/icons/icon-512.png`: the source resized, full bleed.
   - `public/icons/icon-maskable-512.png`: a 512×512 canvas filled with `#07050c`, with the source resized to 400×400 composited in the centre, so the emblem sits inside the maskable safe zone.
   - `public/icons/apple-touch-icon.png`: 180×180, full bleed, no alpha (flatten on `#07050c`).
   - `public/icons/favicon-32.png`: 32×32.

   All outputs are PNG with no alpha channel. Add the script `"icons": "node tools/icon/make-icons.mjs"`, run it once, and keep the generated files in the repo.

3. **`vite.config.ts`:** keep `base: './'` and add `VitePWA` from `vite-plugin-pwa`:

   ```ts
   VitePWA({
     registerType: 'prompt',
     injectRegister: false,              // src/pwa.ts registers it
     includeAssets: ['icons/*.png'],
     manifest: {
       id: './',
       name: 'Emberfall — Legends of the Shattered Vale',
       short_name: 'Emberfall',
       description: 'A gothic stained-glass auto-battler RPG. Choose a hero, cross five doomed realms, and rekindle the world.',
       start_url: './',
       scope: './',
       display: 'fullscreen',
       display_override: ['fullscreen', 'standalone'],
       orientation: 'any',
       background_color: '#07050c',
       theme_color: '#07050c',
       icons: [
         { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
         { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
         { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
       ],
     },
     workbox: {
       globPatterns: ['**/*.{js,css,html,woff2,webp,jpg,jpeg,png,svg,json,webmanifest}'],
       maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
       navigateFallback: 'index.html',
       cleanupOutdatedCaches: true,
     },
     devOptions: { enabled: false },
   })
   ```

   The build must produce `dist/manifest.webmanifest` and `dist/sw.js`, with the manifest linked from `dist/index.html` using a **relative** href. If the plugin writes an absolute `/manifest.webmanifest` link, fix it so it works under `/Emberfall/`, e.g. with the plugin's `manifestFilename` / `useCredentials` options or a relative base. Note what you did in the report.

4. **`index.html`:**
   - Keep the existing SVG data-URI favicon.
   - Add `<link rel="icon" type="image/png" sizes="32x32" href="./icons/favicon-32.png" />` and `<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />`.
   - Add `<meta name="apple-mobile-web-app-title" content="Emberfall" />`.
   - Leave the existing meta tags alone.

5. **`src/pwa.ts`:** `export function initPwa(opts: { isBusy: () => boolean }): void`.
   - It uses `registerSW` from `virtual:pwa-register` with `immediate: true`.
   - `onNeedRefresh`: remember that an update is pending. While `opts.isBusy()` is true (a battle is on screen), wait and re-check every 2 s. When not busy, show a persistent toast: "A new version of Emberfall is ready." with a **Reload** button (calls the `updateSW(true)` returned by `registerSW`) and a dismiss ✕.
   - `onOfflineReady`: show a short-lived toast "Emberfall is ready to play offline" (auto-hides after 4 s) once.
   - Expose `__emberfallPwa = { needRefresh: () => void, offlineReady: () => void }` on `window` **only** when `location.search` contains `debug=1`. These simulate the two callbacks for the check.
   - The toast is a fixed element at the bottom centre, above the battle UI's z-index, styled to match the game (dark glass, gold border, `var(--display)` font for the button) with `.pwa-toast` classes in `src/style.css`. It must fit at 390 px width without horizontal scroll.

6. **`src/main.ts`:** in `boot()`, call `initPwa({ isBusy: () => screen === 'battle' })`. Change nothing else.

7. **`src/vite-env.d.ts`:** add `/// <reference types="vite-plugin-pwa/client" />`.

8. **`tools/pwa-check.mjs`** uses the same setup as `tools/battle-fx-check.mjs`: a `node:http` static server for `dist/` on an ephemeral port, plus the `.webmanifest` MIME type `application/manifest+json` and `.js` for `sw.js`. Same Chromium path logic and `--no-sandbox`, viewport 1280×800, page errors collected.
   - Serve `dist/` under the sub-path `/Emberfall/`: requests to `/Emberfall/...` map to `dist/...`, and everything else returns 404. This proves the sub-path works.
   - Use a fresh `browser.newContext()`. The page URL is `/Emberfall/?debug=1`.

   Print PASS/FAIL with a detail for each check:
   1. **Manifest linked:** `link[rel=manifest]` exists. Its resolved URL starts with `/Emberfall/` and returns 200 with valid JSON. The JSON has `short_name` "Emberfall", `display` "fullscreen", `start_url` and `scope` "./", and icons with a 192 and a 512 `purpose: any` plus a 512 `maskable`.
   2. **Icons valid:** every manifest icon, plus `apple-touch-icon` and `favicon-32`, returns 200, is a PNG, and its width/height (read from the IHDR bytes 16–23) match the declared size (180 for apple-touch, 32 for the favicon).
   3. **Service worker active:** within 15 s, `navigator.serviceWorker.ready` resolves with an active worker whose scope ends with `/Emberfall/`.
   4. **Everything precached:**
      - after reloading once (so the page is controlled), list every file under `dist/assets/units`, `dist/assets/realms`, `dist/assets/fx`, `dist/assets/portraits` and `dist/assets/fonts`, plus `index.html` and the built JS/CSS;
      - every one is found in Cache Storage (`caches.match` from the page).
      - Print the count.
   5. **Offline title:** `context.setOffline(true)`, reload. The title screen renders (`[data-nav="classes"]` visible) with no page errors.
   6. **Offline battle:**
      - still offline, click `[data-nav="classes"]`, then `[data-choose="warden"]`, and wait 2000 ms;
      - `window.__emberfall.battle` exists and is not ended;
      - `fetch('./assets/units/warden.webp')` and one realm image (`./assets/realms/ashen-reach.jpg`) both resolve with `ok` from the page;
      - save a screenshot of the arena to `sprite-out/pwa-offline.png`.
   7. **Update toast waits for battle:**
      - still in the battle, call `__emberfallPwa.needRefresh()` and wait 2500 ms. No `.pwa-toast` is visible.
      - Then `context.setOffline(false)`, click `#pause-btn`, then `[data-pause="quit"]` to reach the map, and wait 2500 ms. A visible `.pwa-toast` contains "new version" (case-insensitive) and a Reload button.
   8. **Phone fit:** a new page at 390×844 in the same context, `/Emberfall/?debug=1`. Call `__emberfallPwa.offlineReady()`. The toast is visible and `document.documentElement.scrollWidth <= 390`.
   9. **No page errors** over the whole run.

   Print `pwa-check: N/N pass` last and exit 1 on any failure. Always close the browser and the server. Script: `"check:pwa": "npm run build && node tools/pwa-check.mjs"`.

9. **`README.md`:** add a short "Install & play offline" section:
   - Chrome/Edge/Android: the browser's Install app option.
   - iOS: Share → Add to Home Screen.
   - It plays offline after the first visit.
   - Updates show a Reload toast.
   - Saves stay in the browser.

## Acceptance

- `npx tsc --noEmit -p .` exits 0.
- `npm run check:pwa` exits 0 and its last line is `pwa-check: 9/9 pass`.
- `npm run check:guard` exits 0 and its last line is `guard-check: 9/9 pass`.
- `npm run check:fx` exits 0 and its last line is `battle-fx-check: 9/9 pass`.
- `npm run check:hover` exits 0 and its last line is `hovercard-check: 8/8 pass`.
- `npm run check:run` exits 0 and its last line is `run-check: 9/9 pass`.
- `npm run sprites` exits 0 and its last line is `sprites: 25/25 pass`.
- `test -f public/icons/icon-512.png && test -f public/icons/icon-maskable-512.png && test -f public/icons/apple-touch-icon.png && test -f dist/sw.js && test -f dist/manifest.webmanifest` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- A step may touch a file outside **Files to touch** when it has to. List every such file in the report under "outside the plan", one line each saying why.
- The only checks to run are the Acceptance commands. Do not write or run extra end-to-end tests, and do not start a dev server; the check scripts' own static servers are the only servers allowed. If something outside Acceptance fails, note it in the report and finish.
- Do not change gameplay, balance, art in `public/assets`, `src/combat.ts`, `src/data.ts`, `src/balance.ts`, `src/art.ts`, `tools/balance/*` or `.github/workflows/deploy.yml`. The existing deploy workflow (`npm ci` + `npm run build` + upload `dist/`) must keep working unchanged.
- The service worker must never reload the page on its own. Updates happen only through the Reload button.
- Keep `base: './'`. Do not hard-code `/Emberfall/` anywhere in the app or the manifest; only the check uses it, to simulate Pages.

## Out of scope

- Push notifications, background sync, app-store packaging, splash-screen images.
- Changing the game's layout for the installed display modes, beyond the toast.

## If blocked

- If `vite-plugin-pwa@2.0.0` fails to install or build with this Vite version, use `vite-plugin-pwa@1.3.0` with the same options and say so in the report.
- If Chromium will not launch, try `dnf install -y chromium` once. If it still fails, stop and report.
- If the service worker will not register under the sub-path server, stop and report the exact error rather than changing `base`.
