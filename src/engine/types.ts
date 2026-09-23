import type { ChildId } from '../game-data/children';
import type { Gender, Growths, Modifiers, Stat } from '../game-data/stats';
import type { UnitId } from '../game-data/units';
import type { Citation } from '../game-data/citations';
import type { AssumptionId } from './assumptions';

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
