import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ASSUMPTIONS,
  EMPTY_ROSTER,
  GAME_OVER_UNITS,
  addEntry,
  createEngine,
  editEntry,
  exportRun,
  falls,
  importRun,
  latestEntry,
  openLosses,
  recordFallen,
  recordMarriage,
  recordMissed,
  runFromRoster,
  unrecordLoss,
  withEntryForecast,
  withLossesSettled,
  withRun,
  type EntryForecast,
  type Plan,
  type RosterUnit,
  type Run,
} from './index';

/**
 * Losses (#208), through the facade: recording a death, a miss and a Casual fall; the flawless chance forward-only after
 * a death; the loss item and its re-solve proposal; What it cost.
 */
const engine = createEngine();
const facts = (mode: 'classic' | 'casual' = 'classic') => withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', mode, gender: 'M', asset: 'mag', flaw: 'hp' });
const all = engine.mapOrder(runFromRoster(facts())).steps.map((s) => s.map);
/** Every map but the last two (Chapter 25, then Endgame) recorded, every unit Lv 10 with the same fair stats. */
function late(mode: 'classic' | 'casual' = 'classic'): Run {
  const played = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts(mode)));
  const stats = { hp: 50, str: 26, mag: 26, skl: 28, spd: 28, lck: 22, def: 22, res: 20 };
  return editEntry(played, latestEntry(played)!.id, (s) => ({ ...s, units: Object.fromEntries(Object.entries(s.units).map(([u, x]) => [u, { ...x!, level: 10, stats: x!.stats && stats }])) }), 1);
}
const classic = late();
const seed = engine.seedPlan(classic);
const id = latestEntry(classic)!.id;
const fielded = seed.wishlist.units.map((w) => w.unit).filter((u) => u !== 'chrom' && u !== 'robin');
const [victim, second] = fielded as [RosterUnit, RosterUnit];

describe('recording losses (#208)', () => {
  it('records a death on Classic and a missed recruit as losses, until settled', () => {
    const dead = recordFallen(classic, id, victim, 2);
    expect(latestEntry(dead)!.snapshot.states[victim]).toBe('dead');
    const missed = recordMissed(dead, id, second, 3);
    expect(openLosses(missed).map((l) => [l.key, l.kind])).toEqual([
      [`dead:${victim}`, 'died'],
      [`missed:${second}`, 'missed'],
    ]);
    expect(openLosses(withLossesSettled(missed, [`dead:${victim}`])).map((l) => l.key)).toEqual([`missed:${second}`]);
    // Undone (a mistake): no loss.
    expect(openLosses(unrecordLoss(missed, id, second, 4)).map((l) => l.key)).toEqual([`dead:${victim}`]);
    // Settled losses are kept with the run.
    expect(importRun(exportRun(withLossesSettled(missed, [`dead:${victim}`]))).settledLosses).toEqual([`dead:${victim}`]);
  });

  it('never records Chrom’s or Robin’s fall: it’s a Game Over', () => {
    expect(GAME_OVER_UNITS).toEqual(['chrom', 'robin']);
    for (const u of GAME_OVER_UNITS) {
      expect(recordFallen(classic, id, u, 2)).toBe(classic);
      expect(recordMissed(classic, id, u, 2)).toBe(classic);
    }
  });

  it('logs a Casual fall for calibration instead of dropping it: no loss, the unit keeps its slot', () => {
    const casual = late('casual');
    const cid = latestEntry(casual)!.id;
    const f: EntryForecast = { chance: 0.5, margin: 0.1, key: all[all.length - 3]!, map: all[all.length - 3]!, noDeath: 0.8, exp: [], readings: [] };
    const fell = recordFallen(withEntryForecast(casual, cid, f), cid, victim, 2);
    expect(latestEntry(fell)!.snapshot.states[victim]).toBeUndefined();
    expect(latestEntry(fell)!.fell).toEqual([victim]);
    expect(openLosses(fell)).toEqual([]);
    const log = falls(fell);
    expect(log.maps[log.maps.length - 1]).toEqual({ entry: cid, map: all[all.length - 3], noDeath: 0.8, fell: [victim], died: [] });
    expect(log).toMatchObject({ forecast: 1, observed: 1 });
    expect(log.expected).toBeCloseTo(0.2);
    expect(latestEntry(importRun(exportRun(fell)))!.fell).toEqual([victim]);
    expect(latestEntry(unrecordLoss(fell, cid, victim, 3))!.fell).toBeUndefined();
  });
});

