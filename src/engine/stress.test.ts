import { describe, expect, it } from 'vitest';
import {
  EMPTY_ROSTER,
  STATS,
  STRESS_TESTS,
  addEntry,
  blindSpotsTouching,
  createEngine,
  itemByName,
  runFromRoster,
  withRun,
  type ArmyUnit,
  type Fighter,
  type Foe,
  type RunSimInput,
  type RunSimMap,
  type SimFoeGroup,
  type SimGroup,
  type SimMap,
  type Stat,
} from './index';

/**
 * The stress test (#211; spec #175, The Why panel): a stated blind spot that can be stressed has a bad case the plan is
 * re-run under, so the headline can say how low the chance could go ("as low as 31.8% if two attackers reach each
 * exposed pair"). Hand-built maps, small run counts.
 */
const engine = createEngine();
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const weapon = (name: string) => ({ item: itemByName(name)! });

// Hits every time, doubles, 10 damage a hit; the Brute hits back hard (one hit kills).
const hero: Fighter = { name: 'Hero', className: 'Myrmidon', stats: stats(20, 15, 0, 60, 40, 0, 0, 0), skills: [], weapon: weapon('Iron Sword') };
const brute: Foe = { name: 'Brute', className: 'Fighter', count: 2, stats: stats(40, 30, 0, 0, 0, 60, 10, 0), weapon: itemByName('Iron Axe'), skills: [], boss: false };
const unit = (f: Fighter) => ({ id: f.name.toLowerCase(), fighter: f, weapons: f.weapon ? [f.weapon] : [] });
const solo = (f: Fighter): SimGroup => ({ lead: unit(f), support: null });
const group = (foe: Foe): SimFoeGroup => ({ key: foe.name, foe });
const rout = (foes: SimFoeGroup[]): SimMap => ({ id: 'test', victory: 'rout', foes, waves: [], skipped: [] });

describe('the blind spots that can be stressed (#211)', () => {
  it('are one worst attacker per pair and Rally reaching every pair, each with its bad case in words', () => {
    expect(engine.stressTests()).toEqual(STRESS_TESTS);
    expect(STRESS_TESTS.map((s) => [s.id, s.blindSpot])).toEqual([
      ['two-attackers', 'one-worst-attacker'],
      ['no-rally', 'rally-reaches-every-pair'],
    ]);
    expect(STRESS_TESTS[0]!.bad).toBe('two attackers reach each exposed pair');
    expect(STRESS_TESTS[1]!.bad).toBe('Rally reaches no pair');
    // Each is a stated blind spot that touches the headline.
    const touching = blindSpotsTouching('flawless').map((b) => b.id);
    for (const s of STRESS_TESTS) expect(touching).toContain(s.blindSpot);
  });
});

describe('a map played under a blind spot’s bad case (#211)', () => {
  it('two attackers: each exposed front takes a second attack on enemy phase, each foe still attacking once', () => {
    // A tank the cleric heals each turn: one attack a turn it lives through, two between heals it may not.
    const tank: Fighter = { name: 'Tank', className: 'Myrmidon', stats: stats(30, 15, 0, 60, 30, 0, 10, 0), skills: [], weapon: weapon('Iron Sword') };
    const cleric: Fighter = { name: 'Cleric', className: 'Cleric', stats: stats(20, 0, 10, 5, 5, 5, 2, 8), skills: [], weapon: undefined };
    const healer: SimGroup = { lead: { id: 'cleric', fighter: cleric, weapons: [], items: [{ item: itemByName('Physic')!, uses: 30 }] }, support: null };
    const wall: Foe = { ...brute, name: 'Wall', stats: stats(60, 16, 0, 0, 0, 60, 15, 0) };
    const input = { map: rout([group(wall)]), lineup: [solo(tank), healer] };
    const base = engine.playMap(input, 1);
    const stressed = engine.playMap({ ...input, stress: 'two-attackers' }, 1);
    const enemy = (p: typeof base) => p.log[0]!.fights.filter((f) => f.phase === 'enemy').length;
    expect(enemy(base)).toBe(1);
    expect(enemy(stressed)).toBe(2);
    expect(stressed.noDeath).toBeLessThan(base.noDeath);
    // One foe can't attack twice: with one Wall, the bad case is the model's reading.
    const one = { ...input, map: rout([group({ ...wall, count: 1 })]) };
    expect(engine.playMap({ ...one, stress: 'two-attackers' }, 1).noDeath).toBe(engine.playMap(one, 1).noDeath);
  });

  it('no Rally: a Rally skill’s holder never rallies, so its bonus reaches nobody', () => {
    const tank: Fighter = { name: 'Tank', className: 'Myrmidon', stats: stats(30, 15, 0, 60, 30, 0, 10, 0), skills: [], weapon: weapon('Iron Sword') };
    const wall: Foe = { ...brute, name: 'Wall', count: 1, stats: stats(60, 13, 0, 0, 0, 60, 15, 0) };
    const rallier: Fighter = { name: 'Rallier', className: 'Cleric', stats: stats(20, 0, 10, 5, 5, 5, 2, 8), skills: ['Rally Defence'], weapon: undefined };
    const input = { map: rout([group(wall)]), lineup: [solo(tank), solo(rallier)] };
    const rallied = engine.playMap(input, 1);
    const stressed = engine.playMap({ ...input, stress: 'no-rally' }, 1);
    expect(rallied.log.flatMap((t) => t.acts).some((a) => a.kind === 'rally')).toBe(true);
    expect(stressed.log.flatMap((t) => t.acts).some((a) => a.kind === 'rally')).toBe(false);
    expect(stressed.noDeath).toBeLessThan(rallied.noDeath);
  });
});

