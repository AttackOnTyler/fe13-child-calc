import { describe, expect, it } from 'vitest';
import {
  EMPTY_ROSTER,
  EMPTY_RUN,
  addEntry,
  editEntry,
  exportRun,
  flaggedEntries,
  heldProblems,
  importRun,
  latestEntry,
  rosterOf,
  runFromRoster,
  withRoster,
  withRun,
  withSpouse,
  withState,
  withUnit,
} from './index';

const facts = withRun(EMPTY_ROSTER, { gender: 'M', asset: 'mag', flaw: 'str', difficulty: 'lunatic', route: 'main-story' });

describe('the chapter log', () => {
  it('starts from the existing roster: its states and marriages become the first entry', () => {
    const roster = withSpouse(withState(facts, 'vaike', 'dead'), 'chrom', 'sumia', 'married');
    const run = runFromRoster(roster);
    expect(run.entries).toHaveLength(1);
    expect(run.entries[0]!.snapshot.states).toEqual({ vaike: 'dead' });
    expect(rosterOf(run)).toEqual(roster);
  });

  it('copies forward: a new entry starts as the previous snapshot', () => {
    let run = addEntry(runFromRoster(facts), 'prologue', 1);
    run = editEntry(run, latestEntry(run)!.id, (s) => ({ ...s, gold: 1200 }), 2);
    run = addEntry(run, 'chapter-1', 3);
    expect(latestEntry(run)!.snapshot.gold).toBe(1200);
    expect(latestEntry(run)!.snapshot.units.chrom).toEqual(run.entries[1]!.snapshot.units.chrom);
  });

  it('pre-fills recruits from join data on the run’s difficulty, and a child’s class and level from the map', () => {
    let run = addEntry(runFromRoster(facts), 'prologue', 1);
    expect(latestEntry(run)!.snapshot.units.frederick).toMatchObject({ class: 'Great Knight', level: 1, skills: ['discipline', 'outdoor-fighter'], stats: { hp: 28, def: 14 } });
    expect(latestEntry(run)!.snapshot.units.robin).toMatchObject({ class: 'Tactician', level: 1 });
    run = addEntry(run, 'chapter-8', 2);
    // Gregor has Lunatic bases.
    expect(latestEntry(run)!.snapshot.units.gregor!.stats!.hp).toBe(31);
    run = addEntry(run, 'chapter-13', 3);
    expect(latestEntry(run)!.snapshot.units.lucina).toMatchObject({ class: 'Lord', level: 10, stats: null });
  });

  it('never lets a past edit reach later entries, and flags them', () => {
    let run = addEntry(runFromRoster(facts), 'prologue', 1);
    run = addEntry(run, 'chapter-1', 2);
    run = addEntry(run, 'chapter-2', 3);
    const second = run.entries[2]!.id;
    run = editEntry(run, second, (s) => withUnit(s, 'chrom', { ...s.units.chrom!, level: 5 }), 10);
    expect(run.entries[2]!.snapshot.units.chrom!.level).toBe(5);
    expect(run.entries[3]!.snapshot.units.chrom!.level).toBe(1);
    expect([...flaggedEntries(run)]).toEqual([run.entries[3]!.id]);
    // An entry made after the edit isn't flagged.
    expect(flaggedEntries(addEntry(run, 'chapter-3', 11)).has(latestEntry(addEntry(run, 'chapter-3', 11))!.id)).toBe(false);
  });

  it('writes the Roster page’s edits into the latest entry', () => {
    let run = addEntry(runFromRoster(facts), 'prologue', 1);
    run = withRoster(run, withState(rosterOf(run), 'lissa', 'benched'));
    expect(latestEntry(run)!.snapshot.states).toEqual({ lissa: 'benched' });
    expect(run.entries[0]!.snapshot.states).toEqual({});
    expect(rosterOf(run).run).toEqual(facts.run);
  });

  it('exports and imports exactly', () => {
    let run = addEntry(runFromRoster(withSpouse(facts, 'chrom', 'sumia', 'married')), 'prologue', 1);
    run = editEntry(run, latestEntry(run)!.id, (s) => ({ ...s, gold: 900, convoy: [{ item: 'Iron Sword', uses: 40, forge: { name: 'Shiny', mt: 1, hit: 0, crit: 0 } }] }), 2);
    expect(importRun(exportRun(run))).toEqual(run);
    expect(importRun('{"version":2}')).toEqual(EMPTY_RUN);
  });
});

describe('inventory, convoy and gold (#117)', () => {
  it('fill a recruit’s starting items at full uses', () => {
    const run = addEntry(runFromRoster(facts), 'prologue', 1);
    expect(latestEntry(run)!.snapshot.units.frederick!.inventory).toEqual([{ item: 'Silver Lance', uses: 30 }]);
  });

  it('validate held items against the item data', () => {
    expect(heldProblems({ item: 'Iron Sword', uses: 40 })).toEqual([]);
    expect(heldProblems({ item: 'Iron Sword', uses: 41 })[0]).toMatch(/at most 40/);
    expect(heldProblems({ item: 'Excalibur Sword', uses: 1 })[0]).toMatch(/not an item/);
    expect(heldProblems({ item: 'Steel Sword', uses: 30, forge: { name: 'Kiri', mt: 2, hit: 10, crit: 3 } })).toEqual([]);
    expect(heldProblems({ item: 'Steel Sword', uses: 30, forge: { name: 'Kiri', mt: 2, hit: 7, crit: 0 } })[0]).toMatch(/steps/);
    expect(heldProblems({ item: 'Steel Sword', uses: 30, forge: { name: 'Kiri', mt: 5, hit: 20, crit: 0 } })[0]).toMatch(/8 intervals/);
    expect(heldProblems({ item: 'Falchion', uses: null, forge: { name: 'X', mt: 1, hit: 0, crit: 0 } })[0]).toMatch(/can’t be forged/);
  });

  it('carry inventory, convoy and gold forward, and keep them per entry', () => {
    let run = addEntry(runFromRoster(facts), 'prologue', 1);
    run = editEntry(
      run,
      latestEntry(run)!.id,
      (s) => ({ ...withUnit(s, 'chrom', { ...s.units.chrom!, inventory: [{ item: 'Rapier', uses: 30 }] }), convoy: [{ item: 'Vulnerary', uses: 3 }], gold: 800 }),
      2,
    );
    run = addEntry(run, 'chapter-1', 3);
    const s = latestEntry(run)!.snapshot;
    expect([s.units.chrom!.inventory, s.convoy, s.gold]).toEqual([[{ item: 'Rapier', uses: 30 }], [{ item: 'Vulnerary', uses: 3 }], 800]);
    run = editEntry(run, latestEntry(run)!.id, (x) => ({ ...x, gold: 100 }), 4);
    expect(run.entries[1]!.snapshot.gold).toBe(800);
  });
});
