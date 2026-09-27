import { describe, expect, it } from 'vitest';
import {
  CORRECTION_RANGE,
  EMPTY_ROSTER,
  addEntry,
  calibration,
  calibrationLog,
  createEngine,
  editEntry,
  expFactors,
  exportRun,
  forecastBefore,
  forecastPercentile,
  importRun,
  latestEntry,
  learnCorrections,
  recordFallen,
  runFromRoster,
  whatChanged,
  withCorrectionsOff,
  withEntryForecast,
  withLearned,
  withRun,
  type EntryForecast,
  type FlawlessChance,
  type Run,
  type UnitSnapshot,
} from './index';

/**
 * Learned EXP corrections and calibration (#196; spec #175, The EXP forecast): each recorded map end teaches each unit
 * the forecast fielded there an EXP factor against the forecast kept on its entry, and places its result in the
 * forecast's spread. Hand-built chapter logs: each map's forecast is written on its entry as Record results keeps it.
 */
const engine = createEngine();
const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp', mode: 'casual' });
const maps = engine.mapOrder(runFromRoster(facts)).steps.map((s) => s.map);
const lord: UnitSnapshot = { class: 'Lord', level: 5, promoted: false, reclassed: false, exp: 0, stats: null, skills: [], supports: [], inventory: [] };

/** A forecast for one map: each unit's mean EXP and its level spread there (with the factor it was forecast under). */
const forecast = (map: string, exp: EntryForecast['exp']): EntryForecast => ({ chance: 0.5, margin: 0.05, key: map, map, noDeath: 0.9, exp, readings: [] });
const row = (exp: number, low: number, median: number, high: number, factor?: number) => ({ unit: 'chrom' as const, exp, level: { low, median, high }, ...(factor ? { factor } : {}) });

/** The run with a map recorded: its forecast kept on the entry, Chrom at `level` (`exp` as the fraction) after it. */
function record(run: Run, map: string, f: EntryForecast | undefined, level: number, exp: number): Run {
  const added = addEntry(run, map, run.entries.length + 1);
  const id = latestEntry(added)!.id;
  const kept = f ? withEntryForecast(added, id, f) : added;
  return editEntry(kept, id, (s) => ({ ...s, units: { ...s.units, chrom: { ...lord, level, exp } } }), 1);
}

// Chrom starts at Lv 5 after the Prologue.
const start = record(runFromRoster(facts), maps[0]!, undefined, 5, 0);

