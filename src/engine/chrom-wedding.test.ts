import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, chromChapter11Wife, chromWedding, editEntry, latestEntry, recordMarriage, rosterOf, runFromRoster, withRun, withSpouse, withState, withUnit, type Run, type SupportLevel } from './index';

const facts = withRun(EMPTY_ROSTER, { gender: 'M', asset: 'mag', flaw: 'str', difficulty: 'lunatic', mode: 'classic', route: 'main-story' });
const CANDIDATES = ['sully', 'maribelle', 'olivia', 'sumia'] as const;

describe('who the game marries Chrom to at the end of Chapter 11 (#154)', () => {
  it('is the one candidate at his highest rank, C or above', () => {
    expect(chromChapter11Wife(CANDIDATES, new Set(), { sumia: 'B', sully: 'C' })).toEqual({ decided: true, wife: 'sumia' });
  });

  it('is undecided on a tie at the top, between the tied candidates', () => {
    expect(chromChapter11Wife(CANDIDATES, new Set(), { sumia: 'C', sully: 'C' })).toEqual({ decided: false, contenders: ['sully', 'sumia'] });
  });

  it('is undecided with no rank at all: points under C, or the Maiden', () => {
    expect(chromChapter11Wife(CANDIDATES, new Set(), {})).toEqual({ decided: false, contenders: [...CANDIDATES, 'maiden'] });
  });

  it('skips a candidate married to someone else, and is the Maiden once all are', () => {
    expect(chromChapter11Wife(CANDIDATES, new Set(['sumia'] as const), { sumia: 'A', sully: 'C' })).toEqual({ decided: true, wife: 'sully' });
    expect(chromChapter11Wife(CANDIDATES, new Set(CANDIDATES), { sumia: 'A' })).toEqual({ decided: true, wife: 'maiden' });
  });
});

describe('Record results asks about Chrom’s marriage on Chapter 11 (#154)', () => {
  const atChapter11 = (supports: Partial<Record<'sumia' | 'sully', SupportLevel>>, base = facts): Run => {
    let run = addEntry(addEntry(runFromRoster(base), 'chapter-10', 1), 'chapter-11', 2);
    const id = latestEntry(run)!.id;
    const chrom = { class: 'Lord', level: 10, promoted: false, reclassed: false, exp: 0, stats: null, skills: [], inventory: [], supports: Object.entries(supports).map(([partner, rank]) => ({ partner: partner as 'sumia', rank: rank! })) };
    run = editEntry(run, id, (s) => withUnit(s, 'chrom', chrom), 3);
    return run;
  };

  it('pre-selects Sumia when Chrom has Sumia B and Sully C', () => {
    const run = atChapter11({ sumia: 'B', sully: 'C' });
    const ask = chromWedding(run, latestEntry(run)!.id)!;
    expect(ask.preselect).toBe('sumia');
    expect(ask.options).toEqual(['sully', 'maribelle', 'olivia', 'sumia', 'maiden']);
  });

  it('pre-selects nothing when Chrom has Sumia C and Sully C', () => {
    const run = atChapter11({ sumia: 'C', sully: 'C' });
    expect(chromWedding(run, latestEntry(run)!.id)!.preselect).toBeNull();
  });

  it('offers dead candidates, Robin (F), and not one married to someone else', () => {
    const base = withSpouse(withState(withRun(facts, { gender: 'F' }), 'olivia', 'dead'), 'frederick', 'sully', 'married');
    const run = atChapter11({}, base);
    expect(chromWedding(run, latestEntry(run)!.id)!.options).toEqual(['maribelle', 'olivia', 'sumia', 'robin', 'maiden']);
  });

  it('records the Maiden as Chrom’s wife, and then doesn’t ask', () => {
    let run = atChapter11({});
    const id = latestEntry(run)!.id;
    run = recordMarriage(run, id, 'chrom', 'maiden', 4);
    expect(rosterOf(run).spouses.chrom).toEqual({ partner: 'maiden', bond: 'married' });
    expect(chromWedding(run, id)).toBeNull();
  });

  it('doesn’t ask with Chrom already married, nor on another map', () => {
    const married = atChapter11({}, withSpouse(facts, 'chrom', 'olivia', 'married'));
    expect(chromWedding(married, latestEntry(married)!.id)).toBeNull();
    const run = addEntry(runFromRoster(facts), 'chapter-10', 1);
    expect(chromWedding(run, latestEntry(run)!.id)).toBeNull();
  });
});
