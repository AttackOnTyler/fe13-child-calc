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
 * Chrom marries the Maiden if he has no S-support by the end of Chapter 11 (FEW Inheritance).
 * She is a possible mother for Lucina but not an S-support partner.
 */
export const CHROM_FALLBACK_PARTNER = 'maiden' satisfies UnitId;

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
