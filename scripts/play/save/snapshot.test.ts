import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseChapter } from './chapter';
import { decompressSave } from './huffman';
import { appClass, appUnit, finalStats } from './snapshot';

// A new Normal/Casual file saved at the Prologue prompt: Robin (M), asset Mag, flaw Def.
const fixture = new Uint8Array(readFileSync(join(__dirname, 'fixtures/prologue-robin.Chapter')));

describe('Chapter save snapshot', () => {
  const save = parseChapter(decompressSave(fixture));
  const robin = save.groups[5][0];

  it('decompresses to the length the PMOC header states', () => {
    expect(decompressSave(fixture).length).toBe(7403);
  });

  it('reads Robin from the logbook with class, level, EXP and skills', () => {
    expect(robin).toMatchObject({ unit: 'Avatar (M)', className: 'Tactician (M)', level: 1, exp: 0, currentHp: 19 });
    expect(robin.logbook).toEqual({ name: 'Robin', asset: 3, flaw: 7 });
    expect(robin.equippedSkills).toEqual(['Veteran']);
    expect(save.gold).toBe(0);
  });

  it("matches the game's own stat screen (Prologue, observed in Azahar 2026-09-27)", () => {
    // Str 6 Mag 7 Skl 5 Spd 6 Lck 4 Def 5 Res 4, HP 19/19: Tactician bases + Robin additions, asset Mag +2, flaw Def -1.
    expect(finalStats(robin).stats).toEqual({ hp: 19, str: 6, mag: 7, skl: 5, spd: 6, lck: 4, def: 5, res: 4 });
  });

  it("maps the save's names onto the app's ids", () => {
    expect(appUnit('Avatar (F)')).toBe('robin');
    expect(appUnit("Lon'qu")).toBe('lonqu');
    expect(appClass('Mercenary (F)')).toEqual({ id: 'mercenary', gender: 'F' });
    expect(appClass('War Cleric')).toEqual({ id: 'war-monk', gender: null });
  });
});
