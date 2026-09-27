/**
 * Unit worth, utility and reserves (#202; spec #175, Unit worth and The joint solve).
 *
 * - **Worth:** the flawless chance a plan loses without a unit. The unit is removed from every lineup it's in: a named
 *   lineup drops it, the greedy lineups never see it, and it's in the army nowhere, except on a map where it's forced
 *   (a recruit fielded from turn 1 of the map it joins on), where it's fielded for that map alone. What the removal
 *   forces is re-chosen: its children the plan still has to recruit go with it (so a parent's worth includes its
 *   children), its spouse marries again (the seed's match for the spouse, every other couple kept), and the wishlist is
 *   rebuilt for that army (its slot refilled at caps, children's passes kept where the parents are the same). The
 *   roadmap is re-solved greedily: each map whose named lineup had a removed unit goes back to the greedy lineup (the
 *   seed's), the endpoint's is the rebuilt wishlist's; its order, seals and item uses otherwise stay. A bounded local
 *   search of the new plan isn't run (a stated simplification: worth reads a little high by what the search would win
 *   back). Chrom and Robin read "forced": no plan has them removed.
 * - **Utility:** the part of worth lost when the unit still fights but takes none of its staff (heal, Fortify, Rescue),
 *   Dance or Rally actions (`RunSimInput.idle`); a unit with none of those in its kit or its classes has none.
 * - **Reserves:** chosen when the worker is idle, after the worth: the **likely losses** are the wishlist units the
 *   plan's runs lose most often (`RunSim.losses`, the few most lost, weighted by how often); for each, the plan without
 *   it is played with its endpoint slot left empty, and again with each candidate (a unit the plan has by the endpoint
 *   that isn't on the wishlist) stepping into the slot. A candidate's reading is the chance it restores, summed over
 *   the likely losses by their weights; each names the loss it restores most of. A loss is read as if the unit were gone
 *   from the start (as its worth is), not from the map where the runs lose it: a stated simplification. A map's lost
 *   chance is put on the units that fought there by each one's death risk. No EXP is set aside for a reserve:
 *   the plan's roadmap is untouched, and a reserve is fielded before the endpoint only where the greedy lineup already
 *   would (a span pin, #200, is what asks for more).
 *
 * **Same runs:** every variant (the plan, the plan without a unit, the unit idle, a reserve stepping in) is simulated on
 * the plan's seed, run by run (common random numbers), so each difference is paired and its ± is the paired error.
 *
 * **Anytime:** both are stepping calls like the search's (`step.ts`): a budget in evaluations (one simulated run of one
 * variant; building a variant's plan or reading the units and losses counts one), a plain-JSON cursor to resume from.
 * Every variant is first read on `runs` runs, then the runs double for all of them, up to `cap`.
 */
import type { ChildId } from '../../game-data/children';
import { CLASS_SKILLS, RALLY_SKILLS, SKILLS } from '../../game-data/skills';
import { withState, type RosterUnit } from '../roster';
import type { Run } from '../run';
import { withPlanRobin } from '../flawless';
import type { ArmyUnit, ChildRecruit, LineupPlan, RunSimInput, RunSimMap } from '../sim/run-sim';
import { paired } from './paired';
import type { Plan, PlanLineup, PlanPin, WishlistReserve } from './plan';
import { coupleKey, placedForSupports, planFor, seedPlan, type SeedContext, type SeedOptions } from './seed';
import { SEARCH_RUNS } from './step';

/** Units that read "forced" (spec #175, Unit worth): the game fields them on nearly every map. */
export const FORCED_UNITS: readonly RosterUnit[] = ['chrom', 'robin'];

/** The likely losses reserves are ranked against: the wishlist units the runs lose most often, this many at most. */
export const LIKELY_LOSSES = 3;

/** What a worth step simulates: the plan, the plan without a unit, the plan with a unit idle, or a reserve stepping in. */
export type WorthVariant =
  | { readonly kind: 'plan' }
  | { readonly kind: 'without'; readonly unit: RosterUnit }
  | { readonly kind: 'idle'; readonly unit: RosterUnit }
  | { readonly kind: 'cover'; readonly loss: RosterUnit; readonly reserve: RosterUnit | null };

