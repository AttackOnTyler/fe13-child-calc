/**
 * The marriage plan: one spouse per unit for the whole roster, chosen to maximise Σ priority × score over the children
 * the marriages produce (#16, #18). Married pairs and pins are fixed, lost pins (broken or on hold) are dropped, freeing
 * the partner, and rule-outs are never planned. The rest is max-weight bipartite matching (Hungarian algorithm), searched over Robin's
 * gender and asset/flaw while the run facts leave them open, and over Robin's partner when it is a child: Morgan's
 * value then rides on the marriage that produces that child. Pure: roster and a child valuation in, plan out.
 */
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { FIRST_GEN_UNITS } from '../game-data/units';
import { STATS, type Gender } from '../game-data/stats';
import { CHROM_FALLBACK_PARTNER } from '../game-data/supports';
import {
  isRuledOut,
  pinLoss,
  rosterUnits,
  stateOf,
  withRun,
  withSavedPlan,
  withSpouse,
  type Blocking,
  type Bond,
  type Couple,
  type PinLoss,
  type Roster,
  type RosterUnit,
  type SavedPlan,
} from './roster';
import type { RoleSource } from './army-fit';
import type { PresetId } from '../curated/presets';
import type { DeploymentRole } from '../curated/deployment';
import type { Pairing, ParentRef, RobinRef } from './types';

/** A child the plan produces, valued as priority × score in its plan preset. */
export type PlannedChild = {
  readonly child: ChildId;
  readonly name: string;
  readonly key: string;
  /** The variable parent, e.g. `Sumia`, `Robin (M) +Spd −HP`, `Lucina ← Sumia`. */
  readonly parent: string;
  readonly preset: PresetId;
  /** Its plan preset's deployment role (a saved plan's: the role when adopted). Never Dancer. */
  readonly deploymentRole: DeploymentRole;
  /** 0–3. */
  readonly priority: number;
  /** Rounded; undefined for a preset without a score (Rallybot / Dancer). */
  readonly score: number | undefined;
  readonly scaled: number | undefined;
  /** priority × scaled score; 0 without a score. */
  readonly value: number;
  /** The roster's notes on its pairing, which block nothing (e.g. a parent died after marrying). */
  readonly notes: readonly string[];
  /** Where the plan preset comes from; absent on a saved plan's children. */
  readonly roleSource?: RoleSource;
  /** Why army fit moved it: the quota that forced the move. */
  readonly fitReason?: string;
};

/**
 * Why the plan leaves out a child that can still be born: it values it at 0 (no score in its plan preset, or priority
 * 0), a higher-valued child won the husband it needed, or its fixed parent is benched.
 */
export type LeftOutReason = 'no-score' | 'priority-0' | 'outscored' | 'benched';

/** A child left out by the plan: its best pairing that can still happen, and why the plan doesn't produce it. */
export type LeftOut = PlannedChild & { readonly reason: LeftOutReason };

export type PlanMarriage = {
  readonly husband: RosterUnit;
  readonly wife: RosterUnit;
  /** How the roster already binds the couple, if it does. */
  readonly bond: Bond | null;
  /** The children it produces that can still be born. Morgan is listed on Robin's marriage. */
  readonly children: readonly PlannedChild[];
};

export type MarriagePlan = {
  /** The Robin the plan is solved for: the run facts, with anything they leave open picked by the solver. */
  readonly robin: RobinRef;
  /** Robin's gender or asset/flaw was open, so the solver picked it. */
  readonly robinOpen: boolean;
  /** Married and pinned couples first, then the solver's. */
  readonly marriages: readonly PlanMarriage[];
  /** Σ priority × score. */
  readonly total: number;
  /** Pins broken by a dead or missed unit, or on hold through a benched one: dropped, freeing the partner. */
  readonly lostPins: readonly (PinLoss & { readonly couple: Couple })[];
  /** Children of this run that can't be born: no pairing that can still happen produces them. */
  readonly unborn: readonly ChildId[];
  /** Children that can still be born but the plan doesn't produce. */
  readonly leftOut: readonly LeftOut[];
};

