import { describe, expect, it } from 'vitest';
import {
  EMPTY_ROSTER,
  addEntry,
  calibrationLog,
  createEngine,
  editEntry,
  forecastBefore,
  forecastPercentile,
  latestEntry,
  proposalId,
  recordFallen,
  runFromRoster,
  withDismissedChange,
  withDismissedProposal,
  withEdit,
  withEntryForecast,
  withLossesSettled,
  withRun,
  type FlawlessChance,
  type Plan,
  type PlanProposal,
  type Reading,
  type Readings,
  type RosterUnit,
  type Run,
} from '../engine';
import { afterLockReadout, beforeTheLock, whatChangedReadout, type AfterLockItem, type InboxState } from './inbox';
import { noRunGetsThrough, type SolveProgress } from './run-page';

/**
 * The Run view's inbox after the Lock and What changed (#206), as the page draws them from the solve's progress: the
 * items in order, at-risk fixes in one click, behind units' re-solves, the re-solve's proposals (required once the plan
 * can't be met), this map's actions, and the nudge on Next map.
 */
const engine = createEngine();
const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
const fresh = runFromRoster(facts);
const steps = engine.mapOrder(fresh).steps;
const all = steps.map((s) => s.map);
// Two maps left (Chapter 25, then Endgame): Robin is locked (the facts are set) and maps are recorded.
const late = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
const seed = engine.seedPlan(late);
const [next, endpoint] = engine.mapOrder(late).steps;
const label = (map: string) => engine.maps().find((m) => m.id === map)!.label;
const ms = engine.milestones(late, seed);
const chance = { chance: 0.42, margin: 0.05, runs: 24, maps: [] } as unknown as FlawlessChance;

/** Chrom's first build skill swapped: a wishlist change dropping that skill's milestone. */
const chromSkill = seed.wishlist.units.find((w) => w.unit === 'chrom')!.build.find((k) => ms.some((m) => m.id === `skill:chrom:${k}:build`))!;
const swapped: Plan = { ...seed, wishlist: { ...seed.wishlist, units: seed.wishlist.units.map((w) => (w.unit === 'chrom' ? { ...w, build: w.build.map((k) => (k === chromSkill ? ('armsthrift' as never) : k)) } : w)) } };
const proposal: PlanProposal = { plan: swapped, label: 'Chrom’s build', edits: ['Chrom’s build: Armsthrift'], gain: 0.03, margin: 0.01, runs: 16 };

const lissaMs = ms.find((m) => m.units.includes('lissa'))!;
const chromMs = ms.find((m) => m.id === `skill:chrom:${chromSkill}:build`)!;
const reading = (r: Partial<Reading> & Pick<Reading, 'unit' | 'reading'>): Reading => ({ pending: false, worst: undefined, milestones: [], lost: 0, stats: [], ...r });
const atRisk = reading({ unit: 'lissa', reading: 'at-risk', worst: { id: lissaMs.id, chance: 0.5, reached: true }, change: { pin: { kind: 'pair', unit: 'lissa', value: 'frederick', from: next!.key, to: endpoint!.key }, chance: 0.86, reaches: true, breaks: [], turns: 0.4, flawless: 0.01 } });
const behind = reading({ unit: 'chrom', reading: 'behind', worst: { id: chromMs.id, chance: 0.3, reached: true }, why: 'no-change' });
const readings: Readings = { readings: [behind, atRisk], lostBy: 'stake', pending: [], stats: [] };
const progress: SolveProgress = { best: seed, start: seed, chance, proposals: [proposal], closeCalls: [], pruned: [], done: true, converged: true, readings };
const state = (over: Partial<InboxState> = {}): InboxState => ({ progress, choices: undefined, costs: new Map(), query: '', pinCosts: new Map(), ...over });
const item = <K extends AfterLockItem['kind']>(r: Run, kind: K, over: Partial<InboxState> = {}) => afterLockReadout(engine, r, state(over)).items.find((i): i is Extract<AfterLockItem, { kind: K }> => i.kind === kind);

