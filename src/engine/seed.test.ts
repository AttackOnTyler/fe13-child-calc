import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, createEngine, editEntry, latestEntry, TIE_TURNS, rescoreSeed, runFromRoster, withRun, withSpouse, type Plan, type RosterUnit } from './index';
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

  it('takes on each child paralogue once the story’s foes are as strong as its own (realism pass)', () => {
    const order = seed.roadmap.order;
    const at = (k: string) => order.indexOf(k);
    const children = engine.mapOrder(fresh).steps.filter((s) => s.movable).map((s) => s.key);
    expect(children.length).toBeGreaterThan(5);
    for (const k of children) expect(at(k), k).toBeGreaterThan(at('chapter-13'));
    // Paralogue 6's promoted Lv 8 foes come after Chapter 20's; Paralogue 8's unpromoted ones well before.
    expect(at('paralogue-6')).toBeGreaterThan(at('chapter-20'));
    expect(at('paralogue-8')).toBeLessThan(at('chapter-20'));
    expect(order.at(-1)).toBe('endgame');
  });

  it('marries each unit once, and keeps the run facts’ Robin', () => {
    expect(seed.robin).toEqual(robin);
    const married = seed.wishlist.marriages.flat();
    expect(new Set(married).size).toBe(married.length);
    expect(seed.wishlist.marriages.length).toBeGreaterThan(5);
  });

  it('keeps a recorded marriage as a fact, and a marriage pin', () => {
    // Record Chrom with a candidate the seed didn't pick (her child with him: Maribelle's Brady, Olivia's Inigo).
    const wife = spouseIn(seed, 'chrom') === 'maribelle' ? 'olivia' : 'maribelle';
    const child = wife === 'maribelle' ? 'brady' : 'inigo';
    expect(spouseIn(seed, 'vaike')).not.toBe('sully');
    const recorded = runFromRoster(withSpouse(facts, 'chrom', wife, 'married'));
    const plan = engine.seedPlan(recorded, { pins: [{ kind: 'marriage', couple: ['vaike', 'sully'] }] });
    expect(couple(plan, 'chrom')).toHaveLength(1);
    expect(spouseIn(plan, 'chrom')).toBe(wife);
    expect(couple(plan, wife)).toHaveLength(1);
    expect(spouseIn(plan, 'vaike')).toBe('sully');
    expect(plan.wishlist.children.find((c) => c.child === 'lucina')?.parents).toEqual(['chrom', wife]);
    expect(plan.wishlist.children.find((c) => c.child === child)?.parents).toEqual([wife, 'chrom']);
    // A pin on a recorded marriage's unit can't hold: the record wins.
    const clash = engine.seedPlan(recorded, { pins: [{ kind: 'marriage', couple: ['chrom', 'sumia'] }] });
    expect(spouseIn(clash, 'chrom')).toBe(wife);
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
    // The roadmap follows the map order (child paralogues where the plan places them) and names the endpoint's lineup: the wishlist's.
    const movable = new Set(engine.mapOrder(fresh).steps.filter((s) => s.movable).map((s) => s.key));
    expect(seed.roadmap.order.filter((k) => !movable.has(k))).toEqual(engine.mapOrder(fresh).steps.map((s) => s.key).filter((k) => !movable.has(k)));
    expect(seed.roadmap.lineups.map((l) => l.key)).toEqual(['endgame']);
    const fielded = seed.roadmap.lineups[0]!.pairs.flatMap((p) => [p.lead, ...(p.back ? [p.back] : [])]).concat(seed.roadmap.lineups[0]!.solo);
    expect(fielded).toEqual(units.map((u) => u.unit));
  });

  it('plans each unit’s class change: its wishlist class by the endpoint (#194)', () => {
    const { seals } = seed.roadmap;
    expect(seals.length).toBeGreaterThan(10);
    for (const s of seals) expect(s.key).toBe(seed.wishlist.endpoint);
    for (const u of seed.wishlist.units) {
      const s = seals.find((x) => x.unit === u.unit);
      if (s) expect(s.classId).toBe(u.classId);
    }
    expect(seals.find((s) => s.unit === 'chrom')).toEqual({ unit: 'chrom', classId: 'great-lord', seal: 'master', key: seed.wishlist.endpoint });
  });

  it('leaves no marriage a non-starter: a paralogue moves later, else the couple isn’t matched (#194, #199)', () => {
    const stuck = (plan: Plan) => engine.milestones(fresh, plan).filter((m) => m.kind === 'support' && m.nonStarter);
    expect(stuck(seed)).toEqual([]);
    // Every child paralogue is still played, in some order, and the endpoint is last.
    expect([...seed.roadmap.order].sort()).toEqual(engine.mapOrder(fresh).steps.map((s) => s.key).sort());
    expect(seed.roadmap.order.at(-1)).toBe('endgame');
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
    expect(engine.flawlessChance(open, { runs: 1 }).maps[1]!.lineup?.deployed ?? []).not.toContain('robin');
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
  });

  it('gives every wishlist unit a 5-skill build: the template, then the best skills its classes teach', () => {
    for (const difficulty of ['normal', 'lunatic'] as const) {
      const plan = engine.seedPlan(runFromRoster(withRun(EMPTY_ROSTER, { route: 'main-story', difficulty, mode: 'classic' })));
      for (const w of plan.wishlist.units) {
        expect(w.build, `${w.unit} (${difficulty})`).toHaveLength(5);
        expect(new Set(w.build).size).toBe(5);
      }
    }
  });
});

