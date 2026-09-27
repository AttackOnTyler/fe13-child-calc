import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, STARTING_GOLD, STATS, bestWeapon, createEngine, itemByName, resolveAssumptions, runFromRoster, withRun, type ArmyUnit, type Foe, type MapPlayInput, type RunSimMap, type SimFoeGroup, type SimMap, type SimUnit, type Stat } from './index';

/**
 * Gold, upkeep and the shopping list in the simulated runs (#190): hand-built armies and maps whose uses and gold can be
 * worked by hand.
 */
const engine = createEngine();
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const myrmidon = engine.classGrowths('myrmidon', 'M');
/** No level-ups: every growth (personal + class) 0. */
const flat = Object.fromEntries(STATS.map((s) => [s, -myrmidon[s]])) as Record<Stat, number>;
const item = (name: string) => itemByName(name)!;

// Kills a dummy with one hit (Str 15 + Iron Sword 5 = 20 = its HP) and never misses it.
const hero = (more: Partial<ArmyUnit> = {}): ArmyUnit => ({
  id: 'lonqu',
  name: 'Hero',
  gender: 'M',
  classId: 'myrmidon',
  level: 5,
  exp: 0,
  count: 0,
  bonus: 0,
  stats: stats(20, 15, 0, 27, 28, 0, 0, 0),
  growths: flat,
  modifiers: { str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 },
  skills: [],
  weapons: [{ item: item('Iron Sword') }],
  supports: [],
  role: 'lead',
  ...more,
});

/** A Fighter that never fights back (no weapon) and never dodges. */
const dummy = (count: number, hp = 20): Foe => ({ name: `Dummy ${hp}`, className: 'Fighter', count, stats: stats(hp, 0, 0, 0, 0, 0, 0, 0), weapon: undefined, skills: [], boss: false, level: 5 });
const group = (foe: Foe): SimFoeGroup => ({ key: foe.name, foe });
const rout = (id: string, foes: Foe[]): SimMap => ({ id, victory: 'rout', foes: foes.map(group), waves: [], skipped: [] });
const step = (map: SimMap, more: Partial<RunSimMap> = {}): RunSimMap => ({ key: map.id, label: map.id, map, deploy: 1, forced: [], joining: [], mapOnly: [], later: [], masterSeals: false, ...more });
const sells = (...rows: [string, number][]) => rows.map(([name, cost]) => ({ item: name, cost, where: 'Somewhere' }));

const simUnit = (a: ArmyUnit): SimUnit => ({ id: a.id, fighter: { name: a.name, className: 'Myrmidon', stats: a.stats, skills: a.skills, weapon: a.weapons[0] }, weapons: a.weapons, ...(a.items ? { items: a.items } : {}) });
const upkeep = (input: MapPlayInput, e = engine) => e.mapUpkeep(input, e.playMap(input, 1));
const uses = (u: ReturnType<typeof upkeep>, unit: string, name: string) => u.get(unit)?.get(name) ?? 0;

