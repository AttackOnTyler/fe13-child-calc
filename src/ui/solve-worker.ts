/**
 * The anytime solve's Web Worker (#199; spec #175, Engine interfaces): a thin shell that loops the facade's stepping
 * call against a time budget and posts each step back, or reads an edit's cost at each budget it's given. Once the
 * solve is done and the run has pins, the worker is idle, so it works out the pin cost (#200): a second search with the
 * pins lifted (`liftPins`), from the best plan found with them, then `pinCost`. Then it reads the best plan's readings
 * (#197): the EXP forecast's first pass, then each pending milestone's suggested changes, one milestone a reply, within
 * `READING_SECONDS`. The page may also hand it idle work (#202): the plan's unit worth and utility, then its reserves;
 * or, on request, the Robin alternatives (#201), after the search, pin cost and readings. It holds no logic: the
 * search, its state (the cursor) and its budgets are the engine's. Started by `solve-client.ts`, which terminates it to stop a solve.
 */
import { EDIT_COST_BUDGET, READING_SECONDS, SOLVE_SECONDS, SUGGEST_RUNS, createEngine, type Assumptions, type DeploymentRole, type Engine, type Plan, type Run, type SolveCursor, type SuggestedChange } from '../engine';
import type { SolveReply, SolveRequest } from './solve-client';

const scope = self as unknown as { onmessage: ((e: MessageEvent<SolveRequest>) => void) | null; postMessage(m: SolveReply): void };
let built: { key: string; engine: Engine } | undefined;
const engineFor = (a: Assumptions) => {
  const key = JSON.stringify(a);
  if (built?.key !== key) built = { key, engine: createEngine(a) };
  return built.engine;
};

scope.onmessage = ({ data: m }) => {
  const engine = engineFor(m.assumptions);
  const roleOf = m.roles ? (u: string) => m.roles![u]! : undefined;
  if (m.kind === 'solve') {
    const pinned = engine.pins(m.run, m.pins).length > 0;
    const end = performance.now() + m.seconds * 1000;
    let cursor = m.cursor;
    for (;;) {
      const step = engine.solveStep({ run: m.run, ...(m.plan ? { plan: m.plan } : {}), ...(m.pins ? { pins: m.pins } : {}), budget: m.budget, seed: m.seed, ...(cursor ? { cursor } : {}), ...(roleOf ? { roleOf } : {}) });
      cursor = step.cursor;
      const searched = step.converged || performance.now() >= end;
      scope.postMessage({ id: m.id, kind: 'step', step, searched, done: false });
      if (!searched) continue;
      if (!pinned) return readings(engine, m, step.best, roleOf);
      // Idle: the pin cost's second search, with the pins lifted, from the best plan found with them.
      const lifted = engine.liftPins(m.run, m.pins ? { pins: m.pins } : {});
      const stop = performance.now() + SOLVE_SECONDS.resolve * 1000;
      let free = step.best;
      let c: SolveCursor | undefined;
      for (;;) {
        const s = engine.solveStep({ run: lifted, plan: step.best, budget: m.budget, seed: m.seed, ...(c ? { cursor: c } : {}), ...(roleOf ? { roleOf } : {}) });
        c = s.cursor;
        free = s.best;
        if (s.converged || performance.now() >= stop) break;
      }
      const cost = engine.pinCost({ run: m.run, ...(m.pins ? { pins: m.pins } : {}), plan: step.best, lifted: free, seed: m.seed, budget: EDIT_COST_BUDGET.settled, ...(roleOf ? { roleOf } : {}) });
      scope.postMessage({ id: m.id, kind: 'pin-cost', cost, done: false });
      return readings(engine, m, step.best, roleOf);
    }
  }
  if (m.kind === 'idle') {
    // Worth and utility first, then the reserves (they need the likely losses), until both settle or time runs out.
    const end = performance.now() + m.seconds * 1000;
    const common = { run: m.run, plan: m.plan, ...(m.pins ? { pins: m.pins } : {}), budget: m.budget, seed: m.seed, ...(roleOf ? { roleOf } : {}) };
    let worth = engine.unitWorth({ ...common, ...(m.worth ? { cursor: m.worth } : {}) });
    let reserves = m.reserves && engine.reserves({ ...common, budget: 0, cursor: m.reserves });
    for (;;) {
      const done = !!reserves?.converged || performance.now() >= end;
      scope.postMessage({ id: m.id, kind: 'idle', worth, reserves, done });
      if (done) return;
      if (!worth.converged) worth = engine.unitWorth({ ...common, cursor: worth.cursor });
      else reserves = engine.reserves({ ...common, ...(reserves ? { cursor: reserves.cursor } : {}) });
    }
  }
  if (m.kind === 'robin') {
    // The Robin alternatives (#201), until every option is screened and the picks solved, or time runs out.
    const end = performance.now() + m.seconds * 1000;
    const common = { run: m.run, ...(m.pins ? { pins: m.pins } : {}), budget: m.budget, seed: m.seed, ...(m.solve ? { solve: m.solve } : {}), ...(m.noRobin ? { noRobin: true } : {}), ...(roleOf ? { roleOf } : {}) };
    let cursor = m.cursor;
    for (;;) {
      const step = engine.robinAlternatives({ ...common, ...(cursor ? { cursor } : {}) });
      cursor = step.cursor;
      const done = step.converged || performance.now() >= end;
      scope.postMessage({ id: m.id, kind: 'robin', step, done });
      if (done) return;
    }
  }
  for (const [i, budget] of m.budgets.entries())
    scope.postMessage({ id: m.id, kind: 'cost', cost: engine.editCost({ run: m.run, plan: m.plan, edited: m.edited, seed: m.seed, budget, ...(roleOf ? { roleOf } : {}) }), done: i === m.budgets.length - 1 });
};

/**
 * The best plan's readings (#197), posted as they firm up: the first pass from its EXP forecast (a unit below 80% reads
 * "at risk?"), then each pending milestone's suggested changes on `SUGGEST_RUNS` runs, until `READING_SECONDS` run out.
 */
function readings(engine: Engine, m: { readonly id: number; readonly run: Run; readonly seed: number }, plan: Plan, roleOf: ((u: string) => DeploymentRole) | undefined) {
  const options = { seed: m.seed, ...(roleOf ? { roleOf } : {}) };
  const forecast = engine.expForecast(m.run, plan, options);
  if (!forecast.maps.length) return void scope.postMessage({ id: m.id, kind: 'readings', readings: undefined, done: true });
  let read = engine.readings(m.run, plan, { ...options, forecast });
  const suggestions: Record<string, readonly SuggestedChange[]> = {};
  const end = performance.now() + READING_SECONDS * 1000;
  for (const id of read.pending) {
    scope.postMessage({ id: m.id, kind: 'readings', readings: read, done: false });
    if (performance.now() >= end) break;
    suggestions[id] = engine.suggestedChanges(m.run, plan, id, { ...options, runs: SUGGEST_RUNS });
    read = engine.readings(m.run, plan, { ...options, forecast, suggestions, stats: read.stats });
  }
  scope.postMessage({ id: m.id, kind: 'readings', readings: read, done: true });
}