describe('the inbox after the Lock (#206)', () => {
  it('is titled "Before <map>: what needs you" and lists at risk, behind, the re-solve, this map’s actions, anything else and your edits', () => {
    expect(beforeTheLock(late)).toBe(false);
    const r = afterLockReadout(engine, late, state());
    expect(r.title).toBe(`Before ${label(next!.map)}: what needs you`);
    expect(r.items.map((i) => i.kind)).toEqual(['headline', 'at-risk', 'behind', 'resolve', 'actions', 'anything-else', 'your-edits']);
    // Your edits and "anything else" stay after the Lock.
    expect(item(late, 'your-edits')!.note).toBe('No edits yet. Everything is the tool’s proposal.');
  });

  it('offers an at-risk unit its milestone, chance and the one-click span pin that restores it', () => {
    const row = item(late, 'at-risk')!.rows[0]!;
    expect(row.text).toMatch(/^Lissa: .* 50\.0%$/);
    expect(row.fix!.text).toBe(`Pair Lissa as Lead with Frederick as Back from ${label(next!.map)} to ${label(endpoint!.map)}: 86.0%, flawless chance +1.0`);
    const pinned = withEdit(late, row.fix!.edit!);
    expect(pinned.pins).toEqual([{ kind: 'span', unit: 'lissa', position: 'lead', partner: 'frederick', from: next!.key, to: endpoint!.key }]);
    expect(pinned.edits?.map((e) => e.label)).toEqual([`Pair Lissa as Lead with Frederick as Back from ${label(next!.map)} to ${label(endpoint!.map)}`]);
    // Until its changes are read, it says so.
    const pending = { ...progress, readings: { ...readings, readings: [reading({ ...atRisk, change: undefined, pending: true })] } };
    expect(item(late, 'at-risk', { progress: pending })!.rows[0]!.fix).toMatchObject({ text: 'Reading the changes that could bring it back…' });
  });

  it('offers a behind unit the re-solve proposal that moves its milestone', () => {
    const row = item(late, 'behind')!.rows[0]!;
    expect(row.text).toMatch(/^Chrom: .* 30\.0% · no single change brings it back to 80%$/);
    expect(row.fixes.map((f) => [f.text, f.proposal])).toEqual([['Wishlist change: Chrom’s build: Armsthrift: +3.0 ±1.0', proposal]]);
    // No proposal moves it: re-solving, then none found.
    expect(item(late, 'behind', { progress: { ...progress, proposals: [], done: false } })!.rows[0]).toMatchObject({ fixes: [], note: 'Re-solving: its proposal comes when the search finds one.' });
    expect(item(late, 'behind', { progress: { ...progress, proposals: [] } })!.rows[0]!.note).toBe('The re-solve found no plan that moves its milestones and does better.');
  });

  it('lists the re-solve’s proposals after the last recorded map with the milestones they move, never applied', () => {
    const r = item(late, 'resolve')!;
    const last = label(all[all.length - 3]!);
    expect(r.title).toBe(`The re-solve after ${last} found better`);
    expect(r.required).toBe(false);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.text).toMatch(/^Chrom’s build: Armsthrift: \+3\.0 ±1\.0 · adds Chrom’s Armsthrift before .*; drops Chrom’s .* before /);
    expect(r.rows[0]!.required).toBeUndefined();
    expect(late.adopted).toBeUndefined();
    // Dismissed: gone.
    expect(item(withDismissedProposal(late, proposalId(proposal)), 'resolve')).toBeUndefined();
  });

  it('marks the re-solve required once the adopted roadmap can no longer be met', () => {
    const lost = seed.wishlist.units.map((w) => w.unit).find((u) => u !== 'chrom' && u !== 'robin')!;
    // The death's loss item kept as it is (#208): the plan still needs the unit.
    const dead = withLossesSettled(recordFallen(late, latestEntry(late)!.id, lost, 9), [`dead:${lost}`]);
    const r = item(dead, 'resolve')!;
    expect(r.title.endsWith(': required before the next map')).toBe(true);
    expect(r.required).toBe(true);
    expect(r.reasons[0]).toMatch(/ died$/);
    expect(r.rows.every((x) => x.required)).toBe(true);
    // No proposal and the search done: a fresh plan is offered.
    expect(item(dead, 'resolve', { progress: { ...progress, proposals: [] } })).toMatchObject({ rows: [], fresh: true });
  });

  it('when no run gets through, leads with where the runs die and sums up the milestones it can’t read in one line', () => {
    const maps = [
      { key: next!.key, label: label(next!.map), reach: 1, noDeath: 0.035 },
      { key: endpoint!.key, label: label(endpoint!.map), reach: 0 },
    ];
    const zero = { ...chance, chance: 0, margin: 0, maps } as unknown as FlawlessChance;
    const dies = noRunGetsThrough(zero)!;
    expect(dies.text).toBe(`No run gets through with nobody lost. Where the runs die: ${label(next!.map)} (3.5% (no deaths about 1 run in 29)). No run reaches ${label(endpoint!.map)} with nobody lost.`);
    expect(dies.marks).toEqual([['3.5% (no deaths about 1 run in 29)', `map:${next!.key}`]]);
    expect(noRunGetsThrough(chance)).toBeUndefined();
    // How far runs get, with the runs read (#242): what ranks the plans at 0%.
    const far = noRunGetsThrough({ ...zero, clearedSamples: [1.2, 1.4] })!;
    expect(far.text).toMatch(/ Runs clear 1\.3 of 2 maps with nobody lost, on average: at 0%, plans are ranked by how far runs get\.$/);
    // Readings no run reaches with nobody lost: one line, not an item each; a reading it can read stays listed.
    const unreached = (unit: RosterUnit, id: string, r: Partial<Reading>) => reading({ unit, reading: 'at-risk', pending: true, worst: { id, chance: 0, reached: false }, ...r });
    const blind: Readings = { ...readings, readings: [behind, unreached('lissa', lissaMs.id, {}), unreached('sully', 'support:lonqu+sully', {}), unreached('vaike', 'x', { reading: 'behind', why: 'no-change' })] };
    const r = afterLockReadout(engine, late, state({ progress: { ...progress, chance: zero, proposals: [], readings: blind } }));
    expect(r.items.find((i) => i.kind === 'at-risk')).toBeUndefined();
    expect((r.items.find((i) => i.kind === 'behind') as Extract<AfterLockItem, { kind: 'behind' }>).rows.map((x) => x.key)).toEqual(['behind:chrom']);
    expect(r.items.find((i) => i.kind === 'unread')).toEqual({ kind: 'unread', text: `3 units’ milestones (Lissa, Sully and Vaike) can’t be read until a run gets past ${label(next!.map)}: no run reaches them with nobody lost.` });
    expect(r.nudge).toBe('1 item above still needs you (you can play anyway)');
  });

  it('reads open items as a nudge on Next map, never a gate', () => {
    expect(afterLockReadout(engine, late, state()).nudge).toBe('3 items above still need you (you can play anyway)');
    expect(afterLockReadout(engine, late, state({ progress: { ...progress, proposals: [], readings: { ...readings, readings: [] } } })).nudge).toBeUndefined();
  });

  it('lists this map’s actions: a class change due before it, a build skill to equip', () => {
    const last = all.slice(0, -1).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
    const plan = engine.seedPlan(last);
    const a = item(last, 'actions', { progress: { ...progress, best: plan, start: plan, proposals: [], readings: undefined } })!;
    expect(a.title).toBe(`On ${label(all[all.length - 1]!)}`);
    const changes = engine.milestones(last, plan).filter((m) => m.kind === 'class');
    expect(a.rows.map((r) => r.text)).toEqual(expect.arrayContaining(changes.map((m) => expect.stringMatching(new RegExp(`^Change .* to ${m.kind === 'class' ? m.className : ''} with a (Master|Second) Seal before this map$`)))));
    expect(a.rows.some((r) => / needs .* equipped for this map$/.test(r.text))).toBe(true);
  });
});

