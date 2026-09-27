/**
 * The Robin alternatives and the Robin Lock (#201; spec #175, The joint solve: Robin; user stories 4–7, 13–14).
 *
 * Robin decides the most marriages, so each Robin option is compared as a whole wishlist. An option is Robin's gender,
 * asset and flaw, where the run facts leave them open (both genders × 8 assets × 7 flaws: 112 on a fresh run; the
 * data allows HP as asset or flaw, so there are 56 per gender, not the spec's 20).
 *
 * - **Screened, every option:** its seed (the seed plan with Robin set to it) and its ceiling (the endpoint's flawless
 *   chance at caps for that seed's army: no plan with that Robin's marriages beats it). No run is played.
 * - **Solved in full:** the best of each gender (the one the seed picks for that gender: its own coverage and its
 *   spouse's children's), then up to `ROBIN_EXTRA` more whose ceiling could beat the best found (not below its chance
 *   less its margin), highest ceiling first; any other on request. A solve is the local search's (`solveStep`) on the
 *   run with Robin set to the option, within `ROBIN_SOLVE.search` evaluations, and its best plan is then played on the
 *   first `ROBIN_SOLVE.compare` runs of the seed.
 * - **The cost:** each solved Robin's whole-wishlist chance less the reference's, on the same runs (the same seed, run
 *   by run: paired, ±95%), and how its wishlist differs from the reference's (marriages, units fielded at the endpoint,
 *   endpoint classes). The reference is the best Robin solved; once Robin is locked, the locked one.
 * - **The Lock** (`withRobinLock`) writes the Robin into the run facts and pins it (a `robin-lock` pin, naming the facts it
 *   filled). From then on only the locked Robin is solved (the seed and the search read the facts); the alternatives
 *   are read on the run with the lock lifted (its facts opened again), none solved unless asked, and those solved before
 *   the Lock (the cursor carries them) stay visible as "what this lock cost": the most any solved alternative gains over
 *   the locked Robin.
 * - **The no-Robin view** (on request): the reference's plan with Robin no one's parent (Robin's marriage dropped, so
 *   Morgan leaves; Robin still fights, as the game forces), the rest of the wishlist rebuilt for it, on the same runs:
 *   what Robin's marriage is worth.
 *
 * **Anytime:** a stepping call like the search's (`step.ts`): a budget in evaluations (one simulated run of one plan;
 * a gender's seed, or an option's seed and ceiling, counts one), a plain-JSON cursor to resume from. Deterministic.
 */
import { STATS, type Gender } from '../../game-data/stats';
import type { ClassId } from '../../game-data/classes';
import { withRun, type RosterUnit, type RunFacts } from '../roster';
import type { Run } from '../run';
import { paired, scoreOf, verdictOf } from './paired';
import type { Plan, PlanRobin, RobinFact, RobinLockPin, SolveCursor } from './plan';
import { planFor, type SeedContext, type SeedOptions } from './seed';
import { withPin } from './pins';
import type { SolveStep } from './step';

/**
 * A Robin's solve: evaluations its search may spend, fresh runs its search re-scores the best plan on (the riskiest
 * maps its lineup edits read), and the runs its best plan is compared on.
 */
export const ROBIN_SOLVE = { search: 48, display: 8, compare: 16 } as const;

/** Robins solved beyond the best of each gender, when their ceiling could beat the best found. */
export const ROBIN_EXTRA = 2;

/** A Robin option as a key: `M-mag-str`. */
export const robinKey = (r: PlanRobin): string => `${r.gender}-${r.asset}-${r.flaw}`;

/** Every Robin option the facts leave open, genders first (M, F), then asset and flaw in stat order. */
export function robinOptions(facts: Pick<RunFacts, RobinFact>): PlanRobin[] {
  const out: PlanRobin[] = [];
  for (const gender of facts.gender ? [facts.gender] : (['M', 'F'] as const))
    for (const asset of facts.asset ? [facts.asset] : STATS)
      for (const flaw of facts.flaw ? [facts.flaw] : STATS) if (asset !== flaw) out.push({ gender, asset, flaw });
  return out;
}

