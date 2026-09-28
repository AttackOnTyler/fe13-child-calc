import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAP_PREMONITION, TERRAIN } from '../../../src/game-data/maps';
import { capture } from './capture';

// A throwaway Lunatic file bookmarked on the Premonition's turn 1 (Robin with the default HP asset / Luck flaw).
const bookmark = new Uint8Array(readFileSync(join(__dirname, '../save/fixtures/premonition-bookmark.Temporary')));
const terrainAt = (x: number, y: number) => TERRAIN.find((t) => t.char === MAP_PREMONITION.rows[y][x]);

describe('Premonition capture', () => {
  const instances = capture('premonition', 'lunatic', bookmark);

  it("places every unit where the ROM's placement data puts it", () => {
    const romStarts = MAP_PREMONITION.spawns.filter((s) => s.difficulties.includes('lunatic')).map((s) => s.to.join(','));
    expect(instances.map((i) => `${i.x},${i.y}`).sort()).toEqual([...romStarts].sort());
  });

  it("links Validar to the chapter data's Lunatic group, agreeing on HP", () => {
    const validar = instances.find((i) => i.team === 'enemy');
    expect(validar).toMatchObject({ class: 'Sorcerer (M)', level: 5, currentHp: 39, groupRef: 0, differs: {}, items: ["Grima's Truth"] });
  });

  it('stands Chrom on Floor, as the game\'s terrain window shows', () => {
    expect(terrainAt(2, 5)?.name).toBe('Floor');
  });

  it('reads the HP asset into Robin: 43 HP, FEW\'s "43 if asset"', () => {
    expect(instances.find((i) => i.class === 'Tactician (M)')?.currentHp).toBe(43);
  });
});
