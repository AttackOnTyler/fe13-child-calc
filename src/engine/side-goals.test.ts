import { describe, expect, it } from 'vitest';
import {
  EMPTY_ROSTER,
  RENOWN,
  SIDE_GOAL_IDS,
  STATS,
  addEntry,
  createEngine,
  editEntry,
  exportRun,
  importRun,
  itemByName,
  latestEntry,
  resolveAssumptions,
  runFromRoster,
  sellPrice,
  withRenown,
  withRun,
  withSideGoalPin,
  withSideGoalSecured,
  type ArmyUnit,
  type Fighter,
  type Foe,
  type Run,
  type RunSimMap,
  type RunSimSideGoal,
  type SideGoalId,
  type SimGroup,
  type SimMap,
  type Snapshot,
  type Stat,
} from './index';

/**
 * Side goals and renown (#191): the chase as actions in the map play, the share of simulated runs that secure each
 * goal, pins, Record results' side goals step, and renown rewards placed on the map that crosses them.
 */
const engine = createEngine();
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const weapon = (name: string) => ({ item: itemByName(name)! });
const fighter = (name: string): Fighter => ({ name, className: 'Myrmidon', stats: stats(20, 15, 0, 60, 40, 0, 0, 0), skills: [], weapon: weapon('Iron Sword') });
const solo = (f: Fighter): SimGroup => ({ lead: { id: f.name.toLowerCase(), fighter: f, weapons: f.weapon ? [f.weapon] : [] }, support: null });
// A foe that never fights back and falls to one round (20 HP, the hero's 10 a hit, doubled).
const dummy = (count: number): Foe => ({ name: 'Dummy', className: 'Fighter', count, stats: stats(20, 0, 0, 0, 0, 0, 0, 0), weapon: undefined, skills: [], boss: false });
const rout = (count: number): SimMap => ({ id: 'test', victory: 'rout', foes: [{ key: 'Dummy', foe: dummy(count) }], waves: [], skipped: [] });

describe('chasing a side goal in the map play (#191)', () => {
  it('spends the chase’s actions by its turn and reports it met; the fighting waits for them', () => {
    const lineup = [solo(fighter('A')), solo(fighter('B'))];
    const plain = engine.playMap({ map: rout(6), lineup }, 1);
    expect(plain.turns).toBe(3);
    expect(plain.chased).toBeUndefined();
    const chased = engine.playMap({ map: rout(6), lineup, chase: [{ id: 'thieves', actions: 2, by: 2 }] }, 1);
    expect(chased.chased).toEqual({ thieves: true });
    const acts = chased.log.flatMap((t) => t.acts.filter((a) => a.kind === 'chase').map((a) => ({ turn: t.turn, target: a.target })));
    // Paced one a turn: turn 1 and turn 2, each by a front that would otherwise have fought.
    expect(acts).toEqual([
      { turn: 1, target: 'thieves' },
      { turn: 2, target: 'thieves' },
    ]);
    expect(chased.turns).toBe(4);
  });

  it('misses a chase the army has no actions left for by its turn', () => {
    const lineup = [solo(fighter('A'))];
    const play = engine.playMap({ map: rout(3), lineup, chase: [{ id: 'villages', actions: 3, by: 2 }] }, 1);
    expect(play.chased).toEqual({ villages: false });
  });
});

const facts = withRun(EMPTY_ROSTER, { route: 'full-route', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
const bullion = (size: 'S' | 'M' | 'L') => sellPrice(itemByName(`Bullion (${size})`)!);
const played = (maps: readonly string[], base: Run = runFromRoster(facts)) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), base);

