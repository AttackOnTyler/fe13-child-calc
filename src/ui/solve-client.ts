/**
 * The page's side of the solve's Web Worker (#199): starts the worker on a request and hands each reply to the page.
 * One worker per request and slot: a new request, or `stop`, terminates the one before in its slot (a step can't be
 * interrupted mid-way). The solve and its idle work run in the `main` slot; a unit's edits on the Wishlist tab (#203)
 * and the inbox's "anything else" and single pin costs (#204) are costed in the `edits` slot beside it, so costing an
 * edit never stops the search.
 * Where there's no Worker (tests), `startSolve` returns undefined and the page works the chance out itself.
 */
import type { Board, PositionPlan, SearchProgress, SolveOptions } from '../engine';
import type { Assumptions, Ceiling, CheckedRules, EditCost, EditListing, ExpForecast, RuleStake, SetupCheck, PinCost, Plan, PlanPin, Readings, ReservesCursor, ReservesStep, RobinCursor, RobinStep, RosterUnit, Run, RunSim, SolveCursor, SolveStep, StressCase, WhatItCost, WorthCursor, WorthStep } from '../engine';

/** A unit's edit as the worker posts it (#203): its plan is built and costed in the worker. */
export type UnitEditView = EditListing;

type Common = {
  readonly id: number;
  readonly assumptions: Assumptions;
  readonly run: Run;
  readonly seed: number;
};

