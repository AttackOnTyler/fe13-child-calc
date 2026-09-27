import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, createEngine, editEntry, itemByName, runFromRoster, withRun, type ArmyUnit, type Foe, type RunSimMap, type SimFoeGroup, type SimMap } from './index';

/**
 * The ceiling (#189): the endpoint's flawless chance with every unit of today's plan at its effective caps, hand-built
 * armies and maps first, then a recorded run through the facade.
 */
const engine = createEngine();
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const noMods = { str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 };

const hero = (more: Partial<ArmyUnit> = {}): ArmyUnit => ({
  id: 'lonqu',
  name: 'Hero',
  gender: 'M',
  classId: 'swordmaster',
  level: 5,
  exp: 0,
  count: 0,
  bonus: 20,
  stats: stats(30, 15, 0, 27, 28, 0, 5, 0),
  growths: stats(0, 0, 0, 0, 0, 0, 0, 0),
  modifiers: noMods,
  skills: [],
  weapons: [{ item: itemByName('Iron Sword')! }],
  supports: [],
  role: 'lead',
  ...more,
});

// 22 damage a hit (Str 14 + Iron Axe 8), never doubles or crits.
const brute: Foe = { name: 'Brute', className: 'Fighter', count: 1, stats: stats(40, 14, 0, 0, 0, 60, 10, 0), weapon: itemByName('Iron Axe'), skills: [], boss: false, level: 1 };
// Hits hard enough to threaten a unit at its caps: 49 a hit (Str 34 + Silver Axe 15) against Def 0, fast enough to double.
const titan: Foe = { name: 'Titan', className: 'Berserker', count: 3, stats: stats(60, 34, 0, 60, 60, 30, 20, 20), weapon: itemByName('Silver Axe'), skills: [], boss: false, level: 20 };
const unarmed: Foe = { ...brute, name: 'Unarmed', weapon: undefined };
const group = (foe: Foe): SimFoeGroup => ({ key: foe.name, foe });
const rout = (id: string, foes: Foe[]): SimMap => ({ id, victory: 'rout', foes: foes.map(group), waves: [], skipped: [] });
const step = (map: SimMap, more: Partial<RunSimMap> = {}): RunSimMap => ({ key: map.id, label: map.id, map, deploy: 1, forced: [], joining: [], mapOnly: [], later: [], masterSeals: false, ...more });
const input = (army: ArmyUnit[], maps: RunSimMap[]) => ({ army, maps, difficulty: 'normal' as const });

