import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, rosterUnits, withRun, withSpouse, withState, type Roster, type RosterUnit } from '../engine';
import { spouseOptions } from './spouse-options';

const entry = (roster: Roster, id: RosterUnit) => rosterUnits(roster.run).find((u) => u.id === id)!;
const labels = (roster: Roster, id: RosterUnit) => spouseOptions(roster, entry(roster, id)).map((o) => o.label);
const label = (roster: Roster, id: RosterUnit, partner: RosterUnit) => spouseOptions(roster, entry(roster, id)).find((o) => o.value === partner)?.label;

describe('spouse picker options', () => {
  it('lists every partner unlabelled, in data order, when all are available or not yet recruited', () => {
    const roster = withState(EMPTY_ROSTER, 'stahl', 'not-recruited');
    const cordelia = entry(roster, 'cordelia');
    expect(spouseOptions(roster, cordelia).map((o) => o.value)).toEqual(cordelia.partners);
    expect(label(roster, 'cordelia', 'stahl')).toBe('Stahl');
  });

  it('labels a dead, missed or benched partner with its state', () => {
    let roster = withState(EMPTY_ROSTER, 'stahl', 'dead');
    roster = withState(roster, 'lonqu', 'missed');
    roster = withState(roster, 'vaike', 'benched');
    expect(label(roster, 'cordelia', 'stahl')).toBe('Stahl (dead)');
    expect(label(roster, 'cordelia', 'lonqu')).toBe("Lon'qu (missed)");
    expect(label(roster, 'cordelia', 'vaike')).toBe('Vaike (benched)');
  });

  it('sorts the benched after the available, and the missed and dead last, each group in data order', () => {
    let roster = withState(EMPTY_ROSTER, 'stahl', 'dead');
    roster = withState(roster, 'lonqu', 'missed');
    roster = withState(roster, 'vaike', 'benched');
    roster = withState(roster, 'chrom', 'not-recruited');
    const partners = entry(roster, 'cordelia').partners;
    const lost = new Set<RosterUnit>(['stahl', 'lonqu']);
    const expected = [
      ...partners.filter((p) => p !== 'vaike' && !lost.has(p)),
      'vaike',
      ...partners.filter((p) => lost.has(p)),
    ];
    expect(spouseOptions(roster, entry(roster, 'cordelia')).map((o) => o.value)).toEqual(expected);
  });

  it('puts the state and a bond elsewhere in one parenthetical', () => {
    let roster = withSpouse(EMPTY_ROSTER, 'stahl', 'sully', 'married');
    roster = withState(roster, 'stahl', 'dead');
    expect(label(roster, 'cordelia', 'stahl')).toBe('Stahl (dead; married to Sully)');
    roster = withSpouse(withState(EMPTY_ROSTER, 'vaike', 'benched'), 'vaike', 'sully');
    expect(label(roster, 'cordelia', 'vaike')).toBe('Vaike (benched; pinned to Sully)');
  });

  it('labels the current spouse with its state too', () => {
    const roster = withState(withSpouse(EMPTY_ROSTER, 'cordelia', 'stahl', 'married'), 'stahl', 'dead');
    expect(label(roster, 'cordelia', 'stahl')).toBe('Stahl (dead)');
  });

  it('keeps a bond note for an available partner paired elsewhere', () => {
    const roster = withSpouse(EMPTY_ROSTER, 'stahl', 'sully', 'married');
    expect(label(roster, 'cordelia', 'stahl')).toBe('Stahl (married to Sully)');
  });

  it('names Robin by the run’s gender', () => {
    const roster = withState(withRun(EMPTY_ROSTER, { gender: 'M' }), 'robin', 'benched');
    expect(labels(roster, 'cordelia')).toContain('Robin (M) (benched)');
  });
});
