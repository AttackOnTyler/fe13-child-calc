import type { ChildId } from '../game-data/children';
import type { ClassId, ClassTier } from '../game-data/classes';
import type { Gender, Growths, Modifiers, Stat } from '../game-data/stats';
import type { UnitId } from '../game-data/units';
import type { SkillId } from '../game-data/skills';
import type { Citation } from '../game-data/citations';
import type { AssumptionId } from './assumptions';
import type { PresetData, PresetId, ScoringRole, Weights } from '../curated/presets';
import type { BuildContext, Confidence } from '../curated/builds';
import type { Blocking, Roster, RunFacts } from './roster';
import type { ChildDeploymentRole, Quotas } from '../curated/deployment';

export type RobinRef = { readonly kind: 'robin'; readonly gender: Gender; readonly asset: Stat; readonly flaw: Stat };

/** A parent: a first-gen unit, Robin with an asset/flaw, or a child (with its own variable parent) marrying Robin. */
export type ParentRef =
  | { readonly kind: 'unit'; readonly id: UnitId }
  | RobinRef
  | { readonly kind: 'child'; readonly id: ChildId; readonly variableParent: ParentRef };

export type Pairing = {
  readonly child: ChildId;
  readonly variableParent: ParentRef;
  /** Morgan's fixed parent, Robin, whose asset/flaw is part of the pairing. Absent for every other child. */
  readonly fixedRobin?: RobinRef;
};

/** The thin per-pairing result computed eagerly for every pairing. */
export type ChildResult = {
  readonly pairing: Pairing;
  /** Stable, unique string key, e.g. `lucina|sumia`, `kjelle|robin:spd/def`, `morgan-f|robin:spd/hp|lucina<olivia`. */
  readonly key: string;
  /** Inherited personal growths, before any class growth. */
  readonly growths: Growths;
  readonly modifiers: Modifiers;
  /** Base classes the child can Second Seal into; promotions and DLC reclass targets follow from them. */
  readonly classSet: readonly ClassId[];
  /** The class the child joins in (Morgan's depends on the other parent). */
  readonly startClass: ClassId;
  /** What each parent can pass: one skill per parent (research/skill-inheritance, #4). */
  readonly skillCandidates: ChildSkillCandidates;
  readonly assumptionsUsed: readonly AssumptionId[];
};

/**
 * The skills one parent can pass. A pool means any of them, as the parent's lowest equipped inheritable skill;
 * `fixed` means the one skill always passes (Chrom and his children, Aversa, Walhart).
 */
export type SkillCandidates = { readonly skills: readonly SkillId[]; readonly fixed: boolean };

/** What the fixed and the variable parent can each pass. */
export type ChildSkillCandidates = { readonly fromFixed: SkillCandidates; readonly fromVariable: SkillCandidates };

/** A child's pairings that share a variable parent, differing only in Robin's asset/flaw. One table group row. */
export type PairingGroup = {
  /** Stable, unique within the child. */
  readonly key: string;
  /** e.g. `Sumia`, `Robin (F)`, `Lucina ← Sumia`. */
  readonly label: string;
  /** One result, or one per Robin asset/flaw (56). */
  readonly results: readonly ChildResult[];
};

export type ChildSummary = {
  readonly id: ChildId;
  readonly name: string;
  readonly gender: Gender;
  readonly fixedParentName: string;
  readonly pairingCount: number;
};

export type SelfTestCase = {
  readonly id: string;
  readonly label: string;
  readonly passed: boolean;
  /** Human-readable differences, e.g. `Lck modifier: expected +5, got +3`. */
  readonly mismatches: readonly string[];
};

export type SelfTestReport = { readonly passed: boolean; readonly cases: readonly SelfTestCase[] };

/** An assumption as the validation panel shows it. */
export type AssumptionStatus = {
  readonly id: AssumptionId;
  readonly label: string;
  readonly why: string;
  readonly sources: readonly Citation[];
  /** The resolved value and the default, formatted for display. */
  readonly current: string;
  readonly default: string;
  readonly isDefault: boolean;
  /** How many pairings list this assumption in `assumptionsUsed`. */
  readonly pairingsAffected: number;
  /** What it feeds instead, for an assumption that feeds settings rather than pairing results. */
  readonly affects: string | undefined;
};

/** A class as the class selector lists it. */
export type ClassSummary = {
  readonly id: ClassId;
  /** Both names for a class named by gender, e.g. `Priest/Cleric`. */
  readonly name: string;
  readonly tier: ClassTier;
  readonly dlc: boolean;
  readonly genderLock: Gender | undefined;
};

/** A curated preset as the preset select lists it. */
export type Preset = PresetData & { readonly id: PresetId };

/** What a score measures per stat: effective caps with Limit Breaker, without it, or growth in class. */
export type ScoreBasis = 'caps-lb' | 'caps' | 'growths';

