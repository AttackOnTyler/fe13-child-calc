/**
 * The combat math against the game's own forecasts (#250, #249; research #255, `docs/research/fe13-combat-bonuses.md`
 * on `research/fe13-combat-bonuses`): every number here is a Lunatic Prologue forecast screen from the play log
 * (`docs/play-log/p02-prologue.md` on `play/azahar-harness`).
 */
import { describe, expect, it } from 'vitest';
import { bestWeapon, createEngine, foesOf, itemByName, matchup, type Fighter, type Foe } from './index';

const engine = createEngine();
const prologue = engine.maps().find((m) => m.id === 'prologue')!;
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const weapon = (name: string) => ({ item: itemByName(name)! });

// The Lunatic foes as the game showed them: rank A, and none of the groups' random skills rolled (the Myrmidon's
// Avoid is 23, not 33; the Barbarians' Hit shows no Gamble). Garrick's Gamble is his own.
const foes = foesOf(prologue, 'lunatic');
const rolled = (f: Foe): Foe => ({ ...f, skills: f.boss ? f.skills : [] });
const foe = (weapon: string, boss = false) => rolled(foes.find((f) => f.weapon?.name === weapon && f.boss === boss)!);
const garrick = foe('Short Axe', true);
const myrmidon = foe('Iron Sword');
const barbarian = foe('Iron Axe');
const elwind = foe('Elwind');
const elthunder = foe('Elthunder');

const chrom: Fighter = { name: 'Chrom', className: 'Lord', stats: stats(20, 7, 1, 8, 8, 5, 7, 1), skills: ['Dual Strike+', 'Charm'], weapon: weapon('Falchion') };
const fred1: Fighter = { name: 'Frederick', className: 'Great Knight', stats: stats(28, 13, 2, 12, 10, 6, 14, 3), skills: ['Discipline', 'Outdoor Fighter'], weapon: weapon('Silver Lance') };
const fred2: Fighter = { ...fred1, stats: stats(29, 14, 2, 13, 11, 6, 14, 4) };
const robin: Fighter = { name: 'Robin', className: 'Tactician', stats: stats(19, 6, 5, 5, 5, 4, 5, 3), skills: ['Veteran'], weapon: weapon('Thunder') };
const lissa: Fighter = { name: 'Lissa', className: 'Cleric', stats: stats(17, 1, 5, 4, 4, 8, 3, 4), skills: ['Miracle'], weapon: undefined };
const outdoors = { outdoors: true };

/** Frederick leading Chrom (no support), outdoors, against a foe: his side and the foe's. */
const fred = (f: Fighter, x: Foe, adjacent: readonly null[] = []) => matchup(f, chrom, null, x, [], true, { ...outdoors, adjacent });
const row = (m: ReturnType<typeof matchup>) => ({ damage: m.damage, hit: m.hit, crit: m.crit, foeDamage: m.worstHit, foeHit: m.foeHit, foeCrit: m.foeCrit });

