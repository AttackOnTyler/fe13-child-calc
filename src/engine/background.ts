/**
 * The solve's background jobs as stepping calls (#175, Engine interfaces: "The Web Worker is a thin shell that loops
 * that call against a time budget and posts results back; it holds no logic"). Each call does one piece of work and
 * hands back a cursor to pass to the next; the Web Worker only loops them against its time budgets and posts what they
 * return. Built on the facade's own calls (`solveStep`, `editCost`, `pinCost`, `readings`, …), so each job reads the
 * same numbers the page would.
 *
 * - **A second search** (`pinCostStep`, `lossStep`): `solveStep` from a given plan over a derived run (the pins
 *   lifted) or from the loss item's proposal, then its price (the pin cost) or its chance (the loss's re-solve).
 * - **Edit costs** (`unitEditsStep`, `editChoicesStep`, the setup checks in `checksStep`): the list first, then each
 *   edit costed at each budget in turn (every edit provisional first, then each settled), skipping those settled.
 * - **The checks** (`checksStep`): each open rule's stakes (those the model doesn't read first), then the setup checks.
 * - **The readings** (`readingsStep`): the EXP forecast's first pass, then each pending milestone's suggested changes.
 * - **The checklist's worth** (`actionWorthStep`): each preparation action's removal (`actionEdits`) costed in turn.
 */
import { SEARCH_RUNS, type EditCost, type PinCost, type UnitEdit } from './solve/step';
import type { Plan, PlanPin, SolveCursor } from './solve/plan';
import type { Run } from './run';
import type { RosterUnit } from './roster';
import type { CheckedRules, RuleStake, SetupCheck } from './checks';
import { SUGGEST_RUNS, type Readings } from './readings';
import type { ExpForecast, SuggestedChange } from './exp-forecast';
import type { Engine } from './index';

/** An edit as the list shows it: what the Web Worker posts (its plan is built and costed in the worker). */
export type EditListing = Pick<UnitEdit, 'kind' | 'key' | 'label' | 'pins'>;

const listing = (edits: readonly UnitEdit[]): EditListing[] => edits.map(({ kind, key, label, pins }) => ({ kind, key, label, pins }));

// ---- a second search ---------------------------------------------------------------------------------------------

/** Where a second search stands: its own cursor and the best plan found so far. Pass it back unchanged. */
export type SearchCursor = { readonly search?: SolveCursor; readonly best: Plan };

export type PinCostStepInput = {
  readonly run: Run;
  readonly pins?: readonly PlanPin[];
  /** One pin's own cost (#200, on request); absent: all the pins together. */
  readonly lift?: readonly PlanPin[];
  /** The best plan found with the pins: the second search starts from it. */
  readonly plan: Plan;
  /** Evaluations this step's search may spend. */
  readonly budget: number;
  readonly seed: number;
  /** Runs an edit is first compared on, and the most (as `solveStep` and `pinCost` take them). */
  readonly runs?: number;
  readonly cap?: number;
  /** Fresh runs the search's best is re-scored on (as `solveStep` takes it). */
  readonly display?: number;
  readonly cursor?: SearchCursor;
  /** The time budget is spent: price the best found so far, with no more search. */
  readonly stop?: boolean;
};

/** A pin cost step: the second search's cursor, and the cost once the search has converged or was stopped. */
export type PinCostStep = { readonly cursor: SearchCursor; readonly cost: PinCost | undefined };

/**
 * The pin cost as a stepping call (#200): a second search with the pins (or `lift`) lifted, from the best plan found
 * with them, one `solveStep` a call; once it converges (or `stop`), the best found with them lifted is priced against
 * `plan` (`pinCost`, at the settled budget: `EDIT_COST_BUDGET.settled` for the default runs).
 */