describe('upkeep: uses spent per hit (#190)', () => {
  it('spends one use of the weapon that hit, for each hit', () => {
    const u = upkeep({ map: rout('a', [dummy(4)]), lineup: [{ lead: simUnit(hero()), support: null }] });
    expect(uses(u, 'lonqu', 'Iron Sword')).toBe(4);
    // A foe that takes two hits to fall: two uses each.
    const two = upkeep({ map: rout('a', [dummy(3, 40)]), lineup: [{ lead: simUnit(hero()), support: null }] });
    expect(uses(two, 'lonqu', 'Iron Sword')).toBe(6);
  });

  it('saves each use at Luck × 2% with Armsthrift', () => {
    const thrifty = hero({ skills: ['Armsthrift'], stats: stats(20, 15, 0, 27, 28, 25, 0, 0) });
    expect(uses(upkeep({ map: rout('a', [dummy(4)]), lineup: [{ lead: simUnit(thrifty), support: null }] }), 'lonqu', 'Iron Sword')).toBeCloseTo(2, 9);
    const certain = hero({ skills: ['Armsthrift'], stats: stats(20, 15, 0, 27, 28, 50, 0, 0) });
    expect(uses(upkeep({ map: rout('a', [dummy(4)]), lineup: [{ lead: simUnit(certain), support: null }] }), 'lonqu', 'Iron Sword')).toBe(0);
  });

  it('makes the back pay for its Dual Strikes with its own weapon', () => {
    // Axe-wielding foes (22 a hit) that the tough lead shrugs off (2 a hit) but that kill the frail back alone: the pair
    // stays together (#183), and the lead fells each in its two hits.
    const axe: Foe = { name: 'Axe', className: 'Fighter', count: 10, stats: stats(40, 14, 0, 0, 0, 0, 0, 0), weapon: item('Iron Axe'), skills: [], boss: false, level: 5 };
    const back = hero({ id: 'vaike', name: 'Back', stats: stats(10, 15, 0, 27, 28, 0, 0, 0), weapons: [{ item: item('Steel Sword') }] });
    const lead = hero({ stats: stats(60, 15, 0, 27, 28, 0, 20, 0) });
    const pair = { lead: simUnit(lead), back: simUnit(back), support: 'A' as const };
    const input = { map: rout('a', [axe]), lineup: [pair] };
    const u = upkeep(input);
    const m = bestWeapon(pair.lead.fighter, pair.lead.weapons, pair.back.fighter, 'A', axe, [])!.result;
    // Sword beats axe: 21 a hit, two to fell one.
    expect(m).toMatchObject({ hit: 100, hits: 2, damage: 21 });
    expect(m.dualStrikeRate).toBeGreaterThan(0);
    const fights = engine.playMap(input, 1).log.flatMap((t) => t.fights);
    const paired = fights.filter((f) => f.phase === 'player' && f.back === 'vaike');
    expect(paired.length).toBeGreaterThan(0);
    expect(paired.every((f) => f.lead === 'lonqu' && f.kill)).toBe(true);
    // Each player-phase fight takes the lead's two hits; each may bring a Dual Strike, landing at the back's hit
    // chance, on the back's own weapon. Enemy phase (the back guards) costs it nothing.
    expect(uses(u, 'vaike', 'Steel Sword')).toBeCloseTo(paired.length * 2 * (m.dualStrikeRate / 100) * (m.backHit / 100), 9);
    expect(uses(u, 'lonqu', 'Iron Sword')).toBeGreaterThanOrEqual(paired.length * 2);
  });

  it('spends a use on a tome’s miss by default, an open rule', () => {
    const mage = hero({ stats: stats(20, 0, 20, 0, 28, 0, 0, 0), weapons: [{ item: item('Fire') }] });
    // Hit 70%, doubling, and one hit fells each: it strikes again only after a miss, 1.3 strikes a foe.
    const dodgy = { ...dummy(4), stats: stats(20, 0, 0, 0, 10, 10, 0, 0) };
    const input = { map: rout('a', [dodgy]), lineup: [{ lead: simUnit(mage), support: null }] };
    expect(bestWeapon(input.lineup[0]!.lead.fighter, input.lineup[0]!.lead.weapons, undefined, null, dodgy, [])!.result).toMatchObject({ hit: 70, hits: 2 });
    expect(uses(upkeep(input), 'lonqu', 'Fire')).toBeCloseTo(4 * 1.3, 9);
    // Free misses: only the 70% that land.
    const free = createEngine(resolveAssumptions({ 'tome-miss-use': 'free' }));
    expect(uses(upkeep(input, free), 'lonqu', 'Fire')).toBeCloseTo(4 * 1.3 * 0.7, 9);
    expect(engine.assumptions().find((a) => a.id === 'tome-miss-use')).toMatchObject({ isDefault: true, current: 'Spends a use (the series rule)' });
  });

  it('spends one use of a staff or potion each time it’s used', () => {
    const wall: Foe = { name: 'Wall', className: 'Fighter', count: 1, stats: stats(200, 13, 0, 0, 0, 60, 15, 0), weapon: item('Iron Axe'), skills: [], boss: false, level: 1 };
    const tank = simUnit(hero({ stats: stats(30, 15, 0, 60, 30, 0, 10, 0), items: [{ item: item('Vulnerary'), uses: 3 }] }));
    const input = { map: rout('a', [wall]), lineup: [{ lead: tank, support: null }] };
    const drunk = engine.playMap(input, 1).units['lonqu']!.used['Vulnerary'] ?? 0;
    expect(drunk).toBeGreaterThan(0);
    expect(uses(upkeep(input), 'lonqu', 'Vulnerary')).toBe(drunk);
  });
});

