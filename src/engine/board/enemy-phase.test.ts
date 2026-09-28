/**
 * The enemy-phase simulator against attempt 1 of the Lunatic Prologue (#263; `docs/play-log/p02-prologue.md` on
 * `play/azahar-harness`).
 */
import { describe, expect, it } from 'vitest';
import { liveEnemies, withPieces, type Board } from './board';
import { enemyPhase, wake } from './enemy-phase';
import { prologueBoard } from './prologue-fixture';

const at = (b: Board, x: number, y: number) => liveEnemies(b).find((e) => e.at[0] === x && e.at[1] === y)!;
const NORTH: readonly (readonly [number, number])[] = [[7, 3], [9, 3], [8, 2], [6, 2], [10, 2]];
/** The board with only Garrick and the northern band left (the south cleared by T5). */
const northOnly = (b: Board) => withPieces(b, b.players, b.enemies.filter((e) => e.boss || e.group === 1));

describe('the enemy phase on the Lunatic Prologue (#263)', () => {
  it('reads the turn-1 board: 11 foes matched to the chapter data, Garrick with his Short Axe', () => {
    const b = prologueBoard();
    expect(liveEnemies(b)).toHaveLength(11);
    expect(at(b, 8, 1).foe).toMatchObject({ name: 'Garrick', boss: true, weapon: { name: 'Short Axe' }, skills: ['Gamble'] });
    expect(at(b, 8, 2).foe.weapon?.name).toBe('Elthunder');
    expect(at(b, 10, 6).foe.weapon?.name).toBe('Elwind');
    expect(at(b, 4, 10).foe.weapon?.name).toBe('Iron Sword');
    expect(b.outdoors).toBe(true);
  });

  it('EP1 after attempt 1’s T1: the (4,10) Myrmidon, then the (1,8) Barbarian, attack Frederick; the north sleeps', () => {
    // Chrom paired onto Frederick at (2,12); Lissa (2,14), Robin (3,14).
    const b = prologueBoard({ frederick: [2, 12], lissa: [2, 14], robin: [3, 14] }, { frederick: 'chrom' });
    const ep = enemyPhase(b);
    const attacks = ep.actions.filter((a) => a.target);
    expect(attacks.map((a) => [a.enemy, a.target])).toEqual([
      [at(b, 4, 10).id, 'frederick'],
      [at(b, 1, 8).id, 'frederick'],
    ]);
    // The Myrmidon dies on the counter (27 at 100%); the Barbarian is left at 6 (30 − 24), as the log says.
    expect(attacks[0]!.result).toMatchObject({ enemyHp: 0 });
    expect(attacks[1]!.result).toMatchObject({ enemyHp: 6, targetHp: 28 - 6 });
    // The rest of the south closes in; the northern band stays asleep and put.
    for (const [x, y] of NORTH) expect(ep.board.enemies.find((e) => e.id === at(b, x, y).id)).toMatchObject({ awake: false, at: [x, y] });
    expect(ep.woke).not.toContain(at(b, 7, 3).id);
    const mage = ep.actions.find((a) => a.enemy === at(b, 10, 6).id)!;
    expect(mage.target).toBeUndefined();
    expect(mage.to).not.toEqual([10, 6]);
  });

  it('wakes the north when Frederick stands at (7,6), not at (5,11) (attempt 1, T5 and T6)', () => {
    const t5 = northOnly(prologueBoard({ frederick: [5, 11], robin: [2, 14], lissa: [1, 14] }, { frederick: 'chrom' }));
    // Garrick is active from turn 1 (awake from the start); the band sleeps.
    expect(at(t5, 8, 1).awake).toBe(true);
    expect(wake(t5).woke).toEqual([]);
    const t6 = northOnly(prologueBoard({ frederick: [7, 6], robin: [2, 14], lissa: [1, 14] }, { frederick: 'chrom' }));
    const woke = wake(t6).woke;
    // The whole band wakes together, and both Myrmidons attack that same phase.
    for (const [x, y] of NORTH) expect(woke).toContain(at(t6, x, y).id);
    const ep = enemyPhase(t6);
    expect(ep.actions.filter((a) => a.target === 'frederick').map((a) => a.enemy)).toEqual(expect.arrayContaining([at(t6, 7, 3).id, at(t6, 9, 3).id]));
  });

  it('Garrick never moves, and attacks what his Short Axe reaches from (8,1): range 1–2', () => {
    const far = northOnly(prologueBoard({ frederick: [8, 6] }, { frederick: 'chrom' }));
    const g = at(far, 8, 1).id;
    const farEp = enemyPhase(withPieces(far, far.players, far.enemies.filter((e) => e.boss)));
    expect(farEp.actions.find((a) => a.enemy === g)).toMatchObject({ to: [8, 1] });
    expect(farEp.actions.find((a) => a.enemy === g)!.target).toBeUndefined();
    for (const tile of [[8, 3], [7, 2], [8, 2]] as const) {
      const near = prologueBoard({ frederick: tile }, { frederick: 'chrom' });
      const ep = enemyPhase(withPieces(near, near.players, near.enemies.filter((e) => e.boss)));
      expect(ep.actions.find((a) => a.enemy === g)).toMatchObject({ to: [8, 1], target: 'frederick', range: Math.abs(tile[0] - 8) + Math.abs(tile[1] - 1) });
    }
  });

  it('never targets a paired back, and swaps its targeting rule', () => {
    const b = prologueBoard({ frederick: [2, 12], lissa: [2, 14], robin: [3, 14] }, { frederick: 'chrom' });
    expect(enemyPhase(b).actions.some((a) => a.target === 'chrom')).toBe(false);
    // A rule that never attacks: everyone only walks.
    expect(enemyPhase(b, () => undefined).actions.every((a) => !a.target)).toBe(true);
  });

  // Ground truth from two turn-1 bookmarks (#273): the enemy phase after ending turn 1 with no moves (E0), and with only
  // Frederick moved to (7,13) (E2), every tile read from the game's own save. The game rolls among equal tiles, so each
  // one it took is the prediction or one of its alternatives; the prediction is the one nearest our units.
  const stops = (b: Board) =>
    new Map(enemyPhase(b).actions.map((a) => [`${b.enemies.find((e) => e.id === a.enemy)!.at}`, [a.to, ...(a.alternatives ?? [])].map(String)]));
  it('E0: each foe stops on a tile the simulator lists; the Mage and the far Barbarian as predicted', () => {
    const b = prologueBoard();
    const s = stops(b);
    const game: Record<string, string> = { '4,10': '2,13', '10,6': '8,9', '7,9': '6,13', '1,8': '2,12', '9,12': '5,13' };
    for (const [from, to] of Object.entries(game)) expect(s.get(from)).toContain(to);
    const ep = enemyPhase(b);
    expect(ep.actions.find((a) => a.enemy === at(b, 10, 6).id)!.to).toEqual([8, 9]);
    expect(ep.actions.find((a) => a.enemy === at(b, 1, 8).id)!.to).toEqual([2, 12]);
    // The Myrmidon's kill on Lissa could come from either side of her.
    expect(ep.actions.find((a) => a.enemy === at(b, 4, 10).id)).toMatchObject({ target: 'lissa', alternatives: [[2, 13]] });
  });

  it('E2: with Frederick at (7,13) the Mage stops on (9,10), and the Barbarian attacks him from a listed tile', () => {
    const b = prologueBoard({ frederick: [7, 13] });
    const ep = enemyPhase(b);
    expect(ep.actions.find((a) => a.enemy === at(b, 10, 6).id)).toMatchObject({ to: [9, 10], alternatives: [[10, 11]] });
    expect(stops(b).get('7,9')).toContain('6,13');
    expect(ep.actions.find((a) => a.enemy === at(b, 7, 9).id)!.target).toBe('frederick');
  });
});
