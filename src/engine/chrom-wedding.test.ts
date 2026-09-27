import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, chromChapter11Wife, chromWedding, chromWifeByPoints, editEntry, latestEntry, recordMarriage, rosterOf, runFromRoster, withRun, withSpouse, withState, withUnit, type ChromStanding, type Run, type SupportLevel } from './index';

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

  it('leaves a lost candidate out, rank and all, under the reading that the game skips her', () => {
    const run = atChapter11({ sumia: 'B', sully: 'C' }, withState(facts, 'sumia', 'dead'));
    expect(chromWedding(run, latestEntry(run)!.id)!.preselect).toBe('sumia');
    const skipped = chromWedding(run, latestEntry(run)!.id, 'skipped')!;
    expect(skipped.options).toEqual(['sully', 'maribelle', 'olivia', 'maiden']);
    expect(skipped.preselect).toBe('sully');
  });

  it('pre-selects nothing while no candidate but Olivia has a logged rank: she can win without a C', () => {
    const run = atChapter11({});
    expect(chromWedding(run, latestEntry(run)!.id)!.preselect).toBeNull();
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

describe('who the game marries Chrom to, from his points with each candidate (research/chrom-wedding)', () => {
  const ALL = ['sumia', 'sully', 'maribelle', 'robin', 'olivia'] as const;
  /** Points, the viewed rank (null: none) and the points still to go to the next rank (0: a rank reached, not viewed). */
  const at = (points: number, rank: SupportLevel | null, toNext: number): ChromStanding => ({ points, rank, toNext });
  const wife = (standing: Partial<Record<(typeof ALL)[number], ChromStanding>>, out: readonly (typeof ALL)[number][] = []) => chromWifeByPoints(ALL, new Set(out), standing);

  it('marries Olivia from 2 points when no other candidate has a viewed C, over more points and unviewed Cs', () => {
    expect(wife({ olivia: at(2, null, 2), sumia: at(2, null, 0), sully: at(3, null, 0) })).toBe('olivia');
    // A viewed C elsewhere beats her.
    expect(wife({ olivia: at(3, null, 1), sully: at(3, 'C', 4) })).toBe('sully');
    // Below 2 points she's last in the order.
    expect(wife({ olivia: at(1, null, 3), robin: at(1, null, 3) })).toBe('robin');
  });

  it('counts 1 point for anyone, Olivia too, and the Maiden when nobody has one', () => {
    expect(wife({ olivia: at(1, null, 3) })).toBe('olivia');
    expect(wife({ sully: at(1, null, 2) })).toBe('sully');
    expect(wife({ sumia: at(0, null, 2), olivia: at(0, null, 4) })).toBe('maiden');
    expect(wife({})).toBe('maiden');
  });

  it('goes by the highest viewed rank, then the fewest points to the next, then Sumia > Sully > Maribelle > Robin > Olivia', () => {
    expect(wife({ sumia: at(6, 'B', 4), sully: at(3, 'C', 4) })).toBe('sumia');
    expect(wife({ sumia: at(2, 'C', 4), sully: at(4, 'C', 3) })).toBe('sully');
    expect(wife({ maribelle: at(3, 'C', 4), sully: at(3, 'C', 4) })).toBe('sully');
    expect(wife({ maribelle: at(1, null, 2), robin: at(1, null, 3) })).toBe('maribelle');
    // An unviewed rank is 0 to go: it wins the tie, never the rank.
    expect(wife({ robin: at(4, null, 0), sumia: at(1, null, 1) })).toBe('robin');
    expect(wife({ robin: at(8, 'C', 0), sumia: at(2, 'C', 4) })).toBe('robin');
    expect(wife({ robin: at(8, 'C', 0), sumia: at(6, 'B', 4) })).toBe('sumia');
  });

  it('leaves out candidates married to someone else', () => {
    expect(wife({ sumia: at(10, 'A', 4), sully: at(1, null, 2) }, ['sumia'])).toBe('sully');
    expect(wife({ sumia: at(10, 'A', 4) }, ['sumia'])).toBe('maiden');
  });
});
