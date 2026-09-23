/**
 * Classes: tier, gender lock, DLC flag, promotions, pair-up bonus, max stats and class growths.
 *
 * One `ClassId` per class concept. Priest/Cleric and War Monk/War Cleric are one class each under a male and a
 * female name (SF merges them; the stats are identical). Stats are split `{ male, female }` only where they
 * genuinely differ: Lord and Great Lord max stats, Taguel growths.
 *
 * Sources (research/data-sources §3–4, #5; research/data-disagreements, #13):
 * - Max stats: SF https://serenesforest.net/awakening/classes/maximum-stats/ and the `classes` object in
 *   https://serenesforest.net/app/java/fe13maxstats.js , cross-checked against FEW
 *   https://fireemblemwiki.org/wiki/List_of_classes_in_Fire_Emblem_Awakening?oldid=747970 (81 pairs).
 * - Class growths: SF https://serenesforest.net/awakening/classes/growth-rates/ (Lck is 0 for every class),
 *   cross-checked against FEW Module:ClassStats/FE13 and SF chargrowth13-2.js.
 * - Pair-up bonuses: SF https://serenesforest.net/awakening/miscellaneous/pair-up/ (class bonus table).
 * - Tier, promotions, gender locks, DLC: SF https://serenesforest.net/awakening/classes/introduction/ ,
 *   SF class sets page, FEW class list ("Changes to"; gender lock is a class without an (M)/(F) pair).
 */
import type { Assumed } from './citations';
import type { Gender, ModStat, Stat } from './stats';

/** Base (unpromoted), advanced (promoted), or a single-tier special class. */
export type ClassTier = 'base' | 'advanced' | 'special';

type StatBlock = Readonly<Record<Stat, number>>;
export type GenderSplit<T> = { readonly male: T; readonly female: T };
/** Class growths, where a stat may be an assumption because the sources disagree. */
type ClassGrowthBlock = Readonly<Record<Stat, number | Assumed<'conqueror-skl-spd-growth'>>>;

export type ClassData = {
  /** One name, or the male and female names of the same class (Priest / Cleric). */
  readonly name: string | GenderSplit<string>;
  readonly tier: ClassTier;
  /** The only gender that can be in the class; absent if both can. */
  readonly genderLock?: Gender;
  /** Reached only through DLC; never inherited. */
  readonly dlc: boolean;
  /** What the class adds to its lead when it is the support unit (SF pair-up table). Zero stats are left out. */
  readonly pairUp: Readonly<Partial<Record<ModStat | 'mov', number>>>;
  readonly maxStats: StatBlock | GenderSplit<StatBlock>;
  readonly growths: ClassGrowthBlock | GenderSplit<ClassGrowthBlock>;
};

/** HP / Str / Mag / Skl / Spd / Lck / Def / Res. */
const s = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number): StatBlock => ({
  hp, str, mag, skl, spd, lck, def, res,
});

// Promotion pairs that share one growth row on SF.
const LORD_GROWTHS = s(40, 20, 0, 20, 20, 0, 10, 5);
const TACTICIAN_GROWTHS = s(40, 15, 15, 15, 15, 0, 10, 10);
const MERCENARY_GROWTHS = s(45, 20, 0, 25, 20, 0, 10, 5);
const FIGHTER_GROWTHS = s(45, 25, 0, 20, 15, 0, 10, 5);
const BARBARIAN_GROWTHS = s(50, 25, 0, 15, 20, 0, 5, 5);
const WYVERN_GROWTHS = s(45, 30, 0, 15, 15, 0, 10, 5);
const MAGE_GROWTHS = s(35, 0, 20, 20, 20, 0, 5, 10);
const TROUBADOUR_GROWTHS = s(35, 0, 20, 10, 20, 0, 5, 15);

