/** The widened move menu (#283): trades of any item before any command, the weapon held at the end, water drops. */
import { describe, expect, it } from 'vitest';
import { liveEnemies, playerById } from './board';
import { prologueBoard } from './prologue-fixture';
import { applyAction, menuAt, type PlannedAction } from './solve';

describe('trades, held weapons and water (#283)', () => {
  it('lets Frederick take Chrom’s Vulnerary on T1 and still attack', () => {
    // Chrom at (3,13), Frederick next to him at (3,12) after moving: the Myrmidon at (4,10) is in reach from (4,11).
    const b = prologueBoard({ chrom: [3, 12] });
    const menu = menuAt(b, 'frederick', [4, 12]);
    const take = menu.find((a) => a.trade?.with === 'chrom' && a.trade.item === 'Vulnerary' && !a.trade.give && a.command.kind === 'wait');
    expect(take).toBeDefined();
    const after = applyAction(b, take!);
    expect(playerById(after, 'frederick')!.items.some((i) => i.item === 'Vulnerary')).toBe(true);
    expect(playerById(after, 'chrom')!.items.some((i) => i.item === 'Vulnerary')).toBe(false);
    // The trade doesn't end the turn: with Chrom at (2,10), Frederick takes it at (3,10) and attacks the Myrmidon there.
    const b2 = prologueBoard({ chrom: [2, 10] });
    const myrm = liveEnemies(b2).find((e) => e.at[0] === 4 && e.at[1] === 10)!;
    const withAttack = menuAt(b2, 'frederick', [3, 10]).find((a) => a.trade?.with === 'chrom' && a.trade.item === 'Vulnerary' && a.command.kind === 'attack' && a.command.target === myrm.id);
    expect(withAttack).toBeDefined();
    const fought = applyAction(b2, withAttack!);
    expect(playerById(fought, 'frederick')!.items.some((i) => i.item === 'Vulnerary')).toBe(true);
  });

  it('never offers a locked weapon: Chrom’s Falchion and Rapier are Lord-only', () => {
    const b = prologueBoard({ chrom: [3, 12] });
    const items = menuAt(b, 'frederick', [4, 12]).flatMap((a) => (a.trade && !a.trade.give ? [a.trade.item] : []));
    expect(items).toContain('Vulnerary');
    expect(items).not.toContain('Falchion');
    expect(items).not.toContain('Rapier');
  });

  it('gives a weapon away: Robin hands Chrom his Bronze Sword', () => {
    const b = prologueBoard({ robin: [3, 14] });
    const give = menuAt(b, 'robin', [3, 14]).find((a) => a.trade?.with === 'chrom' && a.trade.give && a.trade.item === 'Bronze Sword');
    expect(give).toBeDefined();
    const after = applyAction(b, give!);
    expect(playerById(after, 'robin')!.weapons.map((w) => w.item.name)).toEqual(['Thunder']);
    expect(playerById(after, 'chrom')!.weapons.map((w) => w.item.name)).toContain('Bronze Sword');
  });

  it('ends a turn holding a chosen weapon: Chrom waits with the Rapier equipped', () => {
    const b = prologueBoard();
    const hold = menuAt(b, 'chrom', [3, 13]).find((a) => a.command.kind === 'wait' && a.equip === 'Rapier');
    expect(hold).toBeDefined();
    expect(playerById(applyAction(b, hold!), 'chrom')!.fighter.weapon?.item.name).toBe('Rapier');
  });

  it('drops Robin onto the Prologue’s water, and Robin can attack from it', () => {
    // Frederick carries Robin at (10,12), next to the water at (11,12).
    const b = prologueBoard({ frederick: [10, 12] }, { frederick: 'robin' });
    const drop = menuAt(b, 'frederick', [10, 12]).find((a) => a.command.kind === 'separate' && a.command.to[0] === 11 && a.command.to[1] === 12);
    expect(drop).toBeDefined();
    const after = applyAction(b, drop!);
    expect(playerById(after, 'robin')!.at).toEqual([11, 12]);
    // Robin on the water at (11,12) Thunders the Myrmidon at (9,12) from 2: it can't follow him there.
    const wb = prologueBoard({ robin: [11, 12] });
    const myrm = liveEnemies(wb).find((e) => e.at[0] === 9 && e.at[1] === 12)!;
    const water: PlannedAction[] = menuAt(wb, 'robin', [11, 12]);
    expect(water.some((a) => a.command.kind === 'attack' && a.command.target === myrm.id && a.command.weapon === 'Thunder')).toBe(true);
    expect(water.some((a) => a.command.kind === 'wait')).toBe(true);
  });

  it('offers a trade before a Separate and before a Pair Up', () => {
    // Frederick carries Robin: he can take Robin's Bronze Sword, then set him down.
    const b = prologueBoard({ frederick: [10, 12] }, { frederick: 'robin' });
    expect(menuAt(b, 'frederick', [10, 12]).some((a) => a.command.kind === 'separate' && a.trade?.with === 'robin' && a.trade.item === 'Bronze Sword')).toBe(true);
    // Lissa pairs onto Chrom after giving him her Vulnerary.
    const p = prologueBoard();
    const pair = menuAt(p, 'lissa', [3, 13]).find((a) => a.command.kind === 'pair' && a.trade?.with === 'chrom' && a.trade.give && a.trade.item === 'Vulnerary');
    expect(pair).toBeDefined();
    expect(playerById(applyAction(p, pair!), 'chrom')!.items.filter((i) => i.item === 'Vulnerary')).toHaveLength(2);
  });
});

describe('the action text names trades and held weapons (#283)', () => {
  it('reads "Trade (gives Chrom the Bronze Sword), then Wait, holding the Thunder"', async () => {
    const { actionText } = await import('./solve');
    const b = prologueBoard({ robin: [3, 14] });
    const a: PlannedAction = { unit: 'robin', from: [3, 14], to: [3, 14], trade: { with: 'chrom', item: 'Bronze Sword', give: true }, command: { kind: 'wait' }, equip: 'Thunder', why: '' };
    expect(actionText(b, a)).toBe('Robin stays: Trade (gives Chrom the Bronze Sword), then Wait, holding the Thunder');
  });
});