/** A unit with a worth: forced or not, the children that go with it, and whether it has any utility to read. */
export type WorthSubject = { readonly unit: RosterUnit; readonly forced: boolean; readonly children: readonly RosterUnit[]; readonly utility: boolean };

/** One unit's worth and utility, in flawless points (0–1), each with its paired error (±, 95%). */
export type UnitWorth = {
  readonly unit: RosterUnit;
  /** Chrom and Robin: no worth or utility is read. */
  readonly forced: boolean;
  /** The flawless chance lost without it; undefined while unread (or forced). */
  readonly worth: number | undefined;
  readonly margin: number | undefined;
  /** The part lost when it fights but takes no staff, Dance or Rally action; 0 with none in its kit. */
  readonly utility: number | undefined;
  readonly utilityMargin: number | undefined;
  /** The runs read. */
  readonly runs: number;
  /** Children the plan still has to recruit that go with it: its worth includes theirs. */
  readonly children: readonly RosterUnit[];
  /** Read at the run cap. */
  readonly settled: boolean;
};

type Row = { readonly key: string; readonly variant: WorthVariant; samples: number[]; built: boolean };

/** Rows of variants filled pass by pass: the plan's runs first (unless there are none to read), then each row's, doubling to the cap. */
type Passes = { base: number[] | null; rows: Row[]; target: number };

/** Where a worth step stands (plain JSON): pass it back unchanged. */
export type WorthCursor = {
  readonly evaluations: number;
  readonly subjects?: WorthSubject[];
  readonly passes?: Passes;
  readonly converged?: boolean;
};

export type WorthInput = {
  readonly run: Run;
  readonly plan: Plan;
  readonly seed: number;
  /** Evaluations this step may spend (see the module comment). */
  readonly budget: number;
  /** Runs each variant is first read on; `SEARCH_RUNS.start` by default. */
  readonly runs?: number;
  /** The most runs each is read on; `SEARCH_RUNS.cap` by default. */
  readonly cap?: number;
  readonly cursor?: WorthCursor;
  /** Hard constraints the re-chosen marriages keep. */
  readonly pins?: readonly PlanPin[];
};

export type WorthStep = {
  /** Every unit in any of the plan's lineups (and on its wishlist), most worth first; forced units last. */
  readonly units: readonly UnitWorth[];
  readonly converged: boolean;
  readonly evaluations: number;
  readonly cursor: WorthCursor;
};

/** What a worth step needs: the units, and each variant's runs on the plan's seed. */
export type WorthDeps = {
  readonly subjects: () => readonly WorthSubject[];
  readonly samples: (variant: WorthVariant, first: number, count: number) => readonly number[];
};

const variantKey = (v: WorthVariant): string =>
  v.kind === 'plan' ? 'plan' : v.kind === 'cover' ? `cover:${v.loss}:${v.reserve ?? '-'}` : `${v.kind}:${v.unit}`;

/**
 * Fills the rows within a budget: the plan's runs to the pass's target, then each row's (building a row's variant
 * first counts one), then the next pass at twice the runs, up to the cap. Returns the evaluations spent and whether
 * every row is at the cap.
 */
function fill(p: Passes, budget: number, cap: number, samples: WorthDeps['samples']): { spent: number; done: boolean } {
  let spent = 0;
  for (;;) {
    if (spent >= budget) return { spent, done: false };
    const left = budget - spent;
    if (p.base && p.base.length < p.target) {
      const k = Math.min(left, p.target - p.base.length);
      p.base.push(...samples({ kind: 'plan' }, p.base.length, k));
      spent += k;
      continue;
    }
    const r = p.rows.find((x) => x.samples.length < p.target);
    if (r) {
      if (!r.built) {
        r.built = true;
        spent += 1;
        continue;
      }
      const k = Math.min(left, p.target - r.samples.length);
      r.samples.push(...samples(r.variant, r.samples.length, k));
      spent += k;
      continue;
    }
    if (p.target >= cap) return { spent, done: true };
    p.target = Math.min(cap, p.target * 2);
  }
}

/** The plan's chance less a row's, run by run: its mean, paired error (±, 95%) and runs. */
function lost(base: readonly number[], row: readonly number[] | undefined): { value: number; margin: number; runs: number } | undefined {
  if (!row?.length) return undefined;
  const p = paired(row, base);
  return { value: p.gain, margin: p.margin, runs: p.runs };
}

