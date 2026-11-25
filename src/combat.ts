import {
  type AbilityDef, type BodyKind, type ClassId, type EnemyDef, type EnemyInstance,
  type Stats, type StatusKind, classById,
} from './data';
import { BALANCE } from './balance';

export interface ActiveEffect {
  kind: StatusKind;
  remaining: number;
  power: number;
  tick: number;
}

export interface Unit {
  uid: number;
  side: 'hero' | 'enemy' | 'ally';
  name: string;
  classId?: ClassId;
  body: BodyKind;
  colors: { main: string; dark: string; glow: string; accent?: string; cloth?: string };
  stats: Stats;
  hp: number;
  shield: number;
  alive: boolean;
  attackTimer: number;
  abilities: AbilityDef[];
  abilityCds: number[];
  ultimate?: AbilityDef;
  ultCharge: number;
  effects: ActiveEffect[];
  isSummon: boolean;
  lifetime?: number;
  boss: boolean;
  scale: number;
  anim: { attack: number; hit: number; heal: number; spawn: number; cast: number };
  deadTime: number;
  lastStand?: boolean;
}

export type CombatEvent =
  | { type: 'damage'; source: Unit; target: Unit; amount: number; crit: boolean; kind: 'attack' | 'ability' | 'dot' | 'thorns' | 'ult'; ability?: string }
  | { type: 'heal'; source: Unit; target: Unit; amount: number }
  | { type: 'shield'; target: Unit; amount: number }
  | { type: 'dodge'; target: Unit }
  | { type: 'cast'; source: Unit; ability: AbilityDef; ult: boolean }
  | { type: 'death'; unit: Unit }
  | { type: 'summon'; unit: Unit }
  | { type: 'message'; text: string; tone: 'info' | 'good' | 'bad' | 'epic' }
  | { type: 'end'; victory: boolean; time: number };

let nextUid = 1;

function baseUnit(partial: Partial<Unit> & Pick<Unit, 'side' | 'name' | 'body' | 'colors' | 'stats'>): Unit {
  return {
    uid: nextUid++,
    hp: partial.stats.maxHp,
    shield: 0,
    alive: true,
    attackTimer: BALANCE.combat.firstAttackDelay + Math.random() * BALANCE.combat.firstAttackJitter,
    abilities: [],
    abilityCds: [],
    ultCharge: 0,
    effects: [],
    isSummon: false,
    boss: false,
    scale: 1,
    anim: { attack: 0, hit: 0, heal: 0, spawn: 0, cast: 0 },
    deadTime: 0,
    ...partial,
    stats: { ...partial.stats },
  };
}

export function makeHeroUnit(classId: ClassId, stats: Stats): Unit {
  const cls = classById(classId);
  const u = baseUnit({
    side: 'hero', name: cls.name, classId, body: 'knight',
    colors: { main: cls.colors.main, dark: cls.colors.cloth, glow: cls.colors.glow, accent: cls.colors.accent, cloth: cls.colors.cloth },
    stats,
    abilities: cls.abilities,
    abilityCds: cls.abilities.map(() => 0),
    ultimate: cls.ultimate,
  });
  u.anim.spawn = 0;
  return u;
}

function enemyStats(def: EnemyDef, hpScale: number, atkScale: number, stage: number): Stats {
  const s: Stats = {
    maxHp: Math.round(def.hp * hpScale),
    atk: def.atk * atkScale,
    armor: def.armor + stage * BALANCE.enemy.armorPerStage,
    crit: def.crit ?? BALANCE.enemy.crit,
    critMult: BALANCE.enemy.critMult,
    speed: def.speed,
    dodge: def.dodge ?? BALANCE.enemy.dodge,
    regen: 0,
    lifesteal: 0,
    damageReduction: 0,
    abilityPower: 1,
    ultRate: 1,
  };
  return s;
}

export function makeEnemyUnit(inst: EnemyInstance, stage: number): Unit {
  const def = inst.def;
  return baseUnit({
    side: 'enemy', name: inst.name, body: def.body, colors: def.colors,
    stats: enemyStats(def, inst.hpScale, inst.atkScale, stage),
    abilities: def.abilities,
    abilityCds: def.abilities.map((_, i) => BALANCE.enemy.firstCast + i * BALANCE.enemy.castStagger),
    boss: !!def.boss,
    scale: def.scale ?? 1,
  });
}

