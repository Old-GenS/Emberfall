import { AFFIXES, BOONS, CLASSES, LOCATIONS, type ClassDef, type IconName, type LocationDef, TOTAL_STAGES, buildWave, classById, stageInfo } from './data';
import { classPortraitSVG, locationEmblemSVG, preloadArtAssets, DESIGN_W, DESIGN_H } from './art';
import { type SaveData, getSave, heroStats, levelLabel, xpProgress, isVictory, stageRewardXp } from './state';

preloadArtAssets();

/**
 * Bespoke Gothic Stained-Glass & Heraldic Woodcut RPG Icons
 * Each uses layered duotone stained-glass fills (`fill-opacity="0.24"`) + crisp heraldic geometry.
 */
const ICON_PATHS: Record<IconName, string> = {
  shield: '<path d="M12 2 20.5 5.2v6.2c0 5.4-3.7 9.5-8.5 11.4C7.2 20.9 3.5 16.8 3.5 11.4V5.2L12 2Z" fill="currentColor" fill-opacity="0.22"/><path d="M12 2 20.5 5.2v6.2c0 5.4-3.7 9.5-8.5 11.4C7.2 20.9 3.5 16.8 3.5 11.4V5.2L12 2Z"/><path d="M12 5.5v13M7.5 10.5h9M12 7.5l2 3-2 3-2-3 2-3Z"/>',
  hammer: '<path d="M13.5 3.2 20.8 10.5l-4.6 4.6-7.3-7.3 4.6-4.6Z" fill="currentColor" fill-opacity="0.26"/><path d="M13.5 3.2 20.8 10.5l-4.6 4.6-7.3-7.3 4.6-4.6ZM11.2 13.1 4.2 20.1M3 18.8l2.5 2.5M15.8 5.5l2.7 2.7"/>',
  sun: '<circle cx="12" cy="12" r="4.5" fill="currentColor" fill-opacity="0.28"/><path d="M12 1.8 13.6 6h-3.2L12 1.8ZM12 22.2 10.4 18h3.2L12 22.2ZM1.8 12 6 10.4v3.2L1.8 12ZM22.2 12 18 13.6v-3.2L22.2 12ZM4.8 4.8l3.2 1.4-1.8 1.8-1.4-3.2ZM19.2 19.2l-3.2-1.4 1.8-1.8 1.4 3.2ZM19.2 4.8l-1.4 3.2-1.8-1.8 3.2-1.4ZM4.8 19.2l1.4-3.2 1.8 1.8-3.2 1.4Z"/><circle cx="12" cy="12" r="4.3"/>',
  flame: '<path d="M12.2 2.2c3.8 4.6 2.2 6.8 4.8 9.8 2.4 2.8 1.7 7.8-4.8 9.8-6.3-2-7.2-7-2.8-11.8 1.8-2 2.6-4.6 2.8-7.8Z" fill="currentColor" fill-opacity="0.24"/><path d="M12.2 2.2c3.8 4.6 2.2 6.8 4.8 9.8 2.4 2.8 1.7 7.8-4.8 9.8-6.3-2-7.2-7-2.8-11.8 1.8-2 2.6-4.6 2.8-7.8Z"/><path d="M12 11.8c1.8 2 2.8 3.2 1.8 5.4-.8 1.8-3.8 1.6-4.5-.4-.7-1.9.7-3.4 2.7-5Z" fill="currentColor" fill-opacity="0.45"/>',
  nova: '<path d="M12 2 14.4 9.6 22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2Z" fill="currentColor" fill-opacity="0.24"/><path d="M12 2 14.4 9.6 22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2ZM6 6l12 12M18 6 6 18"/>',
  meteor: '<circle cx="8" cy="16" r="4.2" fill="currentColor" fill-opacity="0.3"/><path d="M21 3 11.2 12.8M17 3l-5.5 5.5M21 7l-5.5 5.5"/><circle cx="8" cy="16" r="4.2"/><path d="M6.5 14.5 9.5 17.5M9.5 14.5l-3 3"/>',
  veil: '<path d="M12 3C7.5 5.5 5 9.5 5 14.2c0 3.6 2.8 6.8 7 6.8s7-3.2 7-6.8C19 9.5 16.5 5.5 12 3Z" fill="currentColor" fill-opacity="0.2"/><path d="M4 18.5c2.6-.8 3.8-3.6 3-7.5 2.8 1.8 4-3.2 6.8-1 2 1.4 2 4.2 0 6.2 2.8 0 4.2 1.8 3.2 3.8M12 3v5M8.5 14.5h7"/>',
  dagger: '<path d="M19.5 2.5 16 11.5l-4.5 4.5-3-3 4.5-4.5 6.5-6Z" fill="currentColor" fill-opacity="0.26"/><path d="M19.5 2.5 16 11.5l-4.5 4.5-3-3 4.5-4.5 6.5-6ZM6.5 11.5l6 6M8.5 15.5 4.5 19.5M3 18l3 3"/>',
  poison: '<path d="M12 2.4c4.2 5.8 6.8 9.2 6.8 12.8a6.8 6.8 0 1 1-13.6 0C5.2 11.6 7.8 8.2 12 2.4Z" fill="currentColor" fill-opacity="0.22"/><path d="M12 2.4c4.2 5.8 6.8 9.2 6.8 12.8a6.8 6.8 0 1 1-13.6 0C5.2 11.6 7.8 8.2 12 2.4Z"/><path d="M9.5 14.2 12 11.8l2.5 2.4L12 17.8l-2.5-3.6Z"/>',
  smoke: '<path d="M12 4a8 8 0 0 0-6 13.2L12 21l6-3.8A8 8 0 0 0 12 4Z" fill="currentColor" fill-opacity="0.16"/><path d="M3 16.5c4 2 4.5-2.2 8.5-1.2M5.5 12c4.2 2 5-3.2 9.5-2M9 7.8c4 1.8 4.8-2.8 9-1.8M4.5 20.5c5 1 5.5-2 9.5-1"/>',
  skull: '<path d="M12 2.5c4.8 0 7.8 3.3 7.8 7.6 0 2.8-1.4 4.4-2.8 5.4V19l-2.5 2h-5L7 19v-3.5c-1.4-1-2.8-2.6-2.8-5.4 0-4.3 3-7.6 7.8-7.6Z" fill="currentColor" fill-opacity="0.22"/><path d="M12 2.5c4.8 0 7.8 3.3 7.8 7.6 0 2.8-1.4 4.4-2.8 5.4V19l-2.5 2h-5L7 19v-3.5c-1.4-1-2.8-2.6-2.8-5.4 0-4.3 3-7.6 7.8-7.6Z"/><path d="M8.2 10.2 10.4 9l.4 2.3-2.6-.1ZM15.8 10.2 13.6 9l-.4 2.3 2.6-.1ZM10 18v2.5M14 18v2.5M12 13.5l-1.2 2h2.4l-1.2-2Z"/>',
  leaf: '<path d="M4.5 19.5C4.5 9.8 10.2 4 20.5 3.2c-.2 10.6-5.8 17.2-13.2 16.5" fill="currentColor" fill-opacity="0.24"/><path d="M4.5 19.5C4.5 9.8 10.2 4 20.5 3.2c-.2 10.6-5.8 17.2-13.2 16.5ZM4 20c3.5-5.8 7.8-10 13.5-12.8M10.5 11.5l3.5.5M8 15l4 .4"/>',
  bloom: '<path d="M12 3 14.8 8.5 21 9.2l-4.5 4.3 1.2 6.5L12 16.8 6.3 20l1.2-6.5L3 9.2l6.2-.7L12 3Z" fill="currentColor" fill-opacity="0.2"/><circle cx="12" cy="12" r="2.8"/><path d="M12 2.5 14.2 8 12 9.2 9.8 8 12 2.5ZM12 21.5 9.8 16 12 14.8 14.2 16 12 21.5ZM2.5 12 8 9.8 9.2 12 8 14.2 2.5 12ZM21.5 12 16 14.2 14.8 12 16 9.8 21.5 12Z"/>',
  wolf: '<path d="M4 20.5 5.2 9.5 3.5 4l5 3.2h7L20.5 4 18.8 9.5 20 20.5l-4.5-2.2L12 21l-3.5-2.7L4 20.5Z" fill="currentColor" fill-opacity="0.22"/><path d="M4 20.5 5.2 9.5 3.5 4l5 3.2h7L20.5 4 18.8 9.5 20 20.5l-4.5-2.2L12 21l-3.5-2.7L4 20.5Z"/><path d="M8.5 11.5h2M13.5 11.5h2M10.2 15.5 12 17.2l1.8-1.7"/>',
  heart: '<path d="M12 21S3.5 15.2 3.5 9.2A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.5 3c0 6-8.5 11.8-8.5 11.8Z" fill="currentColor" fill-opacity="0.24"/><path d="M12 21S3.5 15.2 3.5 9.2A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.5 3c0 6-8.5 11.8-8.5 11.8ZM12 8.5v7M9.2 11.5h5.6"/>',
  sword: '<path d="M19.8 2.2 21 7.2 9.8 18.4l-4.2-4.2L16.8 3l3-.8Z" fill="currentColor" fill-opacity="0.25"/><path d="M20.5 2.5 19.5 7.5 9.5 17.5l-3-3L16.5 4.5l4-2ZM4.5 13.5l6 6M6.5 17.5l-3.5 3.5M2.5 19.5l2 2"/>',
  bolt: '<path d="M13.5 2 4.5 13.5h6L9 22l10.5-12.5h-6L13.5 2Z" fill="currentColor" fill-opacity="0.28"/><path d="M13.5 2 4.5 13.5h6L9 22l10.5-12.5h-6L13.5 2Z"/>',
  crown: '<path d="M3 7.5 7.2 12 12 4.5 16.8 12 21 7.5V18H3V7.5Z" fill="currentColor" fill-opacity="0.25"/><path d="M3 7.5 7.2 12 12 4.5 16.8 12 21 7.5V18H3V7.5ZM3 20.8h18M12 11.5l1.4 2.2-1.4 2.2-1.4-2.2 1.4-2.2Z"/>',
  armor: '<path d="M7.5 3.5 12 5.2l4.5-1.7L20.5 7l-2 4.5v8.5H5.5v-8.5L3.5 7l4-3.5Z" fill="currentColor" fill-opacity="0.22"/><path d="M7.5 3.5 12 5.2l4.5-1.7L20.5 7l-2 4.5v8.5H5.5v-8.5L3.5 7l4-3.5ZM12 5.2V20M7.5 10.5h9M8.5 15h7"/>',
  wind: '<path d="M3 8.2h11.2a2.8 2.8 0 1 0-2.8-2.8M3 12.2h15.2a2.8 2.8 0 1 1-2.8 2.8M3 16.2h8.2a2.4 2.4 0 1 1-2.4 2.4"/>',
  drop: '<path d="M12 2.5c4.2 5.8 6.8 9.2 6.8 12.8a6.8 6.8 0 1 1-13.6 0C5.2 11.7 7.8 8.3 12 2.5Z" fill="currentColor" fill-opacity="0.26"/><path d="M12 2.5c4.2 5.8 6.8 9.2 6.8 12.8a6.8 6.8 0 1 1-13.6 0C5.2 11.7 7.8 8.3 12 2.5ZM9.2 14.5c.2 2 1.4 3.4 3.2 3.8"/>',
  star: '<path d="M12 2 14.6 9.4 22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z" fill="currentColor" fill-opacity="0.26"/><path d="M12 2 14.6 9.4 22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z"/><circle cx="12" cy="12" r="2"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3" fill="currentColor" fill-opacity="0.28"/><circle cx="17" cy="16" r="3" fill="currentColor" fill-opacity="0.28"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" fill-opacity="0.26"/><path d="M4 9v6h4l5 4V5L8 9H4ZM16 8c2 2 2 6 0 8M18.6 5.5c3.4 3.4 3.4 9.5 0 13"/>',
  pause: '<rect x="6.5" y="4.5" width="3.5" height="15" rx="1" fill="currentColor" fill-opacity="0.3"/><rect x="14" y="4.5" width="3.5" height="15" rx="1" fill="currentColor" fill-opacity="0.3"/><path d="M6.5 4.5h3.5v15H6.5zM14 4.5h3.5v15H14z"/>',
};

