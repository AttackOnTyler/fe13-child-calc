import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, STATS, addEntry, createEngine, itemByName, runFromRoster, withRun, type ArmyUnit, type ChildRecruit, type Foe, type Plan, type RosterUnit, type RunSimInput, type RunSimMap, type SimFoeGroup, type SimMap, type Stat } from './index';

/**
 * Unit worth, utility and reserves (#202): hand-built armies and maps where the answer can be worked by hand,
 * then a recorded run through the facade.
 */
const engine = createEngine();
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const myrmidon = engine.classGrowths('myrmidon', 'M');
const flat = Object.fromEntries(STATS.map((s) => [s, -myrmidon[s]])) as Record<Stat, number>;
const hero = (more: Partial<ArmyUnit> = {}): ArmyUnit => ({
  id: 'lonqu',
  name: 'Hero',
  gender: 'M',
  classId: 'myrmidon',
  level: 20,
  exp: 0,
  count: 0,
  bonus: 0,
  stats: stats(30, 15, 0, 60, 30, 0, 10, 0),
  growths: flat,
  modifiers: { str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 },
  skills: [],
  weapons: [{ item: itemByName('Iron Sword')! }],
  supports: [],
  ...more,
});
// Hits hard, takes long to fell: a lone hero wears down against it, a healer keeps it up.
const wall: Foe = { name: 'Wall', className: 'Fighter', count: 1, stats: stats(200, 13, 0, 0, 0, 60, 15, 0), weapon: itemByName('Iron Axe'), skills: [], boss: false, level: 1 };
const group = (foe: Foe): SimFoeGroup => ({ key: foe.name, foe });
const rout = (id: string, foes: Foe[]): SimMap => ({ id, victory: 'rout', foes: foes.map(group), waves: [], skipped: [] });
const step = (map: SimMap, more: Partial<RunSimMap> = {}): RunSimMap => ({ key: map.id, label: map.id, map, deploy: 2, forced: [], joining: [], mapOnly: [], later: [], masterSeals: false, ...more });
const healer = hero({ id: 'lissa', name: 'Lissa', gender: 'F', classId: 'priest', stats: stats(20, 0, 10, 5, 5, 5, 3, 10), weapons: [], items: [{ item: itemByName('Heal')!, uses: 30 }] });

describe('the simulation under a unit’s worth (#202)', () => {
  const input = { army: [hero(), healer], maps: [step(rout('a', [wall]))], difficulty: 'normal' as const };

  it('plays a unit idle: it fights but heals no one', () => {
    const full = engine.simulateRuns(input, 1, 1);
    const idle = engine.simulateRuns({ ...input, idle: ['lissa'] }, 1, 1);
    expect(full.chance).toBeGreaterThan(idle.chance);
    // The same lineup either way: only its actions change.
    expect(idle.maps[0]!.lineup).toEqual(full.maps[0]!.lineup);
    expect(engine.simulateRuns({ ...input, idle: ['lonqu'] }, 1, 1).chance).toBe(full.chance);
  });

  it('counts a potion as sustain: idle, the unit drinks none (spec: a heal, a potion, Rescue)', () => {
    const drinker = { army: [hero({ items: [{ item: itemByName('Vulnerary')!, uses: 3 }] })], maps: [step(rout('a', [wall]))], difficulty: 'normal' as const };
    const full = engine.simulateRuns(drinker, 1, 1);
    const idle = engine.simulateRuns({ ...drinker, idle: ['lonqu'] }, 1, 1);
    expect(full.chance).toBeGreaterThan(idle.chance);
    // And a unit holding one has a utility to read.
    const w = engine.simulateWorth(drinker, { seed: 1, runs: 2, cap: 2, budget: 100 });
    expect(w.units.find((u) => u.unit === 'lonqu')!.utility).toBeGreaterThan(0);
  });

  it('names the likely losses: the units the runs lose, by how often', () => {
    const r = engine.simulateRuns({ ...input, idle: ['lissa'] }, 1, 4);
    expect(r.losses.map((l) => l.unit)).toEqual(['lonqu']);
    // Only the hero fights: every lost chance is his.
    expect(r.losses[0]!.chance).toBeCloseTo(1 - r.chance, 12);
  });
});

