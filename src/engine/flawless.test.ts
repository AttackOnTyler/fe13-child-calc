import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, STATS, addEntry, createEngine, editEntry, fixedPass, itemByName, runFromRoster, withRun, type ArmyUnit, type ChildRecruit, type Foe, type RunSimInput, type RunSimMap, type SimFoeGroup, type SimMap, type Stat } from './index';

/**
 * The flawless chance across the map order (#186): hand-built armies and maps whose EXP and level-ups can be worked by
 * hand, then a recorded run through the facade.
 */
const engine = createEngine();
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const myrmidon = engine.classGrowths('myrmidon', 'M');
const caps = engine.classMaxStats('myrmidon', 'M');
/** Personal growths that make each total (personal + Myrmidon's) what's given, 0 elsewhere. */
const totals = (t: Partial<Record<Stat, number>>) => Object.fromEntries(STATS.map((s) => [s, (t[s] ?? 0) - myrmidon[s]])) as Record<Stat, number>;

// Hits every time (Skl 60 at the cap… below), never crits the foe's way, doubles (Spd 40 vs 0).
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
  growths: totals({}),
  modifiers: { str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 },
  skills: [],
  weapons: [{ item: itemByName('Iron Sword')! }],
  supports: [],
  role: 'lead',
  ...more,
});

/** A Fighter that never fights back (no weapon): one round of the hero's kills it. */
const dummy = (level: number, count: number): Foe => ({ name: `Dummy ${level}`, className: 'Fighter', count, stats: stats(20, 0, 0, 0, 0, 0, 0, 0), weapon: undefined, skills: [], boss: false, level });
// 22 damage a hit (Str 14 + Iron Axe 8), never doubles or crits: it kills a hero with 22 HP or less in one hit.
const brute: Foe = { name: 'Brute', className: 'Fighter', count: 1, stats: stats(40, 14, 0, 0, 0, 60, 10, 0), weapon: itemByName('Iron Axe'), skills: [], boss: false, level: 1 };
const group = (foe: Foe): SimFoeGroup => ({ key: foe.name, foe });
const rout = (id: string, foes: Foe[]): SimMap => ({ id, victory: 'rout', foes: foes.map(group), waves: [], skipped: [] });
const step = (map: SimMap, more: Partial<RunSimMap> = {}): RunSimMap => ({ key: map.id, label: map.id, map, deploy: 1, forced: [], joining: [], mapOnly: [], later: [], masterSeals: false, ...more });
const empty = step(rout('end', []));
const sim = (army: ArmyUnit[], maps: RunSimMap[], runs = 1, seed = 1) => engine.simulateRuns({ army, maps, difficulty: 'normal' }, seed, runs);

describe('levels from simulated EXP (#186)', () => {
  it('levels up one level at a time from each fight’s EXP, at the internal level it has then', () => {
    // Kill a Lv 5 Fighter at internal level 5: 10 damage EXP + 20 kill EXP. Four kills: 120 EXP, one level and 20 over.
    const perKill = engine.combatExp({ internalLevel: 5, foe: { level: 5, advanced: false, boss: false, classBonus: 0 }, outcome: 'kill', difficulty: 'normal' });
    expect(perKill).toBe(30);
    const r = sim([hero()], [step(rout('a', [dummy(5, 4)])), empty]);
    expect(r.units[0]).toMatchObject({ id: 'lonqu', className: 'Myrmidon', exp: 20 });
    expect(r.units[0]!.level.median).toBe(6);
    // Lv 30 foes give 100 a kill (the most one combat gives): three kills are three levels, never more.
    const big = sim([hero({ level: 1 })], [step(rout('a', [dummy(30, 3)])), empty]);
    expect(big.units[0]!.level.median).toBe(4);
    expect(big.units[0]!.exp).toBe(0);
  });

  it('loses EXP past the level cap', () => {
    // At Lv 19, two kills of Lv 30 foes reach 20; the rest is lost, and with no Master Seal it stays at 20.
    const r = sim([hero({ level: 19 })], [step(rout('a', [dummy(30, 3)])), step(rout('b', [dummy(30, 3)])), empty]);
    expect(r.units[0]!.level).toMatchObject({ low: 20, median: 20, high: 20, cap: 20 });
    expect(r.units[0]!.exp).toBe(0);
  });

  it('promotes a unit at the level cap with a Master Seal, to Lv 1 in its promotion', () => {
    const r = engine.simulateRuns({ army: [hero({ level: 20 })], maps: [step(rout('a', [])), empty], difficulty: 'normal', masterSealsHeld: 1 }, 1, 1);
    expect(r.units[0]!.className).toMatch(/Swordmaster|Assassin/);
    expect(r.units[0]!.level.median).toBe(1);
  });
});