describe('a plan’s roadmap (#198)', () => {
  it('plays the lineups it names and the greedy lineup elsewhere', () => {
    const all = engine.mapOrder(fresh).steps.map((s) => s.map);
    const late = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
    const plan = engine.seedPlan(late);
    const lineups = engine.roadmapLineups(late, plan);
    expect(lineups.map((l) => l.key)).toEqual(['chapter-25', 'endgame']);
    // Chapter 25: the greedy lineup, as the plan with no named lineup plays it.
    const old = engine.flawlessChance(late, { runs: 1, plan: { ...plan, roadmap: { ...plan.roadmap, lineups: [] } } }).maps[0]!.lineup!;
    expect(lineups[0]!.pairs.map((p) => p.lead)).toEqual(old.pairs.map((p) => p.lead));
    // Endgame: the wishlist's, less anyone the army doesn't have there.
    const named = plan.roadmap.lineups[0]!;
    expect(named.key).toBe('endgame');
    for (const p of lineups[1]!.pairs) expect(named.pairs.map((x) => x.lead).concat(named.pairs.flatMap((x) => (x.back ? [x.back] : [])))).toContain(p.lead);
  });
});

describe('the stepping call (#198, #199)', () => {
  // Two maps left: each run is cheap. Small run counts: a full search to convergence takes minutes even here.
  const all = engine.mapOrder(fresh).steps.map((s) => s.map);
  const late = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
  const small = { seed: 3, runs: 2, cap: 4, display: 3 } as const;
  const step = (budget: number, more: Partial<Parameters<typeof engine.solveStep>[0]> = {}) => engine.solveStep({ run: late, budget, ...small, ...more });
  /** Steps until converged or `n` steps. */
  const steps = (n: number, more: Partial<Parameters<typeof engine.solveStep>[0]> = {}) => {
    let s = step(4, more);
    for (let i = 1; i < n && !s.converged; i++) s = step(4, { ...more, cursor: s.cursor });
    return s;
  };

  it('starts from the seed, shows its chance re-scored on fresh runs first, and is the same for the same input', () => {
    const first = step(1);
    expect(first.best).toEqual(engine.seedPlan(late));
    // The re-score is the first piece: it may overrun a small budget.
    expect(first.evaluations).toBe(small.display);
    expect(rescoreSeed(small.seed)).not.toBe(small.seed);
    expect(first.chance).toEqual(engine.flawlessChance(late, { plan: first.best, seed: rescoreSeed(small.seed), runs: small.display }));
    expect(step(1)).toEqual(first);
    expect(JSON.parse(JSON.stringify(first.cursor))).toEqual(first.cursor);
  });

  it('spends nothing on a budget of 0', () => {
    expect(step(0)).toMatchObject({ chance: undefined, evaluations: 0, converged: false, proposals: [], closeCalls: [], cursor: { evaluations: 0 } });
  });

  it('reads an edit it can’t tell apart at the run cap as a close call, and never breaks a pin', () => {
    const pins = [{ kind: 'marriage', couple: ['vaike', 'sully'] }] as const;
    const s = steps(8, { pins });
    expect(s.cursor.evaluations).toBeGreaterThan(small.display);
    expect(s.closeCalls.length).toBeGreaterThan(0);
    for (const c of s.closeCalls) {
      expect(c.runs).toBe(small.cap);
      expect(Math.abs(c.gain)).toBeLessThanOrEqual((2 * c.margin) / 1.96 + 1e-12);
      // Ties go to fewer expected turns: a close call left is never measurably faster than the best plan. At 0% (#242)
      // they go to runs that get further instead: one left never gets measurably further, and turns aren't read.
      if (c.cleared) {
        expect(c.turns).toBeUndefined();
        expect(c.cleared.gain).toBeLessThanOrEqual((2 * c.cleared.margin) / 1.96 + 1e-12);
      } else expect(c.turns).toBeGreaterThan(-TIE_TURNS);
    }
    // One that is was taken instead, as a proposal inside the noise.
    for (const p of s.proposals.filter((x) => x.close)) {
      if (p.cleared) expect(p.cleared.gain).toBeGreaterThan(0);
      else expect(p.turns).toBeLessThanOrEqual(-TIE_TURNS);
    }
    for (const p of [s.best, ...s.closeCalls.map((c) => c.plan), ...s.proposals.map((p) => p.plan)]) expect(spouseIn(p, 'vaike')).toBe('sully');
    // Nothing offered has a non-starter (#194).
    for (const p of [...s.closeCalls.map((c) => c.plan), ...s.proposals.map((p) => p.plan)])
      expect(engine.milestones(late, p).filter((m) => m.kind === 'support' && m.nonStarter && !(m.pair.includes('vaike') && m.pair.includes('sully')))).toEqual([]);
  });

  it('never replaces the adopted plan: improvements are proposals', () => {
    const adopted = engine.seedPlan(late);
    const frozen = structuredClone(adopted);
    const s = steps(6, { plan: adopted });
    expect(adopted).toEqual(frozen);
    for (const p of s.proposals) {
      expect(p.gain).toBeGreaterThan(0);
      // Kept only when the gain beats twice the paired standard error (the ± is 95%: 1.96 of them).
      expect(p.gain).toBeGreaterThan((2 * p.margin) / 1.96);
      expect(p.edits.length).toBeGreaterThan(0);
      expect(p.plan).not.toEqual(adopted);
    }
    // Best first.
    expect(s.proposals.map((p) => p.gain)).toEqual([...s.proposals.map((p) => p.gain)].sort((a, b) => b - a));
    // A set of marriages is pruned only when its ceiling is below the best found.
    for (const p of s.pruned) expect(p.ceiling).toBeLessThan(p.best);
    // A search on another adopted plan starts again from it.
    const other = s.closeCalls[0]?.plan ?? adopted;
    expect(step(0, { plan: other, cursor: s.cursor }).best).toBe(other);
  });

  it('costs an edit provisionally on a small budget, then settles it', () => {
    const adopted = engine.seedPlan(late);
    const edited = steps(4).closeCalls[0]!.plan;
    const provisional = engine.editCost({ run: late, plan: adopted, edited, seed: 3, budget: 2, runs: 2, cap: 4 });
    expect(provisional).toMatchObject({ runs: 2, settled: false });
    const settled = engine.editCost({ run: late, plan: adopted, edited, seed: 3, budget: 8, runs: 2, cap: 4 });
    expect(settled).toMatchObject({ runs: 4, settled: true, verdict: 'close' });
  });

  it('costs a build skill edit on the runs: the simulation equips the builds', () => {
    const adopted = engine.seedPlan(late);
    const w = adopted.wishlist.units.find((x) => x.build.length > 1)!;
    const edited = { ...adopted, wishlist: { ...adopted.wishlist, units: adopted.wishlist.units.map((x) => (x === w ? { ...x, build: x.build.slice(1) } : x)) } };
    const cost = engine.editCost({ run: late, plan: adopted, edited, seed: 3, budget: 8, runs: 2, cap: 4 });
    expect(cost.runs).toBeGreaterThan(0);
    expect(cost.settled).toBe(true);
  });

  it('re-scores the best plan’s chance only on a step that changed it', () => {
    let s = step(4);
    expect(s.chance).toBeDefined();
    for (let i = 0; i < 4; i++) {
      const next = step(4, { cursor: s.cursor });
      expect(next.chance !== undefined).toBe(JSON.stringify(next.best) !== JSON.stringify(s.best));
      s = next;
    }
  });

  it('resumes from a plain-JSON cursor exactly as from the live one', () => {
    const first = step(4);
    expect(step(4, { cursor: JSON.parse(JSON.stringify(first.cursor)) })).toEqual(step(4, { cursor: first.cursor }));
  });

  it('settles a clearly worse edit’s cost: the endpoint fought by Chrom and Robin alone', () => {
    // Every unit recorded at Lv 10 with the same strong stats, so the whole army clears the endpoint and two alone don't.
    const fair = { hp: 60, str: 35, mag: 35, skl: 35, spd: 35, lck: 30, def: 30, res: 28 };
    const run = editEntry(late, latestEntry(late)!.id, (s) => ({ ...s, units: Object.fromEntries(Object.entries(s.units).map(([u, x]) => [u, { ...x!, level: 10, stats: x!.stats && fair }])) }), 1);
    const plan = engine.seedPlan(run);
    const endpoint = plan.roadmap.order.at(-1)!;
    const thin = { ...plan, roadmap: { ...plan.roadmap, lineups: [...plan.roadmap.lineups.filter((l) => l.key !== endpoint), { key: endpoint, pairs: [], solo: ['chrom', 'robin'] as RosterUnit[] }] } };
    expect(engine.editCost({ run, plan, edited: thin, seed: 3, budget: 32, runs: 2, cap: 16 })).toMatchObject({ verdict: 'worse', settled: true });
  });
});

