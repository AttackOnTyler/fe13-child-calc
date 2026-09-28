import { describe, expect, it } from 'vitest';
import type { FlawlessChance } from './flawless';
import type { Plan, PlanRobin } from './solve/plan';
import { robinKey, robinStep, type RobinStep } from './solve/robin';
import { solveStep, type SearchDeps, type SolveStep } from './solve/step';

/**
 * At 0% the plans are ranked by how far runs get (#242): with every run lost somewhere, the flawless chance reads 0 ±0
 * for every plan, so the search and the Robin alternatives compare the maps the runs clear with nobody lost instead.
 * Hand-built plans and runs: every run is lost, some further along than others.
 */
const planOf = (id: string, robin: PlanRobin = { gender: 'M', asset: 'str', flaw: 'hp' }): Plan => ({ robin, wishlist: { marriages: [], units: [] }, roadmap: { id } }) as unknown as Plan;
const idOf = (p: Plan) => (p.roadmap as unknown as { id: string }).id;
// Each run clears the plan's maps, give or take a little by run (so the paired error isn't 0).
const noise = (i: number) => (i % 3) * 0.1;
const zeros = (n: number) => Array.from({ length: n }, () => 0);
const runs = (maps: number, turns: number) => (first: number, count: number) => ({
  samples: zeros(count),
  turns: Array.from({ length: count }, (_, k) => turns + noise(first + k)),
  cleared: Array.from({ length: count }, (_, k) => maps + noise(first + k)),
});

describe('the search at 0% (#242)', () => {
  // A: the start. B: runs get 2 maps further. C: runs die a map sooner, in far fewer turns (fewer turns: they die sooner).
  const plans: Record<string, { maps: number; turns: number }> = { A: { maps: 3, turns: 40 }, B: { maps: 5, turns: 60 }, C: { maps: 2, turns: 20 } };
  const deps: SearchDeps = {
    seed: () => planOf('A'),
    edits: () => ['B', 'C'].map((id) => ({ kind: 'lineup' as const, key: id, label: `Plan ${id}`, make: () => planOf(id) })),
    samples: (plan, first, count) => runs(plans[idOf(plan)]!.maps, plans[idOf(plan)]!.turns)(first, count).samples,
    play: (plan, first, count) => runs(plans[idOf(plan)]!.maps, plans[idOf(plan)]!.turns)(first, count),
    rescore: () => ({ maps: [] }) as unknown as FlawlessChance,
    ceiling: () => undefined,
  };
  const solve = (): SolveStep => {
    let s = solveStep({ run: {} as never, budget: 1000, seed: 1, runs: 4, cap: 8, display: 1 }, deps, 1);
    for (let i = 0; i < 20 && !s.converged; i++) s = solveStep({ run: {} as never, budget: 1000, seed: 1, runs: 4, cap: 8, display: 1, cursor: s.cursor }, deps, 1);
    return s;
  };

  it('takes the plan whose runs get further, a tie on the flawless chance', () => {
    const s = solve();
    expect(idOf(s.best)).toBe('B');
    const p = s.proposals.find((x) => x.label === 'Plan B')!;
    expect(p.close).toBe(true);
    expect(p.cleared!.gain).toBeCloseTo(2, 6);
    expect(p.cleared!.margin).toBeLessThan(2);
  });

  it('never takes a plan for fewer turns when its runs die sooner, and says how much sooner', () => {
    const s = solve();
    expect(s.proposals.some((x) => x.label === 'Plan C')).toBe(false);
    const c = s.closeCalls.find((x) => x.key === 'C')!;
    // Against B, the best: 3 maps less far.
    expect(c.cleared!.gain).toBeCloseTo(-3, 6);
    expect(c.turns).toBeUndefined();
  });
});

