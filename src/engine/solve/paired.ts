/**
 * The paired comparison of two plans on the same runs (#199; spec #175, The joint solve and Noise): each run's flawless
 * chance under one plan against the same run (same seed, same rolls) under the other, so the difference's error is the
 * spread of the per-run differences, far smaller than either chance's own.
 *
 * An edit is kept when its gain is more than twice the paired standard error; it's dropped when its loss is; otherwise
 * it's unclear, and more runs are needed (runs double up to a cap). Still unclear at the cap, it's a close call: "no
 * measurable difference". The ± shown is the 95% margin (1.96 standard errors), as on the headline.
 */
export type Paired = {
  /** The mean per-run difference, second plan less first. */
  readonly gain: number;
  /** Its standard error; infinite on fewer than 2 runs. */
  readonly se: number;
  /** Its simulation error (±, 95%). */
  readonly margin: number;
  /** The runs compared. */
  readonly runs: number;
};

export type Verdict = 'better' | 'worse' | 'unclear';

/** The second plan's samples against the first's, on the runs both have. */
export function paired(before: readonly number[], after: readonly number[]): Paired {
  const n = Math.min(before.length, after.length);
  if (n === 0) return { gain: 0, se: Infinity, margin: Infinity, runs: 0 };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += after[i]! - before[i]!;
  const gain = sum / n;
  if (n < 2) return { gain, se: Infinity, margin: Infinity, runs: n };
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (after[i]! - before[i]! - gain) ** 2;
  const se = Math.sqrt(ss / (n - 1) / n);
  return { gain, se, margin: 1.96 * se, runs: n };
}

/** Kept when the gain beats twice the paired standard error, dropped when the loss does; otherwise unclear. */
export function verdictOf(p: Paired): Verdict {
  if (p.gain > 2 * p.se) return 'better';
  if (p.gain < -2 * p.se) return 'worse';
  return 'unclear';
}

/**
 * Every run of every plan given reads 0% (#242): the flawless chance can't tell them apart (no difference, no error), so
 * they're compared on how far their runs get instead (`RunSim.clearedSamples`).
 */
export const allLost = (...plans: readonly (readonly number[])[]): boolean => plans.every((xs) => xs.length > 0 && xs.every((x) => x === 0));

/**
 * Every run of every plan given reads 100% (#242): the flawless chance can't tell them apart either, so they're compared
 * on fewer expected turns, the search's own tie (`RunSim.turnSamples`).
 */
export const allWon = (...plans: readonly (readonly number[])[]): boolean => plans.every((xs) => xs.length > 0 && xs.every((x) => x === 1));

/** A plan's chance on its samples, with its own error (±, 95%). */
export function scoreOf(samples: readonly number[]): { readonly chance: number; readonly margin: number } {
  const n = samples.length;
  if (!n) return { chance: 0, margin: Infinity };
  const chance = samples.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? samples.reduce((a, b) => a + (b - chance) ** 2, 0) / (n - 1) : Infinity;
  return { chance, margin: 1.96 * Math.sqrt(variance / n) };
}
