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
import { createScorer } from './scoring';
import { contextReachesDlc, defaultTargetBreakpoint, pairUpSpd } from './speed';
import { runSelfTest } from './self-test';
import { PRESETS, type PresetId } from '../curated/presets';
import type {
  AssumptionStatus,
  ClassSummary,
  ChildResult,
  ChildSummary,
  Pairing,
  PairingFilter,
  PlayContext,
  PairingGroup,
  PairingScore,
  ParentRef,
  Preset,
  RobinRef,
  Scoring,
  ScoreSettings,
  SelfTestReport,
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
export type { PresetId, ScoringRole, Weights } from '../curated/presets';

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
  /** The Speed breakpoints, ascending (an assumption). */
  breakpoints(): readonly number[];
  /** The play context's default target breakpoint, and the assumption it rests on, if any. */
  defaultTargetBreakpoint(context: PlayContext): { readonly value: number; readonly assumption: AssumptionId | undefined };
  /** Whether DLC classes are reachable in a play context (they are Auto candidates there). */
  contextReachesDlc(context: PlayContext): boolean;
  /** The Spd part of the Pair-up bonus from a support in this class, at this rank, with this raw Spd. */
  pairUpSpd(supportClass: ClassId, rank: SupportRank, rawSpd: number): number;
};

/** Stats with a non-zero weight; under Mixed, Str and Mag are both scored at the attack weight. */
function weightedStats({ weights, mixed }: ScoreSettings): Stat[] {
  if (!weights) return [];
  const attack = Math.max(weights.str, weights.mag);
  return STATS.filter((s) => (mixed && (s === 'str' || s === 'mag') ? attack : weights[s]) > 0);
}

const PRESET_LIST: readonly Preset[] = (Object.keys(PRESETS) as PresetId[]).map((id) => ({ id, ...PRESETS[id] }));

/** Whether a group passes the table filter. Second-gen groups are Morgan's `Child ← Parent` partners. */
function passes(group: PairingGroup, filter: PairingFilter): boolean {
  const q = filter.parent?.trim().toLowerCase();
  if (q && !group.label.toLowerCase().includes(q)) return false;
  if (filter.secondGen === false && group.results[0]?.pairing.variableParent.kind === 'child') return false;
  return true;
}

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
  const classes = { classes: unit.classes, passesClasses: unit.passesClasses, baseClass: unit.classes[0] ?? null };
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
        const profile: ParentProfile = {
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

  /** Built on first use: rows prepared once, rescored per settings. */
  let scorer: ReturnType<typeof createScorer> | undefined;

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
    groups: (child, filter) => {
      const groups = groupsByChild.get(child) ?? [];
      return filter ? groups.filter((g) => passes(g, filter)) : groups;
    },
    result,
    parentName,
    robinLabel: (pairing) => {
      const ref = pairing.fixedRobin ?? (pairing.variableParent.kind === 'robin' ? pairing.variableParent : undefined);
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
      scorer ??= createScorer({
        results: all,
        genderOf,
        reachOf,
        classMaxStats,
        classGrowths: (id, g) => classGrowths(id, g, assumptions),
        breakpoints: assumptions['spd-breakpoints'],
      });
      const scores = scorer(settings);
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
        groupBest: (group) => {
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
        },
        weightedStats: weightedStats(settings),
      };
    },
    breakpoints: () => assumptions['spd-breakpoints'],
    defaultTargetBreakpoint: (context) => defaultTargetBreakpoint(context, assumptions),
    contextReachesDlc,
    pairUpSpd,
  };
}
