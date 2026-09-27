import { describe, expect, it } from 'vitest';
import {
  EMPTY_ROSTER,
  QUIET_POINTS,
  STATS,
  addEntry,
  blindSpotsTouching,
  createEngine,
  itemByName,
  runFromRoster,
  withRun,
  type ArmyUnit,
  type ClassMilestone,
  type ExplainContext,
  type Explanation,
  type Foe,
  type RunSimInput,
  type RunSimMap,
  type SimFoeGroup,
  type SimMap,
  type Stat,
} from './index';

/**
 * Every number's explanation (#210): hand-built armies and maps, checked for consistency as the spec asks: a number's
 * rows add up to it where they split it (share of the risk), every drill target exists, and a number's blind spots are
 * exactly those touching its kind.
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
  role: 'lead',
  ...more,
});
// A brute that hits back hard: each fight with it carries some risk.
const brute: Foe = { name: 'Brute', className: 'Fighter', count: 2, stats: stats(40, 16, 0, 10, 5, 0, 5, 0), weapon: itemByName('Iron Axe'), skills: [], boss: false, level: 5 };
// A foe that can barely scratch anyone: a quiet map.
const pest: Foe = { name: 'Pest', className: 'Fighter', count: 1, stats: stats(15, 1, 0, 0, 0, 0, 0, 0), weapon: itemByName('Iron Axe'), skills: [], boss: false, level: 1 };
const group = (foe: Foe): SimFoeGroup => ({ key: foe.name, foe });
const rout = (id: string, foes: Foe[]): SimMap => ({ id, victory: 'rout', foes: foes.map(group), waves: [], skipped: [] });
const step = (map: SimMap, more: Partial<RunSimMap> = {}): RunSimMap => ({ key: map.id, label: `Map ${map.id}`, map, deploy: 2, forced: [], joining: [], mapOnly: [], later: [], masterSeals: false, ...more });
const army = [hero(), hero({ id: 'vaike', name: 'Axe', stats: stats(34, 14, 0, 12, 12, 0, 8, 0), weapons: [{ item: itemByName('Iron Axe')! }] })];
const input: RunSimInput = { army, maps: [step(rout('a', [brute])), step(rout('b', [pest])), step(rout('c', [pest])), step(rout('d', [brute]))], difficulty: 'normal' };
const chance = engine.simulateRuns(input, 1, 4);
const context: ExplainContext = { input, chance, seed: 1 };

const sum = (e: Explanation) => (e.rows ?? []).reduce((a, r) => a + (r.points ?? 0), 0);

/** Every explanation reachable from `id` by drilling, each once. */
function walk(id: string, ctx: ExplainContext): Explanation[] {
  const seen = new Map<string, Explanation>();
  const queue = [id];
  while (queue.length) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    const e = engine.explain(next, ctx);
    expect(e, `drill target ${next}`).toBeDefined();
    seen.set(next, e!);
    for (const r of e!.rows ?? []) if (r.drillTo) queue.push(r.drillTo);
  }
  return [...seen.values()];
}

describe('the headline’s explanation (#210)', () => {
  it('splits the lost points between maps by share of the risk: the rows add up to them', () => {
    expect(chance.chance).toBeLessThan(1);
    const e = engine.explain('flawless', context)!;
    expect(e.value).toBe(chance.chance);
    expect(e.format).toBe('chance');
    expect(sum(e)).toBeCloseTo(-(1 - chance.chance), 12);
    // The riskiest map first, each with its no-death chance, drilling to it.
    expect(e.rows![0]!.drillTo).toMatch(/^map:(a|d)$/);
    expect(e.rows![0]!.chance).toBe(chance.maps.find((m) => `map:${m.key}` === e.rows![0]!.drillTo)!.noDeath);
    // The simulation error is in its math.
    expect(e.math.some((m) => m.includes(`±${(chance.margin * 100).toFixed(1)}`))).toBe(true);
  });

  it('groups the quiet maps, each under half a point', () => {
    const e = engine.explain('flawless', context)!;
    const grouped = e.rows!.find((r) => r.label.startsWith('2 quieter maps'));
    expect(grouped).toBeDefined();
    expect(grouped!.drillTo).toBeUndefined();
    expect(Math.abs(grouped!.points!)).toBeLessThan(2 * QUIET_POINTS);
  });

  it('drills headline → map → fight, and every drill target exists', () => {
    const all = walk('flawless', context);
    expect(all.map((e) => e.kind)).toEqual(expect.arrayContaining(['flawless', 'map', 'fight']));
  });

  it('splits a map’s points again between its fights, which add up to them', () => {
    const f = engine.explain('flawless', context)!;
    const row = f.rows!.find((r) => r.drillTo === 'map:a')!;
    const m = engine.explain('map:a', context)!;
    expect(m.value).toBe(chance.maps[0]!.noDeath);
    expect(sum(m)).toBeCloseTo(row.points!, 12);
    expect(m.rows!.every((r) => !r.chance || r.kill)).toBe(true);
  });

  it('stops at a fight’s combat math, with the stats used and a link to the matchup', () => {
    const map = engine.explain('map:a', context)!;
    const fight = engine.explain(map.rows!.find((r) => r.drillTo)!.drillTo!, context)!;
    expect(fight.kind).toBe('fight');
    expect(fight.format).toBe('kill');
    expect(fight.value).toBeGreaterThan(0);
    expect(fight.stop).toMatch(/trail stops here/);
    expect(fight.matchup).toEqual({ map: 'a', foe: 'Brute' });
    expect(fight.rows!.map((r) => r.label)).toEqual(expect.arrayContaining(['Brute hits Hero']));
    // The next map is played with the army as recorded.
    expect(fight.math[0]).toMatch(/HP 30.*\(as recorded\)/);
  });

  it('reads a later map’s stats as a spread over the runs (10th–90th percentile)', () => {
    const map = engine.explain('map:d', context)!;
    const fight = engine.explain(map.rows!.find((r) => r.drillTo)!.drillTo!, context)!;
    expect(fight.math[0]).toMatch(/10th–90th percentile/);
  });

  it('is undefined for an unknown number', () => {
    expect(engine.explain('map:nowhere', context)).toBeUndefined();
    expect(engine.explain('nonsense', context)).toBeUndefined();
    expect(engine.explain('flawless', {})).toBeUndefined();
  });
});

