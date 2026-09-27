import { describe, expect, it } from 'vitest';
import {
  EMPTY_ROSTER,
  ROBIN_EXTRA,
  addEntry,
  createEngine,
  exportRun,
  importRun,
  robinKey,
  robinOptions,
  runFromRoster,
  withRobinLock,
  withRun,
  wishlistDifference,
  type Plan,
  type PlanRobin,
  type RobinStep,
  type RosterUnit,
} from './index';
import { robinStep, type RobinDeps } from './solve/robin';

/**
 * The Robin alternatives and the Robin Lock (#201): the stepping core on a made-up objective, where each Robin's runs
 * are known, then a recorded run through the facade. The late Main story run (only Endgame left) with Robin's gender and
 * asset set keeps it small: its seven flaws are the options.
 */
const engine = createEngine();
const until = (step: (s: RobinStep | undefined) => RobinStep) => {
  let s: RobinStep | undefined;
  for (let i = 0; i < 400 && !s?.converged; i++) s = step(s);
  return s!;
};

describe('the Robin options (#201)', () => {
  it('are every gender, asset and flaw the run facts leave open: 56 per gender, HP included', () => {
    const open = robinOptions(EMPTY_ROSTER.run);
    expect(open).toHaveLength(112);
    expect(open.filter((r) => r.gender === 'F')).toHaveLength(56);
    expect(open.some((r) => r.asset === 'hp') && open.some((r) => r.flaw === 'hp')).toBe(true);
    expect(open.every((r) => r.asset !== r.flaw)).toBe(true);
    expect(robinOptions({ gender: 'M', asset: 'mag', flaw: null }).map(robinKey)).toEqual(['M-mag-hp', 'M-mag-str', 'M-mag-skl', 'M-mag-spd', 'M-mag-lck', 'M-mag-def', 'M-mag-res']);
  });
});

describe('the Robin alternatives on a made-up objective (#201)', () => {
  // Five Robins: each one's chance on every run, its ceiling, and its spouse.
  const R = (gender: 'M' | 'F', asset: 'str' | 'mag' | 'spd'): PlanRobin => ({ gender, asset, flaw: 'lck' });
  const table: Record<string, { chance: number; ceiling: number; spouse: RosterUnit }> = {
    'M-str-lck': { chance: 0.6, ceiling: 0.9, spouse: 'sumia' },
    'M-mag-lck': { chance: 0.55, ceiling: 0.8, spouse: 'olivia' },
    'F-str-lck': { chance: 0.5, ceiling: 0.9, spouse: 'chrom' },
    'F-mag-lck': { chance: 0.1, ceiling: 0.1, spouse: 'frederick' },
    'F-spd-lck': { chance: 0.7, ceiling: 0.95, spouse: 'lonqu' },
  };
  const planOf = (r: PlanRobin, married = true): Plan => ({
    robin: r,
    wishlist: {
      endpoint: 'end',
      units: [{ unit: 'robin', position: 'solo', classId: 'grandmaster', build: [] }, ...(married ? [{ unit: table[robinKey(r)]!.spouse, position: 'solo' as const, classId: 'hero' as const, build: [] }] : [])],
      marriages: married ? [['robin', table[robinKey(r)]!.spouse]] : [],
      children: [],
      reserves: [],
    },
    roadmap: { order: ['end'], lineups: [], seals: [], items: [] },
  });
  const options = [R('M', 'str'), R('M', 'mag'), R('F', 'str'), R('F', 'mag'), R('F', 'spd')];
  const deps = (locked?: PlanRobin): RobinDeps => ({
    options,
    locked,
    genders: ['M', 'F'],
    genderBest: (g) => (g === 'M' ? R('M', 'str') : R('F', 'str')),
    screen: (r) => ({ plan: planOf(r), ceiling: table[robinKey(r)]!.ceiling }),
    solve: (r, cursor) => ({ best: planOf(r), chance: undefined, proposals: [], closeCalls: [], pruned: [], converged: true, evaluations: 1, cursor: { evaluations: (cursor?.evaluations ?? 0) + 1 } }),
    // Every run of a Robin reads its chance, the no-Robin plan 0.05 less.
    samples: (r, plan, _first, count) => Array.from({ length: count }, () => table[robinKey(r)]!.chance - (plan.wishlist.marriages.length ? 0 : 0.05)),
    noRobin: (r) => planOf(r, false),
  });
  const input = { budget: 3, seed: 1, compare: 4 } as const;
  const step = until((s) => robinStep({ ...input, run: undefined!, ...(s ? { cursor: s.cursor } : {}) }, deps()));

  it('solves the best of each gender, then up to two more whose ceiling could beat the best found, highest first', () => {
    const picks = Object.fromEntries(step.options.map((o) => [o.key, [o.pick ?? null, o.status]]));
    expect(picks).toEqual({
      'M-str-lck': ['gender', 'solved'],
      'F-str-lck': ['gender', 'solved'],
      'F-spd-lck': ['ceiling', 'solved'],
      'M-mag-lck': ['ceiling', 'solved'],
      // Its ceiling (10%) can't beat the best found (60%): left to solve on request.
      'F-mag-lck': [null, 'open'],
    });
    expect(step.options.find((o) => o.key === 'F-mag-lck')).toMatchObject({ screened: true, ceiling: 0.1, spouse: 'frederick' });
  });

  it('reads each against the best solved on the same runs, with how its wishlist differs', () => {
    expect(step.reference).toBe('F-spd-lck');
    expect(step.solved.map((s) => [s.key, s.chance, s.cost?.gain === undefined ? null : Math.round(s.cost.gain * 100), s.cost?.verdict ?? null])).toEqual([
      ['F-spd-lck', 0.7, null, null],
      ['M-str-lck', 0.6, -10, 'worse'],
      ['M-mag-lck', 0.55, -15, 'worse'],
      ['F-str-lck', 0.5, -20, 'worse'],
    ]);
    expect(step.solved.find((s) => s.key === 'M-str-lck')!.differences).toEqual({
      marriages: { added: [['robin', 'sumia']], removed: [['robin', 'lonqu']] },
      units: { added: ['sumia'], removed: ['lonqu'] },
      classes: [],
    });
    expect(step.lockCost).toBeUndefined();
  });

  it('solves another on request, and the no-Robin view when asked', () => {
    const more = until((s) => robinStep({ ...input, run: undefined!, solve: ['F-mag-lck'], noRobin: true, cursor: (s ?? step).cursor }, deps()));
    expect(more.solved.find((s) => s.key === 'F-mag-lck')).toMatchObject({ pick: 'requested', chance: 0.1 });
    expect(more.noRobin!.spouse).toBe('lonqu');
    expect(more.noRobin!.chance).toBeCloseTo(0.65, 12);
    expect(more.noRobin!.cost.gain).toBeCloseTo(-0.05, 12);
    expect(more.noRobin!.plan.wishlist.marriages).toEqual([]);
  });

  it('once locked, solves only the locked Robin and reads the rest as what the lock cost', () => {
    const locked = until((s) => robinStep({ ...input, run: undefined!, cursor: (s ?? step).cursor }, deps(R('M', 'mag'))));
    expect(locked.reference).toBe('M-mag-lck');
    expect(locked.solved.map((s) => s.key)).toEqual(['M-mag-lck', 'F-spd-lck', 'M-str-lck', 'F-str-lck']);
    expect(locked.lockCost).toMatchObject({ key: 'F-spd-lck', verdict: 'better' });
    expect(locked.lockCost!.gain).toBeCloseTo(0.15, 12);
    // Locked from the start: nothing else is solved, every option still screened.
    const alone = until((s) => robinStep({ ...input, run: undefined!, ...(s ? { cursor: s.cursor } : {}) }, deps(R('F', 'mag'))));
    expect(alone.solved.map((s) => s.key)).toEqual(['F-mag-lck']);
    expect(alone.options.every((o) => o.screened)).toBe(true);
    expect(alone.lockCost).toBeUndefined();
  });
});

