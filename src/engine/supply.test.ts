import { describe, expect, it } from 'vitest';
import { createEngine, foesOf, itemByName, openStock, promotionAdvice, SEAL_RULES, sealAvailability, sealsHeld, type DeployCandidate } from './index';

const engine = createEngine();
const map = (id: string) => engine.maps().find((m) => m.id === id)!;
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const noPool = () => [];
const cand = (name: string, cls: string, s: ReturnType<typeof stats>, weapons: string[]): DeployCandidate => {
  const ws = weapons.map((n) => ({ item: itemByName(n)! }));
  return { unit: name as never, fighter: { name, className: cls, stats: s, skills: [], weapon: ws[0] }, weapons: ws, supports: [] };
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
  });

  it('sends Second Seals to whichever of the Mila Tree, Great Gate, Mercenary Fortress or Manor of Lost Souls armories is open (#153)', () => {
    const plus = (id: string) => new Set([...upTo('chapter-13'), id]);
    for (const [p, where] of [['paralogue-6', 'Great Gate'], ['paralogue-10', 'Mercenary Fortress'], ['paralogue-16', 'Manor of Lost Souls']] as const) {
      const s = sealAvailability(plus(p));
      expect(s.second).toBe('armory');
      expect(s.note).toContain(`Second Seals: in the ${where} armory.`);
      expect(s.note).not.toContain('Mila Tree');
    }
    const ch16 = sealAvailability(upTo('chapter-16'));
    expect(ch16.second).toBe('armory');
    expect(ch16.note).toContain('Second Seals: in the Mila Tree armory.');
    const ch12 = sealAvailability(upTo('chapter-12'));
    expect(ch12.second).toBe('merchant');
    expect(ch12.note).toContain('after Chapter 16, or Paralogue 6, 10 or 16');
    expect(sealAvailability(new Set()).note).toContain('Second Seals: from an armory after Chapter 16, or Paralogue 6, 10 or 16.');
  });

  it('lists exactly the armories the chapter data says sell Second Seals (#153)', () => {
    const selling = engine.maps().filter((m) => m.shop?.armory.some((a) => a.item === 'Second Seal'));
    expect(SEAL_RULES.secondSeal.armories.map((a) => a.after).sort()).toEqual(selling.map((m) => m.id).sort());
    for (const a of SEAL_RULES.secondSeal.armories) expect(map(a.after).shop!.location.replace(/^The /, '')).toBe(a.location);
  });

  it('counts held seals', () => {
    expect(sealsHeld([{ item: 'Master Seal', uses: 1 }, { item: 'Master Seal', uses: 1 }, { item: 'Iron Sword', uses: 40 }])).toEqual({ master: 2, second: 0 });
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
