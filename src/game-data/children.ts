/**
 * Child units: absolute (personal) growths, gender and fixed parent.
 *
 * Sources:
 * - Absolute growths: FEW Module:CharGrowths/FE13, oldid 620231
 *   https://fireemblemwiki.org/w/index.php?title=Module:CharGrowths/FE13&oldid=620231
 *   cross-checked against SF https://serenesforest.net/awakening/characters/growth-rates/base/
 *   ("Children characters", 104 values, 0 disagreements). Morgan has one row for both genders.
 * - Fixed parents: SF https://serenesforest.net/awakening/characters/children/ and
 *   FEW https://fireemblemwiki.org/wiki/Inheritance?oldid=752340 (Awakening section).
 * - Default class sets: SF https://serenesforest.net/awakening/characters/class-sets/ ("Children Characters"),
 *   FEW Reclass (research/marriage-and-classes §3.2, #3). Already gender-adjusted from the fixed parent.
 */
import { regularClasses, type ClassId } from './classes';
import type { Gender, Growths } from './stats';
import type { UnitId } from './units';

export type ChildUnitData = {
  readonly name: string;
  readonly gender: Gender;
  /** The parent the child always has. Morgan's is Robin of the opposite gender. */
  readonly fixedParent: UnitId | 'robin';
  readonly growths: Growths;
  /**
   * The classes the child has whoever the variable parent is; the first is its starting class. Kjelle has four
   * (Knight is extra). Morgan's is every regular class for its gender, and Morgan starts in the other parent's class.
   */
  readonly defaultClassSet: readonly ClassId[];
};

const MORGAN_GROWTHS = { hp: 35, str: 35, mag: 40, skl: 40, spd: 40, lck: 50, def: 25, res: 25 } as const;

export const CHILD_UNITS = {
  lucina: { name: 'Lucina', gender: 'F', fixedParent: 'chrom', growths: { hp: 45, str: 35, mag: 20, skl: 45, spd: 45, lck: 80, def: 25, res: 25 }, defaultClassSet: ['lord', 'cavalier', 'archer'] },
  owain: { name: 'Owain', gender: 'M', fixedParent: 'lissa', growths: { hp: 45, str: 40, mag: 30, skl: 45, spd: 35, lck: 50, def: 30, res: 30 }, defaultClassSet: ['myrmidon', 'priest', 'barbarian'] },
  inigo: { name: 'Inigo', gender: 'M', fixedParent: 'olivia', growths: { hp: 50, str: 35, mag: 15, skl: 35, spd: 45, lck: 65, def: 30, res: 20 }, defaultClassSet: ['mercenary', 'myrmidon', 'barbarian'] },
  brady: { name: 'Brady', gender: 'M', fixedParent: 'maribelle', growths: { hp: 55, str: 30, mag: 40, skl: 25, spd: 30, lck: 60, def: 30, res: 30 }, defaultClassSet: ['priest', 'cavalier', 'mage'] },
  kjelle: { name: 'Kjelle', gender: 'F', fixedParent: 'sully', growths: { hp: 40, str: 35, mag: 25, skl: 40, spd: 45, lck: 55, def: 40, res: 20 }, defaultClassSet: ['knight', 'cavalier', 'myrmidon', 'wyvern-rider'] },
  cynthia: { name: 'Cynthia', gender: 'F', fixedParent: 'sumia', growths: { hp: 45, str: 35, mag: 20, skl: 25, spd: 45, lck: 70, def: 30, res: 30 }, defaultClassSet: ['pegasus-knight', 'knight', 'priest'] },
  severa: { name: 'Severa', gender: 'F', fixedParent: 'cordelia', growths: { hp: 45, str: 40, mag: 10, skl: 45, spd: 35, lck: 35, def: 40, res: 30 }, defaultClassSet: ['mercenary', 'pegasus-knight', 'dark-mage'] },
  gerome: { name: 'Gerome', gender: 'M', fixedParent: 'cherche', growths: { hp: 65, str: 50, mag: 15, skl: 40, spd: 40, lck: 30, def: 40, res: 10 }, defaultClassSet: ['wyvern-rider', 'fighter', 'priest'] },
  'morgan-m': { name: 'Morgan (M)', gender: 'M', fixedParent: 'robin', growths: MORGAN_GROWTHS, defaultClassSet: regularClasses('M') },
  'morgan-f': { name: 'Morgan (F)', gender: 'F', fixedParent: 'robin', growths: MORGAN_GROWTHS, defaultClassSet: regularClasses('F') },
  yarne: { name: 'Yarne', gender: 'M', fixedParent: 'panne', growths: { hp: 70, str: 50, mag: 10, skl: 45, spd: 40, lck: 60, def: 45, res: 10 }, defaultClassSet: ['taguel', 'thief', 'barbarian'] },
  laurent: { name: 'Laurent', gender: 'M', fixedParent: 'miriel', growths: { hp: 45, str: 20, mag: 40, skl: 40, spd: 30, lck: 50, def: 25, res: 35 }, defaultClassSet: ['mage', 'barbarian', 'dark-mage'] },
  noire: { name: 'Noire', gender: 'F', fixedParent: 'tharja', growths: { hp: 30, str: 45, mag: 40, skl: 35, spd: 50, lck: 40, def: 30, res: 40 }, defaultClassSet: ['archer', 'knight', 'dark-mage'] },
  nah: { name: 'Nah', gender: 'F', fixedParent: 'nowi', growths: { hp: 70, str: 35, mag: 35, skl: 45, spd: 35, lck: 70, def: 45, res: 40 }, defaultClassSet: ['manakete', 'wyvern-rider', 'mage'] },
} as const satisfies Record<string, ChildUnitData>;

export type ChildId = keyof typeof CHILD_UNITS;
