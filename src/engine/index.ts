/**
 * The engine facade: the only seam between the pure model and the UI (and the only thing tests drive).
 * No DOM in here or anything it imports.
 */
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { ASSET_FLAW, ROBIN_GROWTHS, ROBIN_MODIFIERS } from '../game-data/robin';
import { CLASSES, regularClasses, type ClassData, type ClassId } from '../game-data/classes';
import { MOD_STATS, STATS, STAT_LABELS, type Gender, type Growths, type Stat } from '../game-data/stats';
import { CHROM_FALLBACK_PARTNER, ROBIN_SUPPORTS, S_SUPPORTS } from '../game-data/supports';
import { FIRST_GEN_UNITS, type FirstGenUnitData, type UnitId } from '../game-data/units';
import { RESOLVED_DISAGREEMENTS, type ResolvedDisagreement } from '../game-data/disagreements';
import {
  ASSUMPTION_IDS,
  ASSUMPTION_REGISTRY,
  DEFAULT_ASSUMPTIONS,
  assumed,
  isAssumed,
  isDefaultValue,
  type AssumptionDef,
  type AssumptionId,
  type Assumptions,
} from './assumptions';
import { CLASS_SET_FIXTURES } from './class-set-fixtures';
import { INHERITANCE_FIXTURES } from './fixtures';
import {
  childClassSet,
  classGrowths,
  classMaxStats,
  className,
  effectiveCaps,
  reachableClasses,
  startClass,
} from './classes';
import { inheritGrowths, inheritModifiers, type ParentProfile } from './inheritance';
import { buildSkillView, candidatesFor, firstGenSkills, secondGenSkills, skillRank, skillReach, type SkillViewInput, type SkillViewSettings } from './skills';
import { BUILD_TEMPLATES } from '../curated/builds';
import { skillCard } from './skill-card';
import { matchBuilds, matchTemplate, shownMatch, templateSummary, templatesFor } from './builds';
import type { SkillId } from '../game-data/skills';
import { createScorer } from './scoring';
import { pairUpSpd } from './pair-up';
import { contextReachesDlc, defaultTargetBreakpoint } from './speed';
import { runSelfTest } from './self-test';
import { EMPTY_ROSTER, evaluateBlocking, type Blocking, type Roster, type RunFacts } from './roster';
import { PRESETS, type PresetId, type ScoringRole } from '../curated/presets';
import { PLAN_PRESETS } from '../curated/plan-presets';
import { DEFAULT_PRIORITY, childLedger, evaluatePlan, savedPairings, solvePlan, type LedgerEntry, type MarriagePlan, type PlanContext, type PlannedChild } from './plan';
import type { SavedPlan } from './roster';
import { deploymentRoleOf } from './composition';
import { suggestRoles, type RoleSuggestion } from './suggest-roles';
import type { Quotas } from '../curated/deployment';
import { RALLY_SKILLS } from '../game-data/skills';
import { STAFF_CLASSES } from '../game-data/classes';
import type {
  AssumptionStatus,
  BuildMatch,
  BuildTemplateSummary,
  ClassSummary,
  ChildResult,
  ChildSummary,
  GroupBest,
  HeatCell,
  Pairing,
  PairingFilter,
  PlayContext,
  PairingGroup,
  ScoreBasis,
  PairingScore,
  ParentRef,
  PlanSettings,
  Preset,
  RobinRef,
  Scoring,
  ScoreSettings,
  SelfTestReport,
  SkillCard,
  SkillView,
  SupportRank,
} from './types';

export type * from './types';
export {
  ASSUMPTION_REGISTRY,
  DEFAULT_ASSUMPTIONS,
  isDefaultValue,
  resolveAssumptions,
  type AssumptionDef,
  type AssumptionId,
  type Assumptions,
  type Overrides,
} from './assumptions';
export { DEFAULT_SPEED, RALLY_OPTIONS, TONIC_SPD } from './speed';
export type { Citation } from '../game-data/citations';
export type { ResolvedDisagreement } from '../game-data/disagreements';
// Stat vocabulary, re-exported so the UI only talks to the engine.
export { MOD_STATS, STATS, STAT_LABELS, type Gender, type Growths, type ModStat, type Modifiers, type Stat } from '../game-data/stats';
export type { ChildId } from '../game-data/children';
export type { ClassId } from '../game-data/classes';
export type { SkillId } from '../game-data/skills';
export { RANK_LETTERS, describeSource, type SkillViewSettings } from './skills';
export { buildSortKey } from './builds';
export {
  EMPTY_ROSTER,
  UNIT_STATES,
  deploymentOf,
  isDeployable,
  isRuledOut,
  parseRoster,
  pinLoss,
  rosterUnits,
  stateOf,
  unitName,
  withRuleOut,
  withRun,
  withSavedPlan,
  withSpouse,
  withState,
  withDeploy,
  withDeployRole,
  type Blocking,
  type DeployableUnit,
  type Bond,
  type Couple,
  type PinLoss,
  type SavedPlan,
  type Spouse,
  type Roster,
  type RosterEntry,
  type RosterUnit,
  type RunFacts,
  type UnitState,
} from './roster';
export type { PresetId, ScoringRole, Weights } from '../curated/presets';
export { DEPLOYMENT_ROLES, type DeploymentRole, type DeploymentTag, type QuotaRange, type Quotas } from '../curated/deployment';
export { composition, deploymentRoleOf, quotaContext, quotasFor, type Composition, type QuotaStatus, type RoleCount } from './composition';
export { SUGGEST_PASS_CAP, type RoleSuggestion } from './suggest-roles';
export { STAFF_CLASSES } from '../game-data/classes';
export {
  DEFAULT_PRIORITY,
  PLAN_PRIORITIES,
  adoptPlan,
  canPin,
  diffPlans,
  type LeftOut,
  type LeftOutReason,
  type LedgerEntry,
  type LedgerStatus,
  type MarriagePlan,
  type PlanDiff,
  type PlanMarriage,
  type PlannedChild,
} from './plan';