describe('expected stats (#186)', () => {
  // Ten kills of Lv 50 foes (100 EXP each, the most a combat gives): ten level-ups from Lv 1.
  const grow = (growths: Record<Stat, number>, start = stats(20, 5, 0, caps.skl, 10, 0, 0, 0), runs = 40) =>
    sim([hero({ level: 1, stats: start, growths })], [step(rout('a', [dummy(50, 10)])), empty], runs).units[0]!;

  it('are a spread from the recorded stats plus growths (personal and class), one roll a level', () => {
    const u = grow(totals({ str: 100, spd: 50 }));
    expect(u.level.median).toBe(11);
    expect(u.stats.str).toMatchObject({ low: 15, median: 15, high: 15 });
    expect(u.stats.def).toMatchObject({ low: 0, median: 0, high: 0 });
    expect(u.stats.spd.low).toBeLessThan(u.stats.spd.high);
    expect(u.stats.spd.low).toBeGreaterThanOrEqual(10);
    expect(u.stats.spd.high).toBeLessThanOrEqual(20);
  });

  it('are clamped at effective caps', () => {
    const u = grow(totals({ str: 100, skl: 100, spd: 100 }), stats(20, caps.str - 3, 0, caps.skl, caps.spd - 8, 0, 0, 0));
    expect(u.stats.str).toMatchObject({ median: caps.str, cap: caps.str });
    expect(u.stats.skl).toMatchObject({ low: caps.skl, high: caps.skl, cap: caps.skl });
    expect(u.stats.spd.high).toBe(caps.spd);
    // Limit Breaker adds 10 to every cap but HP's.
    const lb = sim([hero({ level: 1, stats: stats(20, caps.str, 0, caps.skl, 10, 0, 0, 0), growths: totals({ str: 100 }), skills: ['Limit Breaker'] })], [step(rout('a', [dummy(50, 10)])), empty]).units[0]!;
    expect(lb.stats.str).toMatchObject({ median: caps.str + 10, cap: caps.str + 10 });
  });
});

describe('the flawless chance over simulated runs (#186)', () => {
  const m = engine.playMap({ map: rout('x', [brute]), lineup: [{ lead: { id: 'lonqu', fighter: { name: 'Hero', className: 'Myrmidon', stats: stats(20, 15, 0, 27, 28, 0, 0, 0), skills: [], weapon: { item: itemByName('Iron Sword')! } }, weapons: [{ item: itemByName('Iron Sword')! }] }, support: null }] }, 1);

  it('is the product of each map’s no-death chance, when nothing changes between maps', () => {
    expect(m.noDeath).toBeGreaterThan(0);
    expect(m.noDeath).toBeLessThan(1);
    // At the level cap with no Master Seal: every run is the same.
    const r = sim([hero({ level: 20 })], [step(rout('a', [brute])), step(rout('b', [brute]))], 8);
    expect(r.chance).toBeCloseTo(m.noDeath ** 2, 12);
    expect(r.margin).toBeCloseTo(0, 12);
expect(r.maps.map((x) => x.key)).toEqual(['a', 'b']);    for (const x of r.maps) expect(x.noDeath).toBeCloseTo(m.noDeath, 12);
    expect(r.maps[1]!.reach).toBeCloseTo(m.noDeath, 12);
  });

  // HP grows at 30% over ten levels: at 22 HP or less the Brute's hit kills, from 23 on it doesn't.
  const risky = (runs: number, seed = 7) => sim([hero({ level: 1, growths: totals({ hp: 30 }) })], [step(rout('a', [dummy(50, 10)])), step(rout('b', [brute]))], runs, seed);

  it('gives the same chance for the same seed, and a narrower error for more runs', () => {
    expect(risky(10)).toEqual(risky(10));
    const few = risky(10);
    const many = risky(160);
    expect(few.margin).toBeGreaterThan(0);
    expect(many.margin).toBeLessThan(few.margin);
    expect(Math.abs(many.chance - few.chance)).toBeLessThan(few.margin + many.margin);
    expect(many.blindSpots).toEqual(expect.arrayContaining(['one-worst-attacker', 'promotes-at-cap', 'lead-takes-exp']));
  });
});

