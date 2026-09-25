import { describe, expect, it } from 'vitest';
import { FORGE, ITEMS, ITEM_DISAGREEMENTS, forgeCost, forgeProblem, forgedStats, itemByName } from './index';

const item = (name: string) => {
  const i = itemByName(name);
  if (!i) throw new Error(name);
  return i;
};

describe('weapon and item data (SF, cross-checked against FEW)', () => {
  it('lists every kind, weapons with rank, Mt, Hit, Crit, range, uses and worth', () => {
    const kinds = new Set(ITEMS.map((i) => i.kind));
    for (const k of ['sword', 'lance', 'axe', 'bow', 'tome', 'staff', 'stone', 'beaststone', 'item']) expect(kinds.has(k as never), k).toBe(true);
    expect(item('Steel Sword')).toMatchObject({ kind: 'sword', rank: 'C', mt: 8, hit: 90, crit: 0, range: '1', uses: 35, worth: 840 });
    expect(item('Physic')).toMatchObject({ kind: 'staff', rank: 'C', range: '1~Mag/2', uses: 10, worth: 1800, exp: 30 });
    expect(item('Vulnerary')).toMatchObject({ kind: 'item', uses: 3, worth: 300 });
  });

  it('knows effectiveness, brave weapons, magic swords and restrictions', () => {
    expect(item('Iron Bow').effective).toEqual(['flying']);
    expect(item('Beast Killer').effective).toEqual(['beast']);
    expect(item('Wyrmslayer').effective).toEqual(['dragon']);
    expect(item('Exalted Falchion').effective).toEqual(['fell dragon', 'dragon']);
    expect(item('Rapier').effective).toEqual(['armored', 'beast']);
    expect(item('Brave Sword').brave).toBe(true);
    expect(item('Levin Sword').magic).toBe(true);
    expect(item('Longbow').only).toBe('Archer and Sniper');
  });

  it('forges by SF’s rules: Steel Sword +2 Mt, +15 Hit, +3 Crit costs 4,200G', () => {
    const steel = item('Steel Sword');
    expect(forgeCost(steel, { mt: 2, hit: 3, crit: 1 })).toBe(4200);
    expect(forgeCost(steel, { mt: 3, hit: 3, crit: 1 }, { mt: 2, hit: 3, crit: 1 })).toBe(1260);
    expect(forgedStats(steel, { mt: 5, hit: 3, crit: 0 })).toEqual({ mt: 13, hit: 105, crit: 0 });
    expect(forgedStats(item('Killing Edge'), { mt: 0, hit: 0, crit: 5 }).crit).toBe(45);
    expect(forgedStats({ ...item('Killing Edge'), crit: 40 }, { mt: 0, hit: 0, crit: 5 }).crit).toBe(FORGE.maxCrit);
    expect(forgeProblem(steel, { mt: 5, hit: 3, crit: 1 })).toMatch(/8 intervals/);
    expect(forgeProblem(steel, { mt: 6, hit: 0, crit: 0 })).toMatch(/0–5/);
    expect(forgeProblem(item('Mire'), { mt: 1, hit: 0, crit: 0 })).toMatch(/can’t be forged/);
    expect(item('Falchion').forgeable).toBe(false);
  });

  it('records where SF and FEW disagree, using SF', () => {
    expect(ITEM_DISAGREEMENTS.map((d) => d.id)).toEqual(['I1', 'I2', 'I3', 'I4']);
    expect(item('Rapier').worth).toBe(1600);
  });
});
