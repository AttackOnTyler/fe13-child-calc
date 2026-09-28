/**
 * The anytime solve's stepping call (#198, #199; spec #175, The joint solve, Noise and Engine interfaces): given the
 * adopted plan (or none: the seed), the recorded run, the pins and a budget in evaluations, it returns the best plan
 * found so far, the proposals, the close calls, and whether the search has converged. The Web Worker loops it against
 * a time budget and posts each step back; it holds no logic.
 *
 * **An evaluation is one simulated run of one plan** (a run that loses a unit early is cheap; one that reaches the
 * endpoint of the Full route costs about 0.3–0.45 s today). A step spends its budget in pieces: a batch of runs for one
 * plan, never more than the budget left, except the re-score (below), which is one piece and may overrun a step's
 * budget when it's the step's first piece (so a small budget still gets there). Building an edit's plan and reading
 * its milestones and ceiling (below) counts as one evaluation.
 *
 * **The local search** tries single edits on the flawless chance, in the spec's order each round (`EDIT_KINDS`): the
 * marriages and Robin; the endpoint class, one build skill and the passed skills; the lineups, pairs, paralogue places,
 * seals, item uses and side goals. Each edit is compared with the best plan on the same runs (the same seed: common
 * random numbers), starting at `runs` runs: it's kept when its gain is more than twice the paired standard error,
 * dropped when its loss is, and otherwise the runs double, up to `cap`. An edit still unclear at the cap is a close
 * call, read "no measurable difference (−0.2 ±0.3)". A kept edit makes a new best plan and a proposal; a round with no
 * kept edit ends the search (converged).
 *
 * **Noise:** the search's runs pick the plan, so its chance on them is inflated by the selection; the chance the step
 * shows (`chance`) is the best plan's re-scored on fresh runs (a seed derived from `seed`, never the search's), over
 * `display` runs, each time the best plan changes.
 *
 * **Pruning (the ceiling):** a set of marriages (or a Robin) whose ceiling (the endpoint's flawless chance at caps,
 * which no plan with those marriages can beat) is below the best found (its chance on the search's runs, less its
 * margin) isn't evaluated; it's listed in `pruned`.
 *
 * **Non-starters (#194):** an edit that leaves more couples unable to reach S by their deadline than the best plan has
 * is dropped unsimulated; one that leaves fewer is kept whatever its chance does (fixing a marriage that can't happen
 * comes first), and its fixes are tried first. A plan with a non-starter is never offered, as a proposal or a close
 * call. An edit the simulation can't see (`simKey`: nothing it reads changes) is a close call at no cost.
 *
 * **Pins are hard constraints (#200):** the seed and the adopted plan keep them (the facade has them keep them), an
 * edit that breaks one more than the best plan is dropped unsimulated, and no plan breaking one is offered. The runs
 * play every lineup with its span and keep pins (`pinnedLineup`), so a pin holds in play whatever a plan lists.
 *
 * **Proposals never replace the adopted plan:** the step never changes the plan it's given; each kept edit is offered
 * as a proposal with its gain over the adopted plan on the same runs, best first.
 *
 * Deterministic: the same run, plan, pins, budget, seed and cursor give the same step. The cursor is plain JSON (the
 * search's whole state, including the plans it holds), so the worker can post it and a later step resume it.
 * What already happened is the starting state, never a pin: the evaluation reads the log first.
 */
import type { FlawlessChance } from '../flawless';
import type { RosterUnit } from '../roster';
import type { Run } from '../run';
import { paired, scoreOf, verdictOf } from './paired';
import type { CloseCall, Plan, PlanPin, PlanProposal, PrunedComp, SearchState, SolveCursor } from './plan';

/**
 * The search's run counts (spec: runs double from 200 up to a cap; if they don't fit, fewer runs with a wider stated
 * error, never a different objective). A run that reaches the endpoint costs about 0.2–0.3 s on the Main story (the
 * realism pass's measure), plus 0.4–0.6 s for a new plan's projection, so 200 runs of one plan would still take about a
 * minute, twice the full solve's 30 s. The search starts
 * at 8 runs and doubles to 32 (one plan at the cap is about 10 s), and the headline is re-scored on `FLAWLESS_RUNS` (24)
 * fresh runs; the ± on each says what that leaves.
 */
export const SEARCH_RUNS = { start: 8, cap: 32 } as const;

