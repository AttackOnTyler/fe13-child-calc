/**
 * First-generation units: personal growths and max-stat modifiers.
 *
 * Sources (see docs on research/data-sources and research/data-disagreements, #5 / #13):
 * - Personal growths: FEW Module:CharGrowths/FE13, oldid 620231
 *   https://fireemblemwiki.org/w/index.php?title=Module:CharGrowths/FE13&oldid=620231
 *   cross-checked against SF https://serenesforest.net/awakening/characters/growth-rates/base/
 *   (392 values, 0 disagreements).
 * - Max-stat modifiers: SF calculator https://serenesforest.net/app/java/fe13maxstats.js (`char_maxes`)
 *   and SF https://serenesforest.net/awakening/characters/maximum-stats/modifiers/ ,
 *   cross-checked against FEW per-character CharStats (245 values; revisions listed in research/data-sources §1).
 *
 * - Class sets: SF https://serenesforest.net/awakening/characters/class-sets/ , cross-checked against FEW
 *   Reclass3DS (47 units, 0 disagreements; research/marriage-and-classes Appendix A, #3).
 * - Classes passed to a son/daughter: SF https://serenesforest.net/awakening/characters/children/ gender-substitution
 *   table and per-child pages, FEW https://fireemblemwiki.org/wiki/Inheritance?oldid=752340 (research §3.3–3.4).
 *
 * Robin is not listed here: Robin's profile depends on the asset/flaw and is built separately.
 */
import type { Assumed } from './citations';
import type { ClassId } from './classes';
import type { Gender, Growths, Modifiers } from './stats';

/**
 * The classes a unit passes to a son and to a daughter when it is the child's variable parent, with gender
 * substitution and the Galedad rule (Donnel's and Gaius's male-only classes become Pegasus Knight for a
 * daughter) baked in. Lord, Conqueror, Dancer, Taguel, Manakete and DLC classes are never passed; Villager passes
 * to sons only. `null` means the unit is never the variable parent of a child of that gender (every son but
 * Morgan has a fixed mother, and Morgan follows its own rule), so no source gives the list.
 */
export type PassesClasses = { readonly son: readonly ClassId[] | null; readonly daughter: readonly ClassId[] | null };

export type FirstGenUnitData = {
  readonly name: string;
  readonly gender: Gender;
  /** An assumption reference where no source publishes them. */
  readonly growths: Growths | Assumed<'maiden-growths'>;
  readonly modifiers: Modifiers;
  /** The unit's class set (base classes). The first is its default base class, which Morgan can start in. */
  readonly classes: readonly ClassId[];
  readonly passesClasses: PassesClasses;
};

/** Robin-only units and the fixed mothers are never a variable parent outside Morgan's own rule. */
const PASSES_NO_CLASSES: PassesClasses = { son: null, daughter: null };