export function pinCostStep(engine: Engine, input: PinCostStepInput): PinCostStep {
  const pins = input.pins ? { pins: input.pins } : {};
  const lift = input.lift ? { lift: input.lift } : {};
  const runs = { ...(input.runs ? { runs: input.runs } : {}), ...(input.cap ? { cap: input.cap } : {}) };
  let cursor = input.cursor ?? { best: input.plan };
  if (!input.stop) {
    const lifted = engine.liftPins(input.run, { ...pins, ...lift });
    const s = engine.solveStep({ run: lifted, plan: input.plan, budget: input.budget, seed: input.seed, ...runs, ...(input.display ? { display: input.display } : {}), ...(cursor.search ? { cursor: cursor.search } : {}) });
    cursor = { search: s.cursor, best: s.best };
    if (!s.converged) return { cursor, cost: undefined };
  }
  const cost = engine.pinCost({ run: input.run, ...pins, ...lift, plan: input.plan, lifted: cursor.best, seed: input.seed, budget: 2 * (input.cap ?? SEARCH_RUNS.cap), ...runs });
  return { cursor, cost };
}

export type LossStepInput = {
  readonly run: Run;
  /** The adopted plan the open losses are read against. */
  readonly plan: Plan;
  readonly pins?: readonly PlanPin[];
  readonly budget: number;
  readonly seed: number;
  readonly runs?: number;
  readonly cap?: number;
  readonly display?: number;
  readonly cursor?: LossCursor;
  /** The time budget is spent: end with the best found so far. */
  readonly stop?: boolean;
};

/** Where the loss's re-solve stands: the proposal it started from, the search's cursor and its best chance so far. */
export type LossCursor = SearchCursor & { readonly from: Plan; readonly chance?: { readonly chance: number; readonly margin: number } };

/**
 * A loss re-solve step: `done` once the search converged, was stopped, or there's no open loss; then `result` is the
 * best plan and its chance (absent when no loss is open or no step worked a chance out).
 */
export type LossStep = {
  readonly cursor: LossCursor | undefined;
  readonly done: boolean;
  readonly result?: { readonly plan: Plan; readonly chance: number; readonly margin: number };
};

/**
 * The loss item's re-solve as a stepping call (#208): the search again from the loss item's proposal (the plan for the
 * army that's left), one `solveStep` a call; its best plan and chance, for the player to accept.
 */
export function lossStep(engine: Engine, input: LossStepInput): LossStep {
  const pins = input.pins ? { pins: input.pins } : {};
  let cursor = input.cursor;
  if (!cursor) {
    const item = engine.lossItem(input.run, input.plan, { ...pins });
    if (!item) return { cursor: undefined, done: true };
    cursor = { from: item.plan, best: item.plan };
  }
  let converged = false;
  if (!input.stop) {
    const s = engine.solveStep({ run: input.run, plan: cursor.from, ...pins, budget: input.budget, seed: input.seed, ...(input.runs ? { runs: input.runs } : {}), ...(input.cap ? { cap: input.cap } : {}), ...(input.display ? { display: input.display } : {}), ...(cursor.search ? { cursor: cursor.search } : {}) });
    cursor = { ...cursor, search: s.cursor, best: s.best, ...(s.chance ? { chance: { chance: s.chance.chance, margin: s.chance.margin } } : {}) };
    converged = s.converged;
  }
  if (!converged && !input.stop) return { cursor, done: false };
  return { cursor, done: true, ...(cursor.chance ? { result: { plan: cursor.best, ...cursor.chance } } : {}) };
}

// ---- edit costs --------------------------------------------------------------------------------------------------

/** An edit to cost: its key, its plan (built when first costed), the pins that plan plays under. */
type Costable = { readonly key: string; readonly make: () => Plan; readonly play?: readonly PlanPin[] };

/** Where a round of edit costs stands: the budget and edit next in turn, and the edits already settled. */
type CostCursor = { readonly budget: number; readonly next: number; readonly settled: readonly string[]; readonly plans: Map<string, Plan> };

