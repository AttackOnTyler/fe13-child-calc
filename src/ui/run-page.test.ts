import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, createEngine, editEntry, latestEntry, recordMarriage, runFromRoster, withRun, type Route, type RosterUnit, type UnitSnapshot } from '../engine';
import { childStatsNote, flawlessReadout, heldText, mapOrderReadout, parseHeldText, parseSupportsText, supportsText } from './run-page';
import { chanceText } from './chance';

describe('the map order readout (#179)', () => {
  const engine = createEngine();
  const run = (route: Route, ...maps: string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(withRun(EMPTY_ROSTER, { route, difficulty: 'lunatic' })));

  it('lists the Full route’s maps still to play, marking the plan’s choices and the endpoint', () => {
    const r = mapOrderReadout(engine, run('full-route', 'premonition', 'prologue', 'chapter-1'));
    expect(r.title).toBe('Map order: Full route, to Apotheosis (secret route), deploying 20');
    expect(r.rows.slice(0, 2)).toEqual(['Chapter 2: Shepherds', 'Chapter 3: Warrior Realm']);
    expect(r.rows).toContain('Paralogue 5: Scion of Legend (the plan places it)');
    expect(r.rows).toContain('Infinite Regalia (optional)');
    expect(r.rows.slice(-2)).toEqual(['Apotheosis', 'Apotheosis (secret route) (endpoint)']);
  });

  it('ends the Main story at Endgame, and says when the endpoint is recorded', () => {
    const r = mapOrderReadout(engine, run('main-story'));
    expect(r.title).toBe('Map order: Main story, to Endgame, deploying 16');
    expect(r.rows[0]).toBe('Premonition: Invisible Ties');
    expect(r.rows.at(-1)).toBe('Endgame: Grima (endpoint)');
    const all = engine.mapOrder(run('main-story')).steps.map((s) => s.map);
    expect(mapOrderReadout(engine, run('main-story', ...all)).rows).toEqual([]);
  });
});

