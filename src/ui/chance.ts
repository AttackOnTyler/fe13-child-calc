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

/** Points of chance with a sign, as a difference reads: −0.002 → "−0.2", 0.012 → "+1.2" (a minus sign, not a hyphen). */
const signedPoints = (d: number) => {
  const s = (Math.abs(d) * 100).toFixed(1);
  return s === '0.0' ? s : `${d < 0 ? '−' : '+'}${s}`;
};

/**
 * How a paired difference in flawless chance reads (#199; spec #175, The Why panel's wording): an edit's gain and its
 * paired error (±, 95%), in points of chance. A close call (still unclear at the run cap) reads "no measurable
 * difference (−0.2 ±0.3)"; otherwise "+1.2 ±0.3".
 */
export function differenceText(gain: number, margin: number, close = false): string {
  const pm = `±${Number.isFinite(margin) ? (margin * 100).toFixed(1) : '?'}`;
  return close ? `no measurable difference (${signedPoints(gain)} ${pm})` : `${signedPoints(gain)} ${pm}`;
}