describe('the flawless chance after a death (#208)', () => {
  const dead = recordFallen(classic, id, victim, 2);
  /** The same run with the unit never in the army. */
  const never = editEntry(classic, id, (s) => {
    const { [victim]: _, ...units } = s.units;
    return { ...s, units };
  }, 2);

  it('stays forward-only: no further deaths from here, with the army that’s left', () => {
    const plan = engine.lossPlan(dead, seed);
    const after = engine.flawlessChance(dead, { plan, runs: 2 });
    // The fixture's Lv 10 army with its join weapons can't win the Endgame in 50 turns once a unit is gone, which counts
    // as lost (the realism pass): the chance is read forward from the next map, which the runs still play.
    expect(after.maps[0]!.reach).toBe(1);
    expect(after.maps[0]!.noDeath!).toBeGreaterThan(0);
    expect(after.chance).toBe(engine.flawlessChance(never, { plan, runs: 2 }).chance);
    expect(after.maps.flatMap((m) => m.lineup?.deployed ?? [])).not.toContain(victim);
  });

  it('brings a child whose parent died after marrying, from the parent as it was (child-after-parent-death)', () => {
    // Chapter 13 still ahead: Frederick and Sully married on the log, then Frederick died; Kjelle’s paralogue opens.
    const upTo = all.indexOf('chapter-13');
    const early = all.slice(0, upTo).reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts()));
    const eid = latestEntry(early)!.id;
    const lost = recordFallen(recordMarriage(early, eid, 'frederick', 'sully', 2), eid, 'frederick', 3);
    const kids = (e: ReturnType<typeof createEngine>) => e.flawlessChance(lost, { runs: 1 }).notSimulated.filter((n) => n.why === 'child').map((n) => n.unit);
    expect(kids(engine)).not.toContain('kjelle');
    expect(kids(createEngine({ ...DEFAULT_ASSUMPTIONS, 'child-after-parent-death': false }))).toContain('kjelle');
  });
});

