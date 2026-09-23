import type { ChildId } from '../game-data/children';
import type { ClassId, ClassTier } from '../game-data/classes';
import type { Gender, Growths, Modifiers, Stat } from '../game-data/stats';
import type { UnitId } from '../game-data/units';
import type { Citation } from '../game-data/citations';
import type { AssumptionId } from './assumptions';
import type { PresetData, PresetId, Weights } from '../curated/presets';

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
  readonly assumptionsUsed: readonly AssumptionId[];
};

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

export type ScoreSettings = {
  /** Per-point weights; null for Rallybot / Dancer, which gets no score. */
  readonly weights: Weights | null;
  readonly mixed: boolean;
  readonly basis: ScoreBasis;
  readonly classMode: ClassMode;
  /** DLC classes are Auto candidates. */
  readonly dlc: boolean;
};

export type PairingScore = {
  readonly key: string;
  /** The class scored in; undefined when the child can't reach the pinned class. */
  readonly class: ClassId | undefined;
  /** Auto chose the class. */
  readonly auto: boolean;
  /** Per-stat values in that class under the basis: effective caps, or growth in class. */
  readonly values: Readonly<Record<Stat, number>> | undefined;
  /** Σ weight × stat points; undefined when unreachable or without weights. */
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
  /** Stats that carry weight under these settings (under Mixed, Str and Mag share the attack weight). */
  readonly weightedStats: readonly Stat[];
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
};
