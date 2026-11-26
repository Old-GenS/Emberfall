## Goal

Replace the skill and boon tooltips with one polished hover card. Behaviour stays the same as now: it appears on mouse hover (and keyboard focus), disappears on leave, needs no click, and never pauses the battle. Only the presentation changes: a styled floating card with an icon, the name, a type line, the description and a short list of the real numbers. It is positioned so it never runs off screen. Phones keep their current inline descriptions.

The card replaces three tooltips:

1. the CSS `.skill-tip` tooltip on the hero cards' skill chips (`src/ui.ts` `classCard`);
2. the browser `title` tooltip on the battle skill slots (`src/ui.ts`, `<div class="ability" id="ab-${i}" title=…>`);
3. the browser `title` tooltip on the boon pills (`src/ui.ts`, `<span class="boon-pill" title=…>`).

## Files to touch

- `src/hovercard.ts`: new, the card element, content builder and hover/focus handling
- `src/ui.ts`: add `data-tip` and focusability to the three anchors, remove their `title` attributes
- `src/main.ts`: call `initHovercard()` once at boot
- `src/style.css`: card styles; hide `.skill-tip` on hover-capable devices
- `tools/hovercard-check.mjs`: new, automated browser check
- `package.json`: add script `check:hover`

## Steps

1. Run `npm ci`.

