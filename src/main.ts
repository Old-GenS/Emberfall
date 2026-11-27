import './style.css';
import {
  BOONS, TOTAL_STAGES, buildWave, classById, stageInfo, type ClassId, type IconName,
} from './data';
import { Battle, enrageMultiplier, type CombatEvent } from './combat';
import { BALANCE } from './balance';
import { SceneRenderer } from './art';
import { RealmEvents } from './realm-events';
import { audio, type ThemeId } from './audio';
import {
  applyBoon, completeStage, getSave, hasHero, heroStats, isVictory, loadSave,
  pickBoonChoices, resetSave, selectClass, updateSave, xpProgress,
} from './state';
import {
  howToHTML, icon, renderBattle, renderClassSelect, renderMap, renderReward,
  renderTitle, renderVictory, toastHTML,
} from './ui';
import { initHovercard } from './hovercard';

const app = document.getElementById('app')!;
/** Phones and tablets: wording and layout differ (see the (hover: none) rules in style.css). */
const touch = typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches;

type Screen = 'title' | 'classes' | 'map' | 'battle' | 'reward' | 'victory';
let screen: Screen = 'title';
let battle: Battle | null = null;
let renderer: SceneRenderer | null = null;
let realmEvents: RealmEvents | null = null;
let enrageMusicPlayed = false;
let raf = 0;
let paused = false;
let speed: 1 | 2 | 3 = 1;
/**
 * The default pace: seconds of game time per second of real time at 1x. Fights last 6-30 s of
 * game time, which at 1.0 was too quick to read, so the clock runs at 0.75 by default and a 6 s
 * fight takes 8 s on screen. The speed button doubles whatever this is (2x = 1.5x real time).
 * Outcomes do not depend on it: tools/balance steps in game time.
 */
const TIME_SCALE = 0.75;
let overlayShown = false;
// `stage` is the stage that was cleared: the save has already moved on by the time the result
// overlay renders, so it must not be looked up from the save again.
let pendingResult: { xp: number; levelUps: number; final: boolean; stage: number } | null = null;
let rewardChoices: ReturnType<typeof pickBoonChoices> = [];
let rerollUsed = false;
let endHandled = false;
let endTimer = 0;
let logs: string[] = [];
let modalOpen = false;
let lastFrame = performance.now();
let lastSfx: Record<string, number> = {};
let rally = 1; // mercy buff after defeats, resets on victory or leaving

/* --------------------------------- audio ---------------------------------- */

async function ensureAudio(): Promise<void> {
  try {
    await audio.init();
    const save = getSave();
    applyAudioLevels();
    if (!audio['playing']) audio.playMusic(screen === 'map' || screen === 'reward' ? 'map' : screen === 'battle' ? themeForBattle() : 'menu');
  } catch { /* audio is optional */ }
}

function themeForBattle(): ThemeId {
  const s = getSave();
  const info = stageInfo(Math.min(s.stage, 24));
  return info.location.music as ThemeId;
}

document.addEventListener('pointerdown', () => {
  if (!audio.ready) ensureAudio();
  else audio.init();
});

function sfx(name: string): void {
  const now = performance.now();
  if (lastSfx[name] && now - lastSfx[name] < 55) return;
  lastSfx[name] = now;
  audio.sfx(name);
}

/* -------------------------------- rendering -------------------------------- */

function render(html: string): void {
  app.innerHTML = html;
  modalOpen = false;
  window.scrollTo({ top: 0 });
}

function renderScreen(): void {
  const save = getSave();
  switch (screen) {
    case 'title': render(renderTitle(save)); audio.playMusic('menu'); break;
    case 'classes': render(renderClassSelect(save)); audio.playMusic('menu'); break;
    case 'map':
      if (!hasHero()) { screen = 'classes'; renderScreen(); return; }
      render(renderMap(save));
      audio.playMusic('map');
      break;
    case 'victory': render(renderVictory(save)); audio.playMusic('menu'); break;
    case 'reward': break; // rendered explicitly
    case 'battle': break;
  }
}

