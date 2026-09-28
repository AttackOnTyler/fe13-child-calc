import { describe, expect, it } from 'vitest';
import {
  EMPTY_ROSTER,
  addEntry,
  createEngine,
  exportRun,
  importRun,
  pinKey,
  proposalId,
  runFromRoster,
  withDismissedProposal,
  withEdit,
  withRun,
  withoutEdit,
  type Plan,
  type PlanPin,
} from './index';

/**
 * The adopted plan and the player's edits (#204), through the facade: where they live on the run, how an edit is made
 * and undone, what the solve starts from, and every edit the inbox's "anything else" search offers.
 */
const engine = createEngine();
const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
const fresh = runFromRoster(facts);
// Two maps left (Chapter 25, then Endgame): the seed and each run are cheap.
const all = engine.mapOrder(fresh).steps.map((s) => s.map);
const late = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
const seed = engine.seedPlan(late);
/** The seed with a build skill swapped: a plan edit. */
const edited = (plan: Plan, skill: string): Plan => ({ ...plan, wishlist: { ...plan.wishlist, units: plan.wishlist.units.map((w, i) => (i === 0 ? { ...w, build: [skill as never, ...w.build.slice(1)] } : w)) } });
const keepOut: PlanPin = { kind: 'keep', unit: 'frederick', keep: 'out' };

describe('the player’s edits on the run (#204)', () => {
  it('sets an edit’s pins, and undo lifts them', () => {
    const run = withEdit(late, { label: 'Keep Frederick out of the wishlist', pins: [keepOut] });
    expect(run.pins?.map(pinKey)).toEqual(['keep:frederick']);
    expect(run.edits).toEqual([{ label: 'Keep Frederick out of the wishlist', pins: [keepOut] }]);
    expect(run.adopted).toBeUndefined();
    const undone = withoutEdit(run, 0);
    expect(undone.pins ?? []).toEqual([]);
    expect(undone.edits).toBeUndefined();
  });

  it('adopts a plan edit’s plan, and undo restores the plan it replaced, dropping the plan edits made on it', () => {
    const a = edited(seed, 'luna');
    const b = edited(a, 'sol');
    const run = withEdit(withEdit(withEdit(late, { label: 'A', plan: a }), { label: 'Keep Frederick out of the wishlist', pins: [keepOut] }), { label: 'B', plan: b, cost: { gain: -0.01, margin: 0.02, verdict: 'close' } });
    expect(run.adopted).toBe(b);
    expect(run.edits?.map((e) => e.label)).toEqual(['A', 'Keep Frederick out of the wishlist', 'B']);
    expect(withoutEdit(run, 2).adopted).toBe(a);
    const first = withoutEdit(run, 0);
    expect(first.adopted).toBeUndefined();
    // B was made on A: it goes with it; the pin stays.
    expect(first.edits?.map((e) => e.label)).toEqual(['Keep Frederick out of the wishlist']);
    expect(first.pins?.map(pinKey)).toEqual(['keep:frederick']);
  });

  it('keeps the adopted plan, the edits and the dismissed proposals with the run', () => {
    const run = withDismissedProposal(withEdit(late, { label: 'A', plan: edited(seed, 'luna'), accepted: true }), proposalId({ edits: ['Vaike marries Sully', 'Stahl marries Miriel'] }));
    const back = importRun(exportRun(run));
    expect(back.adopted).toEqual(run.adopted);
    expect(back.edits).toEqual([{ label: 'A', before: null, accepted: true }]);
    expect(back.dismissedProposals).toEqual(['Vaike marries Sully · Stahl marries Miriel']);
    // Something that isn't a plan is dropped.
    expect(importRun(JSON.stringify({ ...JSON.parse(exportRun(run)), adopted: { robin: {} } })).adopted).toBeUndefined();
  });
});

