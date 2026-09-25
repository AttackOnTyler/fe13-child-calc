import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEED, EMPTY_ROSTER, createEngine, quotasFor, withRun, withSpouse, withState, type PlanSettings, type Roster } from './index';

const engine = createEngine();
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
const roster: Roster = withRun(EMPTY_ROSTER, { gender: 'M', asset: 'mag', flaw: 'str' });

describe('a unit’s Partners', () => {
  it('lists every S-support partner, Robin last in data but sorted by the best child', () => {
    const rows = engine.partners('lonqu', withRun(EMPTY_ROSTER, { gender: 'F' }), settings);
    expect(rows.map((r) => r.partner)).toEqual(expect.arrayContaining(['sully', 'olivia', 'cordelia', 'robin']));
    expect(rows.some((r) => r.partner === 'sumia')).toBe(false); // Sumia's list is restricted
    const best = rows.map((r) => r.best ?? -1);
    expect(best).toEqual([...best].sort((a, b) => b - a));
    // Lon'qu is no child's fixed parent, so each row holds the mother's child.
    expect(rows.find((r) => r.partner === 'olivia')!.children.map((c) => c.child)).toEqual(['inigo']);
    expect(rows.find((r) => r.partner === 'robin')!.children.map((c) => c.child)).toEqual(['morgan-m']);
  });

  it('shows the mother’s child and Morgan for a woman’s Robin row, on the run’s Robin', () => {
    const rows = engine.partners('sumia', roster, settings);
    const robin = rows.find((r) => r.partner === 'robin')!;
    expect(robin.name).toBe('Robin (M)');
    expect(robin.children.map((c) => c.child)).toEqual(['cynthia', 'morgan-f']);
    expect(robin.children.every((c) => c.key.includes('robin') && c.key.includes('mag/str'))).toBe(true);
  });

  it('scores a child whose plan preset has no weights (Battery) in its Lead role preset', () => {
    const roles = engine.roles(roster, settings);
    const rows = engine.partners('sumia', roster, settings);
    for (const c of rows.flatMap((r) => r.children)) {
      expect(c.score).toBeDefined();
      if (roles.get(c.child)?.role === 'battery') expect(c.preset).not.toBe('battery');
    }
  });

  it('marks the planned partner, the married one, and blocked or dead partners with the reason', () => {
    const r1 = { ...withSpouse(roster, 'sumia', 'chrom', 'married'), savedPlan: { robin: null, marriages: [['chrom', 'sumia'] as const, ['frederick', 'olivia'] as const] } };
    const sumia = engine.partners('sumia', r1, settings);
    expect(sumia.find((r) => r.partner === 'chrom')).toMatchObject({ married: true, planned: true, blocked: undefined });
    expect(sumia.find((r) => r.partner === 'henry')!.blocked).toMatch(/Sumia/);
    const olivia = engine.partners('olivia', withState(r1, 'gaius', 'dead'), settings);
    expect(olivia.find((r) => r.partner === 'frederick')!.planned).toBe(true);
    expect(olivia.find((r) => r.partner === 'gaius')).toMatchObject({ dead: true });
    expect(olivia.find((r) => r.partner === 'gaius')!.blocked).toBeDefined();
  });

  it('gives a SpotPass unit Robin only', () => {
    expect(engine.partners('walhart', roster, settings).map((r) => r.partner)).toEqual(['robin']);
  });
});