export type Engine = {
  /** Every child unit, in game-data order. */
  children(): readonly ChildSummary[];
  /** Every enumerated pairing's result, optionally for one child. */
  pairings(child?: ChildId): readonly ChildResult[];
  /**
   * A child's pairings grouped by variable parent (Robin's 56 asset/flaw pairings form one group), in table order,
   * optionally narrowed by a filter.
   */
  groups(child: ChildId, filter?: PairingFilter): readonly PairingGroup[];
  result(key: string): ChildResult | undefined;
  /** e.g. `Sumia`, `Robin (F) +Spd −Def`, `Lucina ← Sumia`. */
  parentName(ref: ParentRef): string;
  /** Robin's asset/flaw in a pairing, e.g. `+Spd −Def`, or undefined if Robin isn't a parent. */
  robinLabel(pairing: Pairing): string | undefined;
  /** Runs the sourced fixtures (inheritance and class sets) against this engine. */
  selfTest(): SelfTestReport;
  /** Every registered assumption: its current value against the default, and how many pairings rest on it. */
  assumptions(): readonly AssumptionStatus[];
  /** Source disagreements resolved in the game data, for the validation panel. */
  disagreements(): readonly ResolvedDisagreement[];
  /** Every class, in data order (the tie-break order wherever classes are compared). */
  classes(): readonly ClassSummary[];
  /** A class's name; Priest/Cleric and War Monk/War Cleric are named by gender, or both names without one. */
  className(id: ClassId, gender?: Gender): string;
  /** Every class the pairing's child can be in: its class set, their promotions and the DLC reclass target. */
  reachableClasses(result: ChildResult): readonly ClassId[];
  canReach(result: ChildResult, id: ClassId): boolean;
  /** Class max + modifier (+10 except HP with Limit Breaker), or undefined if the child can't reach the class. */
  effectiveCaps(result: ChildResult, id: ClassId, limitBreaker: boolean): Readonly<Record<Stat, number>> | undefined;
  classMaxStats(id: ClassId, gender: Gender): Readonly<Record<Stat, number>>;
  /** Class growths, with Conqueror's Skl/Spd read from the assumptions. */
  classGrowths(id: ClassId, gender: Gender): Growths;
  /** The curated presets, in menu order. */
  presets(): readonly Preset[];
  /**
   * Scores every pairing: Auto or pinned class, raw value, and the raw min-max scaled over all pairings to 0–100.
   * There is no filter input, so filtering a table never changes a score.
   */
  score(settings: ScoreSettings): Scoring;
  /** The score bases a role can use: Growths is disabled in the Support role (scoring it throws). */
  scoreBases(role: ScoringRole): readonly ScoreBasis[];
  /** The Speed breakpoints, ascending (an assumption). */
  breakpoints(): readonly number[];
  /** The play context's default target breakpoint, and the assumption it rests on, if any. */
  defaultTargetBreakpoint(context: PlayContext): { readonly value: number; readonly assumption: AssumptionId | undefined };
  /** Whether DLC classes are reachable in a play context (they are Auto candidates there). */
  contextReachesDlc(context: PlayContext): boolean;
  /** The Spd part of the Pair-up bonus from a support in this class, at this rank, with this raw Spd. */
  pairUpSpd(supportClass: ClassId, rank: SupportRank, rawSpd: number): number;
  /** A skill's curated rank in a play context: 1–5 (D–S), 0 unranked. */
  skillRank(id: SkillId, context: PlayContext): number;
  /** The Skills drawer's facts for a pairing: rally coverage, what each parent can pass, class skills by rank. */
  skillView(result: ChildResult, settings: SkillViewSettings): SkillView;
  /** The build templates for a play context (All: every one), in catalog order. */
  buildTemplates(context: PlayContext): readonly BuildTemplateSummary[];
  /**
   * The pairing's matched build templates for the play context, ranked tier → quality → first preferences → reclass
   * cost; below 3/5 left out. DLC skills are reachable when the settings say so or the context reaches DLC.
   */
  builds(result: ChildResult, settings: SkillViewSettings): readonly BuildMatch[];
  /** One template matched against the pairing, whatever its tier or context. */
  buildMatch(result: ChildResult, templateId: string, settings: SkillViewSettings): BuildMatch;
  /**
   * The Best build column: the pairing's top-ranked build, or with a template filter that template's match; undefined
   * when it is below 3/5 (the filter then hides the row).
   */
  bestBuild(result: ChildResult, settings: SkillViewSettings, templateId?: string): BuildMatch | undefined;
  /**
   * The Skill card for one skill in one pairing: description, rate, rank per context, every source or why not,
   * whether it can ever be inherited, synergy and conflict partners with reachability, and the builds that use it.
   */
  skillCard(result: ChildResult, id: SkillId, settings: SkillViewSettings): SkillCard;
  /** Whether the roster blocks a pairing (hard: it can no longer happen; soft: it contradicts a pin or a bench), and why. */
  blocking(result: ChildResult, roster: Roster): Blocking;
  /** A child's plan preset: the user's, else the curated default for the play context, else the global preset. */
  planPreset(child: ChildId, settings: Pick<PlanSettings, 'context' | 'preset' | 'overrides'>): PresetId;
  /** The plan preset a child has without a user override: the curated default for the play context, else the global preset. */
  defaultPlanPreset(child: ChildId, settings: Pick<PlanSettings, 'context' | 'preset'>): PresetId;
  /**
   * The marriage plan: max Σ priority × score, each child in its plan preset (Auto class), with marriages and pins
   * fixed, broken and on-hold pins dropped and rule-outs never planned. `free` ignores the pins.
   */
  plan(roster: Roster, settings: PlanSettings, options?: { readonly free?: boolean }): MarriagePlan;
  /**
   * A saved plan as it was adopted, valued under today's settings: only the run facts apply, not the losses and
   * marriages since, so a diff against today's plan shows what they cost.
   */
  evaluatePlan(saved: SavedPlan, run: RunFacts, settings: PlanSettings): MarriagePlan;
  /** The keys of the saved plan's pairings (the tables' ◆ in plan); empty without a saved plan. */
  planKeys(roster: Roster): ReadonlySet<string>;
  /**
   * The children ledger: each child of the run with its fixed parent, the plan's pairing (or its parents' marriage),
   * its best pairing that can still happen with Δ vs the plan, and its status.
   */
  ledger(roster: Roster, settings: PlanSettings): readonly LedgerEntry[];
  /**
   * Suggest roles: plan presets for the children still on their default (every child without an override in
   * `settings`: pass only the user's own), chosen so the army meets the quotas, and the plan they make. Never
   * Dancer; Staff/Rally only for a pairing that reaches a staff class or a rally skill.
   */
  suggestRoles(roster: Roster, settings: PlanSettings, quotas: Quotas): RoleSuggestion;
};