/** The next unsettled edit's cost at its budget, and the cursor after it; undefined when every cost is in. */
function nextCost(
  engine: Engine,
  common: { readonly run: Run; readonly plan: Plan; readonly seed: number; readonly budgets: readonly number[] },
  items: readonly Costable[],
  c: CostCursor,
): { readonly key: string; readonly cost: EditCost; readonly edited: Plan; readonly cursor: CostCursor } | undefined {
  for (let b = c.budget, i = c.next; b < common.budgets.length; b++, i = 0)
    for (; i < items.length; i++) {
      const e = items[i]!;
      if (c.settled.includes(e.key)) continue;
      let edited = c.plans.get(e.key);
      if (!edited) c.plans.set(e.key, (edited = e.make()));
      const cost = engine.editCost({ run: common.run, plan: common.plan, edited, ...(e.play ? { pins: e.play } : {}), seed: common.seed, budget: common.budgets[b]! });
      const settled = cost.settled ? [...c.settled, e.key] : c.settled;
      return { key: e.key, cost, edited, cursor: { budget: b, next: i + 1, settled, plans: c.plans } };
    }
  return undefined;
}

const freshCosts = (): CostCursor => ({ budget: 0, next: 0, settled: [], plans: new Map() });

/** The order a unit's edits are costed in (#203): the likeliest choices first, build skills and side goals last. */
const COST_ORDER: readonly UnitEdit['kind'][] = ['keep', 'marriage', 'class', 'pass', 'lineup', 'pair', 'robin', 'priority', 'place', 'optional', 'seal', 'item', 'build', 'side-goal'];

/** Where a list of edits being costed stands. Pass it back unchanged. */
export type EditsCursor = { readonly plan: Plan; readonly edits: readonly UnitEdit[]; readonly costing: readonly UnitEdit[]; readonly costs: CostCursor };

/**
 * A step of a list of edits being costed: first the list (`edits`, done at once when there's nothing to cost), then
 * one edit's cost at one budget (`edit-cost`, with its edited plan), then the list again, done.
 */
export type EditsStep = { readonly cursor: EditsCursor; readonly done: boolean } & (
  | { readonly kind: 'edits'; readonly edits: readonly EditListing[] }
  | { readonly kind: 'edit-cost'; readonly key: string; readonly cost: EditCost; readonly edited: Plan }
);

function editsStep(engine: Engine, common: { readonly run: Run; readonly seed: number; readonly budgets: readonly number[] }, cursor: EditsCursor, first: boolean, finalOnEmpty: boolean): EditsStep {
  if (first) return { kind: 'edits', edits: listing(cursor.edits), cursor, done: finalOnEmpty && (!cursor.costing.length || !common.budgets.length) };
  const next = nextCost(engine, { ...common, plan: cursor.plan }, cursor.costing, cursor.costs);
  if (!next) return { kind: 'edits', edits: listing(cursor.edits), cursor, done: true };
  return { kind: 'edit-cost', key: next.key, cost: next.cost, edited: next.edited, cursor: { ...cursor, costs: next.cursor }, done: false };
}

export type UnitEditsStepInput = {
  readonly run: Run;
  readonly plan: Plan;
  readonly unit: RosterUnit;
  readonly pins?: readonly PlanPin[];
  readonly seed: number;
  /** The budgets to cost at, in order (`EDIT_COST_BUDGET.provisional`, then `.settled`). */
  readonly budgets: readonly number[];
  readonly cursor?: EditsCursor;
};

/**
 * A unit's edits (#203, the Wishlist tab) as a stepping call: listed first (`unitEdits`), then each costed at each
 * budget in turn, the likeliest choices first, skipping those settled; the list again, done, when every cost is in.
 */
export function unitEditsStep(engine: Engine, input: UnitEditsStepInput): EditsStep {
  if (input.cursor) return editsStep(engine, input, input.cursor, false, false);
  const edits = engine.unitEdits(input.run, input.plan, input.unit, { ...(input.pins ? { pins: input.pins } : {}), seed: input.seed });
  const costing = [...edits].sort((a, b) => COST_ORDER.indexOf(a.kind) - COST_ORDER.indexOf(b.kind));
  return editsStep(engine, input, { plan: input.plan, edits, costing, costs: freshCosts() }, true, false);
}