function navigate(to: Screen): void {
  stopBattle();
  rally = 1;
  screen = to;
  renderScreen();
}

function applyAudioLevels(): void {
  const s = getSave();
  audio.setSfxLevel(s.sound ? s.sfxVolume : 0);
  audio.setMusicLevel(s.music ? s.musicVolume : 0);
}

/** Bring every sound panel on screen in line with the save (mute state, slider position). */
function refreshToggles(): void {
  const s = getSave();
  const rows = { sound: { on: s.sound, vol: s.sfxVolume }, music: { on: s.music, vol: s.musicVolume } };
  for (const [kind, { on, vol }] of Object.entries(rows)) {
    const pct = Math.round(vol * 100);
    document.querySelectorAll<HTMLElement>(`[data-action="toggle-${kind}"]`).forEach(el => {
      el.setAttribute('aria-pressed', String(!on));
      el.closest('.audio-row')?.classList.toggle('muted', !on || pct === 0);
    });
    document.querySelectorAll<HTMLInputElement>(`[data-volume="${kind}"]`).forEach(el => {
      if (document.activeElement !== el) el.value = String(pct);
      el.style.setProperty('--pct', `${pct}%`);
    });
  }
  const silent = !(s.sound && s.sfxVolume > 0) && !(s.music && s.musicVolume > 0);
  document.querySelectorAll<HTMLElement>('[data-action="audio-menu"]').forEach(el => el.classList.toggle('off', silent));
}

function closeAudioMenus(): boolean {
  let closed = false;
  document.querySelectorAll<HTMLElement>('.audio-pop:not([hidden])').forEach(pop => {
    pop.hidden = true;
    pop.parentElement?.querySelector('[data-action="audio-menu"]')?.setAttribute('aria-expanded', 'false');
    closed = true;
  });
  return closed;
}

function toggleAudioMenu(btn: HTMLElement): void {
  const pop = btn.parentElement?.querySelector<HTMLElement>('.audio-pop');
  if (!pop) return;
  const opening = pop.hidden;
  closeAudioMenus();
  if (!opening) return;
  pop.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  // Opens leftward from the button; flip when that would run off the left edge (phones).
  pop.classList.remove('flip');
  if (pop.getBoundingClientRect().left < 8) pop.classList.add('flip');
  pop.querySelector<HTMLElement>('.audio-slider')?.focus();
}

function showModal(html: string): void {
  const existing = document.querySelector('.modal-back');
  if (existing) existing.remove();
  app.insertAdjacentHTML('beforeend', html);
  modalOpen = true;
}

function closeModal(): void {
  document.querySelectorAll('.modal-back').forEach(el => el.remove());
  modalOpen = false;
}

/* ------------------------------- battle flow ------------------------------ */

function stopBattle(): void {
  document.body.classList.remove('in-battle');
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  battle = null;
  realmEvents = null;
  renderer?.destroy();
  renderer = null;
  paused = false;
  speed = 1;
  enrageMusicPlayed = false;
  overlayShown = false;
  endHandled = false;
  endTimer = 0;
  pendingResult = null;
  logs = [];
}

/**
 * Widest the battle shell can be with the arena (always 16:9) and both bars inside the viewport,
 * so a fight never scrolls and the scene is never stretched. Measured, not computed: the bars'
 * height depends on how they wrap, so it is read back after the first fit and fitted again.
 */
