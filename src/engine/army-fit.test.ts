import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPEED,
  EMPTY_ROSTER,
  STAFF_CLASSES,
  composition,
  createEngine,
  quotasFor,
  withRun,
  type PlanSettings,
  type Quotas,
  type Roster,
} from './index';

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
const withQuotas = (edit: (q: Quotas) => Quotas): PlanSettings => ({ ...settings, quotas: edit(settings.quotas) });
const planned = (s: PlanSettings) => engine.plan(roster, s).marriages.flatMap((m) => m.children);

describe('army fit', () => {
  it('fills Battery from the children with the lowest Lead standing, and says which quota moved them', () => {
    const roles = engine.roles(roster, settings);
    const lead = new Map(engine.deriveRoles(roster, settings).roles.map((r) => [r.child, r.roleStanding.lead]));
    const moved = [...roles].filter(([, a]) => a.source === 'army fit' && a.role === 'battery').map(([c]) => c);
    const stayed = [...roles].filter(([, a]) => a.source === 'derived' && a.role === 'lead').map(([c]) => c);
    expect(moved.length).toBeGreaterThan(0);
    expect(Math.max(...moved.map((c) => lead.get(c)!))).toBeLessThanOrEqual(Math.min(...stayed.map((c) => lead.get(c)!)));
    for (const c of moved) expect(roles.get(c)!.reason).toMatch(/Battery below its minimum|Lead over its maximum/);
  });

  it('puts only children whose planned pairing reaches a staff class or rally skill in Staff/Rally', () => {
    for (const c of planned(settings)) {
      if (c.deploymentRole !== 'staff' || c.roleSource !== 'army fit') continue;
      const r = engine.result(c.key)!;
      const staff = engine.reachableClasses(r).some((id) => (STAFF_CLASSES as readonly string[]).includes(id));
      const rally = engine.skillView(r, { context: settings.context, dlc: settings.dlc });
      expect(staff || JSON.stringify(rally).includes('rally')).toBe(true);
    }
  });

  it('counts an overridden child but never moves it', () => {
    const s = { ...settings, overrides: { lucina: 'physical-lead' }, roleOverrides: { owain: 'lead' } } as const;
    const roles = engine.roles(roster, s);
    expect(roles.get('lucina')).toMatchObject({ role: 'lead', source: 'preset override' });
    expect(roles.get('owain')).toMatchObject({ role: 'lead', source: 'role override' });
  });

  it('reports an unmet minimum rather than forcing children who can’t heal into Staff/Rally', () => {
    // More Staff/Rally than there are children: only the ones who qualify move, and the rest stays short.
    const s = withQuotas((q) => ({ ...q, roles: { ...q.roles, staff: { min: 20, max: 20 } } }));
    const c = composition(roster, engine.plan(roster, s), s.quotas);
    expect(c.roles.find((r) => r.role === 'staff')!.status).toBe('under');
  });

  it('never benches a child: an overflowing army gives every child in the cast a role, and warns', () => {
    const tight = withQuotas((q) => ({ ...q, roles: { lead: { min: 0, max: 1 }, battery: { min: 0, max: 1 }, staff: { min: 0, max: 1 }, dancer: q.roles.dancer } }));
    const cast = engine.deriveRoles(roster, tight).roles.map((r) => r.child);
    const roles = engine.roles(roster, tight);
    expect(cast.every((c) => roles.has(c))).toBe(true);
    const c = composition(roster, engine.plan(roster, tight), tight.quotas);
    expect(c.roles.some((r) => r.status === 'over')).toBe(true);
  });

  it('moves nobody when every role has room', () => {
    const roomy = withQuotas((q) => ({ ...q, roles: { lead: { min: 0, max: 99 }, battery: { min: 0, max: 99 }, staff: { min: 0, max: 99 }, dancer: q.roles.dancer } }));
    expect([...engine.roles(roster, roomy).values()].every((a) => a.source === 'derived')).toBe(true);
  });

  it('gives each planned child its plan preset and where it came from', () => {
    for (const c of planned(settings)) {
      expect(c.roleSource).toBeDefined();
      expect(c.preset).toBe(engine.planPreset(c.child, roster, settings));
    }
  });
});