/** The Web Worker's time budgets (spec: about 30 s for a full solve, 5 s for a re-solve after an edit or a recorded map). */
export const SOLVE_SECONDS = { full: 30, resolve: 5 } as const;

/** Evaluations a worker step spends before it posts: small, so the worker checks its clock often. */
export const STEP_BUDGET = 4;

/**
 * An edit's cost budgets (evaluations over both plans): provisional in about 1 s (2 runs each, a wide margin), settled
 * at the search's cap (32 runs each).
 */
export const EDIT_COST_BUDGET = { provisional: 4, settled: 2 * SEARCH_RUNS.cap } as const;

/** The seed of the re-score's fresh runs for a search's seed: never the search's own. */
export const rescoreSeed = (seed: number): number => (seed ^ 0x5eed) >>> 0;

/** The kinds of edit, in the order the search tries them each round (spec #175, The joint solve). */
export const EDIT_KINDS = ['marriage', 'robin', 'class', 'build', 'pass', 'lineup', 'pair', 'priority', 'place', 'seal', 'item', 'side-goal'] as const;
export type EditKind = (typeof EDIT_KINDS)[number];

/** A single edit of a plan: what it changes (`key`, unique within a plan), how it reads, and the edited plan. */
export type Edit = {
  readonly kind: EditKind;
  readonly key: string;
  readonly label: string;
  /** The plan with the edit; built only when the search tries it. */
  readonly make: () => Plan;
  /** The units it touches (the Wishlist tab lists a unit's edits by them, #203). */
  readonly units?: readonly RosterUnit[];
  /** The pins that make it the player's (#203): a marriage's, a lineup's span pins; none where no pin kind holds it. */
  readonly pins?: readonly PlanPin[];
};

/**
 * An edit that touches one unit, as the Wishlist tab lists it (#203): one of the search's single edits, or keeping the
 * unit in or out of the wishlist (a keep pin, #200). `pins` make it the player's (none where no pin kind holds it: it
 * can only come as the search's proposal); `play` are the pins the edited plan plays under, for `editCost` (a keep
 * edit's own).
 */
export type UnitEdit = {
  readonly kind: EditKind | 'keep';
  readonly key: string;
  readonly label: string;
  readonly pins: readonly PlanPin[];
  readonly play: readonly PlanPin[];
  /** The plan with the edit; built only when it's costed. */
  readonly make: () => Plan;
};

/**
 * What the edits read besides the plan: the maps the best plan loses the most on, riskiest first, and the units of its
 * non-starter couples (#194), whose fixes come first.
 */
export type EditHints = { readonly riskiest: readonly string[]; readonly stuck: readonly RosterUnit[] };

export type SolveStepInput = {
  readonly run: Run;
  /** The adopted plan to improve on; absent: the seed. */
  readonly plan?: Plan;
  /** Hard constraints: the seed and every edit keep them. */
  readonly pins?: readonly PlanPin[];
  /** Evaluations (simulated runs of one plan) this step may spend: 0 returns the plan it starts from, unevaluated. */
  readonly budget: number;
  /** Every chance is seeded: edits are compared on the same runs. */
  readonly seed: number;
  /** Runs an edit is first compared on; `SEARCH_RUNS.start` by default. */
  readonly runs?: number;
  /** The most runs an edit is compared on before it's a close call; `SEARCH_RUNS.cap` by default. */
  readonly cap?: number;
  /** Fresh runs the displayed chance is re-scored on; `FLAWLESS_RUNS` by default. */
  readonly display?: number;
  /** The cursor the previous step returned, passed back unchanged; absent on a first step. */
  readonly cursor?: SolveCursor;
};

export type SolveStep = {
  /** The best plan found so far (the adopted plan until an edit beats it). */
  readonly best: Plan;
  /** The best plan's flawless chance on fresh runs, when this step worked it out (each time the best plan changes). */
  readonly chance: FlawlessChance | undefined;
  /** Improvements on the adopted plan, best first: offered, never applied. */
  readonly proposals: readonly PlanProposal[];
  /** Edits still unclear at the run cap: no measurable difference. */
  readonly closeCalls: readonly CloseCall[];
  /** Sets of marriages (or Robins) whose ceiling is below the best found. */
  readonly pruned: readonly PrunedComp[];
  /** No single edit is left to try: a whole round kept none. */
  readonly converged: boolean;
  /** Evaluations this step spent. */
  readonly evaluations: number;
  /** Pass it to the next step. */
  readonly cursor: SolveCursor;
};