describe('a unit’s worth on hand-built runs (#202)', () => {
  // Kjelle joins after Paralogue 8 with a Heal staff; at the end a lone Myrmidon holds a wall that wears him down, and
  // only her heals keep him up. Sully and Stahl, her parents, aren't fielded there.
  const cavalier = (id: RosterUnit, name: string, gender: 'M' | 'F') =>
    hero({ id, name, gender, classId: 'cavalier', weapons: [{ item: itemByName('Iron Lance')! }], stats: stats(30, 15, 10, 15, 15, 10, 10, 5) });
  const zero = { str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 };
  const kjelle: ChildRecruit = { id: 'kjelle', name: 'Kjelle', parents: ['sully', 'stahl'], growths: flat, modifiers: zero, weapons: [], items: [{ item: itemByName('Heal')!, uses: 30 }] };
  const input: RunSimInput = {
    army: [hero(), cavalier('sully', 'Sully', 'F'), cavalier('stahl', 'Stahl', 'M'), hero({ id: 'chrom', name: 'Chrom' })],
    maps: [step(rout('paralogue-8', []), { deploy: 4, children: [kjelle] }), step(rout('end', [wall]))],
    difficulty: 'normal',
    cleared: ['chapter-13'],
    married: [['sully', 'stahl']],
    lineups: [undefined, { pairs: [{ lead: 'lonqu' }], solo: ['kjelle'] }],
  };
  const options = { seed: 1, runs: 4, cap: 8 };
  const all = engine.simulateWorth(input, { ...options, budget: 1000 });
  const of = (u: string) => all.units.find((x) => x.unit === u)!;

  it('is the chance lost without the unit, on the plan’s own runs', () => {
    expect(all.converged).toBe(true);
    const plan = engine.simulateRuns(input, 1, 8);
    const noHealer = engine.simulateRuns({ ...input, maps: [step(rout('paralogue-8', []), { deploy: 4 }), input.maps[1]!] }, 1, 8);
    expect(plan.chance).toBeGreaterThan(noHealer.chance);
    expect(of('kjelle').worth).toBeCloseTo(plan.chance - noHealer.chance, 12);
    expect(of('kjelle')).toMatchObject({ runs: 8, settled: true });
  });

  it('counts a parent’s children: removing a unit whose child is on the wishlist costs at least the child’s worth', () => {
    expect(of('kjelle').worth).toBeGreaterThan(0);
    for (const parent of ['sully', 'stahl']) {
      expect(of(parent).children).toEqual(['kjelle']);
      expect(of(parent).worth!).toBeGreaterThanOrEqual(of('kjelle').worth!);
    }
  });

  it('reads the part of the worth from staves, Dance and Rally as utility; none for a unit without them', () => {
    expect(of('kjelle').utility).toBeGreaterThan(0);
    expect(of('kjelle').utility!).toBeLessThanOrEqual(of('kjelle').worth! + 1e-12);
    expect(of('sully').utility).toBe(0);
  });

  it('reads Chrom and Robin as forced', () => {
    expect(of('chrom')).toMatchObject({ forced: true, worth: undefined, utility: undefined });
    expect(all.units.at(-1)!.unit).toBe('chrom');
  });

  it('steps within its budget, and small steps reach what one big step does', () => {
    expect(engine.simulateWorth(input, { ...options, budget: 0 })).toMatchObject({ units: [], evaluations: 0, converged: false });
    let s = engine.simulateWorth(input, { ...options, budget: 3 });
    expect(s.evaluations).toBeLessThanOrEqual(3);
    expect(s.converged).toBe(false);
    for (let i = 0; i < 200 && !s.converged; i++) s = engine.simulateWorth(input, { ...options, budget: 3, cursor: JSON.parse(JSON.stringify(s.cursor)) });
    expect(s.units).toEqual(all.units);
    expect(s.cursor.evaluations).toBe(all.cursor.evaluations);
  });
});

