import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, NO_PREPARATIONS, STATS, addEntry, createEngine, editEntry, exportRun, fixedPass, importRun, itemByName, resolveAssumptions, runFromRoster, withItemPin, withItemsUsed, withRun, type ArmyUnit, type ChildRecruit, type Foe, type HeldItem, type PlanPin, type Run, type RunSimInput, type RunSimMap, type SimFoeGroup, type SimMap, type Stat } from './index';

/**
 * The item plan in the simulated runs (#193): boosters, tonics and carriers, on hand-built armies and maps whose
 * numbers can be worked by hand.
 */
const engine = createEngine();
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const myrmidon = engine.classGrowths('myrmidon', 'M');
/** No level-ups: every growth (personal + class) 0. */
const flat = Object.fromEntries(STATS.map((s) => [s, -myrmidon[s]])) as Record<Stat, number>;
const item = (name: string) => itemByName(name)!;
const noMods = { str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 };

const hero = (more: Partial<ArmyUnit> = {}): ArmyUnit => ({
  id: 'lonqu',
  name: 'Hero',
  gender: 'M',
  classId: 'myrmidon',
  level: 5,
  exp: 0,
  count: 0,
  bonus: 0,
  stats: stats(20, 13, 0, 60, 28, 0, 0, 0),
  growths: flat,
  modifiers: noMods,
  skills: [],
  weapons: [{ item: item('Iron Sword') }],
  supports: [],
  ...more,
});

/** A foe the Hero doesn't double and always hits, that kills the Hero with its one counter when it lives. */
const brute = (hp: number): Foe => ({ name: `Brute ${hp}`, className: 'Fighter', count: 1, stats: stats(hp, 30, 0, 80, 24, 0, 0, 0), weapon: item('Iron Axe'), skills: [], boss: false, level: 5 });
const group = (foe: Foe): SimFoeGroup => ({ key: foe.name, foe });
const rout = (id: string, foes: Foe[]): SimMap => ({ id, victory: 'rout', foes: foes.map(group), waves: [], skipped: [] });
const step = (map: SimMap, more: Partial<RunSimMap> = {}): RunSimMap => ({ key: map.id, label: map.id, map, deploy: 1, forced: [], joining: [], mapOnly: [], later: [], masterSeals: false, ...more });
const sim = (input: Partial<RunSimInput> & Pick<RunSimInput, 'army' | 'maps'>, runs = 1, e = engine) => e.simulateRuns({ difficulty: 'normal', ...input }, 1, runs);
const strAtEnd = (r: ReturnType<typeof sim>, id = 'lonqu') => r.units.find((u) => u.id === id)!.stats.str.median;
const drop = { id: 'held:Energy Drop#0', item: 'Energy Drop' };
const drink = (unit: ArmyUnit['id'] = 'lonqu', source = drop.id) => ({ kind: 'booster' as const, item: 'Energy Drop', unit, source });