describe('each number’s blind spots (#210)', () => {
  it('are exactly those touching its kind, each with its lean', () => {
    const all = [...walk('flawless', context), engine.explain('ceiling', context)!];
    for (const e of all) expect(e.blindSpots.map((b) => b.id)).toEqual(blindSpotsTouching(e.kind).map((b) => b.id));
    const ids = (k: Parameters<typeof blindSpotsTouching>[0]) => blindSpotsTouching(k).map((b) => b.id);
    // A fight rests on its own play's simplifications, not on a map's rules or the run's walk.
    expect(ids('fight')).toContain('one-worst-attacker');
    expect(ids('fight')).not.toContain('door-keys');
    expect(ids('fight')).not.toContain('simulation-error');
    // The headline rests on both, and on its simulation error.
    expect(ids('flawless')).toEqual(expect.arrayContaining(['one-worst-attacker', 'door-keys', 'exp-from-likely-play', 'simulation-error']));
    // A milestone rests on the EXP forecast's.
    expect(ids('milestone')).toEqual(expect.arrayContaining(['exp-from-likely-play', 'equal-share-of-actions']));
    expect(ids('milestone')).not.toContain('door-keys');
    expect(engine.blindSpots().find((b) => b.id === 'simulation-error')!.lean).toBe('either');
  });
});

describe('the ceiling’s explanation (#210)', () => {
  it('splits what caps don’t fix between the endpoint’s fights', () => {
    // A titan that threatens even a capped army.
    const titan: Foe = { name: 'Titan', className: 'Berserker', count: 3, stats: stats(60, 40, 0, 60, 60, 30, 20, 20), weapon: itemByName('Silver Axe'), skills: [], boss: false, level: 20 };
    const hard: RunSimInput = { ...input, maps: [step(rout('a', [brute])), step(rout('end', [titan]))] };
    const ctx = { input: hard, chance: engine.simulateRuns(hard, 1, 2), seed: 1 };
    const e = engine.explain('ceiling', ctx)!;
    const ceiling = engine.simulateCeiling(hard, 1, 2)!;
    expect(e.value).toBe(ceiling.chance);
    expect(e.value).toBeLessThan(1);
    expect(sum(e)).toBeCloseTo(-(1 - ceiling.chance!), 12);
    for (const x of walk('ceiling', ctx).slice(1)) expect(x.kind).toBe('fight');
  });
});

