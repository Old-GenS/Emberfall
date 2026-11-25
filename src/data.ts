import { BALANCE } from './balance';

export type ClassId = 'warden' | 'pyromancer' | 'shadowblade' | 'spiritcaller';
export type Side = 'hero' | 'enemy' | 'ally';
export type IconName =
  | 'shield' | 'hammer' | 'sun' | 'flame' | 'nova' | 'meteor' | 'veil'
  | 'dagger' | 'poison' | 'smoke' | 'skull' | 'leaf' | 'bloom' | 'wolf'
  | 'heart' | 'sword' | 'bolt' | 'crown' | 'armor' | 'wind' | 'drop' | 'star'
  | 'music' | 'speaker' | 'pause';

export interface Stats {
  maxHp: number;
  atk: number;
  armor: number;
  crit: number;
  critMult: number;
  speed: number;
  dodge: number;
  regen: number;
  lifesteal: number;
  damageReduction: number;
  abilityPower: number;
  ultRate: number;
}

export type StatusKind =
  | 'burn' | 'poison' | 'bleed' | 'stun' | 'regen' | 'haste'
  | 'empower' | 'dodge' | 'thorns' | 'slow';

export interface StatusSpec {
  kind: StatusKind;
  duration: number;
  /** dot/hot: damage per second as a fraction of caster atk; haste: speed mult; empower: atk mult; dodge: additive; thorns: fraction */
  power: number;
}

export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
  icon: IconName;
  cooldown: number;
  target: 'enemy' | 'allEnemies' | 'self' | 'ally';
  power?: number;        // multiplier of ATK per hit
  hits?: number;
  heal?: number;         // fraction of max HP
  shield?: number;       // fraction of max HP
  effect?: StatusSpec;   // applied to enemies
  selfEffect?: StatusSpec;
  selfEffects?: StatusSpec[];
  cleanse?: boolean;
  summon?: boolean;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  title: string;
  tagline: string;
  lore: string;
  colors: { main: string; glow: string; cloth: string; accent: string };
  stats: Stats;
  passive: { name: string; desc: string; icon: IconName };
  abilities: AbilityDef[];
  ultimate: AbilityDef;
}

const baseStats = (o: Partial<Stats>): Stats => ({
  maxHp: 280, atk: 24, armor: 10, crit: 0.1, critMult: 1.5, speed: 1.7,
  dodge: 0.03, regen: 0, lifesteal: 0, damageReduction: 0, abilityPower: 1, ultRate: 1, ...o,
});

