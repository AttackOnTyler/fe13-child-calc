/**
 * How a chance reads everywhere in the app (#181; spec #175, The Why panel's wording): percent, with "1 run in N" added
 * at 90% or more ("loses a unit about 1 run in 250") and at 10% or less ("flawless about 1 run in 250"), capped at
 * "over 99.9%" and "under 0.1%" so small risks are readable and not overstated. A certain 100% or 0% (nothing can go
 * wrong, or nothing can go right) reads as it is.
 */
export type ChanceWords = {
  /** What happens in the runs that miss, at 90% or more. */
  readonly miss: string;
  /** What happens in the runs that make it, at 10% or less. */
  readonly make: string;
};

const DEFAULT_WORDS: ChanceWords = { miss: 'loses a unit', make: 'flawless' };

const runs = (p: number) => Math.round(1 / p).toLocaleString('en-US');

export function chanceText(p: number, words: ChanceWords = DEFAULT_WORDS): string {
  if (p >= 1) return '100%';
  if (p <= 0) return '0%';
  if (p > 0.999) return 'over 99.9%';
  if (p < 0.001) return 'under 0.1%';
  const pct = `${(p * 100).toFixed(1)}%`;
  if (p >= 0.9) return `${pct} (${words.miss} about 1 run in ${runs(1 - p)})`;
  if (p <= 0.1) return `${pct} (${words.make} about 1 run in ${runs(p)})`;
  return pct;
}
