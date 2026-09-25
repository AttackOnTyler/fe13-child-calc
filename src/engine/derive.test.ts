import { describe, expect, it } from 'vitest';
import { CANDIDATE_PRESETS, DEFAULT_SPEED, EMPTY_ROSTER, createEngine, withRun, withSpouse, withState, type PlanSettings, type Roster } from './index';
import { deriveRoles, type DeriveInput } from './derive';

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
};

const RUN = { gender: 'M', asset: 'mag', flaw: 'str' } as const;
const withRobin: Roster = withRun(EMPTY_ROSTER, RUN);

describe('standing', () => {
  // A toy cast: raw scores per preset, so the arithmetic is visible.
  const input = (raws: Record<string, Record<string, number>>): DeriveInput => ({
    children: ['lucina', 'owain', 'inigo'],
    leftOut: () => undefined,
    pool: (c) => [`${c}|a`],
    raw: (p, key) => raws[p]?.[key.split('|')[0]!],
  });

  it('is each child’s place between the weakest and strongest best in the cast', () => {
    const d = deriveRoles(input({ 'physical-lead': { lucina: 10, owain: 20, inigo: 30 } }));
    const st = Object.fromEntries(d.roles.map((r) => [r.child, r.standing['physical-lead']]));
    expect(st).toEqual({ lucina: 0, owain: 0.5, inigo: 1 });
  });

  it('is 0 for everyone when a preset’s spread is zero, so that role is never best', () => {
    const d = deriveRoles(input({ 'physical-lead': { lucina: 10, owain: 20, inigo: 30 }, battery: { lucina: 5, owain: 5, inigo: 5 } }));
    expect(d.roles.every((r) => r.roleStanding.battery === 0 && r.bestRole === 'lead')).toBe(true);
  });

  it('breaks an exact tie by menu order: a lead preset beats its hard-support twin', () => {
    const d = deriveRoles(
      input({ 'physical-lead': { lucina: 0, owain: 10, inigo: 20 }, 'physical-hard-support': { lucina: 0, owain: 10, inigo: 20 } }),
    );
    expect(d.roles.find((r) => r.child === 'owain')!.rolePreset.lead).toBe('physical-lead');
  });

  it('leaves a child with nothing left in its pool out of the cast as unborn', () => {
    const d = deriveRoles({ ...input({}), pool: (c) => (c === 'owain' ? [] : [`${c}|a`]) });
    expect(d.leftOut.get('owain')).toBe('unborn');
    expect(d.roles.map((r) => r.child)).toEqual(['lucina', 'inigo']);
  });
});

describe('the engine’s derived roles', () => {
  it('derive Lead for every child today, because Battery’s spread is zero', () => {
    const d = engine.deriveRoles(withRobin, settings);
    expect(d.roles.length).toBeGreaterThan(10);
    expect(d.roles.every((r) => r.bestRole === 'lead')).toBe(true);
    expect(d.roles.every((r) => r.roleStanding.battery === 0 && r.roleStanding.staff === 0)).toBe(true);
  });

  it('never derive a niche preset', () => {
    const d = engine.deriveRoles(withRobin, settings);
    const candidates: readonly string[] = CANDIDATE_PRESETS.lead;
    expect(d.roles.every((r) => candidates.includes(r.rolePreset.lead))).toBe(true);
  });

  it('span the cast from 0 to 1 under each weighted candidate preset', () => {
    const d = engine.deriveRoles(withRobin, settings);
    for (const p of CANDIDATE_PRESETS.lead) {
      const st = d.roles.map((r) => r.standing[p]!);
      expect([Math.min(...st), Math.max(...st)]).toEqual([0, 1]);
    }
  });

  it('leave Morgan out until Robin is set', () => {
    const d = engine.deriveRoles(EMPTY_ROSTER, settings);
    expect(d.leftOut.get('morgan-m')).toBe('needs-robin');
    expect(d.leftOut.get('morgan-f')).toBe('needs-robin');
    expect(engine.deriveRoles(withRobin, settings).roles.some((r) => r.child === 'morgan-f')).toBe(true);
  });

  it('drop a dead child from the cast', () => {
    const d = engine.deriveRoles(withState(withRobin, 'gerome', 'dead'), settings);
    expect(d.leftOut.get('gerome')).toBe('dead');
  });

  it('rank a child whose parents are married on that one pairing', () => {
    const d = engine.deriveRoles(withSpouse(withRobin, 'sumia', 'henry', 'married'), settings);
    const cynthia = d.roles.find((r) => r.child === 'cynthia')!;
    expect(new Set(Object.values(cynthia.bestPairing))).toEqual(new Set(['cynthia|henry']));
  });
});