export type SolveRequest =
  | (Common & {
      readonly kind: 'solve';
      readonly plan?: Plan;
      readonly pins?: readonly PlanPin[];
      /** Evaluations per step: the worker posts after each. */
      readonly budget: number;
      /** The time budget: `SOLVE_SECONDS.full` or `.resolve`. */
      readonly seconds: number;
      readonly cursor?: SolveCursor;
      /** A loss is open (#208): once the search is done, re-solve from the loss item's proposal and post its chance. */
      readonly loss?: boolean;
      /** After the readings, price What it cost for the latest recorded map (#208). */
      readonly cost?: boolean;
    })
  | (Common & {
      readonly kind: 'cost';
      readonly plan: Plan;
      readonly edited: Plan;
      /** The budgets to read the cost at, in order (`EDIT_COST_BUDGET.provisional`, then `.settled`). */
      readonly budgets: readonly number[];
    })
  | (Common & {
      /**
       * The inbox's "anything else" (#204), in the `edits` slot: every edit of the adopted plan (`plan`; absent: the one
       * the run adopts) the player can make (`editChoices`), listed; then each of `keys` costed at each of `budgets` in
       * turn (all provisional first, then all settled), each with its edited plan.
       */
      readonly kind: 'all-edits';
      readonly plan?: Plan;
      readonly pins?: readonly PlanPin[];
      /** The maps the lineup and pair edits are offered on: the riskiest first. */
      readonly riskiest?: readonly string[];
      readonly keys: readonly string[];
      readonly budgets: readonly number[];
    })
  | (Common & {
      /**
       * One pin's own cost (#200, on request from "Your edits"), in the `edits` slot: a search with it lifted from the
       * adopted plan, then its cost.
       */
      readonly kind: 'one-pin-cost';
      readonly plan?: Plan;
      readonly pins?: readonly PlanPin[];
      readonly lift: readonly PlanPin[];
      readonly budget: number;
    })
  | (Common & {
      /**
       * The worker's idle work (#202): the adopted plan's unit worth and utility, then its reserves, stepped against a
       * time budget. Start it only once the solve is done: any new request (a solve, a cost) stops it.
       */
      readonly kind: 'idle';
      readonly plan: Plan;
      readonly pins?: readonly PlanPin[];
      /** Evaluations per step: the worker posts after each. */
      readonly budget: number;
      readonly seconds: number;
      /** Where an earlier idle request stopped. */
      readonly worth?: WorthCursor;
      readonly reserves?: ReservesCursor;
    })
  | (Common & {
      /**
       * The Robin alternatives (#201): every option screened, the best of each gender and up to two more solved (or,
       * once locked, the locked Robin), those in `solve` too, stepped against a time budget from `cursor`.
       */
      readonly kind: 'robin';
      readonly pins?: readonly PlanPin[];
      readonly budget: number;
      readonly seconds: number;
      readonly cursor?: RobinCursor;
      readonly solve?: readonly string[];
      readonly noRobin?: boolean;
    })
  | (Common & {
      /**
       * Every edit that touches a unit (#203, the Wishlist tab): listed at once, then each costed against the plan at
       * each budget in turn (`EDIT_COST_BUDGET.provisional` for all, then `.settled`), the likeliest choices first.
       */
      readonly kind: 'edits';
      readonly plan: Plan;
      readonly pins?: readonly PlanPin[];
      readonly unit: RosterUnit;
      readonly budgets: readonly number[];
    })
  | (Common & {
      /**
       * The Why panel's drill-down (#210), in the `why` slot: a plan's runs on the headline's seed and run count (an
       * edit's other plan, for its per-map rows); with `unit`, the plan's runs without it and the plan's own (a worth's
       * spans).
       */
      readonly kind: 'why';
      readonly plan: Plan;
      /** The plan `plan` is compared against: its runs come back as `base`. */
      readonly base?: Plan;
      readonly unit?: RosterUnit;
      readonly pins?: readonly PlanPin[];
      readonly runs: number;
    })
  | (Common & {
      /**
       * The stress tests (#211), in the `stress` slot once the headline's search is done: `plan` re-run under each
       * case's bad case, on the headline's seed and run count, one reply a case.
       */
      readonly kind: 'stress';
      readonly plan: Plan;
      readonly runs: number;
      readonly cases: readonly StressCase[];
    })
  | (Common & {
      /**
       * The preparation page's EXP forecast (#207), in the `prep` slot: the plan's runs with its milestones checked (a
       * full run of simulations: seconds on the Main story, too long for the page). `plan`: the adopted plan the page
       * holds; absent, the one the run adopts with `pins` (its seed takes most of a second).
       */
      readonly kind: 'forecast';
      readonly plan?: Plan;
      readonly pins?: readonly PlanPin[];
      /**
       * The map being prepared: after the forecast, each checklist action's worth (#175 story 59, `actionWorthStep`),
       * one `edit-cost` reply a cost (keyed by action id), at each of `budgets` in turn.
       */
      readonly map?: string;
      readonly budgets?: readonly number[];
    })
  | (Common & {
      /**
       * The in-play checks (#209), in the `checks` slot: each open rule's stakes on the adopted plan (one re-run under its
       * other reading), then the setup checks those stakes call for, each edit costed at each of `budgets` in turn.
       */
      readonly kind: 'checks';
      readonly plan: Plan;
      readonly rules: CheckedRules;
      readonly budgets: readonly number[];
    })
  | (Common & {
      /** The Prepare page's position plan (#265, #266), in the `positions` slot: the solver from a board. */
      readonly kind: 'positions';
      readonly board: Board;
      readonly options: SolveOptions;
    });

/**
 * A reply; `done` marks the request's last. A solve's steps say when the search is over (`searched`); with an open
 * loss, the loss item's re-solve (#208) follows; with pins, the pin cost (#200), worked out while the worker is idle;
 * then the best plan's readings (#197), as they firm up (undefined once the endpoint is recorded); then, when asked,
 * What it cost (#208).
 */