export const icon = (name: IconName, cls = ''): string =>
  `<span class="icon ${cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg></span>`;

const audioRow = (kind: 'sound' | 'music', ic: IconName, label: string, on: boolean, vol: number): string => {
  const pct = Math.round(vol * 100);
  return `<div class="audio-row ${on && pct > 0 ? '' : 'muted'}">
      <button class="audio-mute" data-action="toggle-${kind}" aria-pressed="${!on}" aria-label="Mute ${label.toLowerCase()}" title="${label}">${icon(ic)}</button>
      <input class="audio-slider" type="range" min="0" max="100" step="1" value="${pct}" data-volume="${kind}" aria-label="${label} volume" style="--pct:${pct}%">
    </div>`;
};

/** One speaker button that opens a small panel: an icon (tap to mute) and a volume slider for sound effects and for music. */
export function audioMenu(save: SaveData): string {
  const silent = !(save.sound && save.sfxVolume > 0) && !(save.music && save.musicVolume > 0);
  return `<div class="audio-menu">
    <button class="btn-icon ${silent ? 'off' : ''}" data-action="audio-menu" aria-haspopup="true" aria-expanded="false" title="Sound & music">${icon('speaker')}</button>
    <div class="audio-pop" role="group" aria-label="Sound & music" hidden>
      ${audioRow('sound', 'speaker', 'Sound effects', save.sound, save.sfxVolume)}
      ${audioRow('music', 'music', 'Music', save.music, save.musicVolume)}
    </div>
  </div>`;
}

