/**
 * First-generation S-support (marriage) graph, not counting Robin.
 *
 * Sources: FEW https://fireemblemwiki.org/wiki/List_of_supports_in_Fire_Emblem_Awakening?oldid=747916 ("Romantic supports"),
 * cross-checked against SF https://serenesforest.net/awakening/characters/supports/ (research/marriage-and-classes, #3).
 *
 * Robin's partners, Robin-only units (Say'ri, Flavia, Anna, Tiki, Emmeryn, Aversa, Basilio, Gangrel,
 * Walhart, Yen'fay, Priam) and child units' marriages are not first-gen × first-gen edges, so
 * they are not listed here.
 */
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