describe('a comparison’s explanation: edit → maps (#210)', () => {
  const weaker: RunSimInput = { ...input, army: [hero({ stats: stats(24, 12, 0, 15, 15, 0, 3, 0) }), army[1]!] };
  const other = engine.simulateRuns(weaker, 1, 4);

  it('shows its paired error in its math, and waits for the other plan’s runs for its rows', () => {
    const e = engine.explain('edit:x', { ...context, comparisons: { x: { kind: 'edit', label: 'A weaker hero', gain: -0.05, margin: 0.02, runs: 4, drill: true } } })!;
    expect(e.format).toBe('difference');
    expect(e.margin).toBe(0.02);
    expect(e.math[0]).toMatch(/same 4 runs.*±2\.0 \(95%\)/);
    expect(e.pending).toBe('other');
    expect(e.rows).toBeUndefined();
  });

  it('splits the difference by map once it has them, each drilling to the map', () => {
    const ctx = { ...context, comparisons: { x: { kind: 'edit' as const, label: 'A weaker hero', gain: -0.05, margin: 0.02, runs: 4, other } } };
    const e = engine.explain('edit:x', ctx)!;
    expect(e.pending).toBeUndefined();
    // The rows add up to the difference of the two chances on those runs.
    expect(sum(e)).toBeCloseTo(other.chance - chance.chance, 3);
    walk('edit:x', ctx);
  });

  it('reads a close call as one', () => {
    const e = engine.explain('edit:y', { ...context, comparisons: { y: { kind: 'close-call', label: 'Either', gain: -0.002, margin: 0.003, close: true } } })!;
    expect(e.close).toBe(true);
    expect(e.math.join(' ')).toMatch(/no measurable difference/);
  });
});

describe('a unit’s worth: worth → lineup spans → maps (#210)', () => {
  it('lists its spans, each by position, drilling to its riskiest map', () => {
    const without = engine.simulateRuns({ ...input, army: [army[1]!] }, 1, 4);
    const worth = [{ unit: 'lonqu' as const, forced: false, worth: 0.1, margin: 0.03, utility: 0, utilityMargin: 0, runs: 4, children: [], settled: true }];
    const pending = engine.explain('worth:lonqu', { ...context, worth })!;
    expect(pending.pending).toBe('without');
    const e = engine.explain('worth:lonqu', { ...context, worth, without: { lonqu: without } })!;
    expect(e.format).toBe('points');
    expect(e.rows![0]!.label).toMatch(/^(Lead|Back|Solo): Map a–Map d$/);
    expect(e.rows![0]!.points).toBeDefined();
    walk('worth:lonqu', { ...context, worth, without: { lonqu: without } });
    expect(engine.explain('worth:chrom', { ...context, worth })).toBeUndefined();
  });
});

describe('a milestone’s chance: milestone → EXP per map → foe groups (#210)', () => {
  it('lists the EXP the unit earns on each map before it, stopping at the forecast’s foe groups', () => {
    const at = { key: 'd', label: 'Map d', index: 3, when: 'start' as const };
    const m: ClassMilestone = { id: 'class:lonqu:swordmaster', kind: 'class', at, units: ['lonqu'], unit: 'lonqu', classId: 'swordmaster', className: 'Swordmaster', seal: 'master', source: { how: 'held' } };
    const checked: RunSimInput = { ...input, milestones: [{ id: m.id, index: 3, when: 'start', units: ['lonqu'], test: { kind: 'class', unit: 'lonqu', classId: 'swordmaster' } }] };
    const r = engine.simulateRuns(checked, 1, 4);
    const ctx: ExplainContext = { input: checked, chance: r, seed: 1, milestones: [m] };
    const e = engine.explain(`milestone:${m.id}`, ctx)!;
    expect(e.value).toBe(r.milestones[0]!.chance);
    expect(e.title).toMatch(/Hero reaches Swordmaster by the start of Map d/);
    expect(e.rows!.map((x) => x.drillTo)).toEqual(['exp:a:lonqu', 'exp:b:lonqu', 'exp:c:lonqu'].filter((id) => engine.explain(id, ctx)));
    const exp = walk(`milestone:${m.id}`, ctx).find((x) => x.kind === 'exp')!;
    expect(exp.stop).toMatch(/foe groups/);
    expect(exp.rows![0]!.label).toMatch(/Brute|Pest/);
  });
});

describe('explanations from a recorded run (#210)', () => {
  it('reads the run and plan the page holds: the headline down to a fight, the ceiling, a milestone', () => {
    const run0 = runFromRoster(withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' }));
    const all = engine.mapOrder(run0).steps.map((s) => s.map);
    const run = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), run0);
    const plan = engine.seedPlan(run);
    // The EXP forecast is the headline's own simulation with the milestones checked.
    const chance = engine.expForecast(run, plan, { runs: 2 });
    const ctx: ExplainContext = { run, plan, chance, seed: 1 };
    const tree = walk('flawless', ctx);
    expect(tree.map((e) => e.kind)).toEqual(expect.arrayContaining(['flawless', 'map', 'fight']));
    expect(sum(tree[0]!)).toBeCloseTo(-(1 - chance.chance), 12);
    expect(engine.explain('ceiling', ctx)?.value).toBe(engine.ceiling(run, { plan, runs: 2 })?.chance);
    const m = engine.milestones(run, plan)[0]!;
    const e = walk(`milestone:${m.id}`, ctx)[0]!;
    expect(e.kind).toBe('milestone');
    expect(e.blindSpots.map((b) => b.id)).toEqual(blindSpotsTouching('milestone').map((b) => b.id));
  });
});
