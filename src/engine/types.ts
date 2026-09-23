import type { ChildId } from '../game-data/children';
import type { Gender, Growths, Modifiers } from '../game-data/stats';
import type { UnitId } from '../game-data/units';
import type { AssumptionId } from './assumptions';

/** A parent reference. Robin (with asset/flaw) and second-gen parents join this union with Robin pairings. */
export type ParentRef = { readonly kind: 'unit'; readonly id: UnitId };

export type Pairing = { readonly child: ChildId; readonly variableParent: ParentRef };

/** The thin per-pairing result computed eagerly for every pairing. */
export type ChildResult = {
  readonly pairing: Pairing;
  /** Stable, unique string key, e.g. `lucina|sumia`. */
  readonly key: string;
  /** Inherited personal growths, before any class growth. */
  readonly growths: Growths;
  readonly modifiers: Modifiers;
  readonly assumptionsUsed: readonly AssumptionId[];
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
