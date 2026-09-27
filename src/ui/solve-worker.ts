/**
 * The anytime solve's Web Worker (#199; spec #175, Engine interfaces): a thin shell that loops the facade's stepping
 * call against a time budget and posts each step back, or reads an edit's cost at each budget it's given. It holds no
 * logic: the search, its state (the cursor) and its budgets are the engine's. Started by `solve-client.ts`, which
 * terminates it to stop a solve.
 */
import { createEngine, type Assumptions, type Engine } from '../engine';
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
    const end = performance.now() + m.seconds * 1000;
    let cursor = m.cursor;
    for (;;) {
      const step = engine.solveStep({ run: m.run, ...(m.plan ? { plan: m.plan } : {}), ...(m.pins ? { pins: m.pins } : {}), budget: m.budget, seed: m.seed, ...(cursor ? { cursor } : {}), ...(roleOf ? { roleOf } : {}) });
      cursor = step.cursor;
      const done = step.converged || performance.now() >= end;
      scope.postMessage({ id: m.id, kind: 'step', step, done });
      if (done) return;
    }
  }
  for (const [i, budget] of m.budgets.entries())
    scope.postMessage({ id: m.id, kind: 'cost', cost: engine.editCost({ run: m.run, plan: m.plan, edited: m.edited, seed: m.seed, budget, ...(roleOf ? { roleOf } : {}) }), done: i === m.budgets.length - 1 });
};
