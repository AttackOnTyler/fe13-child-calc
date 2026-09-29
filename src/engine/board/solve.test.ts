/** The position solver on the Lunatic Prologue (#265). */
import { describe, expect, it } from 'vitest';
import { liveEnemies, movement, playerById } from './board';
import { keyTile, manhattan, sameTile, tileKey } from './captured';
import { enemyPhase } from './enemy-phase';
import { prologueBoard } from './prologue-fixture';
import { actingTiles, actionText, applyAction, menuAt, solvePositions, type PlannedAction } from './solve';

describe('the position solver (#265)', () => {
  const plan = solvePositions(prologueBoard(), { phaseEnds: 3 });

  it('plans every turn from turn 1 to the rout, within the game-over cap and the budget (#284)', () => {
    expect(plan.routTurn).toBeDefined();
    expect(plan.turns).toHaveLength(plan.routTurn!);
    expect(plan.withinRisk).toBe(true);
    expect(plan.proven).toBe(true);
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
    const again = solvePositions(missed, { acted: ['robin'], turns: 1 });
    expect(again.turns[0]!.actions.some((a) => a.unit === 'robin')).toBe(false);
    // No line keeps Robin safe here (both Barbarians can reach him whatever the rest do): his death is game over, so the
    // plan is the least-risk line, over the cap, and a wide search agrees.
    const wide = solvePositions(missed, { acted: ['robin'], turns: 1, beam: 40, phaseEnds: 6 });
    expect(again.turns[0]!.safety.safe).toBe(wide.turns[0]!.safety.safe);
    expect(again.withinRisk).toBe(false);
    expect(again.gameOver).toBeGreaterThan(0.01);
    // Solved before the roll, the same turn has a safe line: the roll that matters goes where a miss can be covered.
    expect(solvePositions(t2, { turns: 1 }).turns[0]!.safety.safe).toBe(true);
  });

  it('after Frederick’s opening attack misses, the re-solve keeps the hard line', () => {
    const t1 = plan.turns[0]!;
    const attack = t1.actions.find((a) => a.command.kind === 'attack' && a.unit === 'frederick')!;
    let b = t1.before;
    for (const a of t1.actions.slice(0, t1.actions.indexOf(attack))) b = applyAction(b, a);
    const missed = applyAction(b, attack, { ours: 'missed' });
    const acted = t1.actions.slice(0, t1.actions.indexOf(attack) + 1).map((a) => a.unit);
    const again = solvePositions(missed, { acted, turns: 1 });
    expect(again.turns[0]!.safety.safe).toBe(true);
  });

  it('solves the rest of the turn around a pinned move (Frederick → (1,9))', () => {
    const b = prologueBoard();
    const barbarian = liveEnemies(b).find((e) => e.at[0] === 1 && e.at[1] === 8)!;
    const pinned: PlannedAction = { unit: 'frederick', from: [2, 14], to: [1, 9], command: { kind: 'attack', target: barbarian.id, weapon: 'Silver Lance' }, why: '' };
    const tried = solvePositions(b, { pinned, turns: 1 });
    const first = tried.turns[0]!.actions[0]!;
    expect(first).toMatchObject({ unit: 'frederick', to: [1, 9], command: { kind: 'attack', target: barbarian.id } });
    expect(tried.turns[0]!.actions.slice(1).some((a) => a.unit !== 'frederick')).toBe(true);
    expect(tried.turns[0]!.actions.filter((a) => a.unit === 'frederick')).toHaveLength(1);
  });

  it('solves a turn in well under a few seconds', () => {
    const t0 = performance.now();
    solvePositions(prologueBoard(), { turns: 1 });
    expect(performance.now() - t0).toBeLessThan(3000);
  });

  it('offers a pair’s back its menu after a Switch, and the action plays switched (#274)', () => {
    // Chrom carries Lissa on (3,13); Frederick at 16/28 on (3,11).
    let b = prologueBoard({ chrom: [3, 13], frederick: [3, 11] }, { chrom: 'lissa' });
    b = applyAction(b, { unit: 'frederick', from: [3, 11], to: [3, 11], command: { kind: 'wait' }, why: '' });
    b = { ...b, players: b.players.map((p) => (p.id === 'frederick' ? { ...p, hp: 16 } : p)) };
    const menu = menuAt(b, 'lissa', [3, 12]);
    const heal = menu.find((a) => a.command.kind === 'heal')!;
    expect(heal).toMatchObject({ unit: 'lissa', switched: true, from: [3, 13], to: [3, 12], command: { target: 'frederick', staff: 'Heal' } });
    // The why says what it heals: Heal is 8 + Mag/2 (#272).
    expect(heal.why).toBe('heals Frederick: +10 (16 → 26)');
    const after = applyAction(b, heal);
    expect(playerById(after, 'frederick')!.hp).toBe(26);
    expect(playerById(after, 'lissa')).toMatchObject({ at: [3, 12], back: 'chrom' });
    // The lead's own menu isn't switched.
    expect(menuAt(b, 'chrom', [3, 12]).every((a) => !a.switched && a.unit === 'chrom')).toBe(true);
  });

  it('a pair moves on its lead’s reach: every switched move in the plan is one the lead could make (#291)', () => {
    for (const t of plan.turns) {
      let b = t.before;
      for (const a of t.actions) {
        if (a.switched) {
          const lead = playerById(b, playerById(b, a.unit)!.carriedBy!)!;
          expect(movement(b, lead).has(tileKey(a.to)), `T${t.turn}: ${a.unit} → (${a.to})`).toBe(true);
        }
        b = applyAction(b, a);
      }
    }
  });

  it('a pair’s back acts only where its lead can move, after a Switch there (#291)', () => {
    // Attempt 4's T1: Frederick paired behind Lissa on (1,13). Lissa moves 6; (4,9) is 7 away.
    const b = prologueBoard({ lissa: [1, 13] }, { lissa: 'frederick' });
    const reach = actingTiles(b, 'frederick');
    expect(reach.has(tileKey([4, 9]))).toBe(false);
    expect(reach.has(tileKey([3, 10]))).toBe(true);
    expect(reach).toEqual(actingTiles(b, 'lissa'));
    const myrmidon = liveEnemies(b).find((e) => e.at[0] === 4 && e.at[1] === 10)!;
    const attack = menuAt(b, 'frederick', [3, 10]).find((a) => a.command.kind === 'attack' && a.command.target === myrmidon.id);
    expect(attack).toMatchObject({ unit: 'frederick', switched: true, from: [1, 13], to: [3, 10] });
    // Said in the game's order: the lead moves, then Switch, then the back's command.
    expect(actionText(b, attack!)).toBe('Lissa → (3,10), Switch (Frederick leads): Attack Myrmidon (Silver Lance)');
    // The menu is the lead's reach too: nothing at a tile only the back could reach.
    expect(menuAt(b, 'frederick', [4, 9])).toEqual([]);
    // A back with less Mov than its lead gets its whole menu wherever the lead can take the pair: Frederick (7) carries
    // Lissa (5, 6 leading) from (1,13) to (8,13), 7 away.
    const carried = prologueBoard({ frederick: [1, 13] }, { frederick: 'lissa' });
    expect(actingTiles(carried, 'lissa').has(tileKey([8, 13]))).toBe(true);
    expect(menuAt(carried, 'lissa', [8, 13]).some((a) => a.command.kind === 'wait' && a.switched)).toBe(true);
    // Attempt 3's T1, within the lead's reach, is still offered: Robin (5, 6 with Frederick behind) takes the pair from
    // (4,14) to (8,12), then Switch, and Frederick attacks the Myrmidon on (9,12).
    const a3 = prologueBoard({}, { robin: 'frederick' });
    const east = liveEnemies(a3).find((e) => e.at[0] === 9 && e.at[1] === 12)!;
    expect(menuAt(a3, 'frederick', [8, 12]).find((a) => a.command.kind === 'attack' && a.command.target === east.id)).toMatchObject({ switched: true, from: [4, 14] });
    // The solver never offers the move the game forbids.
    const t1 = solvePositions(b, { turns: 1 }).turns[0]!.actions;
    expect(t1.some((a) => a.switched && sameTile(a.to, [4, 9]))).toBe(false);
  });

  it('a staff reaches a pair’s lead only, never its back', () => {
    // Robin carries a hurt Frederick on (3,12); Lissa on (2,12), next to them.
    let b = prologueBoard({ robin: [3, 12], lissa: [2, 12] }, { robin: 'frederick' });
    b = { ...b, players: b.players.map((p) => (p.id === 'frederick' ? { ...p, hp: 16 } : p)) };
    expect(menuAt(b, 'lissa', [2, 12]).some((a) => a.command.kind === 'heal')).toBe(false);
    // Hurt the lead too: the heal is on Robin.
    b = { ...b, players: b.players.map((p) => (p.id === 'robin' ? { ...p, hp: 10 } : p)) };
    // Without a trade first (a trade before the heal is offered too, #283).
    const heals = menuAt(b, 'lissa', [2, 12]).filter((a) => a.command.kind === 'heal' && !a.trade);
    expect(heals.map((a) => (a.command as { target: string }).target)).toEqual(['robin']);
  });
});