/** What the step needs from the engine: the seed, the edits, and a plan's runs, re-score and ceiling. */
export type SearchDeps = {
  readonly seed: () => Plan;
  /** The edits of a plan in `EDIT_KINDS` order; generated lazily, so only the ones tried are built. */
  readonly edits: (plan: Plan, hints: EditHints) => Iterable<Edit>;
  /** Runs `first` to `first + count - 1` of a plan on the search's seed: each run's flawless chance. */
  readonly samples: (plan: Plan, first: number, count: number) => readonly number[];
  /** A plan's flawless chance on `runs` fresh runs from `seed`. */
  readonly rescore: (plan: Plan, seed: number, runs: number) => FlawlessChance;
  /** A plan's ceiling (undefined when there's none). */
  readonly ceiling: (plan: Plan) => number | undefined;
  /** A plan's non-starter couples (#194): marriages that can't reach S by their deadline. None by default. */
  readonly nonStarters?: (plan: Plan) => readonly (readonly [RosterUnit, RosterUnit])[];
  /**
   * What the simulation reads of a plan, as a key: two plans with the same key have the same flawless chance on every
   * run, so an edit that keeps it is a close call at no cost. By default the whole plan.
   */
  readonly simKey?: (plan: Plan) => string;
  /**
   * How many of the pins a plan breaks, as it lists them (#200). An edit that breaks more than the best plan is dropped
   * unsimulated, and a plan that breaks more than the plan the search started from is never offered. None by default.
   */
  readonly brokenPins?: (plan: Plan) => number;
};

const keyOf = (p: Plan) => JSON.stringify(p);
const PRUNABLE = new Set<EditKind>(['marriage', 'robin']);

function freshState(start: Plan): SearchState {
  return {
    start,
    best: start,
    bestSamples: [],
    startSamples: null,
    kept: [],
    proposals: [],
    closeCalls: [],
    pruned: [],
    round: 0,
    tried: [],
    improved: false,
    trial: null,
    scored: false,
    riskiest: [],
    stuck: null,
    converged: false,
  };
}

