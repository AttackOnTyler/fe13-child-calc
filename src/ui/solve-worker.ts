/**
 * The anytime solve's Web Worker (#199; spec #175, Engine interfaces): a thin shell that loops the facade's stepping
 * calls against their time budgets and posts what they return, paced (`pacer`). It holds no logic: what each job does,
 * in what order, and where it stands (its cursor) are the engine's; the worker only picks the job for the request,
 * says when a time budget is spent (`stop`), and posts.
 *
 * - `solve`: `solveStep` until converged or `seconds` run out; then, while it's idle, the loss's re-solve (`lossStep`,
 *   with an open loss), the pin cost (`pinCostStep`, when the run has pins), the adopted plan's readings
 *   (`readingsStep`, within `READING_SECONDS`) and, when asked, What it cost (`whatItCost`).
 * - `idle`: unit worth and utility, then the reserves (`unitWorth`, `reserves`). `robin`: `robinAlternatives`.
 * - `edits` / `all-edits` / `checks`: `unitEditsStep` / `editChoicesStep` / `checksStep`, each reply as the step has it.
 * - `one-pin-cost`: `pinCostStep` with one pin lifted. `cost`: `editCost` at each budget. `why`, `stress`, `forecast`:
 *   one facade call each.
 *
 * Started by `solve-client.ts`, which terminates it to stop a solve.
 */
import { READING_SECONDS, SOLVE_SECONDS, createEngine, type Assumptions, type Ceiling, type Engine, type FlawlessChance, type Plan, type Run, type SearchCursor } from '../engine';
import type { SolveReply, SolveRequest } from './solve-client';
import { pacer } from './pace';

const scope = self as unknown as { onmessage: ((e: MessageEvent<SolveRequest>) => void) | null; postMessage(m: SolveReply): void };
let built: { key: string; engine: Engine } | undefined;
const engineFor = (a: Assumptions) => {
  const key = JSON.stringify(a);
  if (built?.key !== key) built = { key, engine: createEngine(a) };
  return built.engine;
};

/** A deadline `seconds` from now: `spent()` says when it has passed. */
const deadline = (seconds: number) => {
  const end = performance.now() + seconds * 1000;
  return () => performance.now() >= end;
};

