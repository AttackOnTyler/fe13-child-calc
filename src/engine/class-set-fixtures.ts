/**
 * Class-set fixtures: every child's full base-class set for each possible variable parent, transcribed from the
 * SF per-child pages (research/marriage-and-classes Appendix B, #3; SF and FEW agree). Robin rows use one
 * asset/flaw; the class set doesn't depend on it. Morgan's rule is stated, not tabulated, there: its cases follow.
 * Priest and Cleric are one class (`priest`).
 */
import type { ClassId } from '../game-data/classes';

export type ClassSetFixture = {
  readonly id: string;
  readonly label: string;
  /** Pairing key and the expected class set (order doesn't matter). */
  readonly rows: readonly (readonly [string, readonly ClassId[]])[];
};

/** "All regular male/female classes (incl. Tactician)" (research §3.1). */
const ALL_M: readonly ClassId[] = [
  'tactician', 'cavalier', 'knight', 'myrmidon', 'mercenary', 'fighter', 'barbarian', 'archer', 'thief', 'wyvern-rider', 'mage', 'dark-mage', 'priest',
];
const ALL_F: readonly ClassId[] = [
  'tactician', 'cavalier', 'knight', 'myrmidon', 'mercenary', 'archer', 'thief', 'pegasus-knight', 'wyvern-rider', 'mage', 'dark-mage', 'priest', 'troubadour',
];

