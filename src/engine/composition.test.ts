import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPEED,
  EMPTY_ROSTER,
  adoptPlan,
  composition,
  deploymentOf,
  diffPlans,
  parseRoster,
  quotasFor,
  deploymentRoleOf,
  withDeploy,
  withDeployRole,
  withState,
  type DeploymentRole,
  type PlanSettings,
  type Quotas,
  type Roster,
} from './index';
import { createEngine } from './index';

const engine = createEngine();

/** Room in every role: army fit moves nobody, so these tests see composition alone. */
const ROOMY: Quotas = {
  cap: 99,
  roles: { lead: { min: 0, max: 99 }, battery: { min: 0, max: 99 }, staff: { min: 0, max: 99 }, dancer: { min: 0, max: 99 } },
};

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
  quotas: ROOMY,
};

const RUN = { ...EMPTY_ROSTER.run, gender: 'M', asset: 'spd', flaw: 'hp' } as const;
const ROSTER: Roster = { ...EMPTY_ROSTER, run: RUN };

const counts = (roster: Roster, s: PlanSettings = settings) => {
  const c = composition(roster, engine.plan(roster, s), quotasFor(s.context));
  return Object.fromEntries(c.roles.map((r) => [r.role, r.count])) as Record<DeploymentRole, number>;
};

describe('deployment roles', () => {
  it('come from a preset’s scoring role, and Rallybot is Staff/Rally', () => {
    expect(deploymentRoleOf('physical-lead')).toBe('lead');
    expect(deploymentRoleOf('physical-hard-support')).toBe('lead');
    expect(deploymentRoleOf('staffbot')).toBe('staff');
    expect(deploymentRoleOf('battery')).toBe('battery');
    expect(deploymentRoleOf('rallybot')).toBe('staff');
  });

  it('tag each planned child with its plan preset’s role, never Dancer', () => {
    const plan = engine.plan(ROSTER, { ...settings, overrides: { lucina: 'rallybot', owain: 'battery' } });
    const kids = new Map(plan.marriages.flatMap((m) => m.children.map((c) => [c.child, c] as const)));
    expect(kids.get('lucina')?.deploymentRole).toBe('staff');
    expect(kids.get('owain')?.deploymentRole).toBe('battery');
    // Nah derives Lead: Battery's spread is zero, so no child's best role is Battery (#95).
    expect(kids.get('nah')?.deploymentRole).toBe('lead');
    expect(kids.get('brady')?.deploymentRole).toBe('lead');
    for (const c of kids.values()) expect(c.deploymentRole).not.toBe('dancer');
  });

  it('default first-gen tags from the curated table, and the roster overrides them', () => {
    expect(deploymentOf(ROSTER, 'olivia')).toEqual({ deploy: true, role: 'dancer' });
    expect(deploymentOf(ROSTER, 'lissa')).toEqual({ deploy: false, role: 'staff' });
    const r = withDeployRole(withDeploy(ROSTER, 'lissa', true), 'lissa', 'battery');
    expect(deploymentOf(r, 'lissa')).toEqual({ deploy: true, role: 'battery' });
    expect(parseRoster(JSON.parse(JSON.stringify(r)))).toEqual(r);
    expect(parseRoster({ run: RUN, deploy: { lissa: 'yes', nobody: true, lucina: true }, deployRoles: { lissa: 'boss', olivia: 'lead' } })).toMatchObject({
      deploy: {},
      deployRoles: { olivia: 'lead' },
    });
  });
});

describe('composition counts', () => {
  it('count deployed first-gen tags and every child the plan produces', () => {
    const plan = engine.plan(ROSTER, settings);
    const kids = plan.marriages.flatMap((m) => m.children);
    const c = counts(ROSTER);
    // Robin and Chrom lead, Olivia dances.
    expect(c.lead).toBe(2 + kids.filter((k) => k.deploymentRole === 'lead').length);
    expect(c.battery).toBe(kids.filter((k) => k.deploymentRole === 'battery').length);
    expect(c.staff).toBe(0);
    expect(c.dancer).toBe(1);
    const all = composition(ROSTER, plan, quotasFor('all'));
    expect(all.deployed.count).toBe(3 + kids.length);
  });

  it('follow Deploy flags and role tags', () => {
    const base = counts(ROSTER);
    const r = withDeployRole(withDeploy(ROSTER, 'lissa', true), 'chrom', 'battery');
    expect(counts(r)).toEqual({ ...base, lead: base.lead - 1, battery: base.battery + 1, staff: 1 });
    expect(counts(withDeploy(ROSTER, 'olivia', false)).dancer).toBe(0);
  });

  it('leave out benched, missed and dead units', () => {
    const base = counts(ROSTER);
    // Benched Lucina is still planned but isn't deployed; a benched Chrom isn't either.
    expect(counts(withState(ROSTER, 'lucina', 'benched')).lead).toBe(base.lead - 1);
    expect(counts(withState(ROSTER, 'olivia', 'dead')).dancer).toBe(0);
    expect(counts(withState(withDeploy(ROSTER, 'lissa', true), 'lissa', 'missed')).staff).toBe(0);
    // Not yet recruited prunes nothing.
    expect(counts(withState(ROSTER, 'olivia', 'not-recruited')).dancer).toBe(1);
  });

  it('say how many of the deployed are planned children, which benching leaves out', () => {
    const plan = engine.plan(ROSTER, settings);
    const kids = plan.marriages.flatMap((m) => m.children).length;
    expect(composition(ROSTER, plan, quotasFor('all')).deployed.children).toBe(kids);
    // Benched Lucina stays planned (soft) but isn't counted.
    const benched = withState(ROSTER, 'lucina', 'benched');
    const benchedPlan = engine.plan(benched, settings);
    expect(benchedPlan.marriages.some((m) => m.children.some((c) => c.child === 'lucina'))).toBe(true);
    expect(composition(benched, benchedPlan, quotasFor('all')).deployed).toMatchObject({ count: 3 + kids - 1, children: kids - 1 });
  });

  it('count a child in the role of its plan preset', () => {
    const base = counts(ROSTER);
    const c = counts(ROSTER, { ...settings, overrides: { lucina: 'rallybot' } });
    expect(c).toEqual({ ...base, lead: base.lead - 1, staff: 1 });
  });
});