describe('boosters (#193)', () => {
  it('add +2 from their map on, and the use reports the share of runs that made it', () => {
    const maps = [step(rout('a', []), { uses: [drink()] }), step(rout('end', []))];
    const r = sim({ army: [hero()], maps, held: [drop] });
    expect(strAtEnd(r)).toBe(15);
    expect(r.items).toEqual([{ ...drink(), key: 'a', label: 'a', share: 1 }]);
    // Not held: no use made, no stat.
    const none = sim({ army: [hero()], maps });
    expect(strAtEnd(none)).toBe(13);
    expect(none.items[0]!.share).toBe(0);
  });

  it('can turn a map: 13 Str + Iron Sword 5 misses a 20 HP foe’s one round; 15 fells it', () => {
    const maps = [step(rout('a', [brute(20)]), { uses: [drink()] })];
    expect(sim({ army: [hero()], maps: [step(rout('a', [brute(20)]))] }).chance).toBeLessThan(0.5);
    expect(sim({ army: [hero()], maps, held: [drop] }).chance).toBe(1);
  });

  it('are clamped at the cap (wasted there), or refused and kept under the open rule', () => {
    const cap = engine.classMaxStats('myrmidon', 'M').str;
    const near = hero({ stats: stats(20, cap - 1, 0, 60, 28, 0, 0, 0) });
    const maps = [step(rout('a', []), { uses: [drink()] }), step(rout('b', []), { uses: [drink('lonqu')] }), step(rout('end', []))];
    const r = sim({ army: [near], maps, held: [drop] });
    expect(strAtEnd(r)).toBe(cap);
    const refused = createEngine(resolveAssumptions({ 'booster-at-cap': 'refused' }));
    const capped = hero({ stats: stats(20, cap, 0, 60, 28, 0, 0, 0) });
    expect(sim({ army: [capped], maps, held: [drop] }, 1, refused).items.map((u) => u.share)).toEqual([0, 0]);
    expect(sim({ army: [capped], maps, held: [drop] }).items.map((u) => u.share)).toEqual([1, 0]);
  });

  it('arrive after their map, a side goal’s only in the runs that secure its part', () => {
    const find = { id: 'a:Energy Drop#0', item: 'Energy Drop' };
    const goal = (chase: boolean) => [{ id: 'g', label: 'a: Thief', chase, parts: [{ chase: { id: 'g#0', actions: 1, by: 5 }, gold: 0, seals: { master: 0, second: 0 } }] }];
    const maps = (chase: boolean, sure = false) => [
      step(rout('a', [brute(1)]), { finds: [sure ? find : { ...find, part: 'g#0' }], sideGoals: goal(chase) }),
      step(rout('b', []), { uses: [drink('lonqu', find.id)] }),
      step(rout('end', [])),
    ];
    expect(sim({ army: [hero()], maps: maps(false, true) }).items[0]!.share).toBe(1);
    expect(sim({ army: [hero()], maps: maps(true) }).items[0]!.share).toBe(1);
    expect(sim({ army: [hero()], maps: maps(false) }).items[0]!.share).toBe(0);
  });

  it('are drunk only in a preparation phase', () => {
    const r = sim({ army: [hero()], maps: [step(rout('a', []), { uses: [drink()], noPreparations: true }), step(rout('end', []))], held: [drop] });
    expect(r.items[0]!.share).toBe(0);
    expect(strAtEnd(r)).toBe(13);
  });
});

describe('a parent’s booster before paralogue entry (#193)', () => {
  const greatLord = engine.classGrowths('great-lord', 'M');
  const chrom = hero({
    id: 'chrom',
    name: 'Chrom',
    classId: 'great-lord',
    level: 10,
    stats: stats(52, 27, 7, 27, 31, 27, 23, 14),
    growths: Object.fromEntries(STATS.map((s) => [s, -greatLord[s]])) as Record<Stat, number>,
    skills: ['Dual Strike+', 'Charm', 'Aether'],
  });
  const sumia = hero({ id: 'sumia', name: 'Sumia', gender: 'F', classId: 'dark-flier', level: 10, stats: stats(46, 24, 16, 37, 37, 30, 10, 25), skills: ['Speed +2', 'Relief', 'Galeforce'], weapons: [] });
  const lucina: ChildRecruit = { id: 'lucina', name: 'Lucina', parents: ['chrom', 'sumia'], fixed: [fixedPass('chrom', 'F'), undefined], growths: flat, modifiers: noMods, weapons: [{ item: item('Parallel Falchion') }] };
  const robe = { id: 'held:Seraph Robe#0', item: 'Seraph Robe' };
  const maps = [step(rout('chapter-13', []), { children: [lucina], uses: [{ kind: 'booster', item: 'Seraph Robe', unit: 'chrom', source: robe.id }] }), step(rout('end', []), { deploy: 3 })];
  const lucinaHp = (e = engine) => sim({ army: [chrom, sumia], maps, married: [['chrom', 'sumia']], held: [robe] }, 1, e).units.find((u) => u.id === 'lucina')!.stats.hp.median;

  it('feeds the child’s join stats: Chrom’s HP 52 → 57 lifts Lucina’s from 38 to 40', () => {
    // floor((57 − 23 + (46 − 19) + 12) / 3) + 16 = 40, against 38 from Chrom's 52 (the #187 fixture).
    expect(lucinaHp()).toBe(40);
  });

  it('doesn’t, under the open rule’s alternative', () => {
    expect(lucinaHp(createEngine(resolveAssumptions({ 'booster-to-child': 'not' })))).toBe(38);
  });
});

