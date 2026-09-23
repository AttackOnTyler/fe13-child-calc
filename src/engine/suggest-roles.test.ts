import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPEED,
  EMPTY_ROSTER,
  STAFF_CLASSES,
  SUGGEST_PASS_CAP,
  composition,
  createEngine,
  quotasFor,
  withDeploy,
  withSpouse,
  withState,
  type ChildId,
  type MarriagePlan,
  type PlanSettings,
  type PlannedChild,
  type Quotas,
  type Roster,
} from './index';

const engine = createEngine();

const settings: PlanSettings = {
  context: 'main-story',
  preset: 'physical-lead',
  edits: {},
  basis: 'caps-lb',
  dlc: false,
  speed: DEFAULT_SPEED,
  supportRank: 'A',
  priorities: {},
  overrides: {},
};

const RUN = { gender: 'M', asset: 'spd', flaw: 'hp' } as const;
const ROSTER: Roster = { ...EMPTY_ROSTER, run: RUN };

const kidsOf = (plan: MarriagePlan): Map<ChildId, PlannedChild> =>
  new Map(plan.marriages.flatMap((m) => m.children.map((c) => [c.child, c] as const)));

/** Quotas with each role's range, and room for everyone. */
const q = (lead: [number, number], battery: [number, number], staff: [number, number]): Quotas => ({
  cap: 99,
  roles: {
    lead: { min: lead[0], max: lead[1] },
    battery: { min: battery[0], max: battery[1] },
    staff: { min: staff[0], max: staff[1] },
    dancer: { min: 1, max: 1 },
  },
});

/** A pairing can take Staff/Rally: a staff class or a rally skill is in reach. */
const staffEligible = (c: PlannedChild, s: PlanSettings = settings) => {
  const r = engine.result(c.key)!;
  const dlc = s.dlc || engine.contextReachesDlc(s.context);
  const staves: readonly string[] = STAFF_CLASSES;
  return (
    engine.reachableClasses(r).some((id) => staves.includes(id) && (dlc || !engine.classes().find((k) => k.id === id)!.dlc)) ||
    engine.skillView(r, { context: s.context, dlc }).rallies.some((x) => x.sources.length > 0)
  );
};