function fitBattleShell(): void {
  if (screen !== 'battle') return;
  const shell = document.querySelector<HTMLElement>('.battle-shell');
  const arena = document.getElementById('arena');
  const screenEl = shell?.parentElement;
  if (!shell || !arena || !screenEl) return;
  // The landscape layout sizes the arena by height in CSS and puts the bars beside it.
  if (window.matchMedia('(orientation: landscape) and (max-height: 520px)').matches) {
    shell.style.removeProperty('--battle-fit');
    return;
  }
  const cs = getComputedStyle(screenEl);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  shell.style.removeProperty('--battle-fit');
  let chrome = shell.offsetHeight - arena.offsetHeight;
  for (let pass = 0; pass < 2; pass++) {
    const avail = window.innerHeight - padY - chrome;
    const fit = Math.floor(Math.min(screenEl.clientWidth - padX, Math.max(160, (avail * 16) / 9)));
    shell.style.setProperty('--battle-fit', `${fit}px`);
    chrome = shell.offsetHeight - arena.offsetHeight;
  }
}

function startBattle(keepRally = false): void {
  const save = getSave();
  const carryRally = rally;
  if (!save.classId || save.stage >= TOTAL_STAGES) return;
  stopBattle();
  const cls = classById(save.classId);
  const info = stageInfo(save.stage);
  const wave = buildWave(save.stage);
  screen = 'battle';
  render(renderBattle({ save, cls, stage: save.stage, stats: heroStats() }));
  document.body.classList.add('in-battle');
  fitBattleShell();
  const canvas = document.getElementById('battle-canvas') as HTMLCanvasElement;
  const arena = document.getElementById('arena')!;
  renderer = new SceneRenderer(canvas);
  renderer.setLocation(info.location);
  if (!keepRally) rally = 1; else rally = carryRally;
  const stats = heroStats();
  if (rally > 1) { stats.maxHp = Math.round(stats.maxHp * rally); stats.atk = Math.round(stats.atk * rally * 10) / 10; }
  battle = new Battle(cls.id, stats, wave, save.stage, { onEvent: handleEvent });
  renderer.setBattle(battle);
  realmEvents = new RealmEvents(info.location.particle, info.location.palette.accent);
  renderer.setRealmEvents(realmEvents);
  canvas.addEventListener('pointerdown', (ev) => {
    if (!battle || !renderer || !realmEvents || paused || battle.ended) return;
    const p = renderer.toDesign(ev.clientX, ev.clientY);
    if (realmEvents.hit(p.x, p.y)) {
      battle.grantUltCharge(15);
      audio.sfx('heal');
      updateHud();
      ev.preventDefault();
    }
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!renderer || !realmEvents) return;
    const spark = realmEvents.spark;
    let over = false;
    if (spark) {
      const p = renderer.toDesign(ev.clientX, ev.clientY);
      const bob = Math.sin(spark.age * 3) * 4;
      const dx = p.x - spark.x;
      const dy = p.y - (spark.y + bob);
      over = dx * dx + dy * dy <= 34 * 34;
    }
    canvas.classList.toggle('spark-hover', over);
  });
  if (location.search.includes('debug=1')) {
    (window as unknown as Record<string, unknown>).__emberfall = { battle, renderer, realmEvents, audio };
  }
  const boss = save.stage % 5 === 4;
  audio.playMusic(info.location.music as ThemeId, boss);
  if (boss) setTimeout(() => sfx('boss'), 150);
  bindBattleControls();
  if (boss) {
    const intro = document.createElement('div');
    intro.className = 'boss-intro';
    intro.innerHTML = `<div class="bi-kicker">Final Trial</div><h2>${info.location.boss.name}</h2><div class="bi-sub">${info.location.name}</div>`;
    document.getElementById('arena')?.appendChild(intro);
    setTimeout(() => intro.remove(), 2700);
  }
  overlayShown = false;
  paused = false;
  speed = getSave().battleSpeed;
  enrageMusicPlayed = false;
  lastFrame = performance.now();
  raf = requestAnimationFrame(loop);
  updateHud();
  showBattleHint();
}