export type EditChoicesStepInput = {
  readonly run: Run;
  /** The plan the edits are of; absent: the one the run adopts. */
  readonly plan?: Plan;
  readonly pins?: readonly PlanPin[];
  /** The maps the lineup and pair edits are offered on: the riskiest first. */
  readonly riskiest?: readonly string[];
  /** The edits to cost, by key, in this order. */
  readonly keys: readonly string[];
  readonly seed: number;
  readonly budgets: readonly number[];
  readonly cursor?: EditsCursor;
};

/**
 * The inbox's "anything else" (#204) as a stepping call: every edit the player can make (`editChoices`), listed first
 * (done at once with nothing asked), then each of `keys` costed at each budget in turn with its edited plan (a plan
 * edit adopts it), skipping those settled; the list again, done, when every cost is in.
 */
export function editChoicesStep(engine: Engine, input: EditChoicesStepInput): EditsStep {
  if (input.cursor) return editsStep(engine, input, input.cursor, false, true);
  const pins = input.pins ? { pins: input.pins } : {};
  const plan = input.plan ?? engine.adoptedPlan(input.run, { ...pins });
  const edits = engine.editChoices(input.run, plan, { ...pins, seed: input.seed, ...(input.riskiest ? { riskiest: input.riskiest } : {}) });
  const costing = input.keys.flatMap((k) => edits.filter((e) => e.key === k));
  return editsStep(engine, input, { plan, edits, costing, costs: freshCosts() }, true, true);
}

export type ActionWorthStepInput = {
  readonly run: Run;
  /** The adopted plan the preparation page shows. */
  readonly plan: Plan;
  /** The map being prepared (its id). */
  readonly map: string;
  readonly seed: number;
  /** The budgets to cost at, in order (`EDIT_COST_BUDGET.provisional`, then `.settled`). */
  readonly budgets: readonly number[];
  readonly cursor?: EditsCursor;
};

/**
 * The preparation checklist's worth (#175 story 59) as a stepping call: each action's removal (`actionEdits`) listed
 * first, then costed at each budget in turn (the edit's gain is minus the action's worth), skipping those settled; the
 * list again, done.
 */
export function actionWorthStep(engine: Engine, input: ActionWorthStepInput): EditsStep {
  if (input.cursor) return editsStep(engine, input, input.cursor, false, true);
  const edits = engine.actionEdits(input.run, input.plan, input.map);
  return editsStep(engine, input, { plan: input.plan, edits, costing: edits, costs: freshCosts() }, true, true);
}

// ---- the checks --------------------------------------------------------------------------------------------------

export type ChecksStepInput = {
  readonly run: Run;
  readonly plan: Plan;
  readonly rules: CheckedRules;
  readonly seed: number;
  /** The budgets the setup checks' edits are costed at, in order. */
  readonly budgets: readonly number[];
  /** Runs each rule's stakes are read on; the headline's by default. */
  readonly runs?: number;
  readonly cursor?: ChecksCursor;
};

/** Where the checks stand: the open rules in turn, the stakes so far, the setup checks and their costs. */
export type ChecksCursor = {
  readonly order: readonly string[];
  readonly stakes: readonly RuleStake[];
  readonly setup?: readonly SetupCheck[];
  readonly costs: CostCursor;
};

/** A step of the checks: one rule's stakes, then the setup checks, then one setup edit's cost; the setup checks again, done. */
export type ChecksStep = { readonly cursor: ChecksCursor; readonly done: boolean } & (
  | { readonly kind: 'stake'; readonly stake: RuleStake }
  | { readonly kind: 'setup'; readonly checks: readonly SetupCheck[] }
  | { readonly kind: 'setup-cost'; readonly rule: string; readonly cost: EditCost }
);

/**
 * The in-play checks (#209) as a stepping call: each open rule's stakes on the plan, one re-run a call under its other
 * reading, the rules the model doesn't read first (they have none, at once); then the setup checks
 * those stakes call for (done at once with none to cost); then each one's edit costed at each budget in turn,
 * skipping those settled; the setup checks again, done.
 */
