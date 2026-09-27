import { describe, expect, it } from 'vitest';
import { MAPS } from '../game-data/chapters';
import { CHILD_UNITS } from '../game-data/children';
import {
  EMPTY_ROSTER,
  EMPTY_RUN,
  addEntry,
  childParalogueGates,
  childJoinFrom,
  editEntry,
  exportRun,
  flaggedEntries,
  heldProblems,
  importRun,
  latestEntry,
  nextMaps,
  prepUnits,
  recordFallen,
  recordMarriage,
  rosterOf,
  runFromRoster,
  withRoster,
  withRun,
  withSeenSkills,
  withSpouse,
  withState,
  withUnit,
  type RosterUnit,
  type Run,
  type UnitSnapshot,
} from './index';

const facts = withRun(EMPTY_ROSTER, { gender: 'M', asset: 'mag', flaw: 'str', difficulty: 'lunatic', route: 'main-story' });

describe('the chapter log', () => {
  it('starts from the existing roster: its states and marriages become the first entry', () => {
    const roster = withSpouse(withState(facts, 'vaike', 'dead'), 'chrom', 'sumia', 'married');
    const run = runFromRoster(roster);
    expect(run.entries).toHaveLength(1);
    expect(run.entries[0]!.snapshot.states).toEqual({ vaike: 'dead' });
    expect(rosterOf(run)).toEqual(roster);
  });

  it('copies forward: a new entry starts as the previous snapshot', () => {
    let run = addEntry(runFromRoster(facts), 'prologue', 1);
    run = editEntry(run, latestEntry(run)!.id, (s) => ({ ...s, gold: 1200 }), 2);
    run = addEntry(run, 'chapter-1', 3);
    expect(latestEntry(run)!.snapshot.gold).toBe(1200);
    expect(latestEntry(run)!.snapshot.units.chrom).toEqual(run.entries[1]!.snapshot.units.chrom);
  });

  it('pre-fills recruits from join data on the run’s difficulty, and a child’s class and level from the map', () => {
    let run = addEntry(runFromRoster(facts), 'prologue', 1);
    expect(latestEntry(run)!.snapshot.units.frederick).toMatchObject({ class: 'Great Knight', level: 1, skills: ['discipline', 'outdoor-fighter'], stats: { hp: 28, def: 14 } });
    expect(latestEntry(run)!.snapshot.units.robin).toMatchObject({ class: 'Tactician', level: 1 });
    run = addEntry(run, 'chapter-8', 2);
    // Gregor has Lunatic bases.
    expect(latestEntry(run)!.snapshot.units.gregor!.stats!.hp).toBe(31);
    run = addEntry(run, 'chapter-13', 3);
    expect(latestEntry(run)!.snapshot.units.lucina).toMatchObject({ class: 'Lord', level: 10, stats: null });
  });

  it('never lets a past edit reach later entries, and flags them', () => {
    let run = addEntry(runFromRoster(facts), 'prologue', 1);
    run = addEntry(run, 'chapter-1', 2);
    run = addEntry(run, 'chapter-2', 3);
    const second = run.entries[2]!.id;
    run = editEntry(run, second, (s) => withUnit(s, 'chrom', { ...s.units.chrom!, level: 5 }), 10);
    expect(run.entries[2]!.snapshot.units.chrom!.level).toBe(5);
    expect(run.entries[3]!.snapshot.units.chrom!.level).toBe(1);
    expect([...flaggedEntries(run)]).toEqual([run.entries[3]!.id]);
    // An entry made after the edit isn't flagged.
    expect(flaggedEntries(addEntry(run, 'chapter-3', 11)).has(latestEntry(addEntry(run, 'chapter-3', 11))!.id)).toBe(false);
  });

  it('writes the Roster page’s edits into the latest entry', () => {
    let run = addEntry(runFromRoster(facts), 'prologue', 1);
    run = withRoster(run, withState(rosterOf(run), 'lissa', 'benched'));
    expect(latestEntry(run)!.snapshot.states).toEqual({ lissa: 'benched' });
    expect(run.entries[0]!.snapshot.states).toEqual({});
    expect(rosterOf(run).run).toEqual(facts.run);
  });

  it('exports and imports exactly', () => {
    let run = addEntry(runFromRoster(withSpouse(facts, 'chrom', 'sumia', 'married')), 'prologue', 1);
    run = editEntry(run, latestEntry(run)!.id, (s) => ({ ...s, gold: 900, convoy: [{ item: 'Iron Sword', uses: 40, forge: { name: 'Shiny', mt: 1, hit: 0, crit: 0 } }] }), 2);
    expect(importRun(exportRun(run))).toEqual(run);
    expect(importRun('{"version":2}')).toEqual(EMPTY_RUN);
  });
});