function showBattleHint(): void {
  const save = getSave();
  if (save.seenIntro) return;
  updateSave({ seenIntro: true });
  const arena = document.getElementById('arena');
  if (!arena) return;
  arena.insertAdjacentHTML('beforeend', `<div class="hint-banner" id="hint-banner">${icon('heart')}<span>${touch
    ? 'Your skills fire automatically. When the ultimate glows, <b>tap it</b>. Good luck.'
    : 'Your skills fire automatically. When the ultimate glows, press it — or hit <b>Space</b>. Good luck.'}</span></div>`);
  setTimeout(() => document.getElementById('hint-banner')?.remove(), 7500);
}

function bindBattleControls(): void {
  document.getElementById('pause-btn')?.addEventListener('click', togglePause);
  document.getElementById('speed-btn')?.addEventListener('click', () => {
    speed = speed >= 3 ? 1 : (speed + 1) as 1 | 2 | 3;
    updateSave({ battleSpeed: speed });
    const btn = document.getElementById('speed-btn');
    if (btn) {
      btn.textContent = `${speed}×`;
      btn.classList.toggle('active', speed > 1);
    }
    sfx('click');
  });
  document.getElementById('ult-btn')?.addEventListener('click', useUltimate);
}

function useUltimate(): void {
  if (!battle || battle.ended || paused) return;
  if (battle.useUltimate()) {
    sfx('ult');
    updateHud();
  }
}

function togglePause(): void {
  if (!battle || battle.ended) return;
  paused = !paused;
  const overlay = document.getElementById('battle-overlay');
  if (!overlay) return;
  if (paused) {
    overlay.innerHTML = `<div class="pause-overlay">
      <div class="result-panel">
        <div class="r-kicker">Battle Paused</div>
        <h2 style="font-size:40px;color:#e9d9b8">Breathe</h2>
        <p>The Vale can wait. Your skills keep their cooldowns right where you left them.</p>
        <div class="result-actions">
          <button class="btn primary" data-pause="resume">Resume</button>
          <button class="btn" data-pause="restart">Restart Stage</button>
          <button class="btn ghost" data-pause="quit">Return to Map</button>
        </div>
      </div>
    </div>`;
  } else {
    overlay.innerHTML = '';
  }
}

function handleEvent(e: CombatEvent): void {
  renderer?.onEvent(e);
  switch (e.type) {
    case 'damage':
      if (e.kind === 'dot') break;
      sfx(e.crit ? 'crit' : e.kind === 'ult' ? 'ult' : 'hit');
      break;
    case 'heal':
      sfx('heal');
      break;
    case 'shield':
      sfx('shield');
      break;
    case 'dodge':
      sfx('dodge');
      break;
    case 'summon':
      sfx('summon');
      addLog(`${e.unit.name} answers the call`);
      break;
    case 'cast': {
      const iconMap: Partial<Record<IconName, string>> = {
        flame: 'fire', meteor: 'fire', nova: 'fire', veil: 'cast',
        shield: 'shield', sun: 'shield', bloom: 'heal', leaf: 'cast', wolf: 'summon',
        dagger: 'slash', poison: 'slash', smoke: 'dodge', skull: 'slash', crown: 'cast', hammer: 'hit',
      };
      if (e.ult) sfx('ult'); else sfx(iconMap[e.ability.icon] ?? 'cast');
      const sideColor = e.source.side === 'hero' ? 'var(--gold-bright)' : e.source.side === 'ally' ? 'var(--green)' : '#ff9c8d';
      addLog(`<b style="color:${sideColor}">${e.source.name}</b> ${e.ult ? 'unleashes' : 'casts'} <b>${e.ability.name}</b>`);
      break;
    }
    case 'death':
      sfx('death');
      if (e.unit.side === 'enemy') addLog(`${e.unit.name} falls`);
      break;
    case 'end':
      handleBattleEnd(e.victory);
      break;
    case 'message':
      addLog(e.text);
      break;
  }
  updateWaveCount();
}