/** The worth step (see the module comment), over the engine's variants. */
export function worthStep(input: Pick<WorthInput, 'budget' | 'runs' | 'cap' | 'cursor'>, deps: WorthDeps): WorthStep {
  const budget = Math.max(0, Math.floor(input.budget));
  const start = Math.max(2, Math.floor(input.runs ?? SEARCH_RUNS.start));
  const cap = Math.max(start, Math.floor(input.cap ?? SEARCH_RUNS.cap));
  const before = input.cursor?.evaluations ?? 0;
  let spent = 0;
  let subjects = input.cursor?.subjects ? structuredClone(input.cursor.subjects) : undefined;
  let passes = input.cursor?.passes ? structuredClone(input.cursor.passes) : undefined;
  let converged = input.cursor?.converged ?? false;
  if (!subjects && budget > 0) {
    subjects = [...deps.subjects()];
    spent += 1;
  }
  if (subjects && !passes)
    passes = {
      base: [],
      target: start,
      rows: subjects.flatMap((s) =>
        s.forced ? [] : ([{ kind: 'without', unit: s.unit }, ...(s.utility ? [{ kind: 'idle', unit: s.unit } as const] : [])] as WorthVariant[]).map((variant) => ({ key: variantKey(variant), variant, samples: [], built: false })),
      ),
    };
  if (passes && !converged) {
    const f = fill(passes, budget - spent, cap, deps.samples);
    spent += f.spent;
    converged = f.done;
  }
  const rowOf = (kind: 'without' | 'idle', u: RosterUnit) => passes?.rows.find((r) => r.variant.kind === kind && r.variant.unit === u)?.samples;
  const units: UnitWorth[] = (subjects ?? []).map((s) => {
    if (s.forced) return { unit: s.unit, forced: true, worth: undefined, margin: undefined, utility: undefined, utilityMargin: undefined, runs: 0, children: s.children, settled: true };
    const w = lost(passes!.base!, rowOf('without', s.unit));
    const u = s.utility ? lost(passes!.base!, rowOf('idle', s.unit)) : w && { value: 0, margin: 0, runs: w.runs };
    const runs = Math.min(w?.runs ?? 0, u?.runs ?? Infinity);
    return { unit: s.unit, forced: false, worth: w?.value, margin: w?.margin, utility: u?.value, utilityMargin: u?.margin, runs, children: s.children, settled: runs >= cap };
  });
  units.sort((a, b) => Number(a.forced) - Number(b.forced) || (b.worth ?? -Infinity) - (a.worth ?? -Infinity) || a.unit.localeCompare(b.unit));
  return {
    units,
    converged,
    evaluations: spent,
    cursor: { evaluations: before + spent, ...(subjects ? { subjects } : {}), ...(passes ? { passes } : {}), converged },
  };
}

/** A reserve's reading: the chance it restores over the likely losses (weighted), and the loss it restores most of. */
export type ReserveReading = WishlistReserve & { readonly restores: number; readonly margin: number; readonly runs: number };

/** A likely loss: a wishlist unit, how often the plan's runs lose it, and its weight among the likely losses. */
export type LikelyLoss = { readonly unit: RosterUnit; readonly chance: number; readonly weight: number };

export type ReservesCursor = {
  readonly evaluations: number;
  readonly losses?: LikelyLoss[];
  readonly candidates?: RosterUnit[];
  readonly passes?: Passes;
  readonly converged?: boolean;
};

export type ReservesInput = Omit<WorthInput, 'cursor'> & { readonly cursor?: ReservesCursor };

export type ReservesStep = {
  /** The reserves in order (who steps in first), those that restore some chance; each names the loss it mainly covers. */
  readonly reserves: readonly ReserveReading[];
  /** The likely losses they're ranked against. */
  readonly losses: readonly LikelyLoss[];
  /** The plan with its reserves listed: nothing else changes (no EXP is set aside for them). */
  readonly plan: Plan;
  readonly converged: boolean;
  readonly evaluations: number;
  readonly cursor: ReservesCursor;
};