/** The run with Robin locked (#201): the Robin written into the run facts, and a `robin-lock` pin naming the facts it filled. */
export function withRobinLock(run: Run, robin: PlanRobin): Run {
  const facts = run.roster.run;
  const held = (run.pins ?? []).find((p): p is RobinLockPin => p.kind === 'robin-lock');
  // A lock over a lock keeps the facts the first one opened.
  const open = held ? held.open : (['gender', 'asset', 'flaw'] as const).filter((f) => !facts[f]);
  const locked = { ...run, roster: withRun(run.roster, { gender: robin.gender, asset: robin.asset, flaw: robin.flaw }) };
  return withPin(locked, { kind: 'robin-lock', robin, open });
}

/** The run's Robin Lock, if any. */
export const robinLock = (run: Run): RobinLockPin | undefined => (run.pins ?? []).find((p): p is RobinLockPin => p.kind === 'robin-lock');

/** How one plan's wishlist differs from another's: marriages, units fielded at the endpoint, endpoint classes. */
export type WishlistDifference = {
  /** Couples it marries that the other doesn't, and the other's it doesn't. */
  readonly marriages: { readonly added: readonly (readonly [RosterUnit, RosterUnit])[]; readonly removed: readonly (readonly [RosterUnit, RosterUnit])[] };
  /** Units it fields at the endpoint that the other doesn't, and the other's it doesn't. */
  readonly units: { readonly added: readonly RosterUnit[]; readonly removed: readonly RosterUnit[] };
  /** Units both field, in another endpoint class. */
  readonly classes: readonly { readonly unit: RosterUnit; readonly from: ClassId; readonly to: ClassId }[];
};

const coupleId = (c: readonly [RosterUnit, RosterUnit]) => [...c].sort().join('+');

/** How `to`'s wishlist differs from `from`'s. */
export function wishlistDifference(from: Plan, to: Plan): WishlistDifference {
  const a = new Set(from.wishlist.marriages.map(coupleId));
  const b = new Set(to.wishlist.marriages.map(coupleId));
  const ua = new Map(from.wishlist.units.map((w) => [w.unit, w]));
  const ub = new Map(to.wishlist.units.map((w) => [w.unit, w]));
  return {
    marriages: { added: to.wishlist.marriages.filter((c) => !a.has(coupleId(c))), removed: from.wishlist.marriages.filter((c) => !b.has(coupleId(c))) },
    units: { added: [...ub.keys()].filter((u) => !ua.has(u)), removed: [...ua.keys()].filter((u) => !ub.has(u)) },
    classes: [...ub.values()].flatMap((w) => {
      const x = ua.get(w.unit);
      return x && x.classId !== w.classId ? [{ unit: w.unit, from: x.classId, to: w.classId }] : [];
    }),
  };
}

/** Why an option is solved: the best of its gender, a ceiling that could beat the best found, the player's request, or the Lock. */
export type RobinPick = 'gender' | 'ceiling' | 'requested' | 'locked';

/** A cost against the reference, on the same runs: the gain (negative: it loses), its paired error (±, 95%) and verdict. */
export type RobinCost = { readonly gain: number; readonly margin: number; readonly runs: number; readonly verdict: 'better' | 'worse' | 'close' };

/** One Robin option: its screening (seed's spouse for Robin, ceiling), and where its solve stands. */
export type RobinOption = {
  readonly key: string;
  readonly robin: PlanRobin;
  readonly screened: boolean;
  /** Robin's spouse in the option's seed (null: unmarried). */
  readonly spouse: RosterUnit | null;
  /** The seed's ceiling; undefined unscreened or without one. */
  readonly ceiling: number | undefined;
  readonly pick?: RobinPick;
  readonly status: 'open' | 'queued' | 'solving' | 'solved';
};

/** A solved Robin: its best plan, its chance on the compared runs, and its cost and differences against the reference. */
export type SolvedRobin = {
  readonly key: string;
  readonly robin: PlanRobin;
  readonly pick: RobinPick;
  readonly plan: Plan;
  readonly chance: number;
  readonly margin: number;
  readonly runs: number;
  /** Its search converged within its budget. */
  readonly converged: boolean;
  /** Against the reference; undefined for the reference itself. */
  readonly cost: RobinCost | undefined;
  readonly differences: WishlistDifference;
};

type Solve = { pick: RobinPick; cursor?: SolveCursor; spent: number; plan?: Plan; searched: boolean; converged: boolean; samples: number[] };