/** Auto (the best final-tier class per row) or one pinned class. */
export type ClassMode = 'auto' | ClassId;

/** What the player is building for; one global selection. */
export type PlayContext = 'apotheosis' | 'main-story' | 'full-route' | 'all';

export type SupportRank = 'none' | 'C' | 'B' | 'A' | 'S';

/** Speed inputs: the buffs added to the Spd cap, and the Spd curve's target breakpoint and margin. */
export type SpeedSettings = {
  /** Rally Spd: 0, +4, +8 or +10. */
  readonly rally: number;
  /** Speed Tonic, +2. */
  readonly tonic: boolean;
  /** Pair-up Spd, 0–10. */
  readonly pairUp: number;
  /** The target breakpoint, or null for none (Spd scores linearly). */
  readonly target: number | null;
  /** Speed margin above the target that still scores at the to-target weight. */
  readonly margin: number;
};

/** A Speed total and the highest breakpoint it clears. */
export type SpeedReading = {
  readonly total: number;
  /** Undefined when the total is below every breakpoint. */
  readonly cleared: number | undefined;
  /** How far the total is over the breakpoint it clears (total − cleared); not the Speed margin setting. */
  readonly over: number | undefined;
};

export type ScoreSettings = {
  /** Per-point weights; null for Rallybot / Dancer, which gets no score. */
  readonly weights: Weights | null;
  readonly mixed: boolean;
  readonly basis: ScoreBasis;
  readonly classMode: ClassMode;
  /** DLC classes are Auto candidates. */
  readonly dlc: boolean;
  readonly speed: SpeedSettings;
  /** Lead scores the unit's own stats; Support scores the pair-up bonus it gives a lead (never on Growths). */
  readonly role: ScoringRole;
  /** The support rank the pair-up bonus assumes (Support role). */
  readonly supportRank: SupportRank;
};

/** The marriage plan's scoring inputs: each child scores in its plan preset, in Auto class, with the global rest. */
export type PlanSettings = {
  readonly context: PlayContext;
  /** The global preset: the plan preset of a child out of the cast (Morgan before Robin is set) without an override. */
  readonly preset: PresetId;
  /** The user's preset edits, which apply wherever a preset is used. */
  readonly edits: Readonly<Partial<Record<PresetId, { readonly weights: Weights; readonly mixed: boolean }>>>;
  /** The global basis; a Support-role plan preset scores on Caps+LB when it is Growths. */
  readonly basis: ScoreBasis;
  /** DLC classes are Auto candidates. */
  readonly dlc: boolean;
  readonly speed: SpeedSettings;
  readonly supportRank: SupportRank;
  /** 0–3 per child; 1 when unset. */
  readonly priorities: Readonly<Partial<Record<ChildId, number>>>;
  /** Preset overrides: a preset the user pinned, niche ones included; its deployment role comes with it. */
  readonly overrides: Readonly<Partial<Record<ChildId, PresetId>>>;
  /** Role overrides: a deployment role the user pinned; the role preset inside it stays derived. */
  readonly roleOverrides: Readonly<Partial<Record<ChildId, ChildDeploymentRole>>>;
  /** The play context's composition quotas, which army fit meets. */
  readonly quotas: Quotas;
  /**
   * The no-Robin view (#98): Robin is removed as a parent from every pool, Morgan leaves the cast and Robin isn't counted
   * as deployed; standing, role presets, army fit and the plan rerun under it. Pairing tables are unchanged.
   */
  readonly noRobin?: boolean;
};

export type PairingScore = {
  readonly key: string;
  /** The class scored in; undefined when the child can't reach the pinned class. */
  readonly class: ClassId | undefined;
  /** Auto chose the class. */
  readonly auto: boolean;
  /**
   * Per-stat values in that class: effective caps or growth in class (Lead), or the pair-up bonus from those caps
   * (Support, with HP 0).
   */
  readonly values: Readonly<Record<Stat, number>> | undefined;
  /**
   * Spd effective cap (with Limit Breaker unless the basis is Caps) + Rally + Tonic + Pair-up, against the
   * breakpoints; undefined when unreachable, and in the Support role (the Spd pair-up bonus is `values.spd`).
   */
  readonly speed: SpeedReading | undefined;
  /**
   * Σ weight × stat points, Spd through the Spd curve (Lead) or linear at the to-target weight (Support); undefined
   * when unreachable or without weights.
   */
  readonly raw: number | undefined;
  /** Raw min-max scaled over every pairing to 0–100, unrounded. */
  readonly scaled: number | undefined;
  /** `scaled`, rounded. */
  readonly score: number | undefined;
  /** Under Mixed, which attack stat was scored. */
  readonly attack?: 'S' | 'M';
};

