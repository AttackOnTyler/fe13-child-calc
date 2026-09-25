/**
 * Source disagreements that were resolved (research/data-sources §7, #5; research/data-disagreements, #13).
 * The game-data records carry an inline comment on each resolved value; this list is what the validation panel shows.
 * Disagreements still unresolved are assumptions instead (engine/assumptions.ts).
 */
import {
  FEW_CLASS_LIST,
  FEW_CLASS_MODULE,
  FANDOM_AVERSA,
  FANDOM_OLIVIA,
  FEW_AVERSA,
  FEW_FLAVIA,
  FEW_OLIVIA,
  FEW_PARALOGUE_22,
  FEW_GROWTH_MODULE,
  FEW_KJELLE_STATS,
  FEW_LORD,
  FEW_LUCINA_STATS,
  FEW_THIEF,
  FEW_WALHART,
  JP_CAPS,
  JP_CLASSES,
  JP_PK,
  SF_BASES,
  SF_CHILDREN,
  SF_CLASS_BASES,
  SF_CLASS_CAPS,
  SF_GROWTHS,
  SF_GROWTH_JS,
  SF_MAX_JS,
  SF_MODIFIERS,
  type Citation,
} from './citations';

export type SourcedValue = { readonly value: string; readonly sources: readonly Citation[] };

export type ResolvedDisagreement = {
  readonly id: string;
  readonly item: string;
  readonly winning: SourcedValue;
  readonly losing: readonly SourcedValue[];
  readonly why: string;
};