describe('the learned correction (#196)', () => {
  it('gives a unit that gained more EXP than forecast a factor above ×1, shrunk toward ×1 by one map’s evidence', () => {
    // Forecast 100 EXP on Chapter 1; he gained 200 (Lv 5 → 7): (200 + 100) / (100 + 100) = ×1.5, not ×2.
    const run = record(start, maps[1]!, forecast(maps[1]!, [row(100, 5.6, 6.0, 6.4)]), 7, 0);
    expect(learnCorrections(run)).toEqual([{ unit: 'chrom', factor: 1.5, maps: 1, earned: 200, forecast: 100 }]);
    // Less than forecast: below ×1.
    const slow = record(start, maps[1]!, forecast(maps[1]!, [row(100, 5.6, 6.0, 6.4)]), 5, 50);
    expect(learnCorrections(slow)[0]!.factor).toBeCloseTo(0.75);
  });

  it('learns against the uncorrected forecast: the factor each map was forecast under is taken out', () => {
    // Forecast 150 under ×1.5 (100 uncorrected), gained 200: the same ×1.5 as above.
    const run = record(start, maps[1]!, forecast(maps[1]!, [row(150, 6.0, 6.5, 7.0, 1.5)]), 7, 0);
    expect(learnCorrections(run)[0]).toMatchObject({ factor: 1.5, forecast: 100 });
  });

  it('pools every recorded map, and clamps to ×0.5–×2', () => {
    let run = record(start, maps[1]!, forecast(maps[1]!, [row(10, 5.0, 5.1, 5.2)]), 7, 0);
    run = record(run, maps[2]!, forecast(maps[2]!, [row(10, 7.0, 7.1, 7.2)]), 9, 0);
    // 400 against 20 (+ 10 one map's worth) is far past ×2.
    expect(learnCorrections(run)[0]).toMatchObject({ factor: CORRECTION_RANGE.max, maps: 2, earned: 400, forecast: 20 });
  });

  it('learns nothing where the EXP is unknown: no forecast for the map, a class change, a fall, or the level cap', () => {
    expect(learnCorrections(record(start, maps[1]!, undefined, 7, 0))).toEqual([]);
    const f = forecast(maps[1]!, [row(100, 5.6, 6.0, 6.4)]);
    const changed = record(start, maps[1]!, f, 7, 0);
    const reclassed = editEntry(changed, latestEntry(changed)!.id, (s) => ({ ...s, units: { ...s.units, chrom: { ...s.units.chrom!, class: 'Great Lord', level: 1 } } }), 1);
    expect(learnCorrections(reclassed)).toEqual([]);
    // Lissa fell on the map (Casual): her EXP stopped there.
    const both = forecast(maps[1]!, [row(100, 5.6, 6.0, 6.4), { ...row(100, 5.6, 6.0, 6.4), unit: 'lissa' }]);
    const played = record(start, maps[1]!, both, 7, 0);
    const lissa = editEntry(played, latestEntry(played)!.id, (s) => ({ ...s, units: { ...s.units, lissa: { ...lord, class: 'Cleric', level: 5, exp: 10 } } }), 1);
    const before = editEntry(lissa, lissa.entries[lissa.entries.length - 2]!.id, (s) => ({ ...s, units: { ...s.units, lissa: { ...lord, class: 'Cleric' } } }), 1);
    expect(learnCorrections(before).map((c) => c.unit)).toEqual(['chrom', 'lissa']);
    expect(learnCorrections(recordFallen(before, latestEntry(before)!.id, 'lissa', 1)).map((c) => c.unit)).toEqual(['chrom']);
    expect(learnCorrections(record(start, maps[1]!, f, 20, 0))).toEqual([]);
  });

  it('is relearned from the whole log and kept on the run; switched off, the runs read no factor', () => {
    const run = withLearned(record(start, maps[1]!, forecast(maps[1]!, [row(100, 5.6, 6.0, 6.4)]), 7, 0));
    expect(run.corrections).toEqual({ units: { chrom: 1.5 } });
    expect(expFactors(run)).toEqual({ chrom: 1.5 });
    const off = withCorrectionsOff(run, true);
    expect(expFactors(off)).toEqual({});
    // Relearning keeps the switch; switching back on restores the factors.
    expect(withLearned(off).corrections).toEqual({ units: { chrom: 1.5 }, off: true });
    expect(expFactors(withCorrectionsOff(off, false))).toEqual({ chrom: 1.5 });
    // Stored as run:v2 carries it.
    expect(importRun(exportRun(off)).corrections).toEqual(off.corrections);
  });

  it('keeps the factor each unit was forecast under on the entry’s forecast', () => {
    const run = withLearned(record(start, maps[1]!, forecast(maps[1]!, [row(100, 5.6, 6.0, 6.4)]), 7, 0));
    const chance = { chance: 0.4, margin: 0.05, maps: [{ key: maps[2]!, label: 'x' }], exp: [{ key: maps[2]!, units: [{ unit: 'chrom', exp: 150, level: { low: 7.9, median: 8.5, high: 9 } }] }], shopping: [] } as unknown as FlawlessChance;
    expect(forecastBefore(run, chance)!.exp).toEqual([{ unit: 'chrom', exp: 150, level: { low: 7.9, median: 8.5, high: 9 }, factor: 1.5 }]);
    expect(forecastBefore(withCorrectionsOff(run, true), chance)!.exp[0]!.factor).toBeUndefined();
    const kept = withEntryForecast(addEntry(run, maps[2]!, 5), latestEntry(addEntry(run, maps[2]!, 5))!.id, forecastBefore(run, chance)!);
    expect(latestEntry(importRun(exportRun(kept)))!.forecast!.exp[0]!.factor).toBe(1.5);
  });
});

