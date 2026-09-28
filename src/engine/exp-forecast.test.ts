import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, STATS, addEntry, createEngine, editEntry, itemByName, latestEntry, runFromRoster, withPin, withRun, type ArmyUnit, type ClassId, type Foe, type MilestoneCheck, type Run, type RunSimInput, type RunSimMap, type SimMap, type Snapshot, type Stat } from './index';

/**
 * The EXP forecast and EXP priority (#195): hand-built armies on maps of foes that never fight back, whose EXP can be
 * worked by hand (growths zeroed, so stats never move and each run plays alike), then the prototype's finding.
 */
const engine = createEngine();
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
/** Personal growths that cancel the class's: stats never move. */
const still = (classId: ClassId) => {
  const g = engine.classGrowths(classId, 'M');
  return Object.fromEntries(STATS.map((s) => [s, -g[s]])) as Record<Stat, number>;
};
const unit = (id: ArmyUnit['id'], name: string, classId: ClassId, str: number, more: Partial<ArmyUnit> = {}): ArmyUnit => ({
  id,
  name,
  gender: 'M',
  classId,
  level: 8,
  exp: 0,
  count: 0,
  bonus: 0,
  // Hits every time (Skl 60), never crits (the foe's Lck 60), never doubles (Spd 0).
  stats: stats(40, str, 0, 60, 0, 0, 5, 0),
  growths: still(classId),
  modifiers: { str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 },
  skills: [],
  weapons: [{ item: itemByName('Iron Sword')! }],
  supports: [],
  ...more,
});
// Chrom fells a Lv 8 dummy in one blow (20 damage); Robin only halves it (10).
const chrom = unit('chrom', 'Chrom', 'lord', 15);
const robin = unit('robin', 'Robin', 'tactician', 5);
const dummy = (count: number, hp = 20): Foe => ({ name: 'Dummy', className: 'Fighter', count, stats: stats(hp, 0, 0, 0, 0, 60, 0, 0), weapon: undefined, skills: [], boss: false, level: 8 });
const rout = (id: string, foes: Foe[]): SimMap => ({ id, victory: 'rout', foes: foes.map((foe) => ({ key: foe.name, foe })), waves: [], skipped: [] });
const step = (id: string, foes: Foe[], more: Partial<RunSimMap> = {}): RunSimMap => ({ key: id, label: id.toUpperCase(), map: rout(id, foes), deploy: 2, forced: [], joining: [], mapOnly: [], later: [], masterSeals: false, ...more });
const both = { pairs: [], solo: ['chrom', 'robin'] } as const;
const skill = (u: 'robin' | 'chrom', s: 'solidarity' | 'charm', index: number): MilestoneCheck => ({ id: `skill:${u}:${s}:build`, index, when: 'start', units: [u], test: { kind: 'skill', unit: u, skill: s } });

