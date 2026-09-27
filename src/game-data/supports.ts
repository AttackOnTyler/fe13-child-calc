/**
 * First-generation S-support (marriage) graph, not counting Robin.
 *
 * Sources: FEW https://fireemblemwiki.org/wiki/List_of_supports_in_Fire_Emblem_Awakening?oldid=747916 ("Romantic supports"),
 * cross-checked against SF https://serenesforest.net/awakening/characters/supports/ (research/marriage-and-classes, #3).
 *
 * Robin's partners, including the Robin-only units (Say'ri, Flavia, Anna, Tiki, Emmeryn, Aversa, Basilio,
 * Gangrel, Walhart, Yen'fay, Priam) and child units, are listed separately in `ROBIN_SUPPORTS`. Children
 * marrying each other produce no offspring, so those edges are not listed.
 */
import type { ChildId } from './children';
import type { Gender } from './stats';
import type { UnitId } from './units';

/** The twelve men who can S-support every "general" first-gen woman. */
const GENERAL_MEN = [
  'frederick', 'virion', 'vaike', 'stahl', 'kellam', 'lonqu',
  'ricken', 'gaius', 'gregor', 'libra', 'henry', 'donnel',
] as const satisfies readonly UnitId[];

/** Each first-gen woman's possible S-support partners, other than Robin (M). */
export const S_SUPPORTS: Readonly<Partial<Record<UnitId, readonly UnitId[]>>> = {
  // Chrom can't marry his sister.
  lissa: GENERAL_MEN,
  sully: ['chrom', ...GENERAL_MEN],
  maribelle: ['chrom', ...GENERAL_MEN],
  olivia: ['chrom', ...GENERAL_MEN],
  miriel: GENERAL_MEN,
  panne: GENERAL_MEN,
  cordelia: GENERAL_MEN,
  nowi: GENERAL_MEN,
  tharja: GENERAL_MEN,
  cherche: GENERAL_MEN,
  // Sumia's list is restricted.
  sumia: ['chrom', 'frederick', 'gaius', 'henry'],
};

/**
 * Chrom's forced marriage (#154; research/child-recruitment §3.3 and C7, research/support-growth §4.1). At the end of
 * Chapter 11 an unmarried Chrom marries the candidate (Sumia, Sully, Maribelle, Olivia, Robin (F)) he has the highest
 * support rank with, and gets an S. He marries the Maiden only if he has (almost) no support with any of them (under 1
 * point with each) or all of them are married. A candidate lost in Classic can still be picked.
 * Sources: FEW Inheritance https://fireemblemwiki.org/w/index.php?oldid=752340, SF Support Basics
 * https://serenesforest.net/awakening/characters/supports/support-basics/, JP-112 https://w.atwiki.jp/fireemblem3ds/pages/112.html
 * (and its mirror JP-89 https://w.atwiki.jp/kakuseife/pages/89.html).
 *
 * Two details are unsettled, and the app records ranks, not points, so it can't decide them:
 * - Olivia's threshold. SF Support Basics: Olivia if he has at least 2 points with her and no C with anyone else.
 *   JP-27 (https://w.atwiki.jp/fireemblem3ds/pages/27.html): she needs at least C.
 * - Ties. SF Support Basics: the fewest points to the next rank, then Sumia > Sully > Maribelle > Robin > Olivia.
 *   JP-89: probably Sumia > Maribelle > Sully > Olivia > Robin (F).
 *
 * The Maiden is a possible mother for Lucina but not an S-support partner.
 */
export const CHROM_FALLBACK_PARTNER = 'maiden' satisfies UnitId;

/** The map whose end marries an unmarried Chrom (see `CHROM_FALLBACK_PARTNER`). */
export const CHROM_WEDDING_MAP = 'chapter-11';

/** The first-gen women the game can marry Chrom to at the end of Chapter 11; Robin (F) is one too. */
export const CHROM_WEDDING_CANDIDATES = (Object.keys(S_SUPPORTS) as UnitId[]).filter((w) => S_SUPPORTS[w]!.includes('chrom'));

/**
 * Everyone Robin can S-support, by Robin's gender (research/marriage-and-classes, #3: FEW romantic supports,
 * SF supports page). This includes the Robin-only units and the opposite-gender children other than Morgan,
 * who is Robin's own child. A child here is a second-gen parent, and only ever produces Morgan.
 */