export function solveStep(input: SolveStepInput, deps: SearchDeps, display: number): SolveStep {
  const budget = Math.max(0, Math.floor(input.budget));
  const start = Math.max(2, Math.floor(input.runs ?? SEARCH_RUNS.start));
  const cap = Math.max(start, Math.floor(input.cap ?? SEARCH_RUNS.cap));
  const spentBefore = input.cursor?.evaluations ?? 0;
  // The search's state: resumed from the cursor unless the adopted plan changed under it.
  const resumed = input.cursor?.search && (!input.plan || keyOf(input.cursor.search.start) === keyOf(input.plan)) ? structuredClone(input.cursor.search) : undefined;
  if (!resumed && budget < 1) {
    const best = input.plan ?? deps.seed();
    return { best, chance: undefined, proposals: [], closeCalls: [], pruned: [], converged: false, evaluations: 0, cursor: { evaluations: spentBefore } };
  }
  const s: SearchState = resumed ?? freshState(input.plan ?? deps.seed());
  let spent = 0;
  let chance: FlawlessChance | undefined;
  const fresh = rescoreSeed(input.seed);

  const stuckOf = (plan: Plan) => deps.nonStarters?.(plan) ?? [];
  const simKey = deps.simKey ?? keyOf;
  // The best plan's non-starters: an edit with more is never taken, one with fewer is taken first.
  s.stuck ??= stuckOf(s.best).map((c) => [...c]);
  /** The next edit of the best plan not yet tried this round; undefined when the round is done. */
  const nextEdit = () => {
    const tried = new Set(s.tried);
    for (const e of deps.edits(s.best, { riskiest: s.riskiest, stuck: [...new Set(s.stuck!.flat())] as RosterUnit[] })) if (!tried.has(e.key)) return e;
    return undefined;
  };
  // Pins (#200) are hard constraints: the start keeps them (the facade has it keep them), and no edit breaks more.
  const broken = (plan: Plan) => deps.brokenPins?.(plan) ?? 0;
  const startBroken = broken(s.start);
  /** A plan is offered (a proposal, a close call) only with no non-starter, and no pin broken the start keeps. */
  const offered = (plan: Plan) => stuckOf(plan).length === 0 && broken(plan) <= startBroken;

  while (!s.converged && spent < budget) {
    const left = budget - spent;
    // The displayed chance: the best plan re-scored on fresh runs, first thing and each time it changes.
    if (!s.scored) {
      if (spent > 0 && left < display) break;
      chance = deps.rescore(s.best, fresh, display);
      spent += display;
      s.scored = true;
      s.riskiest = chance.maps
        .filter((m) => m.noDeath !== undefined && m.noDeath < 1)
        .sort((a, b) => a.noDeath! - b.noDeath! || a.key.localeCompare(b.key))
        .map((m) => m.key);
      continue;
    }
    // The best plan's runs: at least the first comparison's, before any edit is tried against it.
    const need = s.trial?.target ?? start;
    if (s.bestSamples.length < need) {
      const k = Math.min(left, need - s.bestSamples.length);
      s.bestSamples.push(...deps.samples(s.best, s.bestSamples.length, k));
      spent += k;
      continue;
    }
    if (!s.trial) {
      const e = nextEdit();
      if (!e) {
        if (!s.improved) s.converged = true;
        else Object.assign(s, { round: s.round + 1, tried: [], improved: false });
        continue;
      }
      // Building an edit and reading its milestones (and a comp's ceiling) is one evaluation, so a step that only
      // drops edits still ends within its budget.
      const plan = e.make();
      spent += 1;
      if (broken(plan) > broken(s.best)) {
        s.tried.push(e.key);
        continue;
      }
      const stuck = stuckOf(plan).map((c) => [...c]);
      if (stuck.length > s.stuck!.length) {
        s.tried.push(e.key);
        continue;
      }
      if (stuck.length === s.stuck!.length && simKey(plan) === simKey(s.best)) {
        // The simulation can't tell it apart: no measurable difference, at no cost.
        s.tried.push(e.key);
        if (offered(plan)) s.closeCalls = [...s.closeCalls.filter((c) => c.key !== e.key), { key: e.key, plan, label: e.label, gain: 0, margin: 0, runs: 0 }];
        continue;
      }
      if (PRUNABLE.has(e.kind) && stuck.length === s.stuck!.length) {
        // Prune a comp that can't beat the best found.
        const c = deps.ceiling(plan);
        const found = scoreOf(s.bestSamples);
        if (c !== undefined && c < found.chance - found.margin) {
          s.pruned.push({ label: e.label, ceiling: c, best: found.chance });
          s.tried.push(e.key);
          continue;
        }
      }
      s.trial = { kind: e.kind, key: e.key, label: e.label, plan, samples: [], target: start, stuck };
      continue;
    }
    const t = s.trial;
    if (t.samples.length < t.target) {
      const k = Math.min(left, t.target - t.samples.length);
      t.samples.push(...deps.samples(t.plan, t.samples.length, k));
      spent += k;
      continue;
    }
    const p = paired(s.bestSamples.slice(0, t.target), t.samples);
    // Fixing a non-starter comes first: a plan with fewer is kept whatever its chance does.
    const fixes = (t.stuck?.length ?? 0) < s.stuck!.length;
    const v = fixes ? 'better' : verdictOf(p);
    if (v === 'unclear' && t.target < cap) {
      t.target = Math.min(cap, t.target * 2);
      continue;
    }
    s.tried.push(t.key);
    s.trial = null;
    if (v === 'better') {
      if (!s.startSamples) s.startSamples = s.bestSamples;
      s.best = t.plan;
      s.bestSamples = t.samples;
      s.stuck = t.stuck ?? [];
      s.kept.push(t.label);
      const vs = paired(s.startSamples, s.bestSamples);
      // Never a proposal with a non-starter: the plan it fixes on the way is kept, not offered.
      if (!s.stuck.length) {
        s.proposals.push({ plan: t.plan, label: t.label, edits: [...s.kept], gain: vs.gain, margin: vs.margin, runs: vs.runs });
        s.proposals.sort((a, b) => b.gain - a.gain);
      }
      s.improved = true;
      s.scored = false;
    } else if (v === 'unclear' && !t.stuck?.length) {
      s.closeCalls = [...s.closeCalls.filter((c) => c.key !== t.key), { key: t.key, plan: t.plan, label: t.label, gain: p.gain, margin: p.margin, runs: p.runs }];
    }
  }
  return {
    best: s.best,
    chance,
    proposals: s.proposals,
    closeCalls: s.closeCalls,
    pruned: s.pruned,
    converged: s.converged,
    evaluations: spent,
    cursor: { evaluations: spentBefore + spent, search: s },
  };
}