describe('composition strip', () => {
  const q = (cap: number, lead: [number, number]): Quotas => ({
    cap,
    roles: { lead: { min: lead[0], max: lead[1] }, battery: { min: 0, max: 99 }, staff: { min: 0, max: 99 }, dancer: { min: 0, max: 99 } },
  });
  const plan = engine.plan(ROSTER, settings);
  const lead = counts(ROSTER).lead;
  const status = (quotas: Quotas) => {
    const c = composition(ROSTER, plan, quotas);
    return [c.roles.find((r) => r.role === 'lead')!.status, c.deployed.status];
  };

  it('is green in range, amber below min, red over max or over the cap', () => {
    expect(status(q(99, [lead, lead]))).toEqual(['ok', 'ok']);
    expect(status(q(99, [lead + 1, lead + 5]))).toEqual(['under', 'ok']);
    expect(status(q(99, [0, lead - 1]))).toEqual(['over', 'ok']);
    expect(status(q(3, [0, 99]))).toEqual(['ok', 'over']);
  });

  it('shows each role’s count against its quota, and the deployed count against the cap', () => {
    const c = composition(ROSTER, plan, quotasFor('apotheosis'));
    expect(c.roles.map((r) => r.role)).toEqual(['lead', 'battery', 'staff', 'dancer']);
    expect(c.roles[0]).toMatchObject({ count: lead, min: 4, max: 6 });
    expect(c.deployed.cap).toBe(20);
  });
});

describe('composition quotas', () => {
  it('are curated per play context, and All uses Main story’s', () => {
    expect(quotasFor('apotheosis')).toMatchObject({ cap: 20, roles: { lead: { min: 4, max: 6 }, staff: { min: 3, max: 4 }, dancer: { min: 1, max: 1 } } });
    expect(quotasFor('main-story')).toMatchObject({ cap: 14, roles: { battery: { min: 3, max: 5 }, staff: { min: 2, max: 3 } } });
    expect(quotasFor('full-route')).toEqual(quotasFor('main-story'));
    expect(quotasFor('all')).toEqual(quotasFor('main-story'));
  });

  it('take the user’s edits for that context only, and All follows Main story’s edits', () => {
    const mine: Quotas = { ...quotasFor('apotheosis'), cap: 18 };
    expect(quotasFor('apotheosis', { apotheosis: mine }).cap).toBe(18);
    expect(quotasFor('main-story', { apotheosis: mine }).cap).toBe(14);
    const main: Quotas = { ...quotasFor('main-story'), cap: 12 };
    expect(quotasFor('all', { 'main-story': main }).cap).toBe(12);
    expect(quotasFor('full-route', { 'main-story': main }).cap).toBe(14);
  });
});

describe('the plan diff', () => {
  it('reports role moves, and a role-only change counts as a change', () => {
    const adopted = adoptPlan(ROSTER, engine.plan(ROSTER, settings));
    const saved = adopted.savedPlan!;
    expect(saved.deploymentRoles?.lucina).toBe('lead');
    expect(parseRoster(JSON.parse(JSON.stringify(adopted))).savedPlan).toEqual(saved);
    const moved = { ...settings, overrides: { lucina: 'battery' } } as const;
    const before = engine.evaluatePlan(saved, RUN, moved);
    const after = engine.plan(adopted, moved);
    const diff = diffPlans(before, after);
    expect(diff.roleMoves).toEqual([{ child: 'lucina', name: 'Lucina', from: 'lead', to: 'battery' }]);
    expect(diff.moves).toEqual([]);
    expect(diff.same).toBe(false);
    expect(diffPlans(engine.evaluatePlan(saved, RUN, settings), engine.plan(adopted, settings)).same).toBe(true);
  });

  it('drops a Dancer or unknown role for a child from a saved plan', () => {
    const parsed = parseRoster({ run: RUN, savedPlan: { robin: null, marriages: [['chrom', 'sumia']], deploymentRoles: { lucina: 'dancer', cynthia: 'staff', nobody: 'lead' } } });
    expect(parsed.savedPlan?.deploymentRoles).toEqual({ cynthia: 'staff' });
  });
});
