import { describe, expect, it } from 'vitest';
import { createEngine, dangerFlags, foeKey, foesOf, itemByName, matchup, pairUpBonus, statValue, type Fighter, type Foe } from './index';

const engine = createEngine();
const map = (id: string) => engine.maps().find((m) => m.id === id)!;
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const weapon = (name: string, forge?: { mt: number; hit: number; crit: number }) => ({ item: itemByName(name)!, ...(forge ? { forge } : {}) });
const frederick: Fighter = { name: 'Frederick', className: 'Great Knight', stats: stats(28, 13, 2, 12, 10, 6, 14, 3), skills: [], weapon: weapon('Silver Lance') };

describe('the map solver’s combat math', () => {
  it('reads FEW’s stat text at its worst for the player', () => {
    expect(statValue('16~18')).toBe(18);
    expect(statValue('37+5 (Granted by HP +5)')).toBe(42);
    expect(statValue('24')).toBe(24);
  });

  it('takes Chapter 5’s Lunatic boss from the chapter data: Orton, Tomahawk, Tantivy', () => {
    const orton = foesOf(map('chapter-5'), 'lunatic')[0]!;
    expect(orton).toMatchObject({ name: 'Orton', className: 'Wyvern Rider', boss: true, skills: ['Tantivy'] });
    expect(orton.weapon?.name).toBe('Tomahawk');
    const m = matchup(frederick, undefined, null, orton);
    // Worst hit: Orton's Str 18 + Tomahawk's Mt − Frederick's Def 14.
    expect(m.worstHit).toBe(18 + itemByName('Tomahawk')!.mt! - 14);
  });

  it('doubles at a Spd lead of exactly 5, and is doubled the same way', () => {
    const foe: Foe = { name: 'Foe', className: 'Fighter', count: 1, stats: stats(30, 10, 0, 5, 10, 0, 5, 0), weapon: itemByName('Iron Axe'), skills: [], boss: false };
    const at = (spd: number) => matchup({ ...frederick, stats: { ...frederick.stats, spd } }, undefined, null, foe);
    expect([at(15).doubles, at(14).doubles]).toEqual([true, false]);
    expect([at(5).doubled, at(6).doubled]).toEqual([true, false]);
  });

  it('triples Mt when the weapon is effective: a bow against Orton, a Beast Killer against a Cavalier', () => {
    const orton = foesOf(map('chapter-5'), 'lunatic')[0]!;
    const archer: Fighter = { ...frederick, className: 'Archer', weapon: weapon('Iron Bow') };
    const m = matchup(archer, undefined, null, orton);
    expect(m.damage).toBe(Math.max(0, 13 + itemByName('Iron Bow')!.mt! * 3 - orton.stats.def));
    expect(m.notes.join(' ')).toMatch(/effective/);
    const cav: Foe = { name: 'Cav', className: 'Cavalier', count: 1, stats: stats(30, 10, 0, 5, 5, 0, 8, 0), weapon: itemByName('Iron Lance'), skills: [], boss: false };
    expect(matchup({ ...frederick, weapon: weapon('Beast Killer') }, undefined, null, cav).damage).toBe(13 + itemByName('Beast Killer')!.mt! * 3 - 8);
  });

  it('lets dual strikes past plain Pavise but not Pavise+', () => {
    const back: Fighter = { name: 'Stahl', className: 'Cavalier', stats: stats(30, 20, 0, 15, 12, 6, 15, 2), skills: [], weapon: weapon('Steel Sword') };
    const foe = (skills: string[]): Foe => ({ name: 'Knight', className: 'Knight', count: 1, stats: stats(60, 15, 0, 10, 3, 0, 10, 0), weapon: itemByName('Iron Lance'), skills, boss: false });
    const plain = matchup(frederick, back, 'A', foe(['Pavise']));
    const plus = matchup(frederick, back, 'A', foe(['Pavise+']));
    expect(plain.notes.join(' ')).toMatch(/dual strikes get past it/);
    expect(plus.notes.join(' ')).toMatch(/Pavise\+ halves dual strikes too/);
    expect(plus.damage).toBe(Math.floor(plain.damage / 2));
    expect(plain.dualStrikeRate).toBe(Math.floor((12 + 15) / 4 + 50));
  });

  it('adds the back’s pair-up bonus by class and support (SF’s Grandmaster example)', () => {
    const avatar: Fighter = { name: 'Robin', className: 'Grandmaster', stats: stats(50, 25, 31, 27, 22, 33, 15, 19), skills: [], weapon: undefined };
    expect(pairUpBonus(avatar, 'A')).toEqual({ str: 6, mag: 7, skl: 6, spd: 6, lck: 3, def: 1, res: 1 });
  });

  it('assumes Lunatic+’s worst case, with no Counter, Aegis+ or Pavise+ before Chapter 3', () => {
    expect(engine.lunaticPlusPool(map('chapter-2'))).toEqual(['Pass', 'Hawkeye', 'Luna+', 'Vantage+']);
    const foe = foesOf(map('chapter-2'), 'lunatic')[1]!;
    const m = matchup(frederick, undefined, null, foe, engine.lunaticPlusPool(map('chapter-2')));
    expect(m.foeHit).toBe(foe.weapon ? 100 : m.foeHit);
    expect(m.notes.join(' ')).toMatch(/Luna\+/);
    const base = matchup(frederick, undefined, null, foe);
    expect(m.worstHit).toBeGreaterThanOrEqual(base.worstHit);
  });
});

describe('threats and danger flags (#120)', () => {
  const cavalier: Fighter = { name: 'Stahl', className: 'Cavalier', stats: stats(24, 9, 0, 8, 7, 6, 9, 1), skills: [], weapon: weapon('Iron Sword') };
  const knight = (skills: string[]): Foe => ({ name: 'Soldier', className: 'Soldier', count: 1, stats: stats(25, 9, 0, 6, 5, 2, 6, 0), weapon: itemByName('Beast Killer'), skills, boss: false });

  it('flag a Beast Killer against cavalry', () => {
    const flags = dangerFlags([cavalier, frederick], [knight([])]);
    expect(flags.filter((f) => f.kind === 'effective').map((f) => f.unit)).toEqual(['Stahl', 'Frederick']);
    expect(flags.find((f) => f.unit === 'Stahl')!.text).toMatch(/Beast Killer is effective/);
  });

  it('flag Counter against melee leads, a boss that doubles, and a round that kills', () => {
    const boss: Foe = { ...knight(['Counter']), name: 'Boss', boss: true, stats: stats(50, 30, 0, 20, 20, 5, 10, 5), weapon: itemByName('Steel Lance') };
    const kinds = new Set(dangerFlags([cavalier], [boss]).map((f) => f.kind));
    expect([...kinds].sort()).toEqual(['counter', 'doubles', 'kills']);
  });

  it('use the skills recorded on a Lunatic+ foe instead of the worst case', () => {
    const pool = ['Pass', 'Hawkeye', 'Luna+', 'Vantage+', 'Counter', 'Aegis+', 'Pavise+'];
    const foe = knight([]);
    expect(matchup(frederick, undefined, null, foe, pool).foeHit).toBe(100);
    const recorded = { ...foe, skills: ['Pass', 'Vantage+'] };
    expect(matchup(frederick, undefined, null, recorded, []).foeHit).toBeLessThan(100);
    expect(dangerFlags([frederick], [foe], pool, () => ['Pass']).some((f) => f.kind === 'counter')).toBe(false);
    expect(dangerFlags([frederick], [foe], pool).some((f) => f.kind === 'counter')).toBe(true);
    expect(foeKey(foe)).toBe('Soldier|Soldier|25');
  });
});