export type PlanDiff = {
  /** Σ of the saved plan, and of the new one. */
  readonly before: number;
  readonly after: number;
  /** Children the saved plan produced that can no longer be born (as the saved plan had them). */
  readonly unborn: readonly PlannedChild[];
  /** Children the saved plan produced that the new one leaves out, though they can still be born, and why. */
  readonly leftOut: readonly LeftOut[];
  /** Children only the new plan produces. */
  readonly gained: readonly PlannedChild[];
  /** Units whose spouse changed, e.g. Stahl: Olivia → Tharja. */
  readonly moves: readonly { readonly unit: RosterUnit; readonly from: RosterUnit | undefined; readonly to: RosterUnit | undefined }[];
  /** Children in both whose pairing or score changed. */
  readonly changes: readonly { readonly child: ChildId; readonly before: PlannedChild; readonly after: PlannedChild }[];
  /** Children in both whose deployment role changed, e.g. Lucina: Lead → Battery. */
  readonly roleMoves: readonly { readonly child: ChildId; readonly name: string; readonly from: DeploymentRole; readonly to: DeploymentRole }[];
  readonly same: boolean;
};

/**
 * A child's standing in the run: ☠ dead, ✕ can't be born (no pairing left that can happen), parents married, ⚠ plan
 * broken (the saved plan's pairing for it, or, without a saved plan, its parents' pin can no longer happen), on hold
 * (its parents' pin is on hold through a bench), left out (it can still be born, but the plan doesn't produce it),
 * pinned (its parents are pinned), or open.
 */
export type LedgerStatus = 'dead' | 'unborn' | 'married' | 'broken' | 'on-hold' | 'left-out' | 'pinned' | 'open';

/** One child in the Roster page's children ledger. */
export type LedgerEntry = {
  readonly child: ChildId;
  readonly name: string;
  readonly fixedParent: RosterUnit;
  /** The pairing the plan gives it: the marriage's, once its parents are married. */
  readonly planned: PlannedChild | undefined;
  /** Its best pairing in its plan preset that can still happen, whatever the rest of the plan. */
  readonly best: PlannedChild | undefined;
  /** best − planned score; undefined unless both have a score. */
  readonly delta: number | undefined;
  readonly status: LedgerStatus;
  /** Why the plan leaves it out, when its status is left out. */
  readonly leftOut?: LeftOutReason;
  /** The roster's notes on its planned pairing, which block nothing; empty for a dead or unborn child. */
  readonly notes: readonly string[];
  /** When its status is plan broken through the saved plan: that plan's pairing (its variable parent) and every reason it can't happen. */
  readonly saved?: { readonly parent: string; readonly reasons: readonly string[] };
};

/** What the plan needs from the engine. */
export type PlanContext = {
  readonly roster: Roster;
  /** The child a pairing produces as the plan values it; undefined when the pairing doesn't exist or is hard-blocked. */
  readonly child: (pairing: Pairing) => PlannedChild | undefined;
  /** A pairing's variable parent as `PlannedChild.parent` has it, even for a pairing that can't be valued. */
  readonly parentLabel: (pairing: Pairing) => string;
  /** A child's pairings under the run facts, blocked or not. */
  readonly candidates: (child: ChildId) => readonly Pairing[];
};

/** A child's priority in the plan: 0 (don't care) to 3 (must be great). */
export const PLAN_PRIORITIES: readonly number[] = [0, 1, 2, 3];
export const DEFAULT_PRIORITY = 1;

const CHILD_IDS = Object.keys(CHILD_UNITS) as ChildId[];
const isChild = (u: RosterUnit): u is ChildId => u in CHILD_UNITS;
const MORGAN: Readonly<Record<Gender, ChildId>> = { M: 'morgan-f', F: 'morgan-m' };
/** Children by fixed parent (Morgan's, Robin, is left out: it depends on Robin's gender). */
const BY_FIXED = new Map<RosterUnit, ChildId[]>();
for (const c of CHILD_IDS) {
  const f = CHILD_UNITS[c].fixedParent;
  if (f !== 'robin') BY_FIXED.set(f, [...(BY_FIXED.get(f) ?? []), c]);
}
const fixedParentOf = (c: ChildId): RosterUnit => CHILD_UNITS[c].fixedParent;