describe('inventory, convoy and gold (#117)', () => {
  it('fill a recruit’s starting items at full uses', () => {
    const run = addEntry(runFromRoster(facts), 'prologue', 1);
    expect(latestEntry(run)!.snapshot.units.frederick!.inventory).toEqual([{ item: 'Silver Lance', uses: 30 }]);
  });

  it('validate held items against the item data', () => {
    expect(heldProblems({ item: 'Iron Sword', uses: 40 })).toEqual([]);
    expect(heldProblems({ item: 'Iron Sword', uses: 41 })[0]).toMatch(/at most 40/);
    expect(heldProblems({ item: 'Excalibur Sword', uses: 1 })[0]).toMatch(/not an item/);
    expect(heldProblems({ item: 'Steel Sword', uses: 30, forge: { name: 'Kiri', mt: 2, hit: 10, crit: 3 } })).toEqual([]);
    expect(heldProblems({ item: 'Steel Sword', uses: 30, forge: { name: 'Kiri', mt: 2, hit: 7, crit: 0 } })[0]).toMatch(/steps/);
    expect(heldProblems({ item: 'Steel Sword', uses: 30, forge: { name: 'Kiri', mt: 5, hit: 20, crit: 0 } })[0]).toMatch(/8 intervals/);
    expect(heldProblems({ item: 'Falchion', uses: null, forge: { name: 'X', mt: 1, hit: 0, crit: 0 } })[0]).toMatch(/can’t be forged/);
  });

  it('carry inventory, convoy and gold forward, and keep them per entry', () => {
    let run = addEntry(runFromRoster(facts), 'prologue', 1);
    run = editEntry(
      run,
      latestEntry(run)!.id,
      (s) => ({ ...withUnit(s, 'chrom', { ...s.units.chrom!, inventory: [{ item: 'Rapier', uses: 30 }] }), convoy: [{ item: 'Vulnerary', uses: 3 }], gold: 800 }),
      2,
    );
    run = addEntry(run, 'chapter-1', 3);
    const s = latestEntry(run)!.snapshot;
    expect([s.units.chrom!.inventory, s.convoy, s.gold]).toEqual([[{ item: 'Rapier', uses: 30 }], [{ item: 'Vulnerary', uses: 3 }], 800]);
    run = editEntry(run, latestEntry(run)!.id, (x) => ({ ...x, gold: 100 }), 4);
    expect(run.entries[1]!.snapshot.gold).toBe(800);
  });
});