/**
 * Stats with a non-zero weight; under Mixed, Str and Mag are both scored at the attack weight. In the Support role
 * HP never counts: it gets no pair-up bonus.
 */
function weightedStats({ weights, mixed, role }: ScoreSettings): Stat[] {
  if (!weights) return [];
  const attack = Math.max(weights.str, weights.mag);
  return STATS.filter(
    (s) => !(role === 'support' && s === 'hp') && (mixed && (s === 'str' || s === 'mag') ? attack : weights[s]) > 0,
  );
}

const BASES: Readonly<Record<ScoringRole, readonly ScoreBasis[]>> = {
  lead: ['caps-lb', 'caps', 'growths'],
  support: ['caps-lb', 'caps'],
};

const PRESET_LIST: readonly Preset[] = (Object.keys(PRESETS) as PresetId[]).map((id) => ({ id, ...PRESETS[id] }));

/** Whether a pairing exists under the run facts: Robin, if a parent, is of the run's gender and asset/flaw. */
function inRun(pairing: Pairing, run: RunFacts | undefined): boolean {
  const ref = robinRefOf(pairing);
  if (!ref || !run) return true;
  return (run.gender ?? ref.gender) === ref.gender && (run.asset ?? ref.asset) === ref.asset && (run.flaw ?? ref.flaw) === ref.flaw;
}

/**
 * A group as the table filter leaves it, or undefined when it is filtered out. Second-gen groups are Morgan's
 * `Child ← Parent` partners; run facts narrow a Robin group down to the run's asset/flaw.
 */
function narrow(group: PairingGroup, filter: PairingFilter): PairingGroup | undefined {
  const q = filter.parent?.trim().toLowerCase();
  if (q && !group.label.toLowerCase().includes(q)) return undefined;
  if (filter.secondGen === false && group.results[0]?.pairing.variableParent.kind === 'child') return undefined;
  if (!filter.run) return group;
  const results = group.results.filter((r) => inRun(r.pairing, filter.run));
  if (results.length === 0) return undefined;
  return results.length === group.results.length ? group : { ...group, results };
}

const narrowAll = (groups: readonly PairingGroup[], filter: PairingFilter | undefined): PairingGroup[] =>
  filter ? groups.flatMap((g) => narrow(g, filter) ?? []) : [...groups];

const CHILD_IDS = Object.keys(CHILD_UNITS) as ChildId[];
const UNIT_IDS = Object.keys(FIRST_GEN_UNITS) as UnitId[];

/** Everyone a first-gen unit can S-support, excluding Robin. */
function partnersOf(id: UnitId): UnitId[] {
  const herPartners = S_SUPPORTS[id];
  if (herPartners) return [...herPartners];
  return UNIT_IDS.filter((w) => S_SUPPORTS[w]?.includes(id));
}

/** First-gen variable parents of a child, in S-support list order (Robin not included). */
function unitParentsOf(child: ChildId): UnitId[] {
  const fixed = CHILD_UNITS[child].fixedParent;
  if (fixed === 'robin') return [];
  const partners = partnersOf(fixed);
  return fixed === 'chrom' ? [...partners, CHROM_FALLBACK_PARTNER] : partners;
}

