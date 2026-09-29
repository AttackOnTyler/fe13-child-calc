/** The hard line's safety checker on the Lunatic Prologue (#264). */
import { describe, expect, it } from 'vitest';
import { liveEnemies, withEnemy, withPieces, type Board } from './board';
import { prologueBoard } from './prologue-fixture';
import { counterOn, priceDeaths, safety } from './safety';

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
    const risk = s.units.reduce((n, u) => n + u.deathChance, 0);
    expect(risk).toBeGreaterThanOrEqual(0);
    expect(risk).toBeLessThan(0.05);
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

describe('the tile-aware gang-up (#282)', () => {
  /** Frederick alone at (5,13), walled in by Chrom (4,13), Robin (6,13) and Lissa (5,14): only (5,12) is free for melee. */
  const choke = (firstHp: number) => {
    const b = prologueBoard({ frederick: [5, 13], chrom: [4, 13], robin: [6, 13], lissa: [5, 14] });
    const barbs = b.enemies.filter((e) => e.foe.className === 'Barbarian' && !e.boss).slice(0, 2);
    const a = { ...barbs[0]!, at: [5, 10] as const, hp: firstHp, awake: true };
    const c = { ...barbs[1]!, at: [6, 11] as const, awake: true };
    return withPieces(b, b.players, [a, c]);
  };

  it('counts only the foes that find a free tile: two Barbarians in reach, one tile open, one attacks', () => {
    const b = choke(30);
    const fred = safety(b).units.find((u) => u.unit === 'frederick')!;
    // Both reach, but Frederick's counter can't fell a 30 HP Barbarian without a crit: the first keeps the tile.
    expect(fred.threats).toHaveLength(2);
    const one = fred.threats[0]!.damage;
    expect(fred.total).toBe(one);
  });

  it('lets a second foe step in when the first dies on the counter and frees the tile', () => {
    const open = safety(choke(5)).units.find((u) => u.unit === 'frederick')!;
    const held = safety(choke(30)).units.find((u) => u.unit === 'frederick')!;
    expect(open.total).toBe(open.threats[0]!.damage + open.threats[1]!.damage);
    expect(open.total).toBeGreaterThan(held.total);
    expect(open.deathChance).toBeGreaterThanOrEqual(held.deathChance);
  });

  it('reads attempt 3’s EP6 as it went: four foes on Frederick at (9,4), 27 against 28, a death only by a crit', () => {
    // After T6: Frederick (Robin behind) killed the bridge Myrmidon from (9,4); Lissa + Chrom at (10,8). The south is gone.
    let b = prologueBoard({ frederick: [9, 4], lissa: [10, 8] }, { frederick: 'robin', lissa: 'chrom' });
    b = withPieces(b, b.players, b.enemies.filter((e) => e.boss || (e.group === 1 && !(e.at[0] === 9 && e.at[1] === 3))).map((e) => ({ ...e, awake: true })));
    const fred = safety(b).units.find((u) => u.unit === 'frederick')!;
    expect(fred).toMatchObject({ hp: 28, total: 27, dies: false });
    expect(fred.deathChance).toBeGreaterThan(0);
    expect(fred.deathChance).toBeLessThan(0.2);
  });
});

describe('pricing deaths by worth (#282)', () => {
  it('adds a planned attack’s counter to the attacker’s death chance, at true odds', () => {
    const b0 = prologueBoard({ robin: [4, 12] });
    const myrm = at(b0, 4, 10);
    // The Myrmidon alone, and asleep (it would double Robin on enemy phase): only the attack's counter can kill him.
    const b = withPieces(b0, b0.players, [{ ...myrm, awake: false, ai: { ...myrm.ai, start: 'Null' } }]);
    const sword = unit(b, 'robin').weapons.find((w) => w.item.name === 'Bronze Sword')!;
    const quiet = safety(b).units.find((u) => u.unit === 'robin')!.deathChance;
    const s = safety(b, [{ unit: 'robin', enemy: myrm.id, from: [4, 11], weapon: sword, hp: 5 }]);
    expect(s.units.find((u) => u.unit === 'robin')!.deathChance).toBeGreaterThan(quiet);
  });

  it('prices a lead’s death by its worth, and Chrom’s or Robin’s as game over', () => {
    const s = { units: [
      { unit: 'chrom', hp: 20, total: 0, threats: [], dies: false, deathChance: 0.1 },
      { unit: 'lissa', hp: 17, total: 0, threats: [], dies: false, deathChance: 0.5 },
      { unit: 'frederick', hp: 28, total: 0, threats: [], dies: false, deathChance: 0.2 },
    ], lethalCounters: [], safe: true, awake: [] };
    const p = priceDeaths(s, { lissa: 4, frederick: 10 });
    expect(p.gameOver).toBeCloseTo(0.1, 12);
    // Lissa 0.5 × 4 + Frederick 0.2 × 10; Chrom's is game over, not worth.
    expect(p.worthLost).toBeCloseTo(4, 12);
  });
});

describe('the gang-up: tiles held by foes that don’t attack (#282 review)', () => {
  it('a sleeping foe on one of two free tiles leaves room for one attacker, not two', () => {
    // Frederick at (5,13), Chrom (4,13) and Lissa (5,14) beside him: (5,12) and (6,13) are open, but a foe that sleeps
    // (Null start) holds (6,13). Two awake Barbarians reach him; Frederick's counter can't fell one without a crit.
    const b = prologueBoard({ frederick: [5, 13], chrom: [4, 13], lissa: [5, 14], robin: [1, 14] });
    const barbs = b.enemies.filter((e) => e.foe.className === 'Barbarian' && !e.boss);
    const a1 = { ...barbs[0]!, at: [5, 10] as const, awake: true };
    const a2 = { ...barbs[1]!, at: [6, 11] as const, awake: true };
    const sleeper = { ...barbs[2]!, at: [6, 13] as const, awake: false, ai: { ...barbs[2]!.ai, start: 'Null' } };
    const fred = safety(withPieces(b, b.players, [a1, a2, sleeper])).units.find((u) => u.unit === 'frederick')!;
    expect(fred.threats).toHaveLength(2);
    expect(fred.total).toBe(fred.threats[0]!.damage);
  });
});
