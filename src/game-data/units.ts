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
 * Robin is not listed here: Robin's profile depends on the asset/flaw and is built separately.
 */
import type { Assumed } from './citations';
import type { Gender, Growths, Modifiers } from './stats';

export type FirstGenUnitData = {
  readonly name: string;
  readonly gender: Gender;
  /** An assumption reference where no source publishes them. */
  readonly growths: Growths | Assumed<'maiden-growths'>;
  readonly modifiers: Modifiers;
};

export const FIRST_GEN_UNITS = {
  chrom: { name: "Chrom", gender: 'M', growths: { hp: 45, str: 40, mag: 10, skl: 40, spd: 40, lck: 70, def: 35, res: 20 }, modifiers: { str: 1, mag: 0, skl: 1, spd: 1, lck: 1, def: -1, res: -1 } },
  lissa: { name: "Lissa", gender: 'F', growths: { hp: 35, str: 25, mag: 35, skl: 30, spd: 35, lck: 65, def: 15, res: 35 }, modifiers: { str: -2, mag: 2, skl: -1, spd: 0, lck: 2, def: -1, res: 1 } },
  frederick: { name: "Frederick", gender: 'M', growths: { hp: 60, str: 40, mag: 10, skl: 40, spd: 35, lck: 40, def: 40, res: 20 }, modifiers: { str: 2, mag: -2, skl: 2, spd: -2, lck: 0, def: 2, res: 0 } },
  sully: { name: "Sully", gender: 'F', growths: { hp: 40, str: 35, mag: 20, skl: 40, spd: 40, lck: 60, def: 35, res: 20 }, modifiers: { str: -1, mag: -1, skl: 2, spd: 2, lck: 0, def: -1, res: 0 } },
  virion: { name: "Virion", gender: 'M', growths: { hp: 35, str: 40, mag: 30, skl: 40, spd: 45, lck: 40, def: 25, res: 25 }, modifiers: { str: 0, mag: 0, skl: 2, spd: 2, lck: -1, def: -2, res: 0 } },
  stahl: { name: "Stahl", gender: 'M', growths: { hp: 50, str: 45, mag: 10, skl: 35, spd: 30, lck: 50, def: 50, res: 10 }, modifiers: { str: 2, mag: -1, skl: 1, spd: 0, lck: -2, def: 2, res: -1 } },
  vaike: { name: "Vaike", gender: 'M', growths: { hp: 60, str: 50, mag: 10, skl: 45, spd: 35, lck: 45, def: 40, res: 5 }, modifiers: { str: 3, mag: -2, skl: 1, spd: 1, lck: -1, def: 0, res: -2 } },
  miriel: { name: "Miriel", gender: 'F', growths: { hp: 35, str: 15, mag: 40, skl: 40, spd: 40, lck: 50, def: 20, res: 30 }, modifiers: { str: -2, mag: 3, skl: 1, spd: 1, lck: 0, def: -2, res: 0 } },
  sumia: { name: "Sumia", gender: 'F', growths: { hp: 35, str: 30, mag: 20, skl: 45, spd: 45, lck: 60, def: 25, res: 30 }, modifiers: { str: -2, mag: 0, skl: 2, spd: 3, lck: 0, def: -2, res: 1 } },
  kellam: { name: "Kellam", gender: 'M', growths: { hp: 50, str: 40, mag: 15, skl: 40, spd: 35, lck: 35, def: 55, res: 30 }, modifiers: { str: 1, mag: 0, skl: 1, spd: -2, lck: -2, def: 3, res: 0 } },
  donnel: { name: "Donnel", gender: 'M', growths: { hp: 50, str: 45, mag: 15, skl: 40, spd: 45, lck: 80, def: 35, res: 15 }, modifiers: { str: 1, mag: -1, skl: -1, spd: -1, lck: 3, def: 1, res: -1 } },
  lonqu: { name: "Lon'qu", gender: 'M', growths: { hp: 40, str: 35, mag: 20, skl: 50, spd: 50, lck: 55, def: 25, res: 20 }, modifiers: { str: 0, mag: 0, skl: 3, spd: 3, lck: 0, def: -2, res: -2 } },
  ricken: { name: "Ricken", gender: 'M', growths: { hp: 50, str: 20, mag: 35, skl: 30, spd: 30, lck: 65, def: 30, res: 25 }, modifiers: { str: -1, mag: 2, skl: 0, spd: 0, lck: 1, def: -1, res: 0 } },
  maribelle: { name: "Maribelle", gender: 'F', growths: { hp: 30, str: 20, mag: 40, skl: 40, spd: 30, lck: 80, def: 10, res: 40 }, modifiers: { str: -3, mag: 2, skl: 1, spd: 0, lck: 3, def: -3, res: 2 } },
  panne: { name: "Panne", gender: 'F', growths: { hp: 60, str: 45, mag: 15, skl: 50, spd: 55, lck: 40, def: 40, res: 15 }, modifiers: { str: 2, mag: -1, skl: 2, spd: 3, lck: -1, def: 1, res: -1 } },
  gaius: { name: "Gaius", gender: 'M', growths: { hp: 50, str: 45, mag: 15, skl: 45, spd: 45, lck: 35, def: 25, res: 15 }, modifiers: { str: 1, mag: -1, skl: 2, spd: 2, lck: -2, def: -1, res: 0 } },
  cordelia: { name: "Cordelia", gender: 'F', growths: { hp: 50, str: 45, mag: 15, skl: 35, spd: 35, lck: 45, def: 40, res: 25 }, modifiers: { str: 1, mag: -1, skl: 2, spd: 2, lck: -1, def: 0, res: -1 } },
  gregor: { name: "Gregor", gender: 'M', growths: { hp: 60, str: 40, mag: 10, skl: 40, spd: 30, lck: 45, def: 40, res: 10 }, modifiers: { str: 2, mag: -1, skl: 2, spd: 0, lck: -1, def: 1, res: -2 } },
  nowi: { name: "Nowi", gender: 'F', growths: { hp: 70, str: 45, mag: 35, skl: 30, spd: 30, lck: 65, def: 50, res: 35 }, modifiers: { str: 1, mag: 1, skl: -1, spd: -2, lck: 1, def: 3, res: 2 } },
  libra: { name: "Libra", gender: 'M', growths: { hp: 45, str: 25, mag: 35, skl: 45, spd: 35, lck: 45, def: 25, res: 30 }, modifiers: { str: 0, mag: 1, skl: 1, spd: 0, lck: -1, def: 0, res: 1 } },
  tharja: { name: "Tharja", gender: 'F', growths: { hp: 40, str: 25, mag: 45, skl: 25, spd: 45, lck: 40, def: 35, res: 20 }, modifiers: { str: 0, mag: 3, skl: -1, spd: 1, lck: -3, def: 1, res: 0 } },
  anna: { name: "Anna", gender: 'F', growths: { hp: 45, str: 30, mag: 30, skl: 35, spd: 35, lck: 80, def: 30, res: 30 }, modifiers: { str: -1, mag: 0, skl: 1, spd: 0, lck: 3, def: -1, res: 0 } },
  olivia: { name: "Olivia", gender: 'F', growths: { hp: 40, str: 35, mag: 25, skl: 45, spd: 45, lck: 60, def: 20, res: 20 }, modifiers: { str: 0, mag: 0, skl: 1, spd: 1, lck: 0, def: -1, res: -1 } },
  cherche: { name: "Cherche", gender: 'F', growths: { hp: 55, str: 40, mag: 20, skl: 40, spd: 35, lck: 50, def: 45, res: 10 }, modifiers: { str: 3, mag: 0, skl: -1, spd: -1, lck: 0, def: 2, res: -2 } },
  henry: { name: "Henry", gender: 'M', growths: { hp: 45, str: 35, mag: 35, skl: 45, spd: 40, lck: 40, def: 40, res: 20 }, modifiers: { str: 1, mag: 1, skl: 2, spd: 0, lck: -2, def: 1, res: -1 } },
  sayri: { name: "Say'ri", gender: 'F', growths: { hp: 50, str: 35, mag: 20, skl: 40, spd: 40, lck: 45, def: 35, res: 30 }, modifiers: { str: 1, mag: -1, skl: 1, spd: 1, lck: -1, def: 0, res: 1 } },
  tiki: { name: "Tiki", gender: 'F', growths: { hp: 80, str: 40, mag: 40, skl: 35, spd: 30, lck: 80, def: 45, res: 45 }, modifiers: { str: 0, mag: -1, skl: 0, spd: 1, lck: 2, def: 1, res: 2 } },
  basilio: { name: "Basilio", gender: 'M', growths: { hp: 65, str: 45, mag: 10, skl: 40, spd: 35, lck: 45, def: 40, res: 15 }, modifiers: { str: 3, mag: -2, skl: 1, spd: 1, lck: -1, def: 1, res: -1 } },
  // #13 D2: Flavia Skl modifier resolved to +2 (SF table, SF-JS, independent JP 2ch wiki row total)
  // over FEW/Fandom (+1).
  flavia: { name: "Flavia", gender: 'F', growths: { hp: 50, str: 35, mag: 20, skl: 45, spd: 45, lck: 55, def: 30, res: 25 }, modifiers: { str: 1, mag: -1, skl: 2, spd: 1, lck: 0, def: -1, res: 0 } },
  gangrel: { name: "Gangrel", gender: 'M', growths: { hp: 40, str: 40, mag: 30, skl: 50, spd: 50, lck: 30, def: 30, res: 30 }, modifiers: { str: -2, mag: 0, skl: 3, spd: 3, lck: -1, def: -1, res: 0 } },
  // #13 D1a: Walhart personal Skl/Spd resolved to 30/30 (SF table, SF-JS, FEW module, OifeyBot)
  // over the FEW Walhart page (25/25, back-derived from a class growth of 20).
  walhart: { name: "Walhart", gender: 'M', growths: { hp: 75, str: 60, mag: 10, skl: 30, spd: 30, lck: 45, def: 45, res: 25 }, modifiers: { str: 4, mag: -2, skl: 0, spd: -1, lck: -1, def: 4, res: -2 } },
  emmeryn: { name: "Emmeryn", gender: 'F', growths: { hp: 45, str: 10, mag: 55, skl: 40, spd: 40, lck: 70, def: 25, res: 35 }, modifiers: { str: -2, mag: 4, skl: 0, spd: 1, lck: 0, def: -2, res: 1 } },
  yenfay: { name: "Yen'fay", gender: 'M', growths: { hp: 60, str: 45, mag: 10, skl: 45, spd: 50, lck: 60, def: 30, res: 20 }, modifiers: { str: 1, mag: -2, skl: 2, spd: 4, lck: 0, def: -1, res: -2 } },
  aversa: { name: "Aversa", gender: 'F', growths: { hp: 45, str: 25, mag: 45, skl: 35, spd: 40, lck: 65, def: 30, res: 30 }, modifiers: { str: -1, mag: 3, skl: 1, spd: 1, lck: -2, def: 0, res: 0 } },
  priam: { name: "Priam", gender: 'M', growths: { hp: 80, str: 60, mag: 10, skl: 40, spd: 30, lck: 50, def: 40, res: 10 }, modifiers: { str: 3, mag: -2, skl: 1, spd: 0, lck: 0, def: 2, res: -2 } },
  // Chrom's default wife if he has no S-support by the end of Chapter 11. Not an S-support partner.
  // #13: modifiers resolved to all 0 (JP 2ch wiki p.79 "MOB村娘", FEW Lucina/Stats, SF-JS `'Maiden': empty`).
  // Growths are published nowhere (SF-JS `'Maiden': unknown`, FEW "??"), so they come from the assumptions.
  maiden: { name: "Maiden", gender: 'F', growths: { assumption: 'maiden-growths' }, modifiers: { str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 } },
} as const satisfies Record<string, FirstGenUnitData>;

export type UnitId = keyof typeof FIRST_GEN_UNITS;
