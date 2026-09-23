/**
 * Sourced inheritance fixtures (research/fixtures-and-speed, #7 / #8): F1–F6 without Robin, M1–M5 with Robin/Morgan.
 *
 * Expected growths are the child's published *total* growth in its default starting class; the
 * starting class's growths are listed alongside so the check can compare like with like.
 * Class growths: SF https://serenesforest.net/awakening/classes/growth-rates/ (Lck is 0 for every class).
 * These values come from published pages, never from running this code.
 */
import type { Growths, Modifiers } from '../game-data/stats';

export type InheritanceFixture = {
  readonly id: string;
  readonly label: string;
  readonly key: string;
  readonly classGrowths: Growths;
  readonly expectedGrowths: Growths;
  readonly expectedModifiers: Modifiers;
  readonly source: string;
};

const LORD = { hp: 40, str: 20, mag: 0, skl: 20, spd: 20, lck: 0, def: 10, res: 5 } as const;
const MERCENARY = { hp: 45, str: 20, mag: 0, skl: 25, spd: 20, lck: 0, def: 10, res: 5 } as const;
const MYRMIDON = { hp: 40, str: 20, mag: 0, skl: 25, spd: 25, lck: 0, def: 5, res: 5 } as const;
/** M1–M5 come from Marigold's Inheritance page, which shows growths without any class growth. */
const NO_CLASS = { hp: 0, str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 } as const;
const MARIGOLD = 'https://marigoldfe.com (Inheritance page, read 2026-09-22; #8). Modifiers also match SF fe13maxstats.js';