function addLog(html: string): void {
  logs.push(html);
  if (logs.length > 4) logs.shift();
  const el = document.getElementById('battle-log');
  if (el) el.innerHTML = logs.map(l => `<div>${l}</div>`).join('');
}

function updateWaveCount(): void {
  if (!battle) return;
  const el = document.getElementById('wave-count');
  if (!el) return;
  const alive = battle.enemies.filter(e => e.alive).length;
  el.textContent = `${alive} / ${battle.enemies.length} foes`;
}

function handleBattleEnd(victory: boolean): void {
  if (endHandled || !battle) return;
  endHandled = true;
  endTimer = 0;
  const save = getSave();
  if (victory) {
    const final = save.stage === TOTAL_STAGES - 1;
    const res = completeStage();
    pendingResult = { xp: res.xp, levelUps: res.levelUps, final, stage: res.stageCleared };
    rally = 1;
    audio.sfx('victory');
    if (res.levelUps > 0) setTimeout(() => audio.sfx('levelup'), 500);
    addLog(`<b style="color:var(--gold-bright)">Victory</b> — the road opens`);
  } else {
    rally = Math.min(BALANCE.rally.cap, rally + BALANCE.rally.step);
    audio.sfx('defeat');
    addLog('Your spark gutters out…');
  }
}

function showResultOverlay(): void {
  if (!battle || overlayShown) return;
  overlayShown = true;
  const overlay = document.getElementById('battle-overlay');
  if (!overlay) return;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  if (battle.victory) {
    const res = pendingResult;
    // Name the realm that was just cleared, not the one the save now points at (after a boss
    // kill those differ: completeStage() has already advanced to the next realm's first stage).
    const info = stageInfo(res?.stage ?? getSave().stage);
    overlay.innerHTML = `<div class="result-overlay">
      <div class="result-panel win">
        <div class="r-kicker">${res?.final ? 'The Last Ember' : 'Stage Cleared'}</div>
        <h2>${res?.final ? 'The King Falls' : 'Victory'}</h2>
        <p>${res?.final ? 'The Ashen Throne cracks. A dawn you made possible spills through the dark.' : `${info.location.name} yields. The next stretch of road waits, and the fire in you burns brighter.`}</p>
        <div class="result-rewards">
          <span class="reward-chip">${icon('star')} <b>+${res?.xp ?? 0} XP</b></span>
          ${res?.levelUps ? `<span class="reward-chip">${icon('bolt')} <b>Level ${getSave().level}</b></span>` : ''}
          ${res?.final ? '' : `<span class="reward-chip">${icon('crown')} <b>Boon earned</b></span>`}
        </div>
        <div class="result-actions">
          <button class="btn primary" data-result="spoils">${res?.final ? 'See the Ending' : 'Claim Your Boon'}</button>
          ${res?.final ? '<button class="btn ghost" data-result="map">Return to Map</button>' : ''}
        </div>
      </div>
    </div>`;
  } else {
    overlay.innerHTML = `<div class="result-overlay">
      <div class="result-panel lose">
        <div class="r-kicker">The Spark Fades</div>
        <h2>Defeated</h2>
        <p>Your legend is not finished. The stage will be exactly as you left it — only your pride is wounded.</p>
        ${rally > 1 ? `<div class="result-rewards"><span class="reward-chip rally">${icon('bolt')} <b>Rally +${Math.round((rally - 1) * 100)}%</b> health &amp; attack next try</span></div>` : ''}
        <div class="result-actions">
          <button class="btn primary" data-result="retry">Try Again</button>
          <button class="btn ghost" data-result="map">Return to Map</button>
        </div>
      </div>
    </div>`;
  }
}

