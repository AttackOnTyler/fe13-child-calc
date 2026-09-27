import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, createEngine, editEntry, latestEntry, recordFallen, runFromRoster, withCorrectionsOff, withEntryForecast, withLearned, withRun, type EntryForecast, type Run } from '../engine';
import { forecastLearningReadout } from './run-page';

/**
 * The Run view's forecast learning (#196), as the page writes it: the learned EXP corrections as a stated assumption
 * with the switch, each recorded result's percentile, and the calibration line with the falls.
 */
const engine = createEngine();
const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp', mode: 'casual' });
const maps = engine.mapOrder(runFromRoster(facts)).steps.map((s) => s.map);
const lord = { class: 'Lord', level: 5, promoted: false, reclassed: false, exp: 0, stats: null, skills: [], supports: [], inventory: [] };
const forecast = (map: string, low: number, median: number, high: number): EntryForecast => ({ chance: 0.5, margin: 0.05, key: map, map, noDeath: 0.9, exp: [{ unit: 'chrom', exp: 100, level: { low, median, high } }], readings: [] });
function record(run: Run, map: string, f: EntryForecast | undefined, level: number, exp: number): Run {
  const added = addEntry(run, map, run.entries.length + 1);
  const id = latestEntry(added)!.id;
  return editEntry(f ? withEntryForecast(added, id, f) : added, id, (s) => ({ ...s, units: { ...s.units, chrom: { ...lord, level, exp } } }), 1);
}
const start = record(runFromRoster(facts), maps[0]!, undefined, 5, 0);

describe('forecast learning on the Run view (#196)', () => {
  it('says there’s nothing to learn from before a map is recorded against a forecast', () => {
    const r = forecastLearningReadout(start);
    expect(r.calibration).toBe('Calibration: no recorded result against a forecast yet.');
    expect(r.corrections).toEqual([]);
    expect(r.falls).toBeUndefined();
  });

  it('states each unit’s learned correction with its evidence and percentiles, and the calibration line', () => {
    // Chapter 1: 100 EXP forecast, Lv 5 → 6.0 (its median, p50); Chapter 2: 100 forecast, 120 earned, 7.2 in 6.6–7.4 (p70).
    let run = record(start, maps[1]!, forecast(maps[1]!, 5.6, 6.0, 6.4), 6, 0);
    run = record(run, maps[2]!, forecast(maps[2]!, 6.6, 7.0, 7.4), 7, 20);
    run = withLearned(recordFallen(run, latestEntry(run)!.id, 'lissa', 1));
    const r = forecastLearningReadout(run);
    expect(r.off).toBe(false);
    expect(r.assumption).toBe('Learned EXP corrections, assumed on every map after the last recorded one:');
    // 220 EXP against 200 forecast, shrunk by one map's 100: 320 / 300.
    expect(r.corrections).toEqual(['Chrom ×1.07 (2 maps: 220 EXP against 200 forecast; recorded at p50, p70)']);
    expect(r.calibration).toBe('Calibration: 2 of 2 recorded results inside the forecast’s 10th–90th percentile (about 80% if it’s honest); mean percentile p60 (about p50 if unbiased).');
    expect(r.falls).toBe('Falls: 1 of 2 maps with a fall or death, against 0.2 expected by the no-death forecast.');
  });

  it('switched off, says the forecast reads uncorrected', () => {
    const run = withCorrectionsOff(withLearned(record(start, maps[1]!, forecast(maps[1]!, 5.6, 6.0, 6.4), 7, 0)), true);
    const r = forecastLearningReadout(run);
    expect(r.off).toBe(true);
    expect(r.assumption).toBe('Learned EXP corrections, switched off: the forecast reads uncorrected.');
    expect(r.corrections).toEqual(['Chrom ×1.50 (1 map: 200 EXP against 100 forecast; recorded at p100)']);
  });
});