describe('the Robin alternatives and Lock on a recorded run (#201)', () => {
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag' });
  const fresh = runFromRoster(facts);
  const all = engine.mapOrder(fresh).steps.map((s) => s.map);
  const late = all.slice(0, -1).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
  const small = { seed: 3, runs: 2, cap: 4, display: 2, compare: 4, search: 6 } as const;
  const robin = { gender: 'M', asset: 'mag', flaw: 'def' } as const;
  const locked = withRobinLock(late, robin);

  it('screen every option, solve the best of the gender and up to two more, each with its cost and differences', () => {
    const step = until((s) => engine.robinAlternatives({ run: late, budget: 40, ...small, ...(s ? { cursor: s.cursor } : {}) }));
    expect(step.options).toHaveLength(7);
    expect(step.options.every((o) => o.screened)).toBe(true);
    const solved = step.options.filter((o) => o.status === 'solved');
    expect(solved.filter((o) => o.pick === 'gender')).toHaveLength(1);
    expect(solved.filter((o) => o.pick === 'ceiling').length).toBeLessThanOrEqual(ROBIN_EXTRA);
    const [best, ...rest] = step.solved;
    expect(step.reference).toBe(best!.key);
    for (const s of rest) {
      expect(s.plan.robin).toEqual(s.robin);
      expect(s.cost!.runs).toBe(small.compare);
      expect(s.differences).toEqual(wishlistDifference(best!.plan, s.plan));
    }

    // Locked: the alternatives solved before stay, each read against the locked Robin.
    const after = until((s) => engine.robinAlternatives({ run: locked, budget: 40, ...small, cursor: (s ?? step).cursor }));
    expect(after.reference).toBe(robinKey(robin));
    expect(after.solved.map((s) => s.key).sort()).toEqual([...new Set([...step.solved.map((s) => s.key), robinKey(robin)])].sort());
    expect(after.solved.find((s) => s.key === robinKey(robin))!.plan.robin).toEqual(robin);
  });

  it('writes the locked Robin into the run facts and pins it; lifting it opens the facts it filled again', () => {
    expect(locked.roster.run).toMatchObject(robin);
    expect(engine.pins(locked)).toContainEqual({ kind: 'robin-lock', robin, open: ['flaw'] });
    expect(importRun(exportRun(locked)).pins).toEqual(locked.pins);
    expect(engine.seedPlan(locked).robin).toEqual(robin);
    const lifted = engine.liftPins(locked);
    expect(lifted.roster.run).toMatchObject({ gender: 'M', asset: 'mag', flaw: null });
    expect(lifted.pins ?? []).toEqual([]);
    // Locking again replaces it, still opening only what the first lock filled; facts changed by hand since drop it.
    expect(withRobinLock(locked, { ...robin, flaw: 'res' }).pins).toEqual([{ kind: 'robin-lock', robin: { ...robin, flaw: 'res' }, open: ['flaw'] }]);
    expect(engine.pins({ ...locked, roster: withRun(locked.roster, { flaw: 'spd' }) }).some((p) => p.kind === 'robin-lock')).toBe(false);
  });
});
