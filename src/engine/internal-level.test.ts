import { describe, expect, it } from 'vitest';
import {
  EMPTY_ROSTER,
  addEntry,
  createEngine,
  editEntry,
  exportRun,
  importRun,
  latestEntry,
  removeClassChange,
  resolveAssumptions,
  runFromRoster,
  withClassChange,
  withCountOverride,
  withRun,
  withUnit,
  type RosterUnit,
  type Run,
  type UnitSnapshot,
} from './index';

const engine = createEngine();
const facts = withRun(EMPTY_ROSTER, { gender: 'M', asset: 'mag', flaw: 'str', difficulty: 'lunatic', route: 'main-story' });

/** Sets a unit's class and level in the entry at `index`. */
function setUnit(run: Run, index: number, unit: RosterUnit, patch: Partial<UnitSnapshot>): Run {
  const e = run.entries[index]!;
  return editEntry(run, e.id, (s) => withUnit(s, unit, { ...s.units[unit]!, ...patch }), 0);
}

/** Prologue then Chapter 1, with Robin at Lv 12 after the Prologue. */
function twoMaps(): Run {
  let run = addEntry(runFromRoster(facts), 'prologue', 1);
  run = setUnit(run, 1, 'robin', { level: 12 });
  return addEntry(run, 'chapter-1', 2);
}

const il = (run: Run, unit: RosterUnit, e = engine) => e.internalLevels(run).get(unit)!;

describe('class changes in the chapter log', () => {
  it('are proposed when a unit’s level resets, pre-filled from the last entry', () => {
    let run = twoMaps();
    expect(engine.classChangeProposals(run)).toEqual([]);
    run = setUnit(run, 2, 'robin', { class: 'Grandmaster', level: 1 });
    const id = latestEntry(run)!.id;
    expect(engine.classChangeProposals(run)).toEqual([{ entry: id, unit: 'robin', from: 'Tactician', to: 'Grandmaster', seal: 'master', level: 12 }]);
  });

  it('propose a Second Seal for any change but base to advanced, and none once one is recorded', () => {
    let run = twoMaps();
    run = setUnit(run, 2, 'frederick', { class: 'Cavalier', level: 1 });
    const [p] = engine.classChangeProposals(run);
    expect(p).toMatchObject({ unit: 'frederick', from: 'Great Knight', to: 'Cavalier', seal: 'second', level: 1 });
    run = withClassChange(run, p!.entry, p!);
    expect(engine.classChangeProposals(run)).toEqual([]);
  });

  it('take the player’s correction, and can be removed again', () => {
    let run = setUnit(twoMaps(), 2, 'robin', { class: 'Grandmaster', level: 1 });
    const [p] = engine.classChangeProposals(run);
    // Used mid-map, at Lv 13 rather than the copied 12.
    run = withClassChange(run, p!.entry, { ...p!, level: 13 });
    expect(latestEntry(run)!.classChanges).toEqual([{ unit: 'robin', from: 'Tactician', to: 'Grandmaster', seal: 'master', level: 13 }]);
    run = removeClassChange(run, p!.entry, 0);
    expect(latestEntry(run)!.classChanges ?? []).toEqual([]);
    expect(engine.classChangeProposals(run)).toHaveLength(1);
  });

  it('back-fill resets already visible between old entries as proposals; everyone starts at 0', () => {
    const run = setUnit(setUnit(twoMaps(), 1, 'frederick', { level: 6 }), 2, 'frederick', { class: 'Knight', level: 1 });
    const old = importRun(exportRun(run));
    expect(engine.classChangeProposals(old).map((p) => [p.entry, p.unit, p.level])).toEqual([[latestEntry(run)!.id, 'frederick', 6]]);
    expect(il(old, 'frederick')).toMatchObject({ count: 0, internal: 1 });
  });

  it('survive export and import, with count overrides', () => {
    let run = setUnit(twoMaps(), 2, 'robin', { class: 'Grandmaster', level: 1 });
    const [p] = engine.classChangeProposals(run);
    run = withCountOverride(withClassChange(run, p!.entry, p!), 'chrom', 4);
    const back = importRun(exportRun(run));
    expect(latestEntry(back)!.classChanges).toEqual(latestEntry(run)!.classChanges);
    expect(back.countOverrides).toEqual({ chrom: 4 });
  });
});

