import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, FLAWLESS_SEED, addEntry, createEngine, runFromRoster, withRun, type UnitWorth } from '../engine';
import { chanceText } from './chance';
import { flawlessReadout, readingMarks } from './run-page';
import { splitMarks, valueText } from './why';
import { worthMarks, worthText } from './wishlist-page';

/**
 * The Why panel's page side (#210): numbers are marked in the lines the pages already write, each mark naming an
 * explanation the facade has; the panel's value reads as the spec words chances.
 */
describe('marking a line’s numbers (#210)', () => {
  it('splits a line at its numbers in order, keeping every character', () => {
    const text = 'Flawless chance: 42.0% ±1.5 · ceiling 71.0%';
    const parts = splitMarks(text, [['42.0% ±1.5', 'flawless'], ['71.0%', 'ceiling']]);
    expect(parts.map((p) => p.text).join('')).toBe(text);
    expect(parts.filter((p) => p.id)).toEqual([
      { text: '42.0% ±1.5', id: 'flawless' },
      { text: '71.0%', id: 'ceiling' },
    ]);
  });

  it('skips a number the line doesn’t hold, and finds a repeated one after the one before', () => {
    expect(splitMarks('No run gets here', [['12.0%', 'map:a'], undefined, false])).toEqual([{ text: 'No run gets here' }]);
    expect(splitMarks('50.0% then 50.0%', [['50.0%', 'a'], ['50.0%', 'b']]).filter((p) => p.id).map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('the panel’s value (#210): chance wording as the spec has it', () => {
  it('reads chances in percent, with 1 run in N near the edges, capped', () => {
    expect(valueText({ value: 0.42, format: 'chance' })).toBe('42.0%');
    expect(valueText({ value: 0.996, format: 'chance' })).toBe('99.6% (loses a unit about 1 run in 250)');
    expect(valueText({ value: 0.004, format: 'chance' })).toBe('0.4% (flawless about 1 run in 250)');
    expect(valueText({ value: 0.99995, format: 'chance' })).toBe('over 99.9%');
  });

  it('adds 1 run in N to every fight’s kill chance', () => {
    expect(valueText({ value: 0.121, format: 'kill' })).toBe('12.1% (kills someone about 1 run in 8)');
  });

  it('keeps the simulation error to differences: the headline’s ± is in its math', () => {
    expect(valueText({ value: 0.42, format: 'chance', margin: 0.015 })).toBe('42.0%');
    expect(valueText({ value: -0.002, format: 'difference', margin: 0.003, close: true })).toBe('no measurable difference (−0.2 ±0.3)');
    expect(valueText({ value: 0.012, format: 'difference', margin: 0.004 })).toBe('+1.2 ±0.4');
    expect(valueText({ value: 0.123, format: 'points', margin: 0.02 })).toBe('12.3 points');
    expect(valueText({ value: 12345.6, format: 'gold' })).toBe('12,346G');
  });
});

describe('every number the Run view marks opens an explanation (#210)', () => {
  const engine = createEngine();
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const start = runFromRoster(facts);
  const all = engine.mapOrder(start).steps.map((s) => s.map);
  const run = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), start);

  it('marks the headline, the ceiling, each map’s chance and gold, and each milestone’s chance, each in its line', () => {
    const r = flawlessReadout(engine, run, { runs: 2 });
    const why = r.why!;
    const ctx = { run, plan: r.plan!, chance: r.chance!, seed: FLAWLESS_SEED, ...(r.readings ? { readings: r.readings } : {}) };
    expect(why.text.map((m) => m[1])).toEqual(['flawless', 'ceiling']);
    expect(why.text[0]![0]).toBe(`${chanceText(r.chance!.chance)} ±${(r.chance!.margin * 100).toFixed(1)}`);
    const lines: [string, readonly (readonly [string, string])[]][] = [
      [r.text, why.text],
      ...r.rows.map((x, i): [string, readonly (readonly [string, string])[]] => [x, why.rows[i]!]),
      ...r.roadmap!.rows.map((x, i): [string, readonly (readonly [string, string])[]] => [x, r.roadmap!.marks!.rows[i]!]),
      ...r.roadmap!.readings.map((x, i): [string, readonly (readonly [string, string])[]] => [x, r.roadmap!.marks!.readings[i]!]),
    ];
    const ids = new Set<string>();
    for (const [line, marks] of lines) {
      // Every mark is found in its line, so the line reads as it did with its numbers clickable.
      expect(splitMarks(line, marks).filter((p) => p.id)).toHaveLength(marks.length);
      for (const [, id] of marks) ids.add(id);
    }
    expect([...ids].filter((id) => id.startsWith('map:'))).toHaveLength(r.chance!.maps.filter((m) => m.noDeath !== undefined).length);
    for (const id of ids) expect(engine.explain(id, ctx), id).toBeDefined();
  });

  it('marks a reading by its worst milestone', () => {
    const r = flawlessReadout(engine, run, { runs: 2 });
    const reading = r.readings!.readings.find((x) => x.worst?.reached);
    if (reading) expect(readingMarks(reading)).toEqual([[chanceText(reading.worst!.chance), `milestone:${reading.worst!.id}`]]);
  });

  it('marks a unit’s worth and utility on the Wishlist tab, both explained as its worth', () => {
    const w: UnitWorth = { unit: 'frederick', forced: false, worth: 0.123, margin: 0.02, utility: 0.031, utilityMargin: 0.01, runs: 8, children: [], settled: true };
    const text = worthText(w, 'M');
    const marks = worthMarks(w);
    expect(marks).toEqual([
      ['worth 12.3 ±2.0', 'worth:frederick'],
      ['utility 3.1', 'worth:frederick'],
    ]);
    expect(splitMarks(text, marks).filter((p) => p.id)).toHaveLength(2);
    expect(worthMarks({ ...w, forced: true })).toEqual([]);
  });
});
