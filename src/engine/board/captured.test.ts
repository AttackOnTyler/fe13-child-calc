import { describe, expect, it } from 'vitest';
import { capturedMap, isOutdoors, moveCost, moveRow, onMap, terrainAt } from './captured';

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
    expect(terrainAt(prologue, [1, 3])?.name).toBe('Water');
    expect(moveCost(prologue, [1, 3], moveRow('Myrmidon'))).toBeNull();
    expect(moveCost(prologue, [1, 3], moveRow('Lord'))).toBe(5);
    expect(moveCost(prologue, [7, 3], moveRow('Myrmidon'))).toBe(1);
    expect(isOutdoors(prologue)).toBe(true);
    expect(capturedMap('premonition') && isOutdoors(capturedMap('premonition')!)).toBe(false);
  });
});

describe('the playable area: every captured map’s outer ring is off the map (#271)', () => {
  const prologue = capturedMap('prologue')!;
  const ring = (w: number, h: number) => [...Array(w).keys()].flatMap((x) => [...Array(h).keys()].map((y) => [x, y] as const)).filter(([x, y]) => x === 0 || y === 0 || x === w - 1 || y === h - 1);

  it('the Prologue plays on x 1–15, y 1–14: the ring has no terrain to enter, for anyone', () => {
    expect(onMap(prologue, [1, 1])).toBe(true);
    expect(onMap(prologue, [15, 14])).toBe(true);
    for (const t of ring(17, 16)) {
      expect(onMap(prologue, t)).toBe(false);
      for (const cls of ['Lord', 'Barbarian', 'Myrmidon', 'Great Knight']) expect(moveCost(prologue, t, moveRow(cls))).toBeNull();
    }
  });

  it('no map places a unit on its ring: units only walk in from it (the one-tile ring is the game’s, not the Prologue’s)', () => {
    const all = ['prologue', 'premonition', 'endgame', ...Array.from({ length: 25 }, (_, i) => `chapter-${i + 1}`), ...Array.from({ length: 23 }, (_, i) => `paralogue-${i + 1}`)];
    for (const id of all) {
      const m = capturedMap(id)!;
      // The script places the rest: (0,0) is the dispos' placeholder (reinforcements), and a Support recruit appears
      // where its event says (Lucina, Lon'qu at (0,0); Henry at Chapter 13's bottom edge, walking in).
      const stands = m.spawns.filter((s) => !(s.to[0] === 0 && s.to[1] === 0) && !s.faction.startsWith('Support'));
      for (const s of stands) expect(onMap(m, s.to), `${id}: ${s.faction} ${s.pid} to (${s.to})`).toBe(true);
    }
  });
});