/** Gothic Stained-Glass Eclipsed Sun & Rose-Window Emblem */
const EMBLEM = `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <defs>
    <linearGradient id="emg" x1="16" y1="8" x2="48" y2="56" gradientUnits="userSpaceOnUse">
      <stop stop-color="#fff4ca"/>
      <stop offset="0.48" stop-color="#e9b858"/>
      <stop offset="1" stop-color="#9e5620"/>
    </linearGradient>
    <radialGradient id="emCore" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#180d1e"/>
      <stop offset="76%" stop-color="#07050c"/>
      <stop offset="100%" stop-color="#e9c46a"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="29" stroke="#e9c46a" stroke-opacity="0.38" stroke-width="1.2"/>
  <circle cx="32" cy="32" r="24" stroke="#e9c46a" stroke-opacity="0.22" stroke-width="1" stroke-dasharray="3 3"/>
  <path d="M32 3 L36.5 16.5 L49 10.5 L44.5 23.5 L59 27.5 L46.5 34.5 L53.5 46.5 L40 44 L38 58.5 L32 46.5 L26 58.5 L24 44 L10.5 46.5 L17.5 34.5 L5 27.5 L19.5 23.5 L15 10.5 L27.5 16.5 Z" fill="url(#emg)" stroke="#07050c" stroke-width="1.6"/>
  <circle cx="32" cy="32" r="13.5" fill="url(#emCore)" stroke="#ffe5a3" stroke-width="1.6"/>
  <path d="M32 19.5c3.4 5.2 2.1 7.8 4.4 10.8 2 2.5 1.4 7-4.4 8.8-5.6-1.8-6.4-6.3-2.5-10.6 1.5-1.7 2.3-4.1 2.5-9Z" fill="url(#emg)"/>
  <path d="M32 27.5c1.5 1.8 2.2 2.9 1.4 4.8-.6 1.5-3 1.4-3.6-.3-.5-1.6.6-2.9 2.2-4.5Z" fill="#fff7dc"/>
</svg>`;

