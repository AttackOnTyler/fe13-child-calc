import { describe, expect, it } from 'vitest';
import { createEngine, itemByName, matchup, resolveAssumptions, type Fighter, type Foe, type SimFoeGroup, type SimGroup, type SimMap, type SimUnit } from './index';

/**
 * The map simulation (#181), on small hand-built chapters whose answer can be worked by hand: one unit or pair, one or
 * two foes with fixed stats, hit rates read from the map solver's matchup.
 */
const engine = createEngine();
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const weapon = (name: string) => ({ item: itemByName(name)! });

// Hits every time (Skl 60), never crits (the foe's Lck 60), doubles (Spd 40 vs 0), 10 damage a hit.
const hero: Fighter = { name: 'Hero', className: 'Myrmidon', stats: stats(20, 15, 0, 60, 40, 0, 0, 0), skills: [], weapon: weapon('Iron Sword') };
// A back with no weapon and no pair-up bonus (every stat under 10, a class with no bonus): it only guards.
const shield: Fighter = { name: 'Shield', className: 'Nobody', stats: stats(20, 0, 0, 0, 0, 0, 9, 0), skills: [], weapon: undefined };
const unit = (f: Fighter) => ({ id: f.name.toLowerCase(), fighter: f, weapons: f.weapon ? [f.weapon] : [] });
const solo = (f: Fighter): SimGroup => ({ lead: unit(f), support: null });

// 40 HP, Def 10: two of the hero's rounds. It never crits (Skl 0) and one hit kills (Str 30 + 7 vs 20 HP).
const brute: Foe = { name: 'Brute', className: 'Fighter', count: 1, stats: stats(40, 30, 0, 0, 0, 60, 10, 0), weapon: itemByName('Iron Axe'), skills: [], boss: false };
const group = (foe: Foe, more: Partial<SimFoeGroup> = {}): SimFoeGroup => ({ key: foe.name, foe, ...more });
const rout = (foes: SimFoeGroup[], waves: SimMap['waves'] = []): SimMap => ({ id: 'test', victory: 'rout', foes, waves, skipped: [] });

