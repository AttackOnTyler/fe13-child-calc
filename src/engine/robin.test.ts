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
  type RobinStep,
} from './index';

/**
 * The Robin alternatives and the Robin Lock (#201), through the facade on a recorded run. The late Main story run (only
 * Endgame left) with Robin's gender and asset set keeps it small: its seven flaws are the options.
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

describe('the Robin alternatives and Lock on a recorded run (#201)', () => {
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag' });
  const fresh = runFromRoster(facts);
  const all = engine.mapOrder(fresh).steps.map((s) => s.map);
  const late = all.slice(0, -1).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
  const small = { seed: 3, runs: 2, cap: 4, display: 2, compare: 4, search: 6 } as const;
  const robin = { gender: 'M', asset: 'mag', flaw: 'def' } as const;
  const locked = withRobinLock(late, robin);

  let first: RobinStep | undefined;
  const alternatives = () => (first ??= until((s) => engine.robinAlternatives({ run: late, budget: 40, ...small, ...(s ? { cursor: s.cursor } : {}) })));

  it('screen every option, solve the best of the gender and up to two more, each with its cost and differences', () => {
    const step = alternatives();
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
    // What the lock cost names a solved alternative that does better.
    if (after.lockCost) {
      expect(after.solved.slice(1).map((s) => s.key)).toContain(after.lockCost.key);
      expect(after.lockCost.gain).toBeGreaterThan(0);
    }
  });

  it('pick the extras by ceiling, highest first: no option left open has a higher ceiling than one picked', () => {
    const step = alternatives();
    const extras = step.options.filter((o) => o.pick === 'ceiling').map((o) => o.ceiling!);
    const open = step.options.filter((o) => o.status === 'open' && o.ceiling !== undefined).map((o) => o.ceiling!);
    if (extras.length) for (const c of open) expect(c).toBeLessThanOrEqual(Math.min(...extras));
    // The solved Robins: the reference first, then by chance.
    const chances = step.solved.slice(1).map((s) => s.chance);
    expect(chances).toEqual([...chances].sort((a, b) => b - a));
  });

  it('solve another on request, and the no-Robin view when asked', () => {
    const step = alternatives();
    const open = step.options.find((o) => o.status === 'open')!;
    const more = until((s) => engine.robinAlternatives({ run: late, budget: 40, ...small, solve: [open.key], noRobin: true, cursor: (s ?? step).cursor }));
    expect(more.solved.find((s) => s.key === open.key)).toMatchObject({ pick: 'requested', robin: open.robin });
    // The no-Robin view is the reference's plan with Robin no one's parent; an unmarried reference has none to show.
    const married = more.solved[0]!.plan.wishlist.marriages.some((c) => c.includes('robin'));
    if (!married) return void expect(more.noRobin).toBeUndefined();
    const noRobin = more.noRobin!;
    expect(noRobin.plan.wishlist.marriages.some((c) => c.includes('robin'))).toBe(false);
    expect(noRobin.plan.robin).toEqual(more.solved[0]!.robin);
    expect(noRobin.cost.runs).toBe(small.compare);
  });

  it('locked from the start, solve only the locked Robin, every option still screened', () => {
    const alone = until((s) => engine.robinAlternatives({ run: locked, budget: 40, ...small, ...(s ? { cursor: s.cursor } : {}) }));
    expect(alone.solved.map((s) => s.key)).toEqual([robinKey(robin)]);
    expect(alone.options.every((o) => o.screened)).toBe(true);
    expect(alone.lockCost).toBeUndefined();
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
