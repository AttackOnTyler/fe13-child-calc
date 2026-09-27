import { describe, expect, it } from 'vitest';
import { createEngine, itemByName, matchup, type Fighter, type Foe, type SimFoeGroup, type SimGroup, type SimMap } from './index';

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
