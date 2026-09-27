import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, createEngine, marriagePins, runFromRoster, withRun, withSpouse, type Plan, type RosterUnit } from './index';
import { SKILLS } from '../game-data/skills';

/**
 * The solve's seed and its stepping call (#198), through the facade: the plan it proposes for a run, the endpoint
 * coverage it matches marriages on, and the flawless chance of a plan.
 */
const engine = createEngine();
const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
const fresh = runFromRoster(facts);
const robin = { gender: 'M', asset: 'mag', flaw: 'hp' } as const;
const couple = (plan: Plan, u: RosterUnit) => plan.wishlist.marriages.filter((c) => c.includes(u));
const spouseIn = (plan: Plan, u: RosterUnit) => couple(plan, u)[0]?.find((x) => x !== u);

describe('endpoint coverage (#198)', () => {
  const steps = engine.mapOrder(fresh).steps;
  const lucina = engine.endpointCoverage(fresh, 'lucina', ['chrom', 'sumia'], robin)!;

  it('is the share of the endpoint’s foes the child beats at caps, times the share of the route it is there for', () => {
    expect(lucina.foes).toBeGreaterThan(0);
    expect(lucina.share).toBeCloseTo(lucina.beaten / lucina.foes, 12);
    expect(lucina.share).toBeGreaterThan(0);
    expect(lucina.share).toBeLessThanOrEqual(1);
    expect(lucina.value).toBeCloseTo(lucina.share * lucina.presence, 12);
    // Lucina joins at the end of Chapter 13: she is in the army for every map after it.
    const at = steps.findIndex((s) => s.map === 'chapter-13');
    expect(lucina.presence).toBeCloseTo((steps.length - 1 - at) / steps.length, 12);
  });

  it('reads the same foes whatever is played, the presence shrinking only with the maps left', () => {
    const later = runFromRoster(withRun(facts, { route: 'main-story' }));
    expect(engine.endpointCoverage(later, 'lucina', ['chrom', 'sumia'], robin)!.share).toBeCloseTo(lucina.share, 12);
    // Chrom's son or daughter by another mother differs at caps (her modifiers), and a child joining later is there for less.
    const olivia = engine.endpointCoverage(fresh, 'lucina', ['chrom', 'olivia'], robin)!;
    expect(olivia.presence).toBe(lucina.presence);
    expect(olivia.share).not.toBe(lucina.share);
    const nah = engine.endpointCoverage(fresh, 'nah', ['nowi', 'gregor'], robin)!;
    expect(nah.presence).toBeLessThan(lucina.presence);
  });

  it('is undefined for a couple that doesn’t make the child', () => {
    expect(engine.endpointCoverage(fresh, 'lucina', ['sully', 'stahl'], robin)).toBeUndefined();
  });
});

