import { describe, expect, it } from 'vitest';
import {
  EMPTY_CHECKED_RULES,
  EMPTY_ROSTER,
  addEntry,
  createEngine,
  editEntry,
  latestEntry,
  recordFallen,
  runFromRoster,
  withPin,
  withRun,
  type ChecksStep,
  type EditsStep,
  type Plan,
  type PlanPin,
  type ReadingsStep,
  type RosterUnit,
  type Run,
} from './index';

/**
 * The Web Worker's jobs as the facade's stepping calls (#175, Engine interfaces: the worker holds no logic), driven as
 * the worker drives them: each call's cursor handed to the next until one says it's done.
 */
const engine = createEngine();
const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', mode: 'classic', gender: 'M', asset: 'mag', flaw: 'hp' });
const all = engine.mapOrder(runFromRoster(facts)).steps.map((s) => s.map);
/** Every map but the last two (Chapter 25, then Endgame) recorded, every unit Lv 10 with the same fair stats: each run is cheap. */
const late: Run = (() => {
  const played = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
  const stats = { hp: 50, str: 26, mag: 26, skl: 28, spd: 28, lck: 22, def: 22, res: 20 };
  return editEntry(played, latestEntry(played)!.id, (s) => ({ ...s, units: Object.fromEntries(Object.entries(s.units).map(([u, x]) => [u, { ...x!, level: 10, stats: x!.stats && stats }])) }), 1);
})();
const seed = engine.seedPlan(late);
const small = { seed: 3, runs: 2, cap: 4, display: 2 } as const;

/** Every step of a stepping call, from its first to the one marked done (at most `max`). */
function drive<S extends { readonly done: boolean; readonly cursor: unknown }>(first: S, next: (s: S) => S, max = 200): S[] {
  const out = [first];
  while (!out.at(-1)!.done && out.length < max) out.push(next(out.at(-1)!));
  return out;
}

describe('the pin cost, stepped (#200)', () => {
  const pins: PlanPin[] = [{ kind: 'marriage', couple: ['vaike', 'sully'] }];
  const run = pins.reduce(withPin, late);
  const plan = engine.solveStep({ run, budget: 0, ...small }).best;

  it('searches with the pins lifted from the plan found with them, and prices the best found once the time is spent', () => {
    const first = engine.pinCostStep({ run, plan, budget: 4, ...small });
    expect(first.cost).toBeUndefined();
    expect(first.cursor.search?.evaluations).toBeGreaterThan(0);
    const stopped = engine.pinCostStep({ run, plan, budget: 4, ...small, cursor: first.cursor, stop: true });
    expect(stopped.cursor).toBe(first.cursor);
    expect(stopped.cost).toEqual(engine.pinCost({ run, plan, lifted: first.cursor.best, seed: small.seed, budget: 2 * small.cap, runs: small.runs, cap: small.cap }));
    expect(stopped.cost!.pins).toEqual(engine.pins(run));
  });

  it('prices one pin on request', () => {
    const one = engine.pinCostStep({ run, lift: pins, plan, budget: 4, ...small, stop: true });
    expect(one.cost!.pins).toEqual(pins);
  });
});

describe('the loss’s re-solve, stepped (#208)', () => {
  const victim = seed.wishlist.units.map((w) => w.unit).find((u) => u !== 'chrom' && u !== 'robin') as RosterUnit;
  const dead = recordFallen(late, latestEntry(late)!.id, victim, 2);

  it('is done at once with no loss open', () => {
    expect(engine.lossStep({ run: late, plan: seed, budget: 4, ...small })).toEqual({ cursor: undefined, done: true });
  });

  it('searches from the loss item’s proposal and ends with its best plan and chance', () => {
    const input = { run: dead, plan: seed, budget: 4, ...small };
    const steps = drive(engine.lossStep(input), (s) => engine.lossStep({ ...input, cursor: s.cursor!, stop: true }));
    const last = steps.at(-1)!;
    expect(last.cursor!.from).toEqual(engine.lossItem(dead, seed)!.plan);
    expect(last.result?.plan).toBe(last.cursor!.best);
    expect(last.result?.plan.wishlist.units.map((w) => w.unit)).not.toContain(victim);
  });
});

