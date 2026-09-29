/** The best-first search to the fewest-turn rout (#284) on the Lunatic Prologue. */
import { describe, expect, it } from 'vitest';
import { liveEnemies } from './board';
import { prologueBoard } from './prologue-fixture';
import { routBound, solvePositions } from './solve';

describe('the rout search (#284)', () => {
  it('bounds the rout from below: Garrick never moves, so someone must walk to him', () => {
    const b = prologueBoard();
    // Frederick is 13 tiles from Garrick with Mov 7 and a lance: he can't strike him this turn.
    expect(routBound(b)).toBeGreaterThanOrEqual(2);
  });

  it('solves the Prologue from turn 1 to the rout: no game-over risk over the cap, the worth lost within budget', () => {
    const progress: number[] = [];
    const plan = solvePositions(prologueBoard(), { onProgress: (p) => progress.push(p.expanded) });
    // Proven over the phase ends each node tries: turn 6 (Ellery's fast clears take 5–10; a proof above 10 would mean
    // the move menu still misses something).
    expect(plan.proven).toBe(true);
    expect(plan.routTurn).toBe(6);
    expect(plan.gameOver).toBeLessThanOrEqual(0.01);
    expect(plan.worthLost).toBeLessThanOrEqual(plan.budget);
    // The line is whole: every turn from 1 to the rout, and nothing left standing after it.
    expect(plan.turns.map((t) => t.turn)).toEqual(Array.from({ length: plan.routTurn! }, (_, i) => i + 1));
    expect(liveEnemies(plan.turns.at(-1)!.after)).toHaveLength(0);
    expect(progress.length).toBeGreaterThan(0);
  }, 600_000);
});