describe('next-map offers and Record results (#118)', () => {
  const played = (route: 'main-story' | 'full-route', ...maps: string[]) =>
    maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(withRun(facts, { route })));
  /** Records marriages in the latest entry. */
  const marry = (run: Run, ...couples: [RosterUnit, RosterUnit][]) => couples.reduce((r, [a, b]) => recordMarriage(r, latestEntry(r)!.id, a, b, 50), run);

  it('start at the Premonition, then follow the story and its unlocks', () => {
    expect(nextMaps(runFromRoster(facts)).map((o) => o.map)).toEqual(['premonition']);
    expect(nextMaps(played('main-story', 'premonition', 'prologue', 'chapter-1', 'chapter-2', 'chapter-3')).map((o) => o.map)).toEqual(['chapter-4', 'paralogue-1']);
  });

  it('never offer xenologues on the Main story, nor grind maps on either route', () => {
    const main = nextMaps(played('main-story', 'premonition'));
    expect(main.some((o) => o.kind === 'xenologue')).toBe(false);
    const full = nextMaps(played('full-route', 'premonition')).filter((o) => o.kind === 'xenologue').map((o) => o.map);
    expect(full).toContain('apotheosis');
    expect(full).not.toContain('the-golden-gaffe');
    expect(full).not.toContain('exponential-growth');
  });

  it('note the SpotPass paralogues’ availability; a child paralogue’s marriage is a condition, not a note', () => {
    const story = ['premonition', 'prologue', ...Array.from({ length: 25 }, (_, i) => `chapter-${i + 1}`)];
    const offers = nextMaps(played('main-story', ...story));
    expect(offers.find((o) => o.map === 'paralogue-18')!.note).toMatch(/SpotPass/);
    expect(offers.some((o) => o.map === 'paralogue-5')).toBe(false);
    expect(offers.map((o) => o.map)).toContain('endgame');
    const married = nextMaps(marry(played('main-story', ...story), ['lissa', 'vaike']));
    expect(married.find((o) => o.map === 'paralogue-5')).toEqual({ map: 'paralogue-5', kind: 'paralogue' });
  });

  describe('child paralogues (#152)', () => {
    const toCh13 = ['premonition', 'prologue', ...Array.from({ length: 13 }, (_, i) => `chapter-${i + 1}`)];
    const children = Array.from({ length: 12 }, (_, i) => `paralogue-${i + 5}`);
    const offered = (run: Run) =>
      nextMaps(run)
        .map((o) => o.map)
        .filter((m) => children.includes(m));
    const then = (run: Run, ...maps: string[]) => maps.reduce((r, m, i) => addEntry(r, m, 100 + i), run);

    it('offer none after Chapter 13 while nobody is married', () => {
      expect(offered(played('main-story', ...toCh13))).toEqual([]);
    });

    it('offer none before Chapter 13, whoever is married', () => {
      expect(offered(marry(played('main-story', ...toCh13.slice(0, -1)), ['sully', 'vaike'], ['tharja', 'stahl']))).toEqual([]);
    });

    it('open P5 on Lissa’s marriage, but reach it only once Chapter 14 is cleared', () => {
      const run = marry(played('main-story', ...toCh13), ['lissa', 'vaike']);
      expect(offered(run)).toEqual([]);
      expect(offered(then(run, 'chapter-14'))).toEqual(['paralogue-5']);
    });

    it('offer P9 and P10 before Chapter 14 once Sumia and Cordelia are married', () => {
      expect(offered(marry(played('main-story', ...toCh13), ['sumia', 'chrom'], ['cordelia', 'stahl']))).toEqual(['paralogue-9', 'paralogue-10']);
    });

    it('offer P9 alone only once Chapter 18 is cleared', () => {
      const run = marry(played('main-story', ...toCh13), ['sumia', 'chrom']);
      expect(offered(then(run, 'chapter-14', 'chapter-15', 'chapter-16', 'chapter-17'))).toEqual([]);
      expect(offered(then(run, 'chapter-14', 'chapter-15', 'chapter-16', 'chapter-17', 'chapter-18'))).toEqual(['paralogue-9']);
    });

    it('offer P5 before Chapter 14 once Lissa, Sumia and Cordelia are married', () => {
      const run = marry(played('main-story', ...toCh13), ['lissa', 'vaike'], ['sumia', 'chrom'], ['cordelia', 'stahl']);
      expect(offered(run)).toEqual(['paralogue-5', 'paralogue-9', 'paralogue-10']);
    });

    it('keep P7 closed before Chapter 15 with P12 open but not P6 (C6)', () => {
      const run = marry(played('main-story', ...toCh13), ['maribelle', 'gaius'], ['robin', 'cherche']);
      expect(offered(run)).toEqual(['paralogue-12']);
      expect(offered(then(run, 'chapter-14'))).toEqual(['paralogue-12']);
      expect(offered(then(run, 'chapter-14', 'chapter-15'))).toEqual(['paralogue-7', 'paralogue-12']);
      // With Olivia married too, P6 is open and reached through P12, and P7 through P6.
      expect(offered(marry(run, ['olivia', 'donnel']))).toEqual(['paralogue-6', 'paralogue-7', 'paralogue-12']);
    });

    it('open P12 on Robin’s marriage to anyone, a child included', () => {
      expect(offered(marry(played('main-story', ...toCh13), ['robin', 'lucina']))).toEqual(['paralogue-12']);
    });

    it('never count a pinned marriage', () => {
      const run = played('main-story', ...toCh13);
      expect(offered(withRoster(run, withSpouse(rosterOf(run), 'nowi', 'vaike', 'pinned')))).toEqual([]);
      expect(offered(marry(run, ['nowi', 'vaike']))).toEqual(['paralogue-16']);
    });

    it('evaluate the gates from cleared maps and marriages alone, as a simulated run does', () => {
      const gate = (cleared: string[], married: RosterUnit[], map: string) => childParalogueGates({ cleared: new Set(cleared), married: new Set(married) }).find((g) => g.map === map)!;
      expect(gate(['chapter-13'], ['olivia'], 'paralogue-6')).toEqual({ map: 'paralogue-6', open: true, reachable: false, playable: false });
      expect(gate(['chapter-13'], ['olivia', 'robin'], 'paralogue-6').playable).toBe(true);
      // P12 played before Robin's marriage was recorded still opens the road to P6.
      expect(gate(['chapter-13', 'paralogue-12'], ['olivia'], 'paralogue-6').playable).toBe(true);
      // Each gate belongs to the child whose fixed parent it names.
      const story = ['chapter-13', 'chapter-14', 'chapter-15', 'chapter-16', 'chapter-17', 'chapter-18'];
      for (const child of Object.values(CHILD_UNITS).filter((c) => c.fixedParent !== 'chrom')) {
        const playable = childParalogueGates({ cleared: new Set(story), married: new Set([child.fixedParent]) }).filter((g) => g.playable);
        expect(playable.map((g) => MAPS.find((m) => m.id === g.map)!.recruits[0]!.unit)).toEqual([child.name.replace(/ \(.\)$/, '')]);
      }
    });

    it('stop offering a child paralogue once it is played', () => {
      expect(offered(then(marry(played('main-story', ...toCh13), ['nowi', 'vaike']), 'paralogue-16'))).toEqual([]);
    });
  });

  it('records a death on Classic, but not on Casual, and a marriage', () => {
    for (const mode of ['classic', 'casual'] as const) {
      let run = addEntry(runFromRoster(withRun(facts, { mode })), 'prologue', 1);
      run = recordFallen(run, latestEntry(run)!.id, 'frederick', 2);
      expect(rosterOf(run).states.frederick).toBe(mode === 'classic' ? 'dead' : undefined);
    }
    let run = addEntry(runFromRoster(facts), 'chapter-3', 1);
    run = recordMarriage(run, latestEntry(run)!.id, 'chrom', 'sumia', 2);
    expect(rosterOf(run).spouses.chrom).toEqual({ partner: 'sumia', bond: 'married' });
  });
});