/** What a reserves step needs: the plan's likely losses over its first runs, the candidates, and each variant's runs. */
export type ReservesDeps = {
  /** Each unit the plan's runs `0..runs-1` lose, and how often. */
  readonly losses: (runs: number) => readonly { readonly unit: string; readonly chance: number }[];
  /** The wishlist's units (the likely losses are among them, forced units apart). */
  readonly wishlist: readonly RosterUnit[];
  /** Units the plan has by the endpoint that aren't on the wishlist. */
  readonly candidates: () => readonly RosterUnit[];
  readonly samples: (variant: WorthVariant, first: number, count: number) => readonly number[];
};

/** The reserves step (see the module comment). */
export function reservesStep(input: Pick<ReservesInput, 'plan' | 'budget' | 'runs' | 'cap' | 'cursor'>, deps: ReservesDeps): ReservesStep {
  const budget = Math.max(0, Math.floor(input.budget));
  const start = Math.max(2, Math.floor(input.runs ?? SEARCH_RUNS.start));
  const cap = Math.max(start, Math.floor(input.cap ?? SEARCH_RUNS.cap));
  const before = input.cursor?.evaluations ?? 0;
  let spent = 0;
  let losses = input.cursor?.losses ? structuredClone(input.cursor.losses) : undefined;
  let candidates = input.cursor?.candidates ? [...input.cursor.candidates] : undefined;
  let passes = input.cursor?.passes ? structuredClone(input.cursor.passes) : undefined;
  let converged = input.cursor?.converged ?? false;
  if (!losses && budget > 0) {
    // The likely losses: read on the plan's first runs (the runs the variants are compared on).
    const on = new Set(deps.wishlist.filter((u) => !FORCED_UNITS.includes(u)));
    const top = deps
      .losses(start)
      .filter((l): l is { unit: RosterUnit; chance: number } => on.has(l.unit as RosterUnit) && l.chance > 0)
      .slice(0, LIKELY_LOSSES);
    const total = top.reduce((a, l) => a + l.chance, 0);
    losses = top.map((l) => ({ unit: l.unit, chance: l.chance, weight: l.chance / total }));
    candidates = [...deps.candidates()];
    spent += start;
  }
  if (losses && candidates && !passes)
    passes = {
      // The plan's own runs aren't compared here: only the losses with and without each reserve.
      base: null,
      target: start,
      rows: candidates.length
        ? losses.flatMap((l) => [null, ...candidates!].map((reserve) => ({ key: variantKey({ kind: 'cover', loss: l.unit, reserve }), variant: { kind: 'cover', loss: l.unit, reserve } as WorthVariant, samples: [], built: false })))
        : [],
    };
  if (passes && !converged) {
    const f = fill(passes, budget - spent, cap, deps.samples);
    spent += f.spent;
    converged = f.done;
  }
  const reserves: ReserveReading[] = [];
  if (losses && candidates && passes) {
    const row = (loss: RosterUnit, reserve: RosterUnit | null) => passes!.rows.find((r) => r.variant.kind === 'cover' && r.variant.loss === loss && r.variant.reserve === reserve)?.samples ?? [];
    for (const c of candidates) {
      const n = Math.min(...losses.flatMap((l) => [row(l.unit, null).length, row(l.unit, c).length]));
      if (!n || !Number.isFinite(n)) continue;
      // Per run: the chance it restores, summed over the losses by their weights; and per loss.
      const diff = Array.from({ length: n }, (_, r) => losses!.reduce((a, l) => a + l.weight * (row(l.unit, c)[r]! - row(l.unit, null)[r]!), 0));
      const p = paired(Array(n).fill(0), diff);
      const byLoss = losses.map((l) => ({ unit: l.unit, restores: l.weight * paired(row(l.unit, null).slice(0, n), row(l.unit, c).slice(0, n)).gain }));
      const covers = byLoss.reduce((a, b) => (b.restores > a.restores ? b : a)).unit;
      if (p.gain > 0) reserves.push({ unit: c, covers, restores: p.gain, margin: p.margin, runs: p.runs });
    }
  }
  reserves.sort((a, b) => b.restores - a.restores || a.unit.localeCompare(b.unit));
  return {
    reserves,
    losses: losses ?? [],
    plan: { ...input.plan, wishlist: { ...input.plan.wishlist, reserves: reserves.map(({ unit, covers }) => ({ unit, covers })) } },
    converged: converged || (!!passes && !passes.rows.length),
    evaluations: spent,
    cursor: { evaluations: before + spent, ...(losses ? { losses } : {}), ...(candidates ? { candidates } : {}), ...(passes ? { passes } : {}), converged: converged || (!!passes && !passes.rows.length) },
  };
}

