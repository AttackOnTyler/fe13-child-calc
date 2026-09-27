import { describe, expect, it } from 'vitest';
import {
  EMPTY_ROSTER,
  addEntry,
  createEngine,
  editEntry,
  latestEntry,
  growthPercentile,
  readUnits,
  runFromRoster,
  withRun,
  type Milestone,
  type MilestoneChance,
  type MilestonePoint,
  type Reading,
  type RosterUnit,
  type Run,
  type Snapshot,
  type SuggestedChange,
  type UnitWorth,
} from './index';

/**
 * Readings (#197): hand-built milestones and chances through `readUnits`, then a plan's readings and the recorded
 * stats' percentiles through the facade.
 */
const at = (index: number, when: MilestonePoint['when'] = 'start'): MilestonePoint => ({ key: `m${index}`, label: `M${index}`, index, when });
const skill = (unit: RosterUnit, index: number, more: object = {}) =>
  ({ kind: 'skill', id: `skill:${unit}:galeforce:build`, at: at(index), units: [unit], unit, skill: 'galeforce', name: 'Galeforce', learn: undefined, for: { kind: 'build' }, ...more }) as Milestone;
const support = (a: RosterUnit, b: RosterUnit, index: number, more: object = {}) =>
  ({ kind: 'support', id: `support:${a}+${b}`, at: at(index), units: [a, b], pair: [a, b], rank: 'S', window: { earliest: at(0), latest: at(index - 1), deadline: at(index), maps: 3 }, nonStarter: false, fixed: false, children: [], ...more }) as Milestone;
const recruit = (child: RosterUnit, parents: [RosterUnit, RosterUnit], index: number) =>
  ({ kind: 'recruit', id: `recruit:${child}`, at: at(index), units: [child], child, parents, needed: undefined }) as Milestone;
const seal = (unit: RosterUnit, index: number) =>
  ({ kind: 'class', id: `class:${unit}:hero`, at: at(index), units: [unit], unit, classId: 'hero', className: 'Hero', seal: 'second', source: { how: 'held' } }) as Milestone;
const chances = (xs: Record<string, number | undefined>): MilestoneChance[] => Object.entries(xs).map(([id, chance]) => ({ id, chance, runs: 10, level: undefined }));
const change = (reaches: boolean, breaks: string[] = []): SuggestedChange => ({ pin: { kind: 'priority', unit: 'lissa', value: 'high', from: 'm0', to: 'm2' }, chance: reaches ? 0.9 : 0.5, reaches, breaks, turns: 1, flawless: 0 });
const byUnit = (rs: readonly Reading[]) => Object.fromEntries(rs.map((r) => [r.unit, r]));

describe('who a milestone counts against (#197)', () => {
  it('counts a support against both partners, a skill against its learner and a class change against its unit', () => {
    const ms = [support('chrom', 'sumia', 3), skill('lissa', 4), seal('vaike', 5)];
    const r = byUnit(readUnits(ms, chances({ 'support:chrom+sumia': 0.5, 'skill:lissa:galeforce:build': 0.9, 'class:vaike:hero': 0.3 })).readings);
    expect(r.chrom!.worst?.id).toBe('support:chrom+sumia');
    expect(r.sumia!.worst?.id).toBe('support:chrom+sumia');
    expect(r.lissa!.milestones).toEqual([{ id: 'skill:lissa:galeforce:build', chance: 0.9 }]);
    expect(r.vaike!.worst).toEqual({ id: 'class:vaike:hero', chance: 0.3, reached: true });
  });

  it('counts a recruitment against the child, taking the worst of the supports that lead to it', () => {
    const ms = [support('chrom', 'sumia', 3, { children: ['cynthia'] }), recruit('cynthia', ['chrom', 'sumia'], 4)];
    const r = byUnit(readUnits(ms, chances({ 'support:chrom+sumia': 0.4, 'recruit:cynthia': 0.6 })).readings);
    expect(r.cynthia!.milestones.map((m) => m.id)).toEqual(['support:chrom+sumia', 'recruit:cynthia']);
    expect(r.cynthia!.worst).toMatchObject({ id: 'support:chrom+sumia', chance: 0.4 });
  });

  it('counts a wasted pass against nobody: it gives nothing', () => {
    const r = readUnits([skill('lissa', 4, { wasted: 'child-has' })], chances({ 'skill:lissa:galeforce:build': 0 }), { units: ['lissa'] });
    expect(r.readings).toMatchObject([{ unit: 'lissa', reading: 'on-track', worst: undefined, milestones: [] }]);
  });
});