export function checksStep(engine: Engine, input: ChecksStepInput): ChecksStep {
  const cursor = input.cursor ?? firstChecks(engine, input.rules);
  const { run, plan, seed } = input;
  if (cursor.stakes.length < cursor.order.length) {
    const stake = engine.ruleStakes(run, plan, cursor.order[cursor.stakes.length]!, { seed, ...(input.runs ? { runs: input.runs } : {}) });
    return { kind: 'stake', stake, cursor: { ...cursor, stakes: [...cursor.stakes, stake] }, done: false };
  }
  const costable = (setup: readonly SetupCheck[]) => setup.flatMap((c) => (c.edit ? [{ key: c.rule, make: () => c.edit!.plan }] : []));
  if (!cursor.setup) {
    const setup = engine.setupChecks(run, plan, { rules: input.rules, stakes: cursor.stakes, seed });
    return { kind: 'setup', checks: setup, cursor: { ...cursor, setup }, done: !costable(setup).length || !input.budgets.length };
  }
  const next = nextCost(engine, { run, plan, seed, budgets: input.budgets }, costable(cursor.setup), cursor.costs);
  if (!next) return { kind: 'setup', checks: cursor.setup, cursor, done: true };
  return { kind: 'setup-cost', rule: next.key, cost: next.cost, cursor: { ...cursor, costs: next.cursor }, done: false };
}

function firstChecks(engine: Engine, rules: CheckedRules): ChecksCursor {
  const open = engine.openRules(rules).filter((s) => s.state === 'open').map((s) => s.rule);
  const order = [...open.filter((r) => !r.assumption), ...open.filter((r) => r.assumption)].map((r) => r.id);
  return { order, stakes: [], costs: freshCosts() };
}

// ---- the readings ------------------------------------------------------------------------------------------------

export type ReadingsStepInput = {
  readonly run: Run;
  readonly plan: Plan;
  readonly seed: number;
  /** Runs the EXP forecast is played on; the headline's by default. */
  readonly runs?: number;
  /** Runs each suggested change is played on; `SUGGEST_RUNS` by default. */
  readonly suggestRuns?: number;
  readonly cursor?: ReadingsCursor;
  /** The time budget is spent: end with the readings as they stand. */
  readonly stop?: boolean;
};

/** Where the readings stand: the forecast they read, the milestones pending at first, the suggestions so far. */
export type ReadingsCursor = {
  readonly forecast: ExpForecast;
  readonly pending: readonly string[];
  readonly suggestions: Readonly<Record<string, readonly SuggestedChange[]>>;
  readonly readings: Readings;
};

/** A readings step: the readings as they stand (undefined once the endpoint is recorded), done when they're final. */
export type ReadingsStep = { readonly readings: Readings | undefined; readonly cursor: ReadingsCursor | undefined; readonly done: boolean };

/**
 * A plan's readings (#197) as a stepping call, firming up: the first pass from its EXP forecast (a unit below 80% reads
 * "at risk?"), then one pending milestone's suggested changes a call, on `SUGGEST_RUNS` runs, until none are pending.
 */
export function readingsStep(engine: Engine, input: ReadingsStepInput): ReadingsStep {
  const { run, plan, seed } = input;
  if (!input.cursor) {
    const forecast = engine.expForecast(run, plan, { seed, ...(input.runs ? { runs: input.runs } : {}) });
    if (!forecast.maps.length) return { readings: undefined, cursor: undefined, done: true };
    const readings = engine.readings(run, plan, { seed, forecast });
    return { readings, cursor: { forecast, pending: readings.pending, suggestions: {}, readings }, done: !readings.pending.length || !!input.stop };
  }
  const c = input.cursor;
  const id = c.pending.find((p) => !(p in c.suggestions));
  if (id === undefined || input.stop) return { readings: c.readings, cursor: c, done: true };
  const suggestions = { ...c.suggestions, [id]: engine.suggestedChanges(run, plan, id, { seed, runs: input.suggestRuns ?? SUGGEST_RUNS }) };
  const readings = engine.readings(run, plan, { seed, forecast: c.forecast, suggestions, stats: c.readings.stats });
  const done = c.pending.every((p) => p in suggestions);
  return { readings, cursor: { ...c, suggestions, readings }, done };
}