scope.onmessage = ({ data: m }) => {
  const engine = engineFor(m.assumptions);
  const pins = 'pins' in m && m.pins ? { pins: m.pins } : {};
  if (m.kind === 'solve') {
    const spent = deadline(m.seconds);
    let cursor = m.cursor;
    const post = pacer();
    // Steps between posts aren't posted: the chance is carried from the last step that worked one out.
    let chance: FlawlessChance | undefined;
    // The best plan's ceiling, worked out here once per best plan (by content: a step hands back an equal copy) and run
    // count: the page never works it out.
    let ceiling: { key: string; value: Ceiling | undefined } | undefined;
    const ceilingOf = (plan: Plan, runs: number) => {
      const key = `${runs}:${JSON.stringify(plan)}`;
      if (ceiling?.key !== key) ceiling = { key, value: engine.ceiling(m.run, { runs, plan }) };
      return ceiling.value;
    };
    for (;;) {
      const step = engine.solveStep({ run: m.run, ...(m.plan ? { plan: m.plan } : {}), ...pins, budget: m.budget, seed: m.seed, ...(cursor ? { cursor } : {}) });
      cursor = step.cursor;
      chance = step.chance ?? chance;
      const searched = step.converged || spent();
      if (post(searched)) {
        const c = chance && chance.maps.length ? ceilingOf(step.best, chance.runs) : undefined;
        scope.postMessage({ id: m.id, kind: 'step', step: { ...step, chance }, ...(c ? { ceiling: c } : {}), searched, done: false });
      }
      if (!searched) continue;
      // The readings are the adopted plan's (#206): the plan the search started from, which proposals never replace.
      const adopted = step.cursor.search?.start ?? step.best;
      if (m.loss) lossResolve(engine, m, adopted);
      if (engine.pins(m.run, m.pins).length) {
        const cost = pinCost(engine, { run: m.run, ...pins, plan: step.best, budget: m.budget, seed: m.seed });
        scope.postMessage({ id: m.id, kind: 'pin-cost', cost, done: false });
      }
      readings(engine, m, adopted, !m.cost);
      if (m.cost) scope.postMessage({ id: m.id, kind: 'what-it-cost', cost: engine.whatItCost(m.run, adopted, { seed: m.seed, ...pins }), done: true });
      return;
    }
  }
  if (m.kind === 'idle') {
    // Worth and utility first, then the reserves (they need the likely losses), until both settle or time runs out.
    const spent = deadline(m.seconds);
    const common = { run: m.run, plan: m.plan, ...pins, budget: m.budget, seed: m.seed };
    let worth = engine.unitWorth({ ...common, ...(m.worth ? { cursor: m.worth } : {}) });
    let reserves = m.reserves && engine.reserves({ ...common, budget: 0, cursor: m.reserves });
    const post = pacer();
    for (;;) {
      const done = !!reserves?.converged || spent();
      if (post(done)) scope.postMessage({ id: m.id, kind: 'idle', worth, reserves, done });
      if (done) return;
      if (!worth.converged) worth = engine.unitWorth({ ...common, cursor: worth.cursor });
      else reserves = engine.reserves({ ...common, ...(reserves ? { cursor: reserves.cursor } : {}) });
    }
  }
  if (m.kind === 'robin') {
    // The Robin alternatives (#201), until every option is screened and the picks solved, or time runs out.
    const spent = deadline(m.seconds);
    const common = { run: m.run, ...pins, budget: m.budget, seed: m.seed, ...(m.solve ? { solve: m.solve } : {}), ...(m.noRobin ? { noRobin: true } : {}) };
    let cursor = m.cursor;
    const post = pacer();
    for (;;) {
      const step = engine.robinAlternatives({ ...common, ...(cursor ? { cursor } : {}) });
      cursor = step.cursor;
      const done = step.converged || spent();
      if (post(done)) scope.postMessage({ id: m.id, kind: 'robin', step, done });
      if (done) return;
    }
  }
  if (m.kind === 'why') {
    // The Why panel's drill-down (#210): an edit's other plan, or the plan without a unit and the plan itself (worth).
    const options = { seed: m.seed, runs: m.runs };
    if (!m.unit) {
      const chance = engine.flawlessChance(m.run, { ...options, plan: m.plan });
      return void scope.postMessage({ id: m.id, kind: 'why', chance, ...(m.base ? { base: engine.flawlessChance(m.run, { ...options, plan: m.base }) } : {}), done: true });
    }
    const without = engine.worthChance(m.run, m.plan, m.unit, { ...options, ...pins });
    return void scope.postMessage({ id: m.id, kind: 'why', chance: without, base: engine.flawlessChance(m.run, { ...options, plan: m.plan }), done: true });
  }
  if (m.kind === 'stress') {
    // The stress tests (#211): the plan re-run under each blind spot's bad case, one reply a case.
    m.cases.forEach((c, i) =>
      scope.postMessage({ id: m.id, kind: 'stress', stress: c, chance: engine.stressChance(m.run, m.plan, c, { seed: m.seed, runs: m.runs }), done: i === m.cases.length - 1 }),
    );
    return;
  }
  // The preparation page's forecast (#207): the same call the page made, off the page.
  if (m.kind === 'forecast') {
    const plan = m.plan ?? engine.adoptedPlan(m.run, pins);
    scope.postMessage({ id: m.id, kind: 'forecast', plan, forecast: engine.expForecast(m.run, plan), done: !m.map });
    if (!m.map) return;
    // Then the checklist's worth (#175 story 59): each action's removal costed, one reply a cost.
    const input = { run: m.run, plan, map: m.map, seed: m.seed, budgets: m.budgets ?? [] };
    for (let s = engine.actionWorthStep(input); ; s = engine.actionWorthStep({ ...input, cursor: s.cursor })) {
      if (s.kind === 'edit-cost') scope.postMessage({ id: m.id, kind: 'edit-cost', key: s.key, cost: s.cost, done: s.done });
      else if (s.done) scope.postMessage({ id: m.id, kind: 'edits', edits: s.edits, done: true });
      if (s.done) return;
    }
  }
  if (m.kind === 'edits') {
    // A unit's edits (#203): the list, then each cost (its edited plan isn't posted: the Wishlist tab doesn't adopt it).
    for (let s = engine.unitEditsStep({ run: m.run, plan: m.plan, unit: m.unit, ...pins, seed: m.seed, budgets: m.budgets }); ; ) {
      scope.postMessage(s.kind === 'edits' ? { id: m.id, kind: 'edits', edits: s.edits, done: s.done } : { id: m.id, kind: 'edit-cost', key: s.key, cost: s.cost, done: s.done });
      if (s.done) return;
      s = engine.unitEditsStep({ run: m.run, plan: m.plan, unit: m.unit, seed: m.seed, budgets: m.budgets, cursor: s.cursor });
    }
  }
  if (m.kind === 'all-edits') {
    // The inbox's "anything else" (#204): the list, then each asked edit's cost with its edited plan.
    const input = { run: m.run, ...(m.plan ? { plan: m.plan } : {}), ...pins, ...(m.riskiest ? { riskiest: m.riskiest } : {}), keys: m.keys, seed: m.seed, budgets: m.budgets };
    for (let s = engine.editChoicesStep(input); ; ) {
      scope.postMessage(s.kind === 'edits' ? { id: m.id, kind: 'edits', edits: s.edits, done: s.done } : { id: m.id, kind: 'edit-cost', key: s.key, cost: s.cost, edited: s.edited, done: s.done });
      if (s.done) return;
      s = engine.editChoicesStep({ ...input, cursor: s.cursor });
    }
  }
  if (m.kind === 'checks') {
    // The in-play checks (#209): each open rule's stakes, then the setup checks and their edits' costs.
    const input = { run: m.run, plan: m.plan, rules: m.rules, seed: m.seed, budgets: m.budgets };
    for (let s = engine.checksStep(input); ; ) {
      const { cursor, ...reply } = s;
      scope.postMessage({ id: m.id, ...reply });
      if (s.done) return;
      s = engine.checksStep({ ...input, cursor });
    }
  }
  if (m.kind === 'one-pin-cost') {
    // One pin's own cost (#200, on request, #204): a search with it lifted from the adopted plan, then its cost.
    const plan = m.plan ?? engine.adoptedPlan(m.run, pins);
    const cost = pinCost(engine, { run: m.run, ...pins, lift: m.lift, plan, budget: m.budget, seed: m.seed });
    return void scope.postMessage({ id: m.id, kind: 'pin-cost', cost, done: true });
  }
  if (m.kind === 'cost')
    for (const [i, budget] of m.budgets.entries())
      scope.postMessage({ id: m.id, kind: 'cost', cost: engine.editCost({ run: m.run, plan: m.plan, edited: m.edited, seed: m.seed, budget }), done: i === m.budgets.length - 1 });
};