export const CLASSES: ClassDef[] = [
  {
    id: 'warden',
    name: 'The Warden',
    title: 'Aegis of Dawn',
    tagline: 'An immovable flame in a falling world.',
    lore: 'Last of the Dawnwatch, sworn to hold the gate until the sun returns. The shield is not a tool. It is a promise.',
    colors: { main: '#ffcf7a', glow: '#ffae42', cloth: '#3b5c9e', accent: '#e8eefc' },
    stats: baseStats({ maxHp: 380, atk: 26, armor: 20, crit: 0.09, critMult: 1.5, speed: 1.6, dodge: 0.02, regen: 0.6, damageReduction: 0.08 }),
    passive: { name: 'Bulwark', desc: 'Takes 8% less damage from all sources.', icon: 'shield' },
    abilities: [
      { id: 'shield-slam', name: 'Shield Slam', desc: 'Crush one foe for 130% ATK and stun it for 1.2s.', icon: 'hammer', cooldown: 6.5, target: 'enemy', power: 1.3, shield: 0.05, effect: { kind: 'stun', duration: 1.2, power: 1 } },
      { id: 'radiant-ward', name: 'Radiant Ward', desc: 'Restore 18% HP and gain a 14% shield. Regen for 4s.', icon: 'sun', cooldown: 11, target: 'self', heal: 0.18, shield: 0.14, selfEffect: { kind: 'regen', duration: 4, power: 2 } },
      { id: 'dawnbreaker', name: 'Dawnbreaker', desc: 'Holy shock hits all foes for 95% ATK and burns them.', icon: 'nova', cooldown: 9.5, target: 'allEnemies', power: 0.95, effect: { kind: 'burn', duration: 4, power: 0.14 } },
    ],
    ultimate: { id: 'unbreakable', name: 'Unbreakable', desc: 'Gain a 35% shield, heal 25%, and reflect 40% damage for 7s.', icon: 'shield', cooldown: 0, target: 'self', heal: 0.25, shield: 0.35, selfEffect: { kind: 'thorns', duration: 7, power: 0.4 } },
  },
  {
    id: 'pyromancer',
    name: 'The Pyromancer',
    title: 'Cinder Sage',
    tagline: 'Burn bright enough and no dark can reach you.',
    lore: 'She read one forbidden book too many. Now the book is ash, the library is ash, and her fingertips never cool.',
    colors: { main: '#ff9d5c', glow: '#ff5e2e', cloth: '#7d2c4a', accent: '#ffd9a0' },
    stats: baseStats({ maxHp: 265, atk: 32, armor: 6, crit: 0.13, critMult: 1.65, speed: 1.95, dodge: 0.03, regen: 0.3 }),
    passive: { name: 'Ignite', desc: 'Basic attacks set foes burning for 3s.', icon: 'flame' },
    abilities: [
      { id: 'ember-lance', name: 'Ember Lance', desc: 'Spear one foe for 175% ATK, burning for 5s.', icon: 'flame', cooldown: 5.5, target: 'enemy', power: 1.75, effect: { kind: 'burn', duration: 5, power: 0.2 } },
      { id: 'flame-nova', name: 'Flame Nova', desc: 'Scorch all foes for 110% ATK, burning for 4s.', icon: 'nova', cooldown: 9, target: 'allEnemies', power: 1.1, effect: { kind: 'burn', duration: 4, power: 0.18 } },
      { id: 'cinder-veil', name: 'Cinder Veil', desc: 'Gain 10% shield, +35% ATK and +25% haste for 5s.', icon: 'veil', cooldown: 12, target: 'self', shield: 0.1, selfEffects: [{ kind: 'empower', duration: 5, power: 1.35 }, { kind: 'haste', duration: 5, power: 1.25 }] },
    ],
    ultimate: { id: 'meteor', name: 'Fallen Star', desc: 'Call a meteor: 280% ATK to all foes, burn 6s, stun 0.9s.', icon: 'meteor', cooldown: 0, target: 'allEnemies', power: 2.8, effect: { kind: 'burn', duration: 6, power: 0.3 } },
  },
  {
    id: 'shadowblade',
    name: 'The Shadowblade',
    title: 'Night Thorn',
    tagline: 'The last thing they see is the smile.',
    lore: 'A blade sold to the highest bidder, until the bidder became a corpse. Now she works for no one but the road ahead.',
    colors: { main: '#b48cff', glow: '#7a4dff', cloth: '#24203a', accent: '#7df2c0' },
    stats: baseStats({ maxHp: 280, atk: 28, armor: 7, crit: 0.24, critMult: 1.7, speed: 1.45, dodge: 0.09, regen: 0.2 }),
    passive: { name: 'Lethality', desc: 'Critical strikes deal an extra 25% damage.', icon: 'skull' },
    abilities: [
      { id: 'venom-strike', name: 'Venom Strike', desc: 'Slash one foe for 145% ATK and poison it for 6s.', icon: 'poison', cooldown: 6, target: 'enemy', power: 1.45, effect: { kind: 'poison', duration: 6, power: 0.18 } },
      { id: 'twin-fangs', name: 'Twin Fangs', desc: 'Two rapid cuts, 85% ATK each, causing bleeding.', icon: 'dagger', cooldown: 8, target: 'enemy', power: 0.85, hits: 2, effect: { kind: 'bleed', duration: 5, power: 0.12 } },
      { id: 'smoke-step', name: 'Smoke Step', desc: 'Heal 10%, gain 30% dodge and 30% haste for 5s.', icon: 'smoke', cooldown: 13, target: 'self', heal: 0.1, selfEffects: [{ kind: 'dodge', duration: 5, power: 0.3 }, { kind: 'haste', duration: 5, power: 1.3 }] },
    ],
    ultimate: { id: 'death-mark', name: 'Death Mark', desc: 'A single perfect strike for 380% ATK. Always crits.', icon: 'skull', cooldown: 0, target: 'enemy', power: 3.8, effect: { kind: 'bleed', duration: 8, power: 0.2 } },
  },
  {
    id: 'spiritcaller',
    name: 'The Spiritcaller',
    title: 'Verdant Oracle',
    tagline: 'Every root remembers, every wolf sings.',
    lore: 'She walked into the Whisperwood as a child and walked out a hundred years later, followed by half the forest.',
    colors: { main: '#8dffc2', glow: '#3ddc97', cloth: '#2d5a3f', accent: '#e7ffd4' },
    stats: baseStats({ maxHp: 310, atk: 25, armor: 11, crit: 0.1, critMult: 1.5, speed: 1.8, dodge: 0.04, regen: 1.4 }),
    passive: { name: 'Verdance', desc: 'Regenerates 1.4 HP each second.', icon: 'leaf' },
    abilities: [
      { id: 'thorn-lash', name: 'Thorn Lash', desc: 'Vines strike all foes for 90% ATK and slow them.', icon: 'leaf', cooldown: 6.5, target: 'allEnemies', power: 0.9, effect: { kind: 'slow', duration: 3, power: 1.25 } },
      { id: 'spirit-bloom', name: 'Spirit Bloom', desc: 'Heal 24% HP and regenerate for 5s. Cleanses burns.', icon: 'bloom', cooldown: 10, target: 'self', heal: 0.24, cleanse: true, selfEffect: { kind: 'regen', duration: 5, power: 3 } },
      { id: 'spirit-wolf', name: 'Call the Pack', desc: 'Summon a spirit wolf that fights beside you for 12s.', icon: 'wolf', cooldown: 14, target: 'self', summon: true },
    ],
    ultimate: { id: 'gaia-embrace', name: "Gaia's Embrace", desc: 'Heal 40%, then all foes take 220% ATK and are slowed.', icon: 'crown', cooldown: 0, target: 'allEnemies', power: 2.2, heal: 0.4, effect: { kind: 'slow', duration: 4, power: 1.4 } },
  },
];