2. Create `src/hovercard.ts`, exporting `initHovercard(): void` (idempotent).
   - **The card:** one element `<div class="hovercard" role="tooltip" id="hovercard" hidden>` appended to `document.body` once, with `pointer-events: none`.
   - **Anchors:** any element with a `data-tip` attribute. Values:
     - `skill:<classId>:<index>`, where `<index>` is the ability index 0–2, `ult` or `passive`;
     - `boon:<boonId>`.
   - **Show:**
     - on `pointerover` of an anchor with `pointerType` `mouse` or `pen`, after 120 ms;
     - on `focusin` of an anchor, immediately.
     - Ignore `touch` pointers entirely.
   - **Hide** on `pointerout` / `focusout` of the anchor, on `scroll` (capture) or `resize`, on `Escape`, and when the anchor is removed from the DOM: check on the next show, or on a `MutationObserver` of `document.body` for child-list changes.
   - While shown, set `aria-describedby="hovercard"` on the anchor and remove it on hide.
   - **Position:**
     - centred above the anchor, with a 10 px gap and an arrow pointing at the anchor's centre;
     - if there is less than 8 px of room above, place it below with the arrow flipped;
     - clamp horizontally so the whole card stays at least 8 px inside the viewport, keeping the arrow on the anchor's centre (clamped to 14 px from the card's edges);
     - width `min(280px, 100vw - 16px)`.
   - **Animation:** opacity 0→1 and `translateY(4px)`→0 over 120 ms. None under `prefers-reduced-motion: reduce`.
   - **Content**, built from `src/data.ts` (`classById`, `BOONS`). Nothing is read from the DOM except the `data-tip` value. Rows are in this order:
     1. Header: `icon(def.icon)` from `src/ui.ts` in a 34 px framed square, the name in the display font, and a type line under it:
        - ability: `Skill · {cooldown}s cooldown`;
        - ultimate: `Ultimate · charges in combat`;
        - passive: `Passive · always active`;
        - boon: `{Rarity} boon`, plus ` · {Class name} only` if `classes` is set (capitalise the rarity).
     2. The description (`desc`).
     3. A fact list, abilities and ultimates only, each row a label and a value, skipping absent fields:
        - `Target`: `enemy` → `One foe`, `allEnemies` → `All foes`, `self` → `Self`, `ally` → `An ally`;
        - `Damage`: `{round(power*100)}% ATK`, plus ` × {hits} hits` when `hits > 1`;
        - `Heal`: `{round(heal*100)}% max HP`;
        - `Shield`: `{round(shield*100)}% max HP`;
        - `Inflicts` (`effect`) and `Grants` (each of `selfEffect`, `selfEffects`), one row per status, worded as:
          - `burn` / `poison` / `bleed`: `Burn · {round(power*100)}% ATK per second for {duration}s` (with that status's name);
          - `stun`: `Stun · {duration}s (shorter on bosses)`;
          - `slow`: `Slow · attacks {round((power-1)*100)}% slower for {duration}s`;
          - `haste`: `Haste · +{round((power-1)*100)}% attack speed for {duration}s`;
          - `empower`: `Empower · +{round((power-1)*100)}% damage for {duration}s`;
          - `dodge`: `Dodge · +{round(power*100)}% dodge for {duration}s`;
          - `thorns`: `Thorns · reflect {round(power*100)}% of damage taken for {duration}s`;
          - `regen`: `Regen · {power}% max HP per second for {duration}s`;
        - `cleanse: true` → a row `Cleanse · removes harmful effects`;
        - `summon: true` → `Summon · calls a spirit wolf`.
     An unknown `data-tip` shows nothing.
   - Escape all text inserted as HTML.

3. In `src/ui.ts`:
   - Each hero-card skill chip, the ultimate chip and the passive line gets `data-tip="skill:{classId}:{i|ult|passive}"`, `tabindex="0"` and `aria-label="{name}"`. Keep the existing `.skill-tip` child, which phones still show inline.
   - Each battle `.ability` slot gets `data-tip="skill:{cls.id}:{i}"`, `tabindex="0"` and `aria-label="{name}"`, and its `title` attribute is removed.
   - Each `.boon-pill` gets `data-tip="boon:{id}"` and `tabindex="0"`, and its `title` attribute is removed.

4. In `src/main.ts`, call `initHovercard()` once in `boot()`.

5. In `src/style.css`:
   - `.hovercard` styles to match the game's panels: background `linear-gradient(165deg, #191226, #090611)`, `1px solid var(--line-strong)`, radius 10 px, `var(--shadow)`, padding 12 px 14px, `z-index: 80`, `position: fixed`.
   - Name in `var(--display)` 14px `#f8eedb`; type line 10px uppercase letter-spaced `var(--gold)`; description 12.5px `var(--muted)`, line-height 1.5.
   - Fact rows as a two-column grid (label 10px uppercase `var(--faint)`, value 12px `var(--ink)`), separated from the description by a 1px `var(--line)` rule.
   - The arrow is a rotated 10 px square in the card's colours.
   - Inside `@media (hover: hover)`: `.skill-tip { display: none; }`.
   - Remove the old `.skill-chip:hover .skill-tip` rule. Keep the `@media (hover: none)` inline rules unchanged.
   - Give focusable anchors a visible `:focus-visible` outline in `var(--gold-dark)`.

6. Create `tools/hovercard-check.mjs` (Node ESM, `playwright-core`, Node built-ins only otherwise):
   - Serve `dist/` with a small `node:http` static server on an ephemeral port (correct `Content-Type` for `.html`, `.js`, `.css`, `.json`, `.webp`, `.jpg`, `.woff2`).
   - Launch Chromium headless with `args: ['--no-sandbox']` and `executablePath` set to `process.env.CHROMIUM_PATH` or the first that exists of `/usr/lib64/chromium-browser/chromium-browser`, `/usr/bin/chromium-browser`, `/usr/bin/chromium`.
   - Run these checks, printing `PASS`/`FAIL` with a one-line detail for each:
     1. **Desktop**, 1280×800: open the title screen, click `[data-nav="classes"]`, and hover the Warden's first skill chip (`[data-tip="skill:warden:0"]`). After 300 ms, `.hovercard` is visible, contains `Shield Slam`, `130% ATK` and `Stun`, and its bounding box is fully inside the viewport.
     2. Move the mouse to (5, 5). Within 300 ms, `.hovercard` is hidden.
     3. No element on the class screen has a `title` attribute containing `Shield Slam`.
     4. Focus `[data-tip="skill:warden:ult"]` with `element.focus()`. The card is visible and contains `Ultimate`.
     5. Hover the chip at the far right of the last class card (`[data-tip="skill:spiritcaller:ult"]`). The card stays fully inside the viewport.
     6. Click `[data-choose="warden"]` to start a battle, then wait 1500 ms. Hover `#ab-0`. After 300 ms the card is visible and contains `Shield Slam` and `6.5s`, and `#ab-0` has no `title` attribute. Read `#ult-pct`'s text, keep hovering for 1500 ms, and read it again: it has changed, so the battle is not paused.
     7. **Map boon:** set the save (`localStorage` key `emberfall-save-v1`) to have `boons: ["keen-edge"]` and `stage: 1`, reload, click `[data-nav="map"]` and hover `[data-tip="boon:keen-edge"]`. The card contains `Keen Edge` and `Common boon`.
     8. **Phone:** in a new context with `isMobile: true`, `hasTouch: true` and viewport 390×844, open the class screen. The first `.skill-tip` of the Warden card is visible (inline). Tap `[data-tip="skill:warden:0"]`: no `.hovercard` becomes visible within 300 ms.
   - Print `hovercard-check: N/N pass` last and exit 1 on any failure. Close the browser and the server in every case.

7. Add the script `"check:hover": "npm run build && node tools/hovercard-check.mjs"` to `package.json`.

## Acceptance

- `npm run check:hover` exits 0 and its last line is `hovercard-check: 8/8 pass`.
- `npm run sprites` exits 0 and its last line is `sprites: 25/25 pass`.
- `grep -nE 'class="ability"[^>]*title=|class="boon-pill"[^>]*title=' src/ui.ts` prints nothing.
- `npm test` prints `2 of 11 targets fail:` listing exactly `boss-retry` and `parity` (unchanged).

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- A step may touch a file outside **Files to touch** when it has to. List every such file in the report under "outside the plan", one line each saying why.
- The only checks to run are the **Acceptance** commands. Do not write or run extra end-to-end tests. The check script's own static server is the only server allowed; do not start a dev server. If something outside Acceptance fails, note it in the report and finish.
- No click-to-open behaviour, no modal, and no change to battle pausing. Hover and focus only.
- Do not change game data, combat, balance, sprites, art or audio code.

## Out of scope

- Tooltips on stage nodes, the audio menu or any other element not listed in **Goal**.
- New information about skills beyond what `src/data.ts` defines (no hero-specific damage numbers).

## If blocked

- If Chromium will not launch, try `dnf install -y chromium` once. If it still fails, stop and report.
- If check 6's ult-percentage text doesn't change because the ultimate is already full, read the battle's elapsed time from any other on-screen value that advances (for example the wave chip or an HP bar width). Report which one was used.