describe('gold and the shopping list in the simulated runs (#190)', () => {
  const sim = (army: ArmyUnit[], maps: RunSimMap[], gold: number, more: object = {}, runs = 1) => engine.simulateRuns({ army, maps, difficulty: 'normal', gold, ...more }, 1, runs);

  it('adds each map’s sure income at its end, and shows gold per map as a range', () => {
    const r = sim([hero()], [step(rout('a', [dummy(1)]), { income: 3000 }), step(rout('b', [dummy(1)]))], 1000, {}, 4);
    expect(r.maps[0]!.gold).toEqual({ low: 4000, median: 4000, high: 4000 });
    expect(r.maps[1]!.gold).toEqual({ low: 4000, median: 4000, high: 4000 });
  });

  it('starts a run with nothing logged at the game’s 5,000G', () => {
    const run = runFromRoster(withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' }));
    const r = engine.flawlessChance(run, { runs: 1 });
    expect(r.goldUnrecorded).toBe(false);
    expect(r.maps[0]!.gold!.median).toBe(STARTING_GOLD + engine.mapIncome(r.maps[0]!.key));
  });

  it('counts only Bullion (and Paralogue 13’s gold) as income, and only what no play can lose', () => {
    // Paralogue 8's Bullion (M) chest sells for 5,000G; its Dracoshield and Short Spear are held, not sold.
    expect(engine.mapIncome('paralogue-8')).toBe(5000);
    // Chapter 10's Bullion rides with an escaping Thief: not counted until side goals are chased (#191).
    expect(engine.mapGold('chapter-10').some((g) => g.kind === 'bullion')).toBe(true);
    expect(engine.mapIncome('chapter-10')).toBe(engine.mapGold('chapter-10').filter((g) => !g.play).reduce((a, g) => a + g.gold, 0));
    expect(engine.mapIncome('chapter-11')).toBe(0);
  });

  it('rebuys at the last armory stop before a weapon would run dry, where it’s sold', () => {
    // Five uses: map a spends four; map b would spend four more.
    const worn = hero({ weaponUses: [5] });
    const maps = (armoryB = sells(['Iron Sword', 520])) => [step(rout('a', [dummy(4)]), { armory: sells(['Iron Sword', 520]) }), step(rout('b', [dummy(4)]), { armory: armoryB }), step(rout('c', []))];
    const r = sim([worn], maps(), 1000);
    expect(r.shopping.map((s) => s.key)).toEqual(['a', 'b']);
    // Not at a: five uses cover map a. At b: one use left, four to spend.
    expect(r.shopping[0]!.lines).toEqual([]);
    expect(r.shopping[1]!.lines).toEqual([{ kind: 'rebuy', action: 'buy', item: 'Iron Sword', unit: 'lonqu', name: 'Hero', cost: 520, share: 1 }]);
    expect(r.shopping[1]!.gold.median).toBe(1000);
    expect(r.maps[1]!.gold!.median).toBe(480);
    // Not sold at b: nothing bought, and the sword breaks on map b (map c's lineup still fields the Hero, unarmed).
    const unsold = sim([worn], maps(sells(['Iron Lance', 560])), 1000);
    expect(unsold.shopping[1]!.lines).toEqual([]);
    expect(unsold.maps[1]!.gold!.median).toBe(1000);
    // Short of gold: skipped.
    expect(sim([worn], maps(), 500).shopping[1]!.lines).toEqual([]);
  });

  it('replaces a weapon running dry that the armory doesn’t sell with the nearest one of its kind it does (realism pass)', () => {
    // A Killing Edge (Mt 9) with five uses; the armory sells swords but no Killing Edge: the Steel Sword (Mt 8, rank C
    // like the Edge) rather than the Silver Sword (rank B, past what a Lv 5 Myrmidon holding a C sword can wield).
    const worn = hero({ weapons: [{ item: item('Killing Edge') }], weaponUses: [5] });
    const armory = sells(['Iron Sword', 520], ['Steel Sword', 1000], ['Silver Sword', 1410]);
    const maps = [step(rout('a', [dummy(4)])), step(rout('b', [dummy(4)]), { armory }), step(rout('c', [dummy(4)]))];
    const r = sim([worn], maps, 3000);
    expect(r.shopping[0]!.lines.filter((l) => l.kind === 'rebuy')).toEqual([{ kind: 'rebuy', action: 'buy', item: 'Steel Sword', unit: 'lonqu', name: 'Hero', cost: 1000, share: 1 }]);
    // Armed on map c: it routs it.
    expect(r.maps[2]!.turns).toBe(4);
  });

  it('hands a weapon its holder can’t wield to a unit that can, in the preparations: Vaike’s Iron Axe from Miriel (realism pass)', () => {
    const fighter = engine.classGrowths('fighter', 'M');
    const mage = engine.classGrowths('mage', 'F');
    const vaike = hero({ id: 'vaike', name: 'Vaike', classId: 'fighter', weapons: [], growths: Object.fromEntries(STATS.map((s) => [s, -fighter[s]])) as Record<Stat, number> });
    const miriel = hero({ id: 'miriel', name: 'Miriel', gender: 'F', classId: 'mage', weapons: [{ item: item('Fire') }, { item: item('Iron Axe') }], growths: Object.fromEntries(STATS.map((s) => [s, -mage[s]])) as Record<Stat, number> });
    // Vaike alone on map b: armed, he fells the dummies; unarmed he'd stall.
    const maps = [step(rout('a', [])), step(rout('b', [dummy(3)]), { forced: ['vaike'] })];
    const r = sim([vaike, miriel], maps, 0);
    expect(r.maps[1]!.turns).toBe(3);
    expect(r.exp.find((m) => m.key === 'b')!.units.find((u) => u.unit === 'vaike')!.kills).toEqual({ 'Dummy 20': 3 });
    // No preparations on the way (the early forced maps): no hand-over yet.
    const early = sim([vaike, miriel], maps.map((m) => ({ ...m, noPreparations: true })), 0);
    expect(early.exp.find((m) => m.key === 'b')!.units.find((u) => u.unit === 'vaike')?.kills ?? {}).toEqual({});
  });

  it('arms the lineup on the way with weapons off the shelf within its rank, keeping gold for the plan’s seals (realism pass)', () => {
    // 44 HP: an Iron Sword's round (20 a hit, doubled) leaves it standing; a Steel Sword's (23, doubled) fells it.
    const tough = dummy(2, 44);
    const armory = sells(['Steel Sword', 1000], ['Silver Sword', 1410], ['Vulnerary', 300]);
    const maps = [step(rout('a', [tough]), { armory }), step(rout('end', []))];
    const veteran = hero({ level: 10 });
    const lines = sim([veteran], maps, 5000).shopping[0]!.lines;
    expect(lines.map((l) => [l.kind, l.action, l.item])).toEqual(
      expect.arrayContaining([
        ['arms', 'buy', 'Steel Sword'],
        ['arms', 'buy', 'Vulnerary'],
      ]),
    );
    // A Lv 10 base class holding a D sword wields up to C: no Silver Sword, and nothing forged on the way.
    expect(lines.some((l) => l.item === 'Silver Sword' || l.action === 'forge')).toBe(false);
    // The Myrmidon's promotion still needs a Master Seal (2,500G): with 3,000G only the Vulnerary fits under it.
    expect(sim([veteran], maps, 3000).shopping[0]!.lines.map((l) => l.item)).toEqual(['Vulnerary']);
  });

  it('buys a Master Seal at its price only when the run holds none, where an armory sells it, with gold enough', () => {
    const capped = hero({ level: 20 });
    const maps = (armory = sells(['Master Seal', 2500])) => [step(rout('a', []), { armory }), step(rout('end', []))];
    const bought = sim([capped], maps(), 3000);
    expect(bought.shopping[0]!.lines).toEqual([{ kind: 'seal', action: 'buy', item: 'Master Seal', unit: 'lonqu', name: 'Hero', cost: 2500, share: 1 }]);
    expect(bought.units[0]!.className).toMatch(/Swordmaster|Assassin/);
    expect(bought.maps[0]!.gold!.median).toBe(500);
    // One held: used, none bought.
    const held = sim([capped], maps(), 3000, { masterSealsHeld: 1 });
    expect(held.shopping[0]!.lines).toEqual([]);
    expect(held.units[0]!.className).toMatch(/Swordmaster|Assassin/);
    // Too little gold, or no armory selling one: it waits in its base class.
    for (const r of [sim([capped], maps(), 2000), sim([capped], maps(sells(['Iron Sword', 520])), 9000)]) {
      expect(r.shopping[0]!.lines).toEqual([]);
      expect(r.units[0]!.className).toBe('Myrmidon');
    }
  });

  it('finds seals only in the armories that sell them: Port Ferox or P8, P12, P13 (Master), the Mila Tree or P6, P10, P16 (Second)', () => {
    const where = (seal: string) => engine.maps().filter((m) => m.shop?.armory.some((a) => a.item === seal && a.cost === 2500)).map((m) => m.id).sort();
    expect(where('Master Seal')).toEqual(['chapter-12', 'paralogue-8', 'paralogue-12', 'paralogue-13'].sort());
    expect(where('Second Seal')).toEqual(['chapter-16', 'paralogue-6', 'paralogue-10', 'paralogue-16'].sort());
  });

  it('buys the endpoint kit at the endpoint’s stop: the best weapon sold, its +5 Mt forge and a Vulnerary', () => {
    // The Iron Sword can’t one-round a 60 HP foe; a Silver Sword forged +5 (13 + 5 Mt, doubled) does.
    const tough = dummy(2, 60);
    const armory = sells(['Iron Sword', 520], ['Silver Sword', 1410], ['Vulnerary', 300]);
    const maps = [step(rout('a', [dummy(1)])), step(rout('end', [tough]), { armory })];
    const rich = sim([hero()], maps, 50000);
    const kit = rich.shopping.find((s) => s.key === 'end')!.lines;
    expect(kit.map((l) => [l.kind, l.action, l.item])).toEqual(
      expect.arrayContaining([
        ['kit', 'buy', 'Silver Sword'],
        ['kit', 'forge', 'Silver Sword'],
        ['kit', 'buy', 'Vulnerary'],
      ]),
    );
    expect(kit.find((l) => l.action === 'forge')!.cost).toBe(Math.round(7.5 * 1410));
    // The kit fights: the endpoint falls in fewer turns than with the Iron Sword alone.
    const poor = sim([hero()], maps, 0);
    expect(poor.shopping.find((s) => s.key === 'end')!.lines).toEqual([]);
    expect(rich.maps[1]!.turns!).toBeLessThan(poor.maps[1]!.turns!);
  });

  it('drops what wins the fewest matchups per gold when a run is short', () => {
    // An unforged Silver Sword one-rounds these (26 a hit, doubled); the Iron Sword doesn’t.
    const tough = dummy(2, 50);
    const armory = sells(['Silver Sword', 1410], ['Vulnerary', 300]);
    const maps = [step(rout('end', [tough]), { armory })];
    // 1,500G: the Vulnerary (1 matchup for 300G) comes before the sword; the sword then doesn't fit.
    const short = sim([hero()], maps, 1500).shopping[0]!.lines;
    expect(short.map((l) => l.item)).toEqual(['Vulnerary']);
    // 1,710G: both, the forge left out.
    expect(sim([hero()], maps, 1710).shopping[0]!.lines.map((l) => `${l.action} ${l.item}`)).toEqual(['buy Vulnerary', 'buy Silver Sword']);
  });

  it('draws hits in each run, so gold after rebuys is a spread over the runs', () => {
    // Six foes a map, each felled by the first of two strikes that lands (70%): about 5.5 uses a map with free misses.
    // Eleven uses: those left after map a fall short of map b's in some runs, not in others.
    const dodgy = { ...dummy(6), stats: stats(20, 0, 0, 0, 10, 10, 0, 0) };
    const mage = hero({ stats: stats(20, 0, 20, 0, 28, 0, 0, 0), weapons: [{ item: item('Fire') }], weaponUses: [11] });
    const free = createEngine(resolveAssumptions({ 'tome-miss-use': 'free' }));
    const maps = [step(rout('a', [dodgy])), step(rout('b', [dodgy]), { armory: sells(['Fire', 540]) }), step(rout('c', []))];
    const r = free.simulateRuns({ army: [mage], maps, difficulty: 'normal', gold: 1000 }, 1, 16);
    expect(r).toEqual(free.simulateRuns({ army: [mage], maps, difficulty: 'normal', gold: 1000 }, 1, 16));
    const line = r.shopping[0]!.lines[0]!;
    expect(line).toMatchObject({ kind: 'rebuy', item: 'Fire' });
    expect(line.share).toBeGreaterThan(0);
    expect(line.share).toBeLessThan(1);
    expect(r.maps[1]!.gold!.low).toBe(460);
    expect(r.maps[1]!.gold!.high).toBe(1000);
  });
});

describe('what a unit carries into a map (realism pass)', () => {
  it('carries five items, the weapons that deal most to this map’s foes: a Wyrmslayer against wyverns', () => {
    // 30 HP, Def 10, no weapon: a sword's round (10 a hit, doubled) leaves one standing; a Wyrmslayer's (Mt tripled) fells it.
    const wyvern: Foe = { ...dummy(3, 30), name: 'Wyvern', className: 'Wyvern Rider', stats: stats(30, 0, 0, 0, 0, 0, 10, 0) };
    const swords = ['Bronze Sword', 'Iron Sword', 'Steel Sword', 'Killing Edge', 'Rapier', 'Armorslayer', 'Wyrmslayer'].map((n) => ({ item: item(n) }));
    const hoarder = hero({ weapons: swords, items: [{ item: item('Vulnerary'), uses: 3 }] });
    const r = engine.simulateRuns({ army: [hoarder], maps: [step(rout('a', [wyvern]))], difficulty: 'normal' }, 1, 1);
    // One wyvern a turn, each in one round.
    expect(r.maps[0]!.turns).toBe(3);
    expect(r.exp[0]!.units[0]!.kills).toEqual({ Wyvern: 3 });
  });
});

describe('the plan’s builds in the runs (realism pass)', () => {
  it('equips each build skill once the unit has learned it, and the combat math reads it', () => {
    // A foe that hits back: Avoid +10 (a Myrmidon's Lv 1 skill) lowers its hit chance on the hero.
    const biter: Foe = { ...dummy(3, 40), name: 'Biter', weapon: item('Iron Axe'), stats: stats(40, 18, 0, 10, 0, 5, 0, 0) };
    const maps = [step(rout('a', [])), step(rout('b', [biter])), step(rout('end', []))];
    const input = { army: [hero()], maps, difficulty: 'normal' as const };
    const plain = engine.simulateRuns(input, 1, 1);
    const built = engine.simulateRuns({ ...input, builds: { lonqu: ['avoid-plus-10', 'vantage'] } }, 1, 1);
    // Vantage comes at Lv 10: not learned, not equipped.
    expect(built.units[0]!.skills).toEqual(['Avoid +10']);
    expect(plain.units[0]!.skills).toEqual([]);
    expect(built.maps[1]!.noDeath!).toBeGreaterThan(plain.maps[1]!.noDeath!);
  });
});

describe('a map the play can’t win (realism pass)', () => {
  it('counts a map that runs out of turns unwon as not cleared: the run doesn’t get past it', () => {
    // A foe the hero can't hurt and that can't hurt it: nobody dies, and the map is never won.
    const wall: Foe = { ...dummy(1), name: 'Wall', stats: stats(20, 0, 0, 0, 0, 0, 99, 99) };
    const r = engine.simulateRuns({ army: [hero()], maps: [step(rout('a', [wall])), step(rout('b', [dummy(1)]))], difficulty: 'normal' }, 1, 2);
    expect(r.maps[0]).toMatchObject({ reach: 1, noDeath: 0, stalled: 1 });
    expect(r.maps[1]!.reach).toBe(0);
    expect(r.chance).toBe(0);
    // A map it wins reads no stall.
    expect(engine.simulateRuns({ army: [hero()], maps: [step(rout('b', [dummy(1)]))], difficulty: 'normal' }, 1, 2).maps[0]).toMatchObject({ noDeath: 1, stalled: 0 });
  });
});
