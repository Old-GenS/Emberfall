import {
  BOONS, classById, type AbilityDef, type BoonDef, type ClassDef, type ClassId, type IconName, type StatusSpec,
} from './data';
import { BALANCE } from './balance';
import { icon } from './ui';

const GAP = 10;
const EDGE = 8;
const ARROW_EDGE = 14;
const SHOW_DELAY = 120;
const TOUCH_FOCUS_GRACE = 700;
const TARGET_LABEL: Record<AbilityDef['target'], string> = {
  enemy: 'One foe',
  allEnemies: 'All foes',
  self: 'Self',
  ally: 'An ally',
};
const STATUS_NAME: Record<StatusSpec['kind'], string> = {
  burn: 'Burn', poison: 'Poison', bleed: 'Bleed', stun: 'Stun', regen: 'Regen',
  haste: 'Haste', empower: 'Empower', dodge: 'Dodge', thorns: 'Thorns', slow: 'Slow',
};

let initialized = false;
let card: HTMLDivElement | null = null;
let currentAnchor: HTMLElement | null = null;
let showTimer = 0;
let lastTouch = 0;

const esc = (value: unknown): string => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

function fact(label: string, value: string): string {
  return `<div class="hc-fact"><span class="hc-label">${esc(label)}</span><span class="hc-value">${esc(value)}</span></div>`;
}

function statusFact(status: StatusSpec, label: 'Inflicts' | 'Grants'): string {
  if (status.kind === 'burn' || status.kind === 'poison' || status.kind === 'bleed') {
    return fact(label, `${STATUS_NAME[status.kind]} · ${Math.round(status.power * 100)}% ATK per second for ${status.duration}s`);
  }
  if (status.kind === 'stun') return fact(label, `Stun · ${status.duration}s (shorter on bosses)`);
  if (status.kind === 'slow') return fact(label, `Slow · attacks ${Math.round((status.power - 1) * 100)}% slower for ${status.duration}s`);
  if (status.kind === 'haste') return fact(label, `Haste · +${Math.round((status.power - 1) * 100)}% attack speed for ${status.duration}s`);
  if (status.kind === 'empower') return fact(label, `Empower · +${Math.round((status.power - 1) * 100)}% damage for ${status.duration}s`);
  if (status.kind === 'dodge') return fact(label, `Dodge · +${Math.round(status.power * 100)}% dodge for ${status.duration}s`);
  if (status.kind === 'thorns') return fact(label, `Thorns · reflect ${Math.round(status.power * 100)}% of damage taken for ${status.duration}s`);
  return fact(label, `Regen · ${status.power}% max HP per second for ${status.duration}s`);
}

function abilityFacts(ability: AbilityDef): string {
  const rows: string[] = [fact('Target', TARGET_LABEL[ability.target])];
  if (ability.power !== undefined) {
    rows.push(fact('Damage', `${Math.round(ability.power * 100)}% ATK${ability.hits && ability.hits > 1 ? ` × ${ability.hits} hits` : ''}`));
  }
  if (ability.heal !== undefined) rows.push(fact('Heal', `${Math.round(ability.heal * 100)}% max HP`));
  if (ability.shield !== undefined) rows.push(fact('Shield', `${Math.round(ability.shield * 100)}% max HP`));
  if (ability.effect) rows.push(statusFact(ability.effect, 'Inflicts'));
  if (ability.selfEffect) rows.push(statusFact(ability.selfEffect, 'Grants'));
  for (const status of ability.selfEffects ?? []) rows.push(statusFact(status, 'Grants'));
  if (ability.cleanse) rows.push(fact('Cleanse', 'removes harmful effects'));
  if (ability.summon) rows.push(fact('Summon', 'calls a spirit wolf'));
  return rows.join('');
}

function header(iconName: IconName, name: string, typeLine: string): string {
  return `<div class="hc-head">
    <span class="hc-icon">${icon(iconName)}</span>
    <span class="hc-titles"><span class="hc-name">${esc(name)}</span><span class="hc-type">${esc(typeLine)}</span></span>
  </div>`;
}

function abilityCard(ability: AbilityDef, typeLine: string): string {
  return `${header(ability.icon, ability.name, typeLine)}
    <p class="hc-desc">${esc(ability.desc)}</p>
    <div class="hc-facts">${abilityFacts(ability)}</div>`;
}

function perfectGuardBonus(cls: ClassDef): string {
  switch (cls.guard.bonus) {
    case 'shield':
      return `Gain a ward worth ${Math.round(BALANCE.guard.bonusShield * 100)}% max HP and stagger the attacker.`;
    case 'burn':
      return `Set the attacker ablaze for ${BALANCE.guard.bonusBurnDuration}s and stagger it.`;
    case 'counter':
      return `Strike back for ${Math.round(BALANCE.guard.bonusCounter * 100)}% ATK (always crits) and stagger the attacker.`;
    case 'heal':
      return `Mend ${Math.round(BALANCE.guard.bonusHeal * 100)}% max HP and stagger the attacker.`;
  }
}

