/**
 * Skills: description, activation rate, DLC / rally / inheritable flags, and the class skill tables with levels.
 *
 * Sources (research/skill-inheritance, #4; research/data-sources §5, #5):
 * - Skills, effects and activation rates: SF https://serenesforest.net/awakening/miscellaneous/skills/ ,
 *   cross-checked against FEW https://fireemblemwiki.org/wiki/List_of_skills_in_Fire_Emblem_Awakening
 *   (every class row agrees). Descriptions are paraphrased from SF's effect column.
 * - Inheritance flags: SF https://serenesforest.net/awakening/characters/children/ and
 *   FEW https://fireemblemwiki.org/wiki/Inheritance : DLC skills (DLC class skills and DLC skill books) and
 *   Special Dance never pass; Shadowgift and Conquest are personal and pass only to Morgan (fixed inheritance).
 * - DLC skill books: FEW https://fireemblemwiki.org/wiki/Downloadable_content_in_Fire_Emblem_Awakening .
 *
 * Enemy-only skills (Dragonskin, Rightful God, Luna+, …) are left out: no player unit can have them.
 * Conqueror and Lodestar teach no skills; that is inferred from both skill tables leaving them out (#4).
 */
import type { ClassId } from './classes';
import type { UnitId } from './units';

export type SkillData = {
  readonly name: string;
  /** What the skill does, paraphrased from SF. */
  readonly description: string;
  /** Activation rate as SF gives it (e.g. `Skl/2 %`), `Command` for a rally, absent for an always-on skill. */
  readonly rate?: string;
  /** A DLC class skill or DLC skill book. */
  readonly dlc: boolean;
  /** A Rally command. */
  readonly rally: boolean;
  /**
   * Can pass to a child as a parent's last equipped skill. False for DLC skills, Special Dance and the personal
   * skills (which pass only by fixed inheritance).
   */
  readonly inheritable: boolean;
};

const sk = (name: string, description: string, rate?: string, flags: Partial<Pick<SkillData, 'dlc' | 'rally' | 'inheritable'>> = {}): SkillData => {
  const dlc = flags.dlc ?? false;
  return { name, description, ...(rate ? { rate } : {}), dlc, rally: flags.rally ?? false, inheritable: flags.inheritable ?? !dlc };
};
const rally = (name: string, description: string) => sk(name, description, 'Command', { rally: true });
const dlc = (name: string, description: string) => sk(name, description, undefined, { dlc: true });

