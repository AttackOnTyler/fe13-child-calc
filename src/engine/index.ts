/**
 * The engine facade: the only seam between the pure model and the UI (and the only thing tests drive).
 * No DOM in here or anything it imports.
 */
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { CHROM_FALLBACK_PARTNER, S_SUPPORTS } from '../game-data/supports';
import { FIRST_GEN_UNITS, type FirstGenUnitData, type UnitId } from '../game-data/units';
import { DEFAULT_ASSUMPTIONS, type AssumptionId, type Assumptions } from './assumptions';
import { INHERITANCE_FIXTURES } from './fixtures';
import { inheritGrowths, inheritModifiers, type ParentProfile } from './inheritance';
import { runSelfTest } from './self-test';
import type { ChildResult, ChildSummary, Pairing, ParentRef, SelfTestReport } from './types';

export type * from './types';
export { ASSUMPTION_NOTES, DEFAULT_ASSUMPTIONS, type AssumptionId, type Assumptions } from './assumptions';
// Stat vocabulary, re-exported so the UI only talks to the engine.
export { MOD_STATS, STATS, STAT_LABELS, type ModStat, type Stat } from '../game-data/stats';
export type { ChildId } from '../game-data/children';

export type Engine = {
  /** Every child unit, in game-data order. */
  children(): readonly ChildSummary[];
  /** Every enumerated pairing's result, optionally for one child. */
  pairings(child?: ChildId): readonly ChildResult[];
  result(key: string): ChildResult | undefined;
  parentName(ref: ParentRef): string;
  /** Runs the sourced fixtures against this engine. */
  selfTest(): SelfTestReport;
};

const CHILD_IDS = Object.keys(CHILD_UNITS) as ChildId[];
const UNIT_IDS = Object.keys(FIRST_GEN_UNITS) as UnitId[];

/** Everyone a first-gen unit can S-support, excluding Robin. */
function partnersOf(id: UnitId): UnitId[] {
  const herPartners = S_SUPPORTS[id];
  if (herPartners) return [...herPartners];
  return UNIT_IDS.filter((w) => S_SUPPORTS[w]?.includes(id));
}

/** Variable parents of a child, in S-support list order. Robin pairings are not enumerated yet. */
function variableParentsOf(child: ChildId): UnitId[] {
  const fixed = CHILD_UNITS[child].fixedParent;
  if (fixed === 'robin') return [];
  const partners = partnersOf(fixed);
  return fixed === 'chrom' ? [...partners, CHROM_FALLBACK_PARTNER] : partners;
}

function pairingKey(p: Pairing): string {
  return `${p.child}|${p.variableParent.id}`;
}

/** A parent profile plus the assumptions it rests on. */
type ResolvedParent = { readonly profile: ParentProfile; readonly assumptionsUsed: readonly AssumptionId[] };

function unitProfile(id: UnitId, assumptions: Assumptions): ResolvedParent {
  const unit: FirstGenUnitData = FIRST_GEN_UNITS[id];
  if (unit.growths) return { profile: { growths: unit.growths, modifiers: unit.modifiers }, assumptionsUsed: [] };
  if (id !== 'maiden') throw new Error(`No growths and no assumption for ${id}`);
  return { profile: { growths: assumptions.maidenGrowths, modifiers: unit.modifiers }, assumptionsUsed: ['maiden-growths'] };
}

export function createEngine(assumptions: Assumptions = DEFAULT_ASSUMPTIONS): Engine {
  const profiles = new Map<UnitId, ResolvedParent>();
  const profileOf = (id: UnitId) => {
    let p = profiles.get(id);
    if (!p) profiles.set(id, (p = unitProfile(id, assumptions)));
    return p;
  };

  const computeResult = (pairing: Pairing): ChildResult => {
    const child = CHILD_UNITS[pairing.child];
    if (child.fixedParent === 'robin') throw new Error(`Robin pairings are not supported yet: ${pairing.child}`);
    const fixed = profileOf(child.fixedParent);
    const variable = profileOf(pairing.variableParent.id);
    return {
      pairing,
      key: pairingKey(pairing),
      growths: inheritGrowths(fixed.profile, variable.profile, child.growths),
      modifiers: inheritModifiers(fixed.profile, variable.profile),
      assumptionsUsed: [...fixed.assumptionsUsed, ...variable.assumptionsUsed],
    };
  };

  const byChild = new Map<ChildId, ChildResult[]>();
  const byKey = new Map<string, ChildResult>();
  for (const child of CHILD_IDS) {
    const results = variableParentsOf(child).map((id) => computeResult({ child, variableParent: { kind: 'unit', id } }));
    byChild.set(child, results);
    for (const r of results) byKey.set(r.key, r);
  }
  const all = [...byKey.values()];

  const parentName = (ref: ParentRef) => FIRST_GEN_UNITS[ref.id].name;
  const result = (key: string) => byKey.get(key);

  return {
    children: () =>
      CHILD_IDS.map((id) => {
        const c = CHILD_UNITS[id];
        return {
          id,
          name: c.name,
          gender: c.gender,
          fixedParentName: c.fixedParent === 'robin' ? 'Robin' : FIRST_GEN_UNITS[c.fixedParent].name,
          pairingCount: byChild.get(id)?.length ?? 0,
        };
      }),
    pairings: (child) => (child ? (byChild.get(child) ?? []) : all),
    result,
    parentName,
    selfTest: () => runSelfTest(INHERITANCE_FIXTURES, result),
  };
}