function genderOf(u: RosterUnit, robin: Gender): Gender {
  if (u === 'robin') return robin;
  return isChild(u) ? CHILD_UNITS[u].gender : FIRST_GEN_UNITS[u].gender;
}

/** A couple as husband, wife. */
const orient = ([a, b]: Couple, robin: Gender): Couple => (genderOf(a, robin) === 'M' ? [a, b] : [b, a]);

const refOf = (u: RosterUnit, robin: RobinRef): ParentRef => (u === 'robin' ? robin : { kind: 'unit', id: u as Exclude<RosterUnit, ChildId | 'robin'> });

/**
 * The pairings a marriage produces: each first-gen parent's child with the other as variable parent, and Morgan on
 * Robin's marriage. Morgan with a child partner needs that child's other parent, from `spouseOf`.
 */
function pairingsOf([a, b]: Couple, robin: RobinRef, spouseOf: (u: RosterUnit) => RosterUnit | undefined): Pairing[] {
  const out: Pairing[] = [];
  for (const [p, q] of [[a, b], [b, a]] as const) {
    if (isChild(p)) continue;
    if (p === 'robin') {
      const child = MORGAN[robin.gender];
      if (!isChild(q)) {
        out.push({ child, fixedRobin: robin, variableParent: refOf(q, robin) });
        continue;
      }
      const other = spouseOf(fixedParentOf(q));
      if (other && !isChild(other)) out.push({ child, fixedRobin: robin, variableParent: { kind: 'child', id: q, variableParent: refOf(other, robin) } });
    } else if (!isChild(q)) {
      for (const child of BY_FIXED.get(p) ?? []) out.push({ child, variableParent: refOf(q, robin) });
    }
  }
  return out;
}

/** The plan a set of marriages makes, valued by the context. */
function evaluate(ctx: PlanContext, couples: readonly Couple[], robin: RobinRef, extra: Pick<MarriagePlan, 'robinOpen' | 'lostPins'>): MarriagePlan {
  const spouse = new Map<RosterUnit, RosterUnit>();
  for (const [a, b] of couples) spouse.set(a, b).set(b, a);
  const bondOf = (h: RosterUnit, w: RosterUnit): Bond | null => {
    const s = ctx.roster.spouses[h];
    return s?.partner === w && (s.bond === 'married' || !pinLoss(ctx.roster, h)) ? s.bond : null;
  };
  const marriages = couples.map((c): PlanMarriage => {
    const [husband, wife] = orient(c, robin.gender);
    const children = pairingsOf(c, robin, (u) => spouse.get(u)).flatMap((p) => ctx.child(p) ?? []);
    return { husband, wife, bond: bondOf(husband, wife), children };
  });
  const born = new Set(marriages.flatMap((m) => m.children.map((c) => c.child)));
  const unborn: ChildId[] = [];
  const leftOut: LeftOut[] = [];
  for (const u of rosterUnits({ ...ctx.roster.run, gender: robin.gender })) {
    const child = u.id as ChildId;
    if (u.kind !== 'child' || born.has(child)) continue;
    const best = bestPairing(ctx, child);
    if (best) leftOut.push({ ...best, reason: leftOutReason(ctx.roster, child, best) });
    else unborn.push(child);
  }
  const total = marriages.reduce((sum, m) => sum + m.children.reduce((s, c) => s + c.value, 0), 0);
  return { robin, marriages, total, unborn, leftOut, ...extra };
}