describe('a plan re-run under a blind spot’s bad case (#211)', () => {
  const myrmidon = engine.classGrowths('myrmidon', 'M');
  const flat = Object.fromEntries(STATS.map((s) => [s, -myrmidon[s]])) as Record<Stat, number>;
  const armyUnit = (more: Partial<ArmyUnit> = {}): ArmyUnit => ({
    id: 'lonqu',
    name: 'Hero',
    gender: 'M',
    classId: 'myrmidon',
    level: 5,
    exp: 0,
    count: 0,
    bonus: 0,
    stats: stats(30, 15, 0, 20, 20, 0, 6, 0),
    growths: flat,
    modifiers: { str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 },
    skills: [],
    weapons: [{ item: itemByName('Iron Sword')! }],
    supports: [],
    ...more,
  });
  const foe: Foe = { name: 'Brute', className: 'Fighter', count: 4, stats: stats(40, 16, 0, 10, 5, 0, 5, 0), weapon: itemByName('Iron Axe'), skills: [], boss: false, level: 5 };
  const map = (id: string): SimMap => ({ id, victory: 'rout', foes: [group(foe)], waves: [], skipped: [] });
  const step = (m: SimMap): RunSimMap => ({ key: m.id, label: `Map ${m.id}`, map: m, deploy: 2, forced: [], joining: [], mapOnly: [], later: [], masterSeals: false });
  const input: RunSimInput = { army: [armyUnit(), armyUnit({ id: 'vaike', name: 'Axe', weapons: [{ item: itemByName('Iron Axe')! }] })], maps: [step(map('a')), step(map('b'))], difficulty: 'normal' };

  it('plays the same runs with the bad case: the chance goes no higher, and the same input gives the same runs', () => {
    const base = engine.simulateRuns(input, 1, 4);
    const stressed = engine.simulateRuns({ ...input, stress: 'two-attackers' }, 1, 4);
    expect(stressed.chance).toBeLessThan(base.chance);
    expect(engine.simulateRuns({ ...input, stress: 'two-attackers' }, 1, 4)).toEqual(stressed);
    // No Rally in this army: its bad case changes nothing.
    expect(engine.simulateRuns({ ...input, stress: 'no-rally' }, 1, 4).chance).toBe(base.chance);
  });

  it('explains each range: the stressed chance, the headline and the paired difference, by map', () => {
    const chance = engine.simulateRuns(input, 1, 4);
    const stressed = engine.simulateRuns({ ...input, stress: 'two-attackers' }, 1, 4);
    const ctx = { input, chance, seed: 1 };
    // Nothing to explain until the stressed runs are in.
    expect(engine.explain('stress:two-attackers', ctx)).toBeUndefined();
    const e = engine.explain('stress:two-attackers', { ...ctx, stress: { 'two-attackers': stressed } })!;
    expect(e).toMatchObject({ kind: 'stress', format: 'chance', value: stressed.chance, title: 'If two attackers reach each exposed pair' });
    expect(e.lead).toMatch(/One worst attacker per pair/);
    expect(e.math.join(' ')).toMatch(/same 4 runs/);
    // The rows split the difference by map and add up to it.
    expect((e.rows ?? []).reduce((a, r) => a + (r.points ?? 0), 0)).toBeCloseTo(stressed.chance - chance.chance, 3);
    // It rests on the headline's blind spots but the one its bad case replaces.
    expect(e.blindSpots.map((b) => b.id)).toEqual(blindSpotsTouching('flawless').map((b) => b.id).filter((b) => b !== 'one-worst-attacker'));
    expect(engine.explain('stress:nothing', ctx)).toBeUndefined();
  });

  it('re-runs a run’s plan on the headline’s seed and runs (the facade’s `stressChance`)', () => {
    const run0 = runFromRoster(withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' }));
    const all = engine.mapOrder(run0).steps.map((s) => s.map);
    const run = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), run0);
    const plan = engine.seedPlan(run);
    const base = engine.flawlessChance(run, { plan, runs: 2, seed: 3 });
    const stressed = engine.stressChance(run, plan, 'two-attackers', { runs: 2, seed: 3 });
    expect(stressed.runs).toBe(2);
    expect(stressed.chance).toBeLessThanOrEqual(base.chance);
    expect(stressed.maps.map((m) => m.key)).toEqual(base.maps.map((m) => m.key));
  });
});
