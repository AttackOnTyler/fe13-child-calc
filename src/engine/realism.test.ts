import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, createEngine, runFromRoster, withRun, type Difficulty, type FlawlessChance } from './index';

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
    // A careful Normal player clears the Main story without a loss the large majority of the time: the plan reads well
    // over even odds (about 85–90% on 24 runs, whichever Robin), not the few percent a modelling defect leaves, nor the
    // two thirds an Endgame farmed to the turn cap left (the second realism pass).
    expect(r.chance).toBeGreaterThan(0.7);
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

  // A careful Lunatic player clears the early chapters with Frederick walling and the healers healing, and the Longfort
  // (Chapter 3) with its foes drawn out a few at a time, before the first armory opens: a unit lost there is the
  // exception, not the rule (the second realism pass: Chapter 3 read 0%, its staves and weapons dry after plays twice as
  // long as real ones).
  let lunatic: FlawlessChance | undefined;
  const early = () => {
    const run = fresh('lunatic');
    return (lunatic ??= engine.flawlessChance(run, { plan: engine.seedPlan(run), runs: 6 }));
  };

  it('reads the Lunatic Prologue to Chapter 2 at 90% or more each', () => {
    for (const key of ['prologue', 'chapter-1', 'chapter-2']) {
      const m = early().maps.find((x) => x.key === key)!;
      expect(m.noDeath!, key).toBeGreaterThanOrEqual(0.9);
    }
  });

  // Below its floor (#246): the army is worn down against Raimi once the staves run dry, and the play stalls. It read
  // 78% on 24 runs before the weapon rank bonus (#239), 55% after. Flip this back to `it` once #246 lands.
  it.fails('reads the Lunatic Chapter 3 at 80% or more', () => {
    expect(early().maps.find((x) => x.key === 'chapter-3')!.noDeath!).toBeGreaterThanOrEqual(0.8);
  });

  it('reads the plan no higher with nobody rallying than with its Rallies (within the headline’s error)', () => {
    // A careful player rallies only when the bonus is worth the rallier's action: taking Rally away can't help. The
    // stress case read 84% over a 66% headline while a Rally holder rallied every turn instead of fighting (#211).
    const run = runFromRoster(withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal' }));
    const plan = engine.seedPlan(run);
    const r = engine.flawlessChance(run, { plan, runs: 6 });
    const stressed = engine.stressChance(run, plan, 'no-rally', { runs: 6 });
    expect(stressed.chance).toBeLessThanOrEqual(r.chance + r.margin);
  });
});