/** A child's best-scoring pairing that can still happen, whatever the rest of the plan; ties go to `prefer`. */
function bestPairing(ctx: PlanContext, child: ChildId, prefer?: string): PlannedChild | undefined {
  let best: PlannedChild | undefined;
  for (const p of ctx.candidates(child)) {
    const c = ctx.child(p);
    if (!c) continue;
    const [a, b] = [c.scaled ?? -Infinity, best?.scaled ?? -Infinity];
    if (!best || a > b || (a === b && c.key === prefer)) best = c;
  }
  return best;
}

function leftOutReason(roster: Roster, child: ChildId, best: PlannedChild): LeftOutReason {
  if (stateOf(roster, fixedParentOf(child)) === 'benched') return 'benched';
  if (best.score === undefined) return 'no-score';
  return best.priority === 0 ? 'priority-0' : 'outscored';
}

/** The saved plan's Robin: as the run facts say, or else as the plan was solved for. */
function savedRobin(run: Roster['run'], saved: SavedPlan): RobinRef {
  const asset = run.asset ?? saved.robin?.asset ?? 'hp';
  const want = run.flaw ?? saved.robin?.flaw;
  const robin: RobinRef = {
    kind: 'robin',
    gender: run.gender ?? saved.robin?.gender ?? 'M',
    asset,
    flaw: want && want !== asset ? want : STATS.find((s) => s !== asset)!,
  };
  return robin;
}

/** Values a saved plan's marriages in the context's plan presets, each child in the deployment role it had when adopted. */
export function evaluatePlan(ctx: PlanContext, saved: SavedPlan): MarriagePlan {
  const plan = evaluate(ctx, saved.marriages, savedRobin(ctx.roster.run, saved), { robinOpen: false, lostPins: [] });
  const roles = saved.deploymentRoles;
  if (!roles) return plan;
  const marriages = plan.marriages.map((m) => ({
    ...m,
    children: m.children.map((c) => ({ ...c, deploymentRole: roles[c.child] ?? c.deploymentRole })),
  }));
  return { ...plan, marriages };
}

/** Whether a marriage can be pinned or ruled out: Robin's only once the run says which Robin it is. */
export const canPin = (roster: Roster, m: Pick<PlanMarriage, 'husband' | 'wife'>): boolean =>
  !!roster.run.gender || (m.husband !== 'robin' && m.wife !== 'robin');

/**
 * Adopts a plan: saves it as the baseline (with its Robin, when Robin marries, and each child's deployment role) and
 * pins every marriage it proposes,
 * so a later loss breaks the pin and the plan re-solves around it. Pins it moves are replaced.
 */
export function adoptPlan(roster: Roster, plan: MarriagePlan): Roster {
  const { gender, asset, flaw } = plan.robin;
  const robinMarries = plan.marriages.some((m) => m.husband === 'robin' || m.wife === 'robin');
  const marriages = plan.marriages.map((m): Couple => [m.husband, m.wife]);
  const deploymentRoles = Object.fromEntries(plan.marriages.flatMap((m) => m.children.map((c) => [c.child, c.deploymentRole])));
  let next = withSavedPlan(roster, { robin: robinMarries ? { gender, asset, flaw } : null, marriages, deploymentRoles });
  for (const m of plan.marriages) if (!m.bond && canPin(roster, m)) next = withSpouse(next, m.husband, m.wife, 'pinned');
  return next;
}

/**
 * Locks Robin from the plan's pick: writes the plan's Robin into the Run facts it leaves open (facts already set are
 * kept) and pins Robin's marriage, if the plan marries Robin. Works before or after {@link adoptPlan}. A plan solved for
 * the other gender pins nothing: its Robin marriage can't exist in the run.
 */
export function lockRobin(roster: Roster, plan: MarriagePlan): Roster {
  const { run } = roster;
  const { gender, asset, flaw } = plan.robin;
  let next = withRun(roster, { gender: run.gender ?? gender, asset: run.asset ?? asset, flaw: run.flaw ?? flaw });
  const m = plan.marriages.find((m) => m.husband === 'robin' || m.wife === 'robin');
  if (m && !m.bond && next.run.gender === gender) next = withSpouse(next, m.husband, m.wife, 'pinned');
  return next;
}