const ROMAN_REALMS = ['I', 'II', 'III', 'IV', 'V'];

const statBar = (label: string, val: number, max: number, display: string): string => `
  <div class="stat-row"><span>${label}</span><div class="stat-bar"><span style="width:${Math.min(100, (val / max) * 100)}%"></span></div><b>${display}</b></div>`;

function classCard(cls: ClassDef): string {
  const s = cls.stats;
  const skills = [
    ...cls.abilities.map((a, i) => `<div class="skill-chip" data-tip="skill:${cls.id}:${i}" tabindex="0" aria-label="${a.name}">${icon(a.icon)}<div class="skill-tip"><b>${a.name}</b>${a.desc}</div></div>`),
    `<div class="skill-chip ult" data-tip="skill:${cls.id}:ult" tabindex="0" aria-label="${cls.ultimate.name}">${icon(cls.ultimate.icon)}<div class="skill-tip"><b>Ultimate · ${cls.ultimate.name}</b>${cls.ultimate.desc}</div></div>`,
  ].join('');
  return `<article class="class-card" data-class="${cls.id}" style="--cls-accent:${cls.colors.main};--cls-glow:${cls.colors.glow}">
    <div class="portrait">${classPortraitSVG(cls)}</div>
    <div class="class-body">
      <div class="class-title">${cls.title}</div>
      <h2>${cls.name}</h2>
      <div class="class-tagline">“${cls.tagline}”</div>
      <div class="stat-rows">
        ${statBar('HP', s.maxHp, 400, `${s.maxHp}`)}
        ${statBar('ATK', s.atk, 34, `${s.atk}`)}
        ${statBar('DEF', s.armor, 22, `${s.armor}`)}
        ${statBar('SPD', 2 - s.speed, 0.7, `${(1 / s.speed).toFixed(1)}/s`)}
      </div>
      <div class="passive-line" data-tip="skill:${cls.id}:passive" tabindex="0" aria-label="${cls.passive.name}">${icon(cls.passive.icon)}<span><b>${cls.passive.name}</b> — ${cls.passive.desc}</span></div>
      <div class="skill-row">${skills}</div>
      <button class="btn primary" data-choose="${cls.id}">Swear Oath · ${cls.name.replace('The ', '')}</button>
    </div>
  </article>`;
}

export function renderTitle(save: SaveData): string {
  const hasHero = save.classId !== null;
  const complete = isVictory() && hasHero;
  const embers = Array.from({ length: 30 }, (_, i) => {
    const left = (i * 37) % 100;
    const delay = ((i * 13) % 100) / 10;
    const dur = 8 + ((i * 7) % 10);
    const size = 2 + ((i * 3) % 3);
    return `<span class="ember-dot" style="left:${left}%; animation-duration:${dur}s; animation-delay:${delay}s; width:${size}px; height:${size}px"></span>`;
  }).join('');
  return `<div class="screen title-screen">
    <div class="title-art-bg" aria-hidden="true"></div>
    <div class="embers">${embers}</div>
    <div class="title-stage">
      <div class="title-glow"></div>
      <div class="emblem">${EMBLEM}</div>
      <div class="overline">✦ Chronicle of the Shattered Vale ✦</div>
      <h1 class="game-logo">Emberfall</h1>
      <div class="game-sub">Legends of the Shattered Vale</div>
      <div class="ornament title-ornament" aria-hidden="true"><span>❖</span></div>
      <p class="title-tagline">“Five ruined realms. One borrowed spark. Draw your arcana and burn a road home.”</p>
      <div class="title-menu">
        ${complete
          ? `<button class="btn primary" data-nav="victory">Behold Your Legend</button>
             <button class="btn" data-nav="map">Wander the Vale</button>`
          : hasHero
            ? `<button class="btn primary" data-nav="map">Continue &nbsp;·&nbsp; ${classById(save.classId!).name.replace('The ', '')} · Lv ${save.level}</button>
               <button class="btn" data-nav="classes">New Pilgrimage</button>`
            : `<button class="btn primary" data-nav="classes">Begin Pilgrimage</button>`}
        <button class="btn" data-action="howto">Codex &amp; Rules</button>
      </div>
      <div class="sound-row">
        ${audioMenu(save)}
        <span style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)">Sanctum Audio</span>
      </div>
      <div class="title-footer">
        <span>Gothic Tarot Art</span><span>❖</span><span>Live-Synthesized Score</span><span>❖</span><span>Five Ruined Realms</span>
      </div>
    </div>
  </div>`;
}

