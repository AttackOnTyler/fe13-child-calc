import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, createEngine, deployCount, deployRoleOf, foesOf, forcedOn, itemByName, prepUnits, runFromRoster, simLineup, suggestDeployment, unitName, withRun, type Difficulty, type SimGroup } from '../engine';
import { fighterOf, noDeathReadout } from './prep-page';

const unit = {
  class: 'Great Knight',
  level: 1,
  promoted: true,
  reclassed: false,
  exp: 0,
  stats: { hp: 28, str: 13, mag: 2, skl: 12, spd: 10, lck: 6, def: 14, res: 3 },
  skills: ['Discipline'],
  inventory: [
    { item: 'Vulnerary', uses: 3 },
    { item: 'Silver Lance', uses: 20 },
    { item: 'Steel Sword', uses: 30, forge: { name: 'Kiri', mt: 2, hit: 10, crit: 0 } },
  ],
  supports: [
    { partner: 'sully' as const, rank: 'C' as const },
    { partner: 'cordelia' as const, rank: 'A' as const },
  ],
};

describe('the preparation page’s fighters', () => {
  it('take a unit’s weapons from its inventory, with forges, skipping items', () => {
    const f = fighterOf('Frederick', unit)!;
    expect(f.weapons.map((w) => w.item.name)).toEqual(['Silver Lance', 'Steel Sword']);
    expect(f.weapons[1]!.forge).toEqual({ mt: 2, hit: 10, crit: 0 });
    expect(fighterOf('Nobody', { ...unit, stats: null })).toBeUndefined();
  });

  it('carry its staves and potions with the uses left, for the simulation’s sustain (#182)', () => {
    const f = fighterOf('Frederick', { ...unit, inventory: [...unit.inventory, { item: 'Heal', uses: 12 }, { item: 'Vulnerary', uses: 0 }] })!;
    expect(f.items.map((i) => [i.item.name, i.uses])).toEqual([
      ['Vulnerary', 3],
      ['Heal', 12],
    ]);
  });

});

describe('the next map’s no-death chance (#181)', () => {
  const engine = createEngine();
  const stats = (hp: number, str: number, skl: number, spd: number, lck: number, def: number) => ({ hp, str, mag: 0, skl, spd, lck, def, res: 0 });
  const member = (id: string, s: ReturnType<typeof stats>) => {
    const weapon = { item: itemByName('Silver Sword')! };
    return { id, fighter: { name: id, className: 'Swordmaster', stats: s, skills: [], weapon }, weapons: [weapon] };
  };

  it('reads the chance with the edge wording, and how the map ends', () => {
    const strong: SimGroup[] = [{ lead: member('chrom', stats(60, 40, 40, 40, 30, 30)), support: null }];
    const r = noDeathReadout(engine, 'chapter-2', 'lunatic', strong);
    expect(r.text).toBe('No-death chance: 100%');
    expect(r.detail).toMatch(/^Played turn by turn with this deployment and your latest stats: a rout in \d+ turns?\./);
    const frail: SimGroup[] = [{ lead: member('chrom', stats(18, 7, 6, 6, 4, 5)), support: null }];
    expect(noDeathReadout(engine, 'chapter-2', 'lunatic', frail).text).toMatch(/^No-death chance: (\d+\.\d%|under 0\.1%|0%)( \((loses a unit|flawless) about 1 run in [\d,]+\))?$/);
  });

  it('asks for recorded stats when nobody can be fielded', () => {
    expect(noDeathReadout(engine, 'chapter-2', 'lunatic', []).text).toBe('No-death chance: record your units’ stats in the chapter log to see it.');
  });
});

describe('the no-death chance of a fresh run’s first maps (#183)', () => {
  const engine = createEngine();
  /**
   * The lineup the preparation page fields for `map` on a fresh run: the chapter log through the maps before it, each
   * map's recruits at their join stats and inventory, the deployment the page suggests (roster roles).
   */
  function freshLineup(difficulty: Difficulty, map: string, before: readonly string[]): SimGroup[] {
    let run = runFromRoster(withRun(EMPTY_ROSTER, { gender: 'M', asset: 'mag', flaw: 'hp', difficulty, mode: 'classic', route: 'main-story' }));
    before.forEach((m, i) => (run = addEntry(run, m, i + 1)));
    const prep = prepUnits(run, map);
    const table = difficulty === 'lunatic-plus' ? 'lunatic' : difficulty;
    const m = engine.maps().find((x) => x.id === map)!;
    const candidates = prep.units.flatMap(([unit, u]) => {
      const f = fighterOf(unitName(unit, 'M'), u);
      return f ? [{ unit, role: deployRoleOf(unit, run.roster, new Map()), fighter: f.fighter, weapons: f.weapons, items: f.items, supports: u.supports }] : [];
    });
    const opening = [...prep.joining, ...prep.mapOnly];
    const max = deployCount(m.conditions[table]?.deploy ?? '', opening.map((u) => unitName(u))) || candidates.length;
    const deployment = suggestDeployment({ candidates, forced: [...forcedOn(map), ...opening], max, foes: foesOf(m, table, false), pool: () => [] });
    return simLineup(deployment, new Map(candidates.map((c) => [c.unit, c])));
  }
  const chance = (difficulty: Difficulty, map: string, before: readonly string[]) => engine.mapNoDeath({ map: engine.simMap(map, difficulty), lineup: freshLineup(difficulty, map, before) }, 1);

  // A careful player clears these essentially always: Frederick fights, the weak units wait out of reach (#183).
  it.each([
    ['normal', 'prologue', ['premonition']],
    ['hard', 'prologue', ['premonition']],
    ['lunatic', 'prologue', ['premonition']],
    ['normal', 'chapter-1', ['premonition', 'prologue']],
    ['normal', 'chapter-2', ['premonition', 'prologue', 'chapter-1']],
    ['normal', 'chapter-3', ['premonition', 'prologue', 'chapter-1', 'chapter-2']],
  ] as const)('reads %s %s as nearly always flawless', (difficulty, map, before) => {
    expect(freshLineup(difficulty, map, before).length).toBeGreaterThan(0);
    expect(chance(difficulty, map, before)).toBeGreaterThanOrEqual(0.9);
  });
});