describe('Lunatic+ skills seen (#120)', () => {
  it('are kept per map and foe, cleared by an empty list, and survive export', () => {
    let run = withSeenSkills(runFromRoster(facts), 'chapter-5', 'Orton|Wyvern Rider|41', ['Luna+', 'Pass']);
    expect(run.seen).toEqual({ 'chapter-5': { 'Orton|Wyvern Rider|41': ['Luna+', 'Pass'] } });
    expect(importRun(exportRun(run)).seen).toEqual(run.seen);
    run = withSeenSkills(run, 'chapter-5', 'Orton|Wyvern Rider|41', []);
    expect(run.seen).toBeUndefined();
  });
});

describe('review fixes (#108–#123 review)', () => {
  it('pre-fills Robin with the asset/flaw shift', () => {
    const run = addEntry(runFromRoster(facts), 'prologue', 1);
    // +Mag −Str: Mag 5 + 2, Str 6 − 1.
    expect(latestEntry(run)!.snapshot.units.robin!.stats).toMatchObject({ mag: 7, str: 5 });
  });
});

describe('units joining on the map being prepared (#131)', () => {
  const fresh = runFromRoster(facts);
  const ids = (units: readonly (readonly [string, unknown])[]) => units.map(([u]) => u);

  it('field the Prologue’s turn-1 recruits on a fresh run, built as Record results builds them', () => {
    const p = prepUnits(fresh, 'prologue');
    expect(ids(p.units)).toEqual(['chrom', 'robin', 'lissa', 'frederick']);
    expect(p.joining).toEqual(['chrom', 'robin', 'lissa', 'frederick']);
    const recorded = latestEntry(addEntry(fresh, 'prologue', 1))!.snapshot.units;
    for (const [u, s] of p.units) expect(s).toEqual(recorded[u]);
  });

  it('field Chapter 2’s turn-1 recruits and list the later ones with when, apart from the army', () => {
    const run = addEntry(addEntry(fresh, 'prologue', 1), 'chapter-1', 2);
    const p = prepUnits(run, 'chapter-2');
    expect(p.joining).toEqual(['stahl', 'vaike']);
    expect(ids(p.units)).toEqual(expect.arrayContaining(['chrom', 'robin', 'lissa', 'frederick', 'sully', 'virion', 'stahl', 'vaike']));
    expect(ids(p.units)).not.toContain('miriel');
    expect(p.later).toEqual([{ unit: 'miriel', how: 'Automatically from turn 2' }]);
    // Chapter 1's Sully and Virion arrive on turn 2 of their own map.
    expect(prepUnits(addEntry(fresh, 'prologue', 1), 'chapter-1').later.map((l) => l.unit)).toEqual(['sully', 'virion']);
  });

  it('field Premonition’s Chrom and Robin with the map’s own setup, which never joins the army', () => {
    const p = prepUnits(fresh, 'premonition');
    expect(p.mapOnly).toEqual(['chrom', 'robin']);
    const [, chrom] = p.units.find(([u]) => u === 'chrom')!;
    expect(chrom).toMatchObject({ class: 'Lord', level: 20, stats: { hp: 41, str: 20 }, inventory: [{ item: 'Falchion' }, { item: 'Silver Sword' }] });
    // Robin (+Mag −Str) reads the asset and flaw values FEW prints.
    const [, robin] = p.units.find(([u]) => u === 'robin')!;
    expect(robin.stats).toMatchObject({ hp: 38, mag: 16, str: 15 });
    expect(latestEntry(addEntry(fresh, 'premonition', 1))!.snapshot.units).toEqual({});
    const prologue = latestEntry(addEntry(addEntry(fresh, 'premonition', 1), 'prologue', 2))!.snapshot.units;
    expect(prologue.chrom).toMatchObject({ level: 1, inventory: [{ item: 'Falchion' }, { item: 'Rapier' }] });
  });

  it('wait for Robin’s gender, as Record results does, and leave out a unit already in the army or dead', () => {
    const open = runFromRoster(withRun(EMPTY_ROSTER, { difficulty: 'normal' }));
    expect(prepUnits(open, 'prologue').joining).toEqual(['chrom', 'lissa', 'frederick']);
    const recorded = addEntry(fresh, 'prologue', 1);
    expect(prepUnits(recorded, 'prologue').joining).toEqual([]);
    const dead = withRoster(recorded, withState(rosterOf(recorded), 'frederick', 'dead'));
    expect(ids(prepUnits(dead, 'chapter-1').units)).not.toContain('frederick');
  });

  it('fill the recruits once when the map is recorded after preparing it', () => {
    prepUnits(fresh, 'prologue');
    const units = latestEntry(addEntry(fresh, 'prologue', 1))!.snapshot.units;
    expect(Object.keys(units)).toEqual(['chrom', 'robin', 'lissa', 'frederick']);
  });
});