describe('the loss item (#208)', () => {
  // The plan names a reserve for the unit that dies.
  const reserve = (['stahl', 'tiki', 'vaike', 'sumia', 'donnel'] as RosterUnit[]).find((u) => !seed.wishlist.units.some((w) => w.unit === u) && latestEntry(classic)!.snapshot.units[u])!;
  const plan: Plan = { ...seed, wishlist: { ...seed.wishlist, reserves: [{ unit: reserve, covers: victim }] } };
  const dead = recordFallen(withEntryForecast(classic, id, { chance: 0.42, margin: 0.05, key: 'x', map: all[all.length - 3]!, exp: [], readings: [] }), id, victim, 2);

  it('proposes the plan for the army that’s left: its reserve steps in, the lost unit is gone, with the chance before', () => {
    const item = engine.lossItem(dead, plan)!;
    expect(item.losses.map((l) => l.key)).toEqual([`dead:${victim}`]);
    expect(item.before).toEqual({ chance: 0.42, margin: 0.05 });
    expect(item.steppingIn).toEqual([{ unit: reserve, for: victim }]);
    expect(item.plan.wishlist.units.map((w) => w.unit)).toContain(reserve);
    expect(item.plan.wishlist.units.map((w) => w.unit)).not.toContain(victim);
    expect(item.units.removed).toContain(victim);
    // What it broke: the adopted plan's milestones on the unit.
    expect(item.broke.length).toBeGreaterThan(0);
    expect(item.broke.every((m) => m.units.includes(victim))).toBe(true);
    expect(item.same).toBe(false);
  });

  it('is gone once settled, and there is none without a loss', () => {
    expect(engine.lossItem(classic, plan)).toBeUndefined();
    expect(engine.lossItem(withLossesSettled(dead, [`dead:${victim}`]), plan)).toBeUndefined();
  });

  it('treats a marriage off the plan as fact', () => {
    const units = Object.keys(latestEntry(classic)!.snapshot.units) as RosterUnit[];
    const planned = new Set(seed.wishlist.marriages.flat());
    const man = units.find((u) => ['vaike', 'stahl', 'kellam', 'gregor', 'ricken'].includes(u) && !planned.has(u))!;
    const woman = units.find((u) => ['sully', 'miriel', 'cherche', 'lissa', 'tharja'].includes(u) && !planned.has(u))!;
    const married = recordMarriage(classic, id, man, woman, 2);
    const item = engine.lossItem(married, seed)!;
    expect(item.losses).toEqual([expect.objectContaining({ kind: 'married', couple: [man, woman].sort() })]);
    expect(item.plan.wishlist.marriages.some((c) => c.includes(man) && c.includes(woman))).toBe(true);
  });
});

describe('What it cost (#208)', () => {
  const key = all[all.length - 3]!;
  // Recorded on the map the forecast expected, with the forecast kept.
  const recorded = (run: Run) => {
    const r = addEntry(run, all[all.length - 2]!, 5);
    const eid = latestEntry(r)!.id;
    const exp = fielded.slice(0, 3).map((u) => ({ unit: u, exp: 80, level: { low: 10.2, median: 10.8, high: 11.4 } }));
    return { run: withEntryForecast(r, eid, { chance: 0.2, margin: 0.05, key: all[all.length - 2]!, map: all[all.length - 2]!, noDeath: 0.9, spend: 0, exp, readings: [] }), eid };
  };
  void key;

  it('prices a death on paired runs and lists what it broke', () => {
    const { run, eid } = recorded(classic);
    const dead = recordFallen(run, eid, victim, 6);
    const w = engine.whatItCost(dead, seed, { runs: 2 })!;
    const row = w.rows.find((r) => r.kind === 'died')!;
    expect(row).toMatchObject({ key: `dead:${victim}`, unit: victim });
    expect(row.broke!.every((m) => m.units.includes(victim))).toBe(true);
    // The same seed gives the same prices.
    expect(engine.whatItCost(dead, seed, { runs: 2 })).toEqual(w);
  });

  it('prices a Casual fall as the rest of the map it missed, and spending over the plan as the endpoint kit shrinking', () => {
    const { run, eid } = recorded(late('casual'));
    const fell = recordFallen(run, eid, victim, 6);
    // Spent 100,000G on the way (the plan spent nothing there).
    const spent = { ...fell, entries: fell.entries.map((e) => (e.id === eid ? { ...e, snapshot: { ...e.snapshot, gold: 100000 }, shopping: [{ kind: 'buy' as const, item: 'Vulnerary', gold: 100000 }] } : e)) };
    const w = engine.whatItCost(spent, seed, { runs: 2 })!;
    expect(w.rows.find((r) => r.kind === 'fell')).toMatchObject({ unit: victim, level: { recorded: 10, forecast: 10.8 } });
    expect(w.rows.some((r) => r.kind === 'died')).toBe(false);
    const over = w.rows.filter((r) => r.kind === 'over-plan');
    expect(over).toHaveLength(1);
    expect(over[0]).toMatchObject({ excess: 100000 });
    expect(over[0]!.kit!.length).toBeGreaterThan(0);
    expect(over[0]!.points).toBeLessThanOrEqual(0);
  });
});