export interface CombatHandlers {
  onEvent?: (e: CombatEvent) => void;
}

/** Effects a cleanse removes (the same list castAbility filters with). */
const CLEANSABLE: StatusKind[] = ['burn', 'poison', 'bleed', 'stun', 'slow'];

/** Damage variance, tick lengths and the summon's stats are mechanics, not tuning knobs. */
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class Battle {
  hero: Unit;
  enemies: Unit[] = [];
  allies: Unit[] = [];
  units: Unit[] = [];
  globalStage: number;
  time = 0;
  ended = false;
  victory = false;
  onEvent: (e: CombatEvent) => void;
  chargeRate = 1;
  private wolfCooldownPrevent = false;
  private enrageAnnounced = false;
  /** Battle time at which the next ultimate may be cast (see BALANCE.ultimate.minInterval). */
  private ultReadyAt = 0;

  constructor(heroClass: ClassId, heroStats: Stats, wave: EnemyInstance[], globalStage: number, handlers: CombatHandlers = {}) {
    this.globalStage = globalStage;
    this.onEvent = handlers.onEvent ?? (() => {});
    this.chargeRate = heroStats.ultRate;
    this.hero = makeHeroUnit(heroClass, heroStats);
    this.hero.anim.spawn = 0;
    // Armor scales with the global stage (0..24). It used to receive `globalStage + stageInLoc`,
    // which gave every realm's boss more bonus armor than the enemies of the next realm.
    this.enemies = wave.map(inst => makeEnemyUnit(inst, globalStage));
    this.units = [this.hero, ...this.enemies];
  }

  emit(e: CombatEvent) { this.onEvent(e); }

  get hostilesOf(): (u: Unit) => Unit[] {
    return (u: Unit) => u.side === 'enemy'
      ? [this.hero, ...this.allies].filter(a => a.alive)
      : this.enemies.filter(e => e.alive);
  }

  update(rawDt: number): void {
    const dt = Math.min(rawDt, 0.05);
    if (this.ended) {
      for (const u of this.units) u.anim.hit = Math.max(0, u.anim.hit - dt * 4);
      return;
    }
    this.time += dt;
    if (!this.enrageAnnounced && this.time > BALANCE.combat.enrageAt) {
      this.enrageAnnounced = true;
      this.emit({ type: 'message', text: 'The air ignites — all damage increases!', tone: 'epic' });
    }
    for (const u of this.units) {
      this.updateUnit(u, dt);
    }
    // expire corpses
    for (const u of this.units) if (!u.alive) u.deadTime += dt;
    this.allies = this.allies.filter(a => {
      if (!a.alive) return false;
      if (a.lifetime !== undefined) {
        a.lifetime -= dt;
        if (a.lifetime <= 0) { a.alive = false; this.emit({ type: 'death', unit: a }); return false; }
      }
      return true;
    });
    this.units = [this.hero, ...this.enemies, ...this.allies];
    if (!this.hero.alive) {
      this.finish(false);
    } else if (this.enemies.every(e => !e.alive)) {
      this.finish(true);
    }
  }

  private finish(victory: boolean) {
    if (this.ended) return;
    this.ended = true;
    this.victory = victory;
    this.emit({ type: 'end', victory, time: this.time });
  }

  private updateUnit(u: Unit, dt: number): void {
    // visual decays
    u.anim.attack = Math.max(0, u.anim.attack - dt * 3.4);
    u.anim.hit = Math.max(0, u.anim.hit - dt * 4);
    u.anim.heal = Math.max(0, u.anim.heal - dt * 2.4);
    u.anim.cast = Math.max(0, u.anim.cast - dt * 3);
    u.anim.spawn = Math.min(1, u.anim.spawn + dt * 2.5);
    if (!u.alive) {
      u.deadTime += 0;
      return;
    }
    // effects
    let stunned = false;
    for (const eff of u.effects) {
      eff.remaining -= dt;
      if (eff.kind === 'stun') stunned = true;
      if (eff.kind === 'burn' || eff.kind === 'poison' || eff.kind === 'bleed') {
        eff.tick += dt;
        while (eff.tick >= 0.5) {
          eff.tick -= 0.5;
          const dmg = eff.power * 0.5;
          this.applyDirect(u, dmg, 'dot', undefined, false);
          if (!u.alive) break;
        }
      } else if (eff.kind === 'regen') {
        eff.tick += dt;
        while (eff.tick >= 0.5) {
          eff.tick -= 0.5;
          this.heal(u, u, u.stats.maxHp * (eff.power / 100) * 0.5, false);
        }
      }
    }
    u.effects = u.effects.filter(e => e.remaining > 0);
    if (!u.alive) return;

    // natural regen
    if (u.stats.regen > 0 && u.hp < u.stats.maxHp) {
      const amt = u.stats.regen * dt;
      u.hp = Math.min(u.stats.maxHp, u.hp + amt);
    }

    // ultimate charge over time for hero
    if (u.side === 'hero') {
      u.ultCharge = clamp(u.ultCharge + dt * BALANCE.ultimate.passiveCharge * this.chargeRate, 0, 100);
    }

    // ability cooldowns
    for (let i = 0; i < u.abilityCds.length; i++) u.abilityCds[i] = Math.max(0, u.abilityCds[i] - dt);

    if (stunned) return;

    // decide action
    const interval = this.attackInterval(u);
    u.attackTimer -= dt;
    if (u.attackTimer <= 0) {
      const used = this.tryCastAbility(u);
      if (!used) this.basicAttack(u);
      u.attackTimer = interval;
    }
  }

  private attackInterval(u: Unit): number {
    let haste = 1;
    let slow = 1;
    for (const e of u.effects) {
      if (e.kind === 'haste') haste *= e.power;
      if (e.kind === 'slow') slow *= e.power;
    }
    return (u.stats.speed / haste) * slow;
  }

  private atkMult(u: Unit): number {
    let m = 1;
    for (const e of u.effects) if (e.kind === 'empower') m *= e.power;
    return m;
  }

  private dodgeOf(u: Unit): number {
    let d = u.stats.dodge;
    for (const e of u.effects) if (e.kind === 'dodge') d += e.power;
    return clamp(d, 0, 0.85);
  }

  private basicAttack(u: Unit): void {
    const foes = this.hostilesOf(u);
    if (!foes.length) return;
    const target = u.side === 'enemy' ? this.hero : foes[Math.floor(Math.random() * foes.length)];
    if (!target || !target.alive) return;
    u.anim.attack = 1;
    let power = 1;
    let kind: 'attack' = 'attack';
    // class passives
    if (u.classId === 'pyromancer') {
      this.applyStatus(target, { kind: 'burn', duration: BALANCE.combat.pyroBurnDuration, power: u.stats.atk * BALANCE.combat.pyroBurnPower }, u);
    }
    this.dealDamage(u, target, u.stats.atk * power * this.atkMult(u), { crit: true, kind });
  }

  private tryCastAbility(u: Unit): boolean {
    if (!u.alive) return false;
    // hero: check for summon duplicate
    const foes = this.hostilesOf(u);
    if (!foes.length) return false;
    for (let i = 0; i < u.abilities.length; i++) {
      const ab = u.abilities[i];
      if (u.abilityCds[i] > 0) continue;
      if (ab.summon) {
        if (this.allies.some(a => a.alive && a.isSummon)) continue;
      }
      // An ability that deals no damage has to do something to be worth casting.
      if (!(ab.power ?? 0) && (ab.heal || ab.shield || ab.cleanse || ab.selfEffect || ab.selfEffects)) {
        if (!this.wantsUtility(u, ab)) continue;
      }
      // self-buff avoid casting immediately at full overlap
      const buffs = [...(ab.selfEffect ? [ab.selfEffect] : []), ...(ab.selfEffects ?? [])];
      if (ab.target === 'self' && buffs.length && buffs.every(spec => u.effects.some(e => e.kind === spec.kind && e.remaining > ab.cooldown * 0.6))) continue;
      this.castAbility(u, ab, i);
      return true;
    }
    return false;
  }

  /**
   * Whether a heal/shield/buff ability is worth casting right now.
   *
   * This used to be "only when HP is below 72%", which made the Warden's Radiant Ward never fire at
   * all: a Warden sits at 94-95% of its health, so its heal/shield skill was dead for the whole game.
   * The same rule held back the Pyromancer's Cinder Veil (+35% attack, +25% haste) and the
   * Shadowblade's Smoke Step, whose buff is the point of the ability rather than a side effect.
   */
  private wantsUtility(u: Unit, ab: AbilityDef): boolean {
    if (u.hp / u.stats.maxHp <= 0.72) return true;
    // A shield is worth refreshing long before the health bar matters.
    if ((ab.shield ?? 0) > 0 && u.shield < u.stats.maxHp * 0.2) return true;
    if (ab.cleanse && u.effects.some(e => CLEANSABLE.includes(e.kind))) return true;
    // An offensive or defensive buff is the reason to cast: use it on cooldown.
    const buffs = [...(ab.selfEffect ? [ab.selfEffect] : []), ...(ab.selfEffects ?? [])];
    return buffs.some(s => s.kind === 'empower' || s.kind === 'haste' || s.kind === 'dodge');
  }

  castAbility(u: Unit, ab: AbilityDef, abilityIndex = -1): void {
    if (u.abilityCds[abilityIndex] !== undefined) u.abilityCds[abilityIndex] = ab.cooldown;
    u.anim.cast = 1;
    this.emit({ type: 'cast', source: u, ability: ab, ult: false });
    const foes = this.hostilesOf(u);
    const primary = u.side === 'enemy' ? this.hero : this.pickTarget(foes);
    const power = ab.power ?? 0;
    const powerMult = u.stats.abilityPower * (power > 0 ? 1 : 0);
    const dmgBase = u.stats.atk * this.atkMult(u) * power * powerMult;
    const isUlt = ab.cooldown === 0;
    if (ab.summon) {
      this.summonWolf(u);
    }
    if (ab.cleanse) {
      u.effects = u.effects.filter(e => !['burn', 'poison', 'bleed', 'stun', 'slow'].includes(e.kind));
    }
    if (ab.heal) {
      this.heal(u, u, u.stats.maxHp * ab.heal * (isUlt ? u.stats.abilityPower : 1), true);
    }
    if (ab.shield) {
      this.addShield(u, u.stats.maxHp * ab.shield * (isUlt ? u.stats.abilityPower : 1));
    }
    const selfSpecs = [...(ab.selfEffect ? [ab.selfEffect] : []), ...(ab.selfEffects ?? [])];
    for (const spec of selfSpecs) {
      this.applyStatus(u, { ...spec, power: this.scaleEffect(u, spec) }, u);
    }
    if (power > 0) {
      const targets = ab.target === 'allEnemies' ? foes : primary ? [primary] : [];
      const hits = ab.hits ?? 1;
      for (const t of targets) {
        for (let h = 0; h < hits; h++) {
          if (!t.alive) break;
          this.dealDamage(u, t, dmgBase * rand(0.94, 1.06), { crit: true, kind: isUlt ? 'ult' : 'ability', ability: ab.name });
        }
        if (ab.effect && t.alive) {
          this.applyStatus(t, { ...ab.effect, power: this.scaleEffect(u, ab.effect) }, u);
        }
        if (isUlt && ab.effect?.kind === 'burn') {
          this.applyStatus(t, { kind: 'stun', duration: BALANCE.combat.pyroUltStun, power: 1 }, u);
        }
      }
    }
    if (isUlt && u.side === 'hero') {
      u.ultCharge = 0;
    }
  }

  private scaleEffect(source: Unit, spec: { kind: StatusKind; duration: number; power: number }): number {
    switch (spec.kind) {
      case 'burn': case 'poison': case 'bleed':
        return source.stats.atk * spec.power * (source.stats.abilityPower ?? 1);
      case 'regen':
        return spec.power; // percent max hp per second
      case 'haste': case 'empower': case 'dodge': case 'thorns': case 'slow':
        return spec.power;
      case 'stun':
        return 1;
      default:
        return spec.power;
    }
  }

  private applyStatus(target: Unit, spec: { kind: StatusKind; duration: number; power: number }, source: Unit): void {
    if (!target.alive) return;
    if (spec.kind === 'stun' && target.boss) spec = { ...spec, duration: spec.duration * BALANCE.combat.bossStunFactor };
    const existing = target.effects.find(e => e.kind === spec.kind);
    if (existing) {
      existing.remaining = Math.max(existing.remaining, spec.duration);
      existing.power = Math.max(existing.power, spec.power);
    } else {
      target.effects.push({ kind: spec.kind, remaining: spec.duration, power: spec.power, tick: 0 });
    }
  }

  private pickTarget(foes: Unit[]): Unit | undefined {
    if (!foes.length) return undefined;
    return foes.reduce((a, b) => (a.hp < b.hp ? a : b));
  }

  /** Direct unavoidable damage used for DoT ticks. */
  private applyDirect(target: Unit, amount: number, kind: 'dot', source?: Unit, canDodge = false): void {
    if (!target.alive) return;
    let dmg = amount;
    const armor = target.stats.armor;
    dmg *= 100 / (100 + armor);
    dmg *= 1 - target.stats.damageReduction;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, dmg);
      target.shield -= absorbed;
      dmg -= absorbed;
    }
    target.hp -= dmg;
    target.anim.hit = Math.max(target.anim.hit, 0.5);
    this.emit({ type: 'damage', source: source ?? target, target, amount: dmg, crit: false, kind: 'dot' });
    if (target.side === 'hero') this.gainUlt(dmg * BALANCE.ultimate.chargeTaken);
    if (target.hp <= 0) this.kill(target);
  }

  dealDamage(
    source: Unit, target: Unit, raw: number,
    opts: { crit: boolean; kind: 'attack' | 'ability' | 'ult' | 'thorns'; ability?: string; forceCrit?: boolean; noLifesteal?: boolean },
  ): number {
    if (!target.alive) return 0;
    // dodge
    if (Math.random() < this.dodgeOf(target)) {
      this.emit({ type: 'dodge', target });
      return 0;
    }
    let crit = false;
    if (opts.crit) {
      const cc = source.stats.crit;
      crit = opts.forceCrit || Math.random() < cc;
    }
    let dmg = raw * rand(0.93, 1.07);
    if (crit) {
      let cm = source.stats.critMult;
      if (source.classId === 'shadowblade') cm += BALANCE.combat.shadowbladeCritBonus;
      dmg *= cm;
    }
    dmg *= 100 / (100 + target.stats.armor);
    // The air itself begins to burn after a while — no battle can stall forever. The enrage is
    // applied after armour on purpose: it is the one pressure a heavily armoured hero cannot
    // mitigate away, which is what makes a long boss fight a risk for the Warden rather than a grind.
    if (this.time > BALANCE.combat.enrageAt) dmg *= 1 + (this.time - BALANCE.combat.enrageAt) * BALANCE.combat.enrageRamp;
    dmg *= 1 - target.stats.damageReduction;
    dmg = Math.max(1, dmg);
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, dmg);
      target.shield -= absorbed;
      dmg -= absorbed;
    }
    target.hp -= dmg;
    target.anim.hit = 1;
    this.emit({
      type: 'damage', source, target, amount: dmg, crit,
      kind: opts.kind, ability: opts.ability,
    });
    // lifesteal
    if (source.stats.lifesteal > 0 && !opts.noLifesteal && source.alive) {
      const heal = dmg * source.stats.lifesteal;
      if (heal >= 1) this.heal(source, source, heal, false);
    }
    // ultimate charge
    if (source.side === 'hero') this.gainUlt(dmg * BALANCE.ultimate.chargeDealt);
    if (target.side === 'hero') this.gainUlt(dmg * BALANCE.ultimate.chargeTaken);
    // thorns
    const thorn = target.effects.find(e => e.kind === 'thorns');
    if (thorn && source !== target && source.alive && opts.kind !== 'thorns') {
      const reflect = dmg * thorn.power;
      if (reflect >= 1) this.dealDamage(target, source, reflect, { crit: false, kind: 'thorns', forceCrit: false, noLifesteal: true });
    }
    if (target.hp <= 0) this.kill(target);
    return dmg;
  }

  private gainUlt(amount: number): void {
    this.hero.ultCharge = clamp(this.hero.ultCharge + amount * this.chargeRate, 0, 100);
  }

  heal(source: Unit, target: Unit, amount: number, show: boolean): void {
    if (!target.alive) return;
    const before = target.hp;
    target.hp = Math.min(target.stats.maxHp, target.hp + amount);
    const real = target.hp - before;
    if (real >= 1 && show) {
      target.anim.heal = 1;
      this.emit({ type: 'heal', source, target, amount: real });
    }
  }

  addShield(source: Unit, amount: number): void {
    const target = source;
    if (!target.alive) return;
    target.shield = Math.min(target.stats.maxHp * 0.8, target.shield + amount);
    this.emit({ type: 'shield', target, amount });
  }

  private kill(u: Unit): void {
    if (!u.alive) return;
    u.alive = false;
    u.hp = 0;
    u.deadTime = 0;
    this.emit({ type: 'death', unit: u });
  }

  useUltimate(): boolean {
    if (this.ended || !this.hero.alive) return false;
    if (this.hero.ultCharge < 100) return false;
    // A charge is a gate, not a rate: without this, stacked charge-rate boons turned the ultimate
    // into a rotation (a Warden cast it every 1.4 s and never lost a boss).
    if (this.time < this.ultReadyAt) return false;
    this.ultReadyAt = this.time + BALANCE.ultimate.minInterval;
    const ult = this.hero.ultimate!;
    this.hero.ultCharge = 0;
    this.emit({ type: 'cast', source: this.hero, ability: ult, ult: true });
    this.hero.anim.cast = 1;
    // reuse cast logic but avoid ult recharge reset twice
    const foes = this.hostilesOf(this.hero);
    if (ult.heal) this.heal(this.hero, this.hero, this.hero.stats.maxHp * ult.heal * this.hero.stats.abilityPower, true);
    if (ult.shield) this.addShield(this.hero, this.hero.stats.maxHp * ult.shield * this.hero.stats.abilityPower);
    if (ult.selfEffect) this.applyStatus(this.hero, { ...ult.selfEffect, power: this.scaleEffect(this.hero, ult.selfEffect) }, this.hero);
    if (ult.cleanse) this.hero.effects = this.hero.effects.filter(e => !['burn', 'poison', 'bleed', 'stun', 'slow'].includes(e.kind));
    const targets = ult.target === 'allEnemies' ? foes : ult.target === 'enemy' ? [this.pickTarget(foes)!].filter(Boolean) : [];
    const base = this.hero.stats.atk * this.atkMult(this.hero) * (ult.power ?? 0) * this.hero.stats.abilityPower;
    for (const t of targets) {
      if (!t || !t.alive) continue;
      this.dealDamage(this.hero, t, base * rand(0.96, 1.05), {
        crit: true, kind: 'ult', ability: ult.name,
        forceCrit: this.hero.classId === 'shadowblade',
      });
      if (ult.effect && t.alive) this.applyStatus(t, { ...ult.effect, power: this.scaleEffect(this.hero, ult.effect) }, this.hero);
      if (this.hero.classId === 'pyromancer' && t.alive) this.applyStatus(t, { kind: 'stun', duration: BALANCE.combat.pyroUltStun, power: 1 }, this.hero);
    }
    if (ult.target === 'self' && ult.selfEffect) {
      // Warden ult also taunts? no—shield + thorns handled above
    }
    this.hero.ultCharge = 0;
    return true;
  }

  private summonWolf(u: Unit): void {
    const wolf = baseUnit({
      side: 'ally', name: 'Spirit Wolf', body: 'wolf',
      colors: { main: '#8dffc2', dark: '#2d5a3f', glow: '#e7ffd4' },
      stats: {
        maxHp: Math.round(u.stats.maxHp * 0.3), atk: u.stats.atk * 0.65, armor: 6, crit: 0.15, critMult: 1.5,
        speed: 1.15, dodge: 0, regen: 0, lifesteal: 0, damageReduction: 0,
        abilityPower: 1, ultRate: 1,
      },
      abilities: [], abilityCds: [], isSummon: true, lifetime: 12,
    });
    wolf.anim.spawn = 0;
    this.allies.push(wolf);
    this.units.push(wolf);
    this.emit({ type: 'summon', unit: wolf });
  }
}