describe('review fixes (#131–#133 review)', () => {
  it('keep Premonition’s own setups apart from recruits who join the army', () => {
    const p = prepUnits(runFromRoster(facts), 'premonition');
    expect(p.joining).toEqual([]);
    expect(p.mapOnly).toEqual(['chrom', 'robin']);
    expect(prepUnits(runFromRoster(facts), 'prologue').mapOnly).toEqual([]);
  });
});

describe('a child’s join stats in Record results (#155)', () => {
  const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
  const unit = (cls: string, st: UnitSnapshot['stats']): UnitSnapshot => ({ class: cls, level: 10, promoted: true, reclassed: false, exp: 0, stats: st, skills: [], inventory: [], supports: [] });
  const logged = (units: Partial<Record<RosterUnit, UnitSnapshot>>, marriages: [RosterUnit, RosterUnit][] = []): Run => {
    let run = editEntry(runFromRoster(facts), 'e1', (s) => ({ ...s, units }), 1);
    for (const [a, b] of marriages) run = recordMarriage(run, 'e1', a, b, 1);
    return run;
  };
  const joinBefore = (run: Run, child: Parameters<typeof childJoinFrom>[2]) => childJoinFrom(run, latestEntry(run)!.snapshot, child);
  // SF forums 33434: Chrom (Great Lord) and Sumia (Dark Flier) on entering Chapter 13.
  const chrom = unit('Great Lord', stats(52, 27, 7, 27, 31, 27, 23, 14));
  const sumia = unit('Dark Flier', stats(46, 24, 16, 37, 37, 30, 10, 25));

  it('fills Lucina from her parents as they were on entering: 38/18/7/25/25/23/13/11', () => {
    const run = addEntry(logged({ chrom, sumia }, [['chrom', 'sumia']]), 'chapter-13', 2);
    expect(latestEntry(run)!.snapshot.units.lucina).toMatchObject({ class: 'Lord', level: 10, stats: stats(38, 18, 7, 25, 25, 23, 13, 11) });
  });

  it('keeps a child’s stats blank when the other parent’s stats aren’t logged, and names that parent', () => {
    const before = logged({ chrom, sumia: unit('Dark Flier', null) }, [['chrom', 'sumia']]);
    expect(latestEntry(addEntry(before, 'chapter-13', 2))!.snapshot.units.lucina!.stats).toBeNull();
    expect(joinBefore(before, 'lucina')).toMatchObject({ join: null, missing: ['sumia'] });
    // A parent not in the log at all is missing too.
    expect(joinBefore(logged({ chrom }, [['chrom', 'sumia']]), 'lucina')).toMatchObject({ join: null, missing: ['sumia'] });
  });

  it('names the fixed parent when it has no spouse in the log', () => {
    expect(joinBefore(logged({ sumia }), 'cynthia')).toMatchObject({ join: null, unmarried: 'sumia' });
  });

  it('counts the Maiden’s side as 0 for Lucina when Chrom is recorded married to her', () => {
    const run = addEntry(logged({ chrom }, [['chrom', 'maiden']]), 'chapter-13', 2);
    // floor(((52 − 23) + 0 + 12) / 3) + 16 = 29.
    expect(latestEntry(run)!.snapshot.units.lucina!.stats!.hp).toBe(29);
  });

  it('never infers the Maiden: with no recorded wife, Lucina’s stats stay blank and Chrom is named', () => {
    const before = logged({ chrom });
    expect(latestEntry(addEntry(before, 'chapter-13', 2))!.snapshot.units.lucina!.stats).toBeNull();
    expect(joinBefore(before, 'lucina')).toMatchObject({ join: null, unmarried: 'chrom' });
  });

  it('brings Morgan in with Robin and Robin’s spouse, in the spouse’s starting class', () => {
    const robin = unit('Tactician', stats(40, 15, 20, 20, 20, 15, 12, 12));
    const run = addEntry(logged({ robin, sumia }, [['robin', 'sumia']]), 'paralogue-12', 2);
    // Robin (M): Morgan is a daughter, in Sumia's Pegasus Knight. Spd: floor(((20 − 5) + (37 − 10) + 6) / 3) + 8 = 24.
    expect(latestEntry(run)!.snapshot.units['morgan-f']).toMatchObject({ class: 'Pegasus Knight', level: 10, stats: { spd: 24 } });
  });
});