/** Every pairing's score under one set of settings. */
export type Scoring = {
  get(key: string): PairingScore;
  /** The child's highest-scoring pairing, or undefined if none has a score. */
  best(child: ChildId): PairingScore | undefined;
  /** A group's highest-scoring pairing (the first on ties or without scores) and its score range. */
  groupBest(group: PairingGroup): GroupBest;
  /** A Robin group's asset × flaw heatmap; undefined for a group of one pairing. */
  heatmap(group: PairingGroup): Heatmap | undefined;
  /** Every child's pairings ranked together, Robin groups shown as the Robin mode says. */
  leaderboard(options: LeaderboardOptions): readonly LeaderboardEntry[];
  /** Stats that carry weight under these settings (under Mixed, Str and Mag share the attack weight). */
  readonly weightedStats: readonly Stat[];
};

/** How a Robin group shows on the leaderboard: every asset/flaw, its best one, or one picked combo. */
export type RobinMode = 'all' | 'best' | { readonly asset: Stat; readonly flaw: Stat };

export type LeaderboardOptions = {
  readonly robin: RobinMode;
  /** Score, or Speed (the Spd pair-up bonus in the Support role); ties go to the higher score. */
  readonly sort: 'score' | 'speed';
  /** The table filter, applied to every child; never changes a score. */
  readonly filter?: PairingFilter;
  /** Marks each entry's blocking and sorts hard-blocked entries last; never changes a score. */
  readonly roster?: Roster;
  /** Leave out hard-blocked entries (with a roster). */
  readonly hideBlocked?: boolean;
};

export type LeaderboardEntry = {
  /** 1-based position. */
  readonly rank: number;
  readonly result: ChildResult;
  readonly score: PairingScore;
  /** The child's name, e.g. `Morgan (F)`. */
  readonly child: string;
  readonly gender: Gender;
  /** The variable parent's group label, e.g. `Sumia`, `Robin (F)`, `Lucina ← Sumia`. */
  readonly parent: string;
  /** Robin's asset/flaw, e.g. `+Spd −Def`, when Robin is a parent. */
  readonly robin: string | undefined;
  /** How the roster blocks it, when the options carry a roster. */
  readonly blocking?: Blocking;
};

/** One asset/flaw of a Robin group: a variable Robin parent's, or the fixed Robin's for a Morgan partner group. */
export type HeatCell = {
  readonly asset: Stat;
  readonly flaw: Stat;
  /** e.g. `+Spd −Def`. */
  readonly label: string;
  readonly key: string;
  /** The pairing's score, unrounded. */
  readonly scaled: number | undefined;
  /** Where `scaled` sits in the group's own spread, 0 (worst) to 1 (best); 1 when every combo scores the same. */
  readonly position: number | undefined;
};

export type Heatmap = {
  /** 8 assets × 7 flaws, asset-major in stat order. */
  readonly cells: readonly HeatCell[];
  /** The group's best pairing's cell (as `groupBest`). */
  readonly best: HeatCell;
  /** Lowest and highest unrounded score in the group; undefined when nothing in it has a score. */
  readonly spread: { readonly lo: number; readonly hi: number } | undefined;
};

export type GroupBest = {
  readonly best: ChildResult;
  /** Lowest and highest score in the group; undefined when nothing in it has a score. */
  readonly range: { readonly lo: number; readonly hi: number } | undefined;
};

/** Narrows a child's table; never changes a score. */
export type PairingFilter = {
  /** Case-insensitive substring of the variable parent's label. */
  readonly parent?: string;
  /** Include second-gen partners (Morgan's `Lucina ← Sumia` rows). Default true. */
  readonly secondGen?: boolean;
  /** Run facts: pairings with the other Robin, or another of Robin's asset/flaws, are left out of their groups. */
  readonly run?: RunFacts;
};

/** A skill with its curated rank in the current play context (1–5 = D–S, 0 unranked). */
export type SkillRef = { readonly id: SkillId; readonly name: string; readonly rank: number };

/** One way a pairing gets a skill. */
export type SkillSource =
  | {
      readonly kind: 'class';
      readonly class: ClassId;
      readonly className: string;
      readonly level: number;
      /** Outside the starting class line (⟳). */
      readonly reclass: boolean;
      readonly dlc: boolean;
    }
  | { readonly kind: 'parent'; readonly side: 'fixed' | 'variable'; readonly parent: string; readonly fixed: boolean }
  /** A DLC skill book (◇), when DLC is reachable. */
  | { readonly kind: 'book' };

export type RallyCoverage = {
  readonly skill: SkillRef;
  /** Best first; empty when the pairing can't get it. */
  readonly sources: readonly SkillSource[];
  /** Why not, when there is no source. */
  readonly reason: string | undefined;
};