export const ROBIN_SUPPORTS = {
  // 23 partners.
  M: [
    'lissa', 'sully', 'miriel', 'sumia', 'maribelle', 'panne', 'cordelia', 'nowi', 'tharja', 'anna', 'olivia', 'cherche',
    'sayri', 'tiki', 'flavia', 'emmeryn', 'aversa',
    'lucina', 'kjelle', 'cynthia', 'severa', 'noire', 'nah',
  ],
  // 24 partners.
  F: [
    'chrom', 'frederick', 'virion', 'stahl', 'vaike', 'kellam', 'donnel', 'lonqu', 'ricken', 'gaius', 'gregor', 'libra', 'henry',
    'basilio', 'gangrel', 'walhart', 'yenfay', 'priam',
    'owain', 'inigo', 'brady', 'gerome', 'yarne', 'laurent',
  ],
} as const satisfies Readonly<Record<Gender, readonly (UnitId | ChildId)[]>>;

/**
 * How many points a pair needs for each rank: one of four curves per pair (#177). Totals, not gaps.
 *
 * Sources: SF https://serenesforest.net/awakening/characters/supports/support-growth/ (thresholds and every pair's
 * curve); the curve per pair is game data (Paragon `Data/FE13/Types/Person.yml` support_type, enum Non-romantic, Slow,
 * Medium, Fast). Pair by pair cross-checked against Fire Editor Awakening `database/units.xml` (@de3b9298c9): 316
 * pairs, 0 mismatches (research/support-growth §2, §8, #139).
 */
export type SupportCurve = 'slow' | 'medium' | 'fast' | 'non-romantic';

/** A curve's total points for C, B, A and (romantic only) S. */
export type SupportThresholds = { readonly C: number; readonly B: number; readonly A: number; readonly S?: number };

export const SUPPORT_CURVES: Readonly<Record<SupportCurve, SupportThresholds>> = {
  slow: { C: 4, B: 8, A: 13, S: 18 },
  medium: { C: 3, B: 7, A: 11, S: 16 },
  fast: { C: 2, B: 6, A: 10, S: 14 },
  'non-romantic': { C: 3, B: 8, A: 15 },
};

/**
 * Anyone with a support list. Robin's curve with a partner turns on Robin's gender (slow with the other gender,
 * non-romantic with the same), so each Robin is its own unit here.
 */
export type SupportUnit = UnitId | ChildId | 'robin-m' | 'robin-f';

type SupportPair = readonly [SupportUnit, SupportUnit];

/** The 17 fast pairs: one per first-gen woman (two for none), and six child pairs. */
const FAST_PAIRS: readonly SupportPair[] = [
  ['chrom', 'sumia'], ['lissa', 'vaike'], ['frederick', 'maribelle'], ['virion', 'cherche'], ['sully', 'kellam'],
  ['stahl', 'miriel'], ['ricken', 'panne'], ['gaius', 'tharja'], ['cordelia', 'libra'], ['gregor', 'nowi'], ['olivia', 'henry'],
  ['lucina', 'laurent'], ['owain', 'kjelle'], ['inigo', 'cynthia'], ['brady', 'severa'], ['gerome', 'nah'], ['yarne', 'noire'],
];

/** The 11 medium pairs, all first-gen: one per woman but Sumia (none) and Sully (two). */
const MEDIUM_PAIRS: readonly SupportPair[] = [
  ['chrom', 'sully'], ['chrom', 'maribelle'], ['lissa', 'frederick'], ['sully', 'stahl'], ['vaike', 'nowi'], ['miriel', 'kellam'],
  ['ricken', 'cherche'], ['panne', 'libra'], ['gaius', 'cordelia'], ['gregor', 'olivia'], ['tharja', 'henry'],
];

