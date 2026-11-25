import { BOONS, CLASSES, LOCATIONS, type ClassDef, type IconName, type LocationDef, TOTAL_STAGES, buildWave, classById, stageInfo } from './data';
import { classPortraitSVG, locationEmblemSVG, DESIGN_W, DESIGN_H } from './art';
import { type SaveData, getSave, heroStats, levelLabel, xpProgress, isVictory, stageRewardXp } from './state';

const ICON_PATHS: Record<IconName, string> = {
  shield: '<path d="M12 2 20 5v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3Z"/><path d="M12 7v8M8.5 10.5h7"/>',
  hammer: '<path d="m6 18 6-6M9 21l-6-6M13 3l8 8-6 6-8-8 6-6Z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
  flame: '<path d="M12 2c4 5 2 7 4.5 10C19 15 18 20 12 22c-6-2-7-7-2.5-12C11 8 12 5 12 2Z"/><path d="M12 12c1.6 2 2.8 3 1.8 5.2-.9 2-3.9 1.6-4.6-.5-.7-2 .8-3.4 2.8-4.7Z"/>',
  nova: '<circle cx="12" cy="12" r="3.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
  meteor: '<circle cx="8" cy="16" r="3.4"/><path d="M11 13c2-2 5-2.5 9-8M10 9c2 .3 3 1.3 4 3M4 12l1.6-1.6M6.5 17.5 5 19M9.5 20l5-1"/>',
  veil: '<path d="M4 18c3-1 4-4 3-8 3 2 4-3 7-1 2 1 2 4 0 6 3 0 4 2 3 4M6 21c2 0 3-1 3-3M15 21c2 0 3-1 3-3"/>',
  dagger: '<path d="m5 19 2.5-2.5M4 22l-1-1 3-3 1 1-3 3ZM8 16 17 3l4 4L8 16Z"/><path d="m6 12 6 6"/>',
  poison: '<path d="M12 2c4 6 7 9.5 7 13a7 7 0 1 1-14 0c0-3.5 3-7 7-13Z"/><path d="M9 14c0 2 1 3.5 3 4"/>',
  smoke: '<path d="M3 17c4 2 4-2 8-1M6 13c4 2 5-3 9-2M10 9c4 2 5-3 9-2M4 21c5 1 5-2 9-1"/>',
  skull: '<path d="M12 2c5 0 8 3.5 8 8 0 3-1.5 4.5-3 5.5V19a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-3.5C5.5 14.5 4 13 4 10c0-4.5 3-8 8-8Z"/><circle cx="9" cy="10" r="1.7"/><circle cx="15" cy="10" r="1.7"/><path d="M10.5 15h3l-1.5 2-1.5-2Z"/>',
  leaf: '<path d="M4 20C4 10 10 4 21 3c0 11-6 18-13 17"/><path d="M4 20c3-6 7-10 12-12"/>',
  bloom: '<circle cx="12" cy="12" r="2.6"/><path d="M12 9.4c-4-6-10-2-7 2 1.5 2 4.5 1.5 7 -.4M12 9.4c4-6 10-2 7 2-1.5 2-4.5 1.5-7-.4M12 14.6c-4 6-10 2-7-2 1.5-2 4.5-1.5 7 .4M12 14.6c4 6 10 2 7-2-1.5-2-4.5-1.5-7 .4"/>',
  wolf: '<path d="M3 21c1-4 0-5-1-8 2 0 3 .5 4 1V9c0-4 3-7 6-7s6 3 6 7v5c1-.5 2-1 4-1-1 3-2 4-1 8-2-2-4-2-6-1l-3 2-3-2c-2-1-4-1-6 1Z"/><path d="M9 10h.01M15 10h.01M10 15l2 1 2-1"/>',
  heart: '<path d="M12 21S3 15 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12-9 12Z"/>',
  sword: '<path d="M14 4 20 2l-2 6L8 18l-4 4-2-2 4-4L14 4Z"/><path d="m5 15 4 4"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-13h-6l1-7Z"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4v10H3V8Z"/><path d="M3 21h18"/>',
  armor: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z"/><path d="M8 8h8M9 12h6M10 16h4"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8a2.5 2.5 0 1 1-2.5 2.5"/>',
  drop: '<path d="M12 2c4 6 7 9.5 7 13a7 7 0 1 1-14 0c0-3.5 3-7 7-13Z"/>',
  star: '<path d="m12 2 3 7 7 .8-5.3 4.8 1.5 7L12 17.8 5.8 21.6l1.5-7L2 9.8 9 9l3-7Z"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 8c2 2 2 6 0 8M18.5 5.5c3.5 3.5 3.5 9.5 0 13"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
};

