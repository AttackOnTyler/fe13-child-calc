import { describe, expect, it } from 'vitest';
import { combatExp, createEngine, danceExp, expFoeOf, internalLevel, mapExpFoe, secondSealCount, staffExp, type ExpFoe } from './index';

const engine = createEngine();
const fighter: ExpFoe = { level: 1, advanced: false, boss: false, classBonus: 0 };
const chief: ExpFoe = { level: 3, advanced: false, boss: true, classBonus: 0 };

describe('EXP per combat (research/exp-rules §4.1, Chapter 1 on Lunatic)', () => {
  const lunatic = { difficulty: 'lunatic' } as const;

  it('Robin kills a Risen Fighter: 30', () => {
    expect(engine.combatExp({ ...lunatic, internalLevel: 1, foe: fighter, outcome: 'kill' })).toBe(30);
  });

  it('Chrom kills the Risen Chief: 57', () => {
    expect(engine.combatExp({ ...lunatic, internalLevel: 1, foe: chief, outcome: 'kill' })).toBe(57);
  });

  it('Robin as Chrom’s back with a Dual Strike hit: 5, and Veteran doesn’t apply to a back', () => {
    expect(engine.combatExp({ ...lunatic, internalLevel: 1, foe: fighter, outcome: 'damage', pair: 'back', veteran: true })).toBe(5);
  });

  it('Robin, leading a pair with Veteran, kills a Risen Fighter: 45', () => {
    expect(engine.combatExp({ ...lunatic, internalLevel: 1, foe: fighter, outcome: 'kill', pair: 'front', veteran: true })).toBe(45);
  });

  it('a back whose Dual Strike lands the kill gets its damage EXP in full and no kill EXP: 10', () => {
    expect(engine.combatExp({ ...lunatic, internalLevel: 1, foe: fighter, outcome: 'kill', pair: 'back' })).toBe(10);
  });

  it('a hit without a kill, a miss, and Frederick’s kills far below him', () => {
    expect(engine.combatExp({ ...lunatic, internalLevel: 1, foe: chief, outcome: 'damage' })).toBe(11);
    expect(engine.combatExp({ ...lunatic, internalLevel: 1, foe: chief, outcome: 'miss' })).toBe(0);
    expect(engine.combatExp({ ...lunatic, internalLevel: 21, foe: fighter, outcome: 'kill' })).toBe(11);
    // The boss bonus is lost 13 or more levels above the boss.
    expect(engine.combatExp({ ...lunatic, internalLevel: 21, foe: chief, outcome: 'kill' })).toBe(12);
  });

  it('cuts repeat hits on one foe on Lunatic only, from the 4th engagement', () => {
    expect(engine.combatExp({ ...lunatic, internalLevel: 1, foe: chief, outcome: 'damage', engagement: 4 })).toBe(10);
    expect(engine.combatExp({ ...lunatic, internalLevel: 1, foe: chief, outcome: 'kill', engagement: 5 })).toBe(55);
    expect(engine.combatExp({ difficulty: 'lunatic-plus', internalLevel: 1, foe: chief, outcome: 'damage', engagement: 4 })).toBe(10);
    expect(engine.combatExp({ difficulty: 'hard', internalLevel: 1, foe: chief, outcome: 'damage', engagement: 4 })).toBe(11);
  });
});

