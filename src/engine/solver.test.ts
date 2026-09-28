import { describe, expect, it } from 'vitest';
import { createEngine, dangerFlags, foeKey, foesOf, itemByName, matchup, pairUpBonus, statValue, type Fighter, type Foe } from './index';

describe('foes’ forged weapons (#189)', () => {
  const eng = createEngine();
  const group = (items: object[]) => ({ enemies: { lunatic: [{ name: 'X', class: 'Hero', level: '10', count: '1', stats: { hp: '30', str: '10', mag: '0', skl: '10', spd: '10', lck: '0', def: '5', res: '0', mov: '6' }, items }] }, bosses: {} }) as unknown as Parameters<typeof foesOf>[0];
  const silver = itemByName('Silver Sword')!;

  it('take the forged Mt and Hit a page states, or add the forge bonus it states', () => {
    expect(foesOf(group([{ name: 'Silver Sword', forged: true, forgedTo: { mt: 15, hit: 95 } }]), 'lunatic')[0]!.weapon).toMatchObject({ name: 'Silver Sword', mt: 15, hit: 95, crit: silver.crit });
    expect(foesOf(group([{ name: 'Silver Sword', forged: true, forge: { mt: 8, hit: 20 } }]), 'lunatic')[0]!.weapon).toMatchObject({ mt: silver.mt! + 8, hit: silver.hit! + 20 });
    expect(foesOf(group([{ name: 'Silver Sword', forged: true, forge: { mt: 0, hit: 0 } }]), 'lunatic')[0]!.weapon).toBe(silver);
    expect(foesOf(group([{ name: 'Silver Sword' }]), 'lunatic')[0]!.weapon).toBe(silver);
  });

  it('arm Apotheosis’s foes with forged weapons', () => {
    const apo = eng.maps().find((m) => m.id === 'apotheosis')!;
    const general = foesOf(apo, 'lunatic').find((f) => f.className === 'General' && f.stats.str === 75)!;
    const lance = itemByName('Silver Lance')!;
    expect(general.weapon).toMatchObject({ name: 'Silver Lance', mt: lance.mt! + 8, hit: lance.hit! + 20 });
    expect(general.skills).toContain('Pavise+');
  });

  it('count a boss’s own enemy-table row once, keeping foes that only share its class and HP', () => {
    const apo = eng.maps().find((m) => m.id === 'apotheosis')!;
    const wave1 = foesOf({ ...apo, enemies: { lunatic: apo.enemies.lunatic!.filter((g) => g.wave === 'Wave 1') }, bosses: { lunatic: apo.bosses.lunatic!.filter((b) => b.wave === 'Wave 1') } }, 'lunatic');
    // The boss General (Str 75), the four other Generals (Str 60) and the two War Clerics: all 80 HP.
    expect(wave1.map((f) => `${f.className} ${f.count}${f.boss ? ' boss' : ''}`)).toEqual(['General 1 boss', 'General 4', 'War Cleric 2']);
  });
});

const engine = createEngine();
const map = (id: string) => engine.maps().find((m) => m.id === id)!;
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const weapon = (name: string, forge?: { mt: number; hit: number; crit: number }) => ({ item: itemByName(name)!, ...(forge ? { forge } : {}) });
const frederick: Fighter = { name: 'Frederick', className: 'Great Knight', stats: stats(28, 13, 2, 12, 10, 6, 14, 3), skills: [], weapon: weapon('Silver Lance') };