describe('the map simulation’s no-death chance (#181)', () => {
  it('reads 100% with no foe in reach: no foes at all, or foes with nothing to attack with', () => {
    const empty = engine.playMap({ map: rout([]), lineup: [solo(hero)] }, 1);
    expect(empty).toMatchObject({ noDeath: 1, turns: 1, ended: 'rout' });
    const unarmed = engine.playMap({ map: rout([group({ ...brute, weapon: undefined, count: 3 })]), lineup: [solo(hero)] }, 1);
    expect(unarmed.noDeath).toBe(1);
    expect(unarmed.ended).toBe('rout');
    expect(unarmed.units.hero!.kills).toEqual({ Brute: 3 });
  });

  it('reads 0% when a foe always kills an exposed unit it can’t hurt', () => {
    const wall: Foe = { ...brute, stats: { ...brute.stats, def: 99 }, skills: ['Hawkeye'] };
    const play = engine.playMap({ map: rout([group(wall)]), lineup: [solo(hero)] }, 1);
    expect(play.noDeath).toBe(0);
    expect(play.ended).toBe('stalled');
  });

  it('multiplies the survival of every exposure, from the solver’s hit rates', () => {
    const m = matchup(hero, undefined, null, brute);
    expect([m.hit, m.crit, m.foeCrit, m.damage, m.hits, m.oneRounds]).toEqual([100, 0, 0, 10, 2, false]);
    const q = m.foeHit / 100;
    expect(q).toBeGreaterThan(0);
    expect(q).toBeLessThan(1);
    // Player phase: the hero strikes, the Brute's counter kills with q, the hero's follow-up. Enemy phase: the
    // Brute strikes first (q again), then the hero's counter and follow-up finish it: a rout on turn 1.
    const play = engine.playMap({ map: rout([group(brute)]), lineup: [solo(hero)] }, 1);
    expect(play.noDeath).toBeCloseTo((1 - q) ** 2, 12);
    expect(play).toMatchObject({ turns: 1, ended: 'rout' });
    expect(play.log[0]!.fights.map((f) => [f.phase, f.lead, f.foe, f.kill])).toEqual([
      ['player', 'hero', 'Brute', false],
      ['enemy', 'hero', 'Brute', true],
    ]);
    expect(play.units.hero).toMatchObject({ combats: 2, kills: { Brute: 1 } });
  });

  it('lets the back’s Dual Guard nullify a strike, at the solver’s rate', () => {
    const m = matchup(hero, shield, 'S', brute);
    expect(m.dualGuardRate).toBeGreaterThan(0);
    const miss = 1 - (m.foeHit / 100) * (1 - m.dualGuardRate / 100);
    const play = engine.playMap({ map: rout([group(brute)]), lineup: [{ lead: unit(hero), back: unit(shield), support: 'S' }] }, 1);
    expect(play.noDeath).toBeCloseTo(miss ** 2, 12);
    expect(play.units.hero!.together).toEqual({ shield: 2 });
  });

  it('gives each pair one worst attacker, one foe for each exposed pair', () => {
    const weak: Foe = { ...brute, name: 'Weak', stats: { ...brute.stats, str: 0 } };
    // Two pairs, one Brute and one harmless foe: only one pair faces the Brute.
    const one = engine.playMap({ map: rout([group(brute), group(weak)]), lineup: [solo(hero), solo({ ...hero, name: 'Twin' })] }, 1);
    const q = matchup(hero, undefined, null, brute).foeHit / 100;
    const brutes = one.log.flatMap((t) => t.fights).filter((f) => f.foe === 'Brute');
    expect(brutes.length).toBeGreaterThan(0);
    expect(one.noDeath).toBeCloseTo(brutes.reduce((p, f) => p * f.survive, 1), 12);
    expect(one.noDeath).toBeGreaterThanOrEqual((1 - q) ** 2 - 1e-12);
  });

  it('ends a rout when no foe is left, and joins waves on their turn', () => {
    // A Brute that can't be hurt holds the field; a harmless crowd arrives on turn 2 at the start of enemy phase.
    const post: Foe = { ...brute, name: 'Post', weapon: undefined, stats: { ...brute.stats, hp: 60 } };
    const crowd: Foe = { ...brute, name: 'Crowd', weapon: undefined, count: 2, stats: { ...brute.stats, hp: 10 } };
    const map = rout([group(post)], [{ label: 'Turn 2', turns: [2], joins: 'enemy-phase', groups: [group(crowd)] }]);
    const play = engine.playMap({ map, lineup: [solo(hero)] }, 1);
    // 20 damage a turn, one action a turn: Post's 60 HP and the crowd's two foes take five turns between them.
    expect(play.log[1]!.arrivals).toEqual([{ group: 'Crowd', count: 2 }]);
    expect(play).toMatchObject({ turns: 5, ended: 'rout', noDeath: 1 });
    expect(play.units.hero!.kills).toEqual({ Post: 1, Crowd: 2 });
  });

  it('ends a boss map on the turn the solve picks, or after the rest when it picks none', () => {
    const boss: Foe = { ...brute, name: 'Chief', boss: true, weapon: undefined, stats: { ...brute.stats, hp: 20 } };
    const guards: Foe = { ...brute, name: 'Guard', weapon: undefined, count: 4, stats: { ...brute.stats, hp: 20 } };
    const map: SimMap = { id: 'test', victory: 'boss', foes: [group(boss, { target: true }), group(guards)], waves: [], skipped: [] };
    const picked = engine.playMap({ map, lineup: [solo(hero)], bossTurn: 2 }, 1);
    expect(picked).toMatchObject({ turns: 2, ended: 'boss' });
    expect(picked.units.hero!.kills).toEqual({ Guard: 1, Chief: 1 });
    const last = engine.playMap({ map, lineup: [solo(hero)] }, 1);
    expect(last).toMatchObject({ turns: 5, ended: 'boss' });
  });

  it('draws Lunatic+ skills with the seed: the same seed gives the same play', () => {
    const map = rout([group(brute, { pool: ['Pass', 'Hawkeye', 'Luna+', 'Vantage+'] })]);
    const input = { map, lineup: [solo(hero)] };
    expect(engine.playMap(input, 7)).toEqual(engine.playMap(input, 7));
    const drawn = new Set(Array.from({ length: 12 }, (_, s) => engine.playMap(input, s).skills.Brute!.join(',')));
    expect(drawn.size).toBeGreaterThan(1);
    expect([...drawn].every((d) => d.split(',').length === 2)).toBe(true);
    // Averaged over runs, still seeded.
    expect(engine.mapNoDeath(input, 3, 8)).toBe(engine.mapNoDeath(input, 3, 8));
  });
});