export const classById = (id: ClassId): ClassDef => CLASSES.find(c => c.id === id)!;

/* ---------------------------------- Boons --------------------------------- */

export interface BoonDef {
  id: string;
  name: string;
  desc: string;
  icon: IconName;
  rarity: 'common' | 'rare' | 'epic';
  classes?: ClassId[];
  apply: (s: Stats) => void;
}

export const BOONS: BoonDef[] = [
  { id: 'iron-hide', name: 'Iron Hide', desc: '+18% maximum health.', icon: 'armor', rarity: 'common', apply: s => { s.maxHp *= 1.18; } },
  { id: 'keen-edge', name: 'Keen Edge', desc: '+15% attack power.', icon: 'sword', rarity: 'common', apply: s => { s.atk *= 1.15; } },
  { id: 'executioner', name: 'Executioner', desc: '+8% critical chance.', icon: 'skull', rarity: 'rare', apply: s => { s.crit += 0.08; } },
  { id: 'deep-wounds', name: 'Deep Wounds', desc: '+35% critical damage.', icon: 'drop', rarity: 'rare', apply: s => { s.critMult += 0.35; } },
  { id: 'vampiric', name: 'Crimson Thirst', desc: '+7% lifesteal from all damage.', icon: 'heart', rarity: 'rare', apply: s => { s.lifesteal += 0.07; } },
  { id: 'swiftness', name: 'Quickstep', desc: '+12% attack speed.', icon: 'wind', rarity: 'common', apply: s => { s.speed *= 0.88; } },
  { id: 'bulwark-plate', name: 'Bulwark Plate', desc: '+14 armor and 3% damage reduction.', icon: 'shield', rarity: 'common', apply: s => { s.armor += 14; s.damageReduction += 0.03; } },
  { id: 'arcane-font', name: 'Arcane Font', desc: '+22% ability & ultimate power.', icon: 'star', rarity: 'rare', apply: s => { s.abilityPower *= 1.22; } },
  { id: 'second-wind', name: 'Second Wind', desc: 'Regenerate +1.6 HP per second.', icon: 'leaf', rarity: 'common', apply: s => { s.regen += 1.6; } },
  { id: 'fleet-foot', name: 'Fleet Foot', desc: '+5% dodge chance.', icon: 'wind', rarity: 'common', apply: s => { s.dodge += 0.05; } },
  { id: 'ember-heart', name: 'Ember Heart', desc: '+25% ultimate charge rate.', icon: 'flame', rarity: 'rare', apply: s => { s.ultRate *= 1.25; } },
  { id: 'titan-blood', name: 'Titan Blood', desc: '+30% max HP, +8% attack.', icon: 'crown', rarity: 'epic', apply: s => { s.maxHp *= 1.3; s.atk *= 1.08; } },
  { id: 'assassins-creed', name: "Assassin's Creed", desc: '+12% crit chance, +20% crit damage.', icon: 'dagger', rarity: 'epic', apply: s => { s.crit += 0.12; s.critMult += 0.2; } },
  { id: 'thornmail', name: 'Thornmail', desc: '+25 armor and 4% damage reduction.', icon: 'shield', rarity: 'rare', classes: ['warden'], apply: s => { s.armor += 25; s.damageReduction += 0.04; } },
  { id: 'phoenix-spark', name: 'Phoenix Spark', desc: '+30% ability power, +10% attack.', icon: 'flame', rarity: 'epic', classes: ['pyromancer'], apply: s => { s.abilityPower *= 1.3; s.atk *= 1.1; } },
  { id: 'night-veil', name: 'Night Veil', desc: '+10% dodge, +10% attack speed.', icon: 'smoke', rarity: 'epic', classes: ['shadowblade'], apply: s => { s.dodge += 0.1; s.speed *= 0.9; } },
  { id: 'world-root', name: 'World Root', desc: '+2.5 regen, +12% max HP.', icon: 'leaf', rarity: 'epic', classes: ['spiritcaller'], apply: s => { s.regen += 2.5; s.maxHp *= 1.12; } },
];