describe('the flawless chance of a recorded run (#186)', () => {
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const played = (maps: readonly string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
  const all = engine.mapOrder(played([])).steps.map((s) => s.map);

  it('reads from the next map on: played maps drop out', () => {
    const run = played(all.slice(0, -2));
    const r = engine.flawlessChance(run, { runs: 2 });
    expect(r.maps.map((x) => x.key)).toEqual(all.slice(-2));
    expect(r.endpoint).toBe('endgame');
    const next = engine.flawlessChance(played(all.slice(0, -1)), { runs: 2 });
    expect(next.maps.map((x) => x.key)).toEqual(['endgame']);
    expect(engine.flawlessChance(run, { runs: 2 })).toEqual(r);
  });

  it('plays recruits from the map they join on, and names units whose seal history is read as 0', () => {
    const start = played([]);
    const r = engine.flawlessChance(start, { runs: 1 });
    expect(r.maps[0]!.key).toBe('premonition');
    // The Prologue's recruits are fielded there.
    expect(r.maps[1]!.lineup?.deployed).toEqual(expect.arrayContaining(['chrom', 'robin']));
    const promoted = editEntry(start, 'e1', (s) => ({ ...s, units: { chrom: { class: 'Great Lord', level: 5, promoted: true, reclassed: false, exp: 0, stats: stats(40, 20, 3, 20, 20, 20, 15, 10), skills: [], inventory: [], supports: [] } } }), 1);
    expect(engine.flawlessChance(promoted, { runs: 1 }).unknownHistory).toEqual(['chrom']);
  });

  it('brings a child in when the plan or the log marries its fixed parent, and Lucina always (#187)', () => {
    const start = played([]);
    const children = (r: ReturnType<typeof engine.flawlessChance>) => r.notSimulated.filter((n) => n.why === 'child').map((n) => n.unit);
    const none = engine.flawlessChance(start, { runs: 1, marriages: [] });
    expect(children(none)).toContain('kjelle');
    // Chrom marries the Maiden when nobody else is named: Lucina still joins.
    expect(children(none)).not.toContain('lucina');
    const planned = engine.flawlessChance(start, { runs: 1, marriages: [['stahl', 'sully']] });
    expect(children(planned)).not.toContain('kjelle');
    expect(planned.blindSpots).toContain('plan-marriages-made');
  });
});

describe('children join at paralogue entry (#187)', () => {
  const zero = { str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 };
  const greatLord = engine.classGrowths('great-lord', 'M');
  // SF forums 33434: Chrom (Great Lord) and Sumia (Dark Flier) right after Chapter 13, and the Lucina who joined.
  const chrom = (more: Partial<ArmyUnit> = {}): ArmyUnit =>
    hero({
      id: 'chrom',
      name: 'Chrom',
      classId: 'great-lord',
      level: 10,
      stats: stats(52, 27, 7, 27, 31, 27, 23, 14),
      growths: Object.fromEntries(STATS.map((s) => [s, -greatLord[s]])) as Record<Stat, number>,
      skills: ['Dual Strike+', 'Charm', 'Aether'],
      ...more,
    });
  const sumia = hero({ id: 'sumia', name: 'Sumia', gender: 'F', classId: 'dark-flier', level: 10, stats: stats(46, 24, 16, 37, 37, 30, 10, 25), skills: ['Speed +2', 'Relief', 'Galeforce'], weapons: [] });
  const lucina: ChildRecruit = {
    id: 'lucina',
    name: 'Lucina',
    parents: ['chrom', 'sumia'],
    fixed: [fixedPass('chrom', 'F'), undefined],
    growths: totals({}),
    modifiers: zero,
    weapons: [{ item: itemByName('Parallel Falchion')! }],
    role: 'lead',
  };
  const lucinaOf = (r: ReturnType<typeof sim>) => r.units.find((u) => u.id === 'lucina');

  it('joins Lucina with the in-game stats from her parents at the start of Chapter 13, after it', () => {
    const r = sim([chrom(), sumia], [step(rout('chapter-12', [])), step(rout('chapter-13', []), { children: [lucina] }), step(rout('end', []), { deploy: 3 })]);
    const u = lucinaOf(r)!;
    expect(u).toMatchObject({ className: 'Lord', level: { median: 10 } });
    expect(STATS.map((s) => u.stats[s].median)).toEqual([38, 18, 7, 25, 25, 23, 13, 11]);
    // Her class's skills, Chrom's Aether, and Sumia's bottom skill.
    expect(u.skills).toEqual(['Dual Strike+', 'Charm', 'Aether', 'Galeforce']);
    // Absent before her entry and on Chapter 13 itself (she joins at its end); fielded after.
    expect(r.maps[0]!.lineup?.deployed).not.toContain('lucina');
    expect(r.maps[1]!.lineup?.deployed).not.toContain('lucina');
    expect(r.maps[2]!.lineup?.deployed).toContain('lucina');
  });

  it('reads her parents’ stats as simulated in the run by then', () => {
    // Ten level-ups for Chrom before Chapter 13 with HP growing every time: HP 62, a third of 10 more for Lucina.
    const grower = chrom({ level: 1, bonus: 0, growths: Object.fromEntries(STATS.map((s) => [s, (s === 'hp' ? 100 : 0) - greatLord[s]])) as Record<Stat, number> });
    const r = sim([grower, sumia], [step(rout('chapter-12', [dummy(50, 10)]), { forced: ['chrom'] }), step(rout('chapter-13', []), { children: [lucina] }), empty]);
    expect(r.units.find((u) => u.id === 'chrom')!.stats.hp.median).toBe(62);
    expect(lucinaOf(r)!.stats.hp.median).toBe(Math.floor((62 - 23 + (46 - 19) + 12) / 3) + 16);
  });

  it('plays a child paralogue and joins its child only when its gates hold in the run', () => {
    const sully = hero({ id: 'sully', name: 'Sully', gender: 'F', classId: 'cavalier', stats: stats(30, 15, 0, 15, 15, 10, 10, 5), skills: ['Discipline', 'Outdoor Fighter'] });
    const stahl = hero({ id: 'stahl', name: 'Stahl', classId: 'cavalier', stats: stats(30, 15, 0, 15, 15, 10, 10, 5), skills: ['Discipline', 'Outdoor Fighter'] });
    const kjelle: ChildRecruit = { id: 'kjelle', name: 'Kjelle', parents: ['sully', 'stahl'], growths: totals({}), modifiers: zero, weapons: [{ item: itemByName('Iron Lance')! }], role: 'lead' };
    const maps = [step(rout('paralogue-8', []), { children: [kjelle] }), step(rout('end', []), { deploy: 3 })];
    const run = (more: Partial<RunSimInput>) => engine.simulateRuns({ army: [sully, stahl], maps, difficulty: 'normal', ...more }, 1, 1);
    const open = run({ cleared: ['chapter-13'], married: ['sully', 'stahl'] });
    expect(open.maps[0]).toMatchObject({ reach: 1, noDeath: 1 });
    const k = open.units.find((u) => u.id === 'kjelle')!;
    expect(k.className).toBe('Knight');
    // Both would pass Outdoor Fighter: Sully keeps it, Stahl passes his next skill up.
    expect(k.skills).toEqual(['Defence +2', 'Indoor Fighter', 'Outdoor Fighter', 'Discipline']);
    // Sully unmarried, or Chapter 13 not cleared: the paralogue isn't open, isn't played, and Kjelle never joins.
    for (const closed of [run({ cleared: ['chapter-13'] }), run({ married: ['sully', 'stahl'] })]) {
      expect(closed.maps[0]).toMatchObject({ reach: 0, noDeath: undefined, lineup: undefined });
      expect(closed.units.map((u) => u.id)).not.toContain('kjelle');
    }
    // Paralogue 5 also needs its place reached: Chapter 14 cleared.
    const lissa = hero({ id: 'lissa', name: 'Lissa', gender: 'F', classId: 'priest', stats: stats(20, 2, 8, 6, 8, 12, 3, 8), weapons: [] });
    const owain: ChildRecruit = { id: 'owain', name: 'Owain', parents: ['lissa', 'lonqu'], growths: totals({}), modifiers: zero, weapons: [{ item: itemByName('Steel Sword')! }], role: 'lead' };
    const p5 = [step(rout('paralogue-5', []), { children: [owain] }), empty];
    const withLissa = (cleared: string[]) => engine.simulateRuns({ army: [lissa, hero()], maps: p5, difficulty: 'normal', cleared, married: ['lissa', 'lonqu'] }, 1, 1);
    expect(withLissa(['chapter-13']).units.map((u) => u.id)).not.toContain('owain');
    expect(withLissa(['chapter-13', 'chapter-14']).units.map((u) => u.id)).toContain('owain');
  });

  it('carries staves and potions into the run’s maps, so the simulation heals', () => {
    const wall: Foe = { ...brute, name: 'Wall', stats: stats(200, 13, 0, 0, 0, 60, 15, 0) };
    const tank = (items?: ArmyUnit['items']) => hero({ level: 20, stats: stats(30, 15, 0, 60, 30, 0, 10, 0), ...(items ? { items } : {}) });
    const without = sim([tank()], [step(rout('a', [wall]))]);
    const potions = sim([tank([{ item: itemByName('Vulnerary')!, uses: 3 }])], [step(rout('a', [wall]))]);
    expect(potions.chance).toBeGreaterThan(without.chance);
  });
});