export const icon = (name: IconName, cls = ''): string =>
  `<span class="icon ${cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg></span>`;

const EMBLEM = `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <path d="M32 4 55 13v17c0 14-9.5 25-23 30C18.5 55 9 44 9 30V13L32 4Z" stroke="#e9c46a" stroke-width="1.5" opacity="0.7"/>
  <path d="M32 10c7 10 3 14 8 20 3 5 6 8 3 14-3 7-12 10-18 6-7-5-6-14-1-21 2-3 5-7 8-19Z" fill="url(#emg)"/>
  <defs><linearGradient id="emg" x1="20" y1="14" x2="44" y2="52"><stop stop-color="#ffe9ac"/><stop offset=".55" stop-color="#ffb454"/><stop offset="1" stop-color="#c46a2a"/></linearGradient></defs>
  <path d="M33 32c2 5 5 7 4 12-1 4-7 5-9 1-2-4 0-7 2-9 1-2 3-3 3-4Z" fill="#fff3d6"/>
</svg>`;

const statBar = (label: string, val: number, max: number, display: string): string => `
  <div class="stat-row"><span>${label}</span><div class="stat-bar"><span style="width:${Math.min(100, (val / max) * 100)}%"></span></div><b>${display}</b></div>`;

function classCard(cls: ClassDef): string {
  const s = cls.stats;
  const skills = [...cls.abilities.map(a => `<div class="skill-chip">${icon(a.icon)}<div class="skill-tip"><b>${a.name}</b>${a.desc}</div></div>`),
    `<div class="skill-chip ult">${icon(cls.ultimate.icon)}<div class="skill-tip"><b>Ultimate · ${cls.ultimate.name}</b>${cls.ultimate.desc}</div></div>`].join('');
  return `<article class="class-card" data-class="${cls.id}">
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
      <div class="passive-line">${icon(cls.passive.icon)}<span><b>${cls.passive.name}</b> — ${cls.passive.desc}</span></div>
      <div class="skill-row">${skills}</div>
      <button class="btn primary" data-choose="${cls.id}">Choose ${cls.name.replace('The ', '')}</button>
    </div>
  </article>`;
}

export function renderTitle(save: SaveData): string {
  const hasHero = save.classId !== null;
  const complete = isVictory() && hasHero;
  const embers = Array.from({ length: 26 }, (_, i) => {
    const left = (i * 37) % 100;
    const delay = ((i * 13) % 100) / 10;
    const dur = 9 + ((i * 7) % 10);
    const size = 1 + ((i * 3) % 3);
    return `<span class="ember-dot" style="left:${left}%; animation-duration:${dur}s; animation-delay:${delay}s; width:${size}px; height:${size}px"></span>`;
  }).join('');
  return `<div class="screen title-screen">
    <div class="embers">${embers}</div>
    <div class="title-stage">
      <div class="title-glow"></div>
      <div class="emblem">${EMBLEM}</div>
      <div class="overline">A handcrafted auto-battler</div>
      <h1 class="game-logo">Emberfall</h1>
      <div class="game-sub">Legends of the Shattered Vale</div>
      <p class="title-tagline">Five ruined realms. One borrowed spark. Choose a legend and burn a road home.</p>
      <div class="title-menu">
        ${complete
          ? `<button class="btn primary" data-nav="victory">Behold Your Legend</button>
             <button class="btn" data-nav="map">Wander the Vale</button>`
          : hasHero
            ? `<button class="btn primary" data-nav="map">Continue &nbsp;·&nbsp; ${classById(save.classId!).name.replace('The ', '')} · Lv ${save.level}</button>
               <button class="btn" data-nav="classes">New Adventure</button>`
            : `<button class="btn primary" data-nav="classes">Begin Adventure</button>`}
        <button class="btn" data-action="howto">How to Play</button>
      </div>
      <div class="sound-row">
        <button class="btn-icon ${save.music ? '' : 'off'}" data-action="toggle-music" title="${save.music ? 'Music on' : 'Music off'}">${icon('music')}</button>
        <button class="btn-icon ${save.sound ? '' : 'off'}" data-action="toggle-sound" title="${save.sound ? 'Sound on' : 'Sound off'}">${icon(save.sound ? 'speaker' : 'speaker')}</button>
        <span style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)">Sound</span>
      </div>
      <div class="title-footer">
        <span>Original art</span><span>·</span><span>Live-synthesized music</span><span>·</span><span>Plays in your browser</span>
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
          <h1>Emberfall <span>Choose your legend</span></h1>
        </div>
        <div class="top-actions">
          <button class="btn ghost small" data-nav="title">Back</button>
        </div>
      </div>
      <div class="page-head">
        <div>
          <div class="overline">The road begins</div>
          <h1>Who walks into the dark?</h1>
          <p>Four heroes, four very different ways to survive. Each brings three signature skills, a passive, and a charged ultimate. Combat runs itself — your choices happen between battles.</p>
        </div>
        <div class="tag gold">${save.classId ? 'A new tale overwrites the old' : 'All progress saves automatically'}</div>
      </div>
      <div class="class-grid">${CLASSES.map(classCard).join('')}</div>
      <div class="map-footer">Every run is a fresh road · Choose wisely, or don't — they're all fun.</div>
    </div>
  </div>`;
}