function skillContent(cls: ClassDef, index: string): string | null {
  if (index === 'passive') {
    return `${header(cls.passive.icon, cls.passive.name, 'Passive · always active')}
      <p class="hc-desc">${esc(cls.passive.desc)}</p>`;
  }
  if (index === 'guard') {
    return `${header(cls.guard.icon, cls.guard.name, 'Guard · F')}
      <p class="hc-desc">${esc(cls.guard.desc)}</p>
      <div class="hc-facts">${fact('Perfect guard', perfectGuardBonus(cls))}</div>`;
  }
  if (index === 'ult') return abilityCard(cls.ultimate, 'Ultimate · charges in combat');
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i > 2) return null;
  const ability = cls.abilities[i];
  if (!ability) return null;
  return abilityCard(ability, `Skill · ${ability.cooldown}s cooldown`);
}

function boonContent(boon: BoonDef): string {
  const classes = boon.classes?.length
    ? ` · ${boon.classes.map(id => classById(id as ClassId).name).join(', ')} only`
    : '';
  return `${header(boon.icon, boon.name, `${titleCase(boon.rarity)} boon${classes}`)}
    <p class="hc-desc">${esc(boon.desc)}</p>`;
}

function contentFor(value: string): string | null {
  if (value.startsWith('skill:')) {
    const match = /^skill:([^:]+):(.+)$/.exec(value);
    if (!match) return null;
    const cls = classById(match[1] as ClassId);
    if (!cls) return null;
    return skillContent(cls, match[2]);
  }
  if (value.startsWith('boon:')) {
    const id = value.slice('boon:'.length);
    const boon = BOONS.find(b => b.id === id);
    return boon ? boonContent(boon) : null;
  }
  return null;
}

function anchorFor(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest<HTMLElement>('[data-tip]');
  return anchor && anchor.dataset.tip ? anchor : null;
}

function hide(): void {
  window.clearTimeout(showTimer);
  showTimer = 0;
  if (currentAnchor) currentAnchor.removeAttribute('aria-describedby');
  currentAnchor = null;
  if (card) {
    card.hidden = true;
    card.classList.remove('below');
    card.innerHTML = '';
  }
}

function position(anchor: HTMLElement): void {
  if (!card) return;
  const rect = anchor.getBoundingClientRect();
  const width = card.offsetWidth;
  const height = card.offsetHeight;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const center = rect.left + rect.width / 2;

  let left = center - width / 2;
  left = Math.max(EDGE, Math.min(left, viewportWidth - width - EDGE));

  let top = rect.top - height - GAP;
  const below = top < EDGE;
  if (below) top = rect.bottom + GAP;
  // The card is placed above or below the anchor; keep it on screen when the viewport is very short.
  top = Math.max(EDGE, Math.min(top, Math.max(EDGE, viewportHeight - height - EDGE)));

  const arrow = card.querySelector<HTMLElement>('.hc-arrow');
  if (arrow) {
    const arrowX = Math.max(ARROW_EDGE, Math.min(center - left, width - ARROW_EDGE));
    arrow.style.left = `${arrowX}px`;
  }

  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(top)}px`;
  card.classList.toggle('below', below);
}

function show(anchor: HTMLElement): void {
  if (!card || !anchor.isConnected) return;
  const value = anchor.dataset.tip;
  if (!value) return;
  const html = contentFor(value);
  if (!html) {
    hide();
    return;
  }
  window.clearTimeout(showTimer);
  showTimer = 0;
  if (currentAnchor && currentAnchor !== anchor) currentAnchor.removeAttribute('aria-describedby');
  currentAnchor = anchor;
  anchor.setAttribute('aria-describedby', 'hovercard');
  card.innerHTML = `<div class="hc-inner">${html}</div><span class="hc-arrow" aria-hidden="true"></span>`;
  card.hidden = false;
  position(anchor);
}

function schedule(anchor: HTMLElement): void {
  window.clearTimeout(showTimer);
  showTimer = window.setTimeout(() => {
    showTimer = 0;
    if (anchor.isConnected) show(anchor);
  }, SHOW_DELAY);
}

export function initHovercard(): void {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;

  card = document.createElement('div');
  card.className = 'hovercard';
  card.id = 'hovercard';
  card.setAttribute('role', 'tooltip');
  card.hidden = true;
  document.body.appendChild(card);

  document.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'touch') lastTouch = Date.now();
  }, true);

  document.addEventListener('pointerover', (ev) => {
    if (ev.pointerType === 'touch') return;
    const anchor = anchorFor(ev.target);
    if (!anchor) return;
    if (currentAnchor === anchor && card && !card.hidden) return;
    const related = ev.relatedTarget;
    if (related instanceof Node && anchor.contains(related)) return;
    schedule(anchor);
  });

  document.addEventListener('pointerout', (ev) => {
    const anchor = anchorFor(ev.target);
    if (!anchor || anchor !== currentAnchor) return;
    const related = ev.relatedTarget;
    if (related instanceof Node && anchor.contains(related)) return;
    hide();
  });

  document.addEventListener('focusin', (ev) => {
    if (Date.now() - lastTouch < TOUCH_FOCUS_GRACE) return;
    const anchor = anchorFor(ev.target);
    if (anchor) show(anchor);
  });

  document.addEventListener('focusout', (ev) => {
    const anchor = anchorFor(ev.target);
    if (!anchor || anchor !== currentAnchor) return;
    const related = ev.relatedTarget;
    if (related instanceof Node && anchor.contains(related)) return;
    hide();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && card && !card.hidden) hide();
  });

  document.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);

  new MutationObserver(() => {
    if (currentAnchor && !currentAnchor.isConnected) hide();
  }).observe(document.body, { childList: true, subtree: true });
}