export const boonById = (id: string): BoonDef => BOONS.find(b => b.id === id)!;

/* --------------------------------- Enemies -------------------------------- */

export type BodyKind =
  | 'imp' | 'hound' | 'brute' | 'stalker' | 'wisp' | 'treant' | 'wolf'
  | 'wraith' | 'golem' | 'revenant' | 'crab' | 'sentinel' | 'knight'
  | 'seraph' | 'wyrm' | 'king';

export interface EnemyDef {
  id: string;
  name: string;
  body: BodyKind;
  colors: { main: string; dark: string; glow: string };
  hp: number;
  atk: number;
  armor: number;
  speed: number;
  crit?: number;
  dodge?: number;
  scale?: number;
  abilities: AbilityDef[];
  boss?: boolean;
}

export type ParticleKind = 'ember' | 'spore' | 'snow' | 'bubble' | 'ash';

export interface LocationDef {
  id: string;
  name: string;
  subtitle: string;
  blurb: string;
  palette: {
    skyTop: string; skyBottom: string; far: string; mid: string; near: string;
    ground: string; groundLit: string; accent: string; fog: string;
  };
  particle: ParticleKind;
  music: string;
  stageNames: string[];
  enemies: EnemyDef[];
  boss: EnemyDef;
}

const enemyAbility = (id: string, name: string, desc: string, cd: number, power: number, extra?: Partial<AbilityDef>): AbilityDef => ({
  id, name, desc, icon: 'sword', cooldown: cd, target: 'enemy', power, ...extra,
});