/** Touch devices show some information inline instead of on hover (see style.css). */
const touchDevice = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches;

function boonPills(ids: string[]): string {
  if (!ids.length) return `<details class="boon-details" open><summary>Boons · 0</summary><div class="boon-list"><span style="font-size:10px;color:var(--faint)">No boons yet — clear a stage to earn one.</span></div></details>`;
  const counts: Record<string, number> = {};
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
  const pills = Object.entries(counts).map(([id, n]) => {
    const b = BOONS.find(x => x.id === id);
    if (!b) return '';
    return `<span class="boon-pill" title="${b.name}: ${b.desc}">${icon(b.icon)}${b.name}${n > 1 ? ` ×${n}` : ''}<span class="pd">${b.desc}</span></span>`;
  }).join('');
  // On a phone the descriptions are inline, which makes the list long, so it starts folded there.
  return `<details class="boon-details"${touchDevice() ? '' : ' open'}><summary>Boons · ${ids.length}</summary><div class="boon-list">${pills}</div></details>`;
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
  const nextName = locked ? 'Sealed' : save.stage >= TOTAL_STAGES ? 'Complete' : `${loc.stageNames[Math.min(4, save.stage - base)] ?? ''}`;
  return `<article class="realm-card card ${isCurrent ? 'current' : ''} ${locked ? 'locked' : ''}" style="--realm:${loc.palette.accent}">
    <div class="realm-art">${locationEmblemSVG(loc)}<div class="realm-num">Realm ${idx + 1}</div></div>
    <div class="realm-body">
      <div class="realm-head">
        <div><h2>${loc.name}</h2><div class="sub">${loc.subtitle}</div></div>
        ${locked ? `<div class="lock-msg">${icon('shield')} Locked</div>` : ''}
      </div>
      <p class="realm-blurb">${loc.blurb}</p>
      <div class="stage-track">${connectors}</div>
      <div class="stage-name">${base + 4 < save.stage || save.stage >= TOTAL_STAGES ? 'Realm conquered' : locked ? 'Clear the previous realm to enter' : `Next: ${loc.stageNames[Math.max(0, Math.min(4, save.stage - base))]}`}</div>
      ${isCurrent ? `<div class="quest-strip">
        <div class="quest-info"><span class="${save.stage % 5 === 4 ? 'tag boss-tag' : 'tag gold'}">${save.stage % 5 === 4 ? 'Boss Stage' : 'Stage ' + ((save.stage % 5) + 1)}</span><b>${stageInfo(save.stage).location.stageNames[save.stage % 5]}</b><span class="dot"></span><span>Rewards: <b>+${stageRewardXp(save.stage)} XP</b> &amp; a boon</span></div>
        <button class="btn primary small" data-battle="${save.stage}">Enter Battle</button>
      </div>` : ''}
    </div>
  </article>`;
}