const opposite = (g: Gender): Gender => (g === 'M' ? 'F' : 'M');
const isChildId = (id: string): id is ChildId => id in CHILD_UNITS;

/** Robin's 8 × 7 asset/flaw choices, asset-major in stat order. */
function robinRefs(gender: Gender): RobinRef[] {
  return STATS.flatMap((asset) =>
    STATS.filter((flaw) => flaw !== asset).map((flaw): RobinRef => ({ kind: 'robin', gender, asset, flaw })),
  );
}

/** Key fragment for a parent. Robin's gender is left out of pairing keys (the child implies it) but not profile keys. */
function refKey(ref: ParentRef, withGender = false): string {
  switch (ref.kind) {
    case 'unit':
      return ref.id;
    case 'robin':
      return `robin${withGender ? `-${ref.gender.toLowerCase()}` : ''}:${ref.asset}/${ref.flaw}`;
    case 'child':
      return `${ref.id}<${refKey(ref.variableParent, withGender)}`;
  }
}

function pairingKey(p: Pairing): string {
  const parts: string[] = [p.child];
  if (p.fixedRobin) parts.push(refKey(p.fixedRobin));
  parts.push(refKey(p.variableParent));
  return parts.join('|');
}

/** A parent profile plus the assumptions it rests on. */
type ResolvedParent = { readonly profile: ParentProfile; readonly assumptionsUsed: readonly AssumptionId[] };

function unitProfile(id: UnitId, assumptions: Assumptions): ResolvedParent {
  const unit: FirstGenUnitData = FIRST_GEN_UNITS[id];
  const skills = firstGenSkills(id, unit.classes, unit.gender);
  const classes = { classes: unit.classes, passesClasses: unit.passesClasses, baseClass: unit.classes[0] ?? null, skills };
  if (!isAssumed(unit.growths)) {
    return { profile: { growths: unit.growths, modifiers: unit.modifiers, secondGen: false, ...classes }, assumptionsUsed: [] };
  }
  return {
    profile: { growths: assumed(unit.growths, assumptions), modifiers: unit.modifiers, secondGen: false, ...classes },
    assumptionsUsed: [unit.growths.assumption],
  };
}

/** Robin with the asset/flaw deltas folded in, so the inheritance math treats Robin like any other parent. */
function robinProfile(ref: RobinRef): ResolvedParent {
  const asset = ASSET_FLAW[ref.asset];
  const flaw = ASSET_FLAW[ref.flaw];
  const growths = {} as Record<(typeof STATS)[number], number>;
  for (const s of STATS) growths[s] = ROBIN_GROWTHS[s] + (asset.assetGrowth[s] ?? 0) + (flaw.flawGrowth[s] ?? 0);
  const modifiers = {} as Record<(typeof MOD_STATS)[number], number>;
  for (const s of MOD_STATS) modifiers[s] = ROBIN_MODIFIERS[s] + (asset.assetModifier[s] ?? 0) + (flaw.flawModifier[s] ?? 0);
  // Robin has, and passes to a child of either gender, every regular class for that gender (SF class sets).
  const profile: ParentProfile = {
    growths,
    modifiers,
    secondGen: false,
    classes: regularClasses(ref.gender),
    passesClasses: { son: regularClasses('M'), daughter: regularClasses('F') },
    baseClass: 'tactician',
    skills: firstGenSkills('robin', regularClasses(ref.gender), ref.gender),
  };
  return { profile, assumptionsUsed: [] };
}

function parentName(ref: ParentRef): string {
  switch (ref.kind) {
    case 'unit':
      return FIRST_GEN_UNITS[ref.id].name;
    case 'robin':
      return `Robin (${ref.gender}) ${assetFlawLabel(ref)}`;
    case 'child':
      return `${CHILD_UNITS[ref.id].name} ← ${parentName(ref.variableParent)}`;
  }
}

const assetFlawLabel = (ref: RobinRef) => `+${STAT_LABELS[ref.asset]} −${STAT_LABELS[ref.flaw]}`;

/** The Robin whose asset/flaw is part of a pairing: Morgan's fixed Robin, or a variable Robin parent. */
const robinRefOf = (pairing: Pairing): RobinRef | undefined =>
  pairing.fixedRobin ?? (pairing.variableParent.kind === 'robin' ? pairing.variableParent : undefined);

/** A group of pairings before their results are computed. */
type GroupPlan = { readonly key: string; readonly label: string; readonly pairings: readonly Pairing[] };

