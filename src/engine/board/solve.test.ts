/** The position solver on the Lunatic Prologue (#265). */
import { describe, expect, it } from 'vitest';
import { liveEnemies, movement, playerById } from './board';
import { keyTile, manhattan } from './captured';
import { enemyPhase } from './enemy-phase';
import { prologueBoard } from './prologue-fixture';
import { applyAction, solvePositions, type PlannedAction } from './solve';

describe('the position solver (#265)', () => {
  const plan = solvePositions(prologueBoard());

  it('keeps the hard line every turn from turn 1, and the outline routs in 10 turns or fewer', () => {
    expect(plan.turns).toHaveLength(3);
    expect(plan.turns.every((t) => t.safety.safe)).toBe(true);
    expect(plan.hardLine).toBe(true);
    expect(plan.brokenTurns).toEqual([]);
    // 10, not the 7 it read before #271: the outer ring it used to cut corners through isn't on the map (attempt 1: 11).
    expect(plan.routTurn).toBeLessThanOrEqual(10);
    // Every unit gets an action on turn 1 (a back rides with its lead), each with a reason.
    const t1 = plan.turns[0]!;
    expect(t1.actions.length).toBeGreaterThanOrEqual(3);
    expect(t1.actions.every((a) => a.why.length > 0)).toBe(true);
  });

  it('after Robin’s Thunder misses on T2 from inside reach, the re-solve finds what a wide search finds, and says the turn breaks', () => {
    // Attempt 1's T1 formation and its enemy phase.
    const t1 = prologueBoard({ frederick: [2, 12], lissa: [2, 14], robin: [3, 14] }, { frederick: 'chrom' });
    const t2 = { ...enemyPhase(t1).board, turn: 2 };
    const barbarian = liveEnemies(t2).find((e) => e.hp === 6)!;
    const robin = playerById(t2, 'robin')!;
    const from = [...movement(t2, robin).keys()].map(keyTile).find((t) => manhattan(t, barbarian.at) === 2)!;
    const thunder: PlannedAction = { unit: 'robin', from: robin.at, to: from, command: { kind: 'attack', target: barbarian.id, weapon: 'Thunder' }, why: '' };
    const missed = applyAction(t2, thunder, { ours: 'missed' });
    expect(liveEnemies(missed).find((e) => e.id === barbarian.id)!.hp).toBe(6);
    const again = solvePositions(missed, { acted: ['robin'], turns: 1, outlineCap: 0 });
    expect(again.turns[0]!.actions.some((a) => a.unit === 'robin')).toBe(false);
    // No line keeps it here (both Barbarians can reach Robin whatever the rest do): the least-risk line, named broken.
    const wide = solvePositions(missed, { acted: ['robin'], turns: 1, outlineCap: 0, beam: 40, turnBeam: 6 });
    expect(again.turns[0]!.safety.safe).toBe(wide.turns[0]!.safety.safe);
    expect(again.hardLine).toBe(false);
    expect(again.brokenTurns).toEqual([2]);
    // Solved before the roll, the same turn has a safe line: the roll that matters goes where a miss can be covered.
    expect(solvePositions(t2, { turns: 1, outlineCap: 0 }).turns[0]!.safety.safe).toBe(true);
  });

  it('after Frederick’s opening attack misses, the re-solve keeps the hard line', () => {
    const t1 = plan.turns[0]!;
    const attack = t1.actions.find((a) => a.command.kind === 'attack' && a.unit === 'frederick')!;
    let b = t1.before;
    for (const a of t1.actions.slice(0, t1.actions.indexOf(attack))) b = applyAction(b, a);
    const missed = applyAction(b, attack, { ours: 'missed' });
    const acted = t1.actions.slice(0, t1.actions.indexOf(attack) + 1).map((a) => a.unit);
    const again = solvePositions(missed, { acted, turns: 1, outlineCap: 0 });
    expect(again.turns[0]!.safety.safe).toBe(true);
  });

  it('solves the rest of the turn around a pinned move (Frederick → (1,9))', () => {
    const b = prologueBoard();
    const barbarian = liveEnemies(b).find((e) => e.at[0] === 1 && e.at[1] === 8)!;
    const pinned: PlannedAction = { unit: 'frederick', from: [2, 14], to: [1, 9], command: { kind: 'attack', target: barbarian.id, weapon: 'Silver Lance' }, why: '' };
    const tried = solvePositions(b, { pinned, turns: 1, outlineCap: 0 });
    const first = tried.turns[0]!.actions[0]!;
    expect(first).toMatchObject({ unit: 'frederick', to: [1, 9], command: { kind: 'attack', target: barbarian.id } });
    expect(tried.turns[0]!.actions.slice(1).some((a) => a.unit !== 'frederick')).toBe(true);
    expect(tried.turns[0]!.actions.filter((a) => a.unit === 'frederick')).toHaveLength(1);
  });

  it('solves a turn in well under a few seconds', () => {
    const t0 = performance.now();
    solvePositions(prologueBoard(), { turns: 1, outlineCap: 0 });
    expect(performance.now() - t0).toBeLessThan(3000);
  });
});