describe('the EXP formula', () => {
  it('matches the research’s reference table (no bonus, first engagement)', () => {
    // [LD, damage, kill, boss kill, back]
    const rows = [
      [10, 13, 63, 83, 6], [8, 13, 57, 77, 6], [4, 11, 43, 63, 5], [0, 10, 30, 50, 5], [-1, 10, 30, 50, 5], [-3, 10, 27, 47, 5],
      [-7, 8, 15, 33, 4], [-8, 8, 15, 30, 4], [-12, 7, 14, 17, 3], [-13, 6, 13, 13, 3], [-22, 3, 10, 10, 1], [-28, 1, 8, 8, 0], [-50, 1, 8, 8, 0],
    ] as const;
    for (const [ld, damage, kill, boss, back] of rows) {
      const foe = { level: 30 + ld, advanced: false, boss: false, classBonus: 0 };
      expect([
        combatExp(30, foe, 'damage'),
        combatExp(30, foe, 'kill'),
        combatExp(30, { ...foe, boss: true }, 'kill'),
        combatExp(30, foe, 'damage', true),
      ], `LD ${ld}`).toEqual([damage, kill, boss, back]);
    }
  });

  it('counts an advanced foe 20 levels higher, with class and unit bonuses and the 100 cap', () => {
    // Base Lv 15 kills an advanced Lv 5 Hero: LD +10.
    expect(combatExp(15, expFoeOf('Hero', 5)!, 'kill')).toBe(63);
    // Advanced Lv 5 (IL 25) kills a base Lv 20 foe.
    expect(combatExp(25, expFoeOf('Fighter', 20)!, 'kill')).toBe(20);
    expect(combatExp(10, expFoeOf('Thief', 10)!, 'kill')).toBe(50);
    expect(combatExp(10, expFoeOf('Revenant', 10)!, 'kill')).toBe(100);
    expect(combatExp(10, expFoeOf('Cleric', 10)!, 'kill')).toBe(20);
    // A Deadlord (#209): the +20 unit bonus caps its class bonus (Porcus, an Assassin: min(20 + 20, 20)); the boss +20
    // on top only under the other reading of G8. Advanced Lv 15 against IL 35: LD 0, so 10 + 20 + bonus.
    expect(combatExp(35, mapExpFoe('Porcus', 'Assassin', 15, true, 'unit-only')!, 'kill')).toBe(50);
    expect(combatExp(35, mapExpFoe('Porcus', 'Assassin', 15, true, 'boss-too')!, 'kill')).toBe(70);
    // Any other foe is as the data has it.
    expect(mapExpFoe('Aversa', 'Dark Flier', 16, true, 'unit-only')).toEqual(expFoeOf('Dark Flier', 16, true));
    // An Einherjar Cleric: min(20 − 10, 20).
    expect(combatExp(10, { ...expFoeOf('Cleric', 10)!, unitBonus: 20 }, 'kill')).toBe(40);
    // Entombed are advanced as well as +80.
    expect(expFoeOf('Entombed', 1)).toMatchObject({ advanced: true, classBonus: 80 });
    expect(expFoeOf('Risen Wizard', 1)).toBeUndefined();
  });

  it('gives staves and Dance their base, falling slowly with internal level', () => {
    expect([8, 9, 10].map((il) => staffExp(il, 'Heal', 'base', 'lunatic'))).toEqual([15, 16, 16]);
    expect(staffExp(1, 'Heal', 'base', 'hard')).toBe(20);
    expect(staffExp(1, 'Heal', 'base', 'normal')).toBe(25);
    expect(staffExp(21, 'Physic', 'advanced', 'lunatic')).toBe(25);
    expect([1, 20, 30].map(danceExp)).toEqual([17, 12, 10]);
  });

  it('works the internal level out from level, tier and the Second Seal count, capped by difficulty', () => {
    expect(secondSealCount(10, 'base')).toBe(4);
    expect(secondSealCount(20, 'advanced')).toBe(19);
    expect(secondSealCount(30, 'special')).toBe(14);
    expect(internalLevel(1, 'advanced', 19, 'lunatic')).toBe(40);
    // SF’s Donnel: Bow Knight Lv 1 with a count of 24.
    expect(internalLevel(1, 'advanced', 24, 'normal')).toBe(41);
    expect(internalLevel(1, 'advanced', 24, 'hard')).toBe(45);
    expect(internalLevel(20, 'advanced', 60, 'lunatic-plus')).toBe(90);
  });
});