describe('each reading (#197)', () => {
  it('reads on track at 80% or more on the worst open milestone', () => {
    const ms = [skill('lissa', 2), seal('lissa', 4)];
    expect(byUnit(readUnits(ms, chances({ 'skill:lissa:galeforce:build': 0.95, 'class:lissa:hero': 0.8 })).readings).lissa).toMatchObject({ reading: 'on-track', worst: { id: 'class:lissa:hero', chance: 0.8 } });
  });

  it('reads a unit with no open milestones on track, with none left; reserves get no reading', () => {
    const r = readUnits([], [], { units: ['frederick', 'vaike'], reserves: ['vaike'] });
    expect(r.readings).toEqual([{ unit: 'frederick', reading: 'on-track', pending: false, worst: undefined, milestones: [], lost: 0, stats: [] }]);
  });

  it('reads a unit below 80% at risk, pending, until its suggested changes are read, and lists the milestone to ask for', () => {
    const r = readUnits([skill('lissa', 3)], chances({ 'skill:lissa:galeforce:build': 0.5 }));
    expect(r.readings[0]).toMatchObject({ reading: 'at-risk', pending: true });
    expect(r.pending).toEqual(['skill:lissa:galeforce:build']);
  });

  it('reads at risk when one suggested change restores 80% without breaking another, naming it', () => {
    const fix = change(true);
    const r = readUnits([skill('lissa', 3)], chances({ 'skill:lissa:galeforce:build': 0.5 }), { suggestions: { 'skill:lissa:galeforce:build': [change(true, ['x']), fix] } });
    expect(r.readings[0]).toMatchObject({ reading: 'at-risk', pending: false, change: fix });
    expect(r.pending).toEqual([]);
  });

  it('reads behind when no change restores 80% without breaking another', () => {
    const r = readUnits([skill('lissa', 3)], chances({ 'skill:lissa:galeforce:build': 0.5 }), { suggestions: { 'skill:lissa:galeforce:build': [change(true, ['x']), change(false)] } });
    expect(r.readings[0]).toMatchObject({ reading: 'behind', why: 'no-change' });
  });

  it('reads behind without asking for changes when the deadline map has started, or the support is a non-starter', () => {
    const ms = [skill('lissa', 0), support('chrom', 'olivia', 2, { nonStarter: true })];
    const r = readUnits(ms, chances({ 'skill:lissa:galeforce:build': 0.5, 'support:chrom+olivia': 0 }));
    expect(byUnit(r.readings).lissa).toMatchObject({ reading: 'behind', why: 'deadline' });
    expect(byUnit(r.readings).olivia).toMatchObject({ reading: 'behind', why: 'non-starter' });
    expect(r.pending).toEqual([]);
  });

  it('reads a milestone no run reaches as 0%', () => {
    expect(readUnits([skill('lissa', 3)], chances({ 'skill:lissa:galeforce:build': undefined })).readings[0]!.worst).toEqual({ id: 'skill:lissa:galeforce:build', chance: 0, reached: false });
  });

  it('never lets recorded stats change a reading: they ride along as percentiles', () => {
    const stats = [{ unit: 'lissa' as const, map: 'm0', stats: [{ stat: 'str' as const, value: 3, percentile: 2 }] }];
    const r = readUnits([skill('lissa', 3)], chances({ 'skill:lissa:galeforce:build': 0.9 }), { stats });
    expect(r.readings[0]).toMatchObject({ reading: 'on-track', stats: stats[0]!.stats });
  });
});

describe('the tie order (#197)', () => {
  const ms = [skill('lissa', 3), skill('vaike', 3), skill('kellam', 3), skill('stahl', 3), skill('miriel', 3)];
  const ch = chances({ 'skill:lissa:galeforce:build': 0.6, 'skill:vaike:galeforce:build': 0.3, 'skill:kellam:galeforce:build': 0.9, 'skill:stahl:galeforce:build': 1, 'skill:miriel:galeforce:build': 0.2 });
  const suggestions = { 'skill:miriel:galeforce:build': [change(false)] };

  it('puts behind first, then at risk, then on track; within each, the flawless chance lost (by stake: the share of runs missing it)', () => {
    const r = readUnits(ms, ch, { suggestions });
    expect(r.lostBy).toBe('stake');
    expect(r.readings.map((x) => [x.unit, x.reading])).toEqual([
      ['miriel', 'behind'],
      ['vaike', 'at-risk'],
      ['lissa', 'at-risk'],
      ['kellam', 'on-track'],
      ['stahl', 'on-track'],
    ]);
    expect(r.readings.map((x) => x.lost)).toEqual([0.8, 0.7, 0.4, expect.closeTo(0.1), 0]);
  });

  it('weighs the share missed by unit worth once every unit’s is read, a forced unit by the whole chance', () => {
    const w = (unit: RosterUnit, worth: number | undefined, forced = false): UnitWorth => ({ unit, forced, worth, margin: 0, utility: 0, utilityMargin: 0, runs: 8, children: [], settled: true });
    const worth = [w('lissa', 0.2), w('vaike', 0.01), w('kellam', 0), w('stahl', 0), w('miriel', 0.1)];
    const r = readUnits(ms, ch, { suggestions, worth, chance: 0.5 });
    expect(r.lostBy).toBe('worth');
    // Lissa misses less often than Vaike but is worth far more: she comes first.
    expect(r.readings.filter((x) => x.reading === 'at-risk').map((x) => x.unit)).toEqual(['lissa', 'vaike']);
    expect(byUnit(r.readings).lissa!.lost).toBeCloseTo(0.08);
    // One unread worth: back to the stake for everyone.
    expect(readUnits(ms, ch, { worth: [...worth.slice(1), w('lissa', undefined)] }).lostBy).toBe('stake');
    // Chrom is forced: missing his milestone weighs the plan's whole chance.
    const chrom = readUnits([skill('chrom', 3)], chances({ 'skill:chrom:galeforce:build': 0.5 }), { worth: [w('chrom', undefined, true)], chance: 0.4 });
    expect(chrom.readings[0]!.lost).toBeCloseTo(0.2);
  });

  it('breaks an equal loss by the earlier milestone, then the unit', () => {
    // Vaike and Kellam share one support milestone, due after Lissa's skill.
    const r = readUnits([support('vaike', 'kellam', 4), skill('lissa', 2)], chances({ 'support:vaike+kellam': 0.5, 'skill:lissa:galeforce:build': 0.5 }));
    expect(r.readings.map((x) => x.unit)).toEqual(['lissa', 'kellam', 'vaike']);
  });
});

