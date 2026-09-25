import { describe, expect, it } from 'vitest';
import { CLASSES } from '../game-data/classes';
import { RESOLVED_DISAGREEMENTS } from '../game-data/disagreements';
import { JOIN_DATA, SPOTPASS_UNITS, basesOn } from '../game-data/join';
import { SKILLS } from '../game-data/skills';
import { ROBIN_SUPPORTS, S_SUPPORTS } from '../game-data/supports';
import { FIRST_GEN_UNITS } from '../game-data/units';

const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });

describe('join data (SF base stats and recruitment)', () => {
  it('covers every first-gen unit and Robin, in known classes with known skills', () => {
    const units = Object.keys(FIRST_GEN_UNITS).filter((u) => u !== 'maiden');
    expect(units).toHaveLength(35);
    expect(Object.keys(JOIN_DATA).sort()).toEqual([...units, 'robin'].sort());
    for (const d of Object.values(JOIN_DATA)) {
      expect(CLASSES[d.joinClass]).toBeDefined();
      for (const s of d.startingSkills) expect(SKILLS[s]).toBeDefined();
    }
  });

  it('matches SF on a sample of units', () => {
    expect(JOIN_DATA.robin).toMatchObject({ chapter: 'prologue', joinClass: 'tactician', level: 1, normal: stats(19, 6, 5, 5, 6, 4, 6, 4) });
    expect(JOIN_DATA.walhart).toMatchObject({ chapter: 'paralogue-19', joinClass: 'conqueror', level: 30, normal: stats(71, 39, 15, 33, 32, 30, 35, 19) });
    expect(JOIN_DATA.lonqu).toMatchObject({ chapter: 'chapter-4', recruit: 'End of chapter', joinClass: 'myrmidon', level: 4 });
    // Bases without the skill bonus: SF writes Virion's Skl as 9+2.
    expect(JOIN_DATA.virion.normal.skl).toBe(9);
    expect(basesOn(JOIN_DATA.tiki, 'lunatic')).toEqual(stats(49, 23, 14, 20, 22, 24, 20, 17));
    // Gregor has only a Lunatic row: Hard is Normal.
    expect(basesOn(JOIN_DATA.gregor, 'hard')).toEqual(JOIN_DATA.gregor.normal);
    expect(basesOn(JOIN_DATA.gregor, 'lunatic').hp).toBe(31);
  });

  it('keeps starting skills a unit’s class set can’t teach', () => {
    expect(JOIN_DATA.walhart.startingSkills).toContain('conquest');
    expect(JOIN_DATA.aversa.startingSkills).toContain('shadowgift');
    expect(JOIN_DATA.emmeryn.startingSkills).toEqual(expect.arrayContaining(['magic-plus-2', 'focus']));
    expect(JOIN_DATA.priam.startingSkills).toEqual(expect.arrayContaining(['swordbreaker', 'lancebreaker', 'luna']));
  });

  it('records the Olivia and Aversa disagreements as resolved, with SF’s values stored', () => {
    const ids = RESOLVED_DISAGREEMENTS.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['U1', 'U2']));
    expect(JOIN_DATA.olivia.normal.skl).toBe(8);
    expect(JOIN_DATA.aversa.normal.res).toBe(28);
    expect(basesOn(JOIN_DATA.aversa, 'lunatic').skl).toBe(36);
  });

  it('lets the SpotPass units support only Robin', () => {
    const supported = new Set(Object.entries(S_SUPPORTS).flatMap(([w, men]) => [w, ...men!]));
    for (const u of SPOTPASS_UNITS) {
      expect(supported.has(u)).toBe(false);
      expect([...ROBIN_SUPPORTS.M, ...ROBIN_SUPPORTS.F]).toContain(u);
    }
  });
});