export function renderClassSelect(save: SaveData): string {
  return `<div class="screen">
    <div class="screen-inner">
      <div class="top-bar">
        <div class="brand">
          <div class="mark">${EMBLEM}</div>
          <h1>Emberfall <span>The Major Arcana</span></h1>
        </div>
        <div class="top-actions">
          <button class="btn ghost small" data-nav="title">Return</button>
        </div>
      </div>
      <div class="page-head">
        <div>
          <div class="overline">✦ Draw Your Champion ✦</div>
          <h1>Who walks into the dark?</h1>
          <p>Four legends bound in stained glass and ash. Each carries a passive vow, three auto-cast skills, and a charged ultimate.</p>
        </div>
        <div class="tag gold">${save.classId ? 'A new oath overwrites the old' : 'Progress inscribes automatically'}</div>
      </div>
      <div class="class-grid">${CLASSES.map(classCard).join('')}</div>
      <div class="map-footer">❖ &nbsp; Every pilgrimage deals a fresh hand of boons &nbsp; ❖</div>
    </div>
  </div>`;
}

const touchDevice = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches;

function boonPills(ids: string[]): string {
  if (!ids.length) return `<details class="boon-details" open><summary>Arcana Boons · 0</summary><div class="boon-list"><span style="font-size:11px;color:var(--faint)">No boons inscribed — conquer a stage to draw one.</span></div></details>`;
  const counts: Record<string, number> = {};
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
  const pills = Object.entries(counts).map(([id, n]) => {
    const b = BOONS.find(x => x.id === id);
    if (!b) return '';
    return `<span class="boon-pill" data-tip="boon:${id}" tabindex="0">${icon(b.icon)}${b.name}${n > 1 ? ` ×${n}` : ''}<span class="pd">${b.desc}</span></span>`;
  }).join('');
  return `<details class="boon-details"${touchDevice() ? '' : ' open'}><summary>Arcana Boons · ${ids.length}</summary><div class="boon-list">${pills}</div></details>`;
}

function realmCard(loc: LocationDef, idx: number, save: SaveData): string {
  const base = idx * 5;
  const currentLoc = Math.min(Math.floor(save.stage / 5), LOCATIONS.length - 1);
  const done = isVictory();
  const locked = !done && idx > currentLoc;
  const isCurrent = !done && idx === currentLoc;
  const nodes = loc.stageNames.map((name, i) => {
    const g = base + i;
    const isDone = g < save.stage;
    const isNext = g === save.stage && !done;
    const cls = `stage-node${isDone ? ' done' : ''}${isNext ? ' next' : ''}${i === 4 ? ' boss-node' : ''}`;
    const title = `${i + 1}. ${name}${isNext ? ' — your next battle' : ''}`;
    if (isNext) {
      return `<button class="${cls}" data-battle="${g}" title="${title}" aria-label="Fight: ${name}">${i === 4 ? icon('crown') : i + 1}</button>`;
    }
    return `<div class="${cls}" title="${title}">${isDone ? (i === 4 ? icon('crown') : '✓') : (i === 4 ? icon('crown') : i + 1)}</div>`;
  });
  const connectors = nodes.map((n, i) => i === 0 ? n : `<span class="stage-link ${base + i - 1 < save.stage ? 'done' : ''}"></span>${n}`).join('');
  return `<article class="realm-card card ${isCurrent ? 'current' : ''} ${locked ? 'locked' : ''}" style="--realm:${loc.palette.accent}">
    <div class="realm-art">${locationEmblemSVG(loc)}<div class="realm-num">Realm ${ROMAN_REALMS[idx] ?? idx + 1}</div></div>
    <div class="realm-body">
      <div class="realm-head">
        <div><h2>${loc.name}</h2><div class="sub">${loc.subtitle}</div></div>
        ${locked ? `<div class="lock-msg">${icon('shield')} Sealed</div>` : ''}
      </div>
      <p class="realm-blurb">${loc.blurb}</p>
      <div class="stage-track">${connectors}</div>
      <div class="stage-name">${base + 4 < save.stage || save.stage >= TOTAL_STAGES ? '❖ Realm Conquered' : locked ? 'Break the seal of the prior realm' : `Current Trial: ${loc.stageNames[Math.max(0, Math.min(4, save.stage - base))]}`}</div>
      ${isCurrent ? `<div class="quest-strip">
        <div class="quest-info"><span class="${save.stage % 5 === 4 ? 'tag boss-tag' : 'tag gold'}">${save.stage % 5 === 4 ? 'Boss Trial' : 'Stage ' + ((save.stage % 5) + 1)}</span><b>${stageInfo(save.stage).location.stageNames[save.stage % 5]}</b><span class="dot"></span><span>Spoils: <b>+${stageRewardXp(save.stage)} XP</b> &amp; Arcana Boon</span></div>
        <button class="btn primary small" data-battle="${save.stage}">Enter Trial</button>
      </div>` : ''}
    </div>
  </article>`;
}

