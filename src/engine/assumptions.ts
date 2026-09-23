import type { Growths } from '../game-data/stats';

/** Resolved assumptions (defaults plus any overrides), passed into the calculation so it stays pure. */
export type Assumptions = {
  /** The Maiden's personal growths, which no source publishes (#13). */
  readonly maidenGrowths: Growths;
};

export type AssumptionId = 'maiden-growths';

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  // No evidence she is 0; a placeholder so Lucina+Maiden still gets numbers (#13 option 2).
  maidenGrowths: { hp: 0, str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 },
};

/** A one-line explanation of each assumption, for ⚠ tooltips. */
export const ASSUMPTION_NOTES: Readonly<Record<AssumptionId, string>> = {
  'maiden-growths': 'The Maiden’s growths are unpublished; growths use a placeholder (default 0 in every stat)',
};