/** The saved plan's pairings, without valuing them. */
export function savedPairings(roster: Roster, saved: SavedPlan): Pairing[] {
  const robin = savedRobin(roster.run, saved);
  const spouse = new Map<RosterUnit, RosterUnit>();
  for (const [a, b] of saved.marriages) spouse.set(a, b).set(b, a);
  return saved.marriages.flatMap((c) => pairingsOf(c, robin, (u) => spouse.get(u)));
}

const UNAVAILABLE = ['dead', 'missed', 'benched'];
/** For couples without Robin, whose children don't depend on Robin. */
const NO_ROBIN: RobinRef = { kind: 'robin', gender: 'M', asset: 'hp', flaw: 'str' };
/** A tiny bonus per planned marriage, so a marriage worth 0 is still preferred to none (children still get born). */
const EPS = 1e-6;
/**
 * A tinier bonus per saved-plan child a marriage keeps (and tinier still if it keeps the saved pairing), so among
 * plans of equal value and marriage count the re-plan keeps the saved plan's children (#46): an equal-value change,
 * such as toggling Free re-plan, never swaps which child is left out.
 */
const KEEP = EPS / 1000;
const BIG = 1e12;

/** Solves the marriage plan; `free` ignores pins (not marriages), to show what keeping them costs. */
export function solvePlan(ctx: PlanContext, free = false): MarriagePlan {
  const { roster } = ctx;
  const { run } = roster;
  const lostPins: (PinLoss & { couple: Couple })[] = [];
  const fixed: Couple[] = [];
  const seen = new Set<RosterUnit>();
  for (const [u, s] of Object.entries(roster.spouses) as [RosterUnit, (typeof roster.spouses)[RosterUnit]][]) {
    if (!s || seen.has(u)) continue;
    seen.add(u).add(s.partner);
    const loss = pinLoss(roster, u);
    if (loss) lostPins.push({ couple: [u, s.partner], ...loss });
    else if (s.bond === 'married' || !free) fixed.push([u, s.partner]);
  }
  const taken = new Set(fixed.flat());
  const robinCouple = fixed.find((c) => c.includes('robin'));
  const robinPartner = robinCouple?.find((u) => u !== 'robin');
  const robinOpen = !run.gender || !run.asset || !run.flaw;

  const saved = roster.savedPlan ? savedPairings(roster, roster.savedPlan) : [];
  const keptChildren = new Set(saved.map((p) => p.child));
  const keptPairings = new Set(saved.flatMap((p) => ctx.child(p)?.key ?? []));
  const valueOf = (ps: readonly Pairing[]) =>
    ps.reduce((sum, p) => {
      const c = ctx.child(p);
      if (!c) return sum;
      return sum + c.value + (keptChildren.has(c.child) ? KEEP : 0) + (keptPairings.has(c.key) ? KEEP / 100 : 0);
    }, 0);
  // Couples without Robin produce the same children whatever Robin is: value them once.
  const plain = new Map<string, number>();
  const plainValue = (h: RosterUnit, w: RosterUnit) => {
    const k = `${h}+${w}`;
    let v = plain.get(k);
    if (v === undefined) plain.set(k, (v = valueOf(pairingsOf([h, w], NO_ROBIN, () => undefined))));
    return v;
  };
  const fixedTotal = fixed.filter((c) => !c.includes('robin')).reduce((sum, [a, b]) => sum + plainValue(a, b), 0);
  // Ties go to the plan with more marriages (children still get born), then to the one keeping more saved children.
  let best: { rank: number; robin: RobinRef; couples: readonly Couple[] } | undefined;
  const consider = (total: number, robin: RobinRef, couples: readonly Couple[]) => {
    const rank = total + EPS * couples.length;
    if (!best || rank > best.rank + EPS / 2) best = { rank, robin, couples };
  };
  for (const g of run.gender ? [run.gender] : (['M', 'F'] as const)) {
    const units = rosterUnits({ ...run, gender: g });
    const partners = new Map<RosterUnit, readonly RosterUnit[]>(units.map((u) => [u.id, u.partners]));
    partners.set(CHROM_FALLBACK_PARTNER, ['chrom']);
    const open = (u: RosterUnit) => !taken.has(u) && !UNAVAILABLE.includes(stateOf(roster, u));
    const legal = (h: RosterUnit, w: RosterUnit) => (partners.get(h) ?? []).includes(w) && !isRuledOut(roster, h, w);
    const robinPartners = open('robin') ? (partners.get('robin') ?? []).filter((u) => open(u) && legal('robin', u)) : [];
    const robins: RobinRef[] = (run.asset ? [run.asset] : STATS).flatMap((asset) =>
      (run.flaw ? [run.flaw] : STATS).flatMap((flaw): RobinRef[] => (flaw === asset ? [] : [{ kind: 'robin', gender: g, asset, flaw }])),
    );
    /** Robin's asset/flaw matters only to Robin's own marriage and Morgan: pick it for that term alone. */
    const bestRobin = (term: (robin: RobinRef) => number) => {
      let top = { value: -Infinity, robin: robins[0]! };
      for (const robin of robins) {
        const value = term(robin);
        if (value > top.value + EPS / 2) top = { value, robin };
      }
      return top;
    };
    const pool = [...units.filter((u) => u.kind !== 'child' && u.id !== 'robin').map((u) => u.id), CHROM_FALLBACK_PARTNER as RosterUnit].filter(open);
    // Robin's marriage to a first-gen unit: Robin is one more node, each edge at its best asset/flaw.
    const robinEdges = new Map<RosterUnit, { value: number; robin: RobinRef }>();
    const robinEdge = (p: RosterUnit) => {
      let found = robinEdges.get(p);
      if (!found) robinEdges.set(p, (found = bestRobin((robin) => valueOf(pairingsOf(['robin', p], robin, () => undefined)))));
      return found;
    };
    if (robinCouple && !isChild(robinPartner!)) {
      const m = robinEdge(robinPartner!);
      const r = match(pool, g, legal, plainValue);
      consider(fixedTotal + m.value + r.total, m.robin, [...fixed, ...r.couples]);
      continue;
    }
    if (!robinCouple) {
      const r = match(open('robin') ? [...pool, 'robin'] : pool, g, legal, (h, w) =>
        h === 'robin' || w === 'robin' ? robinEdge(h === 'robin' ? w : h).value : plainValue(h, w),
      );
      const robinsPartner = r.couples.find((c) => c.includes('robin'))?.find((u) => u !== 'robin');
      consider(fixedTotal + r.total, robinsPartner ? robinEdge(robinsPartner).robin : robins[0]!, [...fixed, ...r.couples]);
    }
    // Robin's marriage to a child: Morgan's value (at its best asset/flaw) rides on the marriage that produces the child.
    const children = robinCouple ? [robinPartner as ChildId] : robinPartners.filter(isChild);
    for (const child of children) {
      const f = fixedParentOf(child);
      const morgans = new Map<RosterUnit, { value: number; robin: RobinRef }>();
      const morgan = (other: RosterUnit) => {
        let found = morgans.get(other);
        if (!found) {
          const pairing = (robin: RobinRef): Pairing => ({ child: MORGAN[g], fixedRobin: robin, variableParent: { kind: 'child', id: child, variableParent: refOf(other, robin) } });
          morgans.set(other, (found = bestRobin((robin) => valueOf([pairing(robin)]))));
        }
        return found;
      };
      const couples: Couple[] = robinCouple ? [...fixed] : [...fixed, ['robin', child]];
      const fixedOther = fixed.find((c) => c.includes(f))?.find((u) => u !== f);
      if (fixedOther) {
        const m = morgan(fixedOther);
        const r = match(pool, g, legal, plainValue);
        consider(fixedTotal + m.value + r.total, m.robin, [...couples, ...r.couples]);
        continue;
      }
      const r = match(pool, g, legal, (h, w) => plainValue(h, w) + (h === f || w === f ? morgan(h === f ? w : h).value : 0));
      const other = r.couples.find((c) => c.includes(f))?.find((u) => u !== f);
      consider(fixedTotal + r.total, other ? morgan(other).robin : robins[0]!, [...couples, ...r.couples]);
    }
  }
  const plan = evaluate(ctx, best!.couples, best!.robin, { robinOpen, lostPins });
  // Married, then pinned, then the solver's.
  const order = (m: PlanMarriage) => (m.bond === 'married' ? 0 : m.bond === 'pinned' ? 1 : 2);
  return { ...plan, marriages: [...plan.marriages].sort((a, b) => order(a) - order(b)) };
}