export const LOCATIONS: LocationDef[] = [
  {
    id: 'ashen-reach',
    name: 'The Ashen Reach',
    subtitle: 'Where the first fire fell',
    blurb: 'Cracked badlands bleed molten light. The dead here still remember warmth — and want it back.',
    palette: { skyTop: '#1c0b1c', skyBottom: '#7d2b2b', far: '#3a1a24', mid: '#2a121a', near: '#1a0c11', ground: '#170b0e', groundLit: '#54221f', accent: '#ff8a4c', fog: 'rgba(255,110,50,0.10)' },
    particle: 'ember', music: 'ashen',
    stageNames: ['Cinder Trail', 'Scorched Hollow', 'Magma Vents', 'The Broken Foundry', 'Warden of Cinders'],
    enemies: [
      { id: 'cinder-imp', name: 'Cinder Imp', body: 'imp', colors: { main: '#ff7a45', dark: '#751f2b', glow: '#ffd08a' }, hp: 68, atk: 8, armor: 2, speed: 2.7, abilities: [enemyAbility('spit', 'Cinder Spit', 'A gout of flame.', 8, 1.5, { effect: { kind: 'burn', duration: 3, power: 0.1 } })] },
      { id: 'ash-hound', name: 'Ash Hound', body: 'hound', colors: { main: '#c96a3c', dark: '#3d1a1a', glow: '#ffbe73' }, hp: 84, atk: 9, armor: 4, speed: 2.1, abilities: [enemyAbility('pounce', 'Pounce', 'Leaps at its prey.', 7, 1.6)] },
      { id: 'magma-brute', name: 'Magma Brute', body: 'brute', colors: { main: '#e2603a', dark: '#451318', glow: '#ffcf5e' }, hp: 150, atk: 12, armor: 8, speed: 3.2, scale: 1.15, abilities: [enemyAbility('slam', 'Molten Slam', 'Shakes the ground.', 9, 1.9, { effect: { kind: 'stun', duration: 0.8, power: 1 } })] },
    ],
    boss: { id: 'molten-warden', name: 'The Molten Warden', body: 'knight', colors: { main: '#ffb14d', dark: '#3a0d12', glow: '#ffe08a' }, hp: 430, atk: 15, armor: 10, speed: 2.3, scale: 1.45, boss: true, abilities: [enemyAbility('cleave', 'Searing Cleave', 'A wide arc of fire.', 8, 1.7, { target: 'allEnemies' }), enemyAbility('furnace', 'Furnace Heart', 'Its core flares.', 12, 1.2, { selfEffect: { kind: 'empower', duration: 5, power: 1.5 } })] },
  },
  {
    id: 'whisperwood',
    name: 'The Whisperwood',
    subtitle: 'The forest is listening',
    blurb: 'Old roots coil around older secrets. Every leaf is a mouth, and they are all very hungry.',
    palette: { skyTop: '#07171a', skyBottom: '#1f4a3c', far: '#123028', mid: '#0c2620', near: '#071712', ground: '#081410', groundLit: '#204534', accent: '#8dffc2', fog: 'rgba(120,255,180,0.08)' },
    particle: 'spore', music: 'whisper',
    stageNames: ['Mossy Threshold', 'The Hanging Grove', 'Sporefall', 'Rootheart', 'The Pale Stag'],
    enemies: [
      { id: 'bramble-stalker', name: 'Bramble Stalker', body: 'stalker', colors: { main: '#6fbf7a', dark: '#163526', glow: '#c9ffb0' }, hp: 88, atk: 10, armor: 4, speed: 2.2, abilities: [enemyAbility('lash', 'Bramble Lash', 'Thorned vines.', 7, 1.5, { effect: { kind: 'poison', duration: 4, power: 0.12 } })] },
      { id: 'spore-wisp', name: 'Spore Wisp', body: 'wisp', colors: { main: '#9ff4b8', dark: '#2a5c46', glow: '#e4ffcf' }, hp: 62, atk: 8, armor: 0, speed: 2.9, abilities: [enemyAbility('burst', 'Spore Burst', 'A cloud of rot.', 8, 1.2, { target: 'allEnemies', effect: { kind: 'poison', duration: 5, power: 0.1 } })] },
      { id: 'hollow-treant', name: 'Hollow Treant', body: 'treant', colors: { main: '#5c8f5a', dark: '#1d3323', glow: '#b4e08a' }, hp: 180, atk: 13, armor: 10, speed: 3.4, scale: 1.2, abilities: [enemyAbility('roots', 'Entangling Roots', 'Roots grasp from below.', 9, 1.4, { effect: { kind: 'stun', duration: 1, power: 1 } })] },
    ],
    boss: { id: 'pale-stag', name: 'The Pale Stag', body: 'wolf', colors: { main: '#e7ffe9', dark: '#2e5c45', glow: '#8dffc2' }, hp: 470, atk: 16, armor: 8, speed: 2.1, scale: 1.5, boss: true, abilities: [enemyAbility('antlers', 'Antler Rush', 'A blur of bone.', 7.5, 1.8), enemyAbility('moonlit', 'Moonlit Grace', 'The stag flickers.', 13, 0.8, { selfEffect: { kind: 'haste', duration: 6, power: 1.5 }, heal: 0.1 })] },
  },
  {
    id: 'frostveil',
    name: 'The Frostveil Peaks',
    subtitle: 'Silence, carved in ice',
    blurb: 'The wind here has teeth. Beneath the glacier, something vast is dreaming of spring.',
    palette: { skyTop: '#081423', skyBottom: '#2e5d7a', far: '#1b3b54', mid: '#122b40', near: '#0a1a28', ground: '#0b1a26', groundLit: '#3e6a86', accent: '#9fe8ff', fog: 'rgba(170,230,255,0.10)' },
    particle: 'snow', music: 'frost',
    stageNames: ['Windscar Pass', 'The Frozen Lake', 'Rimefall Cliffs', 'Hall of Winter', "The Winter's Herald"],
    enemies: [
      { id: 'rime-wolf', name: 'Rime Wolf', body: 'wolf', colors: { main: '#bfe9ff', dark: '#28455e', glow: '#e8fbff' }, hp: 100, atk: 11, armor: 5, speed: 1.9, abilities: [enemyAbility('frostbite', 'Frostbite', 'Teeth like icicles.', 7, 1.6, { effect: { kind: 'slow', duration: 4, power: 1.3 } })] },
      { id: 'frost-wraith', name: 'Frost Wraith', body: 'wraith', colors: { main: '#9fd8ff', dark: '#203b58', glow: '#d7f4ff' }, hp: 78, atk: 10, armor: 2, speed: 2.5, abilities: [enemyAbility('chill', 'Chill Touch', 'A numb caress.', 8, 1.5, { effect: { kind: 'slow', duration: 3, power: 1.4 } })] },
      { id: 'ice-golem', name: 'Ice Golem', body: 'golem', colors: { main: '#a9d8ee', dark: '#22415a', glow: '#e9ffff' }, hp: 210, atk: 14, armor: 14, speed: 3.5, scale: 1.2, abilities: [enemyAbility('avalanche', 'Avalanche Fist', 'A frozen hammer.', 10, 2.0, { effect: { kind: 'stun', duration: 0.7, power: 1 } })] },
    ],
    boss: { id: 'winters-herald', name: "The Winter's Herald", body: 'seraph', colors: { main: '#d8f6ff', dark: '#29506e', glow: '#8fe3ff' }, hp: 520, atk: 17, armor: 9, speed: 2.2, scale: 1.45, boss: true, abilities: [enemyAbility('blizzard', 'Blizzard', 'The sky turns to knives.', 9, 1.6, { target: 'allEnemies', effect: { kind: 'slow', duration: 4, power: 1.35 } }), enemyAbility('icewall', 'Icewall', 'A wall of living frost.', 14, 0.9, { selfEffect: { kind: 'regen', duration: 5, power: 1.6 } })] },
  },
  {
    id: 'sunken-sanctum',
    name: 'The Sunken Sanctum',
    subtitle: 'What the tide kept',
    blurb: 'A temple drowned for a thousand years, still humming with hymns no living throat remembers.',
    palette: { skyTop: '#06111a', skyBottom: '#15506a', far: '#113a4d', mid: '#0a2838', near: '#061520', ground: '#071a22', groundLit: '#265a60', accent: '#6ff4e0', fog: 'rgba(90,230,220,0.09)' },
    particle: 'bubble', music: 'sanctum',
    stageNames: ['Tideworn Steps', 'Hall of Shells', 'The Drowned Choir', 'Abyssal Vault', 'The Leviathan Eye'],
    enemies: [
      { id: 'drowned-acolyte', name: 'Drowned Acolyte', body: 'revenant', colors: { main: '#6fd4cd', dark: '#163d44', glow: '#b6fff2' }, hp: 96, atk: 11, armor: 4, speed: 2.4, abilities: [enemyAbility('hymn', 'Drowning Hymn', 'A song that fills the lungs.', 8, 1.4, { effect: { kind: 'poison', duration: 4, power: 0.14 } })] },
      { id: 'tide-revenant', name: 'Tide Revenant', body: 'stalker', colors: { main: '#5fb8c9', dark: '#123540', glow: '#a9fff2' }, hp: 122, atk: 12, armor: 6, speed: 2.2, abilities: [enemyAbility('undertow', 'Undertow', 'The current pulls.', 8, 1.6, { effect: { kind: 'slow', duration: 3, power: 1.3 } })] },
      { id: 'coral-sentinel', name: 'Coral Sentinel', body: 'sentinel', colors: { main: '#ff9a9a', dark: '#4a2338', glow: '#ffd3c0' }, hp: 220, atk: 15, armor: 13, speed: 3.1, scale: 1.15, abilities: [enemyAbility('barnacle', 'Barnacle Barrage', 'A rain of shells.', 9, 1.7, { target: 'allEnemies' })] },
    ],
    boss: { id: 'leviathan-eye', name: 'The Leviathan Eye', body: 'crab', colors: { main: '#7cf0d8', dark: '#122e3e', glow: '#d8fff8' }, hp: 610, atk: 18, armor: 10, speed: 2.3, scale: 1.5, boss: true, abilities: [enemyAbility('abyss-gaze', 'Abyssal Gaze', 'The eye opens.', 9, 1.8, { effect: { kind: 'stun', duration: 0.8, power: 1 } }), enemyAbility('maelstrom', 'Maelstrom', 'The waters churn.', 12, 1.5, { target: 'allEnemies' })] },
  },
  {
    id: 'ember-throne',
    name: 'The Ember Throne',
    subtitle: 'The last light before the dark',
    blurb: 'A citadel of obsidian hangs above the end of everything. The Ashen King waits, and he is smiling.',
    palette: { skyTop: '#0a0614', skyBottom: '#3b1745', far: '#251233', mid: '#160b20', near: '#0b0611', ground: '#0c0710', groundLit: '#4b2350', accent: '#ff7ad9', fog: 'rgba(200,100,255,0.09)' },
    particle: 'ash', music: 'throne',
    stageNames: ['The Long Stair', 'Halls of Echoes', 'The Starless Court', 'Throne Approach', 'The Ashen King'],
    enemies: [
      { id: 'void-knight', name: 'Void Knight', body: 'knight', colors: { main: '#a98bff', dark: '#1e1235', glow: '#d9c8ff' }, hp: 140, atk: 14, armor: 9, speed: 2.3, abilities: [enemyAbility('void-cut', 'Void Cut', 'It cuts through memory.', 7, 1.8)] },
      { id: 'ash-seraph', name: 'Ash Seraph', body: 'seraph', colors: { main: '#ff9ad9', dark: '#3d1236', glow: '#ffd9f2' }, hp: 118, atk: 13, armor: 5, speed: 2.5, abilities: [enemyAbility('cinder-hymn', 'Cinder Hymn', 'Wings of falling ash.', 8, 1.4, { target: 'allEnemies', effect: { kind: 'burn', duration: 4, power: 0.14 } })] },
      { id: 'dusk-wyrm', name: 'Dusk Wyrm', body: 'wyrm', colors: { main: '#7d64e8', dark: '#1b1030', glow: '#ff9aef' }, hp: 205, atk: 16, armor: 8, speed: 2.6, scale: 1.2, abilities: [enemyAbility('breath', 'Dusk Breath', 'A sigh that unmakes.', 9, 1.8, { effect: { kind: 'burn', duration: 4, power: 0.16 } })] },
    ],
    boss: { id: 'ashen-king', name: 'The Ashen King', body: 'king', colors: { main: '#ffcf7a', dark: '#1a0b1f', glow: '#ff4d6d' }, hp: 820, atk: 21, armor: 12, speed: 2.2, scale: 1.6, boss: true, abilities: [enemyAbility('crown-fire', 'Crownfire', 'The crown answers.', 8, 2.0, { target: 'allEnemies', effect: { kind: 'burn', duration: 5, power: 0.2 } }), enemyAbility('kingslaw', 'King\'s Law', 'Reality kneels.', 13, 1.6, { effect: { kind: 'stun', duration: 1.1, power: 1 } }), enemyAbility('rekindle', 'Rekindle', 'He refuses the end.', 20, 0, { target: 'self', heal: 0.08, selfEffect: { kind: 'empower', duration: 6, power: 1.3 } })] },
  },
];

