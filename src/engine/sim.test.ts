import { describe, expect, it } from 'vitest';
import { createEngine, itemByName, matchup, resolveAssumptions, type Fighter, type Foe, type SimFoeGroup, type SimGroup, type SimMap, type SimUnit, type SupportLevel } from './index';

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

  it('stops a play once its no-death chance falls below the run’s floor: the run has lost a unit', () => {
    // Three Brutes: a risky exchange each turn, over several turns.
    const map = rout([group({ ...brute, count: 3 })]);
    const full = engine.playMap({ map, lineup: [solo(hero)] }, 1);
    const first = full.log[0]!.noDeath;
    expect(first).toBeLessThan(1);
    expect(full.turns).toBeGreaterThan(1);
    const stopped = engine.playMap({ map, lineup: [solo(hero)], stopBelow: (first + 1) / 2 }, 1);
    expect(stopped).toMatchObject({ ended: 'lost', turns: 1, noDeath: first });
  });

  it('multiplies the survival of every exposure, from the solver’s hit rates', () => {
    const m = matchup(hero, undefined, null, brute);
    expect([m.hit, m.crit, m.foeCrit, m.damage, m.hits, m.oneRounds]).toEqual([100, 0, 0, 10, 2, false]);
    const q = m.foeHit / 100;
    expect(q).toBeGreaterThan(0);
    expect(q).toBeLessThan(1);
    // Attacking first would risk the Brute's counter (q) and then its enemy-phase attack (q again); waiting in its reach
    // (a bait, #183) risks q alone. Turn 1: the Brute strikes (q), the hero's counter and follow-up take 20 of its 40
    // HP. Turn 2: the hero strikes, the counter (q), the follow-up fells it: a rout on turn 2.
    const play = engine.playMap({ map: rout([group(brute)]), lineup: [solo(hero)] }, 1);
    expect(play.noDeath).toBeCloseTo((1 - q) ** 2, 12);
    expect(play).toMatchObject({ turns: 2, ended: 'rout' });
    expect(play.log[0]!.acts).toEqual([{ kind: 'bait', unit: 'hero' }]);
    expect(play.log.map((t) => t.fights.map((f) => [f.phase, f.lead, f.foe, f.kill]))).toEqual([
      [['enemy', 'hero', 'Brute', false]],
      [['player', 'hero', 'Brute', true]],
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

  it('draws Lunatic+ skills for each foe, not once for its group: a group of eight reads as one, its fights as each foe', () => {
    const pool = ['Pass', 'Hawkeye', 'Luna+', 'Vantage+'];
    const weak: Foe = { ...brute, name: 'Imp', count: 8, weapon: undefined, stats: stats(10, 0, 0, 0, 0, 60, 0, 0) };
    const play = engine.playMap({ map: rout([group(weak, { pool })]), lineup: [solo(hero)] }, 3);
    expect(play.groups).toEqual([{ key: 'Imp', name: 'Imp', className: 'Fighter', count: 8, felled: 8 }]);
    const draws = new Set(play.log.flatMap((t) => t.fights.map((f) => [...f.drawn!].sort().join(','))));
    expect(draws.size).toBeGreaterThan(1);
    expect(play.units.hero!.kills).toEqual({ Imp: 8 });
    expect(play.blindSpots).toContain('lunatic-plus-draws');
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

  it('trades a Vulnerary over from another unit on the field: the drinker’s action, the holder’s use', () => {
    // The cleric holds the potions and never fights; the tank has none of its own.
    const holder: SimUnit = { ...unit(cleric), items: [{ item: itemByName('Vulnerary')!, uses: 3 }] };
    const play = engine.playMap({ map: rout([group({ ...wall, stats: { ...wall.stats, hp: 200 } })]), lineup: [solo(tank), { lead: holder, support: null }] }, 1);
    const drinks = play.log.flatMap((t) => t.acts).filter((a) => a.kind === 'item' && a.unit === 'tank');
    expect(drinks.length).toBeGreaterThan(0);
    expect(drinks.every((a) => a.from === 'cleric')).toBe(true);
    expect(play.units.cleric!.used.Vulnerary).toBe(drinks.length);
    expect(play.units.tank!.used.Vulnerary).toBeUndefined();
    expect(play.blindSpots).toContain('potions-traded');
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

  it('rallies only when the bonus is worth more than the rallier’s own action: a fighter whose Rally helps nobody fights', () => {
    // The Rally reaches only a cleric who never fights: the rallier's action is worth more spent on the Brute.
    const fighter: Fighter = { ...hero, skills: ['Rally Defence'] };
    const lineup = [{ lead: unit(fighter), support: null }, { lead: unit(cleric), support: null }];
    const play = engine.playMap({ map: rout([group(brute)]), lineup }, 1);
    expect(play.log.flatMap((t) => t.acts).some((a) => a.kind === 'rally')).toBe(false);
    const plain = engine.playMap({ map: rout([group(brute)]), lineup: [solo(hero), { lead: unit(cleric), support: null }] }, 1);
    expect(play.noDeath).toBe(plain.noDeath);
    expect(play.turns).toBe(plain.turns);
  });

  it('keeps a play cheap', () => {
    const input = { map, lineup: [solo(tank), { lead: staffUnit(cleric, 'Physic'), support: null }, { lead: unit(dancer), support: null }] };
    engine.playMap(input, 1);
    // The median play, against a loose bound: parallel load mustn't read as a slow play.
    const times = Array.from({ length: 21 }, (_, i) => {
      const t0 = performance.now();
      engine.playMap(input, i);
      return performance.now() - t0;
    }).sort((a, b) => a - b);
    expect(times[10]!).toBeLessThan(15);
  });
});

describe('stances and exposure (#183)', () => {
  // Hits 20 a strike on an unguarded Def 0 unit (Str 13 + Iron Axe's 7), always (Hawkeye), never crits; 40 HP, Def 0: one
  // round of the hero's (20 a hit, doubled) fells it.
  const biter = (str: number, more: Partial<Foe> = {}): Foe => ({ ...brute, name: 'Biter', stats: stats(40, str, 0, 0, 0, 60, 0, 0), skills: ['Hawkeye'], ...more });
  // A back with no weapon whose Def 30 gives the lead +3 Def paired up (and nothing else).
  const wall: Fighter = { ...shield, name: 'Wall', stats: stats(20, 0, 0, 0, 0, 0, 30, 0) };
  const post: Foe = { ...brute, name: 'Post', weapon: undefined, count: 4, stats: { ...brute.stats, hp: 10, def: 0 } };
  const twin: Fighter = { ...hero, name: 'Twin' };
  const pair = (lead: Fighter, back: Fighter, support: SupportLevel | null = 'S'): SimGroup => ({ lead: unit(lead), back: unit(back), support });

  it('keeps a pair together when its lead would die alone: pair-up Def and Dual Guard on the one that fights', () => {
    const map = rout([group(biter(13))]);
    // Alone, the Biter's counter (20) kills the hero: it can neither attack nor wait for it, and dies when it closes in.
    const alone = engine.playMap({ map, lineup: [solo(hero)] }, 1);
    expect(alone.noDeath).toBe(0);
    // Paired with the Wall (+3 Def), the hit is 17: the hero fells the Biter and lives.
    const together = engine.playMap({ map, lineup: [pair(hero, wall)] }, 1);
    expect(together).toMatchObject({ noDeath: 1, turns: 1, ended: 'rout' });
    expect(together.log[0]!.stances).toEqual([{ pair: 'hero', stance: 'together', front: 'hero' }]);
    // Combats together count for supports (#188): as front and as back.
    expect(together.units.hero!.together).toEqual({ wall: 1 });
    expect(together.units.wall!.together).toEqual({ hero: 1 });
  });

  it('splits a pair that can safely split, and gains the actions: Separate costs the front’s action that turn', () => {
    const map = rout([group(post)]);
    const split = engine.playMap({ map, lineup: [pair(hero, twin)] }, 1);
    // Turn 1: the hero drops the twin beside it (its action), the twin fells one Post. Turn 2: both act, two Posts.
    // Turn 3: the last one. A unit alone takes four turns. Apart, they stand adjacent at the default spread's rate (one\r
    // distance in ten is 1 tile).
    expect(split.log.map((t) => t.stances)).toEqual([
      [{ pair: 'hero', stance: 'adjacent', adjacency: 0.1, change: 'separate' }],
      [{ pair: 'hero', stance: 'adjacent', adjacency: 0.1 }],
      [{ pair: 'hero', stance: 'adjacent', adjacency: 0.1 }],
    ]);
    expect(split.log.map((t) => t.fights.filter((f) => f.phase === 'player').map((f) => f.lead))).toEqual([['twin'], ['hero', 'twin'], ['hero']]);
    expect(split).toMatchObject({ turns: 3, ended: 'rout', noDeath: 1 });
    expect(engine.playMap({ map, lineup: [solo(hero)] }, 1).turns).toBe(4);
    // Apart, combats aren't together: supports don't grow from them.
    expect(split.units.hero!.together).toEqual({});
    // Attack Stance adjacency comes from the army spread: nobody within 1 tile, the pair is plainly apart.
    const far = engine.playMap({ map, lineup: [pair(hero, twin)], spread: [5] }, 1);
    expect(far.log[1]!.stances).toEqual([{ pair: 'hero', stance: 'apart' }]);
    expect(split.blindSpots).toContain('attack-stance-adjacency');
    expect(engine.playMap({ map, lineup: [pair(hero, wall)] }, 1).blindSpots).not.toContain('attack-stance-adjacency');
  });

  it('keeps a bonded pair together while that’s safe, so its support grows: combats together', () => {
    // Two armed partners that could each fell a Post safely alone: unbonded they split (above); a bond (a couple the
    // plan still has to marry) keeps them paired, one action a turn, every combat together.
    const map = rout([group(post)]);
    const bonded = engine.playMap({ map, lineup: [pair(hero, twin)], bonds: [['twin', 'hero']] }, 1);
    expect(bonded.log.every((t) => t.stances.every((s) => s.stance === 'together'))).toBe(true);
    expect(bonded).toMatchObject({ ended: 'rout', noDeath: 1, turns: 4 });
    expect(bonded.units.hero!.together).toEqual({ twin: 4 });
    // Unbonded, the same pair splits and grows nothing.
    const apart = engine.playMap({ map, lineup: [pair(hero, twin)] }, 1);
    expect(apart.units.hero!.together).toEqual({});
  });

  it('switches the sturdier unit to the front for free, and it fights that turn', () => {
    // The Biter hits 25: 23 on the frail lead even paired up (dead), 5 on the tough back.
    const frail: Fighter = { ...hero, name: 'Frail' };
    const tough: Fighter = { ...hero, name: 'Tough', stats: stats(40, 15, 0, 60, 40, 0, 20, 0) };
    const play = engine.playMap({ map: rout([group(biter(17))]), lineup: [pair(frail, tough)] }, 1);
    expect(play.log[0]!.stances).toEqual([{ pair: 'frail', stance: 'together', front: 'tough', change: 'switch' }]);
    expect(play.log[0]!.fights.map((f) => [f.phase, f.lead, f.back, f.kill])).toEqual([['player', 'tough', 'frail', true]]);
    expect(play).toMatchObject({ noDeath: 1, turns: 1 });
  });

  it('pairs up again before a wave that would kill either unit alone: Pair Up costs the mover’s action', () => {
    // Def 10 each: alone a Biter's 30 leaves 20 (dead at 20 HP); paired, +1 Def leaves 19.
    const a: Fighter = { ...hero, name: 'Ann', stats: stats(20, 15, 0, 60, 40, 0, 10, 0) };
    const b: Fighter = { ...a, name: 'Bea' };
    const map = rout([group({ ...post, count: 6 })], [{ label: 'Turn 3', turns: [3], joins: 'enemy-phase', groups: [group(biter(23))] }]);
    const play = engine.playMap({ map, lineup: [pair(a, b)] }, 1);
    expect(play.log.slice(0, 3).map((t) => t.stances[0]!.change)).toEqual(['separate', undefined, 'pair-up']);
    expect(play.log[2]!.stances[0]).toMatchObject({ stance: 'together' });
    expect(play.log[2]!.fights.filter((f) => f.phase === 'player')).toHaveLength(1);
    expect(play.noDeath).toBe(1);
    expect(play.ended).toBe('rout');
  });

  it('holds a unit back out of reach when it can’t fight safely, and lets a sturdy one take the attacks', () => {
    // Two Biters that kill the frail unit and barely scratch the tank.
    const frail: Fighter = { ...hero, name: 'Frail' };
    const tank: Fighter = { ...hero, name: 'Tank', stats: stats(40, 15, 0, 60, 40, 0, 20, 0) };
    const play = engine.playMap({ map: rout([group(biter(17, { count: 2 }))]), lineup: [solo(tank), solo(frail)] }, 1);
    expect(play.noDeath).toBe(1);
    expect(play.ended).toBe('rout');
    expect(play.log.every((t) => !t.exposed.includes('frail'))).toBe(true);
    expect(play.units.frail!.combats).toBe(0);
    expect(play.blindSpots).toContain('held-back-out-of-reach');
    expect(engine.blindSpots().find((s) => s.id === 'held-back-out-of-reach')!.lean).toBe('high');
    expect(engine.blindSpots().find((s) => s.id === 'attack-stance-adjacency')!.lean).toBe('low');
  });

  it('keeps a play cheap on a real map with pairs', () => {
    const chrom: Fighter = { name: 'Chrom', className: 'Lord', stats: stats(40, 25, 0, 25, 25, 20, 20, 10), skills: [], weapon: weapon('Iron Sword') };
    const input = { map: engine.simMap('chapter-2', 'lunatic'), lineup: [pair(chrom, { ...hero, stats: stats(35, 20, 0, 30, 25, 15, 15, 5) }, 'C'), pair(twin, { ...wall, name: 'Wall2' })] };
    engine.playMap(input, 1);
    // The median play, so a pause under parallel load doesn't read as a slow play; the bound is loose for the same reason.
    const times = Array.from({ length: 21 }, (_, i) => {
      const t0 = performance.now();
      engine.playMap(input, i);
      return performance.now() - t0;
    }).sort((a, b) => a - b);
    expect(times[10]!).toBeLessThan(15);
  });
});

describe('the third party, forced units and joins (#184)', () => {
  // A foe the hero can't hurt: 60 HP, Def 30; it kills anything it hits (Str 30 + Iron Axe), and always hits (Hawkeye).
  const wall: Foe = { ...brute, name: 'Wall', stats: { ...brute.stats, hp: 60, def: 30 }, skills: ['Hawkeye'] };
  const post: Foe = { ...brute, name: 'Post', weapon: undefined, count: 2, stats: { ...brute.stats, hp: 10, def: 0 } };
  // An NPC the army must keep alive, with no weapon and 1 HP.
  const saint: Fighter = { name: 'Saint', className: 'Sage', stats: stats(1, 0, 5, 5, 5, 5, 0, 5), skills: [], weapon: undefined };

  it('reads the chapter data: the starting field without its reinforcements or those gone before turn 1', () => {
    const c9 = engine.simMap('chapter-9', 'normal');
    // 17 on the field (Tharja among them): Gangrel and Aversa leave before the first turn, the 6 reinforcements come on turn 5.
    expect(c9.foes.reduce((n, g) => n + g.foe.count, 0)).toBe(17);
    expect(c9.foes.map((g) => g.foe.name)).not.toContain('Gangrel');
    expect(c9.foes.map((g) => g.foe.name)).not.toContain('Aversa');
    expect(c9.waves.flatMap((w) => w.groups).reduce((n, g) => n + g.foe.count, 0)).toBe(6);
    expect(engine.simMap('chapter-9', 'lunatic').foes.reduce((n, g) => n + g.foe.count, 0)).toBe(21);
    // Libra and Tharja join when Chrom talks to them: Libra an NPC until then, Tharja a foe.
    expect(c9.recruits?.map((r) => [r.id, r.talk?.by, r.npc ?? false, r.foe])).toEqual([
      ['libra', ['chrom'], true, undefined],
      ['tharja', ['chrom'], false, 'Tharja'],
    ]);
    expect(c9.recruits?.every((r) => r.unit?.fighter.stats.hp)).toBe(true);
    // Chapter 6: Emmeryn is an ally whose death is a failure; Panne arrives on turn 2; Gaius is a foe until Chrom talks.
    const c6 = engine.simMap('chapter-6', 'normal');
    expect(c6.allies?.map((a) => a.unit.id)).toEqual(['emmeryn']);
    expect(c6.recruits?.map((r) => [r.id, r.arrives, r.foe])).toEqual([
      ['panne', 2, undefined],
      ['gaius', undefined, 'Gaius'],
    ]);
    // A foe that leaves on its own: Death's Embrace's Algol, on turn 10; one that leaves once Robin talks to it.
    expect(engine.simMap('deaths-embrace', 'normal').foes.find((g) => g.foe.name === 'Algol')?.leaves).toBe(10);
    expect(engine.simMap('the-future-past-1', 'normal').recruits).toEqual([{ id: 'Morgan (M)', talk: { by: ['robin'], times: 1 }, foe: 'Morgan (M)', departs: true }]);
  });

  it('counts an ally NPC’s death against the no-death chance; scenery NPCs aren’t played', () => {
    // The shield can't hurt the Wall and moves nothing: the foes close in on everyone, the Saint too.
    const kept = engine.playMap({ map: { ...rout([group(wall)]), allies: [{ unit: unit(saint) }] }, lineup: [solo(shield)] }, 1);
    expect(kept.noDeath).toBe(0);
    expect(kept.units.saint!.combats).toBe(1);
    expect(kept.blindSpots).toEqual(expect.arrayContaining(['npc-kills', 'npc-screened']));
    const scenery = engine.playMap({ map: rout([group(wall)]), lineup: [solo(shield)] }, 1);
    expect(scenery.noDeath).toBe(1);
    // While the army moves the map on, the unarmed NPC stays out of reach.
    const busy = engine.playMap({ map: { ...rout([group(post)]), allies: [{ unit: unit(saint) }] }, lineup: [solo(hero)] }, 1);
    expect(busy).toMatchObject({ noDeath: 1, ended: 'rout' });
  });

  it('puts an armed NPC in the foes’ reach in the ally phase, and its death counts', () => {
    // The Biter hits 20 always: the 20 HP guard dies countering it; nobody in the army is in reach.
    const biter: Foe = { ...brute, name: 'Biter', stats: stats(40, 13, 0, 0, 0, 60, 0, 0), skills: ['Hawkeye'] };
    const guard: Fighter = { ...hero, name: 'Guard', stats: stats(20, 0, 0, 0, 0, 0, 0, 0) };
    const play = engine.playMap({ map: { ...rout([group(biter)]), recruits: [{ id: 'guard', unit: unit(guard), npc: true }] }, lineup: [solo(shield)] }, 1);
    expect(play.log[0]!.exposed).toContain('guard');
    expect(play.noDeath).toBe(0);
  });

  it('gives a mid-map arrival no action before its turn', () => {
    const map: SimMap = { ...rout([group({ ...post, count: 4 })]), recruits: [{ id: 'twin', unit: unit({ ...hero, name: 'Twin' }), arrives: 3 }] };
    const play = engine.playMap({ map, lineup: [solo(hero)] }, 1);
    // Turns 1–2: the hero alone fells one Post a turn; turn 3 the twin arrives and both act.
    expect(play.log.map((t) => t.fights.filter((f) => f.phase === 'player').map((f) => f.lead))).toEqual([['hero'], ['hero'], ['hero', 'twin']]);
    expect(play.log[2]!.joins).toEqual(['twin']);
    expect(play.units.twin!.combats).toBe(1);
  });

  it('recruits a foe on the turn the solve sends a talker: never attacked, not routed, then fights for the army', () => {
    // The Turncoat can't be hurt by the hero (Def 30): as a foe it could never be routed.
    const turncoat: Foe = { ...wall, name: 'Turncoat' };
    const recruit: Fighter = { ...hero, name: 'Turncoat' };
    const map: SimMap = { ...rout([group(turncoat), group({ ...post, count: 3 })]), recruits: [{ id: 'turncoat', unit: unit(recruit), talk: { by: ['hero'], times: 1 }, foe: 'Turncoat' }] };
    const play = engine.playMap({ map, lineup: [solo(hero)] }, 1);
    // Turn 1: the hero talks (its action); the Turncoat acts from turn 2, felling Posts with the hero.
    expect(play.log[0]!.acts).toEqual([{ kind: 'talk', unit: 'hero', target: 'turncoat' }]);
    expect(play.log[0]!.joins).toEqual(['turncoat']);
    expect(play.log[1]!.fights.filter((f) => f.phase === 'player').map((f) => f.lead)).toEqual(['hero', 'turncoat']);
    expect(play).toMatchObject({ ended: 'rout', noDeath: 1, turns: 3 });
    expect(play.units.hero!.kills).toEqual({ Post: 2 });
    expect(play.blindSpots).toContain('talk-reaches');
    // A later turn from the solve: no talk before it.
    const later = engine.playMap({ map, lineup: [solo(hero)], talks: { turncoat: 2 } }, 1);
    expect(later.log[0]!.acts).toEqual([]);
    expect(later.log[1]!.acts).toEqual([{ kind: 'talk', unit: 'hero', target: 'turncoat' }]);
    // Nobody who can talk to it in the lineup: it stays a foe, and this army can't rout it.
    const none = engine.playMap({ map: { ...map, recruits: [{ ...map.recruits![0]!, talk: { by: ['chrom'], times: 1 } }] }, lineup: [solo(hero)] }, 1);
    expect(none.ended).toBe('stalled');
  });

  it('takes three talks for Gangrel, each a talker’s action', () => {
    const c = engine.simMap('paralogue-18', 'normal').recruits!.find((r) => r.id === 'gangrel')!;
    expect(c.talk).toEqual({ by: ['chrom'], times: 3 });
  });

  it('states the Chapter 3 door keys as a blind spot', () => {
    expect(engine.simMap('chapter-3', 'normal').blindSpots).toEqual(['door-keys']);
    const ids = engine.blindSpots().map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(['npc-kills', 'npc-screened', 'talk-reaches', 'door-keys']));
    expect(engine.blindSpots().find((b) => b.id === 'npc-kills')!.lean).toBe('low');
  });

  // A plausible army for Chapters 6–9, unpromoted around Lv 10–15.
  const shepherd = (name: string, className: string, s: ReturnType<typeof stats>, weapons: string[]): SimGroup => {
    const ws = weapons.map(weapon);
    return { lead: { id: name.toLowerCase(), fighter: { name, className, stats: s, skills: [], weapon: ws[0] }, weapons: ws }, support: null };
  };
  const army = (): SimGroup[] => [
    shepherd('Chrom', 'Lord', stats(32, 15, 1, 17, 17, 14, 11, 3), ['Steel Sword', 'Iron Sword']),
    shepherd('Robin', 'Tactician', stats(30, 13, 14, 15, 15, 9, 11, 9), ['Steel Sword', 'Thunder']),
    shepherd('Frederick', 'Great Knight', stats(36, 17, 2, 15, 12, 10, 17, 5), ['Steel Lance', 'Steel Axe']),
    shepherd('Sully', 'Cavalier', stats(28, 12, 1, 14, 15, 10, 11, 6), ['Steel Lance', 'Iron Sword']),
    shepherd('Vaike', 'Fighter', stats(34, 16, 0, 13, 12, 8, 10, 1), ['Steel Axe']),
    shepherd('Stahl', 'Cavalier', stats(32, 14, 0, 12, 12, 10, 11, 2), ['Steel Sword', 'Steel Lance']),
    shepherd('Kellam', 'Knight', stats(30, 12, 0, 10, 8, 6, 18, 5), ['Steel Lance']),
    shepherd('Miriel', 'Mage', stats(24, 2, 12, 12, 12, 8, 5, 9), ['Elfire']),
  ];

  it('plays Chapter 6 with Emmeryn to keep alive', () => {
    const play = engine.playMap({ map: engine.simMap('chapter-6', 'normal'), lineup: army() }, 1);
    expect(play.ended).toBe('rout');
    expect(play.units.emmeryn).toBeDefined();
    expect(play.noDeath).toBeGreaterThan(0.5);
    // Gaius joins when Chrom talks to him.
    expect(play.log[0]!.acts).toContainEqual({ kind: 'talk', unit: 'chrom', target: 'gaius' });
  });

  it('plays Chapter 9: its talk recruits join and the map is routed', () => {
    const play = engine.playMap({ map: engine.simMap('chapter-9', 'normal'), lineup: army() }, 1);
    expect(play.ended).toBe('rout');
    expect(play.turns).toBeLessThan(20);
    expect(play.log.flatMap((t) => t.joins)).toEqual(['libra', 'tharja']);
    expect(play.groups.find((g) => g.name === 'Tharja')?.felled ?? 0).toBe(0);
    expect(play.noDeath).toBeGreaterThan(0.5);
  });
});

describe('the EXP priority (#195)', () => {
  // A foe that never fights back: the hero's round (10 twice) fells it; a squire (10 once, no double) only halves it.
  const dummy: Foe = { ...brute, name: 'Dummy', stats: { ...brute.stats, hp: 20 }, weapon: undefined };
  const squire = (name: string): Fighter => ({ ...hero, name, stats: { ...hero.stats, spd: 0 } });
  const kills = (play: ReturnType<typeof engine.playMap>) => Object.fromEntries(Object.entries(play.units).map(([id, t]) => [id, t.kills.Dummy ?? 0]));
  const playerFights = (play: ReturnType<typeof engine.playMap>) => play.log.map((t) => t.fights.filter((f) => f.phase === 'player').map((f) => f.lead));

  it('has a lower unit chip the foe into a higher unit’s kill range, so the higher lands the kills', () => {
    const map = rout([group({ ...dummy, count: 3 })]);
    const lineup = [solo(squire('First')), solo(squire('Second'))];
    // Normal priority: the first squire chips, the second finishes each foe.
    expect(kills(engine.playMap({ map, lineup }, 1))).toEqual({ first: 0, second: 3 });
    const ranked = engine.playMap({ map, lineup, priority: { first: 'high' } }, 1);
    expect(kills(ranked)).toEqual({ first: 3, second: 0 });
    expect(playerFights(ranked)).toEqual([['second', 'first'], ['second', 'first'], ['second', 'first']]);
  });

  it('leaves a kill a higher unit still to act can take: the lower unit waits', () => {
    const map = rout([group({ ...dummy, count: 2 })]);
    const lineup = [solo(hero), solo(squire('Squire'))];
    expect(kills(engine.playMap({ map, lineup }, 1))).toEqual({ hero: 2, squire: 0 });
    const ranked = engine.playMap({ map, lineup, priority: { squire: 'high' } }, 1);
    // Turn 1 the hero takes the foe the squire can't fell and the squire halves the other; turn 2 the hero waits.
    expect(kills(ranked)).toEqual({ hero: 1, squire: 1 });
    expect(playerFights(ranked)).toEqual([['hero', 'squire'], ['squire']]);
  });

  it('never buys a unit an extra action: one fight a turn on player phase, whatever its priority', () => {
    const map = rout([group({ ...dummy, count: 6 })]);
    const lineup = [solo(hero), solo(squire('Squire')), solo(squire('Page'))];
    const priorities: Readonly<Partial<Record<string, 'high' | 'low'>>>[] = [{}, { squire: 'high' }, { hero: 'low', page: 'high' }];
    for (const priority of priorities) {
      const play = engine.playMap({ map, lineup, priority }, 1);
      for (const turn of playerFights(play)) expect(new Set(turn).size).toBe(turn.length);
      expect(play.ended).toBe('rout');
    }
  });

  it('records what EXP reads from each fight: whether the front dealt damage, the foe’s engagements, a back’s Dual Strike chance', () => {
    const tough: Foe = { ...dummy, stats: { ...dummy.stats, hp: 50 } };
    const play = engine.playMap({ map: rout([group(tough)]), lineup: [{ lead: unit(squire('Squire')), back: unit(hero), support: 'C' }], bonds: [['squire', 'hero']] }, 1);
    const fights = play.log.flatMap((t) => t.fights);
    expect(fights.map((f) => f.engagement)).toEqual(fights.map((_, i) => i + 1));
    expect(fights.every((f) => f.dealt)).toBe(true);
    expect(fights[0]!.dualStrike).toBeGreaterThan(0);
    expect(fights[0]!.dualStrike).toBeLessThan(1);
  });
});

describe('a careful player’s exposure, in reach already (realism pass)', () => {
  const dancer: Fighter = { name: 'Olivia', className: 'Dancer', stats: stats(20, 5, 0, 5, 10, 5, 3, 1), skills: [], weapon: undefined };
  // Unarmed and 10 HP: one strike fells it, and it never strikes back.
  const post: Foe = { ...brute, name: 'Post', weapon: undefined, stats: stats(10, 0, 0, 0, 0, 60, 0, 0) };
  // 15 HP, Def 10: the hero's first strike leaves it at 5, it counters for 10 (always: Hawkeye), the follow-up fells it.
  const pricker: Foe = { ...brute, name: 'Pricker', stats: stats(15, 3, 0, 0, 0, 60, 10, 0), skills: ['Hawkeye'] };
  // 40 HP, Def 10: hits the hero for 12, always. A hero at full HP lives through it; one the Pricker's counter hurt doesn't.
  const biter: Foe = { ...brute, name: 'Biter', stats: stats(40, 5, 0, 0, 0, 60, 10, 0), skills: ['Hawkeye'] };
  const map = rout([group(post), group(pricker), group(biter)]);

  it('weighs a Dance’s second attack against the enemy phase at the HP it leaves', () => {
    const play = engine.playMap({ map, lineup: [solo(hero), { lead: unit(dancer), support: null }] }, 1);
    const first = play.log[0]!;
    // The hero fells the Post in safety; a second attack (on the Pricker, or the Biter) would leave it in the Biter's
    // reach at 10 HP or less, so the Dancer doesn't send it.
    expect(first.fights.filter((f) => f.phase === 'player').map((f) => f.foe)).toEqual(['Post']);
    expect(first.acts.filter((a) => a.kind === 'dance')).toEqual([]);
    expect(first.fights.filter((f) => f.phase === 'enemy').every((f) => f.survive === 1)).toBe(true);
  });
});

describe('baits and bosses (realism pass)', () => {
  // Hits every time for 9 (Str 3 + Iron Axe 7, less the sword's triangle edge), never crits; 40 HP.
  const axe: Foe = { ...brute, name: 'Axe', count: 2, stats: stats(40, 3, 0, 0, 0, 60, 0, 0), skills: ['Hawkeye'] };
  // 15 HP: lives through one Axe's hit, not two. Its counter hurts but never fells one.
  const tank = (name: string): Fighter => ({ name, className: 'Myrmidon', stats: stats(15, 10, 0, 60, 0, 0, 0, 0), skills: [], weapon: weapon('Iron Sword') });
  // 5 HP: one hit fells it.
  const fragile: Fighter = { ...tank('Page'), stats: stats(5, 10, 0, 60, 0, 0, 0, 0) };

  it('lets every front that lives through the enemy phase in reach wait there as bait, and keeps the rest out of reach', () => {
    const play = engine.playMap({ map: rout([group(axe)]), lineup: [solo(tank('Wall')), solo(tank('Rock')), solo(fragile)] }, 1);
    const first = play.log[0]!;
    // Attacking would leave either tank too low for the other Axe: neither attacks, both wait in reach.
    expect(first.acts.map((a) => [a.kind, a.unit])).toEqual([
      ['bait', 'wall'],
      ['bait', 'rock'],
    ]);
    // The baits moved the map on: the Page stays out of reach, and nobody died.
    expect(first.exposed).toEqual(['wall', 'rock']);
    expect(first.fights.map((f) => [f.phase, f.lead, f.survive])).toEqual([
      ['enemy', 'wall', 1],
      ['enemy', 'rock', 1],
    ]);
  });

  it('lets a wall draw the foes it can surely take, up to the four next to it, each countering: fewer turns', () => {
    // Each Axe hit takes 10. 70 HP: after its own attack's counter (60), four more hits leave it standing, and a fifth
    // would too, but only four foes stand next to it. The 15 HP tank lives through one hit, not two.
    const wall: Fighter = { ...tank('Wall'), stats: stats(70, 10, 0, 60, 0, 0, 0, 0) };
    const five = rout([group({ ...axe, count: 5 })]);
    const play = engine.playMap({ map: five, lineup: [solo(wall)] }, 1);
    const enemy = (t: number) => play.log[t]!.fights.filter((f) => f.phase === 'enemy');
    expect(enemy(0).map((f) => [f.lead, f.survive])).toEqual([
      ['wall', 1],
      ['wall', 1],
      ['wall', 1],
      ['wall', 1],
    ]);
    expect(play.log[0]!.noDeath).toBe(1);
    expect(play.blindSpots).toContain('walls-draw-foes');
    // Two hits would fell the 15 HP tank for sure: it takes one attack, as the one-attacker model has it.
    const one = engine.playMap({ map: five, lineup: [solo(tank('Rock'))] }, 1);
    expect(one.log[0]!.fights.filter((f) => f.phase === 'enemy')).toHaveLength(1);
    expect(one.blindSpots).not.toContain('walls-draw-foes');
  });

  it('works out a second attack in one enemy phase over every HP the first can leave, not from its likely result', () => {
    // A 55% hitter dealing 15 on a 30 HP tank: from the likely HP after one attack (about 22) a second can't kill, but
    // both landing (30%) does. The stress case's second attacker reads the true risk.
    const heavy: Foe = { ...brute, name: 'Heavy', count: 2, stats: stats(60, 18, 0, 0, 0, 60, 15, 0) };
    const tank2: Fighter = { name: 'Tank', className: 'Myrmidon', stats: stats(30, 15, 0, 60, 30, 0, 10, 0), skills: [], weapon: weapon('Iron Sword') };
    const q = matchup(tank2, undefined, null, heavy).foeHit / 100;
    const play = engine.playMap({ map: rout([group(heavy)]), lineup: [solo(tank2)], stress: 'two-attackers' }, 1);
    const first = play.log[0]!.fights.filter((f) => f.phase === 'enemy');
    expect(first).toHaveLength(2);
    expect(first[0]!.survive).toBe(1);
    expect(first[1]!.survive).toBeCloseTo(1 - q * q, 9);
  });

  it('reads when each foe begins moving from the chapter data’s AI notes', () => {
    const at = (id: string, d: 'normal' | 'lunatic') => Object.fromEntries(engine.simMap(id, d).foes.map((g) => [g.key, g.moves ?? 1]));
    // Chapter 1: every Risen moves at once. Chapter 7 (Normal): the Plegians begin on turn 6. Chapter 3 (Lunatic): the
    // Feroxi wait until provoked.
    expect(new Set(Object.values(at('chapter-1', 'lunatic')))).toEqual(new Set([1]));
    expect(at('chapter-7', 'normal').Plegian).toBe(6);
    expect(at('chapter-3', 'lunatic').Feroxi).toBe(Infinity);
  });

  it('lets a foe that waits attack nobody until its turn, or until attacked, and then only its attacker', () => {
    // Two Axes that hit hard for the tank alone: the waiting one stays out of the fight until turn 3.
    const late = group({ ...axe, name: 'Late', count: 1 }, { moves: 3 });
    const play = engine.playMap({ map: rout([late]), lineup: [solo(tank('Wall'))] }, 1);
    const enemyAt = (t: number) => play.log[t - 1]?.fights.filter((f) => f.phase === 'enemy').length ?? 0;
    expect(play.log[0]!.fights.filter((f) => f.phase === 'player')).toHaveLength(1);
    // Attacked on turn 1 it moves: it counters and attacks its attacker that enemy phase.
    expect(enemyAt(1)).toBe(1);
    expect(play.blindSpots).toContain('foes-wait');
    // A waiting foe nobody attacks (the tank can't hurt it, so it chips a post instead): no attack from it until its
    // turn, then it comes at the tank in reach.
    const post: Foe = { ...brute, name: 'Target', weapon: undefined, count: 1, stats: stats(200, 0, 0, 0, 0, 60, 0, 0) };
    const hard = group({ ...axe, name: 'Late', count: 1, stats: { ...axe.stats, def: 99 } }, { moves: 3 });
    const idle = engine.playMap({ map: rout([group(post), hard]), lineup: [solo(tank('Rock'))] }, 1);
    const lateAt = (t: number) => idle.log[t - 1]!.fights.filter((f) => f.phase === 'enemy' && f.foe === 'Late').length;
    expect([lateAt(1), lateAt(2), lateAt(3)]).toEqual([0, 0, 1]);
  });

  // A boss that holds and a stream of harmless posts that never ends: waiting for the field to clear never ends either.
  const post: Foe = { ...brute, name: 'Post', weapon: undefined, count: 3, stats: stats(10, 0, 0, 0, 0, 60, 0, 0) };
  const endless = (boss: Foe): SimMap => ({
    id: 'test',
    victory: 'boss',
    foes: [group(boss, { target: true }), group(post)],
    waves: [{ label: 'endless', turns: [], everyTurnFrom: 1, perTurn: 2, joins: 'turn-start', groups: [group({ ...post, name: 'More', count: 1 })] }],
    skipped: [],
  });

  it('goes for the boss from the start when reinforcements never stop', () => {
    const chief: Foe = { ...brute, name: 'Chief', boss: true, weapon: undefined, stats: stats(20, 0, 0, 0, 0, 60, 0, 0) };
    const play = engine.playMap({ map: endless(chief), lineup: [solo(hero)] }, 1);
    expect(play).toMatchObject({ ended: 'boss', turns: 1 });
  });

  it('presses a boss that fights back when reinforcements never stop: waiting only lets the field fill', () => {
    // The Brute's counter is a real risk (over the 1% a careful player takes for free), and the posts are free kills.
    // The hero fells posts while the boss's risk is first read; once the field has filled (more posts than it started
    // with) and that risk hasn't fallen since the turn before, the boss is pressed every turn, and falls: no stall.
    const chief: Foe = { ...brute, name: 'Chief', boss: true };
    const play = engine.playMap({ map: endless(chief), lineup: [solo(hero)] }, 1);
    expect(play.ended).toBe('boss');
    expect(play.log.map((t) => t.fights.filter((f) => f.phase === 'player').map((f) => f.foe))).toEqual([['Post'], ['Post'], ['Chief'], ['Chief']]);
  });

  it('counts damage on the target boss as part of the victory: it chips the boss before felling posts', () => {
    // 60 HP, Def 10: the hero's round (5 a hit, doubled) takes 10 of it; posts fall to one strike.
    const chief: Foe = { ...brute, name: 'Chief', boss: true, weapon: undefined, stats: stats(60, 0, 0, 0, 0, 60, 10, 0) };
    const play = engine.playMap({ map: endless(chief), lineup: [solo(hero)] }, 1);
    expect(new Set(play.log.flatMap((t) => t.fights.map((f) => f.foe)))).toEqual(new Set(['Chief']));
    expect(play.ended).toBe('boss');
  });
});
