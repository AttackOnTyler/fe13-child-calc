/**
 * The engine facade: the only seam between the pure model and the UI (and the only thing tests drive).
 * No DOM in here or anything it imports.
 */
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { ASSET_FLAW, ROBIN_GROWTHS, ROBIN_MODIFIERS } from '../game-data/robin';
import { MOD_STATS, STATS, STAT_LABELS, type Gender } from '../game-data/stats';
import { CHROM_FALLBACK_PARTNER, ROBIN_SUPPORTS, S_SUPPORTS } from '../game-data/supports';
import { FIRST_GEN_UNITS, type FirstGenUnitData, type UnitId } from '../game-data/units';
import { DEFAULT_ASSUMPTIONS, type AssumptionId, type Assumptions } from './assumptions';
import { INHERITANCE_FIXTURES } from './fixtures';
import { inheritGrowths, inheritModifiers, type ParentProfile } from './inheritance';
import { runSelfTest } from './self-test';
import type { ChildResult, ChildSummary, Pairing, PairingGroup, ParentRef, RobinRef, SelfTestReport } from './types';

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
  /** A child's pairings grouped by variable parent (Robin's 56 asset/flaw pairings form one group), in table order. */
  groups(child: ChildId): readonly PairingGroup[];
  result(key: string): ChildResult | undefined;
  /** e.g. `Sumia`, `Robin (F) +Spd −Def`, `Lucina ← Sumia`. */
  parentName(ref: ParentRef): string;
  /** Robin's asset/flaw in a pairing, e.g. `+Spd −Def`, or undefined if Robin isn't a parent. */
  robinLabel(pairing: Pairing): string | undefined;
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
  if (unit.growths) return { profile: { growths: unit.growths, modifiers: unit.modifiers, secondGen: false }, assumptionsUsed: [] };
  if (id !== 'maiden') throw new Error(`No growths and no assumption for ${id}`);
  return {
    profile: { growths: assumptions.maidenGrowths, modifiers: unit.modifiers, secondGen: false },
    assumptionsUsed: ['maiden-growths'],
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
  return { profile: { growths, modifiers, secondGen: false }, assumptionsUsed: [] };
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
        return { profile: { growths: r.growths, modifiers: r.modifiers, secondGen: true }, assumptionsUsed: r.assumptionsUsed };
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
    return {
      pairing,
      key: pairingKey(pairing),
      growths: inheritGrowths(fixed.profile, variable.profile, child.growths),
      modifiers: inheritModifiers(fixed.profile, variable.profile),
      assumptionsUsed: [...new Set([...fixed.assumptionsUsed, ...variable.assumptionsUsed])],
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
    groups: (child) => groupsByChild.get(child) ?? [],
    result,
    parentName,
    robinLabel: (pairing) => {
      const ref = pairing.fixedRobin ?? (pairing.variableParent.kind === 'robin' ? pairing.variableParent : undefined);
      return ref && assetFlawLabel(ref);
    },
    selfTest: () => runSelfTest(INHERITANCE_FIXTURES, result),
  };
}
