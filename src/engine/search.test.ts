import { describe, expect, it } from 'vitest';
import { editCost, solveStep, type Edit, type EditKind, type SearchDeps, type SolveStepInput } from './solve/step';
import type { Plan } from './solve/plan';
import type { FlawlessChance } from './flawless';
import type { Run } from './run';

/**
 * The local search's stepping (#199) on a made-up objective: plans are named, each has a known chance, and a run's
 * chance is that plus noise shared by every plan on the same run (common random numbers), so the answers can be worked
 * by hand. The engine's own edits and simulation are tested through the facade (seed.test.ts).
 */
const plan = (name: string): Plan => ({
  robin: { gender: 'M', asset: 'mag', flaw: 'hp' },
  wishlist: { endpoint: name, units: [], marriages: [], children: [], reserves: [] },
  roadmap: { order: [], lineups: [], seals: [], items: [] },
});
const nameOf = (p: Plan) => p.wishlist.endpoint;

/** Each plan's chance, the noise every plan shares on a run, and a plan whose own noise averages out. */
const BASE: Record<string, number> = { start: 0.5, better: 0.7, even: 0.5, worse: 0.2, lowCeiling: 0.45, best2: 0.8, fix: 0.45, fixBetter: 0.72, broken: 0.99, same: 0.5 };
const shared = (r: number) => ((r * 7919) % 11) / 50 - 0.1;
const own = (name: string, r: number) => (name === 'even' ? (r % 2 ? 0.3 : -0.3) : 0);

type Calls = { samples: string[]; rescores: { plan: string; seed: number; runs: number }[] };

function fake(edits: Record<string, [EditKind, string][]>, ceilings: Record<string, number> = {}, stuck: Record<string, number> = {}): { deps: SearchDeps; calls: Calls } {
  const calls: Calls = { samples: [], rescores: [] };
  const deps: SearchDeps = {
    seed: () => plan('start'),
    edits: function* (p) {
      for (const [kind, to] of edits[nameOf(p)] ?? []) yield { kind, key: `${kind}:${to}`, label: `to ${to}`, make: () => plan(to) } satisfies Edit;
    },
    samples: (p, first, count) => {
      calls.samples.push(nameOf(p));
      return Array.from({ length: count }, (_, i) => Math.min(1, Math.max(0, BASE[nameOf(p)]! + shared(first + i) + own(nameOf(p), first + i))));
    },
    rescore: (p, seed, runs) => {
      calls.rescores.push({ plan: nameOf(p), seed, runs });
      return { chance: BASE[nameOf(p)]!, margin: 0, runs, samples: [], maps: [{ key: 'm1', label: 'M1', reach: 1, noDeath: BASE[nameOf(p)]!, lineup: undefined, turns: 1, gold: undefined }] } as unknown as FlawlessChance;
    },
    ceiling: (p) => ceilings[nameOf(p)],
    nonStarters: (p) => Array.from({ length: stuck[nameOf(p)] ?? 0 }, (_, i) => [`a${i}`, `b${i}`] as unknown as readonly ['chrom', 'sumia']),
    // 'same' reads exactly as the start does.
    simKey: (p) => (nameOf(p) === 'same' ? 'start' : nameOf(p)),
  };
  return { deps, calls };
}

const run = {} as Run;
const input = (more: Partial<SolveStepInput> = {}): SolveStepInput => ({ run, budget: 1000, seed: 7, runs: 4, cap: 16, ...more });