/** In data order, which is also the tie-break order wherever classes are compared. */
export const CLASSES = {
  // Base classes.
  // #13 D5: Lord caps are split by gender. SF's single Lord row is Lucina's Lord (F); Lord (M) is FEW's row,
  // matching JP-PK's single row (60/27/20/25/26/30/26/25).
  lord: { name: 'Lord', tier: 'base', dlc: false, pairUp: { spd: 3, lck: 3 }, maxStats: { male: s(60, 27, 20, 25, 26, 30, 26, 25), female: s(60, 25, 20, 26, 28, 30, 25, 25) }, growths: LORD_GROWTHS },
  tactician: { name: 'Tactician', tier: 'base', dlc: false, pairUp: { str: 1, mag: 1, skl: 2, spd: 2 }, maxStats: s(60, 25, 25, 25, 25, 30, 25, 25), growths: TACTICIAN_GROWTHS },
  cavalier: { name: 'Cavalier', tier: 'base', dlc: false, pairUp: { str: 2, skl: 1, spd: 1, def: 2 }, maxStats: s(60, 26, 20, 25, 25, 30, 26, 26), growths: s(45, 20, 0, 20, 20, 0, 10, 5) },
  knight: { name: 'Knight', tier: 'base', dlc: false, pairUp: { str: 2, def: 4 }, maxStats: s(60, 30, 20, 26, 23, 30, 30, 22), growths: s(50, 25, 0, 15, 10, 0, 15, 5) },
  myrmidon: { name: 'Myrmidon', tier: 'base', dlc: false, pairUp: { spd: 4, lck: 2 }, maxStats: s(60, 24, 22, 27, 28, 30, 22, 24), growths: s(40, 20, 0, 25, 25, 0, 5, 5) },
  mercenary: { name: 'Mercenary', tier: 'base', dlc: false, pairUp: { skl: 2, spd: 3, def: 1 }, maxStats: s(60, 26, 20, 28, 26, 30, 25, 23), growths: MERCENARY_GROWTHS },
  fighter: { name: 'Fighter', tier: 'base', genderLock: 'M', dlc: false, pairUp: { str: 4, def: 2 }, maxStats: s(60, 29, 20, 26, 25, 30, 25, 23), growths: FIGHTER_GROWTHS },
  barbarian: { name: 'Barbarian', tier: 'base', genderLock: 'M', dlc: false, pairUp: { str: 4, spd: 2 }, maxStats: s(60, 30, 20, 23, 27, 30, 22, 20), growths: BARBARIAN_GROWTHS },
  archer: { name: 'Archer', tier: 'base', dlc: false, pairUp: { str: 2, skl: 2, def: 2 }, maxStats: s(60, 26, 20, 29, 25, 30, 25, 21), growths: s(45, 15, 0, 30, 15, 0, 10, 5) },
  // #13 D6: Thief Skl cap resolved to 30 (SF, SF-JS, FEW Thief page, JP-2ch row total 171) over the FEW list's 29.
  thief: { name: 'Thief', tier: 'base', dlc: false, pairUp: { skl: 2, spd: 2, mov: 1 }, maxStats: s(60, 22, 20, 30, 28, 30, 21, 20), growths: s(35, 15, 5, 25, 25, 0, 5, 5) },
  'pegasus-knight': { name: 'Pegasus Knight', tier: 'base', genderLock: 'F', dlc: false, pairUp: { spd: 3, res: 3 }, maxStats: s(60, 24, 23, 28, 27, 30, 22, 25), growths: s(40, 15, 5, 25, 25, 0, 5, 10) },
  'wyvern-rider': { name: 'Wyvern Rider', tier: 'base', dlc: false, pairUp: { str: 3, def: 3 }, maxStats: s(60, 28, 20, 24, 24, 30, 28, 20), growths: WYVERN_GROWTHS },
  mage: { name: 'Mage', tier: 'base', dlc: false, pairUp: { mag: 4, skl: 2 }, maxStats: s(60, 20, 28, 27, 26, 30, 21, 25), growths: MAGE_GROWTHS },
  'dark-mage': { name: 'Dark Mage', tier: 'base', dlc: false, pairUp: { mag: 3, def: 3 }, maxStats: s(60, 20, 27, 25, 25, 30, 25, 27), growths: s(50, 5, 15, 15, 15, 0, 10, 10) },
  priest: { name: { male: 'Priest', female: 'Cleric' }, tier: 'base', dlc: false, pairUp: { mag: 2, lck: 2, res: 2 }, maxStats: s(60, 22, 25, 24, 25, 30, 22, 27), growths: s(35, 5, 15, 15, 15, 0, 5, 15) },
  troubadour: { name: 'Troubadour', tier: 'base', genderLock: 'F', dlc: false, pairUp: { mag: 2, spd: 1, res: 3 }, maxStats: s(60, 20, 26, 24, 26, 30, 20, 28), growths: TROUBADOUR_GROWTHS },

  // Advanced classes.
  'great-lord': { name: 'Great Lord', tier: 'advanced', dlc: false, pairUp: { spd: 4, lck: 4 }, maxStats: { male: s(80, 43, 30, 40, 41, 45, 42, 40), female: s(80, 40, 30, 42, 44, 45, 40, 40) }, growths: LORD_GROWTHS },
  grandmaster: { name: 'Grandmaster', tier: 'advanced', dlc: false, pairUp: { str: 2, mag: 2, skl: 2, spd: 2 }, maxStats: s(80, 40, 40, 40, 40, 45, 40, 40), growths: TACTICIAN_GROWTHS },
  paladin: { name: 'Paladin', tier: 'advanced', dlc: false, pairUp: { str: 2, skl: 2, spd: 2, def: 2 }, maxStats: s(80, 42, 30, 40, 40, 45, 42, 42), growths: s(45, 20, 0, 20, 20, 0, 10, 10) },
  'great-knight': { name: 'Great Knight', tier: 'advanced', dlc: false, pairUp: { str: 3, def: 3, mov: 1 }, maxStats: s(80, 48, 20, 34, 37, 45, 48, 30), growths: s(50, 25, 0, 15, 15, 0, 15, 5) },
  general: { name: 'General', tier: 'advanced', dlc: false, pairUp: { str: 3, def: 5 }, maxStats: s(80, 50, 30, 41, 35, 45, 50, 35), growths: s(50, 25, 0, 15, 10, 0, 15, 10) },
  swordmaster: { name: 'Swordmaster', tier: 'advanced', dlc: false, pairUp: { spd: 5, lck: 3 }, maxStats: s(80, 38, 34, 44, 46, 45, 33, 38), growths: s(40, 20, 0, 25, 25, 0, 5, 10) },
  hero: { name: 'Hero', tier: 'advanced', dlc: false, pairUp: { skl: 3, spd: 3, def: 2 }, maxStats: s(80, 42, 30, 46, 42, 45, 40, 36), growths: MERCENARY_GROWTHS },
  warrior: { name: 'Warrior', tier: 'advanced', genderLock: 'M', dlc: false, pairUp: { str: 5, def: 3 }, maxStats: s(80, 48, 30, 42, 40, 45, 40, 35), growths: FIGHTER_GROWTHS },
  berserker: { name: 'Berserker', tier: 'advanced', genderLock: 'M', dlc: false, pairUp: { str: 5, spd: 3 }, maxStats: s(80, 50, 30, 35, 44, 45, 34, 30), growths: BARBARIAN_GROWTHS },
  sniper: { name: 'Sniper', tier: 'advanced', dlc: false, pairUp: { str: 3, skl: 3, def: 2 }, maxStats: s(80, 41, 30, 48, 40, 45, 40, 31), growths: s(45, 15, 0, 30, 15, 0, 15, 5) },
  'bow-knight': { name: 'Bow Knight', tier: 'advanced', dlc: false, pairUp: { skl: 3, spd: 3, mov: 1 }, maxStats: s(80, 40, 30, 43, 41, 45, 35, 30), growths: s(50, 20, 0, 25, 20, 0, 5, 5) },
  assassin: { name: 'Assassin', tier: 'advanced', dlc: false, pairUp: { str: 2, skl: 2, spd: 4 }, maxStats: s(80, 40, 30, 48, 46, 45, 31, 30), growths: s(40, 20, 0, 30, 25, 0, 5, 5) },
  trickster: { name: 'Trickster', tier: 'advanced', dlc: false, pairUp: { mag: 2, skl: 1, spd: 3, mov: 1 }, maxStats: s(80, 35, 38, 45, 43, 45, 30, 40), growths: s(35, 10, 15, 25, 20, 0, 5, 10) },
  'falcon-knight': { name: 'Falcon Knight', tier: 'advanced', genderLock: 'F', dlc: false, pairUp: { spd: 4, res: 4 }, maxStats: s(80, 38, 35, 45, 44, 45, 33, 40), growths: s(40, 15, 10, 25, 25, 0, 5, 10) },
  'dark-flier': { name: 'Dark Flier', tier: 'advanced', genderLock: 'F', dlc: false, pairUp: { mag: 3, spd: 3, res: 2 }, maxStats: s(80, 36, 42, 41, 42, 45, 32, 41), growths: s(40, 10, 15, 20, 20, 0, 5, 10) },
  'wyvern-lord': { name: 'Wyvern Lord', tier: 'advanced', dlc: false, pairUp: { str: 4, def: 4 }, maxStats: s(80, 46, 30, 38, 38, 45, 46, 30), growths: WYVERN_GROWTHS },
  'griffon-rider': { name: 'Griffon Rider', tier: 'advanced', dlc: false, pairUp: { str: 3, lck: 1, def: 2, mov: 1 }, maxStats: s(80, 40, 30, 43, 41, 45, 40, 30), growths: s(45, 25, 0, 20, 20, 0, 5, 5) },
  sage: { name: 'Sage', tier: 'advanced', dlc: false, pairUp: { mag: 4, skl: 2, res: 2 }, maxStats: s(80, 30, 46, 43, 42, 45, 31, 40), growths: MAGE_GROWTHS },
  sorcerer: { name: 'Sorcerer', tier: 'advanced', dlc: false, pairUp: { mag: 3, def: 2, res: 3 }, maxStats: s(80, 30, 44, 38, 40, 45, 41, 44), growths: s(45, 0, 20, 15, 15, 0, 10, 10) },
  'dark-knight': { name: 'Dark Knight', tier: 'advanced', dlc: false, pairUp: { mag: 2, def: 3, res: 1, mov: 1 }, maxStats: s(80, 38, 41, 40, 40, 45, 42, 38), growths: s(50, 15, 15, 15, 15, 0, 10, 5) },
  'war-monk': { name: { male: 'War Monk', female: 'War Cleric' }, tier: 'advanced', dlc: false, pairUp: { str: 2, mag: 2, lck: 2, res: 2 }, maxStats: s(80, 40, 40, 38, 41, 45, 38, 43), growths: s(45, 15, 15, 10, 15, 0, 10, 10) },
  valkyrie: { name: 'Valkyrie', tier: 'advanced', genderLock: 'F', dlc: false, pairUp: { mag: 3, spd: 2, res: 3 }, maxStats: s(80, 30, 42, 38, 43, 45, 30, 45), growths: TROUBADOUR_GROWTHS },

  // Special classes (single tier).
  villager: { name: 'Villager', tier: 'special', dlc: false, pairUp: { skl: 3, lck: 3 }, maxStats: s(60, 20, 20, 20, 20, 30, 20, 20), growths: s(35, 10, 0, 5, 5, 0, 10, 5) },
  dancer: { name: 'Dancer', tier: 'special', genderLock: 'F', dlc: false, pairUp: { spd: 3, lck: 3 }, maxStats: s(80, 30, 30, 40, 40, 45, 30, 30), growths: s(35, 5, 0, 25, 25, 0, 5, 5) },
  // One max-stat row for both genders; growths differ by gender (SF, FEW).
  taguel: { name: 'Taguel', tier: 'special', dlc: false, pairUp: { str: 3, skl: 2, spd: 3 }, maxStats: s(80, 35, 30, 40, 40, 45, 35, 30), growths: { male: s(45, 20, 0, 15, 15, 0, 15, 5), female: s(40, 15, 0, 20, 20, 0, 10, 5) } },
  manakete: { name: 'Manakete', tier: 'special', dlc: false, pairUp: { str: 2, mag: 2, def: 2, res: 2 }, maxStats: s(80, 40, 35, 35, 35, 45, 40, 40), growths: s(50, 20, 5, 20, 20, 0, 15, 15) },
  // Marth's personal class (DLC/SpotPass); in no class set, so no unit here can reach it.
  lodestar: { name: 'Lodestar', tier: 'special', genderLock: 'M', dlc: true, pairUp: { str: 2, spd: 3, lck: 3 }, maxStats: s(80, 41, 30, 43, 43, 45, 41, 40), growths: s(40, 20, 0, 20, 20, 0, 10, 5) },
  // Walhart's personal class. Skl/Spd growth is unverified (#13 D1b): SF's table says 15, SF-JS and FEW's module 20.
  conqueror: {
    name: 'Conqueror', tier: 'special', genderLock: 'M', dlc: false, pairUp: { str: 2, spd: 2, def: 2, mov: 1 }, maxStats: s(80, 45, 25, 40, 40, 45, 45, 35),
    growths: { hp: 50, str: 20, mag: 5, skl: { assumption: 'conqueror-skl-spd-growth' }, spd: { assumption: 'conqueror-skl-spd-growth' }, lck: 0, def: 10, res: 10 },
  },
  // DLC reclass targets: Dread Scroll (Lost Bloodlines 2) and Wedding Bouquet (Smash Brethren 2).
  'dread-fighter': { name: 'Dread Fighter', tier: 'special', genderLock: 'M', dlc: true, pairUp: { str: 3, mag: 1, spd: 1, res: 3 }, maxStats: s(80, 42, 38, 40, 41, 45, 39, 43), growths: s(40, 20, 10, 20, 20, 0, 10, 10) },
  bride: { name: 'Bride', tier: 'special', genderLock: 'F', dlc: true, pairUp: { mag: 2, spd: 2, lck: 2, res: 2 }, maxStats: s(80, 40, 39, 42, 42, 45, 41, 40), growths: s(40, 20, 10, 20, 20, 0, 10, 10) },
} as const satisfies Record<string, ClassData>;

