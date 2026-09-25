/**
 * Army fit (#96; replaces Suggest roles): the last step of the derivation. Every child starts in its best role; a
 * composition quota moves a child only when it forces one, cheapest loss of standing first. Pure.
 *
 * Every child in the cast and in play counts, and starts in its best role. Minimums fill by moving the cheapest child
 * from a role that can spare it — Staff/Rally first, and only children whose planned pairing reaches a staff class or
 * rally skill — then Lead and Battery. An overflowing role sheds its cheapest children into roles with room; leftovers
 * stay (the composition warns). The cost of a move is the child's standing in its home role minus its standing in the
 * target role; ties go to the lower home standing, then roster order. Overridden children and first-gen units count
 * toward the quotas but never move. Army fit never benches a child.
 */
import type { ChildId } from '../game-data/children';
import type { ChildDeploymentRole, Quotas } from '../curated/deployment';
import type { PresetId } from '../curated/presets';
import { composition, inPlay } from './composition';
import { CHILD_DEPLOYMENT_ROLES, type DerivedRole } from './derive';
import type { MarriagePlan } from './plan';
import type { Roster } from './roster';

/** Where a child's plan preset comes from. */
export type RoleSource = 'derived' | 'army fit' | 'role override' | 'preset override';

export type RoleAssignment = {
  readonly role: ChildDeploymentRole;
  /** The plan preset. */
  readonly preset: PresetId;
  readonly source: RoleSource;
  /** Why army fit moved the child: the quota that forced it. */
  readonly reason?: string;
};

export type ArmyFitInput = {
  readonly roster: Roster;
  readonly quotas: Quotas;
  /** The no-Robin view (#98): Robin isn't counted as deployed. */
  readonly noRobin?: boolean;
  /** The plan produced with the current assignment: it supplies the first-gen units' counts. */
  readonly plan: MarriagePlan;
  readonly derived: ReadonlyMap<ChildId, DerivedRole>;
  /** Each child's assignment before army fit: its best role, or its override. */
  readonly base: ReadonlyMap<ChildId, RoleAssignment>;
  /** Children in the cast and in play (not benched, missed or dead): the ones the army counts. */
  readonly cast: readonly ChildId[];
  /** The child's planned pairing (its best Lead pairing when unplanned) reaches a staff class or a rally skill. */
  readonly qualifies: (child: ChildId) => boolean;
  /** Roster order, the last tie-break. */
  readonly order: readonly ChildId[];
};

export const ARMY_FIT_PASS_CAP = 3;

const ROLE_NAME: Record<ChildDeploymentRole, string> = { lead: 'Lead', battery: 'Battery', staff: 'Staff/Rally' };

type Candidate = { readonly child: ChildId; readonly home: ChildDeploymentRole; readonly d: DerivedRole; readonly staff: boolean };

export function armyFit(input: ArmyFitInput): Map<ChildId, RoleAssignment> {
  const { roster, quotas, plan, derived, base } = input;
  const out = new Map(base);
  // First-gen units as the plan counts them; every child in the cast counts, planned this pass or not, so the
  // assignment doesn't swing with which marriages one pass happens to pick.
  const counts = new Map(composition(roster, plan, quotas, input.noRobin).roles.map((r) => [r.role, r.count]));
  // Planned children outside the cast (Morgan before Robin is set) keep counting where the plan put them.
  const inCast = new Set(input.cast);
  for (const m of plan.marriages)
    for (const c of m.children)
      if (inPlay(roster, c.child) && inCast.has(c.child)) counts.set(c.deploymentRole, counts.get(c.deploymentRole)! - 1);
  const free: Candidate[] = [];
  for (const child of input.cast) {
    const b = base.get(child);
    const d = derived.get(child);
    if (!b) continue;
    if (b.source !== 'derived' || !d) counts.set(b.role, counts.get(b.role)! + 1);
    else free.push({ child, home: b.role, d, staff: input.qualifies(child) });
  }
  const rank = (c: ChildId) => input.order.indexOf(c);
  const at = new Map<ChildId, ChildDeploymentRole>();
  const reasons = new Map<ChildId, string>();
  // Everyone starts in its best role.
  for (const c of free) {
    at.set(c.child, c.home);
    counts.set(c.home, counts.get(c.home)! + 1);
  }
  const can = (c: Candidate, role: ChildDeploymentRole) => role !== 'staff' || c.staff;
  const cost = (c: Candidate, role: ChildDeploymentRole) => c.d.roleStanding[c.home] - c.d.roleStanding[role];
  const cheaper = (a: Candidate, b: Candidate, role: ChildDeploymentRole) =>
    cost(a, role) - cost(b, role) || a.d.roleStanding[a.home] - b.d.roleStanding[b.home] || rank(a.child) - rank(b.child);
  const move = (c: Candidate, role: ChildDeploymentRole, reason: string) => {
    const from = at.get(c.child)!;
    counts.set(from, counts.get(from)! - 1);
    counts.set(role, counts.get(role)! + 1);
    at.set(c.child, role);
    reasons.set(c.child, reason);
  };
  /** A child still in its home role, whose role can spare it. */
  const movable = (c: Candidate) => at.get(c.child) === c.home && counts.get(c.home)! > quotas.roles[c.home].min;

  // Minimums: move the cheapest child from a role that can spare it, Staff/Rally first.
  for (const roles of [['staff'], ['lead', 'battery']] as const)
    for (;;) {
      let best: { c: Candidate; role: ChildDeploymentRole } | undefined;
      for (const role of roles) {
        if (counts.get(role)! >= quotas.roles[role].min) continue;
        for (const c of free) {
          if (c.home === role || !movable(c) || !can(c, role)) continue;
          if (!best || cheaper(c, best.c, role) < 0) best = { c, role };
        }
      }
      if (!best) break;
      move(best.c, best.role, `${ROLE_NAME[best.role]} below its minimum of ${quotas.roles[best.role].min}`);
    }

  // Maximums: move the cheapest child out of an overflowing role into one with room; leftovers stay (and warn).
  for (const role of CHILD_DEPLOYMENT_ROLES)
    for (;;) {
      if (counts.get(role)! <= quotas.roles[role].max) break;
      let best: { c: Candidate; to: ChildDeploymentRole } | undefined;
      for (const c of free) {
        if (at.get(c.child) !== role || c.home !== role) continue;
        const room = CHILD_DEPLOYMENT_ROLES.filter((to) => to !== role && can(c, to) && counts.get(to)! < quotas.roles[to].max);
        if (!room.length) continue;
        const to = room.reduce((a, b) => (cost(c, b) < cost(c, a) ? b : a));
        const better = !best || cost(c, to) - cost(best.c, best.to) || c.d.roleStanding[c.home] - best.c.d.roleStanding[best.c.home] || rank(c.child) - rank(best.c.child);
        if (!best || (better as number) < 0) best = { c, to };
      }
      if (!best) break;
      move(best.c, best.to, `${ROLE_NAME[role]} over its maximum of ${quotas.roles[role].max}`);
    }

  for (const c of free) {
    const role = at.get(c.child)!;
    const moved = role !== c.home;
    out.set(c.child, { role, preset: c.d.rolePreset[role], source: moved ? 'army fit' : 'derived', ...(moved ? { reason: reasons.get(c.child)! } : {}) });
  }
  return out;
}
