/**
 * Learned EXP corrections and calibration (#196; spec #175, The EXP forecast). Each recorded map end re-anchors the
 * forecast (the runs start from the latest entry) and teaches it:
 *
 * - a **learned correction** per unit: the EXP it really earned on each recorded map against the forecast kept on the
 *   entry (`RunEntry.forecast`, #206), taken back to the uncorrected forecast (the factor it was forecast under comes
 *   out), pooled over the log, shrunk toward ×1 by one map's worth of forecast (so one lucky map can't swing it far) and
 *   clamped to ×0.5–×2. The runs multiply each unit's EXP by it on every map after the last recorded one
 *   (`RunSimInput.expFactor`). It's a stated assumption the player can switch off to compare (`Run.corrections.off`);
 * - **calibration**: each recorded result's percentile in its forecast's spread (`Run.calibration`), the share inside
 *   the 10th–90th percentile (about 80% when the forecast is honest) and the mean percentile (about 50% when it's
 *   unbiased), with the fall log's falls against the no-death forecast (#208).
 *
 * Both are pure functions of the chapter log (`learnCorrections`, `calibrationLog`), relearned whole whenever needed
 * (`withLearned`: a map recorded or removed, a rule changed).
 */
import { tierOfClass } from './exp';
import { falls } from './losses';
import type { RosterUnit } from './roster';
import { CORRECTION_RANGE, type CalibrationRow, type EntryForecast, type Run } from './run';
import { levelCap } from './sim/run-sim';

/** One unit's learned correction, and the evidence behind it: the maps it was learned from, EXP earned and forecast (uncorrected). */
export type UnitCorrection = {
  readonly unit: RosterUnit;
  readonly factor: number;
  readonly maps: number;
  readonly earned: number;
  readonly forecast: number;
};

/** One recorded result against its forecast: the unit, the forecast row, its level at the map's end (EXP as the fraction), the EXP earned. */
type Result = { readonly entry: string; readonly unit: RosterUnit; readonly row: EntryForecast['exp'][number]; readonly level: number; readonly earned: number | undefined };

/**
 * Every recorded result the log can read against a forecast: each entry whose forecast was for the map it records, each
 * unit the forecast fielded there that's on the entry. A unit that fell or died on the map is left out (its EXP stopped
 * there; the fall log counts it). `earned` is undefined across a class change or with no entry before.
 */
function results(run: Run): Result[] {
  return run.entries.flatMap((e, i): Result[] => {
    const f = e.forecast;
    if (!f || f.map !== e.map) return [];
    const prev = run.entries[i - 1]?.snapshot;
    const out = new Set<RosterUnit>(e.fell ?? []);
    for (const [u, s] of Object.entries(e.snapshot.states) as [RosterUnit, string][]) if (s === 'dead' && prev?.states[u] !== 'dead') out.add(u);
    return f.exp.flatMap((row): Result[] => {
      const u = e.snapshot.units[row.unit];
      if (!u || out.has(row.unit)) return [];
      const was = prev?.units[row.unit];
      const earned = was && was.class === u.class && u.level >= was.level ? (u.level - was.level) * 100 + u.exp - was.exp : undefined;
      return [{ entry: e.id, unit: row.unit, row, level: u.level + u.exp / 100, earned }];
    });
  });
}

const atCap = (r: Result, run: Run) => {
  const e = run.entries.find((x) => x.id === r.entry)!;
  const tier = tierOfClass(e.snapshot.units[r.unit]!.class);
  return tier !== undefined && Math.floor(r.level) >= levelCap(tier);
};

/**
 * Each unit's learned correction from the whole log (see the module comment), in the order first recorded. A result at
 * the level cap is left out (EXP past it is lost, so it reads short).
 */