describe('recorded stats as percentiles (#197)', () => {
  it('places a value by its mid-rank among the level-ups’ rolls, up to the cap', () => {
    // Four level-ups at 50%: gains 0–4 with weights 1, 4, 6, 4, 1 (of 16).
    expect(growthPercentile(10, 4, 50, 99, 12)).toBe(50);
    expect(growthPercentile(10, 4, 50, 99, 10)).toBe(3);
    expect(growthPercentile(10, 4, 50, 99, 14)).toBe(97);
    expect(growthPercentile(10, 4, 50, 99, 9)).toBe(1);
    // At a cap of 11, everything past one gain stops there.
    expect(growthPercentile(10, 4, 50, 11, 11)).toBe(53);
    // A sure growth, or none: the only value is the middle.
    expect(growthPercentile(10, 4, 100, 99, 14)).toBe(50);
    expect(growthPercentile(10, 4, 0, 99, 10)).toBe(50);
    expect(growthPercentile(10, 4, 130, 99, 14)).toBe(50);
  });
});

describe('a plan’s readings through the facade (#197)', () => {
  const engine = createEngine();
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const played = (maps: readonly string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
  const all = engine.mapOrder(played([])).steps.map((s) => s.map);
  const atLatest = (run: Run, edit: (s: Snapshot) => Snapshot) => editEntry(run, latestEntry(run)!.id, edit, 1);
  const lord = (level: number, str: number) => ({ class: 'Great Lord', level, promoted: true, reclassed: false, exp: 0, stats: { hp: 60, str, mag: 5, skl: 35, spd: 35, lck: 35, def: 30, res: 20 }, skills: [], supports: [], inventory: [{ item: 'Silver Sword', uses: 20 }] });
  // Three maps left, Chrom alone recorded; then the next map played, Chrom a level up.
  const before = atLatest(played(all.slice(0, -3)), (s) => ({ ...s, units: { chrom: lord(14, 30) } }));
  const run = atLatest(addEntry(before, all[all.length - 3]!, 2), (s) => ({ ...s, units: { chrom: lord(15, 99) } }));
  const plan = engine.seedPlan(run);

  it('reads every milestone’s unit and every wishlist unit but the reserves, from the plan’s EXP forecast', () => {
    const forecast = engine.expForecast(run, plan, { runs: 2 });
    const r = engine.readings(run, plan, { forecast, stats: [] });
    const ms = engine.milestones(run, plan);
    const units = new Set([...ms.filter((m) => !(m.kind === 'skill' && m.wasted)).flatMap((m) => m.units), ...plan.wishlist.units.map((w) => w.unit), ...plan.wishlist.children.map((c) => c.child)]);
    for (const x of plan.wishlist.reserves) units.delete(x.unit);
    expect(new Set(r.readings.map((x) => x.unit))).toEqual(units);
    for (const x of r.readings) if (x.worst) expect(x.worst.chance).toBe(forecast.milestones.find((m) => m.id === x.worst!.id)!.chance ?? 0);
  });

  it('places the latest recorded map’s stats in the spread expected there', () => {
    const stats = engine.recordedStats(run);
    const chrom = stats.find((s) => s.unit === 'chrom')!;
    expect(chrom.map).toBe(all[all.length - 3]);
    // Str 99 is far past anything Chrom could roll from 30 in one level; Skl unmoved is below the middle.
    expect(chrom.stats.find((s) => s.stat === 'str')).toEqual({ stat: 'str', value: 99, percentile: 99 });
    expect(chrom.stats.find((s) => s.stat === 'skl')!.percentile).toBeLessThan(50);
    expect(engine.recordedStats(before)).toEqual([]);
  });
});