/** In SF table order (by class), which is also the tie-break order wherever skills are listed. */
export const SKILLS = {
  'dual-strike-plus': sk('Dual Strike+', 'Dual Strike rate +10%.'),
  charm: sk('Charm', 'Hit and Avoid +5 to allies within 3 tiles.'),
  aether: sk('Aether', 'Strikes twice in a row; the first hit has Sol’s effect, the second Luna’s.', 'Skl/2 %'),
  'rightful-king': sk('Rightful King', 'Skill activation rates +10%.'),
  veteran: sk('Veteran', 'EXP ×1.5 while paired up.'),
  solidarity: sk('Solidarity', 'Crit and Crit Avoid +10 to adjacent allies.'),
  ignis: sk('Ignis', 'Adds half of Mag to Str on physical attacks (and half of Str to Mag on magic ones).', 'Skl %'),
  'rally-spectrum': rally('Rally Spectrum', 'All stats +4 to allies within 3 tiles for one turn.'),
  discipline: sk('Discipline', 'Weapon EXP ×2.'),
  'outdoor-fighter': sk('Outdoor Fighter', 'Hit and Avoid +10 when fighting outdoors.'),
  defender: sk('Defender', 'All stats +1 while paired up (as the lead).'),
  aegis: sk('Aegis', 'Halves damage from bows, tomes and dragonstones.', 'Skl %'),
  luna: sk('Luna', 'Ignores half the enemy’s Def or Res.', 'Skl %'),
  'dual-guard-plus': sk('Dual Guard+', 'Dual Guard rate +10%.'),
  'defence-plus-2': sk('Defence +2', 'Def +2.'),
  'indoor-fighter': sk('Indoor Fighter', 'Hit and Avoid +10 when fighting indoors.'),
  'rally-defence': rally('Rally Defence', 'Def +4 to allies within 3 tiles for one turn.'),
  pavise: sk('Pavise', 'Halves damage from swords, lances, axes and beaststones.', 'Skl %'),
  'avoid-plus-10': sk('Avoid +10', 'Avoid +10.'),
  vantage: sk('Vantage', 'Below half HP, always strikes first on the enemy’s turn.'),
  astra: sk('Astra', 'Five hits in a row at half damage.', 'Skl/2 %'),
  swordfaire: sk('Swordfaire', 'Str +5 with a sword.'),
  armsthrift: sk('Armsthrift', 'The attack uses no weapon durability.', 'Lck×2 %'),
  patience: sk('Patience', 'Hit and Avoid +10 on the enemy’s turn.'),
  sol: sk('Sol', 'Heals half the damage dealt.', 'Skl %'),
  axebreaker: sk('Axebreaker', 'Hit and Avoid +50 against axes.'),
  'hp-plus-5': sk('HP +5', 'Max HP +5.'),
  zeal: sk('Zeal', 'Crit +5.'),
  'rally-strength': rally('Rally Strength', 'Str +4 to allies within 3 tiles for one turn.'),
  counter: sk('Counter', 'Returns the damage taken from an adjacent attacker.'),
  despoil: sk('Despoil', 'Gets a Bullion (S) on defeating an enemy.', 'Lck %'),
  gamble: sk('Gamble', 'Hit −5, Crit +10.'),
  wrath: sk('Wrath', 'Crit +20 below half HP.'),
  axefaire: sk('Axefaire', 'Str +5 with an axe.'),
  'skill-plus-2': sk('Skill +2', 'Skl +2.'),
  prescience: sk('Prescience', 'Hit and Avoid +15 on the user’s turn.'),
  'hit-rate-plus-20': sk('Hit Rate +20', 'Hit +20.'),
  bowfaire: sk('Bowfaire', 'Str +5 with a bow.'),
  'rally-skill': rally('Rally Skill', 'Skl +4 to allies within 3 tiles for one turn.'),
  bowbreaker: sk('Bowbreaker', 'Hit and Avoid +50 against bows.'),
  locktouch: sk('Locktouch', 'Opens doors and chests without keys.'),
  'movement-plus-1': sk('Movement +1', 'Mov +1.'),
  lethality: sk('Lethality', 'Kills the enemy outright.', 'Skl/4 %'),
  pass: sk('Pass', 'Moves through tiles held by enemies.'),
  'lucky-seven': sk('Lucky Seven', 'Hit and Avoid +20 until turn 7.'),
  acrobat: sk('Acrobat', 'Every passable tile costs 1 Mov.'),
  'speed-plus-2': sk('Speed +2', 'Spd +2.'),
  relief: sk('Relief', 'Heals 20% HP at turn start with no unit within 3 tiles.'),
  'rally-speed': rally('Rally Speed', 'Spd +4 to allies within 3 tiles for one turn.'),
  lancefaire: sk('Lancefaire', 'Str +5 with a lance.'),
  'rally-movement': rally('Rally Movement', 'Mov +1 to allies within 3 tiles for one turn.'),
  galeforce: sk('Galeforce', 'After defeating an enemy (on the user’s turn), the user may act again.'),
  'strength-plus-2': sk('Strength +2', 'Str +2.'),
  tantivy: sk('Tantivy', 'Hit and Avoid +10 with no ally within 3 tiles.'),
  'quick-burn': sk('Quick Burn', 'Hit and Avoid +15 at the start of the map, falling by 1 a turn.'),
  swordbreaker: sk('Swordbreaker', 'Hit and Avoid +50 against swords.'),
  deliverer: sk('Deliverer', 'Mov +2 while paired up.'),
  lancebreaker: sk('Lancebreaker', 'Hit and Avoid +50 against lances.'),
  'magic-plus-2': sk('Magic +2', 'Mag +2.'),
  focus: sk('Focus', 'Crit +10 with no ally within 3 tiles.'),
  'rally-magic': rally('Rally Magic', 'Mag +4 to allies within 3 tiles for one turn.'),
  tomefaire: sk('Tomefaire', 'Mag +5 with a tome.'),
  hex: sk('Hex', 'Avoid −15 to adjacent enemies.'),
  anathema: sk('Anathema', 'Avoid and Crit Avoid −10 to enemies within 3 tiles.'),
  vengeance: sk('Vengeance', 'Adds half the user’s missing HP to damage.', 'Skl×2 %'),
  tomebreaker: sk('Tomebreaker', 'Hit and Avoid +50 against tomes.'),
  'slow-burn': sk('Slow Burn', 'Hit and Avoid +1 a turn, up to +15.'),
  lifetaker: sk('Lifetaker', 'Heals 50% HP after defeating an enemy on the user’s turn.'),
  miracle: sk('Miracle', 'Survives a lethal hit with 1 HP.', 'Lck %'),
  healtouch: sk('Healtouch', 'Staves restore 5 more HP.'),
  'rally-luck': rally('Rally Luck', 'Lck +8 to allies within 3 tiles for one turn.'),
  renewal: sk('Renewal', 'Heals 30% HP at turn start.'),
  'resistance-plus-2': sk('Resistance +2', 'Res +2.'),
  demoiselle: sk('Demoiselle', 'Avoid and Crit Avoid +10 to male allies within 3 tiles.'),
  'rally-resistance': rally('Rally Resistance', 'Res +4 to allies within 3 tiles for one turn.'),
  'dual-support-plus': sk('Dual Support+', 'Raises the support bonus the user gives.'),
  aptitude: sk('Aptitude', 'Growth rates +20% on level up.'),
  underdog: sk('Underdog', 'Hit and Avoid +15 against a higher-level enemy.'),
  'luck-plus-4': sk('Luck +4', 'Lck +4.'),
  'special-dance': sk('Special Dance', 'Dancing also gives Str, Mag, Def and Res +2 for one turn.', undefined, { inheritable: false }),
  'even-rhythm': sk('Even Rhythm', 'Hit and Avoid +10 on even turns.'),
  beastbane: sk('Beastbane', 'Effective against beasts while a Taguel.'),
  'odd-rhythm': sk('Odd Rhythm', 'Hit and Avoid +10 on odd turns.'),
  wyrmsbane: sk('Wyrmsbane', 'Effective against dragons while a Manakete.'),
  // Personal skills: Aversa's and Walhart's. They pass only to Morgan, and always (fixed inheritance).
  shadowgift: sk('Shadowgift', 'Tome users can wield dark tomes.', undefined, { inheritable: false }),
  conquest: sk('Conquest', 'Negates the user’s armour and beast weaknesses.', undefined, { inheritable: false }),
  // DLC class skills.
  'resistance-plus-10': dlc('Resistance +10', 'Res +10.'),
  aggressor: dlc('Aggressor', 'Attack +10 on the user’s turn.'),
  'rally-heart': sk('Rally Heart', 'All stats +2 and Mov +1 to allies within 3 tiles for one turn.', 'Command', { dlc: true, rally: true }),
  bond: dlc('Bond', 'Heals allies within 3 tiles 10 HP at turn start.'),
  // DLC skill books.
  'all-stats-plus-2': dlc('All Stats +2', 'Every stat but HP +2.'),
  paragon: dlc('Paragon', 'EXP ×2.'),
  'iotes-shield': dlc('Iote’s Shield', 'Negates the user’s flying weakness.'),
  'limit-breaker': dlc('Limit Breaker', 'Max stats +10 (not HP).'),
} as const satisfies Record<string, SkillData>;