describe('side goals: the plan’s decision and pins (#191)', () => {
  it('lists every flagged side goal with a chase decision by the default rule: at most one action a turn until its deadline', () => {
    const goals = engine.sideGoals(runFromRoster(facts));
    expect(goals.map((g) => g.goal.id).sort()).toEqual([...SIDE_GOAL_IDS].sort());
    const decision = Object.fromEntries(goals.map((g) => [g.goal.id, g.decision]));
    expect(decision).toMatchObject({ 'chapter-10-thieves': 'chase', 'paralogue-2-village': 'chase', 'chapter-18-chests': 'chase', 'paralogue-13-result': 'chase' });
    // Five villagers to guard by turn 3: more than one action a turn.
    expect(decision['paralogue-7-result']).toBe('skip');
    expect(decision['paralogue-11-result']).toBe('skip');
    expect(goals.every((g) => !g.pinned)).toBe(true);
  });

  it('reads each goal’s rows from the chapter data: gold, seals and items; Chapter 18’s chests each by the floor’s turn', () => {
    const byId = (id: SideGoalId) => engine.sideGoals(runFromRoster(facts)).find((g) => g.goal.id === id)!.goal;
    expect(byId('chapter-10-thieves')).toMatchObject({ label: 'Chapter 10: Thieves', gold: bullion('M'), seals: { master: 1, second: 0 } });
    expect(byId('chapter-10-thieves').items).toEqual(['Bullion (M)', 'Wyrmslayer', 'Master Seal', 'Seraph Robe']);
    // Backing neither side: both leaders' Bullion and 10,000G, not the 500G per allied NPC.
    expect(byId('paralogue-13-result').gold).toBe(10000 + 2 * bullion('M'));
    expect(byId('paralogue-12-thieves').seals).toEqual({ master: 0, second: 1 });
    expect(byId('paralogue-14-villages').gold).toBe(bullion('L'));
    const chests = byId('chapter-18-chests').parts.map((p) => [p.rows[0]!.item, p.by]);
    // A chest lost on turn 11's player phase must be opened by turn 10.
    expect(chests).toEqual([
      ['Second Seal', 11],
      ['Energy Drop', 10],
      ['Rescue', 10],
      ['Bullion (M)', 7],
    ]);
  });

  it('pins a goal to always take or skip, kept with the run; unpinning restores the default', () => {
    let run = withSideGoalPin(runFromRoster(facts), 'paralogue-7-result', 'chase');
    run = withSideGoalPin(run, 'chapter-10-thieves', 'skip');
    const read = (r: Run, id: SideGoalId) => engine.sideGoals(r).find((g) => g.goal.id === id)!;
    expect(read(run, 'paralogue-7-result')).toMatchObject({ decision: 'chase', pinned: true });
    expect(read(run, 'chapter-10-thieves')).toMatchObject({ decision: 'skip', pinned: true });
    const back = importRun(exportRun(run));
    expect(back.sideGoals).toEqual({ 'paralogue-7-result': 'chase', 'chapter-10-thieves': 'skip' });
    expect(read(withSideGoalPin(back, 'chapter-10-thieves', undefined), 'chapter-10-thieves')).toMatchObject({ decision: 'chase', pinned: false });
  });
});

// A hand-built run: units that each fell a dummy a turn, on a map with a side goal.
const flat = (() => {
  const g = engine.classGrowths('myrmidon', 'M');
  return Object.fromEntries(STATS.map((s) => [s, -g[s]])) as Record<Stat, number>;
})();
const soldier = (id: string): ArmyUnit => ({
  id: id as ArmyUnit['id'],
  name: id,
  gender: 'M',
  classId: 'myrmidon',
  level: 5,
  exp: 0,
  count: 0,
  bonus: 0,
  stats: stats(20, 15, 0, 60, 40, 0, 0, 0),
  growths: flat,
  modifiers: { str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 },
  skills: [],
  weapons: [weapon('Iron Sword')],
  supports: [],
});
const goal = (chase: boolean, actions: number, by: number): RunSimSideGoal => ({
  id: 'thieves',
  label: 'Test: Thieves',
  chase,
  parts: [{ chase: { id: 'thieves#0', actions, by }, gold: 3000, seals: { master: 1, second: 0 } }],
});
const oneMap = (g: RunSimSideGoal): RunSimMap => ({ key: 'a', label: 'A', map: { ...rout(4), id: 'a' }, deploy: 2, forced: [], joining: [], mapOnly: [], later: [], masterSeals: false, sideGoals: [g] });

describe('side goals in the simulated runs (#191)', () => {
  const army = [soldier('lonqu'), soldier('vaike')];
  it('pays a chased goal secured in time, and counts the share of runs that secure it', () => {
    const sim = engine.simulateRuns({ army, maps: [oneMap(goal(true, 2, 2))], difficulty: 'normal', gold: 1000 }, 1, 3);
    expect(sim.sideGoals).toEqual([{ id: 'thieves', label: 'Test: Thieves', key: 'a', chase: true, secured: 1 }]);
    expect(sim.maps[0]!.gold).toEqual({ low: 4000, median: 4000, high: 4000 });
    expect(sim.blindSpots).toContain('side-goal-actions');
  });

  it('counts nothing for a skipped goal, or one the army has no actions for in time', () => {
    const skipped = engine.simulateRuns({ army, maps: [oneMap(goal(false, 2, 2))], difficulty: 'normal', gold: 1000 }, 1, 2);
    expect(skipped.sideGoals[0]).toMatchObject({ chase: false, secured: 0 });
    expect(skipped.maps[0]!.gold?.median).toBe(1000);
    const late = engine.simulateRuns({ army, maps: [oneMap(goal(true, 5, 2))], difficulty: 'normal', gold: 1000 }, 1, 2);
    expect(late.sideGoals[0]).toMatchObject({ chase: true, secured: 0 });
    expect(late.maps[0]!.gold?.median).toBe(1000);
  });
});

