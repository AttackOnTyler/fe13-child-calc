/** The position log's replay (#266) on the Lunatic Prologue: the rules it keeps as the board advances. */
import { describe, expect, it } from 'vitest';
import { liveEnemies, playerById, threatTiles, withEnemy, withPieces, withPlayer } from './board';
import { keyTile, tileKey } from './captured';
import { enemyPhase } from './enemy-phase';
import { replay } from './log';
import { prologueBoard } from './prologue-fixture';
import { solvePositions, type PlannedAction } from './solve';

describe('replaying the position log', () => {
  it('a Separate ends the dropped unit’s turn as well as the lead’s, and the re-solve never moves it (#270)', () => {
    // Attempt 2's T9: Chrom carries Lissa; Lissa leads (switched), moves and drops Chrom.
    const b = prologueBoard({ chrom: [3, 13] }, { chrom: 'lissa' });
    const separate: PlannedAction = { unit: 'lissa', switched: true, from: [3, 13], to: [2, 13], command: { kind: 'separate', to: [2, 12] }, why: '' };
    const r = replay(b, [{ kind: 'act', action: separate }]);
    expect(playerById(r.board, 'chrom')!.at).toEqual([2, 12]);
    expect([...r.acted].sort()).toEqual(['chrom', 'lissa']);
    const plan = solvePositions(r.board, { acted: r.acted, turns: 1, outlineCap: 0 });
    expect(plan.turns[0]!.actions.some((a) => a.unit === 'chrom' || a.unit === 'lissa')).toBe(false);
  });

  it('Heal restores 8 + Mag/2: Lissa (Mag 5) takes Frederick from 16/28 to 26, switched to the lead first (#272)', () => {
    let b = prologueBoard({ chrom: [5, 12], frederick: [5, 10] }, { chrom: 'lissa' });
    b = withPlayer(b, { ...playerById(b, 'frederick')!, hp: 16 });
    const heal: PlannedAction = { unit: 'lissa', switched: true, from: [5, 12], to: [5, 11], command: { kind: 'heal', target: 'frederick', staff: 'Heal' }, why: '' };
    const r = replay(b, [{ kind: 'act', action: heal }]);
    expect(playerById(r.board, 'frederick')!.hp).toBe(26);
    // Capped at max HP.
    const r2 = replay(withPlayer(b, { ...playerById(b, 'frederick')!, hp: 25 }), [{ kind: 'act', action: heal }]);
    expect(playerById(r2.board, 'frederick')!.hp).toBe(28);
  });
});

describe('the Prologue’s outer ring is off the map (#271)', () => {
  const ring = (k: number) => {
    const [x, y] = keyTile(k);
    return x === 0 || y === 0 || x === 16 || y === 15;
  };

  it('Lissa at (1,13), with Barbarians at (2,8) and (3,9), is in reach (attempt 2’s EP9)', () => {
    let b = prologueBoard({ lissa: [1, 13], chrom: [2, 13], frederick: [2, 6], robin: [3, 6] }, { frederick: 'robin' });
    const barbs = liveEnemies(b).filter((e) => e.foe.className === 'Barbarian' && !e.boss);
    b = withEnemy(b, { ...barbs[0]!, at: [2, 8], awake: true });
    b = withEnemy(b, { ...barbs[1]!, at: [3, 9], awake: true });
    const reach = [...liveEnemies(b)].filter((e) => e.id === barbs[0]!.id || e.id === barbs[1]!.id).map((e) => threatTiles(b, e));
    expect(reach.some((r) => r.has(tileKey([1, 13])))).toBe(true);
  });

  it('nothing plans or predicts a move onto x=0, x=16, y=0 or y=15', () => {
    const plan = solvePositions(prologueBoard());
    for (const t of plan.turns) {
      for (const a of t.actions) {
        expect(ring(tileKey(a.to)), `${a.unit} → (${a.to})`).toBe(false);
        if (a.command.kind === 'separate') expect(ring(tileKey(a.command.to))).toBe(false);
      }
      for (const e of t.enemy) expect(ring(tileKey(e.to)), `${e.enemy} → (${e.to})`).toBe(false);
    }
    // A unit left in the corner: its enemies' threat and moves stay inside too.
    const b = prologueBoard({ lissa: [1, 14] });
    for (const e of liveEnemies(b)) for (const k of threatTiles(b, e)) expect(ring(k)).toBe(false);
    for (const e of enemyPhase(withPieces(b, b.players, b.enemies.map((x) => ({ ...x, awake: true })))).actions) expect(ring(tileKey(e.to))).toBe(false);
  });
});
