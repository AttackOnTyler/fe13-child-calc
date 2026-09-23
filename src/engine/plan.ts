/**
 * The marriage plan: one spouse per unit for the whole roster, chosen to maximise Σ priority × score over the children
 * the marriages produce (#16, #18). Married pairs and pins are fixed, void pins are dropped (freeing the partner), and
 * rule-outs are never planned. The rest is max-weight bipartite matching (Hungarian algorithm), searched over Robin's
 * gender and asset/flaw while the run facts leave them open, and over Robin's partner when it is a child: Morgan's
 * value then rides on the marriage that produces that child. Pure: roster and a child valuation in, plan out.
 */
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { FIRST_GEN_UNITS } from '../game-data/units';
import { STATS, type Gender } from '../game-data/stats';
import { CHROM_FALLBACK_PARTNER } from '../game-data/supports';
import {
  isRuledOut,
  rosterUnits,
  stateOf,
  voidPinReason,
  withSavedPlan,
  withSpouse,
  type Blocking,
  type Bond,
  type Couple,
  type Roster,
  type RosterUnit,
  type SavedPlan,
} from './roster';
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
};

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
  /** Pins through a benched, missed or dead unit: dropped, freeing the partner. */
  readonly brokenPins: readonly { readonly couple: Couple; readonly reason: string }[];
  /** Children of this run that the plan doesn't produce (or that can no longer be born). */
  readonly unborn: readonly ChildId[];
};