/** The 47 non-romantic (A at most) pairs without Robin. Robin's are everyone of Robin's own gender. */
const NON_ROMANTIC_PAIRS: readonly SupportPair[] = [
  ['chrom', 'lissa'], ['chrom', 'vaike'], ['chrom', 'gaius'], ['chrom', 'frederick'], ['lissa', 'maribelle'], ['frederick', 'henry'],
  ['frederick', 'virion'], ['virion', 'libra'], ['sully', 'miriel'], ['sully', 'sumia'], ['vaike', 'lonqu'], ['stahl', 'donnel'],
  ['stahl', 'kellam'], ['miriel', 'cherche'], ['kellam', 'donnel'], ['sumia', 'cordelia'], ['lonqu', 'gregor'], ['ricken', 'gregor'],
  ['ricken', 'henry'], ['maribelle', 'olivia'], ['panne', 'cordelia'], ['panne', 'olivia'], ['gaius', 'libra'], ['nowi', 'cherche'],
  ['nowi', 'tharja'], ['lucina', 'kjelle'], ['lucina', 'tiki'], ['lucina', 'cynthia'], ['sayri', 'tiki'], ['basilio', 'flavia'],
  ['anna', 'tiki'], ['owain', 'inigo'], ['owain', 'morgan-m'], ['owain', 'brady'], ['inigo', 'gerome'], ['inigo', 'brady'],
  ['brady', 'yarne'], ['kjelle', 'severa'], ['cynthia', 'nah'], ['cynthia', 'severa'], ['severa', 'noire'], ['gerome', 'laurent'],
  ['morgan-m', 'yarne'], ['morgan-f', 'noire'], ['morgan-f', 'nah'], ['yarne', 'laurent'], ['nah', 'tiki'],
];

/**
 * Children can S-support any child of the other gender but the other Morgan (only one exists per file): 48 pairs.
 * FEW List of supports (oldid 747916) romantic list; no child pair is medium.
 */
const CHILD_SONS = ['owain', 'inigo', 'brady', 'gerome', 'yarne', 'laurent', 'morgan-m'] as const satisfies readonly ChildId[];
const CHILD_DAUGHTERS = ['lucina', 'kjelle', 'cynthia', 'severa', 'noire', 'nah', 'morgan-f'] as const satisfies readonly ChildId[];

const pairKey = (a: SupportUnit, b: SupportUnit) => (a < b ? `${a}+${b}` : `${b}+${a}`);

/** Every pair that can support, with its curve: 194 slow, 11 medium, 17 fast, 94 non-romantic (316 pairs). */
export const SUPPORT_PAIRS: readonly { readonly a: SupportUnit; readonly b: SupportUnit; readonly curve: SupportCurve }[] = (() => {
  const special = new Map<string, SupportCurve>([
    ...FAST_PAIRS.map(([a, b]) => [pairKey(a, b), 'fast'] as const),
    ...MEDIUM_PAIRS.map(([a, b]) => [pairKey(a, b), 'medium'] as const),
  ]);
  const romantic: SupportPair[] = [
    ...Object.entries(S_SUPPORTS).flatMap(([w, men]) => men!.map((m): SupportPair => [w as UnitId, m])),
    ...CHILD_SONS.flatMap((s) => CHILD_DAUGHTERS.filter((d) => !(s === 'morgan-m' && d === 'morgan-f')).map((d): SupportPair => [s, d])),
    ...ROBIN_SUPPORTS.M.map((p): SupportPair => ['robin-m', p]),
    ...ROBIN_SUPPORTS.F.map((p): SupportPair => ['robin-f', p]),
  ];
  const platonic: SupportPair[] = [
    ...NON_ROMANTIC_PAIRS,
    // Robin supports everyone the other Robin can marry, platonically.
    ...ROBIN_SUPPORTS.F.map((p): SupportPair => ['robin-m', p]),
    ...ROBIN_SUPPORTS.M.map((p): SupportPair => ['robin-f', p]),
  ];
  return [
    ...romantic.map(([a, b]) => ({ a, b, curve: special.get(pairKey(a, b)) ?? ('slow' as const) })),
    ...platonic.map(([a, b]) => ({ a, b, curve: 'non-romantic' as const })),
  ];
})();

const CURVE_BY_PAIR: ReadonlyMap<string, SupportCurve> = new Map(SUPPORT_PAIRS.map((p) => [pairKey(p.a, p.b), p.curve]));

/** A pair's curve, either way round; undefined when the two can't support. */
export function supportCurveOf(a: SupportUnit, b: SupportUnit): SupportCurve | undefined {
  return CURVE_BY_PAIR.get(pairKey(a, b));
}