describe('edit costs, stepped (#203, #204)', () => {
  const unit = seed.wishlist.units.find((w) => w.unit !== 'chrom' && w.unit !== 'robin')!.unit;
  const edits = engine.unitEdits(late, seed, unit, { seed: small.seed });
  const costs = (steps: readonly EditsStep[]) => steps.flatMap((s) => (s.kind === 'edit-cost' ? [s] : []));

  it('lists a unit’s edits first, then costs the likeliest first: keeping it in or out', () => {
    const input = { run: late, plan: seed, unit, seed: small.seed, budgets: [4] };
    const listed = engine.unitEditsStep(input);
    expect(listed).toMatchObject({ kind: 'edits', edits: edits.map(({ kind, key, label, pins }) => ({ kind, key, label, pins })), done: false });
    const first = engine.unitEditsStep({ ...input, cursor: listed.cursor });
    const keep = edits.find((e) => e.kind === 'keep')!;
    expect(first).toMatchObject({ kind: 'edit-cost', key: keep.key, done: false });
    expect(first.kind === 'edit-cost' && first.cost).toEqual(engine.editCost({ run: late, plan: seed, edited: keep.make(), pins: keep.play, seed: small.seed, budget: 4 }));
  });

  it('costs each edit at each budget in turn, then lists them again, done', () => {
    // A build skill edit is costed on the runs (they equip builds), like a keep edit: neither settles on 2 runs.
    const build = edits.find((e) => e.kind === 'build')!;
    const keep = edits.find((e) => e.kind === 'keep')!;
    const input = { run: late, plan: seed, keys: [build.key, keep.key], seed: small.seed, budgets: [4, 4] };
    const steps = drive(engine.editChoicesStep(input), (s) => engine.editChoicesStep({ ...input, cursor: s.cursor }));
    expect(steps.map((s) => (s.kind === 'edit-cost' ? `${s.key}:${s.cost.settled}` : s.kind))).toEqual(['edits', `${build.key}:false`, `${keep.key}:false`, `${build.key}:false`, `${keep.key}:false`, 'edits']);    expect(steps.at(-1)!.done).toBe(true);
  });

  it('lists every edit the player can make, done at once when none is asked', () => {
    const steps = drive(engine.editChoicesStep({ run: late, plan: seed, keys: [], seed: small.seed, budgets: [4] }), () => {
      throw new Error('asked for nothing');
    });
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ kind: 'edits', done: true });
  });

  it('costs the edits asked for in the order asked, each with its edited plan', () => {
    const choices = engine.editChoices(late, seed, { seed: small.seed });
    const keys = choices.filter((c) => c.kind === 'keep').slice(0, 2).map((c) => c.key).reverse();
    const input = { run: late, keys, seed: small.seed, budgets: [4] };
    const steps = drive(engine.editChoicesStep(input), (s) => engine.editChoicesStep({ ...input, cursor: s.cursor }));
    expect(steps.map((s) => s.kind)).toEqual(['edits', 'edit-cost', 'edit-cost', 'edits']);
    expect(costs(steps).map((c) => c.key)).toEqual(keys);
    const asked = choices.find((c) => c.key === keys[0])!;
    expect(costs(steps)[0]!.edited).toEqual(asked.make());
  });
});

describe('the checks, stepped (#209)', () => {
  it('reads each open rule’s stakes, those the model doesn’t read first, then the setup checks', () => {
    const input = { run: late, plan: seed, rules: EMPTY_CHECKED_RULES, seed: small.seed, budgets: [4], runs: 1 };
    const steps: ChecksStep[] = drive(engine.checksStep(input), (s) => engine.checksStep({ ...input, cursor: s.cursor }));
    const stakes = steps.flatMap((s) => (s.kind === 'stake' ? [s.stake] : []));
    const open = engine.openRules(EMPTY_CHECKED_RULES).filter((r) => r.state === 'open');
    expect(stakes.map((s) => s.rule).sort()).toEqual(open.map((r) => r.rule.id).sort());
    const modelled = stakes.map((s) => s.modelled);
    expect(modelled).toEqual([...modelled].sort((a, b) => Number(a) - Number(b)));
    expect(modelled).toContain(true);
    expect(stakes.find((s) => s.modelled)).toEqual(engine.ruleStakes(late, seed, stakes.find((s) => s.modelled)!.rule, { seed: small.seed, runs: 1 }));
    const setup = steps.find((s) => s.kind === 'setup')!;
    expect(setup.kind === 'setup' && setup.checks).toEqual(engine.setupChecks(late, seed, { rules: EMPTY_CHECKED_RULES, stakes, seed: small.seed }));
    expect(steps.at(-1)).toMatchObject({ kind: 'setup', done: true });
  });
});

describe('the readings, stepped (#197)', () => {
  const plan: Plan = seed;

  it('start from the EXP forecast’s first pass, keeping the milestones still pending; stopped, they stand as they are', () => {
    // (Each pending milestone's suggested changes take seconds even on one run: not stepped here.)
    const input = { run: late, plan, seed: small.seed, runs: 2, suggestRuns: 1 };
    const first = engine.readingsStep(input);
    const forecast = engine.expForecast(late, plan, { seed: small.seed, runs: 2 });
    expect(first.readings).toEqual(engine.readings(late, plan, { seed: small.seed, forecast }));
    expect(first.readings!.pending.length).toBeGreaterThan(0);
    expect(first).toMatchObject({ done: false, cursor: { pending: first.readings!.pending, suggestions: {} } });
    // The time budget spent: the readings as they stand.
    const stopped: ReadingsStep = engine.readingsStep({ ...input, cursor: first.cursor!, stop: true });
    expect(stopped).toMatchObject({ readings: first.readings, done: true });
    // Every pending milestone read: done, nothing more to ask.
    const read = { ...first.cursor!, suggestions: Object.fromEntries(first.readings!.pending.map((id) => [id, []])) };
    expect(engine.readingsStep({ ...input, cursor: read })).toMatchObject({ readings: first.readings, done: true });
  });

  it('are none once the endpoint is recorded', () => {
    const done = all.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
    expect(engine.readingsStep({ run: done, plan: engine.seedPlan(done), seed: small.seed })).toEqual({ readings: undefined, cursor: undefined, done: true });
  });
});