export const INHERITANCE_FIXTURES: readonly InheritanceFixture[] = [
  {
    id: 'F1',
    label: 'Lucina (Sumia × Chrom), Lord',
    key: 'lucina|sumia',
    classGrowths: LORD,
    expectedGrowths: { hp: 81, str: 55, mag: 16, skl: 63, spd: 63, lck: 70, def: 38, res: 30 },
    expectedModifiers: { str: 0, mag: 1, skl: 4, spd: 5, lck: 2, def: -2, res: 1 },
    source: 'https://fireemblemwiki.org/wiki/Lucina/Stats?oldid=746071',
  },
  {
    // SF's Lucina page says Lck +3 here; FEW, soly §3.12 and SF's own calculator give +5 (#13 D3).
    id: 'F2',
    label: 'Lucina (Maribelle × Chrom), Lord',
    key: 'lucina|maribelle',
    classGrowths: LORD,
    expectedGrowths: { hp: 80, str: 51, mag: 23, skl: 61, spd: 58, lck: 76, def: 33, res: 33 },
    expectedModifiers: { str: -1, mag: 3, skl: 3, spd: 2, lck: 5, def: -3, res: 2 },
    source: 'https://fireemblemwiki.org/wiki/Lucina/Stats?oldid=746071',
  },
  {
    id: 'F3',
    label: 'Inigo (Olivia × Lon’qu), Mercenary',
    key: 'inigo|lonqu',
    classGrowths: MERCENARY,
    expectedGrowths: { hp: 88, str: 55, mag: 20, skl: 68, spd: 66, lck: 60, def: 35, res: 25 },
    expectedModifiers: { str: 1, mag: 1, skl: 5, spd: 5, lck: 1, def: -2, res: -2 },
    source: 'https://fireemblemwiki.org/wiki/Inigo/Stats/Page_2',
  },
  {
    id: 'F4',
    label: 'Owain (Lissa × Vaike), Myrmidon',
    key: 'owain|vaike',
    classGrowths: MYRMIDON,
    expectedGrowths: { hp: 86, str: 58, mag: 25, skl: 65, spd: 60, lck: 53, def: 33, res: 28 },
    expectedModifiers: { str: 2, mag: 1, skl: 1, spd: 2, lck: 2, def: 0, res: 0 },
    source: 'https://fireemblemwiki.org/wiki/Owain/Stats/Page_1',
  },
  {
    id: 'F5',
    label: 'Owain (Lissa × Frederick), Myrmidon',
    key: 'owain|frederick',
    classGrowths: MYRMIDON,
    expectedGrowths: { hp: 86, str: 55, mag: 25, skl: 63, spd: 60, lck: 51, def: 33, res: 33 },
    expectedModifiers: { str: 1, mag: 1, skl: 2, spd: -1, lck: 3, def: 2, res: 2 },
    source: 'https://fireemblemwiki.org/wiki/Owain/Stats/Page_1',
  },
  {
    id: 'F6',
    label: 'Severa (Cordelia × Virion), Mercenary',
    key: 'severa|virion',
    classGrowths: MERCENARY,
    expectedGrowths: { hp: 88, str: 61, mag: 18, skl: 65, spd: 58, lck: 40, def: 45, res: 31 },
    expectedModifiers: { str: 2, mag: 0, skl: 5, spd: 5, lck: -1, def: -1, res: 0 },
    source: 'https://fireemblemwiki.org/wiki/Severa/Stats/Page_1',
  },
  {
    id: 'M1',
    label: 'Lucina (Robin F +Spd/−Def × Chrom)',
    key: 'lucina|robin:spd/def',
    classGrowths: NO_CLASS,
    expectedGrowths: { hp: 43, str: 38, mag: 21, skl: 41, spd: 45, lck: 68, def: 26, res: 20 },
    expectedModifiers: { str: 2, mag: 1, skl: 4, spd: 6, lck: 3, def: -3, res: -1 },
    source: MARIGOLD,
  },
  {
    id: 'M2',
    label: 'Kjelle (Sully × Robin M +Spd/−Def)',
    key: 'kjelle|robin:spd/def',
    classGrowths: NO_CLASS,
    expectedGrowths: { hp: 40, str: 36, mag: 26, skl: 40, spd: 45, lck: 56, def: 31, res: 18 },
    expectedModifiers: { str: 0, mag: 0, skl: 5, spd: 7, lck: 2, def: -3, res: 0 },
    source: MARIGOLD,
  },
  {
    // With Tactician growths added this is SF's calculator value 78/51/45/56/59/58/34/31.
    id: 'M3',
    label: 'Morgan F (Robin M +Spd/−Def × Sumia!Lucina)',
    key: 'morgan-f|robin:spd/def|lucina<sumia',
    classGrowths: NO_CLASS,
    expectedGrowths: { hp: 38, str: 36, mag: 30, skl: 41, spd: 44, lck: 58, def: 24, res: 21 },
    expectedModifiers: { str: 0, mag: 1, skl: 6, spd: 9, lck: 3, def: -5, res: 0 },
    source: MARIGOLD,
  },
  {
    id: 'M4',
    label: 'Morgan F (Robin M +Spd/−Def × Gaius!Kjelle)',
    key: 'morgan-f|robin:spd/def|kjelle<gaius',
    classGrowths: NO_CLASS,
    expectedGrowths: { hp: 39, str: 37, mag: 31, skl: 40, spd: 44, lck: 51, def: 26, res: 19 },
    expectedModifiers: { str: 1, mag: -1, skl: 7, spd: 9, lck: 0, def: -4, res: 0 },
    source: MARIGOLD,
  },
  {
    id: 'M5',
    label: 'Morgan M (Robin F +Mag/−Def × Lon’qu!Laurent)',
    key: 'morgan-m|robin:mag/def|laurent<lonqu',
    classGrowths: NO_CLASS,
    expectedGrowths: { hp: 38, str: 32, mag: 41, skl: 39, spd: 40, lck: 50, def: 22, res: 24 },
    expectedModifiers: { str: -1, mag: 8, skl: 5, spd: 7, lck: 0, def: -6, res: 0 },
    source: MARIGOLD,
  },
];
