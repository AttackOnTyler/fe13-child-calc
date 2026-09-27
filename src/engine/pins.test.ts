import { describe, expect, it } from 'vitest';
import {
  EMPTY_ROSTER,
  SIDE_GOAL_IDS,
  addEntry,
  createEngine,
  exportRun,
  importRun,
  latestEntry,
  mapSpanPin,
  runFromRoster,
  sideGoalById,
  withPin,
  withRun,
  withSideGoalPin,
  withSpouse,
  type Plan,
  type PlanLineup,
  type PlanPin,
  type RosterUnit,
  type Run,
} from './index';

/**
 * Pins (#200), through the facade: where they live on the run, which still hold, how the lineups keep them, that the
 * solve never breaks one, and what they cost.
 */
const engine = createEngine();
const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
const fresh = runFromRoster(facts);
// Two maps left (Chapter 25, then Endgame): each run is cheap.
const all = engine.mapOrder(fresh).steps.map((s) => s.map);
const late = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
const small = { seed: 3, runs: 2, cap: 4, display: 3 } as const;

const fielded = (l: Pick<PlanLineup, 'pairs' | 'solo'>): RosterUnit[] => [...l.pairs.flatMap((p) => [p.lead, ...(p.back ? [p.back] : [])]), ...l.solo];
const lineupAt = (run: Run, plan: Plan, key: string) => engine.roadmapLineups(run, plan).find((l) => l.key === key)!;

describe('pins on the run (#200)', () => {
  it('are stored with the run, and a save from before #200 keeps its item pins', () => {
    const span = mapSpanPin('frederick', 'out', 'chapter-25');
    const pinned = withPin(withPin(late, span), { kind: 'keep', unit: 'vaike', keep: 'in' });
    const back = importRun(exportRun(pinned));
    expect(back.pins).toEqual([span, { kind: 'keep', unit: 'vaike', keep: 'in' }]);
    // A save from #193 kept item pins apart.
    const old = importRun(JSON.stringify({ ...JSON.parse(exportRun(late)), itemPins: [{ kind: 'booster', item: 'Energy Drop', unit: 'chrom' }] }));
    expect(old.pins).toEqual([{ kind: 'booster', item: 'Energy Drop', unit: 'chrom' }]);
    // The same choice again replaces it: one keep pin per unit.
    expect(withPin(pinned, { kind: 'keep', unit: 'vaike', keep: 'out' }).pins).toEqual([span, { kind: 'keep', unit: 'vaike', keep: 'out' }]);
  });

  it('read the side goals pinned on the run as pins, and a span pin set on one map covers that map only', () => {
    const goal = SIDE_GOAL_IDS[0]!;
    const run = withSideGoalPin(fresh, goal, 'skip');
    expect(engine.pins(run)).toEqual([{ kind: 'side-goal', goal, decision: 'skip' }]);
    expect(mapSpanPin('robin', 'lead', 'chapter-2')).toEqual({ kind: 'span', unit: 'robin', position: 'lead', from: 'chapter-2', to: 'chapter-2' });
  });

  it('never makes a pin of a recorded fact: what already happened, or a unit dead or missed', () => {
    const married = runFromRoster(withSpouse(facts, 'chrom', 'olivia', 'married'));
    expect(engine.pins(withPin(married, { kind: 'marriage', couple: ['chrom', 'olivia'] }))).toEqual([]);
    // A marriage pin through a married unit can't hold either: the record wins.
    expect(engine.pins(withPin(married, { kind: 'marriage', couple: ['chrom', 'sumia'] }))).toEqual([]);
    // A span all played, and a side goal on a recorded map.
    const played = sideGoalById(SIDE_GOAL_IDS.find((g) => all.slice(0, -2).includes(sideGoalById(g).map))!);
    expect(engine.pins(withSideGoalPin(withPin(late, mapSpanPin('chrom', 'lead', 'chapter-3')), played.id, 'chase'))).toEqual([]);
    // A span still ahead holds; one reaching past the maps played holds for the maps left.
    const ahead: PlanPin = { kind: 'span', unit: 'chrom', position: 'lead', from: 'chapter-3' };
    expect(engine.pins(withPin(late, ahead))).toEqual([ahead]);
  });
});