function loop(now: number): void {
  if (!battle || !renderer) return;
  // Real time since the last frame, capped so a tab that woke up does not fast-forward through a
  // fight; dt is the visual step, capped at 50 ms as before.
  const frame = Math.min(0.25, Math.max(0, (now - lastFrame) / 1000));
  const dt = Math.min(0.05, frame);
  lastFrame = now;
  if (!paused) {
    // Step in slices of at most 50 ms until the frame's time is used up. Battle.update clamps a
    // single step to 50 ms, so one update of dt * speed was capped to ~1.5x at 30 fps and lost
    // time below 20 fps; slices keep the pace right on a slow phone and on the 2x button.
    for (let i = 0; i < speed; i++) {
      let remaining = frame;
      while (remaining > 1e-6) {
        const step = Math.min(0.05, remaining);
        battle.update(step * TIME_SCALE);
        if (realmEvents && !modalOpen && !battle.ended) realmEvents.update(step * TIME_SCALE, battle);
        remaining -= step;
      }
    }
  }
  renderer.draw(dt * (paused ? 0.2 : 1), battle);
  updateHud();
  if (battle.ended) {
    if (!overlayShown) {
      endTimer += dt;
      if (endTimer > 1.4) {
        showResultOverlay();
        return;
      }
    }
  }
  raf = requestAnimationFrame(loop);
}

function updateHud(): void {
  if (!battle) return;
  const hero = battle.hero;
  const enrage = enrageMultiplier(battle.elapsed);
  const chip = document.getElementById('enrage-chip');
  const mult = document.getElementById('enrage-mult');
  if (enrage > 1) {
    if (chip) chip.hidden = false;
    if (mult) mult.textContent = `×${enrage.toFixed(1)}`;
    if (!enrageMusicPlayed) {
      enrageMusicPlayed = true;
      audio.playMusic(themeForBattle(), true);
    }
  } else if (chip) {
    chip.hidden = true;
  }
  const ultBtn = document.getElementById('ult-btn');
  const ultPct = document.getElementById('ult-pct');
  const ultRing = document.getElementById('ult-ring') as SVGCircleElement | null;
  const ultWrap = document.getElementById('ult-wrap');
  if (ultBtn && ultPct && ultRing) {
    const pct = Math.floor(hero.ultCharge);
    const ready = pct >= 100 && !battle.ended;
    ultBtn.classList.toggle('ready', ready);
    (ultBtn as HTMLButtonElement).disabled = !ready;
    ultWrap?.classList.toggle('ready', ready);
    ultPct.textContent = ready ? (touch ? 'Ready · tap to release' : 'Ready · press Space') : `Charging · ${pct}%`;
    ultRing.style.strokeDashoffset = `${201 * (1 - pct / 100)}`;
  }
  for (let i = 0; i < hero.abilities.length; i++) {
    const cd = hero.abilityCds[i] ?? 0;
    const max = hero.abilities[i].cooldown;
    const mask = document.getElementById(`cd-${i}`);
    const text = document.getElementById(`cdt-${i}`);
    if (mask) (mask as HTMLElement).style.transform = `scaleY(${cd > 0 ? Math.min(1, cd / max) : 0})`;
    if (text) text.textContent = cd > 0.15 ? (cd < 1 ? cd.toFixed(1) : Math.ceil(cd).toString()) : '';
  }
}

/* --------------------------------- rewards -------------------------------- */

function showRewardScreen(): void {
  const save = getSave();
  if (!save.classId) return navigate('classes');
  const res = pendingResult;
  if (!res) return navigate('map');
  screen = 'reward';
  rewardChoices = pickBoonChoices();
  rerollUsed = false;
  render(renderReward(classById(save.classId), res.levelUps, res.xp, rewardChoices, true));
  audio.playMusic('map');
  window.scrollTo({ top: 0 });
}

/** One reroll per reward screen: a fresh hand that avoids the cards just shown. */
function rerollBoons(): void {
  const save = getSave();
  const res = pendingResult;
  if (rerollUsed || screen !== 'reward' || !res || !save.classId) return;
  rerollUsed = true;
  rewardChoices = pickBoonChoices(undefined, rewardChoices.map(b => b.id));
  sfx('select');
  render(renderReward(classById(save.classId), res.levelUps, res.xp, rewardChoices, false));
}