describe('the runs with a learned correction (#196)', () => {
  // Two maps left, Chrom alone recorded, Great Lord 15.
  const played = maps.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
  const great = { class: 'Great Lord', level: 15, promoted: true, reclassed: false, exp: 0, stats: { hp: 60, str: 35, mag: 5, skl: 35, spd: 35, lck: 35, def: 30, res: 20 }, skills: [], supports: [], inventory: [{ item: 'Silver Sword', uses: 20 }] };
  const late = editEntry(played, latestEntry(played)!.id, (s) => ({ ...s, units: { chrom: great } }), 1);
  const plan = engine.seedPlan(late);
  const chrom = (run: Run) => engine.expForecast(run, plan, { runs: 1 }).exp[0]!.units.find((u) => u.unit === 'chrom')!.exp;

  it('multiplies the EXP each unit earns after the last recorded map; switched off, the forecast is the uncorrected one', () => {
    const corrected: Run = { ...late, corrections: { units: { chrom: 2 } } };
    const plain = chrom(late);
    expect(plain).toBeGreaterThan(0);
    expect(chrom(corrected)).toBeGreaterThan(plain * 1.5);
    expect(chrom(withCorrectionsOff(corrected, true))).toBe(plain);
  });
});

describe('calibration (#196)', () => {
  it('places a level in the forecast’s spread: p10 at its low, p50 at its median, p90 at its high', () => {
    const s = { low: 6, median: 7, high: 8 };
    expect(forecastPercentile(6, s)).toBeCloseTo(0.1);
    expect(forecastPercentile(6.5, s)).toBeCloseTo(0.3);
    expect(forecastPercentile(7, s)).toBeCloseTo(0.5);
    expect(forecastPercentile(8, s)).toBeCloseTo(0.9);
    expect(forecastPercentile(3, s)).toBe(0);
    expect(forecastPercentile(12, s)).toBe(1);
    expect(forecastPercentile(7, { low: 7, median: 7, high: 7 })).toBe(0.5);
  });

  it('shows each recorded result’s percentile in its forecast', () => {
    const run = record(start, maps[1]!, forecast(maps[1]!, [row(100, 5.6, 6.0, 6.4)]), 6, 20);
    const e = latestEntry(run)!;
    expect(calibrationLog(run)).toEqual([{ entry: e.id, unit: 'chrom', percentile: 0.7 }]);
    expect(withLearned(run).calibration).toEqual([{ entry: e.id, unit: 'chrom', percentile: 0.7 }]);
    expect(whatChanged(run)!.exp[0]!.percentile).toBeCloseTo(0.7);
  });

  it('reports the share of recorded results inside p10–p90, their mean percentile, and the falls against the forecast', () => {
    let run = record(start, maps[1]!, forecast(maps[1]!, [row(100, 5.6, 6.0, 6.4)]), 6, 0); // p50
    run = record(run, maps[2]!, forecast(maps[2]!, [row(100, 6.6, 7.0, 7.4)]), 8, 0); // above: p100
    run = recordFallen(run, latestEntry(run)!.id, 'lissa', 1);
    const c = calibration(withLearned(run));
    expect(c).toMatchObject({ results: 2, inside: 1, meanPercentile: 0.75 });
    // Two maps forecast at 90% no-death: 0.2 expected, one with a fall.
    expect(c.falls.maps).toBe(2);
    expect(c.falls.expected).toBeCloseTo(0.2);
    expect(c.falls.observed).toBe(1);
    expect(calibration(start)).toMatchObject({ results: 0, inside: 0, meanPercentile: undefined });
  });
});