describe('tonics (#193)', () => {
  const tonic = (unit: ArmyUnit['id'] = 'lonqu', source = 'buy') => ({ kind: 'tonic' as const, item: 'Strength Tonic', unit, source });
  const sells = [{ item: 'Strength Tonic', cost: 150, where: 'Somewhere' }];

  it('are bought through the shopping list where sold, and add +2 for that map only', () => {
    const maps = [step(rout('a', [brute(20)]), { uses: [tonic()], armory: sells }), step(rout('end', []))];
    const r = sim({ army: [hero()], maps, gold: 1000 });
    expect(r.chance).toBe(1);
    expect(r.shopping[0]!.lines).toEqual([{ kind: 'tonic', action: 'buy', item: 'Strength Tonic', unit: 'lonqu', name: 'Hero', cost: 150, share: 1 }]);
    expect(r.maps[0]!.gold!.median).toBe(850);
    // Gone after the map.
    expect(strAtEnd(r)).toBe(13);
    // Not sold, not held, or no gold: not drunk.
    expect(sim({ army: [hero()], maps: [step(rout('a', [brute(20)]), { uses: [tonic()] })], gold: 1000 }).items[0]!.share).toBe(0);
    expect(sim({ army: [hero()], maps, gold: 100 }).items[0]!.share).toBe(0);
    // A held one is drunk first, and nothing is bought.
    const held = sim({ army: [hero()], maps, gold: 1000, held: [{ id: 'held:Strength Tonic#0', item: 'Strength Tonic' }] });
    expect(held.chance).toBe(1);
    expect(held.shopping[0]!.lines).toEqual([]);
  });

  it('pass the cap, and the same tonic twice doesn’t stack unless the open rule says so', () => {
    const cap = engine.classMaxStats('myrmidon', 'M').str;
    const capped = hero({ stats: stats(20, cap, 0, 60, 28, 0, 0, 0) });
    const maps = [step(rout('a', []), { uses: [tonic(), tonic()], armory: sells }), step(rout('end', []))];
    expect(sim({ army: [capped], maps, gold: 1000 }).items.map((u) => u.share)).toEqual([1, 0]);
    expect(sim({ army: [capped], maps, gold: 1000 }, 1, createEngine(resolveAssumptions({ 'tonic-stacking': 'stacks' }))).items.map((u) => u.share)).toEqual([1, 1]);
    // Passing the cap: a capped Hero with the tonic fells a foe it can't without.
    const tough = brute(cap + 5 + 2);
    expect(sim({ army: [capped], maps: [step(rout('a', [tough]), { uses: [tonic()], armory: sells })], gold: 1000 }).chance).toBe(1);
    expect(sim({ army: [capped], maps: [step(rout('a', [tough]))] }).chance).toBeLessThan(0.5);
  });

  it('are left out when items can’t be used in preparations, an open rule', () => {
    const maps = [step(rout('a', []), { uses: [tonic()], armory: sells })];
    expect(sim({ army: [hero()], maps, gold: 1000 }, 1, createEngine(resolveAssumptions({ 'item-in-preparations': 'not-in-preparations' }))).items[0]!.share).toBe(0);
  });
});

describe('carriers (#193)', () => {
  const blade = { id: 'held:convoy:Steel Sword#0', item: 'Steel Sword', weapon: { item: item('Steel Sword') }, uses: 30 };
  const carry = (unit: ArmyUnit['id'], key = blade.id) => ({ kind: 'carry' as const, item: 'Steel Sword', unit, source: key });

  it('hand a convoy weapon to its carrier, who fights with it from that map', () => {
    // 13 Str + Steel Sword 8 = 21 fells a 20 HP brute in one round; the Iron Sword doesn't.
    const maps = [step(rout('a', [brute(20)]), { uses: [carry('lonqu')] })];
    expect(sim({ army: [hero()], maps, held: [blade] }).chance).toBe(1);
    expect(sim({ army: [hero()], maps }).chance).toBeLessThan(0.5);
  });

  it('move a weapon from its holder to the next carrier, with no reserve floor', () => {
    const vaike = hero({ id: 'vaike', name: 'Vaike', weapons: [{ item: item('Iron Sword') }] });
    const owned = { ...blade, id: 'held:lonqu:Steel Sword#0', holder: 'lonqu' as const };
    const lonqu = hero({ weapons: [{ item: item('Iron Sword') }, { item: item('Steel Sword') }] });
    const maps = [step(rout('a', []), { uses: [carry('vaike', owned.id)] }), step(rout('b', [brute(20)]), { forced: ['vaike'] })];
    expect(sim({ army: [lonqu, vaike], maps, held: [owned] }).maps[1]!.noDeath).toBe(1);
    expect(sim({ army: [lonqu, vaike], maps: [step(rout('a', [])), maps[1]!] }).maps[1]!.noDeath).toBeLessThan(0.5);
  });
});