export const TOTAL_STAGES = LOCATIONS.length * 5;

export function stageInfo(globalStage: number) {
  const locIndex = Math.min(Math.floor(globalStage / 5), LOCATIONS.length - 1);
  const stageInLoc = globalStage % 5;
  return { locIndex, stageInLoc, location: LOCATIONS[locIndex] };
}

export function scaleForStage(globalStage: number): number {
  return 1 + globalStage * BALANCE.enemy.hpPerStage;
}

export function enemyCountFor(stageInLoc: number): number {
  const { normal, many, manyFromStageInLoc } = BALANCE.enemy.count;
  return stageInLoc >= manyFromStageInLoc ? many : normal;
}

export interface EnemyInstance {
  def: EnemyDef;
  name: string;
  hpScale: number;
  atkScale: number;
}

export function buildWave(globalStage: number): EnemyInstance[] {
  const { location, stageInLoc } = stageInfo(globalStage);
  const E = BALANCE.enemy;
  const isBoss = stageInLoc === 4;
  if (isBoss) {
    const escorts = location.enemies.slice(0, E.bossEscorts);
    return [
      { def: location.boss, name: location.boss.name, hpScale: 1 + globalStage * E.bossHpPerStage, atkScale: 1 + globalStage * E.bossAtkPerStage },
      ...escorts.map((def, i) => ({ def, name: def.name, hpScale: (1 + globalStage * E.hpPerStage) * (E.escortHp + i * E.escortHpStep), atkScale: 1 + globalStage * E.escortAtkPerStage })),
    ];
  }
  const count = enemyCountFor(stageInLoc);
  const picks = location.enemies;
  const off = stageInLoc % picks.length;
  const out: EnemyInstance[] = [];
  for (let i = 0; i < count; i++) {
    const def = picks[(off + i) % picks.length];
    const s = scaleForStage(globalStage);
    out.push({ def, name: def.name, hpScale: s * (E.waveHp + i * E.waveHpStep), atkScale: 1 + globalStage * E.atkPerStage });
  }
  return out;
}
