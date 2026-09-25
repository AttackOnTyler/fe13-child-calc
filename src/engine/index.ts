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
import { buildSkillView, candidatesFor, firstGenSkills, ref, secondGenSkills, skillRank, skillReach, type SkillViewInput, type SkillViewSettings } from './skills';
import { BUILD_TEMPLATES } from '../curated/builds';
import { UNIT_OPINIONS, type OpinionUnit } from '../curated/unit-opinion';
import { CHAPTER_GUIDE, type GuideEntry } from '../curated/chapter-guide';
import { SOURCES } from '../curated/sources';
import type { BuildTemplate } from '../curated/builds';
import { skillCard } from './skill-card';
import { unitPage, unitReach, type FrontDoor, type FrontDoorTile, type OpinionBlock, type OpinionMark, type PageSubject, type PageUnitId, type ParentedChild, type PartnerChild, type PartnerRow, type UnitPage } from './unit-page';
import { SPOTPASS_UNITS } from '../game-data/join';
import { CHAPTER_DISAGREEMENTS, MAPS, lunaticPlusPoolFor, type ChapterData, type ChapterDisagreement } from '../game-data/chapters';
import { matchBuilds, matchTemplate, shownMatch, templateSummary, templatesFor } from './builds';
import type { SkillId } from '../game-data/skills';
import { createScorer } from './scoring';
import { pairUpSpd } from './pair-up';
import { contextReachesDlc, defaultTargetBreakpoint } from './speed';
import { runSelfTest } from './self-test';
import { EMPTY_ROSTER, evaluateBlocking, rosterUnits, stateOf, unitName, type Blocking, type Roster, type RosterUnit, type RunFacts } from './roster';
import { CANDIDATE_PRESETS, PRESETS, type PresetId, type ScoringRole } from '../curated/presets';
import { DEFAULT_PRIORITY, childLedger, evaluatePlan, savedPairings, solvePlan, type LedgerEntry, type MarriagePlan, type PlanContext, type PlannedChild } from './plan';
import type { SavedPlan } from './roster';
import { deploymentRoleOf, inPlay } from './composition';
import { ARMY_FIT_PASS_CAP, armyFit, type RoleAssignment } from './army-fit';
import { deriveRoles, type Derivation, type RobinGain, type RobinGainSide } from './derive';
import type { ChildDeploymentRole } from '../curated/deployment';
import { FIXED_INHERITANCE, RALLY_SKILLS } from '../game-data/skills';
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
export { CHAPTER_GUIDE, type GuideEntry } from '../curated/chapter-guide';
export { classIdByName, classWeaponKinds, openStock, promotionAdvice, sealAvailability, sealsHeld, supplyList, type PromotionAdvice, type SealAvailability, type StockItem, type Supply } from './supply';
export { coverage, deployCount, deployMax, deployRoleOf, forcedOn, suggestDeployment, suggestLoadout, type DeployCandidate, type Deployment, type Loadout, type Pair } from './deploy';
export { bestWeapon, classTypes, dangerFlags, foeKey, foeOf, foesOf, matchup, pairUpBonus, statValue, type DangerFlag, type Fighter, type Foe, type Matchup } from './solver';
export {
  EMPTY_RUN,
  EMPTY_SNAPSHOT,
  SUPPORT_LEVELS,
  addEntry,
  editEntry,
  exportRun,
  flaggedEntries,
  heldProblems,
  importRun,
  latestEntry,
  nextMaps,
  parseRun,
  prepUnits,
  recordFallen,
  recordMarriage,
  recruitSnapshot,
  removeEntry,
  rosterOf,
  runFromRoster,
  withRoster,
  withSeenSkills,
  withUnit,
  type HeldItem,
  type LaterRecruit,
  type MapOffer,
  type PrepUnits,
  type Run,
  type RunEntry,
  type Snapshot,
  type SupportLevel,
  type UnitSnapshot,
} from './run';
export {
  FORGE,
  ITEMS,
  ITEM_DISAGREEMENTS,
  forgeCost,
  forgeProblem,
  forgedStats,
  itemByName,
  type Effectiveness,
  type ForgeLevels,
  type GameItem,
  type ItemDisagreement,
  type ItemKind,
} from '../game-data/items';
export {
  CHAPTER_DIFFICULTIES,
  LUNATIC_PLUS,
  REINFORCEMENT_RULE,
  SEAL_RULES,
  type BossRow,
  type ChapterData,
  type ChapterDifficulty,
  type ChapterDisagreement,
  type EnemyGroup,
  type MapConditions,
} from '../game-data/chapters';
export { SOURCES, SOURCE_IDS, type SourceEntry, type SourceId, type SourceKind, type SourceRef } from '../curated/sources';
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
  DIFFICULTIES,
  MODES,
  ROUTES,
  type Difficulty,
  type Mode,
  type Route,
} from './roster';
export type { PresetId, ScoringRole, Weights } from '../curated/presets';
export { DEPLOYMENT_ROLES, type ChildDeploymentRole, type DeploymentRole, type DeploymentTag, type QuotaRange, type Quotas } from '../curated/deployment';
export { composition, deploymentRoleOf, quotaContext, quotasFor, type Composition, type QuotaStatus, type RoleCount } from './composition';
export { ARMY_FIT_PASS_CAP, type RoleAssignment, type RoleSource } from './army-fit';
export { CHILD_DEPLOYMENT_ROLES, type Derivation, type DerivedRole, type OutOfCast, type RobinGain, type RobinGainSide } from './derive';
export type { ClassLine, ClassTree, FrontDoor, FrontDoorTile, OpinionBlock, OpinionMark, PageSubject, PageUnitId, ParentedChild, PartnerChild, PartnerRow, PassedClasses, TreeClass, TreeSkill, UnitAsParent, UnitPage } from './unit-page';
export { CANDIDATE_PRESETS } from '../curated/presets';
export { STAFF_CLASSES } from '../game-data/classes';
export {
  DEFAULT_PRIORITY,
  PLAN_PRIORITIES,
  adoptPlan,
  canPin,
  diffPlans,
  lockRobin,
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
  /** Every map with chapter data, in Maps-list order (#109). */
  maps(): readonly ChapterData[];
  /** A map's Lunatic+ skill pool by the rule: the whole pool from Chapter 3, four skills before (#109). */
  lunaticPlusPool(map: ChapterData): readonly string[];
  /** FEW/SF disagreements in the chapter data, resolved or open. */
  chapterDisagreements(): readonly ChapterDisagreement[];
  /** A map's chapter-guide entries (#123), grouped by source, each with its source's name and link. */
  chapterGuide(map: string): readonly { readonly source: { readonly id: string; readonly name: string; readonly link: string }; readonly entries: readonly GuideEntry[] }[];
  /** The first-gen units with a page (#101), in roster order, SpotPass last. Robin's page comes from the run facts. */
  pageUnits(): readonly { readonly id: PageUnitId; readonly name: string; readonly spotPass: boolean }[];
  /**
   * A first-gen unit's page (#101), or Robin's for a gender and asset/flaw (#103): join data, class tree, build coverage over its own reachable skills (the matcher
   * generalised from a pairing), what it passes as a parent and pair-up bonuses, in the play context.
   */
  unitPage(subject: PageSubject, settings: SkillViewSettings): UnitPage;
  /** The Skill card for one skill seen from a unit on its own (#101). */
  unitSkillCard(subject: PageSubject, id: SkillId, settings: SkillViewSettings): SkillCard;
  /**
   * A unit's Partners (#102): one row per possible S-support partner (Robin's included; SpotPass units have Robin only),
   * with the children the marriage produces and their scores in their plan presets, and where the marriage stands
   * against the roster and the saved plan. Sorted by the best child's score; read-only, no plan re-solve.
   */
  partners(subject: PageSubject, roster: Roster, settings: PlanSettings): readonly PartnerRow[];
  /**
   * A child's front door (#104): fixed facts, its top 5 parent groups by the scoring (the pairing table's group-best
   * ranking) and the Robin line. Morgan shows no pairings until Robin is set in the run facts.
   */
  frontDoor(child: ChildId, roster: Roster, settings: ScoreSettings, context: PlayContext): FrontDoor;
  /**
   * Each source's opinion of a unit, a child or Robin in the play context (#105), side by side: role, tier, classes,
   * the loadout matched against the unit's own reach (not for a child), partners recommended and warned, note, citation.
   */
  unitOpinions(subject: PageSubject | ChildId, settings: SkillViewSettings): readonly OpinionBlock[];
  /** Whether the roster blocks a pairing (hard: it can no longer happen; soft: it contradicts a pin or a bench), and why. */
  blocking(result: ChildResult, roster: Roster): Blocking;
  /**
   * A child's plan preset (#96): its preset override, else its role override's role preset, else the role preset of the
   * role army fit gives it. A child out of the cast without an override gets the global preset.
   */
  planPreset(child: ChildId, roster: Roster, settings: PlanSettings): PresetId;
  /** Every child's deployment role and plan preset after army fit, and where each comes from. */
  roles(roster: Roster, settings: PlanSettings): ReadonlyMap<ChildId, RoleAssignment>;
  /**
   * The children who qualify for Staff/Rally: their planned pairing (their best Lead pairing when unplanned) reaches a
   * staff class or a rally skill (#71).
   */
  staffQualified(roster: Roster, settings: PlanSettings): ReadonlySet<ChildId>;
  /**
   * The marriage plan: max Σ priority × score, each child in its plan preset (Auto class), with marriages and pins
   * fixed, broken and on-hold pins dropped and rule-outs never planned. `free` ignores the pins.
   */
  plan(roster: Roster, settings: PlanSettings, options?: { readonly free?: boolean }): MarriagePlan;
  /**
   * Derived roles (#95): each child's standing against the cast under every candidate preset, measured on its best
   * pairing that can still happen, with its role preset per deployment role and its best role. Dead children and
   * children with no pairing left are out of the cast, and so is Morgan until Robin is set in the run facts.
   */
  deriveRoles(roster: Roster, settings: PlanSettings): Derivation;
  /**
   * Robin gain (#98): per child except Morgan, its best score under its Lead role preset with Robin in the gene pool
   * minus its best without, both pairings named. The run facts' Robin when set, else each child's best Robin; it never
   * ranks Robins for the run. Children out of the cast have no entry.
   */
  robinGain(roster: Roster, settings: PlanSettings): ReadonlyMap<ChildId, RobinGain>;
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
  // A saved plan is valued on a roster with only the run facts; one object per run, so its values are shared.
  let lastSaved: Roster | undefined;
  const savedRoster = (run: RunFacts): Roster =>
    lastSaved && JSON.stringify(lastSaved.run) === JSON.stringify(run) ? lastSaved : (lastSaved = { ...EMPTY_ROSTER, run });
  // The Plan view asks for the plan and the free re-plan under one roster and settings: share values.
  let lastPlan: { roster: Roster; settings: string; ctx: PlanContext } | undefined;
  const planContext = (roster: Roster, s: PlanSettings): PlanContext => {
    const k = JSON.stringify(s);
    if (lastPlan?.roster !== roster || lastPlan.settings !== k) lastPlan = { roster, settings: k, ctx: newPlanContext(roster, s, rolesFor(roster, s)) };
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
  const newPlanContext = (roster: Roster, s: PlanSettings, roles: ReadonlyMap<ChildId, RoleAssignment>): PlanContext => {
    const memo = new Map<string, PlannedChild | undefined>();
    const byPreset = new Map<PresetId, Map<string, PairingScore> | undefined>();
    const scoresOf = (preset: PresetId) => {
      if (!byPreset.has(preset)) byPreset.set(preset, presetScores(preset, s));
      return byPreset.get(preset);
    };
    // Blocking reads only which units a pairing needs, never Robin's asset/flaw: share it across the 56.
    const blockings = new Map<string, Blocking>();
    const blockingOf = (pairing: Pairing, key: string) => {
      const units = key.replace(/robin:\w+\/\w+/g, 'robin');
      let found = blockings.get(units);
      if (!found) blockings.set(units, (found = evaluateBlocking(pairing, roster, assumptions)));
      return found;
    };
    const value = (pairing: Pairing, key: string): PlannedChild | undefined => {
      if (!byKey.has(key) || (s.noRobin && robinRefOf(pairing))) return undefined;
      const blocking = blockingOf(pairing, key);
      if (blocking.status === 'hard') return undefined;
      const { child } = pairing;
      const assigned = roles.get(child);
      const preset = assigned?.preset ?? s.overrides[child] ?? s.preset;
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
        notes: blocking.notes,
        ...(assigned ? { roleSource: assigned.source } : {}),
        ...(assigned?.reason ? { fitReason: assigned.reason } : {}),
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
      parentLabel: (pairing) => parentName(pairing.variableParent),
      candidates: (child) => {
        let found = candidates.get(child);
        if (!found) {
          found = narrowAll(groupsByChild.get(child) ?? [], { run: roster.run })
            .flatMap((g) => g.results.map((r) => r.pairing))
            .filter((p) => !s.noRobin || !robinRefOf(p));
          candidates.set(child, found);
        }
        return found;
      },
    };
  };

  /**
   * A child's pool (#95): the keys of its pairings that can still happen (the run facts narrow Robin; hard-blocked ones
   * are out). `noRobin` drops every pairing with Robin as a parent (#98). Cached per roster.
   */
  let poolRoster: Roster | undefined;
  const pools = new Map<string, string[]>();
  const poolFor = (roster: Roster, child: ChildId, noRobin: boolean): string[] => {
    if (poolRoster !== roster) {
      poolRoster = roster;
      pools.clear();
    }
    const k = `${child}|${noRobin}`;
    let found = pools.get(k);
    if (!found)
      pools.set(
        k,
        (found = narrowAll(groupsByChild.get(child) ?? [], { run: roster.run })
          .flatMap((g) => g.results.map((r) => r.pairing))
          .filter((p) => !(noRobin && robinRefOf(p)) && evaluateBlocking(p, roster, assumptions).status !== 'hard')
          .map(pairingKey)
          .filter((k) => byKey.has(k))),
      );
    return found;
  };
  /** Robin gain (#98): per child but Morgan, the best under its Lead role preset with Robin minus without. */
  const robinGainFor = (roster: Roster, settings: PlanSettings): ReadonlyMap<ChildId, RobinGain> => {
    const derivation = derivationFor(roster, { ...settings, noRobin: false });
    const out = new Map<ChildId, RobinGain>();
    for (const d of derivation.roles) {
      if (CHILD_UNITS[d.child].fixedParent === 'robin') continue;
      const preset = d.rolePreset.lead;
      const sc = presetScores(preset, settings);
      const best = (keys: readonly string[]): RobinGainSide | undefined => {
        let top: RobinGainSide | undefined;
        for (const key of keys) {
          const score = sc?.get(key)?.score;
          if (score === undefined || (top && top.score >= score)) continue;
          const r = byKey.get(key)!;
          top = { key, parent: parentName(r.pairing.variableParent), score };
        }
        return top;
      };
      const withRobin = best(poolFor(roster, d.child, false));
      if (!withRobin) continue;
      const without = best(poolFor(roster, d.child, true));
      out.set(d.child, { child: d.child, preset, with: withRobin, without, gain: withRobin.score - (without?.score ?? 0) });
    }
    return out;
  };

  /** The children a first-gen unit parents, as the fixed or the variable parent, with their pairing keys (#101). */
  /** Whether a pairing's Robin is this Robin (gender and asset/flaw). */
  const sameRobin = (p: Pairing, r: RobinRef) => {
    const x = robinRefOf(p);
    return !!x && x.gender === r.gender && x.asset === r.asset && x.flaw === r.flaw;
  };
  /** The children a page's subject parents, as the fixed or the variable parent, with their pairing keys (#101). */
  const parentedBy = (subject: PageSubject): ParentedChild[] => {
    const found = new Map<ChildId, { as: 'fixed' | 'variable'; keys: string[] }>();
    for (const r of all) {
      const { child, variableParent } = r.pairing;
      const as =
        typeof subject === 'string'
          ? CHILD_UNITS[child].fixedParent === subject
            ? 'fixed'
            : variableParent.kind === 'unit' && variableParent.id === subject
              ? 'variable'
              : undefined
          : sameRobin(r.pairing, subject)
            ? r.pairing.fixedRobin
              ? 'fixed'
              : 'variable'
            : undefined;
      if (!as) continue;
      const entry = found.get(child) ?? { as, keys: [] };
      entry.keys.push(r.key);
      found.set(child, entry);
    }
    return CHILD_IDS.flatMap((child) => {
      const e = found.get(child);
      return e ? [{ child, name: CHILD_UNITS[child].name, ...e }] : [];
    });
  };

  /** A pairing's two parents, as roster units. */
  const parentsOf = (p: Pairing): [RosterUnit, RosterUnit] => {
    const fixed = CHILD_UNITS[p.child].fixedParent;
    const v = p.variableParent;
    return [fixed, v.kind === 'robin' ? 'robin' : v.id];
  };
  /** The partners a first-gen unit can S-support: its S-support list (either side), then Robin. */
  const partnerIds = (unit: PageUnitId): (UnitId | 'robin')[] => {
    const women = S_SUPPORTS[unit];
    const list: UnitId[] = women
      ? [...women]
      : (Object.keys(S_SUPPORTS) as UnitId[]).filter((w) => S_SUPPORTS[w]!.includes(unit));
    const robin = (ROBIN_SUPPORTS.M as readonly string[]).includes(unit) || (ROBIN_SUPPORTS.F as readonly string[]).includes(unit);
    return [...list, ...(robin ? (['robin'] as const) : [])];
  };
  /**
   * The pairing a child partner of Robin brings to Morgan (#103): its parents in the saved plan, else its best pairing
   * that can still happen in its plan preset. Robin marries the child, so is never its parent: the pairing holds no
   * Robin at all, and fits whichever Robin the page previews (#124).
   */
  const childPartnerPairing = (c: ChildId, roster: Roster, s: PlanSettings): { pairing: Pairing; from: 'plan' | 'best' } | undefined => {
    const fixed = CHILD_UNITS[c].fixedParent;
    const spouse = roster.savedPlan?.marriages.find((m) => m.includes(fixed));
    const other = spouse && (spouse[0] === fixed ? spouse[1] : spouse[0]);
    const pool = narrowAll(groupsByChild.get(c) ?? [], { run: roster.run })
      .flatMap((g) => g.results)
      .filter((r) => !robinRefOf(r.pairing));
    if (other) {
      const planned = pool.find((r) => parentsOf(r.pairing)[1] === other);
      if (planned) return { pairing: planned.pairing, from: 'plan' };
    }
    const scores = presetScores(rolesFor(roster, s).get(c)?.preset ?? s.preset, s) ?? presetScores(s.preset, s);
    let best: { pairing: Pairing; score: number } | undefined;
    for (const r of pool) {
      if (evaluateBlocking(r.pairing, roster, assumptions).status === 'hard') continue;
      const score = scores?.get(r.key)?.score ?? -1;
      if (!best || score > best.score) best = { pairing: r.pairing, score };
    }
    return best && { pairing: best.pairing, from: 'best' };
  };
  const partnersFor = (subject: PageSubject, roster: Roster, s: PlanSettings): PartnerRow[] => {
    const derivation = derivationFor(roster, s);
    const self: RosterUnit = typeof subject === 'string' ? subject : 'robin';
    const couple = (a: RosterUnit, b: RosterUnit) => (c: readonly [RosterUnit, RosterUnit]) => (c[0] === a && c[1] === b) || (c[0] === b && c[1] === a);
    const presetOf = (child: ChildId) => {
      const planned = rolesFor(roster, s).get(child)?.preset ?? s.overrides[child] ?? s.preset;
      const lead = derivation.roles.find((d) => d.child === child)?.rolePreset.lead ?? s.preset;
      return presetScores(planned, s) ? planned : lead;
    };
    const unitGender = typeof subject === 'string' ? (FIRST_GEN_UNITS[subject].gender as Gender) : undefined;
    // Once the run sets Robin's gender, a unit of that gender can't marry Robin.
    const partners: RosterUnit[] =
      typeof subject === 'string'
        ? partnerIds(subject).filter((p) => p !== 'robin' || !roster.run.gender || roster.run.gender === opposite(unitGender!))
        : [...ROBIN_SUPPORTS[subject.gender]];
    const rows = partners.map((partner): PartnerRow => {
      const children: PartnerChild[] = [];
      let blocked: string | undefined;
      let via: PartnerRow['via'];
      let robin: RobinRef | undefined;
      const add = (child: ChildId, candidates: readonly { key: string; pairing: Pairing }[]) => {
        const preset = presetOf(child);
        const scores = presetScores(preset, s);
        let best: { key: string; score: number | undefined; pairing: Pairing } | undefined;
        for (const r of candidates) {
          const score = scores?.get(r.key)?.score;
          if (!best || (score ?? -1) > (best.score ?? -1)) best = { key: r.key, score, pairing: r.pairing };
        }
        if (!best) return;
        children.push({ child, name: CHILD_UNITS[child].name, key: best.key, score: best.score, preset });
        if (partner === 'robin') robin ??= robinRefOf(best.pairing);
        const blocking = evaluateBlocking(best.pairing, roster, assumptions);
        if (blocking.status === 'hard') blocked ??= blocking.hard.join('; ');
      };
      if (typeof subject !== 'string' && partner in CHILD_UNITS) {
        // Robin × a child: Morgan, on the child's plan pairing or its best that can still happen.
        const c = partner as ChildId;
        const brought = childPartnerPairing(c, roster, s);
        if (brought) {
          const morgan: Pairing = {
            child: subject.gender === 'M' ? 'morgan-f' : 'morgan-m',
            fixedRobin: subject,
            variableParent: { kind: 'child', id: c, variableParent: brought.pairing.variableParent },
          };
          const key = pairingKey(morgan);
          if (byKey.has(key)) add(morgan.child, [{ key, pairing: morgan }]);
          via = { label: `${CHILD_UNITS[c].name} ← ${parentName(brought.pairing.variableParent)}`, from: brought.from };
        }
      } else
      {
        const pools = CHILD_IDS.map((child) => {
          const pool =
            typeof subject === 'string'
              ? narrowAll(groupsByChild.get(child) ?? [], { run: roster.run }).flatMap((g) => g.results)
              : (groupsByChild.get(child) ?? []).flatMap((g) => g.results).filter((r) => sameRobin(r.pairing, subject));
          return [
            child,
            pool.filter((r) => {
              const [a, b] = parentsOf(r.pairing);
              return (a === self && b === partner) || (a === partner && b === self);
            }),
          ] as const;
        });
        // A Robin row is one marriage, so one Robin: with Robin open, the one whose best child scores highest.
        let chosen: RobinRef | undefined;
        if (partner === 'robin') {
          let top = -Infinity;
          for (const [child, pool] of pools) {
            const scores = presetScores(presetOf(child), s);
            for (const r of pool) {
              const score = scores?.get(r.key)?.score ?? -1;
              if (score > top) [top, chosen] = [score, robinRefOf(r.pairing)];
            }
          }
        }
        for (const [child, pool] of pools) add(child, chosen ? pool.filter((r) => sameRobin(r.pairing, chosen)) : pool);
      }
      const spouse = roster.spouses[self];
      const defined = children.map((c) => c.score).filter((x): x is number => x !== undefined);
      const gender = typeof subject === 'string' ? (FIRST_GEN_UNITS[subject].gender as Gender) : subject.gender;
      return {
        partner,
        name: partner === 'robin' ? `Robin (${opposite(gender)})` : unitName(partner),
        children,
        best: defined.length ? Math.max(...defined) : undefined,
        married: spouse?.bond === 'married' && spouse.partner === partner,
        planned: !!roster.savedPlan?.marriages.some(couple(self, partner)),
        dead: stateOf(roster, partner) === 'dead',
        blocked,
        ...(via ? { via } : {}),
        ...(robin ? { robin } : {}),
        ...(() => {
          const mark = markOf(typeof subject === 'string' ? subject : 'robin', partner, s.context);
          return mark ? { opinion: mark } : {};
        })(),
      };
    });
    return rows.sort((a, b) => (b.best ?? -1) - (a.best ?? -1));
  };

  /** The opinions of a unit in a play context: `all` shows every one; otherwise that context's and the unsplit ones. */
  const opinionsOf = (unit: OpinionUnit, context: PlayContext) =>
    UNIT_OPINIONS.filter((o) => o.unit === unit && (context === 'all' || o.context === 'all' || o.context === context));
  const opinionUnitOf = (subject: PageSubject | ChildId): OpinionUnit => (typeof subject === 'string' ? subject : 'robin');
  /** A source's mark on a partner of this unit, from its opinions in the context. */
  const markOf = (unit: OpinionUnit, partner: string, context: PlayContext): OpinionMark | undefined => {
    for (const o of opinionsOf(unit, context))
      for (const [kind, list] of [['recommended', o.recommended], ['warned', o.warned]] as const) {
        const p = list.find((x) => x.unit === partner);
        if (p) return { kind, reason: p.reason, source: SOURCES[o.source].name };
      }
    return undefined;
  };
  const opinionBlocks = (subject: PageSubject | ChildId, settings: SkillViewSettings): OpinionBlock[] => {
    const unit = opinionUnitOf(subject);
    const isChild = typeof subject === 'string' && subject in CHILD_UNITS;
    const gender: Gender = typeof subject !== 'string' ? subject.gender : isChild ? (CHILD_UNITS[subject as ChildId].gender as Gender) : (FIRST_GEN_UNITS[subject as UnitId].gender as Gender);
    const nameOf = (u: OpinionUnit) => (u === 'robin' ? 'Robin' : unitName(u));
    return opinionsOf(unit, settings.context).map((o): OpinionBlock => {
      let loadout: OpinionBlock['loadout'];
      if (!isChild && o.loadout.length) {
        const template = { id: `${o.source}-${unit}`, name: `${SOURCES[o.source].name}’s loadout`, role: 'physical-lead', contexts: [], slots: o.loadout, sources: [o.source], confidence: 'Single' } as unknown as BuildTemplate;
        const m = matchTemplate(template, unitReach(subject as PageSubject, dlcOf(settings)), settings.context);
        loadout = { slots: m.slots, filled: m.tier };
      }
      const src = SOURCES[o.source];
      return {
        source: { id: src.id, name: src.name, link: src.link, provenance: src.provenance },
        context: o.context,
        role: o.role,
        tier: o.tier,
        classes: o.classes.map((c) => className(c, gender)),
        loadout,
        recommended: o.recommended.map((p) => ({ name: nameOf(p.unit), reason: p.reason })),
        warned: o.warned.map((p) => ({ name: nameOf(p.unit), reason: p.reason })),
        robinPick: o.robinPick && `+${STAT_LABELS[o.robinPick.asset]} −${STAT_LABELS[o.robinPick.flaw]}`,
        note: o.note,
        citation: o.citation.timestamp ? `${o.citation.title} (${o.citation.timestamp})` : o.citation.title,
      };
    });
  };

  /** A child's front door (#104). */
  const frontDoorFor = (child: ChildId, roster: Roster, settings: ScoreSettings, context: PlayContext): FrontDoor => {
    const c = CHILD_UNITS[child];
    const robinSet = !!(roster.run.gender && roster.run.asset && roster.run.flaw);
    const isMorgan = c.fixedParent === 'robin';
    const scores = scoreAll(settings);
    const rawOf = (key: string) => scores.get(key)?.raw ?? -Infinity;
    const groups = narrowAll(groupsByChild.get(child) ?? [], { run: roster.run });
    const tiles = groups.map((g): FrontDoorTile & { raw: number } => {
      const best = g.results.reduce((a, r) => (rawOf(r.key) > rawOf(a.key) ? r : a));
      const mark = markOf(child, g.key, context);
      return { label: g.label, key: best.key, score: scores.get(best.key)?.score, raw: rawOf(best.key), ...(mark ? { mark } : {}) };
    });
    tiles.sort((a, b) => b.raw - a.raw);
    const starts = new Set((byChild.get(child) ?? []).map((r) => r.startClass));
    const gender = c.gender as Gender;
    const fixed = c.fixedParent === 'robin' ? undefined : c.fixedParent;
    const fixedSkill = fixed && FIXED_INHERITANCE[fixed];
    const passes = fixed ? FIRST_GEN_UNITS[fixed].passesClasses[gender === 'M' ? 'son' : 'daughter'] : null;
    const robinGender = opposite(gender);
    // This run's Robin, once its gender is set, is the only Robin the child could marry.
    const canMarryRobin = (ROBIN_SUPPORTS[robinGender] as readonly string[]).includes(child) && (roster.run.gender ?? robinGender) === robinGender;
    let morgan: FrontDoorTile | undefined;
    if (canMarryRobin && robinSet) {
      const m: ChildId = robinGender === 'M' ? 'morgan-f' : 'morgan-m';
      for (const g of narrowAll(groupsByChild.get(m) ?? [], { run: roster.run }))
        for (const r of g.results) {
          const v = r.pairing.variableParent;
          if (v.kind !== 'child' || v.id !== child) continue;
          if (!morgan || rawOf(r.key) > rawOf(morgan.key)) morgan = { label: `${CHILD_UNITS[m].name} ← ${parentName(v)}`, key: r.key, score: scores.get(r.key)?.score };
        }
    }
    const waits = isMorgan && !robinSet;
    return {
      child,
      name: c.name,
      gender,
      fixedParent: isMorgan ? `Robin (${opposite(gender)})` : FIRST_GEN_UNITS[c.fixedParent as UnitId].name,
      startClass: starts.size === 1 ? className([...starts][0]!, gender) : undefined,
      defaultClasses: c.defaultClassSet.map((id) => className(id, gender)),
      growths: c.growths,
      fixedPasses: {
        skill: fixedSkill ? ref(gender === 'M' ? fixedSkill.son : fixedSkill.daughter, context) : undefined,
        classes: (passes ?? []).map((id) => className(id, gender)),
      },
      top: waits ? [] : tiles.slice(0, 5).map(({ raw: _, ...t }) => t),
      marked: waits ? [] : tiles.slice(5).filter((t) => t.mark).map(({ raw: _, ...t }) => t),
      parentCount: waits ? 0 : groups.length,
      waitsOnRobin: waits,
      robin: isMorgan ? { kind: 'robins-child' } : canMarryRobin ? { kind: 'yes', morgan, robinSet } : { kind: 'no' },
    };
  };

  /** Derived roles for a roster and settings (#95). */
  const derivationFor = (roster: Roster, settings: PlanSettings): Derivation => {
    const robinSet = roster.run.gender !== null && roster.run.asset !== null && roster.run.flaw !== null;
    const children = rosterUnits(roster.run).filter((u) => u.kind === 'child').map((u) => u.id as ChildId);
    const pool = (child: ChildId) => poolFor(roster, child, !!settings.noRobin);
    const scores = new Map<PresetId, Map<string, PairingScore> | undefined>();
    const scoresOf = (preset: PresetId) => {
      if (!scores.has(preset)) scores.set(preset, presetScores(preset, settings));
      return scores.get(preset);
    };
    return deriveRoles({
      children,
      leftOut: (child) =>
        stateOf(roster, child) === 'dead'
          ? 'dead'
          : CHILD_UNITS[child].fixedParent !== 'robin'
            ? undefined
            : settings.noRobin
              ? 'no-robin'
              : !robinSet
                ? 'needs-robin'
                : undefined,
      pool,
      raw: (preset, key) => scoresOf(preset)?.get(key)?.raw,
    });
  };
  /** A pairing reaches a staff class or a rally skill (#71). */
  const qualifiesStaff = (key: string | undefined, s: PlanSettings): boolean => {
    const r = key ? byKey.get(key) : undefined;
    if (!r) return false;
    const reach = { context: s.context, dlc: s.dlc };
    const dlc = dlcOf(reach);
    if ([...reachOf(r)].some((id) => (STAFF_CLASSES as readonly ClassId[]).includes(id) && (dlc || !CLASSES[id].dlc))) return true;
    const skills = reachFor(r, reach);
    return RALLY_SKILLS.some((id) => skills.sourcesOf(id).length > 0);
  };
  /** Army fit (#96): each child's best role or override, moved only where a quota forces it; re-plans to a fixed point. */
  let lastRoles: { roster: Roster; settings: string; roles: ReadonlyMap<ChildId, RoleAssignment> } | undefined;
  const rolesFor = (roster: Roster, s: PlanSettings): ReadonlyMap<ChildId, RoleAssignment> => {
    const k = JSON.stringify(s);
    if (lastRoles?.roster === roster && lastRoles.settings === k) return lastRoles.roles;
    const derivation = derivationFor(roster, s);
    const derived = new Map(derivation.roles.map((r) => [r.child, r]));
    const cast = derivation.roles.map((r) => r.child).filter((c) => inPlay(roster, c));
    const base = new Map<ChildId, RoleAssignment>();
    for (const child of CHILD_IDS) {
      const preset = s.overrides[child];
      const role = s.roleOverrides[child];
      const d = derived.get(child);
      if (preset) base.set(child, { role: deploymentRoleOf(preset) as ChildDeploymentRole, preset, source: 'preset override' });
      else if (role) base.set(child, { role, preset: d ? d.rolePreset[role] : CANDIDATE_PRESETS[role][0], source: 'role override' });
      else if (d) base.set(child, { role: d.bestRole, preset: d.rolePreset[d.bestRole], source: 'derived' });
    }
    let roles: ReadonlyMap<ChildId, RoleAssignment> = base;
    for (let pass = 1; pass <= ARMY_FIT_PASS_CAP; pass++) {
      const plan = solvePlan(newPlanContext(roster, s, roles));
      const plannedKey = new Map(plan.marriages.flatMap((m) => m.children.map((c) => [c.child, c.key] as const)));
      const qualifies = (child: ChildId) => {
        const d = derived.get(child);
        return qualifiesStaff(plannedKey.get(child) ?? d?.bestPairing[d.rolePreset.lead], s);
      };
      const next = armyFit({ roster, quotas: s.quotas, noRobin: s.noRobin, plan, derived, base, cast, qualifies, order: CHILD_IDS });
      const same = [...next].every(([c, a]) => roles.get(c)?.preset === a.preset && roles.get(c)?.role === a.role);
      roles = next;
      if (same) break;
    }
    lastRoles = { roster, settings: k, roles };
    return roles;
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
    maps: () => MAPS,
    lunaticPlusPool: lunaticPlusPoolFor,
    chapterDisagreements: () => CHAPTER_DISAGREEMENTS,
    chapterGuide: (map) => {
      const entries = CHAPTER_GUIDE.filter((e) => e.map === map);
      const sources = [...new Set(entries.map((e) => e.source))];
      return sources.map((id) => ({ source: { id, name: SOURCES[id].name, link: SOURCES[id].link }, entries: entries.filter((e) => e.source === id) }));
    },
    pageUnits: () => {
      const units = (Object.keys(FIRST_GEN_UNITS) as UnitId[]).filter((u): u is PageUnitId => u !== 'maiden');
      const spot = new Set<string>(SPOTPASS_UNITS);
      return [...units.filter((u) => !spot.has(u)), ...SPOTPASS_UNITS].map((id) => ({ id, name: FIRST_GEN_UNITS[id].name, spotPass: spot.has(id) }));
    },
    unitPage: (unit, settings) => unitPage(unit, settings.context, dlcOf(settings), parentedBy(unit)),
    partners: partnersFor,
    frontDoor: frontDoorFor,
    unitOpinions: opinionBlocks,
    unitSkillCard: (unit, id, settings) => {
      const reach = unitReach(unit, dlcOf(settings));
      return skillCard(id, reach, settings.context, matchBuilds(reach, settings.context));
    },
    blocking: (r, roster) => evaluateBlocking(r.pairing, roster, assumptions),
    plan: (roster, settings, options) => solvePlan(planContext(roster, settings), options?.free),
    deriveRoles: derivationFor,
    robinGain: robinGainFor,
    roles: rolesFor,
    staffQualified: (roster, settings) => {
      const plan = solvePlan(planContext(roster, settings));
      const plannedKey = new Map(plan.marriages.flatMap((m) => m.children.map((c) => [c.child, c.key] as const)));
      const out = new Set<ChildId>();
      for (const d of derivationFor(roster, settings).roles)
        if (qualifiesStaff(plannedKey.get(d.child) ?? d.bestPairing[d.rolePreset.lead], settings)) out.add(d.child);
      return out;
    },
    planPreset: (child, roster, settings) => rolesFor(roster, settings).get(child)?.preset ?? settings.overrides[child] ?? settings.preset,
    evaluatePlan: (saved, run, settings) => evaluatePlan(planContext(savedRoster(run), settings), saved),
    planKeys: (roster) =>
      new Set(roster.savedPlan ? savedPairings(roster, roster.savedPlan).map(pairingKey).filter((k) => byKey.has(k)) : []),
    ledger: (roster, settings) => {
      const ctx = planContext(roster, settings);
      return childLedger(ctx, solvePlan(ctx), (p) => evaluateBlocking(p, roster, assumptions));
    },
  };
}
