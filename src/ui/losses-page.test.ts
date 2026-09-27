import { describe, expect, it } from 'vitest';
import {
  EMPTY_ROSTER,
  addEntry,
  createEngine,
  latestEntry,
  openLosses,
  recordFallen,
  recordMissed,
  runFromRoster,
  withEntryForecast,
  withRun,
  type FlawlessChance,
  type Run,
  type WhatItCost,
} from '../engine';
import { afterLockReadout, whatChangedReadout, type AfterLockItem, type InboxState } from './inbox';
import { lossBannerText } from './prep-page';
import { lossesRecorded, type SolveProgress } from './run-page';

/**
 * Losses on the Run view and Prepare (#208), as the pages write them: the loss item on top of the inbox, What it cost
 * on What changed, the banner on Prepare, and what Record results lists as recorded.
 */
const engine = createEngine();
const facts = (mode: 'classic' | 'casual' = 'classic') => withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', mode, gender: 'M', asset: 'mag', flaw: 'hp' });
const fresh = runFromRoster(facts());
const all = engine.mapOrder(fresh).steps.map((s) => s.map);
// Two maps left (Chapter 25, then Endgame).
const late = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
const id = latestEntry(late)!.id;
const seed = engine.seedPlan(late);
const lost = seed.wishlist.units.map((w) => w.unit).find((u) => u !== 'chrom' && u !== 'robin')!;
const label = (map: string) => engine.maps().find((m) => m.id === map)!.label;
const mapLabel = label(all[all.length - 3]!);
const name = lost[0]!.toUpperCase() + lost.slice(1);
const chance = { chance: 0.3, margin: 0.04, runs: 24, maps: [] } as unknown as FlawlessChance;
const progress: SolveProgress = { best: seed, start: seed, chance, proposals: [], closeCalls: [], pruned: [], done: true, converged: true };
const state = (over: Partial<InboxState> = {}): InboxState => ({ progress, choices: undefined, costs: new Map(), query: '', pinCosts: new Map(), ...over });
const itemOf = <K extends AfterLockItem['kind']>(r: Run, kind: K, over: Partial<InboxState> = {}) => afterLockReadout(engine, r, state(over)).items.find((i): i is Extract<AfterLockItem, { kind: K }> => i.kind === kind);
const dead = recordFallen(withEntryForecast(late, id, { chance: 0.42, margin: 0.05, key: 'x', map: all[all.length - 3]!, exp: [], readings: [] }), id, lost, 9);

describe('the loss item (#208)', () => {
  it('sits at the top of the inbox with the chance before the loss, what it broke and what the re-solve changes', () => {
    const r = afterLockReadout(engine, dead, state());
    expect(r.items[0]!.kind).toBe('loss');
    const l = itemOf(dead, 'loss')!;
    expect(l.title).toBe(`${name} died on ${mapLabel}: a re-solve for the army that’s left`);
    expect(l.lines[0]).toMatch(new RegExp(`^It broke .*${name}`));
    expect(l.chance).toBe('Flawless chance: 42.0% ±5.0 before the loss → working out the re-solve’s chance… (no further deaths from here)');
    expect(l.changes).toContain(`Out of the wishlist: ${name}`);
    expect(l.same).toBe(false);
    // The death isn't repeated as a reason the re-solve is required.
    expect(itemOf(dead, 'resolve')).toBeUndefined();
    // It counts on Next map's nudge.
    expect(r.open).toBe(1);
  });

  it('reads the re-solve’s chance once the worker has it, and adopts that plan only when accepted', () => {
    const refined = { plan: seed, chance: 0.25, margin: 0.03 };
    const l = itemOf(dead, 'loss', { progress: { ...progress, loss: refined } })!;
    expect(l.chance).toBe('Flawless chance: 42.0% ±5.0 before the loss → 25.0% ±3.0 with the re-solve (no further deaths from here)');
    expect(l.plan).toBe(seed);
    expect(dead.adopted).toBeUndefined();
    expect(l.keys).toEqual([`dead:${lost}`]);
    expect(l.label).toBe(`Re-solve after ${name} died on ${mapLabel}`);
  });

  it('is the same flow for a missed recruit', () => {
    const missed = recordMissed(late, id, lost, 9);
    expect(itemOf(missed, 'loss')!.title).toBe(`${name} was missed on ${mapLabel}: a re-solve for the army that’s left`);
  });

  it('shows on Prepare as a banner until accepted', () => {
    expect(lossBannerText(engine, late)).toBeUndefined();
    expect(lossBannerText(engine, dead)).toBe(`Your plan predates the loss (${name} died on ${mapLabel}): accept its re-solve in the Run view’s inbox to plan for the army that’s left.`);
    expect(openLosses(dead)).toHaveLength(1);
  });

  it('lists what Record results recorded on the map, Casual falls as falls', () => {
    expect(lossesRecorded(dead, latestEntry(dead)!)).toEqual([{ unit: lost, text: `${name} died` }]);
    const casual = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts('casual')));
    const fell = recordFallen(casual, latestEntry(casual)!.id, lost, 9);
    expect(lossesRecorded(fell, latestEntry(fell)!)).toEqual([{ unit: lost, text: `${name} fell (Casual: back after the map, logged)` }]);
    expect(itemOf(fell, 'loss')).toBeUndefined();
  });
});

describe('What it cost on What changed (#208)', () => {
  const cost: WhatItCost = {
    entry: id,
    rows: [
      { key: `dead:${lost}`, kind: 'died', unit: lost, points: -0.052, margin: 0.01, broke: [] },
      { key: 'over-plan', kind: 'over-plan', points: -0.012, margin: 0.004, excess: 2400, kit: [{ item: 'Brave Sword', unit: 'chrom', name: 'Chrom' }] },
      { key: 'level:chrom', kind: 'level', unit: 'chrom', points: 0.004, margin: 0.002, level: { recorded: 12.3, forecast: 11.5 } },
    ],
    small: { count: 2, points: -0.0012 },
    runs: 8,
  };

  it('lists deaths, over-plan spending as the endpoint kit shrinking, gains and the small rows rolled up', () => {
    const w = whatChangedReadout(engine, dead, { ...progress, cost: { value: cost } })!;
    expect(w.cost.map((r) => r.text)).toEqual([
      `${name} died: −5.2 ±1.0 points, after the re-solve`,
      'Over-plan spending: 2,400G more than the plan: the endpoint kit loses Brave Sword for Chrom: −1.2 ±0.4 points',
      'Chrom ahead of the forecast (level 12.3 against 11.5): +0.4 ±0.2 points',
      '2 smaller rows (under 0.1 points each): −0.1 points together',
    ]);
    expect(w.costNote).toBe('In flawless points on 8 paired runs each (negative: what it cost).');
    // Until the worker prices it.
    expect(whatChangedReadout(engine, dead, progress)!).toMatchObject({ cost: [], costNote: 'What it cost: pricing each event on the same runs…' });
  });
});
