import { describe, expect, it } from 'vitest';
import { combatPoints, createEngine, itemByName, mapSupportGains, resolveAssumptions, type ArmyUnit, type ChildRecruit, type Foe, type RunSim, type RunSimInput, type RunSimMap, type SimMap } from './index';

/**
 * Support growth in the simulated runs (#188; research/support-growth): points from combats together, each unit's top
 * three pairs a map, one rank a map, marriages at S, and Chrom's wedding at the end of Chapter 11. Hand-built armies
 * fight dummies that never fight back, one a turn. Only combats paired count (the spec's "combats together": Attack
 * Stance beside a partner earns nothing here, though the research credits it), and a pair splits when both its units
 * can attack safely apart (#183), so each woman here is unarmed: she stays her partner's back and shares each of his
 * combats, one per dummy.
 */
const engine = createEngine();
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const zero = { hp: 0, str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 };
const noMods = { str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 };

/** A unit that kills a dummy in one hit, every time. */
const unit = (id: ArmyUnit['id'], gender: 'M' | 'F', more: Partial<ArmyUnit> = {}): ArmyUnit => ({
  id,
  name: id,
  gender,
  classId: 'myrmidon',
  level: 5,
  exp: 0,
  count: 0,
  bonus: 0,
  stats: stats(30, 15, 0, 60, 28, 0, 0, 0),
  growths: zero,
  modifiers: noMods,
  skills: [],
  weapons: [{ item: itemByName('Iron Sword')! }],
  supports: [],
  role: 'lead',
  ...more,
});
/** A woman with no weapon: apart she has nothing safe to do, so she stays paired as the back. */
const back = (id: ArmyUnit['id'], more: Partial<ArmyUnit> = {}): ArmyUnit => unit(id, 'F', { weapons: [], ...more });
const dummies = (count: number): Foe => ({ name: 'Dummy', className: 'Fighter', count, stats: stats(20, 0, 0, 0, 0, 0, 0, 0), weapon: undefined, skills: [], boss: false, level: 1 });
const rout = (id: string, count: number): SimMap => ({ id, victory: 'rout', foes: count ? [{ key: 'Dummy', foe: dummies(count) }] : [], waves: [], skipped: [] });
const step = (id: string, combats: number, more: Partial<RunSimMap> = {}): RunSimMap => ({ key: id, label: id, map: rout(id, combats), deploy: 2, forced: [], joining: [], mapOnly: [], later: [], masterSeals: false, ...more });
/** `n` maps with `combats` fights each for the deployed pair. */
const maps = (n: number, combats = 4) => Array.from({ length: n }, (_, i) => step(`m${i + 1}`, combats));
const end = step('end', 0, { deploy: 6 });
const sim = (input: Omit<RunSimInput, 'difficulty'>, e = engine): RunSim => e.simulateRuns({ difficulty: 'normal', ...input }, 1, 1);
const pair = (r: RunSim, a: string, b: string) => r.supports.find((s) => (s.a === a && s.b === b) || (s.a === b && s.b === a));
const wife = (r: RunSim) => r.marriages.find((m) => m.a === 'chrom' || m.b === 'chrom');

describe('a map’s support points (#188)', () => {
  it('gives 1, 1, 2, then 3 points for 1, 2, 3 and 4+ combats together', () => {
    expect([1, 2, 3, 4, 6].map(combatPoints)).toEqual([1, 1, 2, 3, 3]);
  });

  it('gives each unit’s top three pairs of a map 3, 2 and 1, the rest nothing, and pairs that can’t support nothing', () => {
    const four = { maribelle: 4, olivia: 4, sully: 4, sumia: 4, gangrel: 4 };
    const gains = mapSupportGains({ chrom: four, maribelle: { chrom: 4 }, olivia: { chrom: 4 }, sully: { chrom: 4 }, sumia: { chrom: 4 }, gangrel: { chrom: 4 } }, undefined);
    const of = (p: string) => gains.find((g) => g.a === p || g.b === p)?.points;
    // Chrom and Gangrel can't support; the rest tie on combats and go by name.
    expect([of('maribelle'), of('olivia'), of('sully'), of('sumia'), of('gangrel')]).toEqual([3, 2, 1, undefined, undefined]);
  });
});