describe('the item plan of a recorded run (#193)', () => {
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  /** A fresh run whose start holds these items in the convoy. */
  const holding = (...items: HeldItem[]): Run => editEntry(runFromRoster(facts), 'e1', (s) => ({ ...s, convoy: items }), 1);
  const one = (item: string): HeldItem => ({ item, uses: 1 });
  const steps = engine.mapOrder(runFromRoster(facts)).steps;
  const keyIndex = (key: string) => steps.findIndex((s) => s.key === key);
  const run = holding(one('Energy Drop'), one('Boots'), one('Arms Scroll'));
  const plan = engine.seedPlan(run);
  const rows = engine.itemPlan(run, plan).rows;
  const row = (item: string, r = rows) => r.find((x) => x.item === item)!;

  it('plans every held booster for a wishlist unit, on a map with a preparation phase', () => {
    const drop = row('Energy Drop');
    expect(drop.after).toBeUndefined();
    expect(drop.uses).toHaveLength(1);
    const use = drop.uses[0]!;
    expect(plan.wishlist.units.map((u) => u.unit)).toContain(use.unit);
    expect(NO_PREPARATIONS.has(steps[keyIndex(use.key)]!.map)).toBe(false);
    // Items picked up ahead are rows too, each after its map.
    const ahead = rows.filter((r) => r.after);
    expect(ahead.length).toBeGreaterThan(0);
    expect(ahead.every((r) => keyIndex(r.after!) >= 0)).toBe(true);
  });

  it('leaves Boots outside the model and the Arms Scroll without a rank to unlock, each with its sell price', () => {
    expect(row('Boots')).toMatchObject({ uses: [], idle: 'outside-model', sell: 1250 });
    expect(row('Arms Scroll')).toMatchObject({ uses: [], idle: 'no-rank', sell: 1250 });
  });

  it('shows each use’s arrival chance from the plan’s flawless chance', () => {
    const chance = engine.flawlessChance(run, { plan, runs: 2 });
    const drop = row('Energy Drop', engine.itemPlan(run, plan, { chance }).rows);
    expect(drop.arrival).toBe(chance.items.find((u) => u.source === drop.source)!.share);
    expect(drop.arrival).toBe(1);
  });

  it('lets a booster pin and a carrier pin override the plan, Boots included', () => {
    const chapter5 = steps.find((s) => s.map === 'chapter-5')!.key;
    const pins: PlanPin[] = [
      { kind: 'booster', item: 'Energy Drop', unit: 'frederick', key: chapter5 },
      { kind: 'booster', item: 'Boots', unit: 'chrom' },
    ];
    const pinned = engine.seedPlan(run, { pins });
    const pinnedRows = engine.itemPlan(run, pinned, { pins }).rows;
    expect(row('Energy Drop', pinnedRows)).toMatchObject({ pinned: true, uses: [{ item: 'Energy Drop', unit: 'frederick', key: chapter5 }] });
    const boots = row('Boots', pinnedRows);
    expect(boots.pinned).toBe(true);
    expect(boots.uses[0]!.unit).toBe('chrom');
    expect(boots.idle).toBeUndefined();
    // A carrier pin hands a weapon from the convoy to its unit from its map on.
    const armed = holding({ item: 'Levin Sword', uses: 25 });
    const carrier: PlanPin[] = [{ kind: 'carrier', item: 'Levin Sword', unit: 'robin', key: chapter5 }];
    const levin = row('Levin Sword', engine.itemPlan(armed, engine.seedPlan(armed, { pins: carrier }), { pins: carrier }).rows);
    expect(levin.uses.at(-1)).toMatchObject({ unit: 'robin', key: chapter5 });
    expect(levin.pinned).toBe(true);
  });

  it('lists what to do before a map: boosters, tonics and handovers', () => {
    const use = row('Energy Drop').uses[0]!;
    const map = steps[keyIndex(use.key)]!.map;
    expect(engine.beforeThisMap(run, plan, map)).toContainEqual({ kind: 'booster', item: 'Energy Drop', unit: use.unit });
    // The seed's tonics are on the endpoint: a held one first, else bought through the shopping list.
    const tonics = plan.roadmap.items.filter((p) => / Tonic$/.test(p.item));
    expect(tonics.some((p) => p.source === 'buy')).toBe(true);
    expect(tonics.every((p) => p.key === plan.wishlist.endpoint)).toBe(true);
    expect(engine.beforeThisMap(run, plan, steps.at(-1)!.map).filter((b) => b.kind === 'tonic')).toEqual(tonics.map((p) => ({ kind: 'tonic', item: p.item, unit: p.unit, ...(p.source === 'buy' ? { buy: true } : {}) })));
    const handover = { ...plan, roadmap: { ...plan.roadmap, items: [{ item: 'Levin Sword', unit: 'robin' as const, key: use.key, source: 'held:convoy:Levin Sword#0' }] } };
    expect(engine.beforeThisMap(holding({ item: 'Levin Sword', uses: 25 }), handover, map)).toEqual([{ kind: 'handover', item: 'Levin Sword', unit: 'robin', from: 'convoy' }]);
  });

  it('pre-fills Record results’ items used from the plan before the map, and keeps what’s recorded', () => {
    const use = row('Energy Drop').uses[0]!;
    const map = steps[keyIndex(use.key)]!.map;
    const played = steps.slice(0, keyIndex(use.key) + 1).reduce((r, s, i) => addEntry(r, s.map, i + 2), run);
    const entry = played.entries.at(-1)!.id;
    expect(engine.itemsUsed(played, entry, plan)).toEqual({ recorded: false, items: expect.arrayContaining([{ item: 'Energy Drop', unit: use.unit }]) });
    expect(played.entries.at(-1)!.map).toBe(map);
    const recorded = withItemsUsed(played, entry, [{ item: 'Energy Drop', unit: 'chrom' }], 9);
    expect(engine.itemsUsed(recorded, entry, plan)).toEqual({ recorded: true, items: [{ item: 'Energy Drop', unit: 'chrom' }] });
    // Stored with the run, with the item pins.
    const pinned = withItemPin(recorded, { kind: 'carrier', item: 'Levin Sword', unit: 'robin', key: 'chapter-5' });
    const back = importRun(exportRun(pinned));
    expect(back.pins).toEqual([{ kind: 'carrier', item: 'Levin Sword', unit: 'robin', key: 'chapter-5' }]);
    expect(back.entries.at(-1)!.itemsUsed).toEqual([{ item: 'Energy Drop', unit: 'chrom' }]);
    expect(withItemPin(pinned, { kind: 'carrier', item: 'Levin Sword', unit: 'robin', key: 'chapter-5' }, true).pins).toBeUndefined();
  });

  it('lists the open item rules in the assumptions registry', () => {
    const ids = engine.assumptions().map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['booster-to-child', 'booster-at-cap', 'tonic-stacking', 'item-in-preparations']));
  });
});