describe('the Robin alternatives at 0% (#242)', () => {
  const robins: PlanRobin[] = (['mag', 'skl', 'spd', 'lck', 'def'] as const).map((asset) => ({ gender: 'M', asset, flaw: 'hp' }));
  // The seed's ceilings: only some Robins could get a run through at all.
  const ceilings = [0, 0, 0.05, 0.02, 0.01];
  const far: Record<string, number> = Object.fromEntries(robins.map((r, i) => [robinKey(r), [3, 1, 6, 4, 2][i]!]));
  const step = (): RobinStep => {
    const deps = {
      options: robins,
      locked: undefined,
      genders: ['M'] as const,
      genderBest: () => robins[0]!,
      screen: (r: PlanRobin) => ({ plan: planOf('seed', r), ceiling: ceilings[robins.findIndex((x) => robinKey(x) === robinKey(r))] }),
      solve: (r: PlanRobin) => ({ best: planOf(robinKey(r), r), converged: true, evaluations: 1, cursor: { evaluations: 1 } }) as unknown as SolveStep,
      samples: (_r: PlanRobin, _p: Plan, _first: number, count: number) => zeros(count),
      play: (r: PlanRobin, _p: Plan, first: number, count: number) => {
        const x = runs(far[robinKey(r)]!, 0)(first, count);
        return { samples: x.samples, cleared: x.cleared };
      },
      noRobin: (_r: PlanRobin, p: Plan) => p,
    };
    let s = robinStep({ run: {} as never, seed: 1, budget: 1000, compare: 6 }, deps);
    for (let i = 0; i < 20 && !s.converged; i++) s = robinStep({ run: {} as never, seed: 1, budget: 1000, compare: 6, cursor: s.cursor }, deps);
    return s;
  };

  it('ranks the solved Robins by how far their runs get, and costs each on it', () => {
    const s = step();
    // The best of the gender (mag), then the extras by ceiling (spd, lck): spd's runs get furthest.
    expect(s.solved.map((x) => x.robin.asset)).toEqual(['spd', 'lck', 'mag']);
    expect(s.reference).toBe(robinKey(robins[2]!));
    expect(s.solved[0]!.cleared).toBeCloseTo(6.1, 6);
    const mag = s.solved.find((x) => x.robin.asset === 'mag')!;
    expect(mag.cost).toMatchObject({ gain: 0, verdict: 'close' });
    expect(mag.cost!.cleared).toMatchObject({ verdict: 'worse' });
    expect(mag.cost!.cleared!.gain).toBeCloseTo(-3, 6);
  });

  it('says how many unsolved Robins could still get a run through: their ceiling is above 0%', () => {
    const s = step();
    // Unsolved: skl (ceiling 0%) and def (ceiling 1%).
    expect(s.atZero).toEqual({ unsolved: 2, couldGetThrough: 1 });
  });
});

describe('the Robin alternatives at 100% (#242)', () => {
  // Every run of every Robin gets through: the flawless chance can't rank them, so fewer turns does (the search's tie).
  const robins: PlanRobin[] = (['mag', 'skl', 'spd'] as const).map((asset) => ({ gender: 'M', asset, flaw: 'hp' }));
  const turns: Record<string, number> = Object.fromEntries(robins.map((r, i) => [robinKey(r), [40, 50, 30][i]!]));
  const ones = (n: number) => Array.from({ length: n }, () => 1);
  const step = (): RobinStep => {
    const deps = {
      options: robins,
      locked: undefined,
      genders: ['M'] as const,
      genderBest: () => robins[0]!,
      screen: (r: PlanRobin) => ({ plan: planOf('seed', r), ceiling: 1 }),
      solve: (r: PlanRobin) => ({ best: planOf(robinKey(r), r), converged: true, evaluations: 1, cursor: { evaluations: 1 } }) as unknown as SolveStep,
      samples: (_r: PlanRobin, _p: Plan, _first: number, count: number) => ones(count),
      play: (r: PlanRobin, _p: Plan, first: number, count: number) => {
        const x = runs(20, turns[robinKey(r)]!)(first, count);
        return { samples: ones(count), cleared: x.cleared, turns: x.turns };
      },
      noRobin: (_r: PlanRobin, p: Plan) => p,
    };
    let s = robinStep({ run: {} as never, seed: 1, budget: 1000, compare: 6 }, deps);
    for (let i = 0; i < 20 && !s.converged; i++) s = robinStep({ run: {} as never, seed: 1, budget: 1000, compare: 6, cursor: s.cursor }, deps);
    return s;
  };

  it('ranks the solved Robins by fewer expected turns, and says so', () => {
    const s = step();
    expect(s.solved.map((x) => x.robin.asset)).toEqual(['spd', 'mag', 'skl']);
    expect(s.reference).toBe(robinKey(robins[2]!));
    expect(s.solved[0]!.turns).toBeCloseTo(30.1, 6);
    expect(s.atFull).toBe(true);
    expect(s.atZero).toBeUndefined();
  });
});