describe('the game’s Prologue forecasts (#250, research #255)', () => {
  it('reads every Lunatic foe at weapon rank A', () => {
    expect(foes.every((f) => f.rank === 'A')).toBe(true);
    expect(foesOf(prologue, 'normal').some((f) => f.rank)).toBe(false);
  });

  it('Frederick against a sword gains the triangle’s Atk (B rank): 27 on the Myrmidon, 100%, and its 0 at 72%', () => {
    expect(row(fred(fred1, myrmidon))).toMatchObject({ damage: 27, hit: 100, crit: 0, foeDamage: 0, foeHit: 72, foeCrit: 0 });
  });

  it('Frederick against a tome: 27 on both Mages; the Elwind Mage 13 at 82%, the Elthunder Mage 15 at 62% (Chrom’s Lck takes its crit to 0)', () => {
    expect(row(fred(fred1, elwind))).toMatchObject({ damage: 27, hit: 100, crit: 0, foeDamage: 13, foeHit: 82, foeCrit: 0 });
    expect(row(fred(fred1, elthunder))).toMatchObject({ damage: 27, hit: 100, foeDamage: 15, foeHit: 62, foeCrit: 0 });
  });

  it('Frederick against an A-rank axe loses his rank bonus and the triangle’s Atk: 24 at 86% (Lv 1), 25 at 88% (Lv 2)', () => {
    expect(row(fred(fred1, barbarian))).toMatchObject({ damage: 24, hit: 86, crit: 1, foeDamage: 6 });
    expect(row(fred(fred2, barbarian))).toMatchObject({ damage: 25, hit: 88, crit: 1, foeDamage: 6, foeHit: 75, foeCrit: 0 });
  });

  it('an adjacent ally on top of Chrom stacks Dual Support to rank 2: Avoid +10, so the Barbarian’s 76% reads 66%', () => {
    expect(fred(fred1, barbarian).foeHit).toBe(76);
    expect(fred(fred1, barbarian, [null]).foeHit).toBe(66);
  });

  it('Garrick (Lv 2 Frederick): 23 at 84%, and his 9 at 64% with Gamble’s 5% crit', () => {
    expect(row(fred(fred2, garrick))).toMatchObject({ damage: 23, hit: 84, crit: 1, foeDamage: 9, foeHit: 64, foeCrit: 5 });
    // At Lv 1 the game would show 22 (the app read 24 before #250).
    expect(fred(fred1, garrick).damage).toBe(22);
  });

  it('Dual Strike 35% and Dual Guard 5% (1% against magic) for Frederick with Chrom', () => {
    expect(fred(fred1, myrmidon).dualStrikeRate).toBe(35);
    expect(fred(fred1, myrmidon).dualGuardRate).toBe(5);
    expect(fred(fred1, elwind).dualGuardRate).toBe(1);
  });

  it('Robin’s Thunder with Lissa adjacent: 8 at 83%, 2% crit; no Dual Strike (her staff), Dual Guard 2%', () => {
    const m = matchup(robin, lissa, null, barbarian, [], false, outdoors);
    expect({ damage: m.damage, hit: m.hit, crit: m.crit, ds: m.dualStrikeRate, dg: m.dualGuardRate }).toEqual({ damage: 8, hit: 83, crit: 2, ds: 0, dg: 2 });
  });
});

describe('attacks from out of the foe’s reach (#249)', () => {
  it('Thunder from 2 on a melee foe has no counter; the sword is countered', () => {
    // Garrick's Short Axe reaches 2 (his row is below); the Myrmidon and the Barbarian are melee.
    for (const f of [myrmidon, barbarian]) {
      const m = matchup(robin, undefined, null, f);
      expect({ range: m.range, countered: m.countered, counterRound: m.counterRound }).toEqual({ range: 2, countered: false, counterRound: 0 });
      // The enemy phase still hurts: the foe walks up and strikes.
      expect(m.worstRound).toBeGreaterThan(0);
    }
    const sword = matchup({ ...robin, weapon: weapon('Bronze Sword') }, undefined, null, myrmidon);
    expect({ range: sword.range, countered: sword.countered }).toEqual({ range: 1, countered: true });
    expect(sword.counterRound).toBe(sword.worstRound);
  });

  it('Garrick’s Short Axe reaches 2, so Thunder is countered there', () => {
    expect(matchup(robin, undefined, null, garrick)).toMatchObject({ countered: true });
    // Both weapons are countered: the pick falls to damage, then hit.
    const both = [weapon('Bronze Sword'), weapon('Thunder')];
    const pick = bestWeapon({ ...robin, weapon: both[0] }, both, undefined, null, garrick, [])!;
    expect(pick.result.countered).toBe(true);
  });

  it('picks Thunder over the Bronze Sword against the Myrmidon and the Barbarian at equal damage', () => {
    const both = [weapon('Bronze Sword'), weapon('Thunder')];
    for (const f of [myrmidon, barbarian]) expect(bestWeapon({ ...robin, weapon: both[0] }, both, undefined, null, f, [])!.weapon!.item.name).toBe('Thunder');
  });

  it('bows work the same way: no counter from 2 on a melee foe, a Mage’s tome still answers, and a bow can’t counter at 1', () => {
    const archer: Fighter = { name: 'Virion', className: 'Archer', stats: stats(20, 8, 0, 8, 8, 4, 5, 2), skills: [], weapon: weapon('Iron Bow') };
    expect(matchup(archer, undefined, null, myrmidon)).toMatchObject({ range: 2, countered: false, counterRound: 0 });
    expect(matchup(archer, undefined, null, elwind)).toMatchObject({ range: 2, countered: true });
    const bowFoe: Foe = { ...myrmidon, name: 'Archer', className: 'Archer', weapon: itemByName('Iron Bow') };
    expect(matchup(chrom, undefined, null, bowFoe)).toMatchObject({ range: 1, countered: false, counterRound: 0 });
  });
});