/** The pin cost's second search, stepped within the re-solve's time budget, then its price. */
function pinCost(engine: Engine, input: Omit<Parameters<Engine['pinCostStep']>[0], 'cursor' | 'stop'>) {
  const spent = deadline(SOLVE_SECONDS.resolve);
  let cursor: SearchCursor | undefined;
  for (;;) {
    const s = engine.pinCostStep({ ...input, ...(cursor ? { cursor } : {}), stop: !!cursor && spent() });
    if (s.cost) return s.cost;
    cursor = s.cursor;
  }
}

/** The loss item's re-solve (#208), stepped within the re-solve's time budget; its best plan and chance, if any. */
function lossResolve(engine: Engine, m: Extract<SolveRequest, { kind: 'solve' }>, adopted: Plan) {
  const spent = deadline(SOLVE_SECONDS.resolve);
  const input = { run: m.run, plan: adopted, ...(m.pins ? { pins: m.pins } : {}), budget: m.budget, seed: m.seed };
  for (let s = engine.lossStep(input); ; s = engine.lossStep({ ...input, cursor: s.cursor, stop: spent() })) {
    if (!s.done) continue;
    if (s.result) scope.postMessage({ id: m.id, kind: 'loss', ...s.result, done: false });
    return;
  }
}

/** The adopted plan's readings (#197), posted as they firm up (paced) until `READING_SECONDS` run out; `last` ends the request. */
function readings(engine: Engine, m: { readonly id: number; readonly run: Run; readonly seed: number }, plan: Plan, last: boolean) {
  const spent = deadline(READING_SECONDS);
  const post = pacer();
  for (let s = engine.readingsStep({ run: m.run, plan, seed: m.seed }); ; s = engine.readingsStep({ run: m.run, plan, seed: m.seed, cursor: s.cursor, stop: spent() })) {
    if (s.done) return void scope.postMessage({ id: m.id, kind: 'readings', readings: s.readings, done: last });
    if (post(false)) scope.postMessage({ id: m.id, kind: 'readings', readings: s.readings, done: false });
  }
}