export const CLASS_SET_FIXTURES: readonly ClassSetFixture[] = [
  {
    id: 'C-brady',
    label: 'Class sets: Brady',
    rows: [
      ['brady|robin:str/mag', [...ALL_M]],
      ['brady|chrom', ['priest', 'cavalier', 'mage', 'archer']],
      ['brady|frederick', ['priest', 'cavalier', 'mage', 'knight', 'wyvern-rider']],
      ['brady|virion', ['priest', 'cavalier', 'mage', 'archer', 'wyvern-rider']],
      ['brady|stahl', ['priest', 'cavalier', 'mage', 'myrmidon', 'archer']],
      ['brady|vaike', ['priest', 'cavalier', 'mage', 'fighter', 'barbarian', 'thief']],
      ['brady|kellam', ['priest', 'cavalier', 'mage', 'knight', 'thief']],
      ['brady|lonqu', ['priest', 'cavalier', 'mage', 'myrmidon', 'thief', 'wyvern-rider']],
      ['brady|ricken', ['priest', 'cavalier', 'mage', 'archer']],
      ['brady|gaius', ['priest', 'cavalier', 'mage', 'myrmidon', 'fighter', 'thief']],
      ['brady|donnel', ['priest', 'cavalier', 'mage', 'mercenary', 'fighter', 'villager']],
      ['brady|gregor', ['priest', 'cavalier', 'mage', 'myrmidon', 'mercenary', 'barbarian']],
      ['brady|libra', ['priest', 'cavalier', 'mage', 'dark-mage']],
      ['brady|henry', ['priest', 'cavalier', 'mage', 'barbarian', 'thief', 'dark-mage']],
    ],
  },
  {
    id: 'C-cynthia',
    label: 'Class sets: Cynthia',
    rows: [
      ['cynthia|robin:str/mag', [...ALL_F]],
      ['cynthia|chrom', ['pegasus-knight', 'knight', 'priest', 'cavalier', 'archer']],
      ['cynthia|frederick', ['pegasus-knight', 'knight', 'priest', 'cavalier', 'wyvern-rider']],
      ['cynthia|gaius', ['pegasus-knight', 'knight', 'priest', 'myrmidon', 'thief']],
      ['cynthia|henry', ['pegasus-knight', 'knight', 'priest', 'thief', 'troubadour', 'dark-mage']],
    ],
  },
  {
    id: 'C-gerome',
    label: 'Class sets: Gerome',
    rows: [
      ['gerome|robin:str/mag', [...ALL_M]],
      ['gerome|frederick', ['wyvern-rider', 'fighter', 'priest', 'cavalier', 'knight']],
      ['gerome|virion', ['wyvern-rider', 'fighter', 'priest', 'archer', 'mage']],
      ['gerome|stahl', ['wyvern-rider', 'fighter', 'priest', 'cavalier', 'myrmidon', 'archer']],
      ['gerome|vaike', ['wyvern-rider', 'fighter', 'priest', 'barbarian', 'thief']],
      ['gerome|kellam', ['wyvern-rider', 'fighter', 'priest', 'knight', 'thief']],
      ['gerome|lonqu', ['wyvern-rider', 'fighter', 'priest', 'myrmidon', 'thief']],
      ['gerome|ricken', ['wyvern-rider', 'fighter', 'priest', 'cavalier', 'archer', 'mage']],
      ['gerome|gaius', ['wyvern-rider', 'fighter', 'priest', 'myrmidon', 'thief']],
      ['gerome|donnel', ['wyvern-rider', 'fighter', 'priest', 'mercenary', 'villager']],
      ['gerome|gregor', ['wyvern-rider', 'fighter', 'priest', 'myrmidon', 'mercenary', 'barbarian']],
      ['gerome|libra', ['wyvern-rider', 'fighter', 'priest', 'mage', 'dark-mage']],
      ['gerome|henry', ['wyvern-rider', 'fighter', 'priest', 'barbarian', 'thief', 'dark-mage']],
    ],
  },
  {
    id: 'C-inigo',
    label: 'Class sets: Inigo',
    rows: [
      ['inigo|robin:str/mag', [...ALL_M]],
      ['inigo|chrom', ['mercenary', 'myrmidon', 'barbarian', 'cavalier', 'archer']],
      ['inigo|frederick', ['mercenary', 'myrmidon', 'barbarian', 'cavalier', 'knight', 'wyvern-rider']],
      ['inigo|virion', ['mercenary', 'myrmidon', 'barbarian', 'archer', 'wyvern-rider', 'mage']],
      ['inigo|stahl', ['mercenary', 'myrmidon', 'barbarian', 'cavalier', 'archer']],
      ['inigo|vaike', ['mercenary', 'myrmidon', 'barbarian', 'fighter', 'thief']],
      ['inigo|kellam', ['mercenary', 'myrmidon', 'barbarian', 'knight', 'thief', 'priest']],
      ['inigo|lonqu', ['mercenary', 'myrmidon', 'barbarian', 'thief', 'wyvern-rider']],
      ['inigo|ricken', ['mercenary', 'myrmidon', 'barbarian', 'cavalier', 'archer', 'mage']],
      ['inigo|gaius', ['mercenary', 'myrmidon', 'barbarian', 'fighter', 'thief']],
      // Research Appendix B drops Fighter here; SF's Inigo page (Donnel row: Villager, Fighter) and FEW Inigo
      // ("Donnel only passes on Villager and Fighter") both include it.
      ['inigo|donnel', ['mercenary', 'myrmidon', 'barbarian', 'villager', 'fighter']],
      ['inigo|gregor', ['mercenary', 'myrmidon', 'barbarian']],
      ['inigo|libra', ['mercenary', 'myrmidon', 'barbarian', 'priest', 'mage', 'dark-mage']],
      ['inigo|henry', ['mercenary', 'myrmidon', 'barbarian', 'thief', 'dark-mage']],
    ],
  },
  {
    id: 'C-kjelle',
    label: 'Class sets: Kjelle',
    rows: [
      ['kjelle|robin:str/mag', [...ALL_F]],
      ['kjelle|chrom', ['knight', 'cavalier', 'myrmidon', 'wyvern-rider', 'archer']],
      ['kjelle|frederick', ['knight', 'cavalier', 'myrmidon', 'wyvern-rider']],
      ['kjelle|virion', ['knight', 'cavalier', 'myrmidon', 'wyvern-rider', 'archer', 'mage']],
      ['kjelle|stahl', ['knight', 'cavalier', 'myrmidon', 'wyvern-rider', 'archer']],
      ['kjelle|vaike', ['knight', 'cavalier', 'myrmidon', 'wyvern-rider', 'mercenary', 'thief']],
      ['kjelle|kellam', ['knight', 'cavalier', 'myrmidon', 'wyvern-rider', 'thief', 'priest']],
      ['kjelle|lonqu', ['knight', 'cavalier', 'myrmidon', 'wyvern-rider', 'thief']],
      ['kjelle|ricken', ['knight', 'cavalier', 'myrmidon', 'wyvern-rider', 'archer', 'mage']],
      ['kjelle|gaius', ['knight', 'cavalier', 'myrmidon', 'wyvern-rider', 'thief', 'pegasus-knight']],
      ['kjelle|donnel', ['knight', 'cavalier', 'myrmidon', 'wyvern-rider', 'mercenary', 'pegasus-knight', 'troubadour']],
      ['kjelle|gregor', ['knight', 'cavalier', 'myrmidon', 'wyvern-rider', 'mercenary', 'troubadour']],
      ['kjelle|libra', ['knight', 'cavalier', 'myrmidon', 'wyvern-rider', 'priest', 'mage', 'dark-mage']],
      ['kjelle|henry', ['knight', 'cavalier', 'myrmidon', 'wyvern-rider', 'thief', 'troubadour', 'dark-mage']],
    ],
  },
  {
    id: 'C-laurent',
    label: 'Class sets: Laurent',
    rows: [
      ['laurent|robin:str/mag', [...ALL_M]],
      ['laurent|frederick', ['mage', 'barbarian', 'dark-mage', 'cavalier', 'knight', 'wyvern-rider']],
      ['laurent|virion', ['mage', 'barbarian', 'dark-mage', 'archer', 'wyvern-rider']],
      ['laurent|stahl', ['mage', 'barbarian', 'dark-mage', 'cavalier', 'myrmidon', 'archer']],
      ['laurent|vaike', ['mage', 'barbarian', 'dark-mage', 'fighter', 'thief']],
      ['laurent|kellam', ['mage', 'barbarian', 'dark-mage', 'knight', 'thief', 'priest']],
      ['laurent|lonqu', ['mage', 'barbarian', 'dark-mage', 'myrmidon', 'thief', 'wyvern-rider']],
      ['laurent|ricken', ['mage', 'barbarian', 'dark-mage', 'cavalier', 'archer']],
      ['laurent|gaius', ['mage', 'barbarian', 'dark-mage', 'myrmidon', 'fighter', 'thief']],
      ['laurent|donnel', ['mage', 'barbarian', 'dark-mage', 'mercenary', 'fighter', 'villager']],
      ['laurent|gregor', ['mage', 'barbarian', 'dark-mage', 'myrmidon', 'mercenary']],
      ['laurent|libra', ['mage', 'barbarian', 'dark-mage', 'priest']],
      ['laurent|henry', ['mage', 'barbarian', 'dark-mage', 'thief']],
    ],
  },
  {
    id: 'C-lucina',
    label: 'Class sets: Lucina',
    rows: [
      ['lucina|robin:str/mag', [...ALL_F, 'lord']],
      ['lucina|sumia', ['lord', 'cavalier', 'archer', 'pegasus-knight', 'knight', 'priest']],
      ['lucina|maribelle', ['lord', 'cavalier', 'archer', 'troubadour', 'pegasus-knight', 'mage']],
      ['lucina|sully', ['lord', 'cavalier', 'archer', 'myrmidon', 'wyvern-rider']],
      ['lucina|olivia', ['lord', 'cavalier', 'archer', 'myrmidon', 'pegasus-knight']],
      ['lucina|maiden', ['lord', 'cavalier', 'archer']],
    ],
  },
  {
    id: 'C-nah',
    label: 'Class sets: Nah',
    rows: [
      ['nah|robin:str/mag', [...ALL_F, 'manakete']],
      ['nah|frederick', ['manakete', 'wyvern-rider', 'mage', 'cavalier', 'knight']],
      ['nah|virion', ['manakete', 'wyvern-rider', 'mage', 'archer']],
      ['nah|stahl', ['manakete', 'wyvern-rider', 'mage', 'cavalier', 'myrmidon', 'archer']],
      ['nah|vaike', ['manakete', 'wyvern-rider', 'mage', 'knight', 'mercenary', 'thief']],
      ['nah|kellam', ['manakete', 'wyvern-rider', 'mage', 'knight', 'thief', 'priest']],
      ['nah|lonqu', ['manakete', 'wyvern-rider', 'mage', 'myrmidon', 'thief']],
      ['nah|ricken', ['manakete', 'wyvern-rider', 'mage', 'cavalier', 'archer']],
      ['nah|gaius', ['manakete', 'wyvern-rider', 'mage', 'myrmidon', 'thief', 'pegasus-knight']],
      ['nah|donnel', ['manakete', 'wyvern-rider', 'mage', 'mercenary', 'pegasus-knight', 'troubadour']],
      ['nah|gregor', ['manakete', 'wyvern-rider', 'mage', 'myrmidon', 'mercenary', 'troubadour']],
      ['nah|libra', ['manakete', 'wyvern-rider', 'mage', 'priest', 'dark-mage']],
      ['nah|henry', ['manakete', 'wyvern-rider', 'mage', 'thief', 'troubadour', 'dark-mage']],
    ],
  },
  {
    id: 'C-noire',
    label: 'Class sets: Noire',
    rows: [
      ['noire|robin:str/mag', [...ALL_F]],
      ['noire|frederick', ['archer', 'knight', 'dark-mage', 'cavalier', 'wyvern-rider']],
      ['noire|virion', ['archer', 'knight', 'dark-mage', 'wyvern-rider', 'mage']],
      ['noire|stahl', ['archer', 'knight', 'dark-mage', 'cavalier', 'myrmidon']],
      ['noire|vaike', ['archer', 'knight', 'dark-mage', 'mercenary', 'thief']],
      ['noire|kellam', ['archer', 'knight', 'dark-mage', 'thief', 'priest']],
      ['noire|lonqu', ['archer', 'knight', 'dark-mage', 'myrmidon', 'thief', 'wyvern-rider']],
      ['noire|ricken', ['archer', 'knight', 'dark-mage', 'cavalier', 'mage']],
      ['noire|gaius', ['archer', 'knight', 'dark-mage', 'myrmidon', 'thief', 'pegasus-knight']],
      ['noire|donnel', ['archer', 'knight', 'dark-mage', 'mercenary', 'pegasus-knight', 'troubadour']],
      ['noire|gregor', ['archer', 'knight', 'dark-mage', 'myrmidon', 'mercenary', 'troubadour']],
      ['noire|libra', ['archer', 'knight', 'dark-mage', 'priest', 'mage']],
      ['noire|henry', ['archer', 'knight', 'dark-mage', 'thief', 'troubadour']],
    ],
  },
  {
    id: 'C-owain',
    label: 'Class sets: Owain',
    rows: [
      ['owain|robin:str/mag', [...ALL_M]],
      ['owain|frederick', ['myrmidon', 'priest', 'barbarian', 'cavalier', 'knight', 'wyvern-rider']],
      ['owain|virion', ['myrmidon', 'priest', 'barbarian', 'archer', 'wyvern-rider', 'mage']],
      ['owain|stahl', ['myrmidon', 'priest', 'barbarian', 'cavalier', 'archer']],
      ['owain|vaike', ['myrmidon', 'priest', 'barbarian', 'fighter', 'thief']],
      ['owain|kellam', ['myrmidon', 'priest', 'barbarian', 'knight', 'thief']],
      ['owain|lonqu', ['myrmidon', 'priest', 'barbarian', 'thief', 'wyvern-rider']],
      ['owain|ricken', ['myrmidon', 'priest', 'barbarian', 'cavalier', 'archer', 'mage']],
      ['owain|gaius', ['myrmidon', 'priest', 'barbarian', 'fighter', 'thief']],
      ['owain|donnel', ['myrmidon', 'priest', 'barbarian', 'mercenary', 'fighter', 'villager']],
      ['owain|gregor', ['myrmidon', 'priest', 'barbarian', 'mercenary']],
      ['owain|libra', ['myrmidon', 'priest', 'barbarian', 'mage', 'dark-mage']],
      ['owain|henry', ['myrmidon', 'priest', 'barbarian', 'thief', 'dark-mage']],
    ],
  },
  {
    id: 'C-severa',
    label: 'Class sets: Severa',
    rows: [
      ['severa|robin:str/mag', [...ALL_F]],
      ['severa|frederick', ['mercenary', 'pegasus-knight', 'dark-mage', 'cavalier', 'knight', 'wyvern-rider']],
      ['severa|virion', ['mercenary', 'pegasus-knight', 'dark-mage', 'archer', 'wyvern-rider', 'mage']],
      ['severa|stahl', ['mercenary', 'pegasus-knight', 'dark-mage', 'cavalier', 'myrmidon', 'archer']],
      ['severa|vaike', ['mercenary', 'pegasus-knight', 'dark-mage', 'knight', 'thief']],
      ['severa|kellam', ['mercenary', 'pegasus-knight', 'dark-mage', 'knight', 'thief', 'priest']],
      ['severa|lonqu', ['mercenary', 'pegasus-knight', 'dark-mage', 'myrmidon', 'thief', 'wyvern-rider']],
      ['severa|ricken', ['mercenary', 'pegasus-knight', 'dark-mage', 'cavalier', 'archer', 'mage']],
      ['severa|gaius', ['mercenary', 'pegasus-knight', 'dark-mage', 'myrmidon', 'thief']],
      ['severa|donnel', ['mercenary', 'pegasus-knight', 'dark-mage', 'troubadour']],
      ['severa|gregor', ['mercenary', 'pegasus-knight', 'dark-mage', 'myrmidon', 'troubadour']],
      ['severa|libra', ['mercenary', 'pegasus-knight', 'dark-mage', 'priest', 'mage']],
      ['severa|henry', ['mercenary', 'pegasus-knight', 'dark-mage', 'thief', 'troubadour']],
    ],
  },
  {
    id: 'C-yarne',
    label: 'Class sets: Yarne',
    rows: [
      ['yarne|robin:str/mag', [...ALL_M, 'taguel']],
      ['yarne|frederick', ['taguel', 'thief', 'barbarian', 'cavalier', 'knight', 'wyvern-rider']],
      ['yarne|virion', ['taguel', 'thief', 'barbarian', 'archer', 'wyvern-rider', 'mage']],
      ['yarne|stahl', ['taguel', 'thief', 'barbarian', 'cavalier', 'myrmidon', 'archer']],
      ['yarne|vaike', ['taguel', 'thief', 'barbarian', 'fighter']],
      ['yarne|kellam', ['taguel', 'thief', 'barbarian', 'knight', 'priest']],
      ['yarne|lonqu', ['taguel', 'thief', 'barbarian', 'myrmidon', 'wyvern-rider']],
      ['yarne|ricken', ['taguel', 'thief', 'barbarian', 'cavalier', 'archer', 'mage']],
      ['yarne|gaius', ['taguel', 'thief', 'barbarian', 'myrmidon', 'fighter']],
      ['yarne|donnel', ['taguel', 'thief', 'barbarian', 'fighter', 'mercenary', 'villager']],
      ['yarne|gregor', ['taguel', 'thief', 'barbarian', 'myrmidon', 'mercenary']],
      ['yarne|libra', ['taguel', 'thief', 'barbarian', 'priest', 'mage', 'dark-mage']],
      ['yarne|henry', ['taguel', 'thief', 'barbarian', 'dark-mage']],
    ],
  },
  {
    // Morgan (F): all regular female classes; the mother adds Taguel (Panne) or Manakete (Nowi, Tiki, Nah),
    // and no other mother adds anything, including Lucina, Olivia and Aversa (research Appendix B, Morgan).
    id: 'C-morgan-f',
    label: 'Class sets: Morgan (F)',
    rows: [
      ['morgan-f|robin:str/mag|panne', [...ALL_F, 'taguel']],
      ['morgan-f|robin:str/mag|nowi', [...ALL_F, 'manakete']],
      ['morgan-f|robin:str/mag|tiki', [...ALL_F, 'manakete']],
      ['morgan-f|robin:str/mag|nah<gaius', [...ALL_F, 'manakete']],
      ['morgan-f|robin:str/mag|olivia', ALL_F],
      ['morgan-f|robin:str/mag|aversa', ALL_F],
      ['morgan-f|robin:str/mag|lucina<olivia', ALL_F],
      ['morgan-f|robin:str/mag|kjelle<donnel', ALL_F],
    ],
  },
  {
    // Morgan (M): all regular male classes; the father adds Villager (Donnel or Donnel's son) or Taguel (Yarne);
    // no other father adds anything, including Chrom and Walhart.
    id: 'C-morgan-m',
    label: 'Class sets: Morgan (M)',
    rows: [
      ['morgan-m|robin:str/mag|donnel', [...ALL_M, 'villager']],
      ['morgan-m|robin:str/mag|owain<donnel', [...ALL_M, 'villager']],
      ['morgan-m|robin:str/mag|yarne<frederick', [...ALL_M, 'taguel']],
      ['morgan-m|robin:str/mag|chrom', ALL_M],
      ['morgan-m|robin:str/mag|walhart', ALL_M],
      ['morgan-m|robin:str/mag|inigo<chrom', ALL_M],
    ],
  },
];