describe('supports in the simulated runs (#188)', () => {
  it('grows supports only from combats together, never from fighting on the same map apart', () => {
    const army = [unit('lonqu', 'M'), back('cordelia'), unit('stahl', 'M'), back('sully')];
    const r = sim({ army, maps: [step('m1', 4, { deploy: 4 }), end], couples: [['lonqu', 'cordelia'], ['stahl', 'sully']] });
    expect(pair(r, 'lonqu', 'cordelia')!.points.median).toBeGreaterThan(0);
    expect(pair(r, 'stahl', 'sully')!.points.median).toBeGreaterThan(0);
    // Lon'qu and Sully (a slow romance) both fought on the map, in other pairs.
    expect(pair(r, 'lonqu', 'sully')).toBeUndefined();
  });

  it('takes a slow pair fighting together 4 times a map 8 maps to S, and a fast pair 7', () => {
    expect(engine.supportCurve('lonqu', 'sully')!.curve).toBe('slow');
    expect(engine.supportCurve('stahl', 'miriel')!.curve).toBe('fast');
    const slow = (n: number) => sim({ army: [unit('lonqu', 'M'), back('sully')], maps: [...maps(n), end], couples: [['lonqu', 'sully']] });
    const fast = (n: number) => sim({ army: [unit('stahl', 'M'), back('miriel')], maps: [...maps(n), end], couples: [['stahl', 'miriel']] });
    // One rank a map at most: the slow pair's 4, 8, 13 and 18 points take 2 maps each.
    expect(pair(slow(1), 'lonqu', 'sully')).toMatchObject({ points: { median: 3 }, rank: null });
    expect(pair(slow(2), 'lonqu', 'sully')).toMatchObject({ points: { median: 4 }, rank: 'C' });
    expect(pair(slow(7), 'lonqu', 'sully')).toMatchObject({ points: { median: 16 }, rank: 'A' });
    expect(slow(7).marriages).toEqual([]);
    expect(pair(slow(8), 'lonqu', 'sully')).toMatchObject({ points: { median: 18 }, rank: 'S' });
    expect(slow(8).marriages).toEqual([{ a: 'lonqu', b: 'sully', share: 1, after: 'm8' }]);
    expect(fast(6).marriages).toEqual([]);
    expect(fast(7).marriages).toEqual([{ a: 'miriel', b: 'stahl', share: 1, after: 'm7' }]);
  });

  it('carries points past a threshold under the bank assumption: a slow pair to S in 6 maps', () => {
    const bank = createEngine(resolveAssumptions({ 'support-past-threshold': 'bank' }));
    expect(bank.supportCurve('lonqu', 'sully')!.mapsToS).toBe(6);
    const r = sim({ army: [unit('lonqu', 'M'), back('sully')], maps: [...maps(6), end], couples: [['lonqu', 'sully']] }, bank);
    expect(r.marriages).toEqual([{ a: 'lonqu', b: 'sully', share: 1, after: 'm6' }]);
  });

  it('seeds the points from the recorded ranks', () => {
    // Recorded at A (13 points): two more maps to S.
    const r = sim({ army: [unit('lonqu', 'M', { supports: [{ partner: 'sully', rank: 'A' }] }), back('sully')], maps: [...maps(2), end], couples: [['lonqu', 'sully']] });
    expect(r.marriages).toEqual([{ a: 'lonqu', b: 'sully', share: 1, after: 'm2' }]);
  });

  it('recruits a child only when its parents’ marriage is made by its paralogue', () => {
    const kjelle: ChildRecruit = { id: 'kjelle', name: 'Kjelle', parents: ['sully', 'stahl'], growths: zero, modifiers: noMods, weapons: [{ item: itemByName('Iron Lance')! }], role: 'lead' };
    const run = (n: number) =>
      sim({ army: [unit('stahl', 'M'), back('sully')], maps: [...maps(n), step('paralogue-8', 0, { children: [kjelle] }), end], cleared: ['chapter-13'], couples: [['sully', 'stahl']] });
    // Sully and Stahl are a medium pair: S in 7 maps together.
    const late = run(6);
    expect(late.maps.find((m) => m.key === 'paralogue-8')).toMatchObject({ reach: 0 });
    expect(late.units.map((u) => u.id)).not.toContain('kjelle');
    const inTime = run(7);
    expect(inTime.maps.find((m) => m.key === 'paralogue-8')).toMatchObject({ reach: 1 });
    expect(inTime.units.map((u) => u.id)).toContain('kjelle');
  });
});