describe('the local search (#199)', () => {
  const edits: Record<string, [EditKind, string][]> = {
    start: [['pass', 'worse'], ['lineup', 'even'], ['pair', 'better']],
    better: [['pass', 'worse'], ['lineup', 'even'], ['place', 'best2']],
  };

  it('keeps an edit whose gain beats twice the paired error, as a proposal on the adopted plan', () => {
    const adopted = plan('start');
    const frozen = structuredClone(adopted);
    const { deps } = fake(edits);
    const step = solveStep(input({ plan: adopted }), deps, 6);
    expect(nameOf(step.best)).toBe('best2');
    // Best first, each with its gain over the adopted plan on the same runs: the shared noise cancels exactly.
    expect(step.proposals.map((p) => [nameOf(p.plan), p.edits])).toEqual([
      ['best2', ['to better', 'to best2']],
      ['better', ['to better']],
    ]);
    expect(step.proposals[0]!.gain).toBeCloseTo(0.3, 12);
    expect(step.proposals[0]!.margin).toBeCloseTo(0, 12);
    // Never replaced: the adopted plan is as it was.
    expect(adopted).toEqual(frozen);
    expect(step.converged).toBe(true);
  });

  it('reads an edit still unclear at the run cap as a close call, and drops a worse one at once', () => {
    const { deps, calls } = fake(edits);
    const step = solveStep(input(), deps, 6);
    const close = step.closeCalls.filter((c) => nameOf(c.plan) === 'even');
    expect(close.length).toBeGreaterThan(0);
    for (const c of close) {
      expect(c.runs).toBe(16);
      expect(Math.abs(c.gain)).toBeLessThanOrEqual(2 * (c.margin / 1.96));
    }
    expect(step.closeCalls.some((c) => nameOf(c.plan) === 'worse')).toBe(false);
    expect(step.proposals.some((p) => nameOf(p.plan) === 'worse')).toBe(false);
    // The worse edit took one comparison: 4 runs each time it was tried, never doubled.
    const worseRuns = calls.samples.filter((n) => n === 'worse').length;
    expect(worseRuns).toBeLessThanOrEqual(2 * 2);
  });

  it('shows the best plan’s chance re-scored on fresh runs, each time the best plan changes', () => {
    const { deps, calls } = fake(edits);
    const first = solveStep(input({ budget: 1 }), deps, 6);
    // The first piece is the re-score (it may overrun a small budget): the headline comes first.
    expect(first.chance?.chance).toBe(0.5);
    expect(first.evaluations).toBe(6);
    expect(calls.rescores).toHaveLength(1);
    const all = fake(edits);
    solveStep(input(), all.deps, 6);
    expect(all.calls.rescores.map((r) => r.plan)).toEqual(['start', 'better', 'best2']);
    for (const r of all.calls.rescores) {
      expect(r.seed).not.toBe(7);
      expect(r.runs).toBe(6);
    }
  });

  it('prunes a set of marriages whose ceiling is below the best found, without simulating it', () => {
    const { deps, calls } = fake({ start: [['marriage', 'lowCeiling'], ['pair', 'better']] }, { lowCeiling: 0.3, better: 0.9 });
    const step = solveStep(input(), deps, 6);
    expect(step.pruned).toEqual([{ label: 'to lowCeiling', ceiling: 0.3, best: expect.closeTo(0.5, 1) }]);
    expect(calls.samples).not.toContain('lowCeiling');
    // A ceiling above the best found is tried.
    const kept = fake({ start: [['marriage', 'better']] }, { better: 0.9 });
    expect(nameOf(solveStep(input(), kept.deps, 6).best)).toBe('better');
  });

  it('fixes a non-starter first, never takes one more, and never proposes a plan with one (#194)', () => {
    const stuck = { start: 1, better: 1, broken: 2 };
    const { deps, calls } = fake({ start: [['lineup', 'broken'], ['pair', 'better'], ['place', 'fix']], better: [['place', 'fixBetter']] }, {}, stuck);
    const step = solveStep(input(), deps, 6);
    expect(calls.samples).not.toContain('broken');
    expect(deps.nonStarters!(step.best)).toHaveLength(0);
    expect(step.proposals.length).toBeGreaterThan(0);
    for (const p of step.proposals) expect(deps.nonStarters!(p.plan)).toHaveLength(0);
    for (const c of step.closeCalls) expect(deps.nonStarters!(c.plan)).toHaveLength(0);
  });

  it('reads an edit the simulation can’t see as a close call, at no cost', () => {
    const { deps, calls } = fake({ start: [['build', 'same']] });
    const step = solveStep(input(), deps, 6);
    expect(calls.samples).not.toContain('same');
    expect(step.closeCalls).toEqual([expect.objectContaining({ label: 'to same', gain: 0, margin: 0, runs: 0 })]);
    expect(step.converged).toBe(true);
  });

  it('resumes from its cursor: many small steps reach what one big step does', () => {
    const one = solveStep(input(), fake(edits).deps, 6);
    const { deps } = fake(edits);
    let step = solveStep(input({ budget: 5 }), deps, 6);
    for (let i = 0; i < 400 && !step.converged; i++) step = solveStep(input({ budget: 5, cursor: JSON.parse(JSON.stringify(step.cursor)) }), deps, 6);
    expect(step.converged).toBe(true);
    expect(step.best).toEqual(one.best);
    expect(step.proposals).toEqual(one.proposals);
    expect(step.closeCalls).toEqual(one.closeCalls);
    expect(step.cursor.evaluations).toBe(one.cursor.evaluations);
  });

  it('spends nothing on a budget of 0, and nothing more once converged', () => {
    const { deps, calls } = fake(edits);
    const none = solveStep(input({ budget: 0 }), deps, 6);
    expect(none).toMatchObject({ evaluations: 0, converged: false, proposals: [], chance: undefined });
    expect(calls.samples).toEqual([]);
    const done = solveStep(input(), deps, 6);
    const again = solveStep(input({ cursor: done.cursor }), deps, 6);
    expect(again.evaluations).toBe(0);
    expect(again.best).toEqual(done.best);
  });
});

describe('an edit’s cost (#199)', () => {
  const samples = fake({}).deps.samples;
  const cost = (edited: string, budget: number) => editCost({ run, plan: plan('start'), edited: plan(edited), seed: 7, budget, runs: 4, cap: 16 }, samples);

  it('is provisional on a small budget, then settled', () => {
    const provisional = cost('even', 4);
    expect(provisional).toMatchObject({ runs: 2, settled: false, verdict: 'unclear' });
    expect(cost('even', 32)).toMatchObject({ runs: 16, settled: true, verdict: 'close' });
  });

  it('settles as soon as it’s clear either way', () => {
    expect(cost('better', 32)).toMatchObject({ runs: 4, settled: true, verdict: 'better', gain: expect.closeTo(0.2, 12) });
    expect(cost('worse', 32)).toMatchObject({ runs: 4, settled: true, verdict: 'worse' });
  });
});