export type SolveReply =
  | {
      readonly id: number;
      readonly kind: 'step';
      /** The step, its chance carried from the last step that worked one out (steps are paced: those between aren't posted). */
      readonly step: SolveStep;
      /** The best plan's ceiling on the chance's runs, worked out here once per best plan (the page never works it out). */
      readonly ceiling?: Ceiling;
      readonly searched: boolean;
      readonly done: boolean;
    }
  | { readonly id: number; readonly kind: 'pin-cost'; readonly cost: PinCost; readonly done: boolean }
  | { readonly id: number; readonly kind: 'readings'; readonly readings: Readings | undefined; readonly done: boolean }
  | { readonly id: number; readonly kind: 'loss'; readonly plan: Plan; readonly chance: number; readonly margin: number; readonly done: boolean }
  | { readonly id: number; readonly kind: 'what-it-cost'; readonly cost: WhatItCost | undefined; readonly done: boolean }
  | { readonly id: number; readonly kind: 'cost'; readonly cost: EditCost; readonly done: boolean }
  | { readonly id: number; readonly kind: 'idle'; readonly worth: WorthStep; readonly reserves: ReservesStep | undefined; readonly done: boolean }
  | { readonly id: number; readonly kind: 'robin'; readonly step: RobinStep; readonly done: boolean }
  | { readonly id: number; readonly kind: 'edits'; readonly edits: readonly UnitEditView[]; readonly done: boolean }
  | { readonly id: number; readonly kind: 'edit-cost'; readonly key: string; readonly cost: EditCost; readonly done: boolean; /** The edited plan (#204's "anything else": a plan edit adopts it). */ readonly edited?: Plan }
  | { readonly id: number; readonly kind: 'forecast'; readonly plan: Plan; readonly forecast: ExpForecast; readonly done: boolean }
  | { readonly id: number; readonly kind: 'stake'; readonly stake: RuleStake; readonly done: boolean }
  | { readonly id: number; readonly kind: 'setup'; readonly checks: readonly SetupCheck[]; readonly done: boolean }
  | { readonly id: number; readonly kind: 'setup-cost'; readonly rule: string; readonly cost: EditCost; readonly done: boolean }
  | { readonly id: number; readonly kind: 'stress'; readonly stress: StressCase; readonly chance: RunSim; readonly done: boolean }
  | { readonly id: number; readonly kind: 'positions'; readonly plan: PositionPlan; readonly done: boolean }
  | { readonly id: number; readonly kind: 'positions-progress'; readonly progress: SearchProgress; readonly done: false }
  | { readonly id: number; readonly kind: 'why'; readonly chance: RunSim; /** The plan compared against's runs (with a unit: the plan's own). */ readonly base?: RunSim; readonly done: boolean };

/**
 * Where a request runs: the solve and its idle work, a unit's edits beside it, the Why panel's drill-down (#210), the
 * checks' stakes (#209), the stress tests (#211), the preparation page's forecast, or the Robin alternatives (#201: the
 * first decision, so they never wait behind the search and its readings).
 */
export type SolveSlot = 'main' | 'edits' | 'why' | 'checks' | 'stress' | 'prep' | 'robin' | 'positions';

/** A request as the page makes it: the client numbers it. */
export type NewSolveRequest = SolveRequest extends infer R ? (R extends SolveRequest ? Omit<R, 'id'> : never) : never;

const workers: Partial<Record<SolveSlot, Worker>> = {};
let next = 0;

/** Stops the request under way in a slot (the solve's by default), if any. */
export function stopSolve(slot: SolveSlot = 'main'): void {
  workers[slot]?.terminate();
  delete workers[slot];
}

/**
 * Starts a solve (or an edit's cost, the idle work, a unit's edits) in its slot's worker, stopping any other there;
 * each reply goes to `onReply` until the one marked done. Returns a stop function, or undefined where Workers aren't
 * available.
 */
export function startSolve(request: NewSolveRequest, onReply: (reply: SolveReply) => void, slot: SolveSlot = 'main'): (() => void) | undefined {
  if (typeof Worker === 'undefined') return undefined;
  stopSolve(slot);
  const id = ++next;
  const w = new Worker(new URL('./solve-worker.ts', import.meta.url), { type: 'module' });
  workers[slot] = w;
  w.onmessage = (e: MessageEvent<SolveReply>) => {
    if (e.data.id !== id) return;
    onReply(e.data);
    if (e.data.done && workers[slot] === w) stopSolve(slot);
  };
  w.postMessage({ ...request, id } as SolveRequest);
  return () => {
    if (workers[slot] === w) stopSolve(slot);
  };
}