/** Every pairing of a child, grouped by variable parent, in table order. */
function planGroups(child: ChildId): GroupPlan[] {
  const data = CHILD_UNITS[child];
  if (data.fixedParent !== 'robin') {
    const units = unitParentsOf(child).map(
      (id): GroupPlan => ({ key: id, label: FIRST_GEN_UNITS[id].name, pairings: [{ child, variableParent: { kind: 'unit', id } }] }),
    );
    const robinGender = opposite(FIRST_GEN_UNITS[data.fixedParent].gender);
    const robinPartners: readonly string[] = ROBIN_SUPPORTS[robinGender];
    if (!robinPartners.includes(data.fixedParent)) return units;
    const robin: GroupPlan = {
      key: 'robin',
      label: `Robin (${robinGender})`,
      pairings: robinRefs(robinGender).map((variableParent) => ({ child, variableParent })),
    };
    return [...units, robin];
  }

  // Morgan: Robin is the fixed parent; the variable parent is anyone Robin can S-support. A child partner
  // brings its own variable parent (never Robin, who is marrying the child).
  const robinGender = opposite(data.gender);
  const partners: ParentRef[] = ROBIN_SUPPORTS[robinGender].flatMap((id): ParentRef[] =>
    isChildId(id)
      ? unitParentsOf(id).map((vp) => ({ kind: 'child', id, variableParent: { kind: 'unit', id: vp } }))
      : [{ kind: 'unit', id }],
  );
  const robins = robinRefs(robinGender);
  return partners.map((variableParent) => ({
    key: refKey(variableParent),
    label: parentName(variableParent),
    pairings: robins.map((fixedRobin) => ({ child, fixedRobin, variableParent })),
  }));
}