export type EditCostInput = {
  readonly run: Run;
  /** The adopted plan. */
  readonly plan: Plan;
  /** The plan with the edit. */
  readonly edited: Plan;
  readonly seed: number;
  /** Evaluations over both plans: `EDIT_COST_BUDGET.provisional` for the first reading, `.settled` to settle it. */
  readonly budget: number;
  /** Runs it's first compared on, doubling up to `cap`; `SEARCH_RUNS` by default. */
  readonly runs?: number;
  readonly cap?: number;
  /** Pins the edited plan plays under besides the run's: a keep-in or keep-out edit's own (#203, `UnitEdit.play`). */
  readonly pins?: readonly PlanPin[];
};

/**
 * An edit's cost (#199): the edited plan's gain in flawless chance over the adopted plan on the same runs, with its
 * paired error (±, 95%). `settled` once it's clear either way or reached the cap; `close` when it's still unclear at the
 * cap (no measurable difference). A reading on fewer runs than the cap, still unclear, is provisional.
 */
export type EditCost = {
  readonly gain: number;
  readonly margin: number;
  readonly runs: number;
  readonly verdict: 'better' | 'worse' | 'close' | 'unclear';
  readonly settled: boolean;
};

/**
 * An edit's cost within a budget: compared on `runs` runs doubling to `cap` while the budget lasts (each doubling costs
 * the new runs of both plans), stopping once it's clear. A budget below the first comparison compares on as many runs
 * as it pays for (at least 2 each): the provisional reading.
 */
export function editCost(
  input: Omit<EditCostInput, 'run'> & { readonly run?: Run },
  samples: (plan: Plan, first: number, count: number) => readonly number[],
  editedSamples: (plan: Plan, first: number, count: number) => readonly number[] = samples,
): EditCost {
  const start = Math.max(2, Math.floor(input.runs ?? SEARCH_RUNS.start));
  const cap = Math.max(start, Math.floor(input.cap ?? SEARCH_RUNS.cap));
  const afford = Math.max(2, Math.floor(input.budget / 2));
  const a: number[] = [];
  const b: number[] = [];
  let n = Math.min(start, afford);
  for (;;) {
    a.push(...samples(input.plan, a.length, n - a.length));
    b.push(...editedSamples(input.edited, b.length, n - b.length));
    const p = paired(a, b);
    const v = verdictOf(p);
    if (v !== 'unclear') return { gain: p.gain, margin: p.margin, runs: n, verdict: v, settled: true };
    if (n >= cap) return { gain: p.gain, margin: p.margin, runs: n, verdict: 'close', settled: true };
    if (Math.min(cap, n * 2) > afford) return { gain: p.gain, margin: p.margin, runs: n, verdict: 'unclear', settled: false };
    n = Math.min(cap, n * 2);
  }
}

export type PinCostInput = {
  /** The run; its pins (`Run.pins` and its side goals) are the ones costed. */
  readonly run: Run;
  /** Pins besides the run's, as `solveStep` takes them. */
  readonly pins?: readonly PlanPin[];
  /** The pins to lift: all of them by default; one pin for that pin's own cost. */
  readonly lift?: readonly PlanPin[];
  /** The best plan found with the pins (the solve's). */
  readonly plan: Plan;
  /** The best plan found with them lifted: a second search over `liftPins(run)`, from `plan`. */
  readonly lifted: Plan;
  readonly seed: number;
  /** Evaluations over both plans, as an edit's cost has them (`EDIT_COST_BUDGET`). */
  readonly budget: number;
  readonly runs?: number;
  readonly cap?: number;
};

/**
 * The pin cost (#200; spec #175, The joint solve): the flawless chance the pins give up together (or one pin's, on
 * request): the best plan found with them lifted less the best found with them, on the same runs, with its paired
 * error (±, 95%) and verdict as an edit's cost has them. `pins` are the pins lifted: recorded facts are never pins, so
 * with none the cost is 0, on no runs.
 */
export type PinCost = {
  readonly pins: readonly PlanPin[];
  readonly cost: number;
  readonly margin: number;
  readonly runs: number;
  readonly verdict: EditCost['verdict'];
  readonly settled: boolean;
};