/** Max-weight marriages among the units (none of them Robin), by the Hungarian algorithm. */
function match(
  units: readonly RosterUnit[],
  g: Gender,
  legal: (h: RosterUnit, w: RosterUnit) => boolean,
  value: (h: RosterUnit, w: RosterUnit) => number,
): { total: number; couples: Couple[] } {
  const men = units.filter((u) => genderOf(u, g) === 'M');
  const women = units.filter((u) => genderOf(u, g) === 'F');
  // Unmatched men take a dummy column at 0; each marriage gets EPS so one worth 0 still beats none.
  const cost = men.map((h) => [...women.map((w) => (legal(h, w) ? -(value(h, w) + EPS) : BIG)), ...men.map(() => 0)]);
  const couples: Couple[] = [];
  let total = 0;
  hungarian(cost).forEach((j, i) => {
    if (j >= women.length || cost[i]![j]! >= BIG) return;
    couples.push([men[i]!, women[j]!]);
    total += value(men[i]!, women[j]!);
  });
  return { total, couples };
}

/** Compares the saved plan (valued today) with a new one. */
export function diffPlans(before: MarriagePlan, after: MarriagePlan): PlanDiff {
  const born = (p: MarriagePlan) => new Map(p.marriages.flatMap((m) => m.children.map((c) => [c.child, c] as const)));
  const spouses = (p: MarriagePlan) => new Map(p.marriages.flatMap((m) => [[m.husband, m.wife], [m.wife, m.husband]] as const));
  const [kb, ka] = [born(before), born(after)];
  const [sb, sa] = [spouses(before), spouses(after)];
  const lost = [...kb.values()].filter((c) => !ka.has(c.child));
  const reasons = new Map(after.leftOut.map((c) => [c.child, c.reason] as const));
  const unborn = lost.filter((c) => !reasons.has(c.child));
  const leftOut = lost.flatMap((c): LeftOut[] => {
    const reason = reasons.get(c.child);
    return reason ? [{ ...c, reason }] : [];
  });
  const gained = [...ka.values()].filter((c) => !kb.has(c.child));
  const units = [...new Set([...sb.keys(), ...sa.keys()])];
  const moves = units.flatMap((unit) => (sb.get(unit) === sa.get(unit) ? [] : [{ unit, from: sb.get(unit), to: sa.get(unit) }]));
  const changes = [...kb.values()].flatMap((b) => {
    const a = ka.get(b.child);
    return a && (a.key !== b.key || a.score !== b.score) ? [{ child: b.child, before: b, after: a }] : [];
  });
  const roleMoves = [...kb.values()].flatMap((b) => {
    const a = ka.get(b.child);
    return a && a.deploymentRole !== b.deploymentRole ? [{ child: b.child, name: b.name, from: b.deploymentRole, to: a.deploymentRole }] : [];
  });
  const same = lost.length === 0 && gained.length === 0 && moves.length === 0 && changes.length === 0 && roleMoves.length === 0;
  return { before: before.total, after: after.total, unborn, leftOut, gained, moves, changes, roleMoves, same };
}

