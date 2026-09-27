/**
 * The engine facade: the only seam between the pure model and the UI (and the only thing tests drive).
 * No DOM in here or anything it imports.
 */
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { ASSET_FLAW, ROBIN_GROWTHS, ROBIN_MODIFIERS } from '../game-data/robin';
import { CLASSES, regularClasses, type ClassData, type ClassId } from '../game-data/classes';
import { MOD_STATS, STATS, STAT_LABELS, type Gender, type Growths, type Stat } from '../game-data/stats';
import { CHROM_FALLBACK_PARTNER, ROBIN_SUPPORTS, S_SUPPORTS, type SupportUnit } from '../game-data/supports';
import { SUPPORT_PAIR_CURVES, pairCurve, type PairCurve, type SupportPairCurve } from './support-curves';
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
import { childJoinStats, type ChildJoinInput, type ChildJoinStats } from './child-join';
import { childSkills, type ChildSkills, type ChildSkillsInput } from './child-skills';
import { buildSkillView, candidatesFor, firstGenSkills, ref, secondGenSkills, skillRank, skillReach, type SkillViewInput, type SkillViewSettings } from './skills';
import { BUILD_TEMPLATES } from '../curated/builds';
import { UNIT_OPINIONS, type OpinionUnit } from '../curated/unit-opinion';
import { CHAPTER_GUIDE, type GuideEntry } from '../curated/chapter-guide';
import { SOURCES } from '../curated/sources';
import type { BuildTemplate } from '../curated/builds';
import { skillCard } from './skill-card';
import { unitPage, unitReach, type FrontDoor, type FrontDoorTile, type OpinionBlock, type OpinionMark, type PageSubject, type PageUnitId, type ParentedChild, type PartnerChild, type PartnerRow, type UnitPage } from './unit-page';
import { SPOTPASS_UNITS } from '../game-data/join';
import { CHAPTER_DISAGREEMENTS, MAPS, lunaticPlusPoolFor, type ChapterData, type ChapterDifficulty as MapDifficulty, type ChapterDisagreement } from '../game-data/chapters';
import { mapWaves, type MapWaves } from './waves';
import type { RenownReward } from '../game-data/gold';
import { mapGold, renownGain, renownRewards, type GoldRow } from './gold';
import { meanNoDeath, playMap, staffReach, type MapPlay, type MapPlayInput, type SimMap, type SimUnit } from './sim/map-play';
import { itemByName } from '../game-data/items';
import { simMapById, type SimMapOptions } from './sim/sim-map';
import { runSeed } from './sim/random';
import { planLineups, simulateRuns, type RunSim, type RunSimInput } from './sim/run-sim';
import { mapUpkeep, type MapUpkeep } from './sim/upkeep';
import { FLAWLESS_RUNS, FLAWLESS_SEED, flawlessCeiling, flawlessChance, flawlessInput, runItemSources, sureIncome, type FlawlessChance, type FlawlessOptions } from './flawless';
import { simulateCeiling, type Ceiling } from './sim/ceiling';
import { coupleKey, endpointCoverage, nonStarters, seedPlan, type EndpointCoverage, type SeedContext, type SeedOptions } from './solve/seed';
import { milestones, type Milestone } from './milestones';
import { editCost, solveStep, type EditCost, type EditCostInput, type PinCost, type PinCostInput, type SolveStep, type SolveStepInput } from './solve/step';
import { keptPins, planEdits } from './solve/edits';
import { brokenPins, livePins, pinKey, runPins, withPin, withoutPins } from './solve/pins';
import { FORCED_UNITS, childrenOf, coveredLineup, hasUtility, planWithout, reservesStep, withoutUnits, worthStep, type ReservesInput, type ReservesStep, type WorthInput, type WorthStep, type WorthVariant } from './solve/worth';
import type { Plan, PlanLineup, PlanPin, PlanPriority, PlanRobin } from './solve/plan';
import { beforeMapItems, itemPlanOf, type BeforeMapItem, type ItemPlan, type ItemUsed } from './item-plan';
import { readings, recordedStats, type Readings, type ReadingsOptions, type UnitStats } from './readings';
import { defaultPriorities, expForecast, suggestChanges, suggestedChanges, type ExpForecast, type ExpForecastOptions, type SuggestedChange } from './exp-forecast';
import { BLIND_SPOTS, type BlindSpot } from './assumptions';
import { matchBuilds, matchTemplate, shownMatch, templateSummary, templatesFor } from './builds';
import type { SkillId } from '../game-data/skills';
import { createScorer } from './scoring';
import { pairUpSpd } from './pair-up';
import { contextReachesDlc, defaultTargetBreakpoint } from './speed';
import { runSelfTest } from './self-test';
import { EMPTY_ROSTER, evaluateBlocking, rosterUnits, stateOf, unitName, type Blocking, type Roster, type RosterUnit, type RunFacts } from './roster';
import { CANDIDATE_PRESETS, PRESETS, type PresetId, type ScoringRole } from '../curated/presets';
import { DEFAULT_PRIORITY, childLedger, evaluatePlan, savedPairings, solvePlan, type LedgerEntry, type MarriagePlan, type PlanContext, type PlannedChild } from './plan';
import type { Difficulty, SavedPlan } from './roster';
import { combatExp, type CombatOutcome, type ExpFoe } from './exp';
import { classChangeProposals, internalLevels, type ProposedClassChange, type UnitInternalLevel } from './internal-level';
import { entryShopping, type EntryShopping } from './shopping';
import { sideGoalChoices, sideGoalsSecured, type SideGoalChoice, type SideGoalRecord } from './side-goals';
import { renownAhead, type RenownAhead } from './renown';
import { deploymentRoleOf, inPlay } from './composition';
import { ARMY_FIT_PASS_CAP, armyFit, type RoleAssignment } from './army-fit';
import { deriveRoles, type Derivation, type RobinGain, type RobinGainSide } from './derive';
import type { ChildDeploymentRole, DeploymentRole } from '../curated/deployment';
import { FIXED_INHERITANCE, RALLY_SKILLS } from '../game-data/skills';
import { STAFF_CLASSES } from '../game-data/classes';
import { remainingMapOrder, type MapOrder } from './map-order';
import type { Run } from './run';
export { dismissMigrationNote, importRun, migrateRun } from './run-migration';
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
export { routeMapOrder, type Endpoint, type MapOrder, type MapOrderStep } from './map-order';
export { childJoinStats, classBaseStats, type ChildJoinInput, type ChildJoinStats, type JoinParent } from './child-join';
export { fixedPass, startSkills, type ChildSkills, type ChildSkillsInput, type SkillParent } from './child-skills';
export type { Citation } from '../game-data/citations';
export { CHAPTER_GUIDE, type GuideEntry } from '../curated/chapter-guide';
export { classIdByName, classWeaponKinds, openStock, promotionAdvice, sealAvailability, sealsHeld, supplyList, type PromotionAdvice, type SealAvailability, type StockItem, type Supply } from './supply';
export { coverage, deployCount, deployMax, deployRoleOf, forcedOn, suggestDeployment, suggestLoadout, type DeployCandidate, type Deployment, type Loadout, type Pair } from './deploy';
export { childParalogueGates, isChildParalogue, type ChildParalogueGate, type ParalogueGateState } from './child-paralogues';
export { type MapWaves, type Wave, type WaveGroup } from './waves';
export { type ArmySpread, type SimItem } from './sim/sustain';
export { EXPOSURE_RISK, MAX_TURNS, type ExpPriority, type MapPlay, type MapPlayInput, type SimAct, type SimChase, type SimFight, type SimFoeGroup, type SimGroup, type SimMap, type SimStance, type SimTurn, type SimUnit, type SimUnitTally, type SimWave } from './sim/map-play';
export { simLineup, type SimMapOptions } from './sim/sim-map';
export { levelCap, type ArmyUnit, type ChildRecruit, type GoldSpread, type RunSim, type RunSimInput, type RunSimMap, type RunSimMapResult, type ShoppingLine, type ShoppingStop, type StatSpread, type UnitForecast, type SupportForecast, type MarriageForecast, type RunSimSideGoal, type SideGoalForecast, type ItemSource, type ItemFind, type SimItemUse, type ItemUseForecast, type MapExp, type UnitExp, type MilestoneCheck, type MilestoneChance } from './sim/run-sim';
export { KIT_FORGE_MT, VULNERARY_VALUE, type MapUpkeep } from './sim/upkeep';
export { SIDE_GOAL_IDS, chaseByDefault, sideGoalById, withSideGoalPin, withSideGoalSecured, type SideGoal, type SideGoalChoice, type SideGoalDecision, type SideGoalId, type SideGoalPart, type SideGoalPlan, type SideGoalRecord } from './side-goals';
export { rewardsValue, withRenown, type RenownAhead, type RenownStop, type RunRenown } from './renown';
export { TOP_PAIR_POINTS, combatPoints, mapSupportGains, type SupportGain, type Together } from './sim/support-growth';
export { FLAWLESS_RUNS, FLAWLESS_SEED, fighterOf, type FlawlessChance, type FlawlessOptions, type NotSimulated } from './flawless';
export { effectiveCaps, type Ceiling, type CeilingUnit } from './sim/ceiling';
export type { LineupPlan } from './sim/run-sim';
export { isMarriagePin, isRuleOut, mapSpanPin, marriagePins } from './solve/plan';
export { pinKey, withPin, withoutPins, type LineupRule } from './solve/pins';
export type { KeepPin, MarriagePin, SideGoalPin, SpanPin, SpanPosition } from './solve/plan';
export { NO_PREPARATIONS } from '../game-data/chapters';
export { STAT_BOOSTERS, TONICS, statItemGain } from '../game-data/items';
export { hasPreparations, heldKind, statOfItem, runItemPins, withItemPin, withItemsUsed, type BeforeMapItem, type HeldKind, type ItemIdle, type ItemPlan, type ItemPlanRow, type ItemUsed, type PlanSource, type TonicBuys } from './item-plan';
export type { CloseCall, ItemPin, Plan, PlanItem, PlanLineup, PlanPin, PlanPriority, PlanProposal, PlanRobin, PlanSeal, Position, PrunedComp, Roadmap, SolveCursor, Wishlist, WishlistChild, WishlistReserve, WishlistUnit } from './solve/plan';
export { READING_SECONDS, SUGGEST_RUNS, growthPercentile, readUnits, type Reading, type ReadingKind, type Readings, type ReadingsOptions, type StatPercentile, type UnitStats } from './readings';
export { ON_TRACK, milestoneCheck, type ExpForecast, type ExpForecastOptions, type SuggestedChange, type SuggestedPin } from './exp-forecast';
export type { EndpointCoverage, SeedOptions } from './solve/seed';
export type { ClassMilestone, Milestone, MilestonePoint, RecruitMilestone, SealSource, SkillMilestone, SupportMilestone, SupportWindow } from './milestones';
export { EDIT_COST_BUDGET, EDIT_KINDS, SEARCH_RUNS, rescoreSeed, SOLVE_SECONDS, STEP_BUDGET, type EditCost, type EditCostInput, type EditKind, type PinCost, type PinCostInput, type SolveStep, type SolveStepInput } from './solve/step';
export { FORCED_UNITS, LIKELY_LOSSES, type LikelyLoss, type ReserveReading, type ReservesCursor, type ReservesInput, type ReservesStep, type UnitWorth, type WorthCursor, type WorthInput, type WorthStep } from './solve/worth';
export { BLIND_SPOTS, type BlindSpot, type BlindSpotId, type RunBlindSpotId } from './assumptions';
export { bestWeapon, classTypes, dangerFlags, foeKey, foeOf, foesOf, matchup, pairUpBonus, statValue, type DangerFlag, type Fighter, type Foe, type Matchup } from './solver';
export {
  EMPTY_RUN,
  EMPTY_SNAPSHOT,
  SUPPORT_LEVELS,
  addEntry,
  childJoinFrom,
  editEntry,
  exportRun,
  flaggedEntries,
  heldProblems,
  latestEntry,
  marriedUnits,
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
  type ChildJoin,
  type HeldItem,
  type LaterRecruit,
  type MapOffer,
  type PrepUnits,
  type CalibrationRow,
  type LearnedCorrections,
  type MigrationNote,
  type Run,
  type RunEntry,
  type Snapshot,
  type SupportLevel,
  type UnitSnapshot,
} from './run';
export { CHROM_WEDDING_ORDER, OLIVIA_WEDDING_POINTS, chromChapter11Wife, chromWedding, chromWifeByPoints, type ChromStanding, type ChromWeddingAsk, type ChromWife } from './chrom-wedding';
export {
  COMBAT_EXP_MAX,
  COUNT_CAP,
  RALLY_EXP,
  STAFF_EXP,
  combatExp,
  damageExp,
  danceExp,
  expFoeOf,
  internalLevel,
  killExp,
  secondSealCount,
  staffExp,
  tierOfClass,
  type CombatOutcome,
  type ExpFoe,
} from './exp';
export { removeClassChange, withClassChange, withCountOverride, type ClassChange, type ProposedClassChange, type Seal, type UnitInternalLevel } from './internal-level';
export { afterShopping, entryAfterShopping, goldAfterShopping, removeShopLine, shopPrice, withShopLine, type EntryShopping, type ItemFound, type ItemUse, type ShopKind, type ShopLine, type ShoppingSpend } from './shopping';
export {
  FORGE,
  ITEMS,
  ITEM_DISAGREEMENTS,
  forgeCost,
  forgeProblem,
  forgedStats,
  itemByName,
  sellPrice,
  sellRate,
  type Effectiveness,
  type ForgeLevels,
  type GameItem,
  type ItemDisagreement,
  type ItemKind,
  type SellRate,
} from '../game-data/items';
export { RENOWN, STARTING_GOLD, type RenownReward } from '../game-data/gold';
export type { GoldRow } from './gold';
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
  type MapItemRow,
  type PlayDependence,
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
export { SUPPORT_POINTS_PER_MAP, type PairCurve, type SupportPairCurve } from './support-curves';
export type { SupportCurve, SupportThresholds, SupportUnit } from '../game-data/supports';
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
  /**
   * A child's join stats (#155) from its parents' stats and current classes as they are on entering its paralogue,
   * under this engine's assumptions. Morgan needs its start class.
   */
  childJoinStats(input: ChildJoinInput): ChildJoinStats;
  /**
   * The skills a child joins with (#187): its start class's up to Lv 10, then each parent's bottom-slot eligible skill
   * as equipped on entering its paralogue, with the fixed passes and the inheritance assumptions.
   */
  childSkills(input: ChildSkillsInput): ChildSkills;
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
  /**
   * The map order still to play (#179): the route's template (Full route or Main story) after the latest recorded map,
   * through the endpoint, with child paralogues marked movable and Infinite Regalia optional, and the endpoint with its
   * deploy count.
   */
  mapOrder(run: Run): MapOrder;
  /** A map's Lunatic+ skill pool by the rule: the whole pool from Chapter 3, four skills before (#109). */
  lunaticPlusPool(map: ChapterData): readonly string[];
  /** FEW/SF disagreements in the chapter data, resolved or open. */
  chapterDisagreements(): readonly ChapterDisagreement[];
  /**
   * A map's reinforcement waves on a difficulty (#178; Lunatic+ reads Lunatic's): the turns each joins, its foe groups
   * (each with a foe for the map solver), conditions kept as text, and any line of FEW's not read, text kept.
   */
  mapWaves(map: string, difficulty: MapDifficulty): MapWaves;
  /**
   * A map for the simulation (#181): its victory (rout, or the boss to defeat), starting foes and waves on the run's
   * difficulty (Lunatic+: Lunatic's tables, each foe's two skills drawn from the pool unless recorded in `seen`).
   */
  simMap(map: string, difficulty: Difficulty, options?: SimMapOptions): SimMap;
  /**
   * Plays one map turn by turn with a lineup (#181): its exact no-death chance, turns, how it ended, each unit's combats,
   * kills per foe group and combats with each partner, and a per-turn log. The same input and seed give the same play.
   */
  playMap(input: MapPlayInput, seed: number): MapPlay;
  /** The no-death chance averaged over `runs` plays from `seed` (Lunatic+ skills drawn anew each run). */
  mapNoDeath(input: MapPlayInput, seed: number, runs?: number): number;
  /**
   * The chance a unit's staff reaches a pair (#182): its Mov plus the staff's range (Mag ÷ 2 for Physic, Fortify and
   * Rescue) against the assumed army spread (`army-spread`, unless `spread` gives a map's distances). 0 for an item
   * that isn't a healing or Rescue staff. Both play calls above fill in the assumed spread when the input has none.
   */
  staffReach(unit: SimUnit, staff: string, spread?: readonly number[]): number;
  /**
   * The uses a play spends (#190), expected: by unit, then item. A weapon spends one per hit (a tome's miss per
   * `tome-miss-use`), the back's weapon one per Dual Strike that hits, Armsthrift saving each at Luck × 2%; a staff or
   * potion one per use. The simulated runs draw the hits instead.
   */
  mapUpkeep(input: MapPlayInput, play: MapPlay): MapUpkeep;
  /** The stated blind spots, each with its lean (may read high, low, or either way). */
  blindSpots(): readonly BlindSpot[];
  /** A map's chapter-guide entries (#123), grouped by source, each with its source's name and link. */
  chapterGuide(map: string): readonly { readonly source: { readonly id: string; readonly name: string; readonly link: string }; readonly entries: readonly GuideEntry[] }[];
  /**
   * A map's gold income (#180): each Bullion at its sale price and Paralogue 13's gold, in item order, with what play can
   * lose (`play`). The run's other gold facts are STARTING_GOLD, sellPrice/sellRate and RENOWN.
   */
  mapGold(map: string): readonly GoldRow[];
  /**
   * A map's sure income (#190), as the simulated runs count it: the `mapGold` rows no play can lose. Only Bullion is
   * sold (and Paralogue 13 pays gold); every other item is held.
   */
  mapIncome(map: string): number;
  /** Renown for clearing a map: 10 for a story map; a paralogue or DLC map per the `paralogue-renown` assumption. */
  renownGain(map: string): number;
  /** The renown rewards crossed going from `from` renown to `to`, in threshold order. */
  renownRewards(from: number, to: number): readonly RenownReward[];
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
   * A pair's support curve (#177), either way round: slow, medium, fast or non-romantic, its thresholds (total points
   * for C, B, A and S), maps together to each rank at 3 points a map and one rank a map, and maps to S (slow 8, fast
   * or medium 7, none for a non-romantic pair); under the `support-past-threshold` bank, several ranks a map. Robin is `robin-m` or `robin-f`. Undefined when the two can't support.
   */
  supportCurve(a: SupportUnit, b: SupportUnit): PairCurve | undefined;
  /** Every pair that can support, with its curve (#177): 316 pairs, Robin (M) and Robin (F) counted apart. */
  supportPairs(): readonly SupportPairCurve[];
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
   * A saved plan as it was adopted, valued under today's settings, each child in its plan preset on the roster (as
   * today's plan has it): only the run facts block its pairings, not the losses and marriages since, so a diff against
   * today's plan shows what they cost.
   */
  evaluatePlan(saved: SavedPlan, roster: Roster, settings: PlanSettings): MarriagePlan;
  /** The keys of the saved plan's pairings (the tables' ◆ in plan); empty without a saved plan. */
  planKeys(roster: Roster): ReadonlySet<string>;
  /**
   * The children ledger: each child of the run with its fixed parent, the plan's pairing (or its parents' marriage),
   * its best pairing that can still happen with Δ vs the plan, and its status.
   */
  ledger(roster: Roster, settings: PlanSettings): readonly LedgerEntry[];
  /**
   * The EXP one combat gives (research/exp-rules; #185). A back earns only from its own Dual Strikes (half its damage
   * EXP, all of it on a kill, never kill EXP); Veteran's ×1.5 applies only when its holder is in front (C4). The
   * Lunatic repeat cut starts at the foe's 4th engagement. For the hot loop, call the pure `combatExp` directly.
   */
  combatExp(c: CombatExpInput): number;
  /** Each unit's internal level as of an entry (the latest by default), walked from the log's class changes. */
  internalLevels(run: Run, entry?: string): ReadonlyMap<RosterUnit, UnitInternalLevel>;
  /** Class changes the log suggests (a level reset) but doesn't hold, on every entry: Record results proposes them. */
  classChangeProposals(run: Run): readonly ProposedClassChange[];
  /**
   * An entry's shopping step (#192): its gold at the map's end and after shopping, its buys, sales and forges with what
   * they spent on upkeep, seals and the kit, and what its map used (uses spent against the entry before, after that
   * one's shopping) and found (the map's items, or random finds with no buy or map item behind them).
   */
  shopping(run: Run, entry: string): EntryShopping | undefined;
  /**
   * The side goals (#191), in map order, each with the plan's decision: the run's pin (always take or skip), else the
   * default rule (`chaseByDefault`: chase when it costs at most one action a turn until its deadline).
   */
  sideGoals(run: Run): readonly SideGoalChoice[];
  /** The side goals on an entry's map, secured as Record results set them, else pre-filled from the items the map gave. */
  sideGoalsSecured(run: Run, entry: string): readonly SideGoalRecord[];
  /**
   * Renown (#191): now (the recorded start plus each map logged; unrecorded, 0 with every reward so far claimed) and,
   * over the map order still to play, renown after each map and the rewards arriving on it (the menu opens after
   * Chapter 3). Paralogue and DLC maps give the `paralogue-renown` assumption's renown.
   */
  renown(run: Run): RenownAhead;
  /**
   * The flawless chance of today's plan (#186): every map from the next one to the endpoint played by its suggested
   * deployment, each unit's EXP and level-ups sampled along the way, over `runs` simulated runs from `seed` (defaults
   * FLAWLESS_RUNS, FLAWLESS_SEED). The mean of each run's product of no-death chances, with its ± (95%), each map's
   * chance, the expected stats entering the endpoint, the units left out, and those whose seal history is read as 0.
   */
  flawlessChance(run: Run, options?: FlawlessOptions): FlawlessChance;
  /** The same simulation over a hand-built army and maps (tests, and the solve's edits on the same runs). */
  simulateRuns(input: RunSimInput, seed: number, runs: number): RunSim;
  /**
   * The ceiling (#189): the endpoint's flawless chance with every unit of today's plan (the army and every recruit on
   * the way) at its effective caps in its full class, no spread; it brackets the flawless chance from above. Its chance
   * is undefined when the endpoint's foes carry no weapons in the chapter data; the result is undefined
   * once the endpoint is recorded. Same options as `flawlessChance` (Lunatic+ plays `runs` skill draws).
   */
  ceiling(run: Run, options?: FlawlessOptions): Ceiling | undefined;
  /** The ceiling of a hand-built army and maps: the last map is the endpoint. */
  simulateCeiling(input: RunSimInput, seed: number, runs: number): Ceiling | undefined;
  /**
   * The solve's seed for a run (#198): marriages and Robin (where the run facts leave it open) matched on endpoint
   * coverage, recorded marriages kept as facts and marriage pins kept; the wishlist is the endpoint's lineup of that army
   * at its full build, each unit's best play-context build, each parent passing the skill its child's build wants most;
   * the roadmap is greedy (it names only the endpoint's lineup). Deterministic and cheap: no map is played.
   * Evaluate it with `flawlessChance(run, { plan })`.
   */
  seedPlan(run: Run, options?: SeedOptions): Plan;
  /**
   * A pairing's endpoint coverage (#198): the share of the endpoint's foes its child beats at caps, times the share of
   * the maps still to play it is in the army for. `parents` is any couple that makes the child (Robin's as `robin`);
   * undefined when it makes no such child.
   */
  endpointCoverage(run: Run, child: ChildId, parents: readonly [RosterUnit, RosterUnit], robin: PlanRobin): EndpointCoverage | undefined;
  /**
   * The anytime solve's stepping call (#198, #199): from the adopted plan (or the seed), within a budget of evaluations
   * (simulated runs of one plan), the local search's best plan, its flawless chance re-scored on fresh runs when this
   * step worked it out, the proposals (never applied), the close calls, the marriages pruned by their ceiling, and
   * whether the search has converged. Pass the returned cursor to the next step. Deterministic for the same input.
   */
  solveStep(input: SolveStepInput): SolveStep;
  /**
   * An edit's cost (#199): the edited plan's gain over the adopted plan on the same runs, with its paired error (±, 95%),
   * within a budget of evaluations: `EDIT_COST_BUDGET.provisional` for the first reading (about 1 s), `.settled` to
   * settle it (clear either way, or a close call at the run cap).
   */
  editCost(input: EditCostInput): EditCost;
  /**
   * Each unit's worth and utility on a plan (#202), within a budget of evaluations: the flawless chance lost without it
   * (removed from every lineup where it's optional, its children with it, its spouse re-matched, the wishlist rebuilt
   * and the roadmap re-solved greedily where it was named), and the part lost when it fights but takes no staff, Dance
   * or Rally action, both on the plan's own runs (paired, ±95%). Chrom and Robin read forced. Every unit in any of the
   * plan's lineups has one. Pass the returned cursor to the next step until converged (runs double to `cap`).
   */
  unitWorth(input: WorthInput & { readonly roleOf?: (u: RosterUnit) => DeploymentRole }): WorthStep;
  /**
   * The plan a unit's worth is read against (#202): without the unit and the children it takes with it, its spouse
   * re-matched, the wishlist rebuilt and the roadmap re-solved greedily where it was named (for the worth's drill-down).
   */
  worthPlan(run: Run, plan: Plan, unit: RosterUnit, options?: { readonly pins?: readonly PlanPin[]; readonly roleOf?: (u: RosterUnit) => DeploymentRole }): Plan;
  /** The same over a hand-built army and maps: a unit is removed with the children it parents (tests). */
  simulateWorth(input: RunSimInput, options: Omit<WorthInput, 'run' | 'plan' | 'pins'>): WorthStep;
  /**
   * A plan's reserves (#202), within a budget: for the likely losses (the wishlist units its runs lose most, weighted by
   * how often), the chance each unit off the wishlist restores stepping into the lost unit's endpoint slot, on the same
   * runs; ordered, each naming the loss it mainly covers. Run it when the worker is idle, after the solve. The plan it
   * returns lists them and changes nothing else: no EXP is set aside for a reserve.
   */
  reserves(input: ReservesInput & { readonly roleOf?: (u: RosterUnit) => DeploymentRole }): ReservesStep;
  /**
   * Every map's lineup on a plan's roadmap (#198): its own where it names one, else the greedy lineup its projection
   * picks. Plays every map once: about 2 s on a fresh Full route (the Web Worker's job, #199).
   */
  roadmapLineups(run: Run, plan: Plan, options?: Pick<FlawlessOptions, 'seed' | 'roleOf'>): readonly PlanLineup[];
  /**
   * A plan's milestones for a run (#194): supports (windows counted in maps, non-starters flagged), skills learned (for
   * a build, or passed at paralogue entry; wasted passes flagged), recruitments and classes reached (each naming its
   * seal and where it comes from; a seal play can lose flagged as a risk), ordered by where their event falls on the
   * roadmap, preconditions first. Each has a stable `id`. Cheap: no map is played.
   */
  milestones(run: Run, plan: Plan): readonly Milestone[];
  /**
   * The pins that hold on a run (#200): its own (`Run.pins`, its side goals, the Plan page's pinned marriages) and
   * `extra` (as `solveStep` takes them), each once, less recorded facts (a pin on what already happened, or on a unit
   * dead or missed). Hard constraints on the solve.
   */
  pins(run: Run, extra?: readonly PlanPin[]): readonly PlanPin[];
  /**
   * The run with pins lifted (#200): all of them by default, or `lift` (one pin, for its own cost). The pin cost's second
   * search is `solveStep` over it, from the best plan found with the pins (when the worker is idle).
   */
  liftPins(run: Run, options?: { readonly pins?: readonly PlanPin[]; readonly lift?: readonly PlanPin[] }): Run;
  /**
   * The pin cost (#200): the best plan found with the pins lifted (`lifted`, from the second search) less the best found
   * with them (`plan`), on the same runs, within a budget of evaluations as an edit's cost; all the pins together, or
   * `lift`'s on request. Recorded facts are never pins and cost nothing.
   */
  pinCost(input: PinCostInput): PinCost;
  /**
   * The item plan of a plan (#193): one row per held item (owned now, or picked up on a map still to play) with its
   * planned use or carrier timeline, the pins that set it, and, given the plan's flawless chance, its arrival chance
   * (the share of runs that made its first use); an item with none says why (Boots outside the model, no rank for the
   * Arms Scroll, other play deciding it, no gain) and what it sells for. Tonics to buy are summed per map.
   */
  itemPlan(run: Run, plan: Plan, options?: { readonly chance?: FlawlessChance; readonly pins?: readonly PlanPin[] }): ItemPlan;
  /** A map's "before this map" list on a plan (#193): boosters and tonics to drink, weapons to hand over. */
  beforeThisMap(run: Run, plan: Plan, map: string): readonly BeforeMapItem[];
  /**
   * The items used step of Record results (#193): the entry's items used as recorded, else pre-filled from the "before
   * this map" list of `plan`: the plan as it stood before the entry (the seed of the run up to the entry before it).
   */
  itemsUsed(run: Run, entry: string, plan: Plan | undefined): { readonly recorded: boolean; readonly items: readonly ItemUsed[] };
  /**
   * A plan's EXP forecast (#195), from its flawless chance's own simulation with the EXP priorities played (the
   * plan's, `options.priorities`, or the default from its milestones): per map, each unit's expected EXP, level range
   * and kills per foe group (`exp`), and each milestone's chance with the median level there (`milestones`, by id).
   * Costs one flawless chance.
   */
  expForecast(run: Run, plan: Plan, options?: ExpForecastOptions): ExpForecast;
  /** The default EXP priorities (#195): high from the join map to the deadline of a milestone that needs levels before the endpoint. */
  defaultPriorities(run: Run, plan: Plan): readonly PlanPriority[];
  /**
   * The suggested changes for one of a plan's milestones (#195), by id: one span pin each from the unit's join map to
   * the deadline, ranked (reaching 80% without breaking another milestone, fewest extra turns first; then those that
   * break one, flagged; then those that fall short). Costs one flawless chance per candidate.
   */
  suggestedChanges(run: Run, plan: Plan, milestone: string, options?: ExpForecastOptions): readonly SuggestedChange[];
  /** `suggestedChanges` over a simulation input whose `milestones` include the one named. */
  suggestChanges(input: RunSimInput, milestone: string, seed: number, runs: number): readonly SuggestedChange[];
  /**
   * Each unit's reading against a plan's milestones (#197): on track (worst open milestone at 80% or more, or none
   * left), at risk (one suggested change restores 80% without breaking another), or behind; behind first, each kind by
   * the flawless chance lost. Suggested changes are an input (`options.suggestions`, by milestone id): without them a
   * unit below 80% reads at risk, pending, and `pending` lists the milestones to ask `suggestedChanges` for (a worker
   * job). Pass `options.forecast` (`expForecast`) to reuse its simulation. Recorded stats come as percentiles.
   */
  readings(run: Run, plan: Plan, options?: ReadingsOptions): Readings;
  /** The latest recorded map's stats as percentiles of the spread expected there (#197): "Str p12". */
  recordedStats(run: Run, options?: Pick<FlawlessOptions, 'roleOf'>): readonly UnitStats[];
};