describe('renown (#191)', () => {
  const upTo4 = ['prologue', 'chapter-1', 'chapter-2', 'chapter-3'];
  it('asks once, then adds 10 per story map: each reward crossed arrives on its map; paralogues give 0 (an assumption)', () => {
    const run = withRenown(played(upTo4), { start: 55, claimed: ['Glass Sword'] });
    const r = engine.renown(run);
    expect(r).toMatchObject({ recorded: true, now: 95, waiting: [] });
    expect(r.stops.find((s) => s.key === 'chapter-4')).toMatchObject({ renown: 105, rewards: ['Second Seal'] });
    const p1 = r.stops.findIndex((s) => s.map === 'paralogue-2');
    expect(r.stops[p1]!.renown).toBe(r.stops[p1 - 1]!.renown);
    const generous = createEngine(resolveAssumptions({ 'paralogue-renown': 10 }));
    const g = generous.renown(run).stops;
    expect(g[p1]!.renown).toBe(g[p1 - 1]!.renown + 10);
  });

  it('holds rewards reached and not claimed from now; before Chapter 3 they wait for the menu', () => {
    expect(engine.renown(withRenown(played(upTo4), { start: 60, claimed: [] })).waiting).toEqual(['Glass Sword', 'Second Seal']);
    const early = engine.renown(withRenown(played(['prologue']), { start: 95, claimed: [] }));
    expect(early.waiting).toEqual([]);
    expect(early.stops.find((s) => s.key === 'chapter-1')!.rewards).toEqual([]);
    expect(early.stops.find((s) => s.key === 'chapter-3')!.rewards).toEqual(['Glass Sword', 'Second Seal']);
  });

  it('reads an unrecorded renown as 10 per story map logged, every reward so far claimed', () => {
    const r = engine.renown(played(upTo4));
    expect(r).toMatchObject({ recorded: false, now: 40, waiting: [] });
    expect(r.stops.find((s) => s.key === 'chapter-4')).toMatchObject({ renown: 50, rewards: ['Glass Sword'] });
  });

  it('counts Bullion (L) at 1,000 in the runs’ gold on the map that crosses it, and keeps the renown with the run', () => {
    const base = played(upTo4);
    const run = withRenown(base, { start: 955, claimed: RENOWN.rewards.filter((x) => x.renown <= 995).map((x) => x.item) });
    expect(engine.renown(run).stops.find((s) => s.key === 'chapter-4')!.rewards).toEqual(['Bullion (L)']);
    const withRenownSim = engine.flawlessChance(run, { runs: 1 });
    const gold = (r: typeof withRenownSim) => r.maps.find((m) => m.key === 'chapter-4')?.gold?.median;
    expect(gold(withRenownSim)! - gold(engine.flawlessChance(base, { runs: 1 }))!).toBe(bullion('L'));
    expect(withRenownSim.renown).toEqual(engine.renown(run));
    // Every side goal on the map order is in the forecast, with the plan's decision.
    expect(withRenownSim.sideGoals.find((g) => g.id === 'chapter-10-thieves')).toMatchObject({ key: 'chapter-10', label: 'Chapter 10: Thieves', chase: true });
    expect(withRenownSim.sideGoals.find((g) => g.id === 'paralogue-7-result')).toMatchObject({ chase: false });
    expect(importRun(exportRun(run)).renown).toEqual(run.renown);
  });
});

describe('Record results: side goals secured (#191)', () => {
  const at = (run: Run, id: string, edit: (s: Snapshot) => Snapshot) => editEntry(run, id, edit, 1);
  const ch10 = (convoy: string[]) => {
    const run = played(['chapter-10']);
    const e = latestEntry(run)!;
    return { run: at(run, e.id, (s) => ({ ...s, convoy: convoy.map((item) => ({ item, uses: null })) })), entry: e.id };
  };
  it('pre-fills a goal secured when every item it holds came from the map', () => {
    const all = ch10(['Bullion (M)', 'Wyrmslayer', 'Master Seal', 'Seraph Robe']);
    expect(engine.sideGoalsSecured(all.run, all.entry)).toMatchObject([{ goal: { id: 'chapter-10-thieves' }, secured: true, recorded: false }]);
    const some = ch10(['Wyrmslayer']);
    expect(engine.sideGoalsSecured(some.run, some.entry)[0]).toMatchObject({ secured: false, recorded: false, found: ['Wyrmslayer'] });
  });

  it('records what the player says, over the pre-fill, and keeps it with the entry', () => {
    const some = ch10(['Wyrmslayer']);
    const run = withSideGoalSecured(some.run, some.entry, 'chapter-10-thieves', true, 2);
    expect(engine.sideGoalsSecured(run, some.entry)[0]).toMatchObject({ secured: true, recorded: true });
    expect(importRun(exportRun(run)).entries.at(-1)!.sideGoals).toEqual({ 'chapter-10-thieves': true });
    const cleared = withSideGoalSecured(run, some.entry, 'chapter-10-thieves', undefined, 3);
    expect(engine.sideGoalsSecured(cleared, some.entry)[0]).toMatchObject({ secured: false, recorded: false });
    expect(engine.sideGoalsSecured(played(['chapter-9']), 'e2')).toEqual([]);
  });
});