function chooseBoon(id: string): void {
  const boon = BOONS.find(b => b.id === id);
  applyBoon(id);
  sfx('select');
  pendingResult = null;
  screen = 'map';
  renderScreen();
  if (boon) showToast(`${boon.name} acquired`);
}

function showToast(text: string): void {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  app.insertAdjacentHTML('beforeend', toastHTML(text));
  setTimeout(() => document.querySelectorAll('.toast').forEach(t => t.remove()), 2600);
}

/* ------------------------------- navigation ------------------------------- */

function goTitle(): void {
  navigate('title');
}

function goClasses(): void {
  navigate('classes');
}

function goMap(): void {
  if (isVictory()) {
    const s = getSave();
    if (s.stage >= TOTAL_STAGES) {
      // still allow revisiting the map after the ending
    }
  }
  navigate('map');
}

function goVictory(): void {
  navigate('victory');
}

function confirmClass(id: ClassId): void {
  const save = getSave();
  if (save.classId && save.stage > 0 && !isVictory()) {
    showModal(`<div class="modal-back">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Start a new adventure">
        <div class="m-sub">A new page</div>
        <h2>Abandon this run?</h2>
        <p>Starting a new adventure with <b>${classById(id).name}</b> will erase your current ${classById(save.classId).name} (level ${save.level}, ${save.boons.length} boons).</p>
        <div class="modal-close" style="gap:8px">
          <button class="btn ghost" data-close-modal="1">Keep my hero</button>
          <button class="btn primary" data-confirm-class="${id}">Begin anew</button>
        </div>
      </div>
    </div>`);
    return;
  }
  beginClass(id);
}

function beginClass(id: ClassId): void {
  selectClass(id);
  sfx('select');
  closeModal();
  startBattle();
}

function confirmReset(): void {
  showModal(`<div class="modal-back">
    <div class="modal" role="dialog" aria-modal="true" aria-label="Abandon run">
      <div class="m-sub">Walk away</div>
      <h2>Abandon this run?</h2>
      <p>All levels, boons and realm progress will be erased. The Vale will remember nothing.</p>
      <div class="modal-close" style="gap:8px">
        <button class="btn ghost" data-close-modal="1">Keep going</button>
        <button class="btn primary" data-confirm-reset="1">Abandon run</button>
      </div>
    </div>
  </div>`);
}

/* -------------------------------- listeners ------------------------------- */

