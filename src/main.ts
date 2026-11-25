import './style.css';
import {
  TOTAL_STAGES, buildWave, classById, stageInfo, type ClassId, type IconName,
} from './data';
import { Battle, type CombatEvent } from './combat';
import { SceneRenderer } from './art';
import { audio, type ThemeId } from './audio';
import {
  applyBoon, completeStage, getSave, hasHero, heroStats, isVictory, loadSave,
  pickBoonChoices, resetSave, selectClass, updateSave, xpProgress,
} from './state';
import {
  howToHTML, icon, renderBattle, renderClassSelect, renderMap, renderReward,
  renderTitle, renderVictory,
} from './ui';

const app = document.getElementById('app')!;

type Screen = 'title' | 'classes' | 'map' | 'battle' | 'reward' | 'victory';
let screen: Screen = 'title';
let battle: Battle | null = null;
let renderer: SceneRenderer | null = null;
let raf = 0;
let paused = false;
let speed = 1;
let overlayShown = false;
let pendingResult: { xp: number; levelUps: number; final: boolean } | null = null;
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
    audio.setMusicEnabled(save.music);
    audio.setSfxEnabled(save.sound);
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

function refreshToggles(): void {
  const save = getSave();
  document.querySelectorAll<HTMLElement>('[data-action="toggle-sound"]').forEach(el => {
    el.innerHTML = icon('speaker');
    el.title = save.sound ? 'Sound on' : 'Sound off';
    el.classList.toggle('off', !save.sound);
  });
  document.querySelectorAll<HTMLElement>('[data-action="toggle-music"]').forEach(el => {
    el.innerHTML = icon('music');
    el.title = save.music ? 'Music on' : 'Music off';
    el.classList.toggle('off', !save.music);
  });
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
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  battle = null;
  renderer?.destroy();
  renderer = null;
  paused = false;
  speed = 1;
  overlayShown = false;
  endHandled = false;
  endTimer = 0;
  pendingResult = null;
  logs = [];
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
  const canvas = document.getElementById('battle-canvas') as HTMLCanvasElement;
  const arena = document.getElementById('arena')!;
  renderer = new SceneRenderer(canvas);
  renderer.setLocation(info.location);
  if (!keepRally) rally = 1; else rally = carryRally;
  const stats = heroStats();
  if (rally > 1) { stats.maxHp = Math.round(stats.maxHp * rally); stats.atk = Math.round(stats.atk * rally * 10) / 10; }
  battle = new Battle(cls.id, stats, wave, save.stage, { onEvent: handleEvent });
  renderer.setBattle(battle);
  const boss = save.stage % 5 === 4;
  audio.playMusic(info.location.music as ThemeId, boss);
  if (boss) setTimeout(() => sfx('boss'), 200);
  bindBattleControls();
  overlayShown = false;
  paused = false;
  speed = 1;
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
  arena.insertAdjacentHTML('beforeend', `<div class="hint-banner" id="hint-banner">${icon('heart')}<span>Your skills fire automatically. When the ultimate glows, press it — or hit <b>Space</b>. Good luck.</span></div>`);
  setTimeout(() => document.getElementById('hint-banner')?.remove(), 7500);
}

function bindBattleControls(): void {
  document.getElementById('pause-btn')?.addEventListener('click', togglePause);
  document.getElementById('speed-btn')?.addEventListener('click', () => {
    speed = speed === 1 ? 2 : 1;
    const btn = document.getElementById('speed-btn');
    if (btn) {
      btn.textContent = `${speed}×`;
      btn.classList.toggle('active', speed === 2);
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
    pendingResult = { xp: res.xp, levelUps: res.levelUps, final };
    rally = 1;
    audio.sfx('victory');
    if (res.levelUps > 0) setTimeout(() => audio.sfx('levelup'), 500);
    addLog(`<b style="color:var(--gold-bright)">Victory</b> — the road opens`);
  } else {
    rally = Math.min(2.2, rally + 0.12);
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
  const info = stageInfo(getSave().stage);
  if (battle.victory) {
    const res = pendingResult;
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
          <button class="btn ghost" data-result="map">${res?.final ? 'Return to Map' : 'Skip Boon'}</button>
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
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (!paused) {
    battle.update(dt * speed);
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
    ultPct.textContent = ready ? 'Ready · press Space' : `Charging · ${pct}%`;
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
  const choices = pickBoonChoices();
  render(renderReward(classById(save.classId), res.levelUps, res.xp, choices));
  audio.playMusic('map');
  window.scrollTo({ top: 0 });
}

function chooseBoon(id: string): void {
  applyBoon(id);
  sfx('select');
  const b = pickBoonChoices; // no-op to keep types
  void b;
  pendingResult = null;
  screen = 'map';
  renderScreen();
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
    if (action === 'toggle-sound') {
      const s = getSave();
      updateSave({ sound: !s.sound });
      audio.setSfxEnabled(!s.sound);
      refreshToggles();
      if (!s.sound) audio.sfx('click');
      return;
    }
    if (action === 'toggle-music') {
      const s = getSave();
      updateSave({ music: !s.music });
      audio.setMusicEnabled(!s.music);
      refreshToggles();
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

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
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

/* ---------------------------------- boot ---------------------------------- */

function boot(): void {
  loadSave();
  screen = 'title';
  renderScreen();
}

boot();