describe('Chrom’s wedding at the end of Chapter 11 in the simulation (#188)', () => {
  const chrom = (supports: ArmyUnit['supports'] = []) => unit('chrom', 'M', { supports });
  const women = ['sumia', 'sully', 'maribelle', 'olivia'].map((id) => back(id as ArmyUnit['id'], { skills: ['Discipline', 'Outdoor Fighter'] }));
  /** Chapter 11 with Chrom forced; `combats` fights for him and his partner when there's room for one. */
  const ch11 = (deploy: number, combats: number) => step('chapter-11', combats, { deploy, forced: ['chrom'] });

  it('marries him to the candidate he has the highest rank with, whoever the plan names', () => {
    const r = sim({ army: [chrom([{ partner: 'sully', rank: 'B' }, { partner: 'sumia', rank: 'C' }]), ...women], maps: [ch11(1, 1), end], couples: [['chrom', 'sumia']] });
    expect(wife(r)).toMatchObject({ a: 'chrom', b: 'sully', after: 'chapter-11' });
    expect(pair(r, 'chrom', 'sully')!.rank).toBe('S');
  });

  it('decides a tie at the top by the fewest points to the next rank, then the tie order', () => {
    const cs = chrom([{ partner: 'sumia', rank: 'C' }, { partner: 'sully', rank: 'C' }]);
    // Both at C with 4 points to B: Sumia first in either order.
    expect(wife(sim({ army: [cs, ...women], maps: [ch11(1, 1), end] }))!.b).toBe('sumia');
    // One combat with Sully on Chapter 11: 3 points to her B.
    expect(wife(sim({ army: [cs, ...women], maps: [ch11(2, 1), end], couples: [['chrom', 'sully']] }))!.b).toBe('sully');
    // Sully and Maribelle tied: SF puts Sully first, the JP wiki Maribelle.
    const sm = chrom([{ partner: 'sully', rank: 'C' }, { partner: 'maribelle', rank: 'C' }]);
    expect(wife(sim({ army: [sm, ...women], maps: [ch11(1, 1), end] }))!.b).toBe('sully');
    const jp = createEngine(resolveAssumptions({ 'chrom-wedding-tie-order': 'jp' }));
    expect(wife(sim({ army: [sm, ...women], maps: [ch11(1, 1), end] }, jp))!.b).toBe('maribelle');
  });

  it('marries Olivia from 2 points with no C elsewhere (SF), or only from a C (JP), and the Maiden with no points', () => {
    // Three combats with Olivia: 2 points, short of their C at 4.
    const input = { army: [chrom(), ...women], maps: [ch11(2, 3), end], couples: [['chrom', 'olivia']] as const };
    expect(wife(sim(input))!.b).toBe('olivia');
    const jp = createEngine(resolveAssumptions({ 'chrom-wedding-olivia': 'rank-c' }));
    expect(wife(sim(input, jp))!.b).toBe('maiden');
    expect(wife(sim({ army: [chrom(), ...women], maps: [ch11(1, 1), end] }))!.b).toBe('maiden');
  });

  it('gives Lucina the mother the run married Chrom to', () => {
    const lucina = (mother: ChildRecruit['parents'][1]): ChildRecruit => ({ id: 'lucina', name: 'Lucina', parents: ['chrom', mother], growths: zero, modifiers: noMods, weapons: [{ item: itemByName('Iron Sword')! }], role: 'lead' });
    const ch13 = step('chapter-13', 0, { children: [lucina('sumia'), lucina('sully'), lucina('maiden')] });
    const r = sim({ army: [chrom([{ partner: 'sully', rank: 'C' }]), ...women], maps: [ch11(1, 1), ch13, end] });
    // Sully's bottom skill passes.
    expect(r.units.find((u) => u.id === 'lucina')!.skills).toContain('Outdoor Fighter');
    const maiden = sim({ army: [chrom(), ...women], maps: [ch11(1, 1), ch13, end] });
    expect(maiden.units.find((u) => u.id === 'lucina')!.skills).not.toContain('Outdoor Fighter');
  });
});