export function learnCorrections(run: Run): UnitCorrection[] {
  const sums = new Map<RosterUnit, { earned: number; forecast: number; maps: number }>();
  for (const r of results(run)) {
    if (r.earned === undefined || atCap(r, run)) continue;
    const s = sums.get(r.unit) ?? { earned: 0, forecast: 0, maps: 0 };
    sums.set(r.unit, { earned: s.earned + r.earned, forecast: s.forecast + r.row.exp / (r.row.factor ?? 1), maps: s.maps + 1 });
  }
  return [...sums].flatMap(([unit, s]): UnitCorrection[] => {
    if (s.forecast <= 0) return [];
    const prior = s.forecast / s.maps;
    const factor = Math.min(CORRECTION_RANGE.max, Math.max(CORRECTION_RANGE.min, (s.earned + prior) / (s.forecast + prior)));
    return [{ unit, factor: round(factor), maps: s.maps, earned: Math.round(s.earned), forecast: Math.round(s.forecast) }];
  });
}

const round = (x: number) => Math.round(x * 100) / 100;

/**
 * Where a recorded level falls in a forecast's spread, 0–1: the 10th percentile at its low, the median at its median,
 * the 90th at its high, straight between; past either end the same slope runs out to 0 or 1. A spread of one level
 * reads 0.5 there.
 */
export function forecastPercentile(level: number, spread: { readonly low: number; readonly median: number; readonly high: number }): number {
  const { low, median, high } = spread;
  // A spread with no width on a side slopes over a tenth of a level (10 EXP).
  const below = Math.max(median - low, 0.1);
  const above = Math.max(high - median, 0.1);
  let p: number;
  if (level === median) p = 0.5;
  else if (level < median) p = level >= low && median > low ? 0.1 + (0.4 * (level - low)) / (median - low) : 0.1 - (0.1 * (Math.min(low, median) - level)) / below;
  else p = level <= high && high > median ? 0.5 + (0.4 * (level - median)) / (high - median) : 0.9 + (0.1 * (level - Math.max(high, median))) / above;
  return round(Math.min(1, Math.max(0, p)));
}

/** Each recorded result's percentile in its forecast (see the module comment), in log order. */
export function calibrationLog(run: Run): CalibrationRow[] {
  return results(run).map((r) => ({ entry: r.entry, unit: r.unit, percentile: forecastPercentile(r.level, r.row.level) }));
}

/** The run with its corrections and calibration relearned from the whole log; whether corrections are off is kept. */
export function withLearned(run: Run): Run {
  const units = Object.fromEntries(learnCorrections(run).map((c) => [c.unit, c.factor]));
  const off = run.corrections?.off;
  const cal = calibrationLog(run);
  const { corrections: _c, calibration: _k, ...rest } = run;
  return {
    ...rest,
    ...(Object.keys(units).length || off ? { corrections: { units, ...(off ? { off } : {}) } } : {}),
    ...(cal.length ? { calibration: cal } : {}),
  };
}

/** The run with its learned corrections switched off (the uncorrected forecast) or back on. */
export function withCorrectionsOff(run: Run, off: boolean): Run {
  const units = run.corrections?.units ?? {};
  const { corrections: _, ...rest } = run;
  return Object.keys(units).length || off ? { ...rest, corrections: { units, ...(off ? { off: true as const } : {}) } } : rest;
}

/** The EXP factors the runs apply (`RunSimInput.expFactor`): the learned corrections, none when switched off. */
export function expFactors(run: Run): Readonly<Partial<Record<RosterUnit, number>>> {
  const c = run.corrections;
  if (!c || c.off) return {};
  return Object.fromEntries(Object.entries(c.units).filter(([, f]) => f !== 1));
}

/** The calibration line: recorded results, how many inside p10–p90, their mean percentile, and the falls against the no-death forecast. */
export type Calibration = {
  readonly results: number;
  readonly inside: number;
  /** 0–1; undefined with no result. */
  readonly meanPercentile: number | undefined;
  /** Maps recorded with a no-death forecast, the falls (or deaths) it expected over them, and the maps with one. */
  readonly falls: { readonly maps: number; readonly expected: number; readonly observed: number };
};

/** The calibration line (see the module comment), from the calibration log kept on the run. */
export function calibration(run: Run): Calibration {
  const rows = run.calibration ?? [];
  const f = falls(run);
  return {
    results: rows.length,
    inside: rows.filter((r) => r.percentile >= 0.1 && r.percentile <= 0.9).length,
    meanPercentile: rows.length ? round(rows.reduce((a, r) => a + r.percentile, 0) / rows.length) : undefined,
    falls: { maps: f.forecast, expected: f.expected, observed: f.observed },
  };
}