describe('Suggest roles', () => {
  it('meets the quotas when enough children are available, within the pass cap', () => {
    // Apotheosis fits the 15 units Robin, Chrom and the 13 children make (Main story's maxes stop at 13).
    const apotheosis = { ...settings, context: 'apotheosis' } as const;
    const quotas = quotasFor('apotheosis');
    expect(composition(ROSTER, engine.plan(ROSTER, apotheosis), quotas).roles.some((r) => r.status !== 'ok')).toBe(true);
    const s = engine.suggestRoles(ROSTER, apotheosis, quotas);
    expect(s.passes).toBeGreaterThanOrEqual(1);
    expect(s.passes).toBeLessThanOrEqual(SUGGEST_PASS_CAP);
    const c = composition(ROSTER, s.plan, quotas);
    for (const r of c.roles) expect(r.status, r.role).toBe('ok');
  });

  it('returns the plan its picks make', () => {
    const s = engine.suggestRoles(ROSTER, settings, quotasFor('main-story'));
    const replanned = engine.plan(ROSTER, { ...settings, overrides: { ...settings.overrides, ...s.overrides } });
    expect(s.plan.total).toBeCloseTo(replanned.total);
    expect([...kidsOf(s.plan).values()].map((c) => [c.child, c.preset])).toEqual([...kidsOf(replanned).values()].map((c) => [c.child, c.preset]));
  });

  it('never changes a preset the user set', () => {
    const user = { lucina: 'battery', owain: 'rallybot', nah: 'physical-lead' } as const;
    // Quotas that would want every child's role moved.
    const s = engine.suggestRoles(ROSTER, { ...settings, overrides: user }, q([0, 3], [8, 99], [4, 99]));
    for (const child of Object.keys(user)) expect(s.overrides).not.toHaveProperty(child);
    const kids = kidsOf(s.plan);
    expect(kids.get('lucina')?.preset).toBe('battery');
    expect(kids.get('owain')?.preset).toBe('rallybot');
    expect(kids.get('nah')?.preset).toBe('physical-lead');
  });

  it('never assigns a child Dancer, even with a Dancer shortfall', () => {
    const quotas: Quotas = { ...q([0, 99], [0, 99], [0, 99]), roles: { ...q([0, 99], [0, 99], [0, 99]).roles, dancer: { min: 6, max: 6 } } };
    const s = engine.suggestRoles(withDeploy(ROSTER, 'olivia', false), settings, quotas);
    for (const c of kidsOf(s.plan).values()) expect(c.deploymentRole).not.toBe('dancer');
  });

  it('only puts children who can reach a staff class or rally skill on Staff/Rally', () => {
    const s = engine.suggestRoles(ROSTER, settings, q([0, 99], [0, 99], [99, 99]));
    const staff = [...kidsOf(s.plan).values()].filter((c) => c.deploymentRole === 'staff');
    expect(staff.length).toBeGreaterThan(0);
    for (const c of staff) expect(staffEligible(c), c.name).toBe(true);
    // Everyone eligible was put on Staff/Rally: the quota wants them all.
    for (const c of kidsOf(s.plan).values()) if (c.deploymentRole !== 'staff') expect(staffEligible(c), c.name).toBe(false);
  });

  it('meets a Lead minimum and a Staff/Rally minimum that compete for the same children', () => {
    // Every child leads by default here: a Lead minimum of all but two leaves exactly two for Staff/Rally.
    const leads = composition(ROSTER, engine.plan(ROSTER, settings), q([0, 99], [0, 99], [0, 99])).roles.find((r) => r.role === 'lead')!.count;
    const quotas = q([leads - 2, 99], [0, 99], [2, 2]);
    const s = engine.suggestRoles(ROSTER, settings, quotas);
    for (const r of composition(ROSTER, s.plan, quotas).roles) expect(r.status, r.role).toBe('ok');
  });

  it('gives Staff/Rally to the children it costs least', () => {
    // Staff/Rally scores 0: the loss is the child's whole value, so the priority-0 children take it first.
    const eligible = [...kidsOf(engine.plan(ROSTER, settings)).values()].filter((c) => staffEligible(c)).map((c) => c.child);
    expect(eligible.length).toBeGreaterThanOrEqual(4);
    const cheap = eligible.slice(0, 2);
    const priorities = Object.fromEntries(eligible.map((c) => [c, cheap.includes(c) ? 0 : 3]));
    const s = engine.suggestRoles(ROSTER, { ...settings, priorities }, q([0, 99], [0, 99], [2, 2]));
    const staff = [...kidsOf(s.plan).values()].filter((c) => c.deploymentRole === 'staff').map((c) => c.child);
    expect(staff.sort()).toEqual([...cheap].sort());
  });

  it('fills a Battery minimum and moves only what it must', () => {
    const base = composition(ROSTER, engine.plan(ROSTER, settings), q([0, 99], [0, 99], [0, 99]));
    const battery = base.roles.find((r) => r.role === 'battery')!.count;
    const s = engine.suggestRoles(ROSTER, settings, q([0, 99], [battery + 2, 99], [0, 99]));
    const after = composition(ROSTER, s.plan, q([0, 99], [battery + 2, 99], [0, 99]));
    expect(after.roles.find((r) => r.role === 'battery')!.count).toBe(battery + 2);
    const moved = Object.entries(s.overrides);
    expect(moved).toHaveLength(2);
    for (const [, preset] of moved) expect(preset).toBe('battery');
  });

  it('counts first-gen tags against the quotas', () => {
    // Lissa, Maribelle and Libra deployed as Staff/Rally already fill a 2–3 range: no child needs to.
    let roster = ROSTER;
    for (const u of ['lissa', 'maribelle', 'libra'] as const) roster = withDeploy(roster, u, true);
    const s = engine.suggestRoles(roster, settings, q([0, 99], [0, 99], [2, 3]));
    expect([...kidsOf(s.plan).values()].filter((c) => c.deploymentRole === 'staff')).toHaveLength(0);
  });

  it('keeps pinned and married couples together while their children change role', () => {
    const roster = withSpouse(withSpouse(ROSTER, 'chrom', 'sumia', 'married'), 'lissa', 'vaike', 'pinned');
    const s = engine.suggestRoles(roster, settings, q([0, 0], [0, 99], [0, 99]));
    const couples = s.plan.marriages.map((m) => `${m.husband}+${m.wife}`);
    expect(couples).toContain('chrom+sumia');
    expect(couples).toContain('vaike+lissa');
    expect(kidsOf(s.plan).get('lucina')?.deploymentRole).not.toBe('lead');
  });

  it('leaves out children who won’t deploy', () => {
    const s = engine.suggestRoles(withState(ROSTER, 'lucina', 'benched'), settings, q([0, 99], [0, 99], [99, 99]));
    expect(s.overrides).not.toHaveProperty('lucina');
  });

  it('writes nothing when the defaults already meet the quotas', () => {
    const s = engine.suggestRoles(ROSTER, settings, q([0, 99], [0, 99], [0, 99]));
    expect(s.overrides).toEqual({});
    expect(s.converged).toBe(true);
  });
});
