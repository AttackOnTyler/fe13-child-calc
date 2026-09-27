import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, createEngine, runFromRoster, withRun, type Difficulty } from './index';

/**
 * Realism anchors for the simulation (spec #175; the realism pass): numbers a careful player's experience bounds, read
 * through the facade on a fresh run and its seed plan. They guard against modelling defects that drag every reading to
 * zero (a unit fighting unarmed, an army with no healer, a front in reach read as safe, a boss never attacked), not
 * against a tuned constant. Each asserts a floor the seed plan clears with room to spare; the thresholds are what a
 * careful Normal player achieves, not the simulation's own readings.
 */
const engine = createEngine();
const fresh = (difficulty: Difficulty) => runFromRoster(withRun(EMPTY_ROSTER, { route: 'main-story', difficulty, gender: 'M', asset: 'mag', flaw: 'hp' }));

describe('realism anchors (the realism pass)', () => {
  it('reads a fresh Normal Main story plan as a likely flawless run, each story chapter at 90% or more', () => {
    const run = fresh('normal');
    const plan = engine.seedPlan(run);
    const r = engine.flawlessChance(run, { plan, runs: 6 });
    // A careful Normal player clears the Main story without a loss the large majority of the time: the plan reads more
    // than even odds (about 80% on 24 runs), not the few percent a modelling defect leaves.
    expect(r.chance).toBeGreaterThan(0.5);
    const story = r.maps.filter((m) => /^(prologue|chapter-\d+|endgame)$/.test(m.key) && m.noDeath !== undefined);
    expect(story.length).toBeGreaterThan(20);
    for (const m of story) expect(m.noDeath!, m.key).toBeGreaterThanOrEqual(0.9);
    // Nothing on the way grinds to the turn cap.
    for (const m of r.maps) if (m.stalled !== undefined) expect(m.stalled, m.key).toBe(0);
  });

  it('reads a capped army on the Normal Endgame at 90% or more', () => {
    const run = fresh('normal');
    const c = engine.ceiling(run, { plan: engine.seedPlan(run), runs: 1 })!;
    expect(c.key).toBe('endgame');
    expect(c.chance!).toBeGreaterThanOrEqual(0.9);
  });

  it('reads the Lunatic Prologue to Chapter 2 at 90% or more each', () => {
    const run = fresh('lunatic');
    const r = engine.flawlessChance(run, { plan: engine.seedPlan(run), runs: 6 });
    for (const key of ['prologue', 'chapter-1', 'chapter-2']) {
      const m = r.maps.find((x) => x.key === key)!;
      expect(m.noDeath!, key).toBeGreaterThanOrEqual(0.9);
    }
  });
});