export function renderMap(save: SaveData): string {
  const cls = classById(save.classId!);
  const s = heroStats();
  const xp = xpProgress();
  const loc = stageInfo(Math.min(save.stage, 24)).location;
  const wave = save.stage < TOTAL_STAGES ? buildWave(save.stage, save.runSeed) : [];
  const bossStage = save.stage % 5 === 4;
  const wavePreview = wave.map(w => {
    const affix = w.affix ? AFFIXES.find(a => a.id === w.affix) : null;
    return affix ? `<span class="affix" title="${affix.desc}">${w.name}</span>` : w.name;
  }).join(' · ');
  return `<div class="screen">
    <div class="screen-inner">
      <div class="top-bar">
        <div class="brand"><div class="mark">${EMBLEM}</div><h1>Emberfall <span>Atlas of the Shattered Vale</span></h1></div>
        <div class="top-actions">
          ${audioMenu(save)}
          <button class="btn-icon" data-action="howto" title="Codex &amp; Rules">${icon('star')}</button>
          <button class="btn ghost small" data-nav="title">Sanctum</button>
        </div>
      </div>
      <div class="map-layout">
        <aside class="hero-panel card">
          <div class="hp-portrait">${classPortraitSVG(cls)}</div>
          <div class="class-title">${cls.title}</div>
          <h3>${cls.name.replace('The ', '')} <span class="gold" style="font-size:12px">· ${levelLabel(save.level)}</span></h3>
          <div class="lvl-line"><span>Rank <b>${save.level}</b></span><span>${xp.cur} / ${xp.need} XP</span></div>
          <div class="xp-bar"><span style="width:${(xp.pct * 100).toFixed(1)}%"></span></div>
          <div class="hp-line"><span>Health carried</span><b>${Math.round(save.hpPct * 100)}%</b></div>
          <div class="hp-bar map-hp-bar"><span style="width:${(save.hpPct * 100).toFixed(1)}%"></span></div>
          <div class="hero-meta">
            <div class="mini-stat"><span>Health</span><b>${Math.round(s.maxHp)}</b></div>
            <div class="mini-stat"><span>Attack</span><b>${Math.round(s.atk)}</b></div>
            <div class="mini-stat"><span>Defence</span><b>${Math.round(s.armor)}</b></div>
            <div class="mini-stat"><span>Crit</span><b>${Math.round(s.crit * 100)}%</b></div>
          </div>
          ${boonPills(save.boons)}
          <div class="actions">
            ${save.stage >= TOTAL_STAGES ? '<button class="btn primary" data-nav="victory">Behold Ending</button>' : `<button class="btn primary" data-battle="${save.stage}">${bossStage ? 'Confront Boss' : 'March Forth'} &nbsp;→</button>`}
            <button class="btn ghost small" data-action="howto">Codex</button>
            <button class="btn ghost small" data-action="reset">Forsake Oath</button>
          </div>
        </aside>
        <div>
          <div class="realm-list">${LOCATIONS.map((l, i) => realmCard(l, i, save)).join('')}</div>
          <div class="map-footer">Ahead: <b class="gold">${save.stage >= TOTAL_STAGES ? 'The Vale Breathes Anew' : loc.stageNames[save.stage % 5]}</b> · ${save.stage < TOTAL_STAGES ? wavePreview : 'Chronicle Complete'}</div>
        </div>
      </div>
    </div>
  </div>`;
}

export interface BattleUIInfo {
  save: SaveData;
  cls: ClassDef;
  stage: number;
  stats: ReturnType<typeof heroStats>;
}

/** What a perfect guard adds for each class, in the guard box under the battle. */
const GUARD_BONUS_TEXT: Record<'shield' | 'burn' | 'counter' | 'heal', string> = {
  shield: 'you gain a ward',
  burn: 'bursts into flame',
  counter: 'takes a critical counter',
  heal: 'your wounds mend',
};