/**
 * Min-cost assignment of every row to a distinct column (rows ≤ columns): the column index per row. The classic
 * O(n²m) Hungarian algorithm with potentials.
 */
function hungarian(cost: readonly (readonly number[])[]): number[] {
  const n = cost.length;
  const m = cost[0]?.length ?? 0;
  const u = new Float64Array(n + 1);
  const v = new Float64Array(m + 1);
  const p = new Int32Array(m + 1);
  const way = new Int32Array(m + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(m + 1).fill(Infinity);
    const used = new Uint8Array(m + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0]!;
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]!]! += delta;
          v[j]! -= delta;
        } else minv[j]! -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0);
  }
  const out = new Array<number>(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) out[p[j]! - 1] = j - 1;
  return out;
}

/** What decides a child's ledger status. */
export type LedgerFacts = {
  readonly dead: boolean;
  readonly bornable: boolean;
  readonly married: boolean;
  readonly broken: boolean;
  readonly onHold: boolean;
  readonly leftOut: boolean;
  readonly pinned: boolean;
};

/** The first that holds wins: dead > can't be born > parents married > plan broken > on hold > left out > pinned > open. */
export function ledgerStatus(f: LedgerFacts): LedgerStatus {
  if (f.dead) return 'dead';
  if (!f.bornable) return 'unborn';
  if (f.married) return 'married';
  if (f.broken) return 'broken';
  if (f.onHold) return 'on-hold';
  if (f.leftOut) return 'left-out';
  return f.pinned ? 'pinned' : 'open';
}

