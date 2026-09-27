/**
 * The page's side of the solve's Web Worker (#199): starts the worker on a request and hands each reply to the page.
 * One worker per request: a new request, or `stop`, terminates the one before (a step can't be interrupted mid-way).
 * Where there's no Worker (tests), `startSolve` returns undefined and the page works the chance out itself.
 */
import type { Assumptions, DeploymentRole, EditCost, PinCost, Plan, PlanPin, ReservesCursor, ReservesStep, Run, SolveCursor, SolveStep, WorthCursor, WorthStep } from '../engine';

type Common = {
  readonly id: number;
  readonly assumptions: Assumptions;
  readonly run: Run;
  readonly seed: number;
  /** Each unit's deployment role, as the page reads it (until #212). */
  readonly roles?: Readonly<Record<string, DeploymentRole>>;
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
    });

/**
 * A reply; `done` marks the request's last. A solve's steps say when the search is over (`searched`); with pins, the
 * pin cost (#200) follows, worked out while the worker is idle.
 */
export type SolveReply =
  | { readonly id: number; readonly kind: 'step'; readonly step: SolveStep; readonly searched: boolean; readonly done: boolean }
  | { readonly id: number; readonly kind: 'pin-cost'; readonly cost: PinCost; readonly done: boolean }
  | { readonly id: number; readonly kind: 'cost'; readonly cost: EditCost; readonly done: boolean }
  | { readonly id: number; readonly kind: 'idle'; readonly worth: WorthStep; readonly reserves: ReservesStep | undefined; readonly done: boolean };

/** A request as the page makes it: the client numbers it. */
export type NewSolveRequest = SolveRequest extends infer R ? (R extends SolveRequest ? Omit<R, 'id'> : never) : never;

let worker: Worker | undefined;
let next = 0;

/** Stops the solve under way, if any. */
export function stopSolve(): void {
  worker?.terminate();
  worker = undefined;
}

/**
 * Starts a solve (or an edit's cost) in the worker, stopping any other; each reply goes to `onReply` until the one
 * marked done. Returns a stop function, or undefined where Workers aren't available.
 */
export function startSolve(request: NewSolveRequest, onReply: (reply: SolveReply) => void): (() => void) | undefined {
  if (typeof Worker === 'undefined') return undefined;
  stopSolve();
  const id = ++next;
  const w = new Worker(new URL('./solve-worker.ts', import.meta.url), { type: 'module' });
  worker = w;
  w.onmessage = (e: MessageEvent<SolveReply>) => {
    if (e.data.id !== id) return;
    onReply(e.data);
    if (e.data.done && worker === w) stopSolve();
  };
  w.postMessage({ ...request, id } as SolveRequest);
  return () => {
    if (worker === w) stopSolve();
  };
}