export function renderBattle(info: BattleUIInfo): string {
  const { cls, stage, save } = info;
  const { location, stageInLoc } = stageInfo(stage);
  const boss = stageInLoc === 4;
  const abilityEls = cls.abilities.map((a, i) => `
    <div class="ability" id="ab-${i}" data-tip="skill:${cls.id}:${i}" tabindex="0" aria-label="${a.name}">
      ${icon(a.icon)}
      <div class="cd-mask" id="cd-${i}" style="transform:scaleY(0)"></div>
      <div class="cd-text" id="cdt-${i}"></div>
    </div>`).join('');
  return `<div class="screen battle-screen">
    <div class="battle-shell">
      <div class="battle-top">
        <div class="battle-loc">
          <div class="realm-badge">${locationEmblemSVG(location)}</div>
          <div>
            <h2>${location.name}</h2>
            <div class="sub">${boss ? '✦ Sovereign Trial · ' : ''}${location.stageNames[stageInLoc]} · ${boss ? 'Final Reckoning' : `Stage ${stageInLoc + 1} of 5`}</div>
          </div>
        </div>
        <div class="battle-controls">
          <div class="wave-chip">${icon('skull')} <span id="wave-count">${boss ? 'Boss' : 'Wave'}</span></div>
          <div class="wave-chip enrage-chip" id="enrage-chip" hidden>${icon('flame')} <span id="enrage-mult">×1.0</span></div>
          <button class="btn-icon" id="pause-btn" title="Pause (Esc)">${icon('pause')}</button>
          <button class="btn-icon speed-btn ${save.battleSpeed > 1 ? 'active' : ''}" id="speed-btn" title="Toggle battle speed" style="font-size:11px;font-weight:700">${save.battleSpeed}×</button>
          ${audioMenu(save)}
        </div>
      </div>
      <div class="arena" id="arena" style="--realm-glow:${location.palette.accent}">
        <canvas id="battle-canvas" width="${DESIGN_W}" height="${DESIGN_H}" aria-label="Battle scene"></canvas>
        <div class="arena-frame-corners" aria-hidden="true"></div>
        <div class="arena-top">
          <div class="battle-log" id="battle-log"></div>
        </div>
        <div id="battle-overlay"></div>
      </div>
      <div class="arena-bottom">
        <div class="ability-bar">
          ${abilityEls}
          <div class="ability-meta">Reliquary<b>Skills cast on cooldown</b></div>
        </div>
        <div class="guard-wrap" id="guard-wrap">
          <button class="guard-btn" id="guard-btn" aria-label="${cls.guard.name}">
            ${icon(cls.guard.icon)}
            <svg class="charge-ring" viewBox="0 0 68 68"><circle id="guard-ring" cx="34" cy="34" r="32" stroke-dasharray="201" stroke-dashoffset="0"/></svg>
            <span class="key" aria-hidden="true">F</span>
          </button>
          <div class="guard-info"><span class="k">✦ Guard</span><b>${cls.guard.name}</b><span>Press as the red ring turns gold. Perfect: the foe staggers and ${GUARD_BONUS_TEXT[cls.guard.bonus]}.</span><span class="guard-state" id="guard-state">Ready</span></div>
        </div>
        <div class="ult-wrap" id="ult-wrap">
          <button class="ult-btn" id="ult-btn" title="Release your ultimate when charged" aria-label="Ultimate">
            ${icon(cls.ultimate.icon)}
            <svg class="charge-ring" viewBox="0 0 68 68"><circle id="ult-ring" cx="34" cy="34" r="32" stroke-dasharray="201" stroke-dashoffset="201"/></svg>
            <span class="key" aria-hidden="true">Space</span>
          </button>
          <div class="ult-info">
            <span class="k">✦ Ultimate Arcana</span>
            <b>${cls.ultimate.name}</b>
            <span>${cls.ultimate.desc}</span>
            <span class="ult-pct" id="ult-pct">Charging · 0%</span>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

export function renderReward(cls: ClassDef, levelUps: number, xpGain: number, choices: ReturnType<typeof import('./state').pickBoonChoices>, canReroll = true): string {
  return `<div class="screen reward-screen">
    <div class="reward-head">
      <div class="overline">✦ Spoils of Ash &amp; Glass ✦</div>
      <h1>Draw Your Arcana</h1>
      <p>${levelUps > 0 ? `You ascended to Rank ${getSave().level}. ` : ''}Bind one blessing into your legend for the trials ahead.</p>
      <div class="reward-summary">
        <span class="reward-chip">${icon('star')} <b>+${xpGain} XP</b></span>
        <span class="reward-chip">${icon('crown')} <b>Trial Cleared</b></span>
        ${levelUps > 0 ? `<span class="reward-chip">${icon('bolt')} <b>Rank ${getSave().level}</b></span>` : ''}
      </div>
    </div>
    <div class="boon-grid">
      ${choices.map((b, i) => `<button class="boon-card ${b.rarity}" data-boon="${b.id}" style="animation-delay:${i * 0.08}s">
        <div class="boon-tarot-top" aria-hidden="true"><span>❖</span></div>
        <div class="boon-rarity">${b.rarity} arcana${b.classes ? ' · bloodline' : ''}</div>
        <div class="boon-icon-wrap">
          <svg class="boon-rose" viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" stroke-opacity="0.24" stroke-dasharray="2 4"/>
            <path d="M40 4 L45 16 L58 12 L54 25 L68 30 L58 40 L68 50 L54 55 L58 68 L45 64 L40 76 L35 64 L22 68 L26 55 L12 50 L22 40 L12 30 L26 25 L22 12 L35 16 Z" fill="none" stroke="currentColor" stroke-opacity="0.32" stroke-width="1"/>
          </svg>
          ${icon(b.icon)}
        </div>
        <h3>${b.name}</h3>
        <p>${b.desc}</p>
        <div class="pick">✦ Inscribe Boon ✦</div>
      </button>`).join('')}
    </div>
    <div class="reward-actions">
      <button class="btn ghost reroll-btn" data-reroll ${canReroll ? '' : 'disabled'}>${icon('bolt')} ${canReroll ? 'Reroll Arcana · once' : 'Rerolled'}</button>
    </div>
    <div class="center" style="margin-top:18px;color:var(--faint);font-size:10px;letter-spacing:.2em;text-transform:uppercase">❖ Every Arcana stacks for the remainder of your pilgrimage ❖</div>
  </div>`;
}

export function renderVictory(save: SaveData): string {
  const cls = classById(save.classId!);
  return `<div class="screen victory-screen">
    <div class="title-art-bg victory-art-bg" aria-hidden="true"></div>
    <div class="victory-glow"></div>
    <div class="victory-content">
      <div class="overline">✦ Chronicle Fulfilled ✦</div>
      <div style="display:flex;justify-content:center">${classPortraitSVG(cls, false)}</div>
      <h1>The Dawn<br>Returns</h1>
      <p>The Ashen King is unmade. Light pours once more through the stained glass of the five realms, and over the shattered obsidian stair a new sun rises upon a world that had forgotten its warmth.</p>
      <div class="victory-stats">
        <div><span>Champion</span><b>${cls.name.replace('The ', '')}</b></div>
        <div><span>Rank</span><b>${save.level}</b></div>
        <div><span>Arcana</span><b>${save.boons.length}</b></div>
        <div><span>Realms</span><b>5 / 5</b></div>
      </div>
      <div class="result-actions">
        <button class="btn primary" data-nav="map">Survey the Vale</button>
        <button class="btn" data-nav="classes">New Pilgrimage</button>
        <button class="btn ghost" data-nav="title">Title Sanctum</button>
      </div>
    </div>
  </div>`;
}

export function howToHTML(): string {
  return `<div class="modal-back">
    <div class="modal" role="dialog" aria-modal="true" aria-label="How to play">
      <div class="m-sub">✦ Illuminated Codex ✦</div>
      <h2>Laws of the Shattered Vale</h2>
      <p><b>Emberfall</b> is a gothic tactical auto-battler. Your champion strikes and invokes skills on their own — you choose the bloodline, shape your deck of Arcana boons, and unleash your Ultimate at the decisive instant.</p>
      <h3>The Pilgrimage</h3>
      <ul>
        <li><b>Swear an Oath</b> to one of four heroes, each bearing a passive vow, three reliquary skills, and a charged Ultimate.</li>
        <li><b>Cross Five Realms</b> of five trials each, culminating in a sovereign boss encounter.</li>
        <li><b>Draw an Arcana Boon</b> after every victory. Blessings stack without limit across your run.</li>
        <li>Defeat carries no ruin — retry freely, strengthened by a <b>Rally</b> blessing after each fall.</li>
      </ul>
      <h3>In Battle</h3>
      <ul>
        <li>Basic strikes and skills fire automatically on cooldown.</li>
        <li>Dealing and enduring blows kindles your <b>Ultimate Arcana</b>. When the medallion blazes gold, click it or press <span class="kbd">Space</span>.</li>
        <li>When a foe glows red and a ring closes on you, press <b>Guard</b> (F or Shift) as the ring turns gold. A perfect guard staggers it and charges your ultimate.</li>
        <li>Keys <span class="kbd">1</span>–<span class="kbd">3</span> also trigger the Ultimate; <span class="kbd">Esc</span> pauses; the speed toggle accelerates combat to <b>2×</b>.</li>
      </ul>
      <div class="modal-close"><button class="btn primary" data-close-modal="1">Seal the Codex</button></div>
    </div>
  </div>`;
}

export function toastHTML(text: string): string {
  return `<div class="toast">✦ ${text}</div>`;
}