export type PlanDiff = {
  /** Σ of the saved plan, and of the new one. */
  readonly before: number;
  readonly after: number;
  /** Children the saved plan produced and the new one doesn't. */
  readonly lost: readonly PlannedChild[];
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
 * broken (the saved plan's pairing for it can no longer happen), planned (its parents are pinned), or open.
 */
export type LedgerStatus = 'dead' | 'unborn' | 'married' | 'broken' | 'planned' | 'open';

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
};

/** What the plan needs from the engine. */
export type PlanContext = {
  readonly roster: Roster;
  /** The child a pairing produces as the plan values it; undefined when the pairing doesn't exist or is hard-blocked. */
  readonly child: (pairing: Pairing) => PlannedChild | undefined;
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
function evaluate(ctx: PlanContext, couples: readonly Couple[], robin: RobinRef, extra: Pick<MarriagePlan, 'robinOpen' | 'brokenPins'>): MarriagePlan {
  const spouse = new Map<RosterUnit, RosterUnit>();
  for (const [a, b] of couples) spouse.set(a, b).set(b, a);
  const bondOf = (h: RosterUnit, w: RosterUnit): Bond | null => {
    const s = ctx.roster.spouses[h];
    return s?.partner === w && (s.bond === 'married' || !voidPinReason(ctx.roster, h)) ? s.bond : null;
  };
  const marriages = couples.map((c): PlanMarriage => {
    const [husband, wife] = orient(c, robin.gender);
    const children = pairingsOf(c, robin, (u) => spouse.get(u)).flatMap((p) => ctx.child(p) ?? []);
    return { husband, wife, bond: bondOf(husband, wife), children };
  });
  const born = new Set(marriages.flatMap((m) => m.children.map((c) => c.child)));
  const unborn = rosterUnits({ ...ctx.roster.run, gender: robin.gender })
    .flatMap((u) => (u.kind === 'child' && !born.has(u.id as ChildId) ? [u.id as ChildId] : []));
  const total = marriages.reduce((sum, m) => sum + m.children.reduce((s, c) => s + c.value, 0), 0);
  return { robin, marriages, total, unborn, ...extra };
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

/** Values a saved plan's marriages, each child in the deployment role it had when adopted. */
export function evaluatePlan(ctx: PlanContext, saved: SavedPlan): MarriagePlan {
  const plan = evaluate(ctx, saved.marriages, savedRobin(ctx.roster.run, saved), { robinOpen: false, brokenPins: [] });
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
const BIG = 1e12;

/** Solves the marriage plan; `free` ignores pins (not marriages), to show what keeping them costs. */
export function solvePlan(ctx: PlanContext, free = false): MarriagePlan {
  const { roster } = ctx;
  const { run } = roster;
  const brokenPins: { couple: Couple; reason: string }[] = [];
  const fixed: Couple[] = [];
  const seen = new Set<RosterUnit>();
  for (const [u, s] of Object.entries(roster.spouses) as [RosterUnit, (typeof roster.spouses)[RosterUnit]][]) {
    if (!s || seen.has(u)) continue;
    seen.add(u).add(s.partner);
    const reason = s.bond === 'pinned' ? voidPinReason(roster, u) : undefined;
    if (reason) brokenPins.push({ couple: [u, s.partner], reason });
    else if (s.bond === 'married' || !free) fixed.push([u, s.partner]);
  }
  const taken = new Set(fixed.flat());
  const robinCouple = fixed.find((c) => c.includes('robin'));
  const robinPartner = robinCouple?.find((u) => u !== 'robin');
  const robinOpen = !run.gender || !run.asset || !run.flaw;

  const valueOf = (ps: readonly Pairing[]) => ps.reduce((sum, p) => sum + (ctx.child(p)?.value ?? 0), 0);
  // Couples without Robin produce the same children whatever Robin is: value them once.
  const plain = new Map<string, number>();
  const plainValue = (h: RosterUnit, w: RosterUnit) => {
    const k = `${h}+${w}`;
    let v = plain.get(k);
    if (v === undefined) plain.set(k, (v = valueOf(pairingsOf([h, w], NO_ROBIN, () => undefined))));
    return v;
  };
  const fixedTotal = fixed.filter((c) => !c.includes('robin')).reduce((sum, [a, b]) => sum + plainValue(a, b), 0);
  // Ties go to the plan with more marriages: children still get born.
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
  const plan = evaluate(ctx, best!.couples, best!.robin, { robinOpen, brokenPins });
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
  return { before: before.total, after: after.total, lost, gained, moves, changes, roleMoves, same };
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

/**
 * The children ledger: each child of the run with its plan (or marriage), its best remaining pairing and its status.
 * `candidates` are a child's pairings under the run facts; `blocking` reads a pairing against the roster.
 */
export function childLedger(
  ctx: PlanContext,
  plan: MarriagePlan,
  candidates: (child: ChildId) => readonly Pairing[],
  blocking: (pairing: Pairing) => Blocking,
): LedgerEntry[] {
  const { roster } = ctx;
  const planned = new Map(plan.marriages.flatMap((m) => m.children.map((c) => [c.child, c] as const)));
  const saved = new Map(roster.savedPlan ? savedPairings(roster, roster.savedPlan).map((p) => [p.child, p] as const) : []);
  return rosterUnits(roster.run).flatMap((u): LedgerEntry[] => {
    if (u.kind !== 'child') return [];
    const child = u.id as ChildId;
    const mine = planned.get(child);
    let best: PlannedChild | undefined;
    let plannedPairing: Pairing | undefined;
    for (const p of candidates(child)) {
      const c = ctx.child(p);
      if (!c) continue;
      if (c.key === mine?.key) plannedPairing = p;
      // Ties go to the plan's pairing.
      const [a, b] = [c.scaled ?? -Infinity, best?.scaled ?? -Infinity];
      if (!best || a > b || (a === b && c.key === mine?.key)) best = c;
    }
    const bond = plannedPairing && blocking(plannedPairing).status;
    const was = saved.get(child);
    // Only a pairing that can no longer happen breaks the plan: re-pinning away from it is the user's call.
    const broken = was && blocking(was).status === 'hard';
    const status: LedgerStatus =
      stateOf(roster, child) === 'dead'
        ? 'dead'
        : !best
          ? 'unborn'
          : bond === 'married'
            ? 'married'
            : broken
              ? 'broken'
              : bond === 'planned'
                ? 'planned'
                : 'open';
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
      },
    ];
  });
}
