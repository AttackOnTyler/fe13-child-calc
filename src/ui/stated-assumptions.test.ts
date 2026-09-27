import { describe, expect, it } from 'vitest';
import {
  EMPTY_CHECKED_RULES,
  EMPTY_ROSTER,
  addEntry,
  answerRule,
  createEngine,
  editEntry,
  latestEntry,
  runFromRoster,
  withEntryForecast,
  withLearned,
  withRun,
  type EntryForecast,
  type Run,
} from '../engine';
import { flawlessReadout, solvedReadout, type SolveProgress } from './run-page';
import { STATED_SECTIONS, statedAssumptionsReadout } from './stated-assumptions';

/**
 * The Why panel's second tab (#211; spec #175, The Why panel): the whole stated assumptions list, in order — blind spots
 * with their lean, where they bite and their stress-test range; open rules by stakes with their checks; model
 * mismatches; learned corrections; then checked rules — and the headline's stress-test ranges.
 */
const engine = createEngine();
const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
const fresh = runFromRoster(facts);
const all = engine.mapOrder(fresh).steps.map((s) => s.map);
const late = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
const evidence = { run: 'Normal Classic, Main story', map: 'chapter-24' };

describe('the stated assumptions list (#211)', () => {
  it('lists its sections in the spec’s order, checked rules last', () => {
    expect(STATED_SECTIONS).toEqual(['Blind spots', 'Open rules', 'Model mismatches', 'Learned corrections', 'Checked rules']);
  });

  it('lists every blind spot with its lean and where it bites, and a stress-test range where one can be stressed', () => {
    const r = statedAssumptionsReadout(engine, late, { rules: EMPTY_CHECKED_RULES, headline: { chance: 0.42, stress: { 'two-attackers': { chance: 0.318 } } } });
    expect(r.blindSpots.map((b) => b.id)).toEqual(engine.blindSpots().map((b) => b.id));
    const worst = r.blindSpots.find((b) => b.id === 'one-worst-attacker')!;
    expect(worst.lean).toBe('▲ may read high');
    expect(worst.bites).toBe('Bites: map chances and fight kill chances');
    expect(worst.stress).toEqual({ text: 'as low as 31.8% if two attackers reach each exposed pair', id: 'stress:two-attackers' });
    // Rally's stress isn't in yet: it says so; a blind spot with no bad case to play has none.
    expect(r.blindSpots.find((b) => b.id === 'rally-reaches-every-pair')!.stress).toEqual({ text: 'Stress test (if Rally reaches no pair): worked out once the search is done' });
    expect(r.blindSpots.find((b) => b.id === 'door-keys')!.stress).toBeUndefined();
    // A bad case the plan does no worse under says so, still explained.
    const higher = statedAssumptionsReadout(engine, late, { rules: EMPTY_CHECKED_RULES, headline: { chance: 0.42, stress: { 'no-rally': { chance: 0.5 } } } });
    expect(higher.blindSpots.find((b) => b.id === 'rally-reaches-every-pair')!.stress).toEqual({ text: '50.0% if Rally reaches no pair: no lower than the headline on this plan', id: 'stress:no-rally' });
    expect(r.blindSpots.find((b) => b.id === 'simulation-error')!.bites).toBe('Bites: the walk between maps and milestones and the EXP forecast');
  });

  it('lists open rules by stakes, each with its check; then mismatches; then checked rules, each answerable or reopenable', () => {
    const rules = answerRule(engine.settleCheck(engine.settleCheck(EMPTY_CHECKED_RULES, 'tome-miss-use', 3, evidence, 1).rules, 'tome-miss-use', 3, evidence, 2).rules, 'booster-at-cap', 'other', evidence, 3);
    const stakes = [
      { rule: 'support-past-threshold', gain: -0.004, margin: 0.002, runs: 24, modelled: true },
      { rule: 'veteran-as-back', gain: 0.021, margin: 0.008, runs: 24, modelled: true },
    ];
    const r = statedAssumptionsReadout(engine, late, { rules, stakes });
    expect(r.open.slice(0, 2).map((x) => x.id)).toEqual(['veteran-as-back', 'support-past-threshold']);
    expect(r.open[0]!.check).toMatch(/^Check in play: /);
    expect(r.open.every((x) => x.can === 'answer')).toBe(true);
    expect(r.mismatches.map((x) => x.id)).toEqual(['tome-miss-use']);
    expect(r.settled.map((x) => [x.id, x.can])).toEqual([['booster-at-cap', 'reopen']]);
  });

  it('lists the learned corrections, from the chapter log', () => {
    const maps = engine.mapOrder(fresh).steps.map((s) => s.map);
    const lord = { class: 'Lord', level: 5, promoted: false, reclassed: false, exp: 0, stats: null, skills: [], supports: [], inventory: [] };
    const f: EntryForecast = { chance: 0.5, margin: 0.05, key: maps[1]!, map: maps[1]!, noDeath: 0.9, exp: [{ unit: 'chrom', exp: 100, level: { low: 5.6, median: 6, high: 6.4 } }], readings: [] };
    const record = (run: Run, map: string, fc: EntryForecast | undefined, level: number) => {
      const added = addEntry(run, map, run.entries.length + 1);
      const id = latestEntry(added)!.id;
      return editEntry(fc ? withEntryForecast(added, id, fc) : added, id, (s) => ({ ...s, units: { ...s.units, chrom: { ...lord, level, exp: 0 } } }), 1);
    };
    const run = withLearned(record(record(fresh, maps[0]!, undefined, 5), maps[1]!, f, 7));
    const r = statedAssumptionsReadout(engine, run, { rules: EMPTY_CHECKED_RULES });
    expect(r.corrections.corrections).toEqual(['Chrom ×1.50 (1 map: 200 EXP against 100 forecast; recorded at p100)']);
    expect(r.corrections.off).toBe(false);
  });
});

describe('the headline’s stress-test ranges (#211)', () => {
  it('shows one for each blind spot stressed, each a number the Why panel explains', () => {
    const base = flawlessReadout(engine, late, { runs: 2 });
    expect(base.stress).toEqual([]);
    // An empty army loses everything: the chances here are set by hand.
    const chance = { ...base.chance!, chance: 0.42 };
    const plan = base.plan!;
    const progress: SolveProgress = {
      best: plan,
      chance,
      proposals: [],
      closeCalls: [],
      pruned: [],
      done: true,
      converged: true,
      stress: { 'two-attackers': { ...chance, chance: 0.318 }, 'no-rally': chance },
    };
    const r = solvedReadout(engine, late, progress);
    // Rally's bad case moved nothing: no range for it.
    expect(r.stress).toEqual([{ text: 'as low as 31.8% if two attackers reach each exposed pair', id: 'stress:two-attackers' }]);
    expect(r.text).toMatch(/^Flawless chance: 42\.0% ±/);
  });
});
