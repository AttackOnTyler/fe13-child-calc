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
