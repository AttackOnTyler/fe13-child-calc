import { describe, expect, it } from 'vitest';
import { createEngine, foesOf, itemByName, openStock, promotionAdvice, sealAvailability, sealsHeld, supplyList, type DeployCandidate } from './index';

const engine = createEngine();
const map = (id: string) => engine.maps().find((m) => m.id === id)!;
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const noPool = () => [];
const cand = (name: string, cls: string, s: ReturnType<typeof stats>, weapons: string[]): DeployCandidate => {
  const ws = weapons.map((n) => ({ item: itemByName(n)! }));
  return { unit: name as never, role: 'lead', fighter: { name, className: cls, stats: s, skills: [], weapon: ws[0] }, weapons: ws, supports: [] };
};
const upTo = (id: string) => new Set(engine.maps().filter((m) => m.kind === 'story' && m.order <= map(id).order).map((m) => m.id));

describe('stock and seals (#122)', () => {
  it('sells only what cleared maps’ armories have opened', () => {
    expect(openStock(new Set()).armory).toEqual([]);
    const s = openStock(upTo('chapter-5'));
    expect(s.armory.map((a) => a.item)).toContain('Iron Sword');
    expect(s.forge).toBe(true);
  });

  it('finds Master Seals in an armory from Chapter 12, Second Seals from Chapter 16, merchants before', () => {
    expect(sealAvailability(new Set())).toMatchObject({ master: 'none', second: 'none' });
    expect(sealAvailability(upTo('chapter-3')).master).toBe('merchant');
    expect(sealAvailability(upTo('chapter-11')).master).toBe('merchant');
    expect(sealAvailability(upTo('chapter-12'))).toMatchObject({ master: 'armory', second: 'merchant' });
    expect(sealAvailability(upTo('chapter-16'))).toMatchObject({ master: 'armory', second: 'armory' });
    expect(sealsHeld([{ item: 'Master Seal', uses: 1 }, { item: 'Master Seal', uses: 1 }, { item: 'Iron Sword', uses: 40 }])).toEqual({ master: 2, second: 0 });
  });
});

describe('the supply list (#122)', () => {
  const foes = foesOf(map('chapter-5'), 'normal');
  const weak = cand('Stahl', 'Cavalier', stats(24, 8, 0, 8, 7, 5, 8, 1), ['Bronze Sword']);
  const stock = openStock(upTo('chapter-4')).armory;

  it('never spends more than the gold, and buys only what’s in stock', () => {
    for (const gold of [0, 500, 1000, 3000, 20000]) {
      const list = supplyList({ leads: [{ c: weak, back: undefined, support: null }], foes, pool: noPool, stock, forge: true, gold });
      expect(list.reduce((a, s) => a + s.cost, 0)).toBeLessThanOrEqual(gold);
      for (const s of list.filter((x) => x.action === 'buy')) expect(stock.some((a) => a.item === s.item)).toBe(true);
      for (const s of list) expect(s.closes).toBeGreaterThan(0);
    }
    expect(supplyList({ leads: [{ c: weak, back: undefined, support: null }], foes, pool: noPool, stock, forge: true, gold: 0 })).toEqual([]);
  });

  it('forges nothing when no armory is open', () => {
    const list = supplyList({ leads: [{ c: weak, back: undefined, support: null }], foes, pool: noPool, stock: [], forge: false, gold: 99999 });
    expect(list).toEqual([]);
  });
});

describe('promotions (#122)', () => {
  it('advises now or later against the map, with expected stats labelled as expected', () => {
    const unit = cand('Stahl', 'Cavalier', stats(30, 12, 0, 12, 10, 8, 11, 2), ['Steel Sword']);
    const foes = foesOf(map('chapter-12'), 'normal');
    const seals = sealAvailability(upTo('chapter-12'));
    const a = promotionAdvice({ c: unit, level: 12, promoted: false, gender: 'M', personalGrowths: undefined, foes, pool: noPool, seals, held: 0 })!;
    expect(['now', 'later']).toContain(a.advice);
    expect(['Paladin', 'Great Knight']).toContain(a.to);
    expect(a.expected).toBeDefined();
    expect(promotionAdvice({ c: unit, level: 5, promoted: false, gender: 'M', personalGrowths: undefined, foes, pool: noPool, seals, held: 1 })!.advice).toBe('not yet');
    expect(promotionAdvice({ c: { ...unit, fighter: { ...unit.fighter, className: 'Paladin' } }, level: 5, promoted: true, gender: 'M', personalGrowths: undefined, foes, pool: noPool, seals, held: 1 })).toBeUndefined();
  });
});