export type SkillId = keyof typeof SKILLS;

/** A skill a class teaches, and the class level it is learned at. */
export type ClassSkill = { readonly skill: SkillId; readonly level: number };

const learns = (lo: SkillId, loLevel: number, hi: SkillId, hiLevel: number): readonly ClassSkill[] => [
  { skill: lo, level: loLevel },
  { skill: hi, level: hiLevel },
];
/** Base classes teach at 1 and 10, promoted classes at 5 and 15, special classes at 1 and 15. */
const base = (a: SkillId, b: SkillId) => learns(a, 1, b, 10);
const promoted = (a: SkillId, b: SkillId) => learns(a, 5, b, 15);
const special = (a: SkillId, b: SkillId) => learns(a, 1, b, 15);

export const CLASS_SKILLS = {
  lord: base('dual-strike-plus', 'charm'),
  tactician: base('veteran', 'solidarity'),
  cavalier: base('discipline', 'outdoor-fighter'),
  knight: base('defence-plus-2', 'indoor-fighter'),
  myrmidon: base('avoid-plus-10', 'vantage'),
  mercenary: base('armsthrift', 'patience'),
  fighter: base('hp-plus-5', 'zeal'),
  barbarian: base('despoil', 'gamble'),
  archer: base('skill-plus-2', 'prescience'),
  thief: base('locktouch', 'movement-plus-1'),
  'pegasus-knight': base('speed-plus-2', 'relief'),
  'wyvern-rider': base('strength-plus-2', 'tantivy'),
  mage: base('magic-plus-2', 'focus'),
  'dark-mage': base('hex', 'anathema'),
  priest: base('miracle', 'healtouch'),
  troubadour: base('resistance-plus-2', 'demoiselle'),
  'great-lord': promoted('aether', 'rightful-king'),
  grandmaster: promoted('ignis', 'rally-spectrum'),
  paladin: promoted('defender', 'aegis'),
  'great-knight': promoted('luna', 'dual-guard-plus'),
  general: promoted('rally-defence', 'pavise'),
  swordmaster: promoted('astra', 'swordfaire'),
  hero: promoted('sol', 'axebreaker'),
  warrior: promoted('rally-strength', 'counter'),
  berserker: promoted('wrath', 'axefaire'),
  sniper: promoted('hit-rate-plus-20', 'bowfaire'),
  'bow-knight': promoted('rally-skill', 'bowbreaker'),
  assassin: promoted('lethality', 'pass'),
  trickster: promoted('lucky-seven', 'acrobat'),
  'falcon-knight': promoted('rally-speed', 'lancefaire'),
  'dark-flier': promoted('rally-movement', 'galeforce'),
  'wyvern-lord': promoted('quick-burn', 'swordbreaker'),
  'griffon-rider': promoted('deliverer', 'lancebreaker'),
  sage: promoted('rally-magic', 'tomefaire'),
  sorcerer: promoted('vengeance', 'tomebreaker'),
  'dark-knight': promoted('slow-burn', 'lifetaker'),
  'war-monk': promoted('rally-luck', 'renewal'),
  valkyrie: promoted('rally-resistance', 'dual-support-plus'),
  villager: special('aptitude', 'underdog'),
  dancer: special('luck-plus-4', 'special-dance'),
  taguel: special('even-rhythm', 'beastbane'),
  manakete: special('odd-rhythm', 'wyrmsbane'),
  lodestar: [],
  conqueror: [],
  'dread-fighter': special('resistance-plus-10', 'aggressor'),
  bride: special('rally-heart', 'bond'),
} as const satisfies Record<ClassId, readonly ClassSkill[]>;

