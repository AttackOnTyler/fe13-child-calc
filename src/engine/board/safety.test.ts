/** The hard line's safety checker on the Lunatic Prologue (#264). */
import { describe, expect, it } from 'vitest';
import { liveEnemies, withEnemy, withPieces, type Board } from './board';
import { prologueBoard } from './prologue-fixture';
import { counterOn, safety } from './safety';

const at = (b: Board, x: number, y: number) => liveEnemies(b).find((e) => e.at[0] === x && e.at[1] === y)!;
const unit = (b: Board, id: string) => b.players.find((p) => p.id === id)!;
const kill = (b: Board, x: number, y: number) => withEnemy(b, { ...at(b, x, y), hp: 0 });

describe('the safety checker (#264)', () => {
  it('flags Lissa at (2,12) on attempt 1’s EP3: the Elwind Mage doubles her, 24 against 17', () => {
    // After T3: the south is down to the Elwind Mage, which EP2 brought within reach; Robin back at (2,14).
    let b = prologueBoard({ frederick: [4, 12], lissa: [2, 12], robin: [2, 14] }, { frederick: 'chrom' });
    b = withPieces(b, b.players, b.enemies.filter((e) => e.boss || e.group === 1 || (e.at[0] === 10 && e.at[1] === 6)));
    b = withEnemy(b, { ...at(b, 10, 6), at: [5, 9] });
    const s = safety(b);
    const lissa = s.units.find((u) => u.unit === 'lissa')!;
    expect(lissa).toMatchObject({ dies: true, hp: 17, total: 24 });
    expect(lissa.threats.map((t) => t.name)).toEqual(['Mage']);
    expect(s.safe).toBe(false);
    // Robin at (2,14) is out of the Mage's reach.
    expect(s.units.find((u) => u.unit === 'robin')).toMatchObject({ dies: false, total: 0 });
  });

  it('reads the prototype’s forward T1 as safe: Frederick + Chrom kill the (4,10) Myrmidon from (5,10), Robin (2,14), Lissa (3,13)', () => {
    const b0 = prologueBoard({ frederick: [5, 10], robin: [2, 14], lissa: [3, 13] }, { frederick: 'chrom' });
    const myrm = at(b0, 4, 10);
    // The attack: its counter can't kill (the Myrmidon deals Frederick 0).
    expect(counterOn(b0, unit(b0, 'frederick'), myrm, [5, 10])).toMatchObject({ lethal: false, countered: true, counter: 0 });
    const s = safety(kill(b0, 4, 10), [{ unit: 'frederick', enemy: myrm.id, from: [5, 10] }]);
    expect(s.safe).toBe(true);
    const fred = s.units.find((u) => u.unit === 'frederick')!;
    expect(fred.total).toBeLessThan(28);
    expect(fred.threats.length).toBeGreaterThan(1);
    expect(s.units.filter((u) => u.unit !== 'frederick').every((u) => u.total === 0)).toBe(true);
    // Only the crits are left: a small risk, not none.
    expect(s.critRisk).toBeGreaterThanOrEqual(0);
    expect(s.critRisk).toBeLessThan(0.05);
    // The northern band isn't woken by it.
    expect(s.awake).not.toContain(at(b0, 7, 3).id);
  });

  it('Robin’s Thunder from 2 on a melee foe has no counter; his sword next to a Myrmidon does, lethal at low HP', () => {
    const b = prologueBoard({ robin: [4, 12] });
    const myrm = at(b, 4, 10);
    expect(counterOn(b, unit(b, 'robin'), myrm, [4, 12])).toEqual({ counter: 0, lethal: false, countered: false });
    const sword = unit(b, 'robin').weapons.find((w) => w.item.name === 'Bronze Sword')!;
    const near = counterOn(b, unit(b, 'robin'), myrm, [4, 11], sword);
    expect(near.countered).toBe(true);
    expect(near.lethal).toBe(near.counter >= 19);
    const low = counterOn(b, { ...unit(b, 'robin'), hp: 5 }, myrm, [4, 11], sword);
    expect(low.lethal).toBe(true);
    // A lethal counter on a planned attack breaks the line.
    const s = safety(b, [{ unit: 'robin', enemy: myrm.id, from: [4, 11], weapon: sword, hp: 5 }]);
    expect(s.lethalCounters).toHaveLength(1);
    expect(s.safe).toBe(false);
  });
});
