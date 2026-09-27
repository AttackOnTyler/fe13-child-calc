import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, createEngine, runFromRoster, unitName, withRun, type RosterUnit } from '.';

describe('a unit’s edits for the Wishlist tab (#203)', () => {
  const engine = createEngine();
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const start = runFromRoster(facts);
  const all = engine.mapOrder(start).steps.map((s) => s.map);
  const run = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), start);
  const plan = engine.seedPlan(run);
  const name = (u: RosterUnit) => unitName(u, 'M');

  it('lists the search’s edits naming the unit, then keeping it out of the wishlist', () => {
    // Early enough in the run that marriages are still open.
    const early = all.slice(0, 8).reduce((r, m, i) => addEntry(r, m, i + 1), start);
    const plan = engine.seedPlan(early);
    const [a, b] = plan.wishlist.marriages.find((c) => !c.includes('chrom') && !c.includes('robin'))!;
    const edits = engine.unitEdits(early, plan, a);
    expect(edits.length).toBeGreaterThan(1);
    for (const e of edits.filter((x) => x.kind !== 'keep' && x.kind !== 'place')) expect(e.label).toContain(name(a));
    // A marriage edit touching its couple, pinned by the marriage it makes.
    const marriage = edits.find((e) => e.kind === 'marriage')!;
    expect(marriage.label).toMatch(new RegExp(`${name(a)}|${name(b)}`));
    expect(marriage.pins.every((p) => p.kind === 'marriage')).toBe(true);
    const inWishlist = plan.wishlist.units.some((w) => w.unit === a);
    const keep = edits.at(-1)!;
    expect(keep).toMatchObject({ kind: 'keep', pins: [{ kind: 'keep', unit: a, keep: inWishlist ? 'out' : 'in' }] });
    expect(keep.label).toBe(`Keep ${name(a)} ${inWishlist ? 'out of' : 'in'} the wishlist`);
  });

  it('never offers to keep Chrom or Robin out', () => {
    expect(engine.unitEdits(run, plan, 'chrom').some((e) => e.kind === 'keep')).toBe(false);
    expect(engine.unitEdits(run, plan, 'robin').some((e) => e.kind === 'keep')).toBe(false);
  });

  it('costs an edit the simulation can’t see as a close call on no runs, and a keep edit under its pin', () => {
    const w = plan.wishlist.units.find((x) => x.unit !== 'chrom' && x.unit !== 'robin')!;
    const edits = engine.unitEdits(run, plan, w.unit);
    const build = edits.find((e) => e.kind === 'build')!;
    expect(engine.editCost({ run, plan, edited: build.make(), seed: 1, budget: 4 })).toEqual({ gain: 0, margin: 0, runs: 0, verdict: 'close', settled: true });
    const keep = edits.find((e) => e.kind === 'keep')!;
    const kept = keep.make();
    expect(kept.wishlist.units.some((x) => x.unit === w.unit)).toBe(false);
    const cost = engine.editCost({ run, plan, edited: kept, pins: keep.play, seed: 1, budget: 4 });
    expect(cost.runs).toBe(2);
    expect(cost.settled).toBe(false);
  });
});
