import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEED, EMPTY_ROSTER, composition, createEngine, quotasFor, withRun, type PlanSettings, type Roster } from './index';

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
const noRobin: PlanSettings = { ...settings, noRobin: true };
const roster: Roster = withRun(EMPTY_ROSTER, { gender: 'M', asset: 'mag', flaw: 'str' });

describe('the no-Robin view', () => {
  it('removes Robin as a parent from every pool, and Morgan from the cast', () => {
    const d = engine.deriveRoles(roster, noRobin);
    expect(d.leftOut.get('morgan-f')).toBe('no-robin');
    expect(d.roles.some((r) => r.child === 'morgan-f')).toBe(false);
    expect(d.roles.flatMap((r) => Object.values(r.bestPairing)).some((k) => k!.includes('robin'))).toBe(false);
    // With Robin, some child's best is a Robin pairing.
    expect(engine.deriveRoles(roster, settings).roles.flatMap((r) => Object.values(r.bestPairing)).some((k) => k!.includes('robin'))).toBe(true);
  });

  it('plans no Robin pairing and no Morgan, and doesn’t count Robin as deployed', () => {
    const plan = engine.plan(roster, noRobin);
    const children = plan.marriages.flatMap((m) => m.children);
    expect(children.some((c) => c.key.includes('robin') || c.child === 'morgan-f')).toBe(false);
    const q = noRobin.quotas;
    expect(composition(roster, plan, q, true).deployed.count).toBe(composition(roster, plan, q).deployed.count - 1);
  });

  it('reruns army fit over the Robin-less cast', () => {
    const roles = engine.roles(roster, noRobin);
    expect(roles.has('morgan-f')).toBe(false);
    for (const r of engine.deriveRoles(roster, noRobin).roles) expect(roles.get(r.child)).toBeDefined();
  });
});

describe('Robin gain', () => {
  const gains = engine.robinGain(roster, settings);

  it('is with Robin minus without, both named, for every child in the cast but Morgan', () => {
    expect(gains.has('morgan-f')).toBe(false);
    expect(gains.size).toBe(engine.deriveRoles(roster, settings).roles.length - 1);
    for (const g of gains.values()) {
      expect(g.gain).toBeCloseTo(g.with.score - (g.without?.score ?? 0));
      expect(g.gain).toBeGreaterThanOrEqual(0);
      expect(g.without?.parent.startsWith('Robin')).not.toBe(true);
    }
    const gainers = [...gains.values()].filter((g) => g.gain > 0);
    expect(gainers.length).toBeGreaterThan(0);
    // The run facts' Robin, not the best Robin.
    expect(gainers.every((g) => g.with.parent === 'Robin (M) +Mag −Str')).toBe(true);
  });

  it('is 0 where Robin isn’t the child’s best parent (Kjelle, Cynthia)', () => {
    for (const child of ['kjelle', 'cynthia'] as const) {
      const g = gains.get(child)!;
      expect(g.gain).toBe(0);
      expect(g.with.key).toBe(g.without!.key);
    }
  });

  it('takes each child’s best Robin when Robin isn’t set', () => {
    const open = engine.robinGain(EMPTY_ROSTER, settings);
    const set = gains;
    for (const [child, g] of set) if (open.has(child)) expect(open.get(child)!.with.score).toBeGreaterThanOrEqual(g.with.score);
  });
});
