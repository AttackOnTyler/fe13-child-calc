import { describe, expect, it } from 'vitest';
import {
  EMPTY_ROSTER,
  addEntry,
  behindFixes,
  createEngine,
  editEntry,
  exportRun,
  forecastBefore,
  forecastPercentile,
  importRun,
  latestEntry,
  recordFallen,
  recordMarriage,
  runFromRoster,
  sameWishlist,
  whatChanged,
  withDismissedChange,
  withEntryForecast,
  withRobinLock,
  withRun,
  type FlawlessChance,
  type Plan,
  type PlanProposal,
  type Readings,
  type RosterUnit,
} from './index';

/**
 * The re-solve after a recorded map and What changed (#206), through the facade: what the adopted roadmap can no longer
 * meet, the milestones a proposal moves, a behind unit's fixes, an at-risk unit's one-click change, and the forecast
 * kept on an entry for What changed.
 */
const engine = createEngine();
const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
const fresh = runFromRoster(facts);
// Two maps left (Chapter 25, then Endgame): the seed is cheap.
const all = engine.mapOrder(fresh).steps.map((s) => s.map);
const late = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
const seed = engine.seedPlan(late);
const fielded = seed.wishlist.units.map((w) => w.unit).find((u) => u !== 'chrom' && u !== 'robin')!;

describe('what the adopted roadmap can no longer meet (#206)', () => {
  it('holds while nothing it needs is lost or married off it', () => {
    expect(engine.planBreaks(late, seed).filter((b) => b.kind !== 'non-starter')).toEqual([]);
  });

  it('breaks when a unit it needs dies, or a marriage it doesn’t hold is recorded', () => {
    const id = latestEntry(late)!.id;
    const dead = recordFallen(late, id, fielded, 2);
    expect(engine.planBreaks(dead, seed)).toContainEqual({ kind: 'lost', unit: fielded, state: 'dead' });
    // Two units the plan doesn't marry to each other.
    const units = Object.keys(latestEntry(late)!.snapshot.units) as RosterUnit[];
    const planned = new Set(seed.wishlist.marriages.flat());
    const [a, b] = units.filter((u) => !planned.has(u) && u !== 'chrom' && u !== 'robin' && u !== 'lucina' && !u.startsWith('morgan'));
    const married = recordMarriage(late, id, a!, b!, 2);
    expect(engine.planBreaks(married, seed)).toContainEqual({ kind: 'married', couple: [a, b] });
  });

  it('keeps a held plan’s map order across recorded maps: its couples don’t turn into non-starters', () => {
    // The plan made before Premonition names Premonition and the Prologue on its order; once they're recorded it still
    // plays its own order (its child paralogues where it placed them), not the template's.
    const open = runFromRoster(withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'lunatic', mode: 'classic' }));
    const fresh = withRobinLock(open, engine.seedPlan(open).robin);
    const held = engine.seedPlan(fresh);
    const played = addEntry(addEntry(fresh, 'premonition', 1), 'prologue', 2);
    const stuck = (r: typeof fresh) => engine.milestones(r, held).filter((m) => m.kind === 'support' && m.nonStarter).map((m) => m.id);
    expect(stuck(fresh)).toEqual([]);
    expect(stuck(played)).toEqual([]);
    expect(engine.planBreaks(played, held)).toEqual([]);
  });
});

describe('a re-solve proposal’s milestones and a behind unit’s fixes (#206)', () => {
  // Chrom’s first build skill swapped: a wishlist change that drops that skill’s milestone.
  const chrom = seed.wishlist.units.find((w) => w.unit === 'chrom')!;
  const dropped = chrom.build.find((k) => engine.milestones(late, seed).some((m) => m.id === `skill:chrom:${k}:build`))!;
  const swapped: Plan = { ...seed, wishlist: { ...seed.wishlist, units: seed.wishlist.units.map((w) => (w.unit === 'chrom' ? { ...w, build: w.build.map((k) => (k === dropped ? ('armsthrift' as never) : k)) } : w)) } };

  it('lists the milestones a plan adds, drops or moves', () => {
    const moves = engine.milestoneMoves(late, seed, swapped);
    expect(moves.dropped.map((m) => m.id)).toContain(`skill:chrom:${dropped}:build`);
    expect(engine.milestoneMoves(late, seed, seed)).toEqual({ added: [], dropped: [], moved: [] });
  });

  it('offers a behind unit the best roadmap-only proposal first, and a wishlist change only if it gains more', () => {
    const unit = 'chrom';
    const m = engine.milestones(late, seed).find((x) => x.units.includes(unit))!;
    const moves = { added: [], dropped: [m], moved: [] };
    const roadmap: PlanProposal = { plan: { ...seed, roadmap: { ...seed.roadmap, lineups: [] } }, label: 'r', edits: ['On Ch 25, a lineup'], gain: 0.02, margin: 0.01, runs: 8 };
    const small: PlanProposal = { plan: swapped, label: 'w', edits: ['A marriage'], gain: 0.01, margin: 0.01, runs: 8 };
    const big: PlanProposal = { ...small, gain: 0.05 };
    expect(sameWishlist(seed, roadmap.plan)).toBe(true);
    expect(sameWishlist(seed, swapped)).toBe(false);
    expect(behindFixes(unit, seed, [{ proposal: roadmap, moves }, { proposal: small, moves }])).toEqual({ roadmap });
    expect(behindFixes(unit, seed, [{ proposal: roadmap, moves }, { proposal: big, moves }])).toEqual({ roadmap, wishlist: big });
    // A proposal that moves none of its milestones isn't its fix.
    expect(behindFixes(unit, seed, [{ proposal: roadmap, moves: { added: [], dropped: [], moved: [] } }])).toEqual({});
  });
});