describe('the seed (#198)', () => {
  const seed = engine.seedPlan(fresh);

  it('marries each unit once, and keeps the run facts’ Robin', () => {
    expect(seed.robin).toEqual(robin);
    const married = seed.wishlist.marriages.flat();
    expect(new Set(married).size).toBe(married.length);
    expect(seed.wishlist.marriages.length).toBeGreaterThan(5);
  });

  it('keeps a recorded marriage as a fact, and a marriage pin', () => {
    // Unrecorded, the seed doesn't marry Chrom to Olivia, nor Vaike to Sully.
    expect(spouseIn(seed, 'chrom')).not.toBe('olivia');
    expect(spouseIn(seed, 'vaike')).not.toBe('sully');
    const recorded = runFromRoster(withSpouse(facts, 'chrom', 'olivia', 'married'));
    const plan = engine.seedPlan(recorded, { pins: [{ kind: 'marriage', couple: ['vaike', 'sully'] }] });
    expect(couple(plan, 'chrom')).toHaveLength(1);
    expect(spouseIn(plan, 'chrom')).toBe('olivia');
    expect(couple(plan, 'olivia')).toHaveLength(1);
    expect(spouseIn(plan, 'vaike')).toBe('sully');
    expect(plan.wishlist.children.find((c) => c.child === 'lucina')?.parents).toEqual(['chrom', 'olivia']);
    expect(plan.wishlist.children.find((c) => c.child === 'inigo')?.parents).toEqual(['olivia', 'chrom']);
    // The Plan page's pins are the seed's marriage pins, each couple once.
    expect(marriagePins(withSpouse(facts, 'vaike', 'sully', 'pinned'))).toEqual([{ kind: 'marriage', couple: ['vaike', 'sully'] }]);
    // A pin on a recorded marriage's unit can't hold: the record wins.
    const clash = engine.seedPlan(recorded, { pins: [{ kind: 'marriage', couple: ['chrom', 'sumia'] }] });
    expect(spouseIn(clash, 'chrom')).toBe('olivia');
  });

  it('proposes the endpoint’s army as it will fight, with classes and builds, and each child’s parents and passes', () => {
    const { units, children, endpoint } = seed.wishlist;
    expect(endpoint).toBe('endgame');
    expect(units.length).toBeGreaterThan(10);
    expect(units.length).toBeLessThanOrEqual(engine.mapOrder(fresh).endpoint.deploy);
    for (const u of units) {
      expect(u.classId).toBeTruthy();
      expect(u.build.length).toBeLessThanOrEqual(5);
      if (u.position === 'back') expect(units.find((x) => x.unit === u.partner)).toMatchObject({ position: 'lead', partner: u.unit });
    }
    for (const c of children) {
      const [a, b] = c.parents;
      expect(b === 'maiden' || seed.wishlist.marriages.some((m) => m.includes(a) && m.includes(b))).toBe(true);
    }
    // Chrom passes Aether to a daughter whatever the plan, and every other parent passes a skill.
    expect(children.find((c) => c.child === 'lucina')!.passes[0]).toBe('aether');
    expect(children.filter((c) => c.parents[1] !== 'maiden').every((c) => c.passes.every((p) => p !== null))).toBe(true);
    // The roadmap follows the map order and names the endpoint's lineup: the wishlist's.
    expect(seed.roadmap.order).toEqual(engine.mapOrder(fresh).steps.map((s) => s.key));
    expect(seed.roadmap.lineups.map((l) => l.key)).toEqual(['endgame']);
    const fielded = seed.roadmap.lineups[0]!.pairs.flatMap((p) => [p.lead, ...(p.back ? [p.back] : [])]).concat(seed.roadmap.lineups[0]!.solo);
    expect(fielded).toEqual(units.map((u) => u.unit));
  });

  it('is plain JSON, and the same for the same run', () => {
    expect(JSON.parse(JSON.stringify(seed))).toEqual(seed);
    expect(engine.seedPlan(fresh)).toEqual(seed);
  });

  it('chooses Robin where the run facts leave it open, and the plan’s Robin is the one simulated', () => {
    const open = runFromRoster(withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal' }));
    const plan = engine.seedPlan(open);
    expect(['M', 'F']).toContain(plan.robin.gender);
    expect(plan.robin.asset).not.toBe(plan.robin.flaw);
    // Without a Robin the old path leaves Robin out; the plan fields its Robin in the Prologue.
    expect(engine.flawlessChance(open, { runs: 1 }).maps[1]!.lineup?.deployed).not.toContain('robin');
    expect(engine.flawlessChance(open, { runs: 1, plan }).maps[1]!.lineup?.deployed).toContain('robin');
  });

  it('has each parent pass the planned skill in the simulation', () => {
    const plan = engine.seedPlan(fresh, { pins: [{ kind: 'marriage', couple: ['chrom', 'sumia'] }] });
    const lucina = plan.wishlist.children.find((c) => c.child === 'lucina')!;
    expect(lucina.parents).toEqual(['chrom', 'sumia']);
    const pass = lucina.passes[1]!;
    expect(pass).toBeTruthy();
    // The ceiling fields the plan's children with what their parents pass.
    const ceiling = engine.ceiling(fresh, { plan, runs: 1 })!;
    expect(ceiling.units.find((u) => u.id === 'lucina')?.skills).toContain(SKILLS[pass].name);
    expect(engine.flawlessChance(fresh, { plan, runs: 1 }).blindSpots).toContain('passes-as-planned');
  });
});

describe('a plan’s roadmap (#198)', () => {
  it('plays the lineups it names and the greedy lineup elsewhere', () => {
    const all = engine.mapOrder(fresh).steps.map((s) => s.map);
    const late = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
    const plan = engine.seedPlan(late);
    const lineups = engine.roadmapLineups(late, plan);
    expect(lineups.map((l) => l.key)).toEqual(['chapter-25', 'endgame']);
    // Chapter 25: the greedy lineup, as the old path picks it.
    const old = engine.flawlessChance(late, { runs: 1, marriages: plan.wishlist.marriages as [RosterUnit, RosterUnit][] }).maps[0]!.lineup!;
    expect(lineups[0]!.pairs.map((p) => p.lead)).toEqual(old.pairs.map((p) => p.lead));
    // Endgame: the wishlist's, less anyone the army doesn't have there.
    const named = plan.roadmap.lineups[0]!;
    expect(named.key).toBe('endgame');
    for (const p of lineups[1]!.pairs) expect(named.pairs.map((x) => x.lead).concat(named.pairs.flatMap((x) => (x.back ? [x.back] : [])))).toContain(p.lead);
  });
});

describe('the stepping call (#198)', () => {
  const step = (budget: number, more: Partial<Parameters<typeof engine.solveStep>[0]> = {}) => engine.solveStep({ run: fresh, budget, seed: 3, runs: 2, ...more });

  it('starts from the seed, and is the same for the same input', () => {
    const a = step(1);
    expect(a.best).toEqual(engine.seedPlan(fresh));
    expect(step(1)).toEqual(a);
  });

  it('evaluates within its budget: nothing for 0, the plan’s flawless chance for 1', () => {
    const none = step(0);
    expect(none).toMatchObject({ chance: undefined, evaluations: 0, converged: false, proposals: [], cursor: { evaluations: 0 } });
    const one = step(1);
    expect(one).toMatchObject({ evaluations: 1, converged: true, proposals: [], cursor: { evaluations: 1 } });
    expect(one.chance).toEqual(engine.flawlessChance(fresh, { plan: one.best, seed: 3, runs: 2 }));
    expect(step(1, { cursor: one.cursor }).cursor).toEqual({ evaluations: 2 });
  });

  it('keeps the adopted plan it’s given, and the pins on a seed', () => {
    const pinned = step(0, { pins: [{ kind: 'marriage', couple: ['vaike', 'sully'] }] }).best;
    expect(spouseIn(pinned, 'vaike')).toBe('sully');
    expect(step(0, { plan: pinned }).best).toBe(pinned);
  });
});