document.addEventListener('click', (ev) => {
  const target = ev.target as HTMLElement;
  if (!target.closest('.audio-menu')) closeAudioMenus();
  const navEl = target.closest<HTMLElement>('[data-nav]');
  if (navEl) {
    ev.preventDefault();
    sfx('click');
    closeModal();
    const nav = navEl.dataset.nav as Screen;
    if (nav === 'classes') goClasses();
    else if (nav === 'map') goMap();
    else if (nav === 'victory') goVictory();
    else if (nav === 'title') goTitle();
    return;
  }
  const actionEl = target.closest<HTMLElement>('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    if (action === 'howto') { sfx('click'); showModal(howToHTML()); return; }
    if (action === 'audio-menu') { toggleAudioMenu(actionEl); return; }
    if (action === 'toggle-sound' || action === 'toggle-music') {
      // The icon mutes and unmutes, keeping the slider's level; unmuting at zero restores a usable level.
      const s = getSave();
      if (action === 'toggle-sound') updateSave({ sound: !s.sound, sfxVolume: !s.sound && s.sfxVolume === 0 ? 0.6 : s.sfxVolume });
      else updateSave({ music: !s.music, musicVolume: !s.music && s.musicVolume === 0 ? 0.6 : s.musicVolume });
      applyAudioLevels();
      refreshToggles();
      if (action === 'toggle-sound' && !s.sound) audio.sfx('click');
      return;
    }
    if (action === 'reset') { sfx('click'); confirmReset(); return; }
  }
  const chooseEl = target.closest<HTMLElement>('[data-choose]');
  if (chooseEl) { sfx('click'); confirmClass(chooseEl.dataset.choose as ClassId); return; }
  const battleEl = target.closest<HTMLElement>('[data-battle]');
  if (battleEl) {
    sfx('click');
    const stage = Number(battleEl.dataset.battle);
    const save = getSave();
    if (stage === save.stage && save.stage < TOTAL_STAGES) startBattle();
    return;
  }
  if (target.closest('[data-reroll]')) { rerollBoons(); return; }
  const boonEl = target.closest<HTMLElement>('[data-boon]');
  if (boonEl) { chooseBoon(boonEl.dataset.boon!); return; }
  const resultEl = target.closest<HTMLElement>('[data-result]');
  if (resultEl) {
    const action = resultEl.dataset.result;
    if (action === 'retry') { sfx('click'); startBattle(true); return; }
    if (action === 'map') { sfx('back'); navigate('map'); return; }
    if (action === 'spoils') {
      sfx('click');
      if (pendingResult?.final) { pendingResult = null; screen = 'victory'; renderScreen(); return; }
      showRewardScreen();
      return;
    }
  }
  const pauseEl = target.closest<HTMLElement>('[data-pause]');
  if (pauseEl) {
    const a = pauseEl.dataset.pause;
    if (a === 'resume') togglePause();
    else if (a === 'restart') { sfx('click'); startBattle(true); }
    else if (a === 'quit') { sfx('back'); navigate('map'); }
    return;
  }
  const confirmResetEl = target.closest<HTMLElement>('[data-confirm-reset]');
  if (confirmResetEl) {
    resetSave();
    closeModal();
    goTitle();
    return;
  }
  const confirmClassEl = target.closest<HTMLElement>('[data-confirm-class]');
  if (confirmClassEl) {
    beginClass(confirmClassEl.dataset.confirmClass as ClassId);
    return;
  }
  if (target.closest('[data-close-modal]')) {
    sfx('back');
    closeModal();
    return;
  }
  if (target.classList.contains('modal-back')) {
    closeModal();
    return;
  }
});

// Volume sliders: dragging sets the level live; moving off zero also unmutes.
document.addEventListener('input', (ev) => {
  const el = ev.target as HTMLElement;
  if (!(el instanceof HTMLInputElement) || !el.dataset.volume) return;
  const v = Number(el.value) / 100;
  if (el.dataset.volume === 'sound') updateSave({ sfxVolume: v, ...(v > 0 ? { sound: true } : {}) });
  else updateSave({ musicVolume: v, ...(v > 0 ? { music: true } : {}) });
  applyAudioLevels();
  refreshToggles();
});
// Let go of the sound-effects slider and hear the new level.
document.addEventListener('change', (ev) => {
  const el = ev.target as HTMLElement;
  if (el instanceof HTMLInputElement && el.dataset.volume === 'sound') audio.sfx('click');
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (closeAudioMenus()) return;
    if (modalOpen) { closeModal(); return; }
    if (screen === 'battle') togglePause();
  }
  if (screen !== 'battle' || !battle || paused || modalOpen) return;
  if (ev.code === 'Space' || ev.key === '1' || ev.key === '2' || ev.key === '3') {
    ev.preventDefault();
    useUltimate();
  }
});

// Prevent page scroll on space when battle is active
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space' && screen === 'battle') ev.preventDefault();
});

// Rotating the phone or resizing the window re-fits the battle, then the canvas follows the arena.
window.addEventListener('resize', () => {
  fitBattleShell();
  renderer?.resize();
});

/* ---------------------------------- boot ---------------------------------- */

function boot(): void {
  initHovercard();
  loadSave();
  screen = 'title';
  renderScreen();
}

boot();