/** Where the Robin alternatives stand (plain JSON): pass it back unchanged, across the Lock too. */
export type RobinCursor = {
  readonly evaluations: number;
  /** The lock the queue was made for (a Robin's key, or '' unlocked): a new lock remakes the queue, keeping the rest. */
  readonly lock?: string;
  /** The auto queue's picks, in solve order (keys): the best of each gender, or the locked Robin; then the extras. */
  readonly queue?: { key: string; pick: RobinPick }[];
  readonly extras?: boolean;
  readonly screened?: Record<string, { spouse: RosterUnit | null; ceiling: number | null }>;
  readonly solves?: Record<string, Solve>;
  readonly noRobin?: { key: string; plan: Plan; samples: number[] };
};

export type RobinInput = {
  readonly run: Run;
  readonly seed: number;
  readonly budget: number;
  readonly cursor?: RobinCursor;
  /** Options the player asks to solve (keys), solved first. */
  readonly solve?: readonly string[];
  /** Work out the no-Robin view. */
  readonly noRobin?: boolean;
  /** A Robin's search: runs an edit is first compared on, and its cap (the search's defaults). */
  readonly runs?: number;
  readonly cap?: number;
  /** A Robin's search budget, re-score runs and compared runs; `ROBIN_SOLVE` by default. */
  readonly search?: number;
  readonly display?: number;
  readonly compare?: number;
};

export type RobinStep = {
  /** Every option, in option order. */
  readonly options: readonly RobinOption[];
  /** The solved Robins, the reference first, then by chance. */
  readonly solved: readonly SolvedRobin[];
  /** The reference: the best solved, or the locked Robin. */
  readonly reference: string | undefined;
  readonly locked: PlanRobin | undefined;
  /** Once locked: the most a solved alternative gains over the locked Robin (the best of them), when one does. */
  readonly lockCost: (RobinCost & { readonly key: string }) | undefined;
  /** The no-Robin view, when asked for and worked out. */
  readonly noRobin: { readonly plan: Plan; readonly chance: number; readonly margin: number; readonly cost: RobinCost; readonly spouse: RosterUnit | null } | undefined;
  readonly converged: boolean;
  readonly evaluations: number;
  readonly cursor: RobinCursor;
};

/** What the alternatives need from the engine, each for one Robin (the run with Robin set to it). */
export type RobinDeps = {
  /** The options (the run with the lock lifted), and the Robin locked, if any. */
  readonly options: readonly PlanRobin[];
  readonly locked: PlanRobin | undefined;
  /** The genders open, and the Robin the seed picks for one. */
  readonly genders: readonly Gender[];
  readonly genderBest: (g: Gender) => PlanRobin;
  /** An option's seed and its ceiling. */
  readonly screen: (r: PlanRobin) => { readonly plan: Plan; readonly ceiling: number | undefined };
  /** One step of an option's search. */
  readonly solve: (r: PlanRobin, cursor: SolveCursor | undefined, budget: number) => SolveStep;
  /** Runs `first`… of a plan for an option, on the seed. */
  readonly samples: (r: PlanRobin, plan: Plan, first: number, count: number) => readonly number[];
  /** A plan with Robin no one's parent. */
  readonly noRobin: (r: PlanRobin, plan: Plan) => Plan;
};

const spouseOf = (plan: Plan): RosterUnit | null => plan.wishlist.marriages.find((c) => c.includes('robin'))?.find((u) => u !== 'robin') ?? null;

const costOf = (ref: readonly number[], x: readonly number[]): RobinCost => {
  const p = paired(ref, x);
  const v = verdictOf(p);
  return { gain: p.gain, margin: p.margin, runs: p.runs, verdict: v === 'unclear' ? 'close' : v };
};

