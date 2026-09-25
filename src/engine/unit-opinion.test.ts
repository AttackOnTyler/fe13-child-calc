import { describe, expect, it } from 'vitest';
import { SOURCES } from '../curated/sources';
import { UNIT_OPINIONS, type OpinionUnit } from '../curated/unit-opinion';
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { ROBIN_SUPPORTS } from '../game-data/supports';
import { DEFAULT_SPEED, EMPTY_ROSTER, createEngine, quotasFor, withRun, type PageUnitId, type PlanSettings, type RobinRef, type ScoreSettings } from './index';

const engine = createEngine();
const dlc = { context: 'apotheosis', dlc: true } as const;
const robins: RobinRef[] = (['M', 'F'] as const).map((gender) => ({ kind: 'robin', gender, asset: 'mag', flaw: 'str' }));
const isChild = (u: OpinionUnit): u is ChildId => u in CHILD_UNITS;

/** Every class the unit (either Robin, any pairing of a child) can be in. */
function classesOf(u: OpinionUnit): Set<string> {
  if (isChild(u)) return new Set(engine.pairings(u).flatMap((r) => engine.reachableClasses(r)));
  const pages = u === 'robin' ? robins.map((r) => engine.unitPage(r, dlc)) : [engine.unitPage(u, dlc)];
  return new Set(pages.flatMap((p) => [...p.tree.lines.flatMap((l) => [l.base, ...l.promotions]), ...p.tree.dlc].map((c) => c.id)));
}

describe('unit opinion (curated)', () => {
  it('cites the registry', () => {
    for (const o of UNIT_OPINIONS) expect(SOURCES[o.source], o.unit).toBeDefined();
  });

  it('names only classes its unit can reach', () => {
    const bad = UNIT_OPINIONS.flatMap((o) => o.classes.filter((c) => !classesOf(o.unit).has(c)).map((c) => `${o.unit}: ${c}`));
    expect(bad).toEqual([]);
  });

  it('names only loadout skills its unit can reach (some Robin for Robin)', () => {
    const subjects = (u: OpinionUnit) => (u === 'robin' ? robins : [u as PageUnitId]);
    const bad = UNIT_OPINIONS.flatMap((o) =>
      o.loadout.flat().filter((id) => !subjects(o.unit).some((s) => engine.unitSkillCard(s, id, dlc).sources.length)).map((id) => `${o.unit}: ${id}`),
    );
    expect(bad).toEqual([]);
  });

  it('recommends only partners who can marry the unit', () => {
    const bad = UNIT_OPINIONS.flatMap((o) =>
      [...o.recommended, ...o.warned]
        .filter((p) => {
          if (o.unit === 'robin') return ![...ROBIN_SUPPORTS.M, ...ROBIN_SUPPORTS.F].includes(p.unit as never);
          if (isChild(o.unit)) return !engine.groups(o.unit).some((g) => g.key === p.unit);
          return !engine.partners(o.unit, EMPTY_ROSTER, settings).some((r) => r.partner === p.unit);
        })
        .map((p) => `${o.unit}: ${p.unit}`),
    );
    expect(bad).toEqual([]);
  });

  it('covers every first-gen unit in the tables, every child and Robin', () => {
    const units = new Set(UNIT_OPINIONS.map((o) => o.unit));
    expect(units.size).toBe(30 + Object.keys(CHILD_UNITS).length);
    expect(UNIT_OPINIONS.filter((o) => o.unit === 'lucina').map((o) => o.context)).toEqual(['main-story', 'apotheosis']);
  });
});

const settings: PlanSettings = {
  context: 'all',
  preset: 'physical-lead',
  edits: {},
  basis: 'caps-lb',
  dlc: false,
  speed: DEFAULT_SPEED,
  supportRank: 'A',
  priorities: {},
  overrides: {},
  roleOverrides: {},
  quotas: quotasFor('all'),
};

describe('opinions on pages', () => {
  it('matches a loadout against the unit like a build template, and cites the video', () => {
    const [lonqu] = engine.unitOpinions('lonqu', dlc);
    expect(lonqu).toMatchObject({ source: { id: 'S10', name: 'Ellery' }, tier: 'A / S father', citation: 'Lon’qu is BETTER than you think' });
    expect(lonqu!.loadout).toMatchObject({ filled: 5 });
    expect(lonqu!.recommended[0]).toEqual({ name: 'Miriel', reason: 'for Laurent' });
    // A child's opinion has no loadout, and follows the play context.
    expect(engine.unitOpinions('lucina', { context: 'main-story', dlc: false }).map((o) => o.context)).toEqual(['main-story']);
    expect(engine.unitOpinions('lucina', { context: 'all', dlc: false })).toHaveLength(2);
    expect(engine.unitOpinions('lucina', dlc)[0]!.loadout).toBeUndefined();
  });

  it('shows Robin’s asset/flaw pick', () => {
    expect(engine.unitOpinions(robins[0]!, dlc)[0]!.robinPick).toBe('+Mag −Str');
  });

  it('marks recommended partners on Partners rows', () => {
    const rows = engine.partners('lonqu', EMPTY_ROSTER, settings);
    expect(rows.find((r) => r.partner === 'miriel')!.opinion).toEqual({ kind: 'recommended', reason: 'for Laurent', source: 'Ellery' });
    expect(rows.find((r) => r.partner === 'olivia')!.opinion).toBeUndefined();
  });

  it('marks recommended parents on the front door, outside the top 5 too', () => {
    const preset = engine.presets().find((p) => p.id === 'physical-lead')!;
    const s: ScoreSettings = { weights: preset.weights, mixed: preset.mixed, basis: 'caps-lb', classMode: 'auto', dlc: false, role: 'lead', supportRank: 'A', speed: DEFAULT_SPEED };
    const door = engine.frontDoor('kjelle', withRun(EMPTY_ROSTER, { gender: 'M' }), s, 'all');
    const marked = [...door.top, ...door.marked].filter((t) => t.mark).map((t) => t.label);
    expect(marked.sort()).toEqual(['Donnel', 'Gaius', 'Stahl']);
    expect(door.marked.every((t) => !door.top.some((x) => x.key === t.key))).toBe(true);
  });
});