describe('a map from the chapter data (#181)', () => {
  it('reads victory, the boss to defeat and the starting foes', () => {
    const c3 = engine.simMap('chapter-3', 'lunatic');
    expect(c3.victory).toBe('boss');
    expect(c3.foes.find((f) => f.target)?.foe.name).toBe('Raimi');
    expect(engine.simMap('chapter-2', 'lunatic').victory).toBe('rout');
    // Lunatic+ reads Lunatic's table and leaves each foe's two skills to be drawn from the map's pool.
    const lplus = engine.simMap('chapter-2', 'lunatic-plus');
    expect(lplus.foes.every((f) => f.pool?.length === 4)).toBe(true);
  });

  it('turns the reinforcement waves into turns, free to act on Hard and up', () => {
    const lunatic = engine.simMap('chapter-5', 'lunatic');
    expect(lunatic.waves.map((w) => [w.turns, w.joins])).toEqual([
      [[3], 'enemy-phase'],
      [[4], 'enemy-phase'],
      [[5], 'enemy-phase'],
    ]);
    expect(engine.simMap('chapter-5', 'normal').waves[0]!.joins).toBe('turn-start');
  });

  it('plays a real map with a hand-built army, the same way for the same seed', () => {
    const chrom: Fighter = { name: 'Chrom', className: 'Lord', stats: stats(40, 25, 0, 25, 25, 20, 20, 10), skills: [], weapon: weapon('Iron Sword') };
    const input = { map: engine.simMap('chapter-2', 'lunatic'), lineup: [solo(chrom), solo({ ...hero, stats: stats(35, 20, 0, 30, 25, 15, 15, 5) })] };
    const play = engine.playMap(input, 1);
    expect(play.ended).toBe('rout');
    expect(play.noDeath).toBeGreaterThan(0);
    expect(play.noDeath).toBeLessThanOrEqual(1);
    expect(engine.playMap(input, 1)).toEqual(play);
  });

  it('states the blind spots it rests on', () => {
    const ids = engine.blindSpots().map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(['one-worst-attacker', 'equal-share-of-actions']));
    expect(engine.blindSpots().find((b) => b.id === 'one-worst-attacker')!.lean).toBe('high');
    const play = engine.playMap({ map: rout([]), lineup: [solo(hero)] }, 1);
    expect(play.blindSpots).toEqual(expect.arrayContaining(['one-worst-attacker', 'equal-share-of-actions']));
    expect(play.blindSpots.every((id) => ids.includes(id))).toBe(true);
  });
});