export function robinStep(input: RobinInput, deps: RobinDeps): RobinStep {
  const budget = Math.max(0, Math.floor(input.budget));
  const search = Math.max(1, Math.floor(input.search ?? ROBIN_SOLVE.search));
  const compare = Math.max(2, Math.floor(input.compare ?? ROBIN_SOLVE.compare));
  const before = input.cursor?.evaluations ?? 0;
  const c = structuredClone(input.cursor ?? { evaluations: 0 }) as { -readonly [K in keyof RobinCursor]: RobinCursor[K] };
  const screened = (c.screened ??= {});
  const solves = (c.solves ??= {});
  const byKey = new Map(deps.options.map((r) => [robinKey(r), r]));
  const lockKey = deps.locked ? robinKey(deps.locked) : '';
  if (c.lock !== lockKey) {
    // A new lock (or none): the auto queue is made again; screenings and solves stay (the same runs, the same seed).
    c.lock = lockKey;
    delete c.queue;
    c.extras = false;
  }
  let spent = 0;
  const requested = (input.solve ?? []).filter((k) => byKey.has(k) || k === lockKey);
  const robinOf = (k: string) => byKey.get(k) ?? deps.locked!;
  /** The reference's samples: the locked Robin's, else the best solved's. */
  const done = (k: string) => !!solves[k]?.searched && solves[k]!.samples.length >= compare;
  const reference = (): string | undefined => {
    if (lockKey) return done(lockKey) ? lockKey : undefined;
    let best: { k: string; chance: number } | undefined;
    for (const k of Object.keys(solves)) {
      if (!done(k) || !byKey.has(k)) continue;
      const chance = scoreOf(solves[k]!.samples.slice(0, compare)).chance;
      if (!best || chance > best.chance) best = { k, chance };
    }
    return best?.k;
  };
  const queued = () => [...requested.map((key) => ({ key, pick: 'requested' as const })), ...(c.queue ?? [])];

  while (spent < budget) {
    const left = budget - spent;
    if (!c.queue) {
      c.queue = deps.locked ? [{ key: lockKey, pick: 'locked' }] : deps.genders.map((g) => ({ key: robinKey(deps.genderBest(g)), pick: 'gender' as const }));
      spent += deps.locked ? 0 : deps.genders.length;
      continue;
    }
    const next = queued().find((q) => !done(q.key));
    if (next) {
      const r = robinOf(next.key);
      const s = (solves[next.key] ??= { pick: next.pick, spent: 0, searched: false, converged: false, samples: [] });
      if (!s.searched) {
        const st = deps.solve(r, s.cursor, Math.min(left, search - s.spent));
        spent += Math.max(1, st.evaluations);
        s.spent += Math.max(1, st.evaluations);
        s.plan = st.best;
        s.cursor = st.cursor;
        if (st.converged || s.spent >= search) {
          // The search's own runs of its best plan are the first compared runs (the same seed).
          const kept = st.cursor.search;
          s.samples = kept && JSON.stringify(kept.best) === JSON.stringify(st.best) ? kept.bestSamples.slice(0, compare) : [];
          s.searched = true;
          s.converged = st.converged;
          delete s.cursor;
        }
        continue;
      }
      const k = Math.min(left, compare - s.samples.length);
      s.samples.push(...deps.samples(r, s.plan!, s.samples.length, k));
      spent += k;
      continue;
    }
    const open = deps.options.find((r) => !screened[robinKey(r)]);
    if (open) {
      const x = deps.screen(open);
      screened[robinKey(open)] = { spouse: spouseOf(x.plan), ceiling: x.ceiling ?? null };
      spent += 1;
      continue;
    }
    if (!c.extras) {
      c.extras = true;
      const ref = reference();
      if (!deps.locked && ref) {
        // Up to ROBIN_EXTRA more whose ceiling could beat the best found, highest ceiling first (no ceiling: it could).
        const found = scoreOf(solves[ref]!.samples.slice(0, compare));
        const taken = new Set(queued().map((q) => q.key));
        const extras = deps.options
          .map((r, i) => ({ k: robinKey(r), i, ceiling: screened[robinKey(r)]?.ceiling ?? Infinity }))
          .filter((x) => !taken.has(x.k) && !done(x.k) && x.ceiling >= found.chance - found.margin)
          .sort((a, b) => b.ceiling - a.ceiling || a.i - b.i)
          .slice(0, ROBIN_EXTRA);
        c.queue = [...c.queue, ...extras.map((x) => ({ key: x.k, pick: 'ceiling' as const }))];
      }
      continue;
    }
    const ref = reference();
    if (input.noRobin && ref && spouseOf(solves[ref]!.plan!) !== null) {
      if (c.noRobin?.key !== ref) {
        c.noRobin = { key: ref, plan: deps.noRobin(robinOf(ref), solves[ref]!.plan!), samples: [] };
        spent += 1;
        continue;
      }
      if (c.noRobin.samples.length < compare) {
        const k = Math.min(left, compare - c.noRobin.samples.length);
        c.noRobin.samples.push(...deps.samples(robinOf(ref), c.noRobin.plan, c.noRobin.samples.length, k));
        spent += k;
        continue;
      }
    }
    break;
  }

  const ref = reference();
  const refSamples = ref ? solves[ref]!.samples.slice(0, compare) : undefined;
  const refPlan = ref ? solves[ref]!.plan : undefined;
  const picks = new Map(queued().map((q) => [q.key, q.pick]));
  const head = queued().find((q) => !done(q.key))?.key;
  const options: RobinOption[] = deps.options.map((r) => {
    const k = robinKey(r);
    const sc = screened[k];
    const pick = picks.get(k) ?? solves[k]?.pick;
    return {
      key: k,
      robin: r,
      screened: !!sc,
      spouse: sc?.spouse ?? null,
      ceiling: sc?.ceiling ?? undefined,
      ...(pick ? { pick } : {}),
      status: done(k) ? 'solved' : k === head && solves[k] ? 'solving' : picks.has(k) ? 'queued' : 'open',
    };
  });
  const solved: SolvedRobin[] = Object.entries(solves)
    .filter(([k]) => done(k) && (byKey.has(k) || k === lockKey))
    .map(([k, s]) => {
      const samples = s.samples.slice(0, compare);
      const score = scoreOf(samples);
      return {
        key: k,
        robin: robinOf(k),
        pick: k === lockKey ? 'locked' : (picks.get(k) ?? s.pick),
        plan: s.plan!,
        chance: score.chance,
        margin: score.margin,
        runs: samples.length,
        converged: s.converged,
        cost: k === ref || !refSamples ? undefined : costOf(refSamples, samples),
        differences: refPlan ? wishlistDifference(refPlan, s.plan!) : wishlistDifference(s.plan!, s.plan!),
      };
    })
    .sort((a, b) => Number(b.key === ref) - Number(a.key === ref) || b.chance - a.chance || a.key.localeCompare(b.key));
  const gains = lockKey ? solved.filter((s) => s.key !== lockKey && s.cost?.verdict === 'better').sort((a, b) => b.cost!.gain - a.cost!.gain) : [];
  const lockCost = gains[0] ? { ...gains[0].cost!, key: gains[0].key } : undefined;
  const nr = c.noRobin && c.noRobin.key === ref && refSamples && c.noRobin.samples.length >= compare ? c.noRobin : undefined;
  const noRobin = nr && input.noRobin ? { plan: nr.plan, ...chanceOf(scoreOf(nr.samples)), cost: costOf(refSamples!, nr.samples), spouse: spouseOf(refPlan!) } : undefined;
  const converged = !queued().some((q) => !done(q.key)) && deps.options.every((r) => screened[robinKey(r)]) && !!c.extras && (!input.noRobin || !!noRobin || !ref || spouseOf(refPlan!) === null);
  return {
    options,
    solved,
    reference: ref,
    locked: deps.locked,
    lockCost,
    noRobin,
    converged,
    evaluations: spent,
    cursor: { ...c, evaluations: before + spent },
  };
}

const chanceOf = (s: { chance: number; margin: number }) => ({ chance: s.chance, margin: s.margin });

/**
 * The no-Robin view's plan (#201): `plan` with Robin's marriage dropped (Robin no one's parent: Morgan leaves), the
 * wishlist rebuilt for the marriages left (`planFor`), the roadmap's named lineups, order and class changes kept where
 * they still hold.
 */
export function withoutRobinMarriage(run: Run, ctx: SeedContext, options: SeedOptions, plan: Plan): Plan {
  const marriages = plan.wishlist.marriages.filter((c) => !c.includes('robin'));
  const next = planFor(run, ctx, options, plan.robin, marriages);
  const end = next.wishlist.endpoint;
  const lineups = [...plan.roadmap.lineups.filter((l) => l.key !== end), ...next.roadmap.lineups.filter((l) => l.key === end)];
  const order = [...plan.roadmap.order].sort().join() === [...next.roadmap.order].sort().join() ? plan.roadmap.order : next.roadmap.order;
  const at = new Map(order.map((k, i) => [k, i]));
  lineups.sort((a, b) => (at.get(a.key) ?? 0) - (at.get(b.key) ?? 0));
  return { ...next, roadmap: { ...next.roadmap, order, lineups } };
}