/** A lineup without some units: a Back whose Lead is gone leads alone; a pair with neither is dropped. */
function lineupWithout<L extends LineupPlan>(l: L, gone: ReadonlySet<RosterUnit>): L {
  const pairs = l.pairs.flatMap((p) => {
    const lead = gone.has(p.lead) ? undefined : p.lead;
    const back = p.back && !gone.has(p.back) ? p.back : undefined;
    return lead ? [{ lead, ...(back ? { back } : {}) }] : back ? [{ lead: back }] : [];
  });
  return { ...l, pairs, solo: l.solo.filter((u) => !gone.has(u)) };
}

/**
 * The simulation's input without some units (see the module comment): out of the army, the later recruits and the
 * named lineups; a recruit fielded from turn 1 of the map it joins on (forced there) is fielded on that map alone; a
 * child it would bring (it's a parent) doesn't join; the plan's couples with it don't marry; its class changes go.
 */
export function withoutUnits(input: RunSimInput, gone: ReadonlySet<RosterUnit>): RunSimInput {
  const out = (a: { readonly id: RosterUnit }) => gone.has(a.id);
  const child = (c: ChildRecruit) => gone.has(c.id) || c.parents.some((p) => p !== 'maiden' && gone.has(p));
  const maps: RunSimMap[] = input.maps.map((m) => {
    const { children, ...rest } = m;
    const kept = children?.filter((c) => !child(c));
    return {
      ...rest,
      joining: m.joining.filter((a) => !out(a)),
      mapOnly: [...m.mapOnly, ...m.joining.filter(out)],
      later: m.later.filter((a) => !out(a)),
      ...(kept?.length ? { children: kept } : {}),
    };
  });
  return {
    ...input,
    army: input.army.filter((a) => !out(a)),
    maps,
    ...(input.couples ? { couples: input.couples.filter((c) => !c.some((u) => gone.has(u))) } : {}),
    ...(input.lineups ? { lineups: input.lineups.map((l) => l && lineupWithout(l, gone)) } : {}),
    ...(input.seals ? { seals: input.seals.filter((s) => !gone.has(s.unit)) } : {}),
  };
}

/** Whether a unit has anything to idle (#202): a staff, a Dance, or a Rally skill it holds or its classes teach. */
export function hasUtility(u: Pick<ArmyUnit, 'classId' | 'skills'> & { readonly items?: ArmyUnit['items'] }, classes: readonly string[] = []): boolean {
  if (u.items?.some((i) => i.item.kind === 'staff')) return true;
  const all = [u.classId, ...classes];
  if (all.includes('dancer')) return true;
  const rallies = new Set<string>(RALLY_SKILLS.map((id) => SKILLS[id]?.name ?? id));
  if (u.skills.some((s) => rallies.has(s))) return true;
  return all.some((c) => (CLASS_SKILLS[c as keyof typeof CLASS_SKILLS] ?? []).some((x) => (RALLY_SKILLS as readonly string[]).includes(x.skill)));
}

/** The children of a plan a unit takes with it: those it parents that aren't recruited yet. */
export function childrenOf(plan: Plan, unit: RosterUnit, recruited: ReadonlySet<RosterUnit>): ChildId[] {
  return plan.wishlist.children.filter((c) => c.parents.includes(unit) && !recruited.has(c.child)).map((c) => c.child);
}

/** The run with some units gone (dead): the seed and the wishlist rebuild never field them. */
const runWithout = (run: Run, gone: ReadonlySet<RosterUnit>): Run => ({ ...run, roster: [...gone].reduce((r, u) => withState(r, u, 'dead'), run.roster) });

/**
 * The plan without a unit and the children it takes with it (see the module comment): the spouse re-matched (unless
 * the marriage is recorded), the wishlist rebuilt for the army left, the roadmap re-solved greedily where the unit was
 * named. `recorded` are the recorded couples, facts that stay.
 */