describe('the EXP a map gives (#195)', () => {
  const one = (army: ArmyUnit[], maps: RunSimMap[], more: Partial<RunSimInput> = {}) => engine.simulateRuns({ army, maps, difficulty: 'normal', ...more }, 1, 1);

  it('shares kills per foe group per unit, and says nothing of which foe falls on which turn', () => {
    const r = one([chrom, robin], [step('a', [dummy(4)]), step('end', [])], { lineups: [both, undefined] });
    const a = r.exp[0]!;
    expect(a).toMatchObject({ key: 'a', label: 'A', runs: 1, groups: [{ key: 'Dummy', name: 'Dummy', className: 'Fighter', count: 4 }] });
    // Chrom fells each foe; Robin halves the next one each turn and never lands a kill: 4 kills of 30 EXP; 3 hits of 10.
    const by = Object.fromEntries(a.units.map((u) => [u.unit, u]));
    expect(by.chrom).toMatchObject({ name: 'Chrom', priority: 'normal', exp: 120, kills: { Dummy: 4 } });
    expect(by.robin).toMatchObject({ exp: 30, kills: {} });
    expect(by.robin!.level).toEqual({ low: 8.3, median: 8.3, high: 8.3 });
    expect(Object.keys(by.chrom!).sort()).toEqual(['exp', 'kills', 'level', 'name', 'priority', 'unit']);
  });

  it('lets the EXP priority move the kills: set high, Robin finishes the foe she halved while Chrom waits', () => {
    const r = one([chrom, robin], [step('a', [dummy(4)]), step('end', [])], { lineups: [both, undefined], priority: [{ robin: 'high' }, undefined] });
    const by = Object.fromEntries(r.exp[0]!.units.map((u) => [u.unit, u]));
    expect(by.robin).toMatchObject({ priority: 'high', kills: { Dummy: 1 } });
    expect(by.chrom!.kills).toEqual({ Dummy: 3 });
  });

  it('gives a paired back half its damage EXP from its own Dual Strikes, weighted by their chance, and never a kill', () => {
    const r = one([robin, chrom], [step('a', [dummy(2)]), step('end', [])], { lineups: [{ pairs: [{ lead: 'robin', back: 'chrom', kept: true }], solo: [] }, undefined] });
    const by = Object.fromEntries(r.exp[0]!.units.map((u) => [u.unit, u]));
    expect(by.robin!.kills).toEqual({ Dummy: 2 });
    expect(by.chrom!.kills).toEqual({});
    expect(by.chrom!.exp).toBeGreaterThan(0);
    expect(by.chrom!.exp).toBeLessThan(by.robin!.exp / 4);
  });

  it('cuts damage EXP on Lunatic from a foe’s 4th engagement', () => {
    // Robin chips a 100 HP foe that never falls to her: ten hits of 10.
    const wall = [step('a', [dummy(1, 100)]), step('end', [])];
    const earned = (difficulty: RunSimInput['difficulty']) => engine.simulateRuns({ army: [robin], maps: wall, difficulty }, 1, 1).exp[0]!.units[0]!.exp;
    expect(earned('hard')).toBeGreaterThan(earned('lunatic'));
  });

  it('gives staff EXP per use and Dance EXP per Dance', () => {
    const brute: Foe = { ...dummy(2, 60), name: 'Brute', stats: stats(60, 20, 0, 0, 0, 60, 0, 0), weapon: itemByName('Iron Axe') };
    const cleric = unit('libra', 'Libra', 'priest', 0, { weapons: [], items: [{ item: itemByName('Heal')!, uses: 30 }], stats: stats(30, 0, 8, 5, 5, 5, 3, 8) });
    const r = engine.simulateRuns({ army: [unit('lonqu', 'Hero', 'myrmidon', 15), cleric], maps: [step('a', [brute]), step('end', [])], difficulty: 'normal' }, 1, 1);
    const libra = r.exp[0]!.units.find((u) => u.unit === 'libra')!;
    expect(libra.exp).toBeGreaterThan(0);
    expect(r.blindSpots).toContain('exp-from-likely-play');
  });
});

describe('milestone chances and the suggested change (#195)', () => {
  // Robin needs Tactician Lv 10 (Solidarity) by map c; Chrom needs Lord Lv 10 (Charm) by the endpoint, map d.
  const maps = [step('a', [dummy(4)]), step('b', [dummy(4)]), step('c', [dummy(4)]), step('d', [])];
  const input: RunSimInput = {
    army: [chrom, robin],
    maps,
    difficulty: 'normal',
    lineups: [both, both, both, undefined],
    milestones: [skill('robin', 'solidarity', 2), skill('chrom', 'charm', 3)],
  };

  it('reads each milestone’s chance by id, with the median level there', () => {
    const r = engine.simulateRuns(input, 1, 3);
    expect(r.milestones).toEqual([
      { id: 'skill:robin:solidarity:build', chance: 0, runs: 3, level: 8 },
      { id: 'skill:chrom:charm:build', chance: 1, runs: 3, level: 11 },
    ]);
  });

  it('reproduces the prototype: “Chrom behind Robin” lifts Robin’s milestone but breaks Chrom’s, so it is flagged', () => {
    const changes = engine.suggestChanges(input, 'skill:robin:solidarity:build', 1, 2);
    const pair = changes.find((c) => c.pin.kind === 'pair')!;
    expect(pair).toMatchObject({ pin: { kind: 'pair', unit: 'robin', value: 'chrom', from: 'a', to: 'b' }, chance: 1, reaches: true, breaks: ['skill:chrom:charm:build'] });
    // Robin high (or Chrom low) gets Robin only a kill a map: her chance stays 0%, so it isn't offered; the pair is all there is.
    expect(changes).toHaveLength(1);
  });

  it('ranks changes reaching 80% without breaking a milestone first, fewest extra turns first; one that breaks one after, flagged', () => {
    // Vaike halves foes too (10 of 20), and both start at Lv 9. Today each turn Chrom fells one, Robin halves the next
    // and Vaike finishes it: Robin never lands a kill (Lv 9.4 by map c), Chrom two a map (Lv 10 by map d). Set high,
    // Robin finishes what Vaike halves; behind Robin, Chrom barely levels and misses Lv 10.
    const vaike = unit('vaike', 'Vaike', 'fighter', 3, { weapons: [{ item: itemByName('Iron Axe')! }] });
    const three: RunSimInput = {
      ...input,
      army: [{ ...chrom, level: 9 }, { ...robin, level: 9 }, vaike],
      maps: maps.map((m) => ({ ...m, deploy: 3 })),
      lineups: [0, 1, 2].map(() => ({ pairs: [], solo: ['chrom', 'robin', 'vaike'] })),
    };
    expect(engine.simulateRuns(three, 1, 2).milestones.map((m) => m.chance)).toEqual([0, 1]);
    const changes = engine.suggestChanges(three, 'skill:robin:solidarity:build', 1, 2);
    expect(changes[0]).toMatchObject({ pin: { kind: 'priority', unit: 'robin', value: 'high', from: 'a', to: 'b' }, chance: 1, reaches: true, breaks: [] });
    const flagged = changes.findIndex((c) => c.breaks.length > 0);
    expect(changes[flagged]).toMatchObject({ pin: { kind: 'pair', unit: 'robin', value: 'chrom' }, breaks: ['skill:chrom:charm:build'] });
    const clean = changes.slice(0, flagged);
    expect(clean.every((c) => c.reaches && !c.breaks.length)).toBe(true);
    expect(clean.map((c) => c.turns)).toEqual([...clean.map((c) => c.turns)].sort((a, b) => a - b));
  });
});

