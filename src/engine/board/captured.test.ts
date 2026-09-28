import { describe, expect, it } from 'vitest';
import { capturedMap, isOutdoors, moveCost, moveRow, terrainAt } from './captured';

describe('captured maps carry each placement’s AI (#261)', () => {
  const prologue = capturedMap('prologue')!;
  const lunatic = prologue.spawns.filter((s) => s.team === 'enemy' && s.difficulties.includes('lunatic'));
  const at = (x: number, y: number) => lunatic.find((s) => s.at[0] === x && s.at[1] === y)!;

  it('Garrick is stationary, active from turn 1, a boss', () => {
    expect(at(8, 1)).toMatchObject({ class: 'Barbarian', ai: { start: 'Everytime', attack: 'Attack', move: 'NearestEnemy' }, group: 0, stationary: true, boss: true });
  });

  it('the northern five wait in group 1 until a player unit is in reach', () => {
    for (const [x, y] of [[7, 3], [9, 3], [8, 2], [6, 2], [10, 2]] as const) expect(at(x, y)).toMatchObject({ ai: { start: 'AttackRange' }, group: 1 });
    expect(at(8, 2).class).toBe('Mage');
    expect(at(8, 2).stationary).toBeUndefined();
  });

  it('the southern units move from enemy phase 1', () => {
    for (const [x, y] of [[10, 6], [7, 9], [4, 10], [1, 8], [9, 12]] as const) expect(at(x, y)).toMatchObject({ ai: { start: 'Everytime' }, group: 0 });
    expect(lunatic).toHaveLength(11);
  });

  it('reads terrain: water blocks a Myrmidon, costs a Lord 5, and the Prologue is outdoors', () => {
    expect(terrainAt(prologue, [0, 3])?.name).toBe('Water');
    expect(moveCost(prologue, [0, 3], moveRow('Myrmidon'))).toBeNull();
    expect(moveCost(prologue, [0, 3], moveRow('Lord'))).toBe(5);
    expect(moveCost(prologue, [7, 3], moveRow('Myrmidon'))).toBe(1);
    expect(isOutdoors(prologue)).toBe(true);
    expect(capturedMap('premonition') && isOutdoors(capturedMap('premonition')!)).toBe(false);
  });
});