export function planWithout(
  run: Run,
  ctx: SeedContext,
  options: SeedOptions,
  plan: Plan,
  gone: ReadonlySet<RosterUnit>,
  recorded: readonly (readonly [RosterUnit, RosterUnit])[],
): Plan {
  const facts = new Set(recorded.map((c) => coupleKey(c)));
  const without = runWithout(withPlanRobin(run, plan), gone);
  const broken = plan.wishlist.marriages.filter((c) => c.some((u) => gone.has(u)) && !facts.has(coupleKey(c)));
  const marriages = plan.wishlist.marriages.filter((c) => !broken.includes(c));
  const spouses = broken.flatMap((c) => c.filter((u) => !gone.has(u)));
  if (spouses.length) {
    // The spouse marries again: the seed's match for it, every other couple (and the player's pins) kept.
    const pins: PlanPin[] = [...(options.pins ?? []).filter((p) => p.kind !== 'marriage'), ...marriages.map((couple) => ({ kind: 'marriage' as const, couple }))];
    const again = seedPlan(without, ctx, { ...options, pins });
    for (const c of again.wishlist.marriages) if (c.some((u) => spouses.includes(u)) && !marriages.some((m) => m.some((u) => c.includes(u)))) marriages.push(c);
  }
  const next = planFor(without, ctx, options, plan.robin, marriages);
  const end = next.wishlist.endpoint;
  const touched = (l: PlanLineup) => [...l.pairs.flatMap((p) => [p.lead, ...(p.back ? [p.back] : [])]), ...l.solo].some((u) => gone.has(u));
  const lineups = [...plan.roadmap.lineups.filter((l) => l.key !== end && !touched(l)), ...next.roadmap.lineups.filter((l) => l.key === end)];
  const at = new Map(plan.roadmap.order.map((k, i) => [k, i]));
  lineups.sort((a, b) => (at.get(a.key) ?? 0) - (at.get(b.key) ?? 0));
  const children = next.wishlist.children.map((c) => {
    const p = plan.wishlist.children.find((x) => x.child === c.child && x.parents[0] === c.parents[0] && x.parents[1] === c.parents[1]);
    return p ? { ...c, passes: p.passes } : c;
  });
  const seals = next.roadmap.seals.map((x) => plan.roadmap.seals.find((y) => y.unit === x.unit && y.seal === x.seal) ?? x);
  const order = [...plan.roadmap.order].sort().join() === [...next.roadmap.order].sort().join() ? plan.roadmap.order : next.roadmap.order;
  const merged: Plan = {
    ...next,
    wishlist: { ...next.wishlist, children, reserves: [] },
    roadmap: { order, lineups, seals, items: plan.roadmap.items.filter((i) => !gone.has(i.unit)) },
  };
  return placedForSupports(without, ctx.assumptions, merged);
}

/**
 * The endpoint lineup of a plan without a lost unit, with a reserve in its slot (null: the slot left empty): the Lead
 * of its pair, the Back, or alone, as the unit stood on the plan's wishlist.
 */
export function coveredLineup(plan: Plan, lost: RosterUnit, gone: ReadonlySet<RosterUnit>, reserve: RosterUnit | null): PlanLineup | undefined {
  const l = plan.roadmap.lineups.find((x) => x.key === plan.wishlist.endpoint);
  if (!l) return undefined;
  const r = reserve && !gone.has(reserve) ? reserve : undefined;
  // The reserve leaves wherever it stood, then takes the lost unit's slot.
  const taken = new Set([...gone, ...(r ? [r] : [])]);
  const pairs = l.pairs.flatMap((p) => {
    const lead = p.lead === lost ? r : taken.has(p.lead) ? undefined : p.lead;
    const back = !p.back ? undefined : p.back === lost ? r : taken.has(p.back) ? undefined : p.back;
    return lead ? [{ lead, ...(back ? { back } : {}) }] : back ? [{ lead: back }] : [];
  });
  const solo = l.solo.flatMap((u) => (u === lost ? (r ? [r] : []) : taken.has(u) ? [] : [u]));
  return { key: l.key, pairs, solo };
}
