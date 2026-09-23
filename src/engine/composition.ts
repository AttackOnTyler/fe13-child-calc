/**
 * Deployment composition (#19): how many deployed units fill each deployment role, against the play context's quotas
 * and deploy cap. Deployed first-gen units count in their tagged role; every child the plan produces counts in its
 * plan preset's role. Benched, missed and dead units don't deploy. Out of range only warns. Pure.
 */
import { COMPOSITION_QUOTAS, DEPLOYMENT_ROLES, type DeploymentRole, type QuotaRange, type Quotas } from '../curated/deployment';
import { PRESETS, type PresetId } from '../curated/presets';
import { deploymentOf, rosterUnits, stateOf, isDeployable, type Roster, type RosterUnit } from './roster';
import type { MarriagePlan } from './plan';
import type { PlayContext } from './types';

/** Green in range, amber below min, red over max. */
export type QuotaStatus = 'ok' | 'under' | 'over';

export type RoleCount = QuotaRange & { readonly role: DeploymentRole; readonly count: number; readonly status: QuotaStatus };

export type Composition = {
  /** Lead, Battery, Staff/Rally, Dancer. */
  readonly roles: readonly RoleCount[];
  /** Red over the cap. */
  readonly deployed: { readonly count: number; readonly cap: number; readonly status: 'ok' | 'over' };
};

/**
 * A child's deployment role from its plan preset's scoring role: Lead → Lead, Support → Battery, none (Rallybot /
 * Dancer) → Staff/Rally. Staffbot scores as a Lead, so it deploys as one.
 */
export function deploymentRoleOf(preset: PresetId): DeploymentRole {
  const scoring = PRESETS[preset].role;
  return scoring === 'lead' ? 'lead' : scoring === 'support' ? 'battery' : 'staff';
}

/** The play context whose quotas apply: All uses Main story's. */
export const quotaContext = (context: PlayContext): Exclude<PlayContext, 'all'> => (context === 'all' ? 'main-story' : context);

/** The play context's quotas: the user's edits for it, else the curated seed. */
export function quotasFor(context: PlayContext, edits: Readonly<Partial<Record<PlayContext, Quotas>>> = {}): Quotas {
  const c = quotaContext(context);
  return edits[c] ?? COMPOSITION_QUOTAS[c];
}

/** Units that can't take the field. Not yet recruited prunes nothing: the plan counts on them joining. */
const OUT_OF_PLAY = ['benched', 'missed', 'dead'];

const statusOf = (count: number, { min, max }: QuotaRange): QuotaStatus => (count < min ? 'under' : count > max ? 'over' : 'ok');

export function composition(roster: Roster, plan: MarriagePlan, quotas: Quotas): Composition {
  const inPlay = (u: RosterUnit) => !OUT_OF_PLAY.includes(stateOf(roster, u));
  const counts = new Map<DeploymentRole, number>(DEPLOYMENT_ROLES.map((r) => [r, 0]));
  const add = (role: DeploymentRole) => counts.set(role, counts.get(role)! + 1);
  // Robin is deployed whether or not the run has set Robin's gender yet.
  const firstGen = rosterUnits({ ...roster.run, gender: roster.run.gender ?? plan.robin.gender }).map((u) => u.id).filter(isDeployable);
  for (const u of firstGen) {
    const tag = deploymentOf(roster, u);
    if (tag.deploy && inPlay(u)) add(tag.role);
  }
  for (const m of plan.marriages) for (const c of m.children) if (inPlay(c.child)) add(c.deploymentRole);
  const roles = DEPLOYMENT_ROLES.map((role): RoleCount => {
    const count = counts.get(role)!;
    return { role, count, ...quotas.roles[role], status: statusOf(count, quotas.roles[role]) };
  });
  const total = roles.reduce((sum, r) => sum + r.count, 0);
  return { roles, deployed: { count: total, cap: quotas.cap, status: total > quotas.cap ? 'over' : 'ok' } };
}