export type ParentSkills = {
  readonly side: 'fixed' | 'variable';
  readonly parent: string;
  readonly fixed: boolean;
  /** `unique`: no class the child can reach teaches it, and the other parent can't pass it. */
  readonly skills: readonly (SkillRef & { readonly unique: boolean })[];
  /** How the skill passes, worded by the inheritance assumptions. */
  readonly note: string;
};

export type RankedSkill = SkillRef & { readonly sources: readonly SkillSource[] };

/** The Skills drawer's facts for one pairing under a play context and DLC state. */
export type SkillView = {
  readonly child: string;
  readonly fixedParent: string;
  readonly variableParent: string;
  readonly startClass: string;
  readonly classCount: number;
  readonly context: PlayContext;
  readonly dlc: boolean;
  /** The ten rallies, in dot order. */
  readonly rallies: readonly RallyCoverage[];
  /** Fixed parent, then variable parent. */
  readonly parents: readonly [ParentSkills, ParentSkills];
  /** Edge cases that apply to this pairing, worded by the inheritance assumptions. */
  readonly caveats: readonly string[];
  /** Class-learned skills by rank, S → D, then unranked; only non-empty buckets. */
  readonly ranks: readonly { readonly rank: number; readonly letter: string; readonly skills: readonly RankedSkill[] }[];
  /** DLC skill books (◇), when DLC is reachable. */
  readonly books: readonly SkillRef[];
};

/** A curated build template as the drawer and the template filter list it. */
export type BuildTemplateSummary = {
  readonly id: string;
  readonly name: string;
  /** The preset its role maps to. */
  readonly preset: PresetId;
  /** That preset's name, e.g. `Physical lead`. */
  readonly presetName: string;
  readonly contexts: readonly BuildContext[];
  /** The research sources it rests on, e.g. `S3, S4`. */
  readonly source: string;
  readonly confidence: Confidence;
};

/** One slot of a matched build: the skill that fills it and how, or why nothing can. */
export type BuildSlotMatch = {
  /** The slot's skill, or its preference group, first preferred. */
  readonly options: readonly SkillRef[];
  readonly skill: SkillRef | undefined;
  /** Index of `skill` in `options`. */
  readonly preference: number | undefined;
  /** The one source the build uses for it: the lowest-effort class, a parent's pick, the fixed skill or a book. */
  readonly source: SkillSource | undefined;
  /** Why the slot stays empty. */
  readonly reason: string | undefined;
};

/** A build template matched against one pairing's reachable skills. */
export type BuildMatch = {
  readonly template: BuildTemplateSummary;
  /** Filled slots, 0–5; the drawer shows 3/5 and up. */
  readonly tier: number;
  /** Sum of the filled skills' ranks in the play context. */
  readonly quality: number;
  /** Sum of the filled slots' preference indexes (0 = every first preference). */
  readonly preferenceMisses: number;
  /** Distinct classes outside the starting class line the build's class skills need. */
  readonly reclassCost: number;
  /** Those classes, by name, in slot order. */
  readonly reclassClasses: readonly string[];
  readonly slots: readonly BuildSlotMatch[];
  /** `A + B: why`, for synergy edges between filled skills. */
  readonly synergies: readonly string[];
};

/** A synergy or conflict partner on the Skill card, and whether this pairing can reach it. */
export type SkillCardEdge = {
  readonly skill: SkillRef;
  readonly reachable: boolean;
  /** The edge's one-line reason. */
  readonly note: string;
  /** Why the partner is out of reach. */
  readonly reason: string | undefined;
  /** Both skills hang on one parent's single pick (e.g. `Sumia`), so the pairing can't have both. */
  readonly oneParent: string | undefined;
};

/** Everything the Skill card shows about one skill for one pairing. */
export type SkillCard = {
  readonly id: SkillId;
  readonly name: string;
  readonly description: string;
  /** Activation rate, e.g. `Skl %`; absent for an always-on skill. */
  readonly rate: string | undefined;
  readonly dlc: boolean;
  /** A Rally command (its `rate` is `Command`). */
  readonly rally: boolean;
  /** Its curated rank in each play context, the current one marked. */
  readonly ranks: readonly { readonly context: PlayContext; readonly rank: number; readonly letter: string; readonly current: boolean }[];
  /** Every way this pairing gets it, best first; empty when unreachable. */
  readonly sources: readonly SkillSource[];
  /** Why this pairing can't get it. */
  readonly reason: string | undefined;
  /** Whether any parent can ever pass it, and how. */
  readonly inheritance: { readonly inheritable: boolean; readonly note: string };
  readonly synergies: readonly SkillCardEdge[];
  readonly conflicts: readonly SkillCardEdge[];
  /** This pairing's shown builds (3/5 and up) that fill a slot with it; `slot` is 1-based. */
  readonly builds: readonly { readonly id: string; readonly name: string; readonly tier: number; readonly slot: number }[];
};