describe('skills in the combat math (realism pass)', () => {
  // Hits 90% either way, no doubling (clamped at 0 and 100 like the game).
  const mid = stats(30, 10, 0, 10, 10, 10, 5, 5);
  const swordsman = (skills: string[] = []): Fighter => ({ name: 'Swordsman', className: 'Myrmidon', stats: mid, skills, weapon: weapon('Iron Sword') });
  const foe = (skills: string[] = [], w = 'Iron Lance'): Foe => ({ name: 'Foe', className: 'Soldier', count: 1, stats: mid, weapon: itemByName(w), skills, boss: false });

  it('adds a faire’s +5 to the lead’s hits with its kind, and to the foe’s', () => {
    const plain = matchup(swordsman(), undefined, null, foe());
    expect(matchup(swordsman(['Swordfaire']), undefined, null, foe()).damage).toBe(plain.damage + 5);
    expect(matchup(swordsman(['Lancefaire']), undefined, null, foe()).damage).toBe(plain.damage);
    expect(matchup(swordsman(), undefined, null, foe(['Lancefaire'])).worstHit).toBe(plain.worstHit + 5);
  });

  it('adds a breaker’s +50 Hit and Avoid against its kind, and the hit and avoid skills', () => {
    const plain = matchup(swordsman(), undefined, null, foe());
    const breaker = matchup(swordsman(['Lancebreaker']), undefined, null, foe());
    expect([breaker.hit, breaker.foeHit]).toEqual([Math.min(100, plain.hit + 50), Math.max(0, plain.foeHit - 50)]);
    const broken = matchup(swordsman(), undefined, null, foe(['Swordbreaker']));
    expect([broken.hit, broken.foeHit]).toEqual([Math.max(0, plain.hit - 50), Math.min(100, plain.foeHit + 50)]);
    // Against another kind, nothing.
    expect(matchup(swordsman(['Axebreaker']), undefined, null, foe()).hit).toBe(plain.hit);
    expect(matchup(swordsman(['Hit Rate +20']), undefined, null, foe()).hit).toBe(Math.min(100, plain.hit + 20));
    expect(matchup(swordsman(['Avoid +10']), undefined, null, foe()).foeHit).toBe(Math.max(0, plain.foeHit - 10));
    expect(matchup(swordsman(), undefined, null, foe(['Avoid +10'])).hit).toBe(Math.max(0, plain.hit - 10));
  });
});

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
    // Worst hit: Orton's Str 18 + Tomahawk's Mt + his axe's rank-A Atk +1 + the triangle's +1 over a lance (#250) − Frederick's Def 14.
    expect(m.worstHit).toBe(18 + itemByName('Tomahawk')!.mt! + 1 + 1 - 14);
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

  it('gives Dual Guard from both units’ Def or Res by support, and the back’s own dual strike hit and damage (#181)', () => {
    const back: Fighter = { name: 'Stahl', className: 'Cavalier', stats: stats(30, 20, 0, 15, 12, 6, 15, 2), skills: [], weapon: weapon('Steel Sword') };
    const axe: Foe = { name: 'Fighter', className: 'Fighter', count: 1, stats: stats(40, 15, 0, 10, 8, 2, 7, 1), weapon: itemByName('Iron Axe'), skills: [], boss: false };
    const tome: Foe = { ...axe, name: 'Mage', className: 'Mage', stats: { ...axe.stats, mag: 15 }, weapon: itemByName('Fire') };
    // SF Dual System: (both Def or Res) / 4 + 0/2/5/7/10 by support, +10 with Dual Guard+.
    expect(matchup(frederick, back, 'A', axe).dualGuardRate).toBe(Math.floor((14 + 15) / 4 + 7));
    expect(matchup(frederick, back, null, tome).dualGuardRate).toBe(Math.floor((3 + 2) / 4));
    expect(matchup(frederick, { ...back, skills: ['Dual Guard+'] }, 'S', axe).dualGuardRate).toBe(Math.floor((14 + 15) / 4 + 10 + 10));
    expect(matchup(frederick, undefined, null, axe).dualGuardRate).toBe(0);
    const m = matchup(frederick, back, 'A', axe);
    // The Steel Sword's C rank adds 1 Attack (#239).
    expect(m.backDamage).toBe(20 + itemByName('Steel Sword')!.mt! + 1 - 7);
    expect(m.backHit).toBe(Math.min(100, Math.floor(itemByName('Steel Sword')!.hit! + (15 * 3 + 6) / 2 + 5 - (8 * 3 + 2) / 2)));
    expect(m.backCrit).toBe(Math.max(0, Math.floor((itemByName('Steel Sword')!.crit ?? 0) + 15 / 2 - 2)));
    // Frederick doesn't double; the Fighter strikes once a round.
    expect(m.foeStrikes).toBe(1);
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

describe('review fixes: dragonstones fall under Aegis+', () => {
  it('halves a dragonstone for Aegis+, not Pavise+', () => {
    const nowi: Fighter = { name: 'Nowi', className: 'Manakete', stats: stats(30, 12, 5, 8, 8, 10, 12, 10), skills: [], weapon: weapon('Dragonstone') };
    const foe = (skills: string[]): Foe => ({ name: 'F', className: 'Fighter', count: 1, stats: stats(40, 10, 0, 5, 5, 0, 6, 0), weapon: itemByName('Iron Axe'), skills, boss: false });
    const plain = matchup(nowi, undefined, null, foe([]));
    expect(matchup(nowi, undefined, null, foe(['Aegis+'])).damage).toBe(Math.floor(plain.damage / 2));
    expect(matchup(nowi, undefined, null, foe(['Pavise+'])).damage).toBe(plain.damage);
  });
});

describe('weapon rank bonuses (#239: the Premonition, observed in play)', () => {
  // The chapter data's Premonition units against its Lunatic Validar; the game's forecast (play log P01-T2a) shows
  // Chrom's Silver Sword at 18 damage, one hit at 94, and Validar's Grima's Truth at 21 damage and 82 hit.
  const premonition = map('premonition');
  const recruit = (name: string) => premonition.recruits.find((r) => r.unit === name)!;
  const chrom: Fighter = { name: 'Chrom', className: 'Lord', stats: Object.fromEntries(Object.entries(recruit('Chrom').stats!).map(([k, v]) => [k, statValue(v)])) as Fighter['stats'], skills: [], weapon: weapon('Silver Sword') };
  // Robin (M, +Str −Def): the play log's on-screen stats.
  const robin: Fighter = { name: 'Robin', className: 'Tactician', stats: stats(38, 18, 14, 15, 13, 16, 14, 17), skills: [], weapon: weapon('Thoron') };
  const validar = foesOf(premonition, 'lunatic')[0]!;

  it('reproduces the game’s forecast apart: one hit of 18 at 94, and Validar’s 21 at 82', () => {
    const r = matchup(chrom, undefined, null, validar);
    expect({ damage: r.damage, hits: r.hits, doubles: r.doubles, hit: r.hit, worstHit: r.worstHit, worstRound: r.worstRound, foeHit: r.foeHit, oneRounds: r.oneRounds }).toEqual({
      damage: 18,
      hits: 1,
      doubles: false,
      hit: 94,
      worstHit: 21,
      worstRound: 21,
      foeHit: 82,
      oneRounds: false,
    });
  });

  it('adds Attack and Hit by weapon kind and rank (SF Calculations): a sword’s B is +2 Atk; a tome’s A is +2 Atk, +5 Hit', () => {
    const plain = { ...chrom, weapon: weapon('Iron Sword') };
    const bronze = { ...chrom, weapon: weapon('Bronze Sword') };
    // Iron (D) and Bronze (E) Swords add nothing; the Silver Sword (B) adds 2 beyond its 6 more Mt.
    expect(matchup(chrom, undefined, null, validar).damage - matchup(plain, undefined, null, validar).damage).toBe(itemByName('Silver Sword')!.mt! - itemByName('Iron Sword')!.mt! + 2);
    expect(matchup(bronze, undefined, null, validar).damage).toBe(matchup(plain, undefined, null, validar).damage - (itemByName('Iron Sword')!.mt! - itemByName('Bronze Sword')!.mt!));
  });

  it('paired with Robin, Chrom doubles on Robin’s +3 Spd (18 against 13), as the together stance would', () => {
    const r = matchup(chrom, robin, null, validar);
    expect(r.doubles).toBe(true);
    // Robin's +1 Res from pair-up: Validar's hit is one less.
    expect(r.worstHit).toBe(20);
  });
});