describe('the adopted plan (#204)', () => {
  it('is the seed until one is adopted, then the solve starts from it', () => {
    expect(engine.adoptedPlan(late)).toEqual(seed);
    const a = edited(seed, 'luna');
    const run = withEdit(late, { label: 'A', plan: a });
    expect(engine.adoptedPlan(run)).toEqual(a);
    const step = engine.solveStep({ run, plan: engine.adoptedPlan(run), budget: 0, seed: 1 });
    expect(step.best).toEqual(a);
  });

  it('gives way to the seed when its Robin contradicts the run facts', () => {
    const a = { ...edited(seed, 'luna'), robin: { ...seed.robin, asset: 'str' as const } };
    expect(engine.adoptedPlan(withEdit(late, { label: 'A', plan: a }))).toEqual(seed);
  });
});

describe('every edit the “anything else” search offers (#204)', () => {
  // Twelve maps left: marriages still open.
  const mid = all.slice(0, -12).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
  const plan = engine.seedPlan(mid);
  const choices = engine.editChoices(mid, plan);
  const labels = choices.map((c) => c.label);

  it('offers the search’s own edits, a marriage made as pins', () => {
    const kinds = new Set(choices.map((c) => c.kind));
    for (const k of ['marriage', 'class', 'build', 'keep', 'side-goal'] as const) expect(kinds).toContain(k);
    const marriage = choices.find((c) => c.kind === 'marriage' && c.pins.length === 1 && / marries /.test(c.label))!;
    expect(marriage.pins[0]).toMatchObject({ kind: 'marriage' });
    expect(marriage.label).toMatch(/ marries /);
    const build = choices.find((c) => c.kind === 'build')!;
    // No pin says a build skill: it's a plan edit.
    expect(build.pins).toEqual([]);
    expect(build.make().wishlist.units).not.toEqual(plan.wishlist.units);
  });

  it('offers keeping each unit in or out, ruling a planned couple out, and a side goal the other way', () => {
    const inWishlist = plan.wishlist.units.find((w) => w.unit !== 'chrom' && w.unit !== 'robin')!.unit;
    const keep = choices.find((c) => c.kind === 'keep' && c.pins[0]?.kind === 'keep' && c.pins[0].unit === inWishlist)!;
    expect(keep.pins).toEqual([{ kind: 'keep', unit: inWishlist, keep: 'out' }]);
    expect(keep.play).toEqual(keep.pins);
    expect(keep.make().wishlist.units.map((w) => w.unit)).not.toContain(inWishlist);
    expect(labels.some((l) => /^Keep .* in the wishlist$/.test(l))).toBe(true);
    expect(labels).not.toContain('Keep Chrom out of the wishlist');
    const couple = plan.wishlist.marriages.find((c) => !c.includes('maiden' as never))!;
    const out = choices.find((c) => c.kind === 'marriage' && c.pins[0]?.kind === 'marriage' && c.pins[0].forbid && c.pins[0].couple === couple)!;
    expect(out.label).toMatch(/ don’t marry$/);
    expect(out.make().wishlist.marriages.map((c) => [...c].sort().join())).not.toContain([...couple].sort().join());
    // A side goal the other way (#175 story 48): the plan's decision turned, with the pin that makes it the player's.
    const goals = choices.filter((c) => c.kind === 'side-goal');
    for (const g of goals) {
      expect(g.label).toMatch(/^(Chase|Skip) /);
      const pin = g.pins[0]!;
      expect(pin.kind).toBe('side-goal');
      if (pin.kind === 'side-goal') expect(g.make().roadmap.sideGoals?.[pin.goal]).toBe(pin.decision);
    }
  });

  it('prices an edit made as pins with its pins played', () => {
    const keep = engine.editChoices(late, seed).find((c) => c.kind === 'keep')!;
    const cost = engine.editCost({ run: late, plan: seed, edited: keep.make(), pins: keep.play, seed: 1, budget: 4, cap: 2 });
    expect(cost.runs).toBe(2);
    expect(['better', 'worse', 'close', 'unclear']).toContain(cost.verdict);
  });
});
