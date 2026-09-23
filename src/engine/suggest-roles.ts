/**
 * Suggest roles (#37): a one-shot heuristic that rewrites the plan preset of every child still on its default so the
 * army meets the composition quotas, then re-plans. Each child gets at most one preset per role; a candidate is worth
 * priority × score in the pairing the plan gives the child. Each role's minimum is filled first, from the children it
 * costs least; the rest keep their default role while it has room and otherwise move to the best role that does.
 * Assign → re-plan → reassign repeats until the picks are stable, up to the pass cap. Pure.
 */
import type { ChildId } from '../game-data/children';
import type { ChildDeploymentRole, Quotas } from '../curated/deployment';
import { CHILD_DEPLOYMENT_ROLE_PRESETS, DEPLOYMENT_ROLE_PRESETS } from '../curated/plan-presets';
import type { PresetId } from '../curated/presets';
import { composition, deploymentRoleOf, inPlay } from './composition';
import type { MarriagePlan, PlannedChild } from './plan';
import type { Roster } from './roster';

export type RoleSuggestion = {
  /** The suggested plan presets: children on their default whose pick differs from it. */
  readonly overrides: Readonly<Partial<Record<ChildId, PresetId>>>;
  /** The plan with the suggestions in force. */
  readonly plan: MarriagePlan;
  /** Assignment passes run. */
  readonly passes: number;
  /** The last pass changed nothing; false when the pass cap stopped it. */
  readonly converged: boolean;
};

export type SuggestContext = {
  readonly roster: Roster;
  readonly quotas: Quotas;
  /** Children whose plan preset the user set: never rewritten, but counted. */
  readonly userSet: ReadonlySet<ChildId>;
  /** The marriage plan with these suggestions on top of the user's presets. */
  readonly plan: (suggested: Readonly<Partial<Record<ChildId, PresetId>>>) => MarriagePlan;
  /** A child's plan preset without a user override. */
  readonly defaultPlanPreset: (child: ChildId) => PresetId;
  /** priority × scaled score of the child's pairing under a preset; 0 without a score. */
  readonly value: (child: PlannedChild, preset: PresetId) => number;
  /** The child's pairing reaches a staff class or a rally skill. */
  readonly staffEligible: (child: PlannedChild) => boolean;
};

export const SUGGEST_PASS_CAP = 3;

const CHILD_DEPLOYMENT_ROLES: readonly ChildDeploymentRole[] = ['lead', 'battery', 'staff'];

/** A child's one preset for a role: its plan preset if it's in that role, else the curated per-child entry, else the global table. */
function rolePreset(child: ChildId, role: ChildDeploymentRole, defaultPlanPreset: PresetId): PresetId {
  if (deploymentRoleOf(defaultPlanPreset) === role) return defaultPlanPreset;
  return CHILD_DEPLOYMENT_ROLE_PRESETS[child]?.[role] ?? DEPLOYMENT_ROLE_PRESETS[role];
}

type Candidate = {
  readonly child: ChildId;
  /** Its plan preset's role when on the default. */
  readonly home: ChildDeploymentRole;
  /** The roles it can take, with their value. Staff/Rally only when eligible. */
  readonly options: ReadonlyMap<ChildDeploymentRole, number>;
  /** What it's worth where it stands by default (its best option if its home isn't one). */
  readonly baseline: number;
};

/** One assignment pass over the plan: each assignable child's role. */
function assign(ctx: SuggestContext, plan: MarriagePlan): Map<ChildId, ChildDeploymentRole> {
  const { roster, quotas } = ctx;
  const counts = new Map(composition(roster, plan, quotas).roles.map((r) => [r.role, r.count]));
  const candidates: Candidate[] = [];
  for (const m of plan.marriages) {
    for (const c of m.children) {
      if (ctx.userSet.has(c.child) || !inPlay(roster, c.child)) continue;
      // Take it out of the counts: it is placed below.
      counts.set(c.deploymentRole, counts.get(c.deploymentRole)! - 1);
      const planDefault = ctx.defaultPlanPreset(c.child);
      const options = new Map<ChildDeploymentRole, number>();
      for (const role of CHILD_DEPLOYMENT_ROLES) {
        if (role === 'staff' && !ctx.staffEligible(c)) continue;
        options.set(role, ctx.value(c, rolePreset(c.child, role, planDefault)));
      }
      const home = deploymentRoleOf(planDefault) as ChildDeploymentRole;
      candidates.push({ child: c.child, home, options, baseline: options.get(home) ?? Math.max(...options.values()) });
    }
  }
  const picks = new Map<ChildId, ChildDeploymentRole>();
  const place = (c: Candidate, role: ChildDeploymentRole) => {
    picks.set(c.child, role);
    counts.set(role, counts.get(role)! + 1);
  };
  const open = (): Candidate[] => candidates.filter((c) => !picks.has(c.child));

  /** Fills the roles' minimums from the children they cost least (ties: the one worth more there, then roster order). */
  const fillMinimums = (roles: readonly ChildDeploymentRole[]) => {
    for (;;) {
      let best: { c: Candidate; role: ChildDeploymentRole; loss: number; value: number } | undefined;
      for (const role of roles) {
        if (counts.get(role)! >= quotas.roles[role].min) continue;
        for (const c of open()) {
          const value = c.options.get(role);
          if (value === undefined) continue;
          const loss = c.baseline - value;
          if (!best || loss < best.loss || (loss === best.loss && value > best.value)) best = { c, role, loss, value };
        }
      }
      if (!best) return;
      place(best.c, best.role);
    }
  };
  // Staff/Rally first: only eligible children can take it, while any child can lead or back a lead.
  fillMinimums(['staff']);
  fillMinimums(['lead', 'battery']);

  // The rest, most valuable first: its home role while it has room, else the best role that does, else home (warns).
  const rest = open().sort((a, b) => b.baseline - a.baseline);
  for (const c of rest) {
    const room = (role: ChildDeploymentRole) => c.options.has(role) && counts.get(role)! < quotas.roles[role].max;
    if (room(c.home)) {
      place(c, c.home);
      continue;
    }
    const fits = CHILD_DEPLOYMENT_ROLES.filter(room);
    const byValue = (roles: readonly ChildDeploymentRole[]) => roles.reduce((a, b) => (c.options.get(b)! > c.options.get(a)! ? b : a));
    place(c, fits.length ? byValue(fits) : c.options.has(c.home) ? c.home : byValue([...c.options.keys()]));
  }
  return picks;
}

export function suggestRoles(ctx: SuggestContext): RoleSuggestion {
  let suggested: Partial<Record<ChildId, PresetId>> = {};
  let plan = ctx.plan(suggested);
  const same = (a: Partial<Record<ChildId, PresetId>>, b: Partial<Record<ChildId, PresetId>>) =>
    Object.keys(a).length === Object.keys(b).length && (Object.keys(a) as ChildId[]).every((k) => a[k] === b[k]);
  for (let pass = 1; pass <= SUGGEST_PASS_CAP; pass++) {
    const next: Partial<Record<ChildId, PresetId>> = {};
    for (const [child, role] of assign(ctx, plan)) {
      const planDefault = ctx.defaultPlanPreset(child);
      const preset = rolePreset(child, role, planDefault);
      if (preset !== planDefault) next[child] = preset;
    }
    if (same(next, suggested)) return { overrides: suggested, plan, passes: pass, converged: true };
    suggested = next;
    plan = ctx.plan(suggested);
  }
  return { overrides: suggested, plan, passes: SUGGEST_PASS_CAP, converged: false };
}