describe('a plan’s EXP forecast through the facade (#195)', () => {
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const played = (maps: readonly string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
  const all = engine.mapOrder(played([])).steps.map((s) => s.map);
  const atLatest = (run: Run, edit: (s: Snapshot) => Snapshot) => editEntry(run, latestEntry(run)!.id, edit, 1);
  const lord = { class: 'Great Lord', level: 15, promoted: true, reclassed: false, exp: 0, stats: { hp: 60, str: 35, mag: 5, skl: 35, spd: 35, lck: 35, def: 30, res: 20 }, skills: [], supports: [], inventory: [{ item: 'Silver Sword', uses: 20 }] };
  // Two maps left, Chrom alone recorded.
  const run = atLatest(played(all.slice(0, -2)), (s) => ({ ...s, units: { chrom: lord } }));
  const plan = engine.seedPlan(run);

  it('is the flawless chance’s own simulation, with each milestone’s chance by id and the priorities it played', () => {
    const f = engine.expForecast(run, plan, { runs: 2 });
    expect(f.chance).toBe(engine.flawlessChance(run, { plan, runs: 2 }).chance);
    expect(f.milestones.map((m) => m.id)).toEqual(engine.milestones(run, plan).map((m) => m.id));
    expect(f.exp[0]).toMatchObject({ key: all[all.length - 2], units: [{ unit: 'chrom', priority: 'normal' }] });
    // Milestones due only at the endpoint set no default priority.
    expect(f.priorities).toEqual(engine.defaultPriorities(run, plan));
  });

  it('plays the plan’s own EXP priorities, span by span', () => {
    const key = all[all.length - 2]!;
    const withHigh = { ...plan, roadmap: { ...plan.roadmap, priorities: [{ unit: 'chrom' as const, priority: 'high' as const, from: key, to: key }] } };
    expect(engine.expForecast(run, withHigh, { runs: 1 }).exp[0]!.units[0]!.priority).toBe('high');
  });
});

describe('the EXP priority in the solve (#195, #199)', () => {
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const fresh = runFromRoster(facts);
  const seed = engine.seedPlan(fresh);

  it('seeds the default priorities, so the flawless chance and the EXP forecast play the same', () => {
    expect(seed.roadmap.priorities).toEqual(engine.defaultPriorities(fresh, seed));
    expect(seed.roadmap.priorities!.length).toBeGreaterThan(0);
  });

  it('offers priority edits: a span dropped or turned, and a unit with none raised from its join map', () => {
    const edits = engine.editChoices(fresh, seed).filter((e) => e.kind === 'priority');
    const span = seed.roadmap.priorities![0]!;
    const byKey = new Map(edits.map((e) => [e.key, e]));
    expect(new Set(edits.map((e) => e.key)).size).toBe(edits.length);
    const dropped = byKey.get(`priority:${span.unit}:${span.from}-${span.to}:normal`)!.make();
    expect(dropped.roadmap.priorities).not.toContainEqual(span);
    const turned = byKey.get(`priority:${span.unit}:${span.from}-${span.to}:low`)!.make();
    expect(turned.roadmap.priorities).toContainEqual({ ...span, priority: 'low' });
    const raised = edits.find((e) => e.key.endsWith(':high'))!.make();
    expect(raised.roadmap.priorities!.length).toBe(seed.roadmap.priorities!.length + 1);
    // Nothing else changes.
    expect({ ...raised, roadmap: { ...raised.roadmap, priorities: [] } }).toEqual({ ...seed, roadmap: { ...seed.roadmap, priorities: [] } });
  });

  it('lets span pins win where they overlap a priority span: a unit pinned out, or as a Back, has none there (#200)', () => {
    // Three maps left: a wishlist unit's EXP priority set high over the two before the endpoint.
    const all = engine.mapOrder(fresh).steps.map((s) => s.map);
    const played = all.slice(0, -3).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
    // Every unit recorded at Lv 10 with the same fair stats, so each one is played.
    const fair = { hp: 50, str: 26, mag: 26, skl: 28, spd: 28, lck: 22, def: 22, res: 20 };
    const late = editEntry(played, latestEntry(played)!.id, (s) => ({ ...s, units: Object.fromEntries(Object.entries(s.units).map(([u, x]) => [u, { ...x!, level: 10, stats: x!.stats && fair }])) }), 1);
    const plan = engine.seedPlan(late);
    const [first, last] = all.slice(-3, -1) as [string, string];
    // A wishlist unit the plan fields on both maps (its lineups follow the simulation's matchups).
    const seeded = engine.expForecast(late, plan, { runs: 1 }).maps;
    const fielded = (key: string) => seeded.find((m) => m.key === key)?.lineup?.deployed ?? [];
    const both = new Set(fielded(first).filter((u) => fielded(last).includes(u)));
    const unit = plan.wishlist.units.find((w) => w.unit !== 'chrom' && w.unit !== 'robin' && both.has(w.unit))!.unit;
    const high = { ...plan, roadmap: { ...plan.roadmap, priorities: [{ unit, priority: 'high' as const, from: first, to: last }] } };
    const priorityOf = (run: Run, i: number) => engine.expForecast(run, high, { runs: 1 }).exp.find((m) => m.key === [first, last][i])?.units.find((u) => u.unit === unit)?.priority;
    expect([priorityOf(late, 0), priorityOf(late, 1)]).toEqual(['high', 'high']);
    // As Chrom's Back on the first map: no priority there (it lands no kills of its own), high again after.
    const back = withPin(late, { kind: 'span', unit, position: 'back', partner: 'chrom', from: first, to: first });
    expect(priorityOf(back, 0)).not.toBe('high');
    expect(priorityOf(back, 1)).toBe('high');
    // Pinned out of the first map: none there either.
    const out = withPin(late, { kind: 'span', unit, position: 'out', from: first, to: first });
    expect(priorityOf(out, 0)).not.toBe('high');
    expect(priorityOf(out, 1)).toBe('high');
  });

  it('never suggests a change against a span pin: no pair where a pin keeps the unit elsewhere (#200)', () => {
    const maps = [step('a', [dummy(4)]), step('b', [dummy(4)]), step('c', [dummy(4)]), step('d', [])];
    const both = { pairs: [], solo: ['chrom', 'robin'] } as const;
    const input: RunSimInput = { army: [chrom, robin], maps, difficulty: 'normal', lineups: [both, both, both, undefined], milestones: [skill('robin', 'solidarity', 2), skill('chrom', 'charm', 3)] };
    expect(engine.suggestChanges(input, 'skill:robin:solidarity:build', 1, 2).map((c) => c.pin.kind)).toEqual(['pair']);
    const pinned: RunSimInput = { ...input, pins: [[{ unit: 'robin', position: 'solo' }], undefined, undefined, undefined] };
    expect(engine.suggestChanges(pinned, 'skill:robin:solidarity:build', 1, 2)).toEqual([]);
  });
});