/**
 * The children ledger: each child of the run with its plan (or marriage), its best remaining pairing and its status.
 * `blocking` reads a pairing against the roster.
 */
export function childLedger(ctx: PlanContext, plan: MarriagePlan, blocking: (pairing: Pairing) => Blocking): LedgerEntry[] {
  const { roster } = ctx;
  const planned = new Map(plan.marriages.flatMap((m) => m.children.map((c) => [c.child, c] as const)));
  const leftOut = new Map(plan.leftOut.map((c) => [c.child, c.reason] as const));
  const saved = new Map(roster.savedPlan ? savedPairings(roster, roster.savedPlan).map((p) => [p.child, p] as const) : []);
  return rosterUnits(roster.run).flatMap((u): LedgerEntry[] => {
    if (u.kind !== 'child') return [];
    const child = u.id as ChildId;
    const mine = planned.get(child);
    // Ties go to the plan's pairing.
    const best = bestPairing(ctx, child, mine?.key);
    const plannedPairing = mine && ctx.candidates(child).find((p) => ctx.child(p)?.key === mine.key);
    const plannedBlocking = plannedPairing && blocking(plannedPairing);
    const bond = plannedBlocking?.status;
    const was = saved.get(child);
    // Only a pairing that can no longer happen breaks the plan: re-pinning away from it is the user's call. Once a
    // plan is saved, it alone says what was planned: after Adopt, a child the new plan drops is left out, not broken.
    const pinLost = pinLoss(roster, CHILD_UNITS[child].fixedParent)?.status;
    const wasBlocking = was && blocking(was);
    const savedLost = was && wasBlocking?.status === 'hard' ? { parent: ctx.parentLabel(was), reasons: wasBlocking.hard } : undefined;
    const broken = roster.savedPlan ? !!savedLost : pinLost === 'broken';
    const status = ledgerStatus({
      dead: stateOf(roster, child) === 'dead',
      bornable: !!best,
      married: bond === 'married',
      broken,
      onHold: pinLost === 'on-hold',
      leftOut: leftOut.has(child),
      pinned: bond === 'pinned',
    });
    const alive = status !== 'dead' && status !== 'unborn';
    const delta = alive && mine?.score !== undefined && best?.score !== undefined ? best.score - mine.score : undefined;
    return [
      {
        child,
        name: u.name,
        fixedParent: CHILD_UNITS[child].fixedParent,
        planned: alive ? mine : undefined,
        best: alive ? best : undefined,
        delta,
        status,
        ...(status === 'left-out' ? { leftOut: leftOut.get(child) } : {}),
        notes: alive ? (plannedBlocking?.notes ?? []) : [],
        ...(status === 'broken' && savedLost ? { saved: savedLost } : {}),
      },
    ];
  });
}