describe('pins in the lineups (#200)', () => {
  const seed = engine.seedPlan(late);
  const ch25 = lineupAt(late, seed, 'chapter-25');
  // Units the map doesn't force (Chrom and Robin lead every story map).
  const free = fielded(ch25).filter((u) => u !== 'chrom' && u !== 'robin');
  const [a, b] = [ch25.pairs.find((p) => p.lead !== 'chrom' && p.lead !== 'robin')!.lead, free.find((u) => !ch25.pairs.some((p) => p.lead === u))!];

  it('keeps a unit out of one map’s lineup, set from the preparation page, and leaves the next map free', () => {
    const run = withPin(late, mapSpanPin(a, 'out', 'chapter-25'));
    const plan = engine.seedPlan(run);
    expect(fielded(lineupAt(run, plan, 'chapter-25'))).not.toContain(a);
    expect(fielded(lineupAt(run, plan, 'endgame')).includes(a)).toBe(fielded(lineupAt(late, seed, 'endgame')).includes(a));
  });

  it('keeps a pair from a map on: the pair leads on each map and in the wishlist', () => {
    expect(ch25.pairs.some((p) => p.lead === a && p.back === b)).toBe(false);
    const run = withPin(late, { kind: 'span', unit: a, position: 'lead', partner: b, from: 'chapter-25' });
    const plan = engine.seedPlan(run);
    for (const key of ['chapter-25', 'endgame']) expect(lineupAt(run, plan, key).pairs).toContainEqual({ lead: a, back: b });
    expect(plan.wishlist.units.find((w) => w.unit === a)).toMatchObject({ position: 'lead', partner: b });
  });

  it('keeps a unit out of the wishlist and every lineup, or in the wishlist', () => {
    const out = withPin(late, { kind: 'keep', unit: a, keep: 'out' });
    const plan = engine.seedPlan(out);
    expect(plan.wishlist.units.map((w) => w.unit)).not.toContain(a);
    for (const l of engine.roadmapLineups(out, plan)) expect(fielded(l)).not.toContain(a);
    // In: a unit the seed leaves out of the endpoint.
    const army = Object.keys(latestEntry(late)!.snapshot.units) as RosterUnit[];
    const benched = army.find((u) => !seed.wishlist.units.some((w) => w.unit === u))!;
    expect(benched).toBeTruthy();
    const kept = engine.seedPlan(withPin(late, { kind: 'keep', unit: benched, keep: 'in' }));
    expect(kept.wishlist.units.map((w) => w.unit)).toContain(benched);
  });
});

describe('the solve with pins, and their cost (#200)', () => {
  const seed = engine.seedPlan(late);
  const ch25 = lineupAt(late, seed, 'chapter-25');
  const lead = ch25.pairs.find((p) => p.lead !== 'chrom' && p.lead !== 'robin' && p.back)!;
  const pins: PlanPin[] = [
    { kind: 'span', unit: lead.lead, position: 'lead', partner: lead.back!, from: 'chapter-25' },
    { kind: 'marriage', couple: ['vaike', 'sully'] },
  ];
  const run = pins.reduce(withPin, late);
  const steps = (r: Run, more: Partial<Parameters<typeof engine.solveStep>[0]> = {}, n = 6) => {
    let s = engine.solveStep({ run: r, budget: 4, ...small, ...more });
    for (let i = 1; i < n && !s.converged; i++) s = engine.solveStep({ run: r, budget: 4, ...small, ...more, cursor: s.cursor });
    return s;
  };
  const keeps = (plan: Plan) => {
    expect(plan.wishlist.marriages.some((c) => c.includes('vaike') && c.includes('sully'))).toBe(true);
    for (const l of plan.roadmap.lineups) {
      const p = l.pairs.find((x) => x.lead === lead.lead || x.back === lead.lead || x.lead === lead.back || x.back === lead.back);
      if (p) expect(p).toEqual({ lead: lead.lead, back: lead.back });
      expect(l.solo.filter((u) => u === lead.lead || u === lead.back)).toEqual([]);
    }
  };
  const pinned = steps(run);

  it('never offers a plan that breaks a pin', () => {
    expect(pinned.cursor.evaluations).toBeGreaterThan(small.display);
    for (const p of [pinned.best, ...pinned.proposals.map((x) => x.plan), ...pinned.closeCalls.map((x) => x.plan)]) keeps(p);
    // An adopted plan from before the pins is made to keep them.
    const kept = engine.solveStep({ run, plan: seed, budget: 0, ...small });
    keeps(kept.best);
  });

  it('costs the pins together: the best found with them lifted, less the best found with them, on the same runs', () => {
    const lifted = engine.liftPins(run);
    expect(engine.pins(lifted)).toEqual([]);
    const free = steps(lifted, { plan: pinned.best }, 3);
    const cost = engine.pinCost({ run, plan: pinned.best, lifted: free.best, seed: small.seed, budget: 8, runs: small.runs, cap: small.cap });
    expect(cost.pins).toEqual(engine.pins(run));
    const on = (r: Run, plan: Plan) => engine.flawlessChance(r, { plan, seed: small.seed, runs: cost.runs }).chance;
    expect(cost.cost).toBeCloseTo(on(lifted, free.best) - on(run, pinned.best), 12);
    expect(cost.runs).toBeGreaterThanOrEqual(small.runs);
  });

  it('costs one pin on request, and a recorded fact never', () => {
    const one = engine.pinCost({ run, lift: [pins[0]!], plan: pinned.best, lifted: pinned.best, seed: small.seed, budget: 4, runs: small.runs, cap: small.cap });
    expect(one.pins).toEqual([pins[0]]);
    expect(engine.pins(engine.liftPins(run, { lift: [pins[0]!] }))).toEqual([pins[1]]);
    const married = runFromRoster(withSpouse(facts, 'chrom', 'olivia', 'married'));
    const fact = withPin(married, { kind: 'marriage', couple: ['chrom', 'olivia'] });
    const plan = engine.seedPlan(married);
    expect(engine.pinCost({ run: fact, plan, lifted: plan, seed: 1, budget: 8 })).toEqual({ pins: [], cost: 0, margin: 0, runs: 0, verdict: 'close', settled: true });
  });
});