export function createEngine(assumptions: Assumptions = DEFAULT_ASSUMPTIONS): Engine {
  // Parent profiles, memoised by parent (Robin's gender included).
  const profiles = new Map<string, ResolvedParent>();
  const profileOf = (ref: ParentRef): ResolvedParent => {
    const k = refKey(ref, true);
    let p = profiles.get(k);
    if (!p) profiles.set(k, (p = buildProfile(ref)));
    return p;
  };

  const buildProfile = (ref: ParentRef): ResolvedParent => {
    switch (ref.kind) {
      case 'unit':
        return unitProfile(ref.id, assumptions);
      case 'robin':
        return robinProfile(ref);
      case 'child': {
        const r = computeResult({ child: ref.id, variableParent: ref.variableParent });
        const data = CHILD_UNITS[ref.id];
        const chromsChild = data.fixedParent === 'chrom' || (ref.variableParent.kind === 'unit' && ref.variableParent.id === 'chrom');
        const skills = secondGenSkills(data.gender, chromsChild, r.classSet, r.skillCandidates);
        const profile: ParentProfile = {
          skills,
          growths: r.growths,
          modifiers: r.modifiers,
          secondGen: true,
          classes: r.classSet,
          passesClasses: { son: null, daughter: null },
          baseClass: r.startClass,
        };
        return { profile, assumptionsUsed: r.assumptionsUsed };
      }
    }
  };

  const computeResult = (pairing: Pairing): ChildResult => {
    const child = CHILD_UNITS[pairing.child];
    const fixedRef: ParentRef | undefined =
      child.fixedParent === 'robin' ? pairing.fixedRobin : { kind: 'unit', id: child.fixedParent };
    if (!fixedRef) throw new Error(`Morgan pairing without Robin's asset/flaw: ${pairing.child}`);
    const fixed = profileOf(fixedRef);
    const variable = profileOf(pairing.variableParent);
    const { modifiers, capped } = inheritModifiers(fixed.profile, variable.profile, assumptions['modifier-cap']);
    const start = startClass(child, variable.profile, assumptions);
    const used: AssumptionId[] = [...fixed.assumptionsUsed, ...variable.assumptionsUsed, ...start.assumptionsUsed];
    if (capped) used.push('modifier-cap');
    return {
      pairing,
      key: pairingKey(pairing),
      growths: inheritGrowths(fixed.profile, variable.profile, child.growths),
      modifiers,
      classSet: childClassSet(child, variable.profile),
      startClass: start.startClass,
      skillCandidates: {
        fromFixed: candidatesFor(fixed.profile.skills, child.gender),
        fromVariable: candidatesFor(variable.profile.skills, child.gender),
      },
      assumptionsUsed: [...new Set(used)],
    };
  };

  const groupsByChild = new Map<ChildId, PairingGroup[]>();
  const byChild = new Map<ChildId, ChildResult[]>();
  const byKey = new Map<string, ChildResult>();
  for (const child of CHILD_IDS) {
    const groups = planGroups(child).map((g) => ({ key: g.key, label: g.label, results: g.pairings.map(computeResult) }));
    const results = groups.flatMap((g) => g.results);
    groupsByChild.set(child, groups);
    byChild.set(child, results);
    for (const r of results) byKey.set(r.key, r);
  }
  const all = [...byKey.values()];

  const result = (key: string) => byKey.get(key);

  const affected = new Map<AssumptionId, number>();
  for (const r of all) for (const id of r.assumptionsUsed) affected.set(id, (affected.get(id) ?? 0) + 1);
  const statuses: AssumptionStatus[] = ASSUMPTION_IDS.map((id) => {
    const d = ASSUMPTION_REGISTRY[id] as AssumptionDef;
    const value = assumptions[id];
    return {
      id,
      label: d.label,
      why: d.why,
      sources: d.sources,
      current: d.format(value as never),
      default: d.format(d.default as never),
      isDefault: isDefaultValue(id, value),
      pairingsAffected: affected.get(id) ?? 0,
      affects: d.affects,
    };
  });

  const genderOf = (r: ChildResult) => CHILD_UNITS[r.pairing.child].gender;
  // Reachable classes depend only on the class set and gender, so rows share them.
  const reachCache = new Map<string, ReadonlySet<ClassId>>();
  const reachOf = (r: ChildResult): ReadonlySet<ClassId> => {
    const k = `${genderOf(r)}:${r.classSet.join()}`;
    let reach = reachCache.get(k);
    if (!reach) reachCache.set(k, (reach = new Set(reachableClasses(r.classSet, genderOf(r)))));
    return reach;
  };
  const classSummaries: ClassSummary[] = (Object.keys(CLASSES) as ClassId[]).map((id) => {
    const c: ClassData = CLASSES[id];
    return { id, name: className(id), tier: c.tier, dlc: c.dlc, genderLock: c.genderLock };
  });

  const skillInput = (r: ChildResult): SkillViewInput => {
    const child = CHILD_UNITS[r.pairing.child];
    const fixedRef: ParentRef = child.fixedParent === 'robin' ? r.pairing.fixedRobin! : { kind: 'unit', id: child.fixedParent };
    return {
      childName: child.name,
      gender: child.gender,
      fixedParent: parentName(fixedRef),
      variableParent: parentName(r.pairing.variableParent),
      candidates: r.skillCandidates,
      startClass: r.startClass,
      reachable: [...reachOf(r)],
      classCount: r.classSet.length,
    };
  };
  /** DLC skills and classes are reachable by the toggle, or in a context that reaches DLC. */
  const dlcOf = (s: SkillViewSettings) => s.dlc || contextReachesDlc(s.context);
  const reachFor = (r: ChildResult, s: SkillViewSettings) => skillReach(skillInput(r), dlcOf(s));
  const template = (id: string) => {
    const t = BUILD_TEMPLATES.find((t) => t.id === id);
    if (!t) throw new Error(`No build template ${id}`);
    return t;
  };
  // The table's Best build column asks for many pairings; cache by pairing, context, DLC reach (and template).
  const buildCache = new Map<string, readonly BuildMatch[]>();
  const filteredCache = new Map<string, BuildMatch | undefined>();
  const builds = (r: ChildResult, settings: SkillViewSettings): readonly BuildMatch[] => {
    const k = `${r.key}|${settings.context}|${dlcOf(settings)}`;
    let found = buildCache.get(k);
    if (!found) buildCache.set(k, (found = matchBuilds(reachFor(r, settings), settings.context)));
    return found;
  };

  /** Built on first use: rows prepared once, rescored per settings. */
  let scorer: ReturnType<typeof createScorer> | undefined;
  const scoreAll = (settings: ScoreSettings) =>
    (scorer ??= createScorer({
      results: all,
      genderOf,
      reachOf,
      classMaxStats,
      classGrowths: (id, g) => classGrowths(id, g, assumptions),
      breakpoints: assumptions['spd-breakpoints'],
    }))(settings);

  // The plan scores each child in its own preset: keep each preset's scores until the settings change.
  const planScores = new Map<string, Map<string, PairingScore>>();
  const planScoresFor = (settings: ScoreSettings) => {
    const k = JSON.stringify(settings);
    let found = planScores.get(k);
    if (!found) {
      if (planScores.size >= 32) planScores.clear();
      planScores.set(k, (found = scoreAll(settings)));
    }
    return found;
  };
  const planPreset = (child: ChildId, { context, preset, overrides }: Pick<PlanSettings, 'context' | 'preset' | 'overrides'>): PresetId =>
    overrides[child] ?? defaultPlanPreset(child, { context, preset });
  const defaultPlanPreset = (child: ChildId, { context, preset }: Pick<PlanSettings, 'context' | 'preset'>): PresetId => {
    const entry = PLAN_PRESETS[child];
    if (!entry) return preset;
    const k = context === 'all' ? undefined : ({ apotheosis: 'apotheosis', 'main-story': 'mainStory', 'full-route': 'fullRoute' } as const)[context];
    return (k && entry[k]) ?? entry.default;
  };
  // A saved plan is valued on a roster with only the run facts; one object per run, so its values are shared.
  let lastSaved: Roster | undefined;
  const savedRoster = (run: RunFacts): Roster =>
    lastSaved && JSON.stringify(lastSaved.run) === JSON.stringify(run) ? lastSaved : (lastSaved = { ...EMPTY_ROSTER, run });
  // The Plan view asks for the plan and the free re-plan under one roster and settings: share values.
  let lastPlan: { roster: Roster; settings: string; ctx: PlanContext } | undefined;
  const planContext = (roster: Roster, s: PlanSettings): PlanContext => {
    const k = JSON.stringify(s);
    if (lastPlan?.roster !== roster || lastPlan.settings !== k) lastPlan = { roster, settings: k, ctx: newPlanContext(roster, s) };
    return lastPlan.ctx;
  };
  /** A plan preset's scores, in its own role, Auto class and the global rest (undefined: no score). */
  const presetScores = (preset: PresetId, s: PlanSettings): Map<string, PairingScore> | undefined => {
    const data = PRESETS[preset];
    const edit = s.edits[preset];
    const role = data.role ?? 'lead';
    return data.weights
      ? planScoresFor({
          weights: edit?.weights ?? data.weights,
          mixed: edit?.mixed ?? data.mixed,
          basis: BASES[role].includes(s.basis) ? s.basis : 'caps-lb',
          classMode: 'auto',
          dlc: s.dlc,
          speed: s.speed,
          role,
          supportRank: s.supportRank,
        })
      : undefined;
  };
  const newPlanContext = (roster: Roster, s: PlanSettings): PlanContext => {
    const memo = new Map<string, PlannedChild | undefined>();
    const byPreset = new Map<PresetId, Map<string, PairingScore> | undefined>();
    const scoresOf = (preset: PresetId) => {
      if (!byPreset.has(preset)) byPreset.set(preset, presetScores(preset, s));
      return byPreset.get(preset);
    };
    // Blocking reads only which units a pairing needs, never Robin's asset/flaw: share it across the 56.
    const hard = new Map<string, boolean>();
    const isHard = (pairing: Pairing, key: string) => {
      const units = key.replace(/robin:\w+\/\w+/g, 'robin');
      let found = hard.get(units);
      if (found === undefined) hard.set(units, (found = evaluateBlocking(pairing, roster, assumptions).status === 'hard'));
      return found;
    };
    const value = (pairing: Pairing, key: string): PlannedChild | undefined => {
      if (!byKey.has(key) || isHard(pairing, key)) return undefined;
      const { child } = pairing;
      const preset = planPreset(child, s);
      const sc = scoresOf(preset)?.get(key);
      const priority = s.priorities[child] ?? DEFAULT_PRIORITY;
      return {
        child,
        name: CHILD_UNITS[child].name,
        key,
        parent: parentName(pairing.variableParent),
        preset,
        deploymentRole: deploymentRoleOf(preset),
        priority,
        score: sc?.score,
        scaled: sc?.scaled,
        value: priority * (sc?.scaled ?? 0),
      };
    };
    const candidates = new Map<ChildId, readonly Pairing[]>();
    return {
      roster,
      child: (pairing) => {
        const key = pairingKey(pairing);
        if (!memo.has(key)) memo.set(key, value(pairing, key));
        return memo.get(key);
      },
      candidates: (child) => {
        let found = candidates.get(child);
        if (!found) {
          found = narrowAll(groupsByChild.get(child) ?? [], { run: roster.run }).flatMap((g) => g.results.map((r) => r.pairing));
          candidates.set(child, found);
        }
        return found;
      },
    };
  };

  return {
    children: () =>
      CHILD_IDS.map((id) => {
        const c = CHILD_UNITS[id];
        return {
          id,
          name: c.name,
          gender: c.gender,
          fixedParentName: c.fixedParent === 'robin' ? `Robin (${opposite(c.gender)})` : FIRST_GEN_UNITS[c.fixedParent].name,
          pairingCount: byChild.get(id)?.length ?? 0,
        };
      }),
    pairings: (child) => (child ? (byChild.get(child) ?? []) : all),
    groups: (child, filter) => narrowAll(groupsByChild.get(child) ?? [], filter),
    result,
    parentName,
    robinLabel: (pairing) => {
      const ref = robinRefOf(pairing);
      return ref && assetFlawLabel(ref);
    },
    selfTest: () => runSelfTest(INHERITANCE_FIXTURES, CLASS_SET_FIXTURES, result),
    assumptions: () => statuses,
    disagreements: () => RESOLVED_DISAGREEMENTS,
    classes: () => classSummaries,
    className,
    reachableClasses: (r) => [...reachOf(r)],
    canReach: (r, id) => reachOf(r).has(id),
    effectiveCaps: (r, id, limitBreaker) =>
      reachOf(r).has(id) ? effectiveCaps(id, genderOf(r), r.modifiers, limitBreaker) : undefined,
    classMaxStats,
    classGrowths: (id, gender) => classGrowths(id, gender, assumptions),
    presets: () => PRESET_LIST,
    score: (settings) => {
      const scores = scoreAll(settings);
      const groupBest = (group: PairingGroup): GroupBest => {
        let top = group.results[0]!;
        let topRaw = scores.get(top.key)?.raw ?? -Infinity;
        let range: { lo: number; hi: number } | undefined;
        for (const r of group.results) {
          const s = scores.get(r.key)!;
          if ((s.raw ?? -Infinity) > topRaw) {
            top = r;
            topRaw = s.raw!;
          }
          if (s.score !== undefined) range = { lo: Math.min(range?.lo ?? s.score, s.score), hi: Math.max(range?.hi ?? s.score, s.score) };
        }
        return { best: top, range };
      };
      const best = new Map<ChildId, PairingScore>();
      for (const r of all) {
        const s = scores.get(r.key)!;
        const cur = best.get(r.pairing.child);
        if (s.raw !== undefined && (!cur || s.raw > cur.raw!)) best.set(r.pairing.child, s);
      }
      return {
        get: (key) => {
          const s = scores.get(key);
          if (!s) throw new Error(`No pairing ${key}`);
          return s;
        },
        best: (child) => best.get(child),
        groupBest,
        heatmap: (group) => {
          if (group.results.length === 1) return undefined;
          const scaled = group.results.map((r) => scores.get(r.key)!.scaled).filter((v) => v !== undefined);
          const spread = scaled.length ? { lo: Math.min(...scaled), hi: Math.max(...scaled) } : undefined;
          const cells = group.results.map((r): HeatCell => {
            // Every group of more than one pairing is a Robin group: one pairing per asset/flaw.
            const ref = robinRefOf(r.pairing)!;
            const v = scores.get(r.key)!.scaled;
            const position = v === undefined || !spread ? undefined : spread.hi === spread.lo ? 1 : (v - spread.lo) / (spread.hi - spread.lo);
            return { asset: ref.asset, flaw: ref.flaw, label: assetFlawLabel(ref), key: r.key, scaled: v, position };
          });
          const bestKey = groupBest(group).best.key;
          return { cells, best: cells.find((c) => c.key === bestKey)!, spread };
        },
        leaderboard: ({ robin, sort, filter, roster, hideBlocked }) => {
          const shownOf = (group: PairingGroup): readonly ChildResult[] => {
            if (group.results.length === 1 || robin === 'all') return group.results;
            if (robin === 'best') return [groupBest(group).best];
            return group.results.filter((r) => {
              const ref = robinRefOf(r.pairing)!;
              return ref.asset === robin.asset && ref.flaw === robin.flaw;
            });
          };
          // Speed is the Spd pair-up bonus in the Support role, as in the table's Speed column.
          const speedOf = (s: PairingScore) => (settings.role === 'support' ? s.values?.spd : s.speed?.total);
          const rows = CHILD_IDS.flatMap((child) =>
            narrowAll(groupsByChild.get(child) ?? [], filter).flatMap((group) =>
              shownOf(group).flatMap((result) => {
                const blocking = roster && evaluateBlocking(result.pairing, roster, assumptions);
                if (hideBlocked && blocking?.status === 'hard') return [];
                return [{ child, group, result, score: scores.get(result.key)!, blocking }];
              }),
            ),
          );
          // Hard-blocked last, then unreachable; then the sort key, the score, and table order (the sort is stable).
          const desc = (a: number | undefined, b: number | undefined) => (b ?? -Infinity) - (a ?? -Infinity) || 0;
          const hard = (r: (typeof rows)[number]) => Number(r.blocking?.status === 'hard');
          rows.sort(
            (a, b) =>
              hard(a) - hard(b) ||
              Number(!a.score.class) - Number(!b.score.class) ||
              (sort === 'speed' ? desc(speedOf(a.score), speedOf(b.score)) : 0) ||
              desc(a.score.raw, b.score.raw),
          );
          return rows.map(({ child, group, result, score, blocking }, i) => {
            const ref = robinRefOf(result.pairing);
            const { name, gender } = CHILD_UNITS[child];
            return { rank: i + 1, result, score, child: name, gender, parent: group.label, robin: ref && assetFlawLabel(ref), blocking };
          });
        },
        weightedStats: weightedStats(settings),
      };
    },
    scoreBases: (role) => BASES[role],
    breakpoints: () => assumptions['spd-breakpoints'],
    defaultTargetBreakpoint: (context) => defaultTargetBreakpoint(context, assumptions),
    contextReachesDlc,
    pairUpSpd,
    skillRank,
    skillView: (r, settings) => buildSkillView(skillInput(r), settings, assumptions),
    buildTemplates: (context) => templatesFor(context).map(templateSummary),
    builds,
    buildMatch: (r, id, settings) => matchTemplate(template(id), reachFor(r, settings), settings.context),
    bestBuild: (r, settings, id) => {
      if (!id) return builds(r, settings)[0];
      const k = `${r.key}|${settings.context}|${dlcOf(settings)}|${id}`;
      if (!filteredCache.has(k)) filteredCache.set(k, shownMatch(template(id), reachFor(r, settings), settings.context));
      return filteredCache.get(k);
    },
    skillCard: (r, id, settings) => skillCard(id, reachFor(r, settings), settings.context, builds(r, settings)),
    blocking: (r, roster) => evaluateBlocking(r.pairing, roster, assumptions),
    planPreset,
    defaultPlanPreset,
    plan: (roster, settings, options) => solvePlan(planContext(roster, settings), options?.free),
    evaluatePlan: (saved, run, settings) => evaluatePlan(planContext(savedRoster(run), settings), saved),
    planKeys: (roster) =>
      new Set(roster.savedPlan ? savedPairings(roster, roster.savedPlan).map(pairingKey).filter((k) => byKey.has(k)) : []),
    ledger: (roster, settings) => {
      const ctx = planContext(roster, settings);
      return childLedger(ctx, solvePlan(ctx), (p) => evaluateBlocking(p, roster, assumptions));
    },
    suggestRoles: (roster, settings, quotas) => {
      const reach = { context: settings.context, dlc: settings.dlc };
      const dlc = dlcOf(reach);
      const scores = new Map<PresetId, Map<string, PairingScore> | undefined>();
      return suggestRoles({
        roster,
        quotas,
        userSet: new Set(Object.keys(settings.overrides) as ChildId[]),
        plan: (suggested) => solvePlan(newPlanContext(roster, { ...settings, overrides: { ...settings.overrides, ...suggested } })),
        defaultPlanPreset: (child) => defaultPlanPreset(child, settings),
        value: (c, preset) => {
          if (!scores.has(preset)) scores.set(preset, presetScores(preset, settings));
          return c.priority * (scores.get(preset)?.get(c.key)?.scaled ?? 0);
        },
        staffEligible: (c) => {
          const r = byKey.get(c.key);
          if (!r) return false;
          if ([...reachOf(r)].some((id) => (STAFF_CLASSES as readonly ClassId[]).includes(id) && (dlc || !CLASSES[id].dlc))) return true;
          const skills = reachFor(r, reach);
          return RALLY_SKILLS.some((id) => skills.sourcesOf(id).length > 0);
        },
      });
    },
  };
}
