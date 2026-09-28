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

/** Points of chance, as a worth, a stake or a ± reads: 0.015 → "1.5". */
export function pointsText(p: number): string {
  return (p * 100).toFixed(1);
}

export function chanceText(p: number, words: ChanceWords = DEFAULT_WORDS): string {
  if (p >= 1) return '100%';
  if (p <= 0) return '0%';
  if (p > 0.999) return 'over 99.9%';
  if (p < 0.001) return 'under 0.1%';
  const pct = `${pointsText(p)}%`;
  if (p >= 0.9) return `${pct} (${words.miss} about 1 run in ${runs(1 - p)})`;
  if (p <= 0.1) return `${pct} (${words.make} about 1 run in ${runs(p)})`;
  return pct;
}

/**
 * One map's no-death chance: worded like any chance, but "flawless" is the whole plan's word, so a map's runs that make
 * it read "no deaths about 1 run in 29".
 */
export function noDeathText(p: number): string {
  return chanceText(p, { miss: DEFAULT_WORDS.miss, make: 'no deaths' });
}

/**
 * A fight's kill chance (#210; spec #175, The Why panel's wording): percent with "1 run in N" always added ("12.1%
 * (kills someone about 1 run in 8)"), capped like any chance.
 */
export function killText(p: number): string {
  if (p >= 1) return '100%';
  if (p <= 0) return '0%';
  if (p > 0.999) return 'over 99.9%';
  if (p < 0.001) return 'under 0.1%';
  return `${pointsText(p)}% (kills someone about 1 run in ${runs(p)})`;
}

/**
 * A stress-test range (#211; spec #175, The Why panel): the chance under a stated blind spot's bad case beside the
 * headline's, "as low as 31.8% if two attackers reach each exposed pair". Undefined unless the bad case takes the chance
 * lower by 0.05 points or more: the range is how low it could go (a bad case the plan does as well or better under
 * isn't one).
 */
export function stressText(chance: number, stressed: number, bad: string): string | undefined {
  return chance - stressed < 0.0005 ? undefined : `as low as ${chanceText(stressed)} if ${bad}`;
}

/** Points of chance with a sign, as a difference reads: −0.002 → "−0.2", 0.012 → "+1.2" (a minus sign, not a hyphen). */
export function signedPoints(d: number): string {
  const s = pointsText(Math.abs(d));
  return s === '0.0' ? s : `${d < 0 ? '−' : '+'}${s}`;
}

/** A simulation or paired error (95%) as it reads beside its number: 0.008 → "±0.8"; "±?" when it isn't known. */
export function marginText(m: number): string {
  return `±${Number.isFinite(m) ? pointsText(m) : '?'}`;
}

/** A chance with its simulation error: "42.0% ±5.0". */
export function chanceWithMargin(c: { readonly chance: number; readonly margin: number }): string {
  return `${chanceText(c.chance)} ${marginText(c.margin)}`;
}

/**
 * A threat's chance on the preparation page (a group's chance of killing someone): plain percent, floored at
 * "under 0.1%", with no "1 run in N" (the threats list reads them side by side).
 */
export function riskText(p: number): string {
  return p <= 0 ? '0%' : p < 0.001 ? 'under 0.1%' : `${pointsText(p)}%`;
}

/**
 * How a paired difference in flawless chance reads (#199; spec #175, The Why panel's wording): an edit's gain and its
 * paired error (±, 95%), in points of chance. A close call (still unclear at the run cap) reads "no measurable
 * difference (−0.2 ±0.3)"; otherwise "+1.2 ±0.3". With `turns` (the other plan's expected turns less this one's), a
 * difference of a tenth of a turn or more is added: "no measurable difference (−0.2 ±0.3); 2 fewer turns" (spec: ties
 * go to fewer expected turns).
 */
export function differenceText(gain: number, margin: number, close = false, turns?: number): string {
  const pm = marginText(margin);
  const text = close ? `no measurable difference (${signedPoints(gain)} ${pm})` : `${signedPoints(gain)} ${pm}`;
  const t = turns === undefined ? 0 : Math.round(Math.abs(turns) * 10) / 10;
  return t ? `${text}; ${t} ${turns! < 0 ? 'fewer' : 'more'} turn${t === 1 ? '' : 's'}` : text;
}