/** DLC skill books: any unit can equip them once the DLC is played; never inherited (FEW DLC page). */
export const DLC_SKILL_BOOKS = ['all-stats-plus-2', 'paragon', 'iotes-shield', 'limit-breaker'] as const satisfies readonly SkillId[];

/** A skill that always passes, whatever the parent has equipped: one for a son, one for a daughter. */
export type FixedSkill = { readonly son: SkillId; readonly daughter: SkillId };

/**
 * Fixed inheritance (SF children; FEW Inheritance; research/skill-inheritance §2): Chrom always passes Aether to a
 * daughter and Rightful King to a son, even unlearned; Aversa and Walhart always pass their personal skill to Morgan
 * (their only possible child).
 */
export const FIXED_INHERITANCE: Readonly<Partial<Record<UnitId, FixedSkill>>> = {
  chrom: { son: 'rightful-king', daughter: 'aether' },
  aversa: { son: 'shadowgift', daughter: 'shadowgift' },
  walhart: { son: 'conquest', daughter: 'conquest' },
};

/**
 * A child of Chrom, as Morgan's parent, always passes Chrom's skill for its own gender: Aether from Lucina or a
 * Chrom-fathered daughter, Rightful King from a Chrom-fathered son (FEW Inheritance; SF Morgan pages).
 */
export const CHROM_CHILD_PASSES: Readonly<Record<'son' | 'daughter', SkillId>> = { son: 'rightful-king', daughter: 'aether' };

/** The ten rally skills, in the order the rally coverage dots show them. */
export const RALLY_SKILLS = [
  'rally-strength', 'rally-magic', 'rally-skill', 'rally-speed', 'rally-luck',
  'rally-defence', 'rally-resistance', 'rally-movement', 'rally-spectrum', 'rally-heart',
] as const satisfies readonly SkillId[];