describe('sustain, Dance, Rally and staff reach (#182)', () => {
  // A long fight: the tank takes a 10-damage hit more often than not, twice a turn, and needs turns on end to fell the
  // wall. HP it loses stays lost unless an action buys it back.
  const tank: Fighter = { name: 'Tank', className: 'Myrmidon', stats: stats(30, 15, 0, 60, 30, 0, 10, 0), skills: [], weapon: weapon('Iron Sword') };
  const wall: Foe = { ...brute, name: 'Wall', stats: stats(60, 13, 0, 0, 0, 60, 15, 0) };
  const cleric: Fighter = { name: 'Cleric', className: 'Cleric', stats: stats(20, 0, 10, 5, 5, 5, 2, 8), skills: [], weapon: undefined };
  const dancer: Fighter = { name: 'Olivia', className: 'Dancer', stats: stats(20, 5, 0, 5, 10, 5, 3, 1), skills: [], weapon: undefined };
  const staffUnit = (f: Fighter, staff: string, uses = 30): SimUnit => ({ id: f.name.toLowerCase(), fighter: f, weapons: [], items: [{ item: itemByName(staff)!, uses }] });
  const map = rout([group(wall)]);
  const alone = { map, lineup: [solo(tank)] };

  it('carries HP from turn to turn: an unhealed unit fights on hurt', () => {
    const q = matchup(tank, undefined, null, wall).foeHit / 100;
    expect(q).toBeGreaterThan(0.5);
    expect(q).toBeLessThan(1);
    const play = engine.playMap(alone, 1);
    expect(play.ended).toBe('rout');
    // Full HP each turn would give every exchange the first turn's survival; hurt, later ones are riskier.
    const survive = play.log.flatMap((t) => t.fights).map((f) => f.survive);
    expect(Math.min(...survive)).toBeLessThan(survive[0]!);
    expect(engine.blindSpots().map((b) => b.id)).not.toContain('full-hp-each-turn');
    expect(play.blindSpots).not.toContain('full-hp-each-turn');
  });

  it('raises the no-death chance with a healer’s heals, each spending a use of the staff', () => {
    const without = engine.playMap(alone, 1);
    const healed = engine.playMap({ map, lineup: [solo(tank), { lead: staffUnit(cleric, 'Heal'), support: null }] }, 1);
    expect(healed.noDeath).toBeGreaterThan(without.noDeath);
    const heals = healed.log.flatMap((t) => t.acts).filter((a) => a.kind === 'heal');
    expect(heals.length).toBeGreaterThan(0);
    expect(heals.every((a) => a.unit === 'cleric' && a.target === 'tank' && a.item === 'Heal')).toBe(true);
    expect(healed.units.cleric!.used).toEqual({ Heal: heals.length });
    // One use left: one heal.
    const once = engine.playMap({ map, lineup: [solo(tank), { lead: staffUnit(cleric, 'Heal', 1), support: null }] }, 1);
    expect(once.units.cleric!.used).toEqual({ Heal: 1 });
  });

  it('spends the unit’s own action on a Vulnerary', () => {
    const potion: SimUnit = { ...unit(tank), items: [{ item: itemByName('Vulnerary')!, uses: 3 }] };
    const play = engine.playMap({ map: rout([group({ ...wall, stats: { ...wall.stats, hp: 200 } })]), lineup: [{ lead: potion, support: null }] }, 1);
    const drinks = play.log.filter((t) => t.acts.some((a) => a.kind === 'item' && a.unit === 'tank' && a.item === 'Vulnerary'));
    expect(drinks.length).toBeGreaterThan(0);
    expect(drinks.length).toBeLessThanOrEqual(3);
    // The turn it drinks, it doesn't attack.
    for (const t of drinks) expect(t.fights.some((f) => f.phase === 'player' && f.lead === 'tank')).toBe(false);
    expect(play.units.tank!.used.Vulnerary).toBe(drinks.length);
  });

  it('reaches pairs by the assumed army spread: an assumption with a default and an override', () => {
    const spread = engine.assumptions().find((a) => a.id === 'army-spread')!;
    expect(spread).toMatchObject({ isDefault: true });
    expect(spread.sources.length).toBeGreaterThan(0);
    const cl = staffUnit(cleric, 'Heal');
    const near = engine.staffReach(cl, 'Heal');
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(1);
    // Physic reaches Mag ÷ 2 further than Heal.
    expect(engine.staffReach(staffUnit(cleric, 'Physic'), 'Physic')).toBeGreaterThan(near);
    // An override is distances in tiles: kept in order, and a bad one leaves the default.
    expect(resolveAssumptions({ 'army-spread': [8, 2, 2] })['army-spread']).toEqual([2, 2, 8]);
    expect(resolveAssumptions({ 'army-spread': [0, 3] })['army-spread']).toEqual(resolveAssumptions({})['army-spread']);
    const far = createEngine(resolveAssumptions({ 'army-spread': [30, 40] }));
    expect(far.assumptions().find((a) => a.id === 'army-spread')!.isDefault).toBe(false);
    expect(far.staffReach(cl, 'Heal')).toBe(0);
    // A staff that never reaches heals nobody: the chance is the healer-less one.
    const input = { map, lineup: [solo(tank), { lead: cl, support: null }] };
    expect(far.playMap(input, 1).noDeath).toBeCloseTo(engine.playMap(alone, 1).noDeath, 12);
    expect(far.playMap(input, 1).noDeath).toBeLessThan(engine.playMap(input, 1).noDeath);
    // The spread is one input to the play: distances given with the map replace the assumption.
    expect(engine.playMap({ ...input, spread: [30] }, 1).noDeath).toBeCloseTo(far.playMap(input, 1).noDeath, 12);
  });

  it('gives another action with a Dance: a foe felled before it can attack', () => {
    // Two foes the hero fells with one strike (no counter), each killing it with one hit on enemy phase.
    const glass: Foe = { ...brute, name: 'Glass', count: 2, stats: { ...brute.stats, hp: 10, def: 0 } };
    const q = matchup(hero, undefined, null, glass).foeHit / 100;
    const two = rout([group(glass)]);
    const without = engine.playMap({ map: two, lineup: [solo(hero)] }, 1);
    expect(without.noDeath).toBeCloseTo(1 - q, 12);
    const danced = engine.playMap({ map: two, lineup: [solo(hero), { lead: unit(dancer), support: null }] }, 1);
    expect(danced.log[0]!.acts).toEqual([{ kind: 'dance', unit: 'olivia', target: 'hero' }]);
    expect(danced.units.olivia!.dances).toBe(1);
    expect(danced.units.hero!.kills).toEqual({ Glass: 2 });
    expect(danced).toMatchObject({ noDeath: 1, turns: 1, ended: 'rout' });
  });

  it('assumes Rally reaches every pair it’s planned for, and says so', () => {
    const rallier: Fighter = { ...cleric, name: 'Rallier', skills: ['Rally Defence'] };
    const rallied = engine.playMap({ map, lineup: [solo(tank), { lead: unit(rallier), support: null }] }, 1);
    expect(rallied.log.flatMap((t) => t.acts).some((a) => a.kind === 'rally' && a.unit === 'rallier')).toBe(true);
    expect(rallied.noDeath).toBeGreaterThan(engine.playMap(alone, 1).noDeath);
    expect(rallied.units.rallier!.rallies).toBeGreaterThan(0);
    const spot = engine.blindSpots().find((b) => b.id === 'rally-reaches-every-pair');
    expect(spot?.lean).toBe('high');
    expect(rallied.blindSpots).toContain('rally-reaches-every-pair');
  });

  it('keeps a play cheap', () => {
    const input = { map, lineup: [solo(tank), { lead: staffUnit(cleric, 'Physic'), support: null }, { lead: unit(dancer), support: null }] };
    engine.playMap(input, 1);
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) engine.playMap(input, i);
    expect((performance.now() - t0) / 50).toBeLessThan(5);
  });
});