describe('item edits in the solve (#193, #199)', () => {
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const run = editEntry(runFromRoster(facts), 'e1', (s) => ({ ...s, convoy: [{ item: 'Energy Drop', uses: 1 }, { item: 'Levin Sword', uses: 25 }] }), 1);
  const plan = engine.seedPlan(run);
  // The item edits the player (and the search) can make, as the inbox's "anything else" lists them.
  const itemEdits = (p = plan, pins: readonly PlanPin[] = []) => engine.editChoices(run, p, { pins }).filter((e) => e.kind === 'item');
  const drop = plan.roadmap.items.find((p) => p.item === 'Energy Drop')!;
  const steps = engine.mapOrder(run).steps;

  it('moves a booster to another wishlist unit or another map with a preparation phase', () => {
    const edits = itemEdits().filter((e) => e.label.includes('Energy Drop'));
    const others = edits.map((e) => e.make().roadmap.items.find((p) => p.source === drop.source)!);
    expect(others.some((p) => p.unit !== drop.unit && p.key === drop.key)).toBe(true);
    expect(others.some((p) => p.unit === drop.unit && p.key !== drop.key)).toBe(true);
    for (const p of others) expect(NO_PREPARATIONS.has(steps.find((s) => s.key === p.key)!.map)).toBe(false);
    expect(new Set(edits.map((e) => e.key)).size).toBe(edits.length);
  });

  it('changes a weapon’s carrier to a wishlist unit who wields it', () => {
    const levin = { item: 'Levin Sword', unit: 'chrom' as const, key: drop.key, source: 'held:convoy:Levin Sword#0' };
    const armed = { ...plan, roadmap: { ...plan.roadmap, items: [...plan.roadmap.items.filter((p) => p.item !== 'Levin Sword'), levin] } };
    const carriers = itemEdits(armed).filter((e) => e.label.includes('carries Levin Sword')).map((e) => e.make().roadmap.items.find((p) => p.source === levin.source)!.unit);
    expect(carriers.length).toBeGreaterThan(0);
    expect(carriers).not.toContain('chrom');
    expect(carriers.every((u) => plan.wishlist.units.some((w) => w.unit === u))).toBe(true);
  });

  it('never edits a pinned item', () => {
    const pins: PlanPin[] = [{ kind: 'booster', item: 'Energy Drop', unit: drop.unit }];
    expect(itemEdits(plan, pins).some((e) => e.label.includes('Energy Drop'))).toBe(false);
  });
});