describe('rule-outs (#205): a marriage pin with forbid', () => {
  const marries = (plan: Plan, [a, b]: readonly [RosterUnit, RosterUnit]) => plan.wishlist.marriages.some((c) => c.includes(a) && c.includes(b));
  const forbid = (a: RosterUnit, b: RosterUnit): PlanPin => ({ kind: 'marriage', couple: [a, b], forbid: true });

  it('is stored with the run, and replaces a pin on the same couple (and back)', () => {
    const run = withPin(late, forbid('vaike', 'sully'));
    expect(importRun(exportRun(run)).pins).toEqual([forbid('vaike', 'sully')]);
    expect(engine.pins(run)).toEqual([forbid('vaike', 'sully')]);
    const pinned = withPin(run, { kind: 'marriage', couple: ['sully', 'vaike'] });
    expect(pinned.pins).toEqual([{ kind: 'marriage', couple: ['sully', 'vaike'] }]);
    expect(withPin(pinned, forbid('vaike', 'sully')).pins).toEqual([forbid('vaike', 'sully')]);
  });

  it('is never married by the seed', () => {
    const seed = engine.seedPlan(fresh);
    const couple = seed.wishlist.marriages.find((c) => !c.includes('chrom') && !c.includes('robin'))!;
    expect(marries(seed, couple)).toBe(true);
    expect(marries(engine.seedPlan(withPin(fresh, forbid(...couple))), couple)).toBe(false);
  });

  it('is never married by the solve, nor by an adopted plan from before it', () => {
    const adopted = engine.seedPlan(withPin(late, { kind: 'marriage', couple: ['vaike', 'sully'] }));
    expect(marries(adopted, ['vaike', 'sully'])).toBe(true);
    const run = withPin(late, forbid('vaike', 'sully'));
    let s = engine.solveStep({ run, plan: adopted, budget: 0, ...small });
    expect(marries(s.best, ['vaike', 'sully'])).toBe(false);
    for (let i = 0; i < 3 && !s.converged; i++) s = engine.solveStep({ run, plan: adopted, budget: 4, ...small, cursor: s.cursor });
    for (const p of [s.best, ...s.proposals.map((x) => x.plan), ...s.closeCalls.map((x) => x.plan)]) expect(marries(p, ['vaike', 'sully'])).toBe(false);
  });

  it('is dropped once the record marries either unit', () => {
    const married = runFromRoster(withSpouse(facts, 'chrom', 'olivia', 'married'));
    expect(engine.pins(withPin(married, forbid('chrom', 'sumia')))).toEqual([]);
    // A rule-out never takes a unit from a marriage pin.
    const both = withPin(withPin(late, forbid('vaike', 'sully')), { kind: 'marriage', couple: ['vaike', 'miriel'] });
    expect(engine.pins(both)).toHaveLength(2);
  });
});