export type ClassId = keyof typeof CLASSES;

/**
 * What each class promotes to with a Master Seal (SF class introduction; FEW "Changes to"). A class set lists base
 * classes; their promotions come with them. Villager and the other special classes don't promote.
 */
export const PROMOTES_TO = {
  lord: ['great-lord'],
  tactician: ['grandmaster'],
  cavalier: ['paladin', 'great-knight'],
  knight: ['general', 'great-knight'],
  myrmidon: ['swordmaster', 'assassin'],
  mercenary: ['hero', 'bow-knight'],
  fighter: ['warrior', 'hero'],
  barbarian: ['berserker', 'warrior'],
  archer: ['sniper', 'bow-knight'],
  thief: ['assassin', 'trickster'],
  'pegasus-knight': ['falcon-knight', 'dark-flier'],
  'wyvern-rider': ['wyvern-lord', 'griffon-rider'],
  mage: ['sage', 'dark-knight'],
  'dark-mage': ['sorcerer', 'dark-knight'],
  priest: ['war-monk', 'sage'],
  troubadour: ['valkyrie', 'war-monk'],
} as const satisfies Partial<Record<ClassId, readonly ClassId[]>>;

/**
 * The regular classes Robin (and Morgan) get, and pass to a child of Robin, for their gender (SF class sets;
 * research/marriage-and-classes §3.1). Lord is a regular class too, but it can't be inherited, so it isn't listed.
 */