export const RESOLVED_DISAGREEMENTS: readonly ResolvedDisagreement[] = [
  {
    id: 'D1a',
    item: 'Walhart personal Skl/Spd growth',
    winning: { value: '30/30', sources: [SF_GROWTHS, SF_GROWTH_JS, FEW_GROWTH_MODULE] },
    losing: [{ value: '25/25', sources: [FEW_WALHART] }],
    why: 'The FEW page’s 25 looks back-derived from a Conqueror total of 45 with a class growth of 20.',
  },
  {
    id: 'D2',
    item: 'Flavia Skl cap modifier',
    winning: { value: '+2', sources: [SF_MODIFIERS, SF_MAX_JS, JP_CAPS] },
    losing: [{ value: '+1', sources: [FEW_FLAVIA] }],
    why: 'The independent JP table’s row total implies +2; SF’s “Hero Skl 47” was only static fallback HTML.',
  },
  {
    id: 'D3',
    item: 'Lucina (mother Maribelle) Lck cap modifier',
    winning: { value: '+5', sources: [SF_MODIFIERS, SF_MAX_JS, FEW_LUCINA_STATS] },
    losing: [{ value: '+3', sources: [SF_CHILDREN] }],
    why: 'Chrom +1 + Maribelle +3 + 1 = +5 by SF’s own formula; the SF per-child page has a typo. Guarded by fixture F2.',
  },
  {
    id: 'D4',
    item: 'Kjelle (father Kellam / Lon’qu) Res cap modifier',
    winning: { value: 'Kellam +1, Lon’qu −1', sources: [SF_CHILDREN, SF_MODIFIERS, SF_MAX_JS] },
    losing: [{ value: 'Kellam −1, Lon’qu +1', sources: [FEW_KJELLE_STATS] }],
    why: 'Sully 0 + Kellam 0 + 1 = +1 and Sully 0 + Lon’qu −2 + 1 = −1; the FEW per-pair page swaps them.',
  },
  {
    id: 'D5',
    item: 'Lord (M) class caps Str/Skl/Spd/Def',
    winning: { value: '27/25/26/26 (Lord M) and 25/26/28/25 (Lord F)', sources: [FEW_LORD, FEW_CLASS_LIST, JP_PK] },
    losing: [{ value: 'One Lord row, 25/26/28/25, for both', sources: [SF_CLASS_CAPS] }],
    why: 'SF’s single row is Lucina’s Lord (F); a JP table has FEW’s Lord (M) values, so Lord M/F are modelled separately.',
  },
  {
    id: 'D6',
    item: 'Thief Skl class cap',
    winning: { value: '30', sources: [SF_CLASS_CAPS, FEW_THIEF] },
    losing: [{ value: '29', sources: [FEW_CLASS_LIST, JP_CAPS, JP_PK] }],
    why: 'The JP table’s cell says 29, but its own row total (171) needs 30; other JP wikis copied the cell.',
  },
  {
    id: 'D7-dread-fighter',
    item: 'Dread Fighter base Skl',
    winning: { value: '7', sources: [SF_CLASS_BASES] },
    losing: [{ value: '8', sources: [FEW_CLASS_LIST] }],
    why: 'FEW’s Dread Fighter page and every other table agree with SF.',
  },
  {
    id: 'D7-conqueror',
    item: 'Conqueror base Mag',
    winning: { value: '3', sources: [SF_CLASS_BASES, FEW_CLASS_MODULE] },
    losing: [{ value: '2', sources: [FEW_CLASS_LIST] }],
    why: 'FEW’s module and Conqueror page agree with SF.',
  },
  {
    id: 'D7-taguel',
    item: 'Taguel (M) base stats',
    winning: { value: '18/2/0/4/5/0/3/2 (same as F)', sources: [SF_CLASS_BASES, JP_CLASSES] },
    losing: [{ value: '18/3/0/4/4/4/1', sources: [FEW_CLASS_LIST] }],
    why: 'The JP table has one Taguel row relative to Tactician, matching SF.',
  },
  {
    id: 'D7-lord',
    item: 'Lord (M) base Spd',
    winning: { value: '7', sources: [SF_CLASS_BASES, FEW_CLASS_LIST] },
    losing: [{ value: '6', sources: [FEW_CLASS_MODULE] }],
    why: 'Majority reading; no independent source.',
  },
  {
    id: 'D7-great-lord',
    item: 'Great Lord (F) base Def/Res/Mov',
    winning: { value: '8/4/6', sources: [SF_CLASS_BASES, JP_CLASSES] },
    losing: [{ value: '6/1/5', sources: [FEW_CLASS_MODULE] }],
    why: 'The JP table relative to Grandmaster gives 8/4/6.',
  },
  {
    id: 'D7-mercenary',
    item: 'Mercenary base HP',
    winning: { value: '18', sources: [SF_CLASS_BASES, JP_CLASSES] },
    losing: [{ value: '16', sources: [FEW_CLASS_MODULE] }],
    why: 'The JP table relative to Tactician gives 18.',
  },
  {
    id: 'maiden-modifiers',
    item: 'Maiden cap modifiers',
    winning: { value: 'All 0 (Lucina + Maiden = Chrom + 1)', sources: [JP_CAPS, FEW_LUCINA_STATS, SF_MAX_JS] },
    losing: [{ value: '−1 in every stat (early guess)', sources: [JP_CAPS] }],
    why: 'A player report of Maiden-mother Lucina at 2/1/2/2/2/0/0 corrected the JP wiki’s earlier guess.',
  },
  {
    id: 'U1',
    item: 'Olivia base Skl',
    winning: { value: '8', sources: [SF_BASES, FANDOM_OLIVIA] },
    losing: [{ value: '9', sources: [FEW_OLIVIA] }],
    why: 'SF with Fandom; weak, as Fandom usually copies SF. Low impact: a Lv 1 base (research/unit-page-data, #79).',
  },
  {
    id: 'U2',
    item: 'Aversa (playable) Normal Res, Lunatic Skl',
    winning: { value: 'Res 28, Skl 36', sources: [SF_BASES, FANDOM_AVERSA, FEW_PARALOGUE_22] },
    losing: [{ value: 'Res 26, Skl 34', sources: [FEW_AVERSA] }],
    why: 'FEW’s own Paralogue 22 NPC row gives Res 28, and the unit is recruited from that NPC (research/unit-page-data, #79).',
  },
];
