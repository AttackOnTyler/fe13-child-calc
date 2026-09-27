/**
 * The anytime solve's Web Worker (#199; spec #175, Engine interfaces): a thin shell that loops the facade's stepping
 * call against a time budget and posts each step back, or reads an edit's cost at each budget it's given. Once the
 * solve is done and the run has pins, the worker is idle, so it works out the pin cost (#200): a second search with the
 * pins lifted (`liftPins`), from the best plan found with them, then `pinCost`. The page may also hand it idle work (#202):
 * the plan's unit worth and utility, then its reserves. It holds no logic: the search, its state (the cursor) and its
 * budgets are the engine's. Started by `solve-client.ts`, which terminates it to stop a solve.
 */
import { EDIT_COST_BUDGET, SOLVE_SECONDS, createEngine, type Assumptions, type Engine, type SolveCursor } from '../engine';
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
      scope.postMessage({ id: m.id, kind: 'step', step, searched, done: searched && !pinned });
      if (!searched) continue;
      if (!pinned) return;
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
      scope.postMessage({ id: m.id, kind: 'pin-cost', cost, done: true });
      return;
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
  for (const [i, budget] of m.budgets.entries())
    scope.postMessage({ id: m.id, kind: 'cost', cost: engine.editCost({ run: m.run, plan: m.plan, edited: m.edited, seed: m.seed, budget, ...(roleOf ? { roleOf } : {}) }), done: i === m.budgets.length - 1 });
};