export function renderMap(save: SaveData): string {
  const cls = classById(save.classId!);
  const s = heroStats();
  const xp = xpProgress();
  const loc = stageInfo(Math.min(save.stage, 24)).location;
  const wave = save.stage < TOTAL_STAGES ? buildWave(save.stage) : [];
  const bossStage = save.stage % 5 === 4;
  return `<div class="screen">
    <div class="screen-inner">
      <div class="top-bar">
        <div class="brand"><div class="mark">${EMBLEM}</div><h1>Emberfall <span>The Shattered Vale</span></h1></div>
        <div class="top-actions">
          <button class="btn-icon ${save.music ? '' : 'off'}" data-action="toggle-music" title="${save.music ? 'Music on' : 'Music off'}">${icon('music')}</button>
          <button class="btn-icon ${save.sound ? '' : 'off'}" data-action="toggle-sound" title="${save.sound ? 'Sound on' : 'Sound off'}">${icon(save.sound ? 'speaker' : 'speaker')}</button>
          <button class="btn-icon" data-action="howto" title="How to play">${icon('heart')}</button>
          <button class="btn ghost small" data-nav="title">Title</button>
        </div>
      </div>
      <div class="map-layout">
        <aside class="hero-panel card">
          <div class="hp-portrait">${classPortraitSVG(cls)}</div>
          <div class="class-title">${cls.title}</div>
          <h3>${cls.name.replace('The ', '')} <span class="gold" style="font-size:12px">· ${levelLabel(save.level)}</span></h3>
          <div class="lvl-line"><span>Level <b>${save.level}</b></span><span>${xp.cur} / ${xp.need} XP</span></div>
          <div class="xp-bar"><span style="width:${(xp.pct * 100).toFixed(1)}%"></span></div>
          <div class="hero-meta">
            <div class="mini-stat"><span>Health</span><b>${Math.round(s.maxHp)}</b></div>
            <div class="mini-stat"><span>Attack</span><b>${Math.round(s.atk)}</b></div>
            <div class="mini-stat"><span>Armor</span><b>${Math.round(s.armor)}</b></div>
            <div class="mini-stat"><span>Crit</span><b>${Math.round(s.crit * 100)}%</b></div>
          </div>
          ${boonPills(save.boons)}
          <div class="actions">
            ${save.stage >= TOTAL_STAGES ? '<button class="btn primary" data-nav="victory">View Ending</button>' : `<button class="btn primary" data-battle="${save.stage}">${bossStage ? 'Face the Boss' : 'Next Battle'} &nbsp;→</button>`}
            <button class="btn ghost small" data-action="howto">How to Play</button>
            <button class="btn ghost small" data-action="reset">Abandon Run</button>
          </div>
        </aside>
        <div>
          <div class="realm-list">${LOCATIONS.map((l, i) => realmCard(l, i, save)).join('')}</div>
          <div class="map-footer">Up next: <b class="gold">${save.stage >= TOTAL_STAGES ? 'The Vale is saved' : loc.stageNames[save.stage % 5]}</b> · ${save.stage < TOTAL_STAGES ? wave.map(w => w.name).join(' · ') : 'Legend complete'}</div>
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

export function renderBattle(info: BattleUIInfo): string {
  const { cls, stage, save } = info;
  const { location, stageInLoc } = stageInfo(stage);
  const boss = stageInLoc === 4;
  const abilityEls = cls.abilities.map((a, i) => `
    <div class="ability" id="ab-${i}" title="${a.name} — ${a.desc}">
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
            <div class="sub">${boss ? 'Boss · ' : ''}${location.stageNames[stageInLoc]} · ${boss ? 'Final Trial' : `Stage ${stageInLoc + 1} of 5`}</div>
          </div>
        </div>
        <div class="battle-controls">
          <div class="wave-chip">${icon('skull')} <span id="wave-count">${boss ? 'Boss' : 'Wave'}</span></div>
          <button class="btn-icon" id="pause-btn" title="Pause (Esc)">${icon('pause')}</button>
          <button class="btn-icon speed-btn" id="speed-btn" title="Toggle battle speed" style="font-size:11px;font-weight:700">1×</button>
          <button class="btn-icon ${save.sound ? '' : 'off'}" data-action="toggle-sound" title="${save.sound ? 'Sound on' : 'Sound off'}">${icon(save.sound ? 'speaker' : 'speaker')}</button>
        </div>
      </div>
      <div class="arena" id="arena">
        <canvas id="battle-canvas" width="${DESIGN_W}" height="${DESIGN_H}" aria-label="Battle scene"></canvas>
        <div class="arena-top">
          <div class="battle-log" id="battle-log"></div>
        </div>
        <div id="battle-overlay"></div>
      </div>
      <div class="arena-bottom">
        <div class="ability-bar">
          ${abilityEls}
          <div class="ability-meta">Auto-cast<b>Skills fire on cooldown</b></div>
        </div>
        <div class="ult-wrap" id="ult-wrap">
          <button class="ult-btn" id="ult-btn" title="Release your ultimate when charged" aria-label="Ultimate">
            ${icon(cls.ultimate.icon)}
            <svg class="charge-ring" viewBox="0 0 68 68"><circle id="ult-ring" cx="34" cy="34" r="32" stroke-dasharray="201" stroke-dashoffset="201"/></svg>
            <span class="key" aria-hidden="true">Space</span>
          </button>
          <div class="ult-info">
            <span class="k">Ultimate</span>
            <b>${cls.ultimate.name}</b>
            <span>${cls.ultimate.desc}</span>
            <span class="ult-pct" id="ult-pct">Charging · 0%</span>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

export function renderReward(cls: ClassDef, levelUps: number, xpGain: number, choices: ReturnType<typeof import('./state').pickBoonChoices>): string {
  return `<div class="screen reward-screen">
    <div class="reward-head">
      <div class="overline">Victory</div>
      <h1>The road opens</h1>
      <p>${levelUps > 0 ? `You reached level ${getSave().level}. ` : ''}Claim a boon to carry into the next battle.</p>
      <div class="reward-summary">
        <span class="reward-chip">${icon('star')} <b>+${xpGain} XP</b></span>
        <span class="reward-chip">${icon('crown')} <b>Stage cleared</b></span>
        ${levelUps > 0 ? `<span class="reward-chip">${icon('bolt')} <b>Level ${getSave().level}</b></span>` : ''}
      </div>
    </div>
    <div class="boon-grid">
      ${choices.map((b, i) => `<button class="boon-card ${b.rarity}" data-boon="${b.id}" style="animation-delay:${i * 0.08}s">
        <div class="boon-rarity">${b.rarity} boon${b.classes ? ' · class' : ''}</div>
        <div class="boon-icon-wrap">${icon(b.icon)}</div>
        <h3>${b.name}</h3>
        <p>${b.desc}</p>
        <div class="pick">Choose this boon</div>
      </button>`).join('')}
    </div>
    <div class="center" style="margin-top:26px;color:var(--faint);font-size:10px;letter-spacing:.16em;text-transform:uppercase">Each boon stacks for the rest of the run</div>
  </div>`;
}

export function renderVictory(save: SaveData): string {
  const cls = classById(save.classId!);
  return `<div class="screen victory-screen">
    <div class="victory-glow"></div>
    <div class="victory-content">
      <div class="overline">The Shattered Vale</div>
      <div style="display:flex;justify-content:center">${classPortraitSVG(cls, false)}</div>
      <h1>The Dawn<br>Returns</h1>
      <p>The Ashen King is unmade. The five realms breathe again, and somewhere beyond the last stair, a new sun is rising over a world that had forgotten how. Your legend is written in embers.</p>
      <div class="victory-stats">
        <div><span>Hero</span><b>${cls.name.replace('The ', '')}</b></div>
        <div><span>Level</span><b>${save.level}</b></div>
        <div><span>Boons</span><b>${save.boons.length}</b></div>
        <div><span>Realms</span><b>5 / 5</b></div>
      </div>
      <div class="result-actions">
        <button class="btn primary" data-nav="map">Wander the Vale</button>
        <button class="btn" data-nav="classes">New Adventure</button>
        <button class="btn ghost" data-nav="title">Title Screen</button>
      </div>
    </div>
  </div>`;
}

export function howToHTML(): string {
  return `<div class="modal-back">
    <div class="modal" role="dialog" aria-modal="true" aria-label="How to play">
      <div class="m-sub">Field Manual</div>
      <h2>How to Play</h2>
      <p><b>Emberfall</b> is an auto-battler. Your hero fights on their own — you choose the hero, steer the journey, and unleash the ultimate at the perfect moment.</p>
      <h3>The Loop</h3>
      <ul>
        <li><b>Choose a hero</b> from four classes, each with a passive, three auto-cast skills, and a charged ultimate.</li>
        <li><b>Clear stages</b> across five realms. Each realm has five stages, ending in a boss.</li>
        <li><b>Claim a boon</b> after every victory. Boons stack for the rest of the run.</li>
        <li>If you fall, the stage simply resets. No gold lost, no penalty — try again.</li>
      </ul>
      <h3>In Battle</h3>
      <ul>
        <li>Skills and basic attacks fire automatically. <b>Watch the cooldowns</b> on your skill bar.</li>
        <li>Dealing and taking damage charges your <b>Ultimate</b>. When the button glows, press it (or hit <span class="kbd">Space</span> on a keyboard).</li>
        <li>On a keyboard, <span class="kbd">Esc</span> pauses and <span class="kbd">1</span>–<span class="kbd">3</span> also release the ultimate. The speed button fast-forwards.</li>
        <li>Burn, poison, bleed, stun, slow, shields and dodges all matter. Build around what drops.</li>
      </ul>
      <h3>Tips</h3>
      <ul>
        <li>Bosses hit everything. Health and sustain boons are never wasted.</li>
        <li>Class-specific epic boons only appear for their own hero.</li>
        <li>Music and sound are generated live in your browser. Toggle them any time.</li>
      </ul>
      <div class="modal-close"><button class="btn primary" data-close-modal="1">Understood</button></div>
    </div>
  </div>`;
}

export function toastHTML(text: string): string {
  return `<div class="toast">${text}</div>`;
}