describe('What changed (#206)', () => {
  const map = next!.map;
  const before = { ...chance, maps: [{ key: next!.key, label: label(map) }], exp: [{ key: next!.key, label: label(map), runs: 8, groups: [], units: [{ unit: 'chrom', name: 'Chrom', priority: 'normal', exp: 120, level: { low: 1.2, median: 2.1, high: 2.9 }, kills: {} }] }] } as unknown as FlawlessChance;
  const recorded = addEntry(late, map, 9);
  const id = latestEntry(recorded)!.id;
  const was = latestEntry(late)!.snapshot.units.chrom!;
  const played = editEntry(withEntryForecast(recorded, id, forecastBefore(late, before, { ...readings, readings: [reading({ unit: 'chrom', reading: 'on-track' })] })!), id, (s) => ({ ...s, units: { ...s.units, chrom: { ...was, level: was.level + 1, exp: 30 } } }), 10);

  it('shows the chance before and after, EXP against the forecast, readings that moved and improvements found', () => {
    const w = whatChangedReadout(engine, played, { ...progress, chance: { ...chance, chance: 0.3, margin: 0.04 } })!;
    expect(w.title).toBe(`What changed on ${label(map)}`);
    expect(w.chance).toBe('Flawless chance: 42.0% ±5.0 before → 30.0% ±4.0 now (−12.0 points)');
    expect(w.exp).toEqual([`Chrom: ${100 + 30 - was.exp} EXP against 120 forecast; level ${(was.level + 1.3).toFixed(1)}, ${was.level + 1.3 > 2.9 ? 'above' : 'inside'} the forecast’s 1.2–2.9 (p${Math.round(forecastPercentile(was.level + 1.3, { low: 1.2, median: 2.1, high: 2.9 }) * 100)})`]);
    expect(w.readings).toEqual(['Chrom: on track → behind']);
    expect(w.improvements).toBe('The re-solve found 1 improvement: in the inbox below.');
    // Before the re-solve reads it; recorded with no headline worked out.
    expect(whatChangedReadout(engine, played, undefined)!.chance).toBe('Flawless chance: 42.0% ±5.0 before → working it out…');
    expect(whatChangedReadout(engine, recorded, undefined)!.chance).toBe('Flawless chance: working it out… (not worked out before the map was recorded)');
  });

  it('is dismissed with “got it”', () => {
    expect(whatChangedReadout(engine, withDismissedChange(played, id), progress)).toBeUndefined();
  });

  it('waits for a recorded map: nothing on the log’s starting point, right after the Lock', () => {
    const locked = runFromRoster(withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'lunatic', mode: 'classic', gender: 'F', asset: 'str', flaw: 'def' }));
    expect(locked.entries.map((e) => e.map)).toEqual(['other']);
    expect(whatChangedReadout(engine, locked, progress)).toBeUndefined();
    expect(whatChangedReadout(engine, addEntry(locked, 'premonition', 1), progress)!.title).toBe(`What changed on ${label('premonition')}`);
  });

  it('reads units that joined on the map from their join, and says so when a level wasn’t updated', () => {
    // The Prologue, recorded with everything copied: Chrom and Frederick join on it at their join levels.
    const open = addEntry(runFromRoster(facts), 'premonition', 1);
    const prologue = { ...chance, maps: [{ key: 'prologue', label: 'Prologue' }], exp: [{ key: 'prologue', label: 'Prologue', runs: 8, groups: [], units: [{ unit: 'chrom', name: 'Chrom', priority: 'normal', exp: 150, level: { low: 2.5, median: 2.5, high: 2.5 }, kills: {} }, { unit: 'frederick', name: 'Frederick', priority: 'normal', exp: 20, level: { low: 1.2, median: 1.2, high: 1.2 }, kills: {} }] }] } as unknown as FlawlessChance;
    const rec = addEntry(open, 'prologue', 2);
    const eid = latestEntry(rec)!.id;
    const kept = withEntryForecast(rec, eid, forecastBefore(open, prologue)!);
    const joinedAt = latestEntry(rec)!.snapshot.units.chrom!;
    const copied = whatChangedReadout(engine, kept, undefined)!.exp;
    expect(copied[0]).toBe(`Chrom (joined on this map): level ${joinedAt.level.toFixed(1)} as it joined, not updated: record its level and EXP to compare it with the 150 EXP forecast`);
    expect(copied.join(' ')).not.toMatch(/class change/);
    // Chrom's level recorded: its EXP counts from the join.
    const lv = editEntry(kept, eid, (s) => ({ ...s, units: { ...s.units, chrom: { ...joinedAt, level: joinedAt.level + 1, exp: 50 } } }), 3);
    expect(whatChangedReadout(engine, lv, undefined)!.exp[0]).toMatch(new RegExp(`^Chrom \\(joined on this map\\): ${150 - joinedAt.exp} EXP against 150 forecast; level ${(joinedAt.level + 1.5).toFixed(1)}`));
    // The copied-forward rows aren't learned from.
    expect(calibrationLog(kept)).toEqual([]);
    expect(calibrationLog(lv).map((r) => r.unit)).toEqual(['chrom']);
  });
});