describe('worth and reserves of a recorded run’s plan, through the facade (#202)', () => {
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const fresh = runFromRoster(facts);
  const seed = engine.seedPlan(fresh);
  const fielded = (p: Plan) => [...p.wishlist.units.map((w) => w.unit), ...p.roadmap.lineups.flatMap((l) => [...l.pairs.flatMap((x) => [x.lead, ...(x.back ? [x.back] : [])]), ...l.solo])];

  it('removes a parent with its children, re-matches its spouse and refills its place in the wishlist', () => {
    const [husband, wife] = seed.wishlist.marriages.find((c) => c.includes('frederick'))!;
    const spouse = husband === 'frederick' ? wife : husband;
    const kids = seed.wishlist.children.filter((c) => c.parents.includes('frederick')).map((c) => c.child);
    expect(kids.length).toBeGreaterThan(0);
    const p = engine.worthPlan(fresh, seed, 'frederick');
    expect(p.wishlist.marriages.flat()).not.toContain('frederick');
    expect(fielded(p)).not.toContain('frederick');
    for (const c of p.wishlist.children) expect(c.parents).not.toContain('frederick');
    // Every other couple stays; the spouse marries again where the seed finds a match.
    for (const c of seed.wishlist.marriages.filter((c) => !c.includes('frederick'))) expect(p.wishlist.marriages).toContainEqual(c);
    expect(p.wishlist.marriages.filter((c) => c.includes(spouse)).length).toBeLessThanOrEqual(1);
    expect(p.wishlist.units).toHaveLength(seed.wishlist.units.length);
    expect(p.roadmap.order).toEqual(seed.roadmap.order);
  });

  // Two maps left: each run is cheap.
  const all = engine.mapOrder(fresh).steps.map((s) => s.map);
  const late = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
  const plan = engine.seedPlan(late);
  const small = { run: late, plan, seed: 3, runs: 2, cap: 2 } as const;

  it('lists every unit in the plan’s lineups and reads Chrom and Robin as forced, within its budget', () => {
    const s = engine.unitWorth({ ...small, budget: 6 });
    expect(s.evaluations).toBeLessThanOrEqual(6);
    const ids = s.units.map((u) => u.unit);
    for (const w of plan.wishlist.units) expect(ids).toContain(w.unit);
    expect(s.units.filter((u) => u.forced).map((u) => u.unit).sort()).toEqual(['chrom', 'robin']);
    // Read on the plan's runs: a unit read so far has a worth on as many runs as the plan's.
    for (const u of s.units.filter((x) => x.worth !== undefined)) expect(u.runs).toBe(2);
    expect(JSON.parse(JSON.stringify(s.cursor))).toEqual(s.cursor);
  });

  it('chooses reserves among units off the wishlist against its likely losses, setting no EXP aside', () => {
    const r = engine.reserves({ ...small, budget: 6 });
    expect(r.evaluations).toBeLessThanOrEqual(6);
    const wishlist = plan.wishlist.units.map((w) => w.unit);
    for (const l of r.losses) expect(wishlist).toContain(l.unit);
    if (r.losses.length) expect(r.losses.reduce((a, l) => a + l.weight, 0)).toBeCloseTo(1, 12);
    for (const x of r.reserves) {
      expect(wishlist).not.toContain(x.unit);
      expect(r.losses.map((l) => l.unit)).toContain(x.covers);
    }
    expect(r.plan.roadmap).toEqual(plan.roadmap);
    // The reserves are listed on the plan; nothing else changes (no EXP is set aside).
    expect({ ...r.plan, wishlist: { ...r.plan.wishlist, reserves: [] } }).toEqual({ ...plan, wishlist: { ...plan.wishlist, reserves: [] } });
    expect(r.plan.wishlist.reserves).toEqual(r.reserves.map((x) => ({ unit: x.unit, covers: x.covers })));
  });

  it('steps the reserves from a plain-JSON cursor exactly as from the live one', () => {
    const first = engine.reserves({ ...small, budget: 3 });
    expect(first.evaluations).toBeLessThanOrEqual(3);
    const live = engine.reserves({ ...small, budget: 3, cursor: first.cursor });
    expect(engine.reserves({ ...small, budget: 3, cursor: JSON.parse(JSON.stringify(first.cursor)) })).toEqual(live);
  });
});