export const FIRST_GEN_UNITS = {
  // Lord goes only to Lucina, whose default set has it; Chrom's other children get Cavalier and Archer (FEW Inheritance).
  chrom: { name: "Chrom", gender: 'M', growths: { hp: 45, str: 40, mag: 10, skl: 40, spd: 40, lck: 70, def: 35, res: 20 }, modifiers: { str: 1, mag: 0, skl: 1, spd: 1, lck: 1, def: -1, res: -1 }, classes: ['lord', 'cavalier', 'archer'], passesClasses: { son: ['cavalier', 'archer'], daughter: ['cavalier', 'archer'] } },
  lissa: { name: "Lissa", gender: 'F', growths: { hp: 35, str: 25, mag: 35, skl: 30, spd: 35, lck: 65, def: 15, res: 35 }, modifiers: { str: -2, mag: 2, skl: -1, spd: 0, lck: 2, def: -1, res: 1 }, classes: ['priest', 'pegasus-knight', 'troubadour'], passesClasses: PASSES_NO_CLASSES },
  frederick: { name: "Frederick", gender: 'M', growths: { hp: 60, str: 40, mag: 10, skl: 40, spd: 35, lck: 40, def: 40, res: 20 }, modifiers: { str: 2, mag: -2, skl: 2, spd: -2, lck: 0, def: 2, res: 0 }, classes: ['cavalier', 'knight', 'wyvern-rider'], passesClasses: { son: ['cavalier', 'knight', 'wyvern-rider'], daughter: ['cavalier', 'knight', 'wyvern-rider'] } },
  sully: { name: "Sully", gender: 'F', growths: { hp: 40, str: 35, mag: 20, skl: 40, spd: 40, lck: 60, def: 35, res: 20 }, modifiers: { str: -1, mag: -1, skl: 2, spd: 2, lck: 0, def: -1, res: 0 }, classes: ['cavalier', 'myrmidon', 'wyvern-rider'], passesClasses: { son: null, daughter: ['cavalier', 'myrmidon', 'wyvern-rider'] } },
  virion: { name: "Virion", gender: 'M', growths: { hp: 35, str: 40, mag: 30, skl: 40, spd: 45, lck: 40, def: 25, res: 25 }, modifiers: { str: 0, mag: 0, skl: 2, spd: 2, lck: -1, def: -2, res: 0 }, classes: ['archer', 'wyvern-rider', 'mage'], passesClasses: { son: ['archer', 'wyvern-rider', 'mage'], daughter: ['archer', 'wyvern-rider', 'mage'] } },
  stahl: { name: "Stahl", gender: 'M', growths: { hp: 50, str: 45, mag: 10, skl: 35, spd: 30, lck: 50, def: 50, res: 10 }, modifiers: { str: 2, mag: -1, skl: 1, spd: 0, lck: -2, def: 2, res: -1 }, classes: ['cavalier', 'archer', 'myrmidon'], passesClasses: { son: ['cavalier', 'archer', 'myrmidon'], daughter: ['cavalier', 'archer', 'myrmidon'] } },
  // Daughters: Fighter → Knight, Barbarian → Mercenary (SF children substitution table).
  vaike: { name: "Vaike", gender: 'M', growths: { hp: 60, str: 50, mag: 10, skl: 45, spd: 35, lck: 45, def: 40, res: 5 }, modifiers: { str: 3, mag: -2, skl: 1, spd: 1, lck: -1, def: 0, res: -2 }, classes: ['fighter', 'thief', 'barbarian'], passesClasses: { son: ['fighter', 'thief', 'barbarian'], daughter: ['knight', 'thief', 'mercenary'] } },
  miriel: { name: "Miriel", gender: 'F', growths: { hp: 35, str: 15, mag: 40, skl: 40, spd: 40, lck: 50, def: 20, res: 30 }, modifiers: { str: -2, mag: 3, skl: 1, spd: 1, lck: 0, def: -2, res: 0 }, classes: ['mage', 'troubadour', 'dark-mage'], passesClasses: PASSES_NO_CLASSES },
  sumia: { name: "Sumia", gender: 'F', growths: { hp: 35, str: 30, mag: 20, skl: 45, spd: 45, lck: 60, def: 25, res: 30 }, modifiers: { str: -2, mag: 0, skl: 2, spd: 3, lck: 0, def: -2, res: 1 }, classes: ['pegasus-knight', 'knight', 'priest'], passesClasses: { son: null, daughter: ['pegasus-knight', 'knight', 'priest'] } },
  kellam: { name: "Kellam", gender: 'M', growths: { hp: 50, str: 40, mag: 15, skl: 40, spd: 35, lck: 35, def: 55, res: 30 }, modifiers: { str: 1, mag: 0, skl: 1, spd: -2, lck: -2, def: 3, res: 0 }, classes: ['knight', 'thief', 'priest'], passesClasses: { son: ['knight', 'thief', 'priest'], daughter: ['knight', 'thief', 'priest'] } },
  // Galedad. Daughters: Villager → Pegasus Knight, Fighter → Troubadour. Villager passes to sons.
  donnel: { name: "Donnel", gender: 'M', growths: { hp: 50, str: 45, mag: 15, skl: 40, spd: 45, lck: 80, def: 35, res: 15 }, modifiers: { str: 1, mag: -1, skl: -1, spd: -1, lck: 3, def: 1, res: -1 }, classes: ['villager', 'fighter', 'mercenary'], passesClasses: { son: ['villager', 'fighter', 'mercenary'], daughter: ['pegasus-knight', 'troubadour', 'mercenary'] } },
  lonqu: { name: "Lon'qu", gender: 'M', growths: { hp: 40, str: 35, mag: 20, skl: 50, spd: 50, lck: 55, def: 25, res: 20 }, modifiers: { str: 0, mag: 0, skl: 3, spd: 3, lck: 0, def: -2, res: -2 }, classes: ['myrmidon', 'thief', 'wyvern-rider'], passesClasses: { son: ['myrmidon', 'thief', 'wyvern-rider'], daughter: ['myrmidon', 'thief', 'wyvern-rider'] } },
  ricken: { name: "Ricken", gender: 'M', growths: { hp: 50, str: 20, mag: 35, skl: 30, spd: 30, lck: 65, def: 30, res: 25 }, modifiers: { str: -1, mag: 2, skl: 0, spd: 0, lck: 1, def: -1, res: 0 }, classes: ['mage', 'cavalier', 'archer'], passesClasses: { son: ['mage', 'cavalier', 'archer'], daughter: ['mage', 'cavalier', 'archer'] } },
  maribelle: { name: "Maribelle", gender: 'F', growths: { hp: 30, str: 20, mag: 40, skl: 40, spd: 30, lck: 80, def: 10, res: 40 }, modifiers: { str: -3, mag: 2, skl: 1, spd: 0, lck: 3, def: -3, res: 2 }, classes: ['troubadour', 'pegasus-knight', 'mage'], passesClasses: { son: null, daughter: ['troubadour', 'pegasus-knight', 'mage'] } },
  panne: { name: "Panne", gender: 'F', growths: { hp: 60, str: 45, mag: 15, skl: 50, spd: 55, lck: 40, def: 40, res: 15 }, modifiers: { str: 2, mag: -1, skl: 2, spd: 3, lck: -1, def: 1, res: -1 }, classes: ['taguel', 'thief', 'wyvern-rider'], passesClasses: PASSES_NO_CLASSES },
  // Galedad. Daughters: Fighter → Pegasus Knight.
  gaius: { name: "Gaius", gender: 'M', growths: { hp: 50, str: 45, mag: 15, skl: 45, spd: 45, lck: 35, def: 25, res: 15 }, modifiers: { str: 1, mag: -1, skl: 2, spd: 2, lck: -2, def: -1, res: 0 }, classes: ['thief', 'fighter', 'myrmidon'], passesClasses: { son: ['thief', 'fighter', 'myrmidon'], daughter: ['thief', 'pegasus-knight', 'myrmidon'] } },
  cordelia: { name: "Cordelia", gender: 'F', growths: { hp: 50, str: 45, mag: 15, skl: 35, spd: 35, lck: 45, def: 40, res: 25 }, modifiers: { str: 1, mag: -1, skl: 2, spd: 2, lck: -1, def: 0, res: -1 }, classes: ['pegasus-knight', 'mercenary', 'dark-mage'], passesClasses: PASSES_NO_CLASSES },
  // Daughters: Barbarian → Troubadour.
  gregor: { name: "Gregor", gender: 'M', growths: { hp: 60, str: 40, mag: 10, skl: 40, spd: 30, lck: 45, def: 40, res: 10 }, modifiers: { str: 2, mag: -1, skl: 2, spd: 0, lck: -1, def: 1, res: -2 }, classes: ['mercenary', 'barbarian', 'myrmidon'], passesClasses: { son: ['mercenary', 'barbarian', 'myrmidon'], daughter: ['mercenary', 'troubadour', 'myrmidon'] } },
  nowi: { name: "Nowi", gender: 'F', growths: { hp: 70, str: 45, mag: 35, skl: 30, spd: 30, lck: 65, def: 50, res: 35 }, modifiers: { str: 1, mag: 1, skl: -1, spd: -2, lck: 1, def: 3, res: 2 }, classes: ['manakete', 'mage', 'wyvern-rider'], passesClasses: PASSES_NO_CLASSES },
  libra: { name: "Libra", gender: 'M', growths: { hp: 45, str: 25, mag: 35, skl: 45, spd: 35, lck: 45, def: 25, res: 30 }, modifiers: { str: 0, mag: 1, skl: 1, spd: 0, lck: -1, def: 0, res: 1 }, classes: ['priest', 'mage', 'dark-mage'], passesClasses: { son: ['priest', 'mage', 'dark-mage'], daughter: ['priest', 'mage', 'dark-mage'] } },
  tharja: { name: "Tharja", gender: 'F', growths: { hp: 40, str: 25, mag: 45, skl: 25, spd: 45, lck: 40, def: 35, res: 20 }, modifiers: { str: 0, mag: 3, skl: -1, spd: 1, lck: -3, def: 1, res: 0 }, classes: ['dark-mage', 'knight', 'archer'], passesClasses: PASSES_NO_CLASSES },
  anna: { name: "Anna", gender: 'F', growths: { hp: 45, str: 30, mag: 30, skl: 35, spd: 35, lck: 80, def: 30, res: 30 }, modifiers: { str: -1, mag: 0, skl: 1, spd: 0, lck: 3, def: -1, res: 0 }, classes: ['thief', 'archer', 'mage'], passesClasses: PASSES_NO_CLASSES },
  // Dancer is never passed, not even to a daughter (FEW Inheritance footnote; SF Lucina page).
  olivia: { name: "Olivia", gender: 'F', growths: { hp: 40, str: 35, mag: 25, skl: 45, spd: 45, lck: 60, def: 20, res: 20 }, modifiers: { str: 0, mag: 0, skl: 1, spd: 1, lck: 0, def: -1, res: -1 }, classes: ['dancer', 'myrmidon', 'pegasus-knight'], passesClasses: { son: null, daughter: ['myrmidon', 'pegasus-knight'] } },
  cherche: { name: "Cherche", gender: 'F', growths: { hp: 55, str: 40, mag: 20, skl: 40, spd: 35, lck: 50, def: 45, res: 10 }, modifiers: { str: 3, mag: 0, skl: -1, spd: -1, lck: 0, def: 2, res: -2 }, classes: ['wyvern-rider', 'troubadour', 'priest'], passesClasses: PASSES_NO_CLASSES },
  // Daughters: Barbarian → Troubadour.
  henry: { name: "Henry", gender: 'M', growths: { hp: 45, str: 35, mag: 35, skl: 45, spd: 40, lck: 40, def: 40, res: 20 }, modifiers: { str: 1, mag: 1, skl: 2, spd: 0, lck: -2, def: 1, res: -1 }, classes: ['dark-mage', 'barbarian', 'thief'], passesClasses: { son: ['dark-mage', 'barbarian', 'thief'], daughter: ['dark-mage', 'troubadour', 'thief'] } },
  sayri: { name: "Say'ri", gender: 'F', growths: { hp: 50, str: 35, mag: 20, skl: 40, spd: 40, lck: 45, def: 35, res: 30 }, modifiers: { str: 1, mag: -1, skl: 1, spd: 1, lck: -1, def: 0, res: 1 }, classes: ['myrmidon', 'pegasus-knight', 'wyvern-rider'], passesClasses: PASSES_NO_CLASSES },
  tiki: { name: "Tiki", gender: 'F', growths: { hp: 80, str: 40, mag: 40, skl: 35, spd: 30, lck: 80, def: 45, res: 45 }, modifiers: { str: 0, mag: -1, skl: 0, spd: 1, lck: 2, def: 1, res: 2 }, classes: ['manakete', 'wyvern-rider', 'mage'], passesClasses: PASSES_NO_CLASSES },
  basilio: { name: "Basilio", gender: 'M', growths: { hp: 65, str: 45, mag: 10, skl: 40, spd: 35, lck: 45, def: 40, res: 15 }, modifiers: { str: 3, mag: -2, skl: 1, spd: 1, lck: -1, def: 1, res: -1 }, classes: ['fighter', 'barbarian', 'knight'], passesClasses: PASSES_NO_CLASSES },
  // #13 D2: Flavia Skl modifier resolved to +2 (SF table, SF-JS, independent JP 2ch wiki row total)
  // over FEW/Fandom (+1).
  flavia: { name: "Flavia", gender: 'F', growths: { hp: 50, str: 35, mag: 20, skl: 45, spd: 45, lck: 55, def: 30, res: 25 }, modifiers: { str: 1, mag: -1, skl: 2, spd: 1, lck: 0, def: -1, res: 0 }, classes: ['mercenary', 'thief', 'knight'], passesClasses: PASSES_NO_CLASSES },
  gangrel: { name: "Gangrel", gender: 'M', growths: { hp: 40, str: 40, mag: 30, skl: 50, spd: 50, lck: 30, def: 30, res: 30 }, modifiers: { str: -2, mag: 0, skl: 3, spd: 3, lck: -1, def: -1, res: 0 }, classes: ['thief', 'barbarian', 'dark-mage'], passesClasses: PASSES_NO_CLASSES },
  // #13 D1a: Walhart personal Skl/Spd resolved to 30/30 (SF table, SF-JS, FEW module, OifeyBot)
  // over the FEW Walhart page (25/25, back-derived from a class growth of 20).
  walhart: { name: "Walhart", gender: 'M', growths: { hp: 75, str: 60, mag: 10, skl: 30, spd: 30, lck: 45, def: 45, res: 25 }, modifiers: { str: 4, mag: -2, skl: 0, spd: -1, lck: -1, def: 4, res: -2 }, classes: ['conqueror', 'knight', 'wyvern-rider'], passesClasses: PASSES_NO_CLASSES },
  emmeryn: { name: "Emmeryn", gender: 'F', growths: { hp: 45, str: 10, mag: 55, skl: 40, spd: 40, lck: 70, def: 25, res: 35 }, modifiers: { str: -2, mag: 4, skl: 0, spd: 1, lck: 0, def: -2, res: 1 }, classes: ['priest', 'pegasus-knight', 'troubadour'], passesClasses: PASSES_NO_CLASSES },
  yenfay: { name: "Yen'fay", gender: 'M', growths: { hp: 60, str: 45, mag: 10, skl: 45, spd: 50, lck: 60, def: 30, res: 20 }, modifiers: { str: 1, mag: -2, skl: 2, spd: 4, lck: 0, def: -1, res: -2 }, classes: ['myrmidon', 'wyvern-rider', 'archer'], passesClasses: PASSES_NO_CLASSES },
  aversa: { name: "Aversa", gender: 'F', growths: { hp: 45, str: 25, mag: 45, skl: 35, spd: 40, lck: 65, def: 30, res: 30 }, modifiers: { str: -1, mag: 3, skl: 1, spd: 1, lck: -2, def: 0, res: 0 }, classes: ['pegasus-knight', 'wyvern-rider', 'dark-mage'], passesClasses: PASSES_NO_CLASSES },
  priam: { name: "Priam", gender: 'M', growths: { hp: 80, str: 60, mag: 10, skl: 40, spd: 30, lck: 50, def: 40, res: 10 }, modifiers: { str: 3, mag: -2, skl: 1, spd: 0, lck: 0, def: 2, res: -2 }, classes: ['mercenary', 'myrmidon', 'fighter'], passesClasses: PASSES_NO_CLASSES },
  // Chrom's default wife if he has no S-support by the end of Chapter 11. Not an S-support partner.
  // #13: she has no class set and passes no classes (SF-JS, FEW Maiden).
  // #13: modifiers resolved to all 0 (JP 2ch wiki p.79 "MOB村娘", FEW Lucina/Stats, SF-JS `'Maiden': empty`).
  // Growths are published nowhere (SF-JS `'Maiden': unknown`, FEW "??"), so they come from the assumptions.
  maiden: { name: "Maiden", gender: 'F', growths: { assumption: 'maiden-growths' }, modifiers: { str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 }, classes: [], passesClasses: { son: null, daughter: [] } },
} as const satisfies Record<string, FirstGenUnitData>;

export type UnitId = keyof typeof FIRST_GEN_UNITS;
