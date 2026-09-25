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
    expect(engine.partners('walhart', withRun(EMPTY_ROSTER, { gender: 'F' }), settings).map((r) => r.partner)).toEqual(['robin']);
  });
});

describe('Robin’s page', () => {
  const mag = { kind: 'robin', gender: 'M', asset: 'mag', flaw: 'str' } as const;
  const str = { kind: 'robin', gender: 'M', asset: 'str', flaw: 'mag' } as const;

  it('differs by asset/flaw: modifiers, bases and the children’s pairings', () => {
    const a = engine.unitPage(mag, { context: 'all', dlc: false });
    const b = engine.unitPage(str, { context: 'all', dlc: false });
    expect(a.name).toBe('Robin (M)');
    expect(a.asParent.modifiers.mag).toBeGreaterThan(b.asParent.modifiers.mag);
    expect(a.asParent.modifiers.str).toBeLessThan(b.asParent.modifiers.str);
    expect(a.join.normal).toMatchObject({ mag: 5 + 2, str: 6 - 1 });
    expect(b.join.normal).toMatchObject({ str: 6 + 2, mag: 5 - 1 });
    expect(a.tree.lines[0]!.base.join).toBe(true); // Tactician
    expect(a.asParent.children.every((c) => c.keys.every((k) => k.includes('mag/str')))).toBe(true);
  });

  it('shows Morgan plus the partner’s own child on a first-gen row', () => {
    const sumia = engine.partners(mag, EMPTY_ROSTER, settings).find((r) => r.partner === 'sumia')!;
    expect(sumia.children.map((c) => c.child)).toEqual(['cynthia', 'morgan-f']);
    expect(sumia.children.every((c) => c.key.includes('robin:mag/str'))).toBe(true);
  });

  it('names the pairing a child partner brings to Morgan: the saved plan’s, else its best left', () => {
    const best = engine.partners(mag, EMPTY_ROSTER, settings).find((r) => r.partner === 'lucina')!;
    expect(best.via).toMatchObject({ from: 'best' });
    expect(best.via!.label).toMatch(/^Lucina ← /);
    expect(best.children.map((c) => c.child)).toEqual(['morgan-f']);
    const planned = { ...EMPTY_ROSTER, savedPlan: { robin: null, marriages: [['chrom', 'olivia'] as const] } };
    const row = engine.partners(mag, planned, settings).find((r) => r.partner === 'lucina')!;
    expect(row.via).toEqual({ label: 'Lucina ← Olivia', from: 'plan' });
    expect(row.children[0]!.key).toContain('lucina<olivia');
  });

  it('never has a child partner bring a pairing with Robin as its own parent, so Morgan always scores (#124)', () => {
    const female = { kind: 'robin', gender: 'F', asset: 'str', flaw: 'def' } as const;
    const rows = engine.partners(female, EMPTY_ROSTER, settings);
    const yarne = rows.find((r) => r.partner === 'yarne')!;
    // Yarne's best non-Robin father, as his mother's Partners score him.
    const fathers = engine.partners('panne', EMPTY_ROSTER, settings).filter((r) => r.partner !== 'robin');
    const yarneScore = (r: (typeof fathers)[number]) => r.children.find((c) => c.child === 'yarne')?.score ?? -1;
    const top = Math.max(...fathers.map(yarneScore));
    expect(fathers.filter((r) => yarneScore(r) === top).map((r) => `Yarne ← ${r.name}`)).toContain(yarne.via!.label);
    expect(yarne.children).toEqual([expect.objectContaining({ child: 'morgan-m', score: expect.any(Number) })]);
    expect(yarne.children[0]!.key).toContain('robin:str/def');
    expect(rows.filter((r) => r.via).map((r) => r.partner)).toEqual(expect.arrayContaining(['owain', 'inigo', 'brady', 'gerome', 'yarne', 'laurent']));
    for (const robin of [female, mag]) {
      for (const r of engine.partners(robin, EMPTY_ROSTER, settings).filter((r) => r.via)) {
        expect(r.via!.label).not.toMatch(/Robin/);
        expect(r.children[0]?.score).toEqual(expect.any(Number));
      }
    }
    // Nor for Robin (M): Lucina's mother can't be the Robin marrying her.
    const saved = { ...EMPTY_ROSTER, savedPlan: { robin: null, marriages: [['chrom', 'robin'] as const] } };
    const lucina = engine.partners(mag, saved, settings).find((r) => r.partner === 'lucina')!;
    expect(lucina.via).toMatchObject({ from: 'best' });
    expect(lucina.via!.label).not.toMatch(/Robin/);
    expect(lucina.children[0]?.score).toEqual(expect.any(Number));
  });
});

describe('review fixes (#107)', () => {
  it('scores a Robin row on one Robin when Robin is open', () => {
    const robin = engine.partners('sumia', EMPTY_ROSTER, settings).find((r) => r.partner === 'robin')!;
    const afs = new Set(robin.children.map((c) => c.key.match(/robin:(\w+\/\w+)/)![1]));
    expect(afs.size).toBe(1);
    expect(`${robin.robin!.asset}/${robin.robin!.flaw}`).toBe([...afs][0]);
  });

  it('drops the Robin row once the run’s Robin is the unit’s own gender', () => {
    expect(engine.partners('lonqu', withRun(EMPTY_ROSTER, { gender: 'M' }), settings).some((r) => r.partner === 'robin')).toBe(false);
    expect(engine.partners('lonqu', withRun(EMPTY_ROSTER, { gender: 'F' }), settings).some((r) => r.partner === 'robin')).toBe(true);
  });
});