describe('the flawless chance readout (#186)', () => {
  const engine = createEngine();
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const played = (maps: readonly string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
  const all = engine.mapOrder(played([])).steps.map((s) => s.map);

  it('shows the chance with its ± and says what it covers', () => {
    const run = played(all.slice(0, -2));
    const r = flawlessReadout(engine, run, { runs: 3 });
    const sim = engine.flawlessChance(run, { runs: 3 });
    const ceiling = engine.ceiling(run, { runs: 3 })!;
    expect(r.text).toBe(`Flawless chance: ${chanceText(sim.chance)} ±${(sim.margin * 100).toFixed(1)} · ceiling ${chanceText(ceiling.chance!)}`);
    expect(r.detail).toContain('The ceiling is the chance no unit dies on Endgame with every unit at its effective caps');
    expect(r.detail).toContain('from Chapter 25 to Endgame (2 maps)');
    expect(r.detail).toContain('over 3 simulated runs; the ± is the simulation error (95%)');
    expect(r.detail).toContain('Rests on: one worst attacker per pair (may read high)');
    expect(r.detail).toContain('promotions at the level cap (either way), each fight’s EXP goes to its lead (may read low)');
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatch(/^Chapter 25: /);
  });

  it('names a unit whose seal history is read as 0, and says when the endpoint is recorded', () => {
    const run = editEntry(played(all.slice(0, -1)), 'e1', (s) => ({ ...s, units: { ...s.units, chrom: { class: 'Great Lord', level: 5, promoted: true, reclassed: false, exp: 0, stats: { hp: 40, str: 20, mag: 3, skl: 20, spd: 20, lck: 20, def: 15, res: 10 }, skills: [], inventory: [], supports: [] } } }), 1);
    expect(flawlessReadout(engine, run, { runs: 1 }).detail).toContain('Chrom was first logged in a class it can’t join in: the Second Seal count before the log is read as 0');
    expect(flawlessReadout(engine, played(all), { runs: 1 }).text).toBe('Flawless chance: the endpoint is recorded, nothing left to simulate.');
  });

  it('says there’s no ceiling yet when the endpoint can’t be simulated (Apotheosis)', () => {
    const full = withRun(EMPTY_ROSTER, { route: 'full-route', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
    const order = engine.mapOrder(runFromRoster(full)).steps.map((s) => s.map);
    // Played up to the last story chapter: Apotheosis (both routes) is what's left.
    const run = order.slice(0, order.indexOf('apotheosis')).reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(full));
    const r = flawlessReadout(engine, run, { runs: 1 });
    expect(r.text).toMatch(/ · no ceiling yet$/);
    expect(r.detail).toContain('Apotheosis and Apotheosis (secret route) aren’t simulated yet: their foes carry no weapons in the chapter data, so the chance counts no risk there and there’s no ceiling.');
  });
});

describe('the chapter log’s short text fields', () => {
  it('round-trip inventory with uses and forges', () => {
    const items = [
      { item: 'Iron Sword', uses: 40 },
      { item: 'Steel Sword', uses: 30, forge: { name: 'Kiri', mt: 2, hit: 10, crit: 0 } },
      { item: 'Falchion', uses: null },
    ];
    expect(heldText(items)).toBe('Iron Sword 40; Steel Sword 30 [Kiri +2/+10/+0]; Falchion');
    expect(parseHeldText(heldText(items))).toEqual(items);
  });

  it('round-trip supports, dropping anything that isn’t a rank', () => {
    const s = [{ partner: 'sumia' as const, rank: 'A' as const }];
    expect(parseSupportsText(supportsText(s))).toEqual(s);
    expect(parseSupportsText('sumia Z; lissa C')).toEqual([{ partner: 'lissa', rank: 'C' }]);
  });
});

describe('Record results’ recruits step (#155)', () => {
  const facts = withRun(EMPTY_ROSTER, { gender: 'M', asset: 'mag', flaw: 'str', difficulty: 'lunatic', route: 'main-story' });
  const stats = { hp: 46, str: 24, mag: 16, skl: 37, spd: 37, lck: 30, def: 10, res: 25 };
  const unit = (cls: string, st: UnitSnapshot['stats']): UnitSnapshot => ({ class: cls, level: 10, promoted: true, reclassed: false, exp: 0, stats: st, skills: [], inventory: [], supports: [] });
  const recorded = (units: Partial<Record<RosterUnit, UnitSnapshot>>, wife: RosterUnit | null) => {
    let run = editEntry(runFromRoster(facts), 'e1', (s) => ({ ...s, units }), 1);
    if (wife) run = recordMarriage(run, 'e1', 'chrom', wife, 1);
    run = addEntry(run, 'chapter-13', 2);
    return (u: RosterUnit) => childStatsNote(run, latestEntry(run)!, u);
  };

  it('names the parent whose stats kept a child’s blank', () => {
    const note = recorded({ chrom: unit('Great Lord', stats), sumia: unit('Dark Flier', null) }, 'sumia');
    expect(note('lucina')).toBe('Lucina: Sumia’s stats aren’t logged in the entry before this map, so Lucina’s stats are blank: record them from the game.');
    expect(note('chrom')).toBeNull();
  });

  it('says which parents a child’s stats were worked out from', () => {
    expect(recorded({ chrom: unit('Great Lord', stats), sumia: unit('Dark Flier', stats) }, 'sumia')('lucina')).toBe('Lucina: worked out from Chrom and Sumia as they were on entering this map.');
    expect(recorded({ chrom: unit('Great Lord', stats) }, 'maiden')('lucina')).toBe('Lucina: worked out from Chrom and the Maiden as they were on entering this map (the Maiden’s side is an assumption).');
    expect(recorded({ chrom: unit('Great Lord', stats) }, null)('lucina')).toBe('Lucina: Chrom isn’t married in the entry before this map, so Lucina’s stats are blank: record them from the game.');
  });
});