export const REGULAR_CLASSES = [
  'tactician', 'cavalier', 'knight', 'myrmidon', 'mercenary', 'fighter', 'barbarian', 'archer', 'thief',
  'pegasus-knight', 'wyvern-rider', 'mage', 'dark-mage', 'priest', 'troubadour',
] as const satisfies readonly ClassId[];

/** DLC classes any unit of the right gender can reclass into with the DLC item (research/data-sources §4). */
export const DLC_RECLASS_TARGETS = ['dread-fighter', 'bride'] as const satisfies readonly ClassId[];

/** Whether a unit of this gender can be in the class. */
export const allowsGender = (id: ClassId, gender: Gender): boolean => {
  const lock: Gender | undefined = (CLASSES[id] as ClassData).genderLock;
  return lock === undefined || lock === gender;
};

/** The regular classes for a gender, in data order. */
export const regularClasses = (gender: Gender): readonly ClassId[] => REGULAR_CLASSES.filter((c) => allowsGender(c, gender));

/**
 * Classes that wield staves (SF https://serenesforest.net/awakening/classes/introduction/ weapon ranks): the healers a
 * Staff/Rally deployment role needs. Bride is DLC.
 */
export const STAFF_CLASSES = ['priest', 'troubadour', 'falcon-knight', 'war-monk', 'sage', 'valkyrie', 'bride'] as const satisfies readonly ClassId[];