describe('the ceiling of a hand-built plan (#189)', () => {
  it('puts every unit at its effective caps, promoted from a base class, with no spread', () => {
    const c = engine.simulateCeiling(input([hero({ classId: 'myrmidon', modifiers: { ...noMods, str: 2, spd: -1 } })], [step(rout('end', [brute]))]), 1, 4)!;
    const u = c.units[0]!;
    expect(u.className).toMatch(/^(Swordmaster|Assassin)$/);
    const caps = engine.classMaxStats(u.className === 'Swordmaster' ? 'swordmaster' : 'assassin', 'M');
    expect(u.stats).toEqual({ ...caps, str: caps.str + 2, spd: caps.spd - 1 });
    // Limit Breaker adds 10 to every cap but HP's.
    const lb = engine.simulateCeiling(input([hero({ skills: ['Limit Breaker'] })], [step(rout('end', [brute]))]), 1, 1)!.units[0]!;
    const sm = engine.classMaxStats('swordmaster', 'M');
    expect(lb.stats).toMatchObject({ hp: sm.hp, str: sm.str + 10, def: sm.def + 10 });
  });

  it('plays only the endpoint, with the units the plan has there: the army and every recruit on the way', () => {
    const later = hero({ id: 'vaike', name: 'Late' });
    const c = engine.simulateCeiling(input([hero()], [step(rout('a', [brute]), { later: [later] }), step(rout('end', [brute]), { deploy: 2 })]), 1, 1)!;
    expect(c.key).toBe('end');
    expect(c.units.map((u) => u.id)).toEqual(['lonqu', 'vaike']);
    expect(c.lineup?.deployed).toHaveLength(2);
    expect(engine.simulateCeiling(input([hero()], []), 1, 1)).toBeUndefined();
  });

  it('is never below the flawless chance for the endpoint map alone', () => {
    for (const foes of [[brute], [titan], [brute, titan]]) {
      const plan = input([hero(), hero({ id: 'vaike', name: 'Two', stats: stats(25, 12, 0, 20, 20, 5, 8, 2) })], [step(rout('end', foes), { deploy: 2 })]);
      const flawless = engine.simulateRuns(plan, 3, 4);
      const ceiling = engine.simulateCeiling(plan, 3, 4)!;
      expect(ceiling.chance).toBeDefined();
      expect(ceiling.chance!).toBeGreaterThanOrEqual(flawless.chance);
    }
    // A unit too weak to hurt the Brute can die to it; at its caps it can't.
    const plan = input([hero({ stats: stats(20, 5, 0, 27, 28, 0, 0, 0) })], [step(rout('end', [brute]))]);
    expect(engine.simulateRuns(plan, 1, 1).chance).toBeLessThan(1);
    expect(engine.simulateCeiling(plan, 1, 1)!.chance).toBe(1);
  });

  it('rises when a unit’s caps rise', () => {
    const at = (modifiers: ArmyUnit['modifiers'], skills: string[] = []) => engine.simulateCeiling(input([hero({ modifiers, skills })], [step(rout('end', [titan]))]), 1, 1)!.chance!;
    const base = at(noMods);
    expect(base).toBeGreaterThan(0);
    expect(base).toBeLessThan(1);
    expect(at({ ...noMods, def: 4, spd: 3 })).toBeGreaterThan(base);
    expect(at(noMods, ['Limit Breaker'])).toBeGreaterThan(base);
  });

  it('has no chance when the endpoint’s foes carry no weapons in the chapter data', () => {
    const c = engine.simulateCeiling(input([hero()], [step(rout('a', [brute])), step(rout('end', [unarmed]))]), 1, 1)!;
    expect(c.chance).toBeUndefined();
    expect(c.unarmed).toEqual(['end']);
    // Maps on the way with unarmed foes are named too: the flawless chance doesn't count them.
    expect(engine.simulateCeiling(input([hero()], [step(rout('a', [unarmed])), step(rout('end', [brute]))]), 1, 1)!).toMatchObject({ chance: 1, unarmed: ['a'] });
  });
});

describe('the ceiling of a recorded run (#189)', () => {
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const played = (maps: readonly string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
  const all = engine.mapOrder(played([])).steps.map((s) => s.map);
  const withChrom = (run: ReturnType<typeof played>) =>
    editEntry(run, 'e1', (s) => ({ ...s, units: { ...s.units, chrom: { class: 'Lord', level: 10, promoted: false, reclassed: false, exp: 0, stats: stats(30, 14, 1, 14, 14, 12, 10, 3), skills: [], inventory: [{ item: 'Falchion', uses: null }], supports: [] } } }), 1);

  it('is the endpoint’s, from the army recorded today, and never below the flawless chance there', () => {
    const run = withChrom(played(all.slice(0, -1)));
    const c = engine.ceiling(run)!;
    expect(c.key).toBe('endgame');
    expect(c.label).toBe('Endgame');
    expect(c.units.map((u) => u.id)).toContain('chrom');
    expect(c.units.find((u) => u.id === 'chrom')!.className).toBe('Great Lord');
    const flawless = engine.flawlessChance(run, { runs: 4 }).chance;
    expect(c.chance!).toBeGreaterThanOrEqual(flawless);
    expect(engine.ceiling(run)).toEqual(c);
    expect(engine.ceiling(played(all))).toBeUndefined();
  });

  it('has no chance at Apotheosis, whose foes carry no weapons in the chapter data', () => {
    const full = runFromRoster(withRun(EMPTY_ROSTER, { route: 'full-route', difficulty: 'lunatic', gender: 'F' }));
    const c = engine.ceiling(full, { runs: 1 })!;
    expect(c.key).toBe('apotheosis-secret');
    expect(c.chance).toBeUndefined();
    expect(c.unarmed).toEqual(['Apotheosis', 'Apotheosis (secret route)']);
  });
});