describe('an at-risk unit’s suggested change as one click (#206)', () => {
  const [from, to] = [engine.mapOrder(late).steps[0]!.key, engine.mapOrder(late).steps[1]!.key];

  it('pins a pair or a unit fielded over the change’s maps', () => {
    expect(engine.suggestedEdit(late, seed, { kind: 'pair', unit: 'lissa', value: 'frederick', from, to })).toEqual({ pins: [{ kind: 'span', unit: 'lissa', position: 'lead', partner: 'frederick', from, to }] });
    expect(engine.suggestedEdit(late, seed, { kind: 'field', unit: 'lissa', from, to, benched: [] })).toEqual({ pins: [{ kind: 'span', unit: 'lissa', position: 'solo', from, to }] });
  });

  it('raises an EXP priority as a plan edit, on top of the plan’s spans', () => {
    const e = engine.suggestedEdit(late, seed, { kind: 'priority', unit: 'lissa', value: 'high', from, to });
    expect('plan' in e).toBe(true);
    const priorities = 'plan' in e ? e.plan.roadmap.priorities! : [];
    expect(priorities[priorities.length - 1]).toEqual({ unit: 'lissa', priority: 'high', from, to });
    expect(priorities.slice(0, -1)).toEqual(seed.roadmap.priorities ?? engine.defaultPriorities(late, seed));
  });
});

describe('What changed (#206)', () => {
  const key = engine.mapOrder(late).steps[0]!.key;
  const map = engine.mapOrder(late).steps[0]!.map;
  const chance = {
    chance: 0.42,
    margin: 0.05,
    maps: [{ key, label: 'Chapter 25' }],
    exp: [{ key, label: 'Chapter 25', runs: 8, groups: [], units: [{ unit: 'chrom', name: 'Chrom', priority: 'normal', exp: 120, level: { low: 15.2, median: 16.1, high: 16.9 }, kills: {} }] }],
  } as unknown as FlawlessChance;
  const readings = { readings: [{ unit: 'chrom', reading: 'on-track', pending: false }, { unit: 'lissa', reading: 'at-risk', pending: true }], lostBy: 'stake', pending: [], stats: [] } as unknown as Readings;

  it('keeps the headline, the EXP forecast for the next map and the readings on the entry recorded', () => {
    const f = forecastBefore(late, chance, readings)!;
    expect(f).toEqual({ chance: 0.42, margin: 0.05, key, map, spend: 0, exp: [{ unit: 'chrom', exp: 120, level: { low: 15.2, median: 16.1, high: 16.9 } }], readings: [{ unit: 'chrom', reading: 'on-track' }, { unit: 'lissa', reading: 'at-risk', pending: true }] });
    const recorded = addEntry(late, map, 9);
    const id = latestEntry(recorded)!.id;
    const kept = withEntryForecast(recorded, id, f);
    expect(latestEntry(importRun(exportRun(kept)))!.forecast).toEqual(f);
  });

  it('reads the chance before and after, EXP against the forecast, readings that moved, and is dismissed with “got it”', () => {
    const recorded = addEntry(late, map, 9);
    const id = latestEntry(recorded)!.id;
    const was = latestEntry(late)!.snapshot.units.chrom!;
    // Chrom gained a level and 30 EXP on the map.
    const played = editEntry(withEntryForecast(recorded, id, forecastBefore(late, chance, readings)!), id, (s) => ({ ...s, units: { ...s.units, chrom: { ...was, level: was.level + 1, exp: was.exp + 30 } } }), 10);
    const after = { readings: [{ unit: 'chrom', reading: 'behind', pending: false }, { unit: 'lissa', reading: 'at-risk', pending: false }], lostBy: 'stake', pending: [], stats: [] } as unknown as Readings;
    const w = whatChanged(played, { chance: { chance: 0.3, margin: 0.04 }, readings: after })!;
    expect(w.entry).toBe(id);
    expect(w.before).toEqual({ chance: 0.42, margin: 0.05 });
    expect(w.after).toEqual({ chance: 0.3, margin: 0.04 });
    const level = was.level + 1 + (was.exp + 30) / 100;
    expect(w.exp).toEqual([{ unit: 'chrom', earned: 130, progress: 'earned', joined: false, forecast: 120, level, spread: { low: 15.2, median: 16.1, high: 16.9 }, against: level < 15.2 ? 'below' : level > 16.9 ? 'above' : 'inside', percentile: forecastPercentile(level, { low: 15.2, median: 16.1, high: 16.9 }) }]);
    expect(w.readings).toEqual([{ unit: 'chrom', before: 'on-track', after: 'behind', wasPending: false, pending: false }]);
    expect(w.dismissed).toBe(false);
    expect(whatChanged(withDismissedChange(played, id))!.dismissed).toBe(true);
    // Recorded without a forecast: no chance before, no EXP rows.
    expect(whatChanged(recorded)).toMatchObject({ before: undefined, after: undefined, exp: [], readings: [] });
  });
});