/** One combat for `Engine.combatExp`. */
export type CombatExpInput = {
  readonly internalLevel: number;
  readonly foe: ExpFoe;
  readonly outcome: CombatOutcome;
  readonly difficulty: Difficulty;
  /** In a pair: in front (the lead) or the back. Alone when unset. */
  readonly pair?: 'front' | 'back';
  /** The unit has Veteran equipped. */
  readonly veteran?: boolean;
  /** This combat is the foe's n-th engagement (1 by default). */
  readonly engagement?: number;
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

/** A map by id; throws for an unknown one. */
function mapById(id: string): ChapterData {
  const m = MAPS.find((x) => x.id === id);
  if (!m) throw new Error(`No chapter data for ${id}`);
  return m;
}

/** Plan inputs kept per run for the solve's batches (#199). */
const PLAN_INPUTS = 16;
/** Worth's variant inputs and plans kept per run (#202): a few plans' units, losses and reserves. */
const WORTH_INPUTS = 96;
/** Lunatic+ skill draws the solve's ceiling check plays (#199). */
const CEILING_DRAWS = 4;

export function createEngine(assumptions: Assumptions = DEFAULT_ASSUMPTIONS): Engine {
  // The map simulation's staff reach (#182): the assumed army spread, unless the input gives the map's distances.
  const spreadIn = (input: MapPlayInput): MapPlayInput => (input.spread ? input : { ...input, spread: assumptions['army-spread'] });
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
  const wavesCache = new Map<string, MapWaves>();
  const builds = (r: ChildResult, settings: SkillViewSettings): readonly BuildMatch[] => {
    const k = `${r.key}|${settings.context}|${dlcOf(settings)}`;
    let found = buildCache.get(k);
    if (!found) buildCache.set(k, (found = matchBuilds(reachFor(r, settings), settings.context)));
    return found;
  };

  // The seed's builds (#198): a child's best build hangs only on what it can reach (not on Robin's asset/flaw), a unit's
  // on the unit (Robin's on its gender); cached by that and the play context.
  const seedBuilds = new Map<string, BuildMatch | undefined>();
  /**
   * A plan's simulation input, kept for the plans a run's solve is comparing (#199): its runs are simulated in batches,
   * and each batch reuses the input and so its projection (run-sim's). A few plans per run and roles; the oldest goes.
   */
  /** Hand-built worth variants (#202, `simulateWorth`), kept while the input lives. */
  const handBuilt = new WeakMap<RunSimInput, Map<string, RunSimInput>>();
  const planInputs = new WeakMap<Run, { roleOf: ((u: RosterUnit) => DeploymentRole) | undefined; byPlan: Map<string, RunSimInput> }>();
  const planInput = (run: Run, plan: Plan, roleOf: ((u: RosterUnit) => DeploymentRole) | undefined): RunSimInput => {
    let held = planInputs.get(run);
    if (!held || held.roleOf !== roleOf) planInputs.set(run, (held = { roleOf, byPlan: new Map() }));
    const k = JSON.stringify(plan);
    let input = held.byPlan.get(k);
    if (input) {
      held.byPlan.delete(k);
    } else {
      input = flawlessInput(run, assumptions, roleOf, undefined, plan).input;
      if (held.byPlan.size >= PLAN_INPUTS) held.byPlan.delete(held.byPlan.keys().next().value!);
    }
    held.byPlan.set(k, input);
    return input;
  };
  /**
   * Worth's variants of a plan (#202), each input built once and kept while the run lives (so each keeps its
   * projection across steps): the plan, the plan without a unit (and the children it takes), the unit idle, and a
   * reserve stepping into a lost unit's slot. Kept per run and roles, the oldest going first.
   */
  const worthHeld = new WeakMap<Run, { roleOf: ((u: RosterUnit) => DeploymentRole) | undefined; inputs: Map<string, RunSimInput>; plans: Map<string, Plan> }>();
  const worthVariants = (run: Run, plan: Plan, roleOf: ((u: RosterUnit) => DeploymentRole) | undefined, pins: readonly PlanPin[] | undefined) => {
    let held = worthHeld.get(run);
    if (!held || held.roleOf !== roleOf) worthHeld.set(run, (held = { roleOf, inputs: new Map(), plans: new Map() }));
    const { inputs, plans } = held;
    const planKey = JSON.stringify([plan, pins ?? []]);
    const keep = <T,>(m: Map<string, T>, k: string, make: () => T): T => {
      let x = m.get(`${planKey}|${k}`);
      if (x !== undefined) m.delete(`${planKey}|${k}`);
      else {
        x = make();
        if (m.size >= WORTH_INPUTS) m.delete(m.keys().next().value!);
      }
      m.set(`${planKey}|${k}`, x);
      return x;
    };
    const inputFor = (p: Plan) => flawlessInput(run, assumptions, roleOf, undefined, p).input;
    const base = keep(inputs, 'plan', () => inputFor(plan));
    const recruited = new Set<RosterUnit>([...base.army.map((a) => a.id), ...base.maps.flatMap((m) => [...m.joining, ...m.later].map((a) => a.id))]);
    const recorded = (base.married ?? []).filter((c): c is readonly [RosterUnit, RosterUnit] => c[1] !== 'maiden');
    const goneOf = (u: RosterUnit) => new Set<RosterUnit>([u, ...childrenOf(plan, u, recruited)]);
    const options = { ...(pins ? { pins } : {}), ...(roleOf ? { roleOf } : {}) };
    const without = (u: RosterUnit) => keep(plans, `without:${u}`, () => planWithout(run, seedContext(run), options, plan, goneOf(u), recorded));
    const inputOf = (v: WorthVariant): RunSimInput => {
      if (v.kind === 'plan') return base;
      if (v.kind === 'idle') return keep(inputs, `idle:${v.unit}`, () => ({ ...base, idle: [v.unit] }));
      if (v.kind === 'without') return keep(inputs, `without:${v.unit}`, () => withoutUnits(inputFor(without(v.unit)), goneOf(v.unit)));
      return keep(inputs, `cover:${v.loss}:${v.reserve ?? '-'}`, () => {
        const p = without(v.loss);
        const l = coveredLineup(plan, v.loss, goneOf(v.loss), v.reserve);
        const q = l ? { ...p, roadmap: { ...p.roadmap, lineups: [...p.roadmap.lineups.filter((x) => x.key !== l.key), l] } } : p;
        return withoutUnits(inputFor(q), goneOf(v.loss));
      });
    };
    /** A unit's kit and classes as the plan has them, for whether it has any utility to read. */
    const utility = (u: RosterUnit): boolean => {
      const classes = [...plan.roadmap.seals.filter((s) => s.unit === u).map((s) => s.classId), ...plan.wishlist.units.filter((w) => w.unit === u).map((w) => w.classId)];
      const a = [...base.army, ...base.maps.flatMap((m) => [...m.joining, ...m.later])].find((x) => x.id === u);
      if (a) return hasUtility(a, classes);
      const c = base.maps.flatMap((m) => m.children ?? []).find((x) => x.id === u);
      return hasUtility({ classId: c?.startClass ?? (u in CHILD_UNITS ? CHILD_UNITS[u as ChildId].defaultClassSet[0]! : 'villager'), skills: [], ...(c?.items ? { items: c.items } : {}) }, classes);
    };
    return { base, recruited, goneOf, inputOf, utility, without };
  };
  /** Every map's lineup on a plan's roadmap: its own where it names one, else the greedy lineup its projection picks. */
  const lineupsOf =(run: Run, plan: Plan, seed: number, roleOf: ((u: RosterUnit) => DeploymentRole) | undefined): PlanLineup[] => {
    const input = planInput(run, plan, roleOf);
    const lineups = planLineups(input, seed, assumptions);
    return input.maps.map((m, i) => ({ key: m.key, pairs: lineups[i]!.pairs.map((p) => ({ lead: p.lead, ...(p.back ? { back: p.back } : {}) })), solo: [...lineups[i]!.solo] }));
  };

  /**
   * The seed for a run, kept while the run lives (a run is replaced, never edited): it takes 0.3–1.2 s since #199 fixes
   * its non-starters. Without roles only (the roles are a function).
   */
  /**
   * A run with pins added (#200), or taken off, kept per run and pins: the solve's caches (the seed, each plan's input)
   * are kept per run, so each step must get the same one.
   */
  const derived = new WeakMap<Run, Map<string, Run>>();
  const derive = (run: Run, key: string, make: () => Run): Run => {
    let held = derived.get(run);
    if (!held) derived.set(run, (held = new Map()));
    let r = held.get(key);
    if (!r) held.set(key, (r = make()));
    return r;
  };
  /** The run with pins given besides its own (the Plan page's, until #205): the run itself when it holds them all. */
  const pinnedRun = (run: Run, extra: readonly PlanPin[] | undefined): Run => {
    const has = new Set(runPins(run).map(pinKey));
    const more = (extra ?? []).filter((p) => !has.has(pinKey(p)));
    return more.length ? derive(run, `+${JSON.stringify(more)}`, () => more.reduce(withPin, run)) : run;
  };
  /** The run with pins lifted (all by default): the pin cost's second search. */
  const liftedRun = (run: Run, lift: readonly PlanPin[] | undefined): Run => derive(run, `-${lift ? JSON.stringify(lift.map(pinKey)) : '*'}`, () => withoutPins(run, lift));
  /** The pins that still hold on a run: its own, less recorded facts. */
  const livePinsOf = (run: Run): PlanPin[] => livePins(run, runPins(run), remainingMapOrder(run).steps.map((s) => s.key));
  const seeds = new WeakMap<Run, Map<string, Plan>>();
  const seedFor = (run: Run, options: SeedOptions): Plan => {
    if (options.roleOf) return seedPlan(run, seedContext(run), options);
    let held = seeds.get(run);
    if (!held) seeds.set(run, (held = new Map()));
    const k = JSON.stringify(options.pins ?? []);
    let plan = held.get(k);
    if (!plan) held.set(k, (plan = seedPlan(run, seedContext(run), options)));
    return plan;
  };

  const seedContext = (run: Run): SeedContext => {
    const context: PlayContext = run.roster.run.route ?? 'main-story';
    const settings: SkillViewSettings = { context, dlc: false };
    const cached = (k: string, f: () => BuildMatch | undefined) => (seedBuilds.has(k) ? seedBuilds.get(k) : (seedBuilds.set(k, f()), seedBuilds.get(k)));
    return {
      assumptions,
      result: (p) => byKey.get(pairingKey(p)),
      childBuild: (r) => {
        const input = skillInput(r);
        const k = `${r.pairing.child}|${context}|${r.startClass}|${input.reachable.join()}|${JSON.stringify(r.skillCandidates)}`;
        return cached(k, () => matchBuilds(skillReach(input, dlcOf(settings)), context)[0]);
      },
      unitBuild: (s) => cached(`${typeof s === 'string' ? s : `robin-${s.gender}`}|${context}`, () => matchBuilds(unitReach(s, dlcOf(settings)), context)[0]),
      rank: (id) => skillRank(id, context),
    };
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
  // The Plan view asks for the plan and the free re-plan under one roster and settings: share values.
  let lastPlan: { roster: Roster; settings: string; ctx: PlanContext } | undefined;
  const planContext = (roster: Roster, s: PlanSettings): PlanContext => {
    const k = JSON.stringify(s);
    if (lastPlan?.roster !== roster || lastPlan.settings !== k) lastPlan = { roster, settings: k, ctx: newPlanContext(roster, s, rolesFor(roster, s)) };
    return lastPlan.ctx;
  };
  // A saved plan's pairings on a roster with only the run facts, but each child in the roster's own plan preset: army
  // fit reads the whole roster (benches, deployment), so the run facts alone would put the children in other presets.
  // Its values don't depend on the saved plan, so every saved plan under one roster and settings shares them.
  let lastSaved: { roster: Roster; settings: string; ctx: PlanContext } | undefined;
  const savedPlanContext = (roster: Roster, s: PlanSettings): PlanContext => {
    const k = JSON.stringify(s);
    if (lastSaved?.roster !== roster || lastSaved.settings !== k)
      lastSaved = { roster, settings: k, ctx: newPlanContext({ ...EMPTY_ROSTER, run: roster.run }, s, rolesFor(roster, s)) };
    return lastSaved.ctx;
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
  /** A roster unit as a support unit: Robin by the gender the pair gives it. */
  const supportUnitOf = (u: RosterUnit, gender: Gender): SupportUnit => (u === 'robin' ? (gender === 'M' ? 'robin-m' : 'robin-f') : u);
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
        curve: pairCurve(supportUnitOf(self, gender), supportUnitOf(partner, opposite(gender)))!,
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
    childJoinStats: (input) => childJoinStats(input, assumptions),
    childSkills: (input) => childSkills(input, assumptions),
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
    mapOrder: remainingMapOrder,
    lunaticPlusPool: lunaticPlusPoolFor,
    chapterDisagreements: () => CHAPTER_DISAGREEMENTS,
    mapWaves: (id, difficulty) => {
      const k = `${id}|${difficulty}`;
      if (!wavesCache.has(k)) {
        const map = MAPS.find((m) => m.id === id);
        if (!map) throw new Error(`No chapter data for ${id}`);
        wavesCache.set(k, mapWaves(map, difficulty));
      }
      return wavesCache.get(k)!;
    },
    simMap: simMapById,
    playMap: (input, seed) => playMap(spreadIn(input), seed),
    mapNoDeath: (input, seed, runs = 1) => meanNoDeath(spreadIn(input), Array.from({ length: Math.max(1, runs) }, (_, i) => (i === 0 ? seed : runSeed(seed, i)))),
    staffReach: (unit, staff, spread = assumptions['army-spread']) => {
      const item = unit.items?.find((i) => i.item.name === staff)?.item ?? itemByName(staff);
      return item ? staffReach(unit, item, spread) : 0;
    },
    mapIncome: (map) => sureIncome(mapById(map)),
    mapUpkeep: (input, play) => mapUpkeep(input.map, play, input.lineup, null, assumptions['tome-miss-use']),
    blindSpots: () => BLIND_SPOTS,
    chapterGuide: (map) => {
      const entries = CHAPTER_GUIDE.filter((e) => e.map === map);
      const sources = [...new Set(entries.map((e) => e.source))];
      return sources.map((id) => ({ source: { id, name: SOURCES[id].name, link: SOURCES[id].link }, entries: entries.filter((e) => e.source === id) }));
    },
    mapGold: (map) => mapGold(mapById(map)),
    renownGain: (map) => renownGain(mapById(map), assumptions['paralogue-renown']),
    renownRewards,
    pageUnits: () => {
      const units = (Object.keys(FIRST_GEN_UNITS) as UnitId[]).filter((u): u is PageUnitId => u !== 'maiden');
      const spot = new Set<string>(SPOTPASS_UNITS);
      return [...units.filter((u) => !spot.has(u)), ...SPOTPASS_UNITS].map((id) => ({ id, name: FIRST_GEN_UNITS[id].name, spotPass: spot.has(id) }));
    },
    unitPage: (unit, settings) => unitPage(unit, settings.context, dlcOf(settings), parentedBy(unit)),
    partners: partnersFor,
    supportCurve: (a, b) => pairCurve(a, b, assumptions['support-past-threshold']),
    supportPairs: () => SUPPORT_PAIR_CURVES,
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
    evaluatePlan: (saved, roster, settings) => evaluatePlan(savedPlanContext(roster, settings), saved),
    planKeys: (roster) =>
      new Set(roster.savedPlan ? savedPairings(roster, roster.savedPlan).map(pairingKey).filter((k) => byKey.has(k)) : []),
    ledger: (roster, settings) => {
      const ctx = planContext(roster, settings);
      return childLedger(ctx, solvePlan(ctx), (p) => evaluateBlocking(p, roster, assumptions));
    },
    combatExp: (c) =>
      combatExp(c.internalLevel, c.foe, c.outcome, c.pair === 'back', c.difficulty === 'lunatic' || c.difficulty === 'lunatic-plus', c.engagement ?? 1, c.pair === 'front' && c.veteran ? 1.5 : 1),
    internalLevels: (run, entry) => internalLevels(run, assumptions['class-change-internal-level'], entry),
    classChangeProposals: (run) => classChangeProposals(run),
    shopping: (run, entry) => entryShopping(run, entry),
    sideGoals: (run) => sideGoalChoices(run.sideGoals),
    sideGoalsSecured: (run, entry) => sideGoalsSecured(run, entry),
    renown: (run) => renownAhead(run, remainingMapOrder(run).steps, assumptions['paralogue-renown']),
    flawlessChance: (run, options) => flawlessChance(run, assumptions, options),
    simulateRuns: (input, seed, runs) => simulateRuns(input, seed, runs, assumptions),
    ceiling: (run, options) => flawlessCeiling(run, assumptions, options),
    simulateCeiling: (input, seed, runs) => simulateCeiling(input, seed, runs, assumptions),
    seedPlan: (given, options = {}) => {
      const run = pinnedRun(given, options.pins);
      return seedFor(run, { ...options, pins: livePinsOf(run) });
    },
    endpointCoverage: (run, child, parents, robin) => endpointCoverage(run, seedContext(run), child, parents, robin),
    solveStep: (given) => {
      const { roleOf } = given;
      // The run's pins and those given, less recorded facts (#200): hard constraints on the seed, every edit and the runs.
      const run = pinnedRun(given.run, given.pins);
      const pins = livePinsOf(run);
      const ctx = seedContext(run);
      const options = { pins, ...(roleOf ? { roleOf } : {}) };
      const lunaticPlus = run.roster.run.difficulty === 'lunatic-plus';
      const pinnedKeys = new Set(pins.flatMap((p) => (p.kind === 'marriage' && !p.forbid ? [coupleKey(p.couple)] : [])));
      // An adopted plan from before a pin was set is made to keep it.
      const input = { ...given, run, ...(given.plan ? { plan: keptPins(run, ctx, options, given.plan) } : {}) };
      const forcedAt = (plan: Plan) => {
        let forced: Map<string, readonly RosterUnit[]> | undefined;
        return (key: string) => (forced ??= new Map(planInput(run, plan, roleOf).maps.map((m) => [m.key, m.forced]))).get(key) ?? [];
      };
      return solveStep(
        input,
        {
          brokenPins: (plan) => (pins.length ? brokenPins(plan, pins, forcedAt(plan)) : 0),
          seed: () => seedFor(run, options),
          edits: (plan, hints) => planEdits(run, ctx, options, plan, hints, (p) => lineupsOf(run, p, input.seed, roleOf)),
          samples: (plan, first, count) => simulateRuns(planInput(run, plan, roleOf), input.seed, count, assumptions, first).samples,
          rescore: (plan, seed, runs) => flawlessChance(run, assumptions, { plan, seed, runs, ...(roleOf ? { roleOf } : {}) }),
          // Lunatic+ plays the ceiling over a few skill draws; otherwise one play is the ceiling.
          ceiling: (plan) => flawlessCeiling(run, assumptions, { plan, seed: input.seed, runs: lunaticPlus ? CEILING_DRAWS : 1, ...(roleOf ? { roleOf } : {}) })?.chance,
          // A pinned couple's non-starter is the player's to lift: only the others count against a plan.
          nonStarters: (plan) => nonStarters(run, assumptions, plan).filter((c) => !pinnedKeys.has(coupleKey(c))),
          // What the simulation reads of a plan: its Robin, marriages, children's passes and its roadmap (not the builds).
          simKey: (plan) => JSON.stringify([plan.robin, plan.wishlist.marriages, plan.wishlist.children, plan.roadmap]),
        },
        input.display ?? FLAWLESS_RUNS,
      );
    },
    milestones: (run, plan) => milestones(run, plan, assumptions),
    itemPlan: (run, plan, options = {}) => itemPlanOf(runItemSources(run).sources, plan.roadmap.items, options.chance?.items, options.pins),
    beforeThisMap: (run, plan, map) => {
      const { steps, sources } = runItemSources(run);
      const key = steps.find((s) => s.map === map)?.key;
      return key ? beforeMapItems(sources, plan.roadmap.items, key) : [];
    },
    itemsUsed: (run, entry, plan) => {
      const i = run.entries.findIndex((e) => e.id === entry);
      const e = run.entries[i];
      if (!e) return { recorded: false, items: [] };
      if (e.itemsUsed) return { recorded: true, items: e.itemsUsed };
      if (!plan) return { recorded: false, items: [] };
      const before: Run = { ...run, entries: run.entries.slice(0, i) };
      const { steps, sources } = runItemSources(before);
      const key = steps.find((s) => s.map === e.map)?.key;
      return { recorded: false, items: key ? beforeMapItems(sources, plan.roadmap.items, key).map((b) => ({ item: b.item, unit: b.unit })) : [] };
    },
    editCost: (input) => editCost(input, (plan, first, count) => simulateRuns(planInput(input.run, plan, input.roleOf), input.seed, count, assumptions, first).samples),
    unitWorth: (input) => {
      const { run, plan, seed, roleOf, pins } = input;
      const v = worthVariants(run, plan, roleOf, pins);
      return worthStep(input, {
        subjects: () => {
          // Every unit in any of the plan's lineups, and its wishlist: those the plan fields (not a map's own setup).
          const units = new Set<RosterUnit>(plan.wishlist.units.map((w) => w.unit));
          for (const d of planLineups(v.base, seed, assumptions)) for (const u of d.deployed) units.add(u);
          const planned = new Set<RosterUnit>(plan.wishlist.children.map((c) => c.child));
          return [...units]
            .filter((u) => v.recruited.has(u) || planned.has(u))
            .map((u) => ({ unit: u, forced: FORCED_UNITS.includes(u), children: [...v.goneOf(u)].filter((x) => x !== u), utility: !FORCED_UNITS.includes(u) && v.utility(u) }));
        },
        samples: (variant, first, count) => simulateRuns(v.inputOf(variant), seed, count, assumptions, first).samples,
      });
    },
    worthPlan: (run, plan, unit, options = {}) => worthVariants(run, plan, options.roleOf, options.pins).without(unit),
    simulateWorth: (input, options) => {
      let held = handBuilt.get(input);
      if (!held) handBuilt.set(input, (held = new Map()));
      const kept = held;
      const recruits = [...input.army, ...input.maps.flatMap((m) => [...m.joining, ...m.later])];
      const children = input.maps.flatMap((m) => m.children ?? []);
      const goneOf = (u: RosterUnit) => new Set<RosterUnit>([u, ...children.filter((c) => c.parents.includes(u)).map((c) => c.id)]);
      const inputOf = (v: WorthVariant): RunSimInput => {
        if (v.kind === 'plan') return input;
        const k = JSON.stringify(v);
        let x = kept.get(k);
        if (!x) kept.set(k, (x = v.kind === 'idle' ? { ...input, idle: [v.unit] } : withoutUnits(input, goneOf(v.kind === 'without' ? v.unit : v.loss))));
        return x;
      };
      const ids = [...new Set<RosterUnit>([...recruits.map((a) => a.id), ...children.map((c) => c.id)])];
      return worthStep(options, {
        subjects: () =>
          ids.map((u) => {
            const c = children.find((x) => x.id === u);
            const a = recruits.find((x) => x.id === u) ?? (c && { classId: c.startClass ?? CHILD_UNITS[c.id as ChildId]?.defaultClassSet[0] ?? 'villager', skills: [], ...(c.items ? { items: c.items } : {}) });
            return { unit: u, forced: FORCED_UNITS.includes(u), children: [...goneOf(u)].filter((x) => x !== u), utility: !!a && !FORCED_UNITS.includes(u) && hasUtility(a) };
          }),
        samples: (variant, first, count) => simulateRuns(inputOf(variant), options.seed, count, assumptions, first).samples,
      });
    },
    reserves: (input) => {
      const { run, plan, seed, roleOf, pins } = input;
      const v = worthVariants(run, plan, roleOf, pins);
      const wishlist = plan.wishlist.units.map((w) => w.unit);
      return reservesStep(input, {
        losses: (runs) => simulateRuns(v.base, seed, runs, assumptions, 0).losses,
        wishlist,
        candidates: () => {
          const planned = plan.wishlist.children.map((c) => c.child).filter((c) => !v.recruited.has(c));
          return [...v.recruited, ...planned].filter((u) => !wishlist.includes(u) && !FORCED_UNITS.includes(u));
        },
        samples: (variant, first, count) => simulateRuns(v.inputOf(variant), seed, count, assumptions, first).samples,
      });
    },
    pins: (run, extra) => livePinsOf(pinnedRun(run, extra)),
    liftPins: (run, options = {}) => liftedRun(pinnedRun(run, options.pins), options.lift),
    pinCost: (input) => {
      const run = pinnedRun(input.run, input.pins);
      const lift = input.lift ? new Set(input.lift.map(pinKey)) : undefined;
      const lifting = livePinsOf(run).filter((p) => !lift || lift.has(pinKey(p)));
      // Recorded facts are never pins: nothing to lift, no cost.
      if (!lifting.length) return { pins: [], cost: 0, margin: 0, runs: 0, verdict: 'close', settled: true };
      const free = liftedRun(run, lifting);
      const samplesOn = (r: Run) => (plan: Plan, first: number, count: number) => simulateRuns(planInput(r, plan, input.roleOf), input.seed, count, assumptions, first).samples;
      const c = editCost({ ...input, edited: input.lifted }, samplesOn(run), samplesOn(free));
      return { pins: lifting, cost: c.gain, margin: c.margin, runs: c.runs, verdict: c.verdict, settled: c.settled };
    },
    roadmapLineups: (run, plan, options = {}) => lineupsOf(run, plan, options.seed ?? FLAWLESS_SEED, options.roleOf),
    expForecast: (run, plan, options) => expForecast(run, plan, assumptions, options),
    defaultPriorities: (run, plan) => defaultPriorities(milestones(run, plan, assumptions), flawlessInput(run, assumptions, undefined, undefined, plan).input),
    suggestedChanges: (run, plan, milestone, options) => suggestedChanges(run, plan, milestone, assumptions, options),
    suggestChanges: (input, milestone, seed, runs) => suggestChanges(input, milestone, seed, runs, assumptions),
    readings: (run, plan, options = {}) => {
      const { forecast, suggestions: _s, worth: _w, stats: _t, ...sim } = options;
      const f = forecast ?? expForecast(run, plan, assumptions, sim);
      return readings(run, plan, milestones(run, plan, assumptions), f, assumptions, options);
    },
    recordedStats: (run, options) => recordedStats(run, assumptions, options),
  };
}