describe('each unit’s internal level', () => {
  it('reads the tier from the class data: +20 in an advanced class, none in a special one', () => {
    const run = setUnit(twoMaps(), 2, 'chrom', { class: 'Villager', level: 3 });
    expect(il(run, 'frederick')).toMatchObject({ tier: 'advanced', level: 1, count: 0, internal: 21 });
    expect(il(run, 'robin')).toMatchObject({ tier: 'base', internal: 12 });
    expect(il(run, 'chrom')).toMatchObject({ tier: 'special', internal: 3 });
  });

  it('flags a class name the data doesn’t know, never guessing its tier', () => {
    const run = setUnit(twoMaps(), 2, 'chrom', { class: 'Sword Guy' });
    expect(il(run, 'chrom')).toMatchObject({ tier: undefined, internal: undefined });
    expect(il(run, 'chrom').problems.join()).toMatch(/Sword Guy/);
  });

  it('adds nothing for a Master Seal, whatever the level at use', () => {
    let run = setUnit(twoMaps(), 2, 'robin', { class: 'Grandmaster', level: 1 });
    const [p] = engine.classChangeProposals(run);
    run = withClassChange(run, p!.entry, p!);
    expect(il(run, 'robin')).toMatchObject({ count: 0, internal: 21 });
  });

  it('adds half the levels at each Second Seal, capped by difficulty', () => {
    let run = setUnit(twoMaps(), 2, 'frederick', { class: 'Cavalier', level: 1 });
    run = withClassChange(run, latestEntry(run)!.id, { unit: 'frederick', from: 'Great Knight', to: 'Cavalier', seal: 'second', level: 1 });
    // Advanced Lv 1 → base: a count of 10, internal 11.
    expect(il(run, 'frederick')).toMatchObject({ count: 10, internal: 11 });
    run = addEntry(run, 'chapter-2', 3);
    run = setUnit(run, 3, 'frederick', { class: 'Great Knight', level: 1 });
    run = withClassChange(run, latestEntry(run)!.id, { unit: 'frederick', from: 'Cavalier', to: 'Great Knight', seal: 'second', level: 20 });
    expect(il(run, 'frederick')).toMatchObject({ count: 19, internal: 40 });
    // As of the earlier entry, only the first seal counts.
    expect(engine.internalLevels(run, run.entries[2]!.id).get('frederick')).toMatchObject({ count: 10 });
    run = withCountOverride(run, 'frederick', 40);
    expect(il(run, 'frederick')).toMatchObject({ count: 59, internal: 71, overridden: true });
  });

  it('asks once about a unit first seen in a class it can’t join in; the count override answers it', () => {
    let run = setUnit(setUnit(twoMaps(), 1, 'chrom', { class: 'Great Lord', level: 5 }), 2, 'chrom', { class: 'Great Lord', level: 5 });
    expect(il(run, 'chrom')).toMatchObject({ unknownHistory: true, count: 0, internal: 25 });
    expect(il(run, 'frederick').unknownHistory).toBe(false);
    run = withCountOverride(run, 'chrom', 7);
    expect(il(run, 'chrom')).toMatchObject({ unknownHistory: false, count: 7, internal: 32 });
    run = withCountOverride(run, 'chrom', null);
    expect(il(run, 'chrom').unknownHistory).toBe(true);
  });

  it('reads +1 per class change only as the open rule’s other reading, not by default', () => {
    let run = setUnit(twoMaps(), 2, 'robin', { class: 'Grandmaster', level: 1 });
    const [p] = engine.classChangeProposals(run);
    run = withClassChange(run, p!.entry, { ...p!, level: 10 });
    expect(il(run, 'robin').internal).toBe(21);
    const plusOne = createEngine(resolveAssumptions({ 'class-change-internal-level': 'plus-one' }));
    expect(il(run, 'robin', plusOne).internal).toBe(11);
    expect(engine.assumptions().find((a) => a.id === 'class-change-internal-level')).toMatchObject({ isDefault: true });
  });
});
