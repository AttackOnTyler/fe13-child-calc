/**
 * The anytime solve's Web Worker (#199; spec #175, Engine interfaces): a thin shell that loops the facade's stepping
 * call against a time budget and posts each step back, or reads an edit's cost at each budget it's given. Once the
 * solve is done and the run has pins, the worker is idle, so it works out the pin cost (#200): a second search with the
 * pins lifted (`liftPins`), from the best plan found with them, then `pinCost`. Then it reads the adopted plan's readings
 * (#197, #206: the plan the search started from, never its proposals): the EXP forecast's first pass, then each pending milestone's suggested changes, one milestone a reply, within
 * `READING_SECONDS`. With an open loss (#208) it first re-solves from the loss item's proposal; after the readings,
 * when asked, it prices What it cost for the latest recorded map (#208). The page may also hand it idle work (#202): the plan's unit worth and utility, then its reserves;
 * or, on request, the Robin alternatives (#201), after the search, pin cost and readings; and the Wishlist tab (#203) asks,
 * in a second worker, for a unit's edits, listed then costed one by one (`unitEdits`); the inbox (#204) asks there for
 * every edit (`editChoices`), its matches costed with their edited plans, and for one pin's own cost; after the Lock, a
 * third worker works out the in-play checks' stakes and setup checks (#209). It holds no logic: the search,
 * its state (the cursor) and its budgets are the engine's. Started by `solve-client.ts`, which terminates it to stop a solve.
 */
import { EDIT_COST_BUDGET, READING_SECONDS, SOLVE_SECONDS, SUGGEST_RUNS, createEngine, type Assumptions, type Engine, type Plan, type RuleStake, type Run, type SolveCursor, type SuggestedChange, type UnitEdit } from '../engine';
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
  if (m.kind === 'solve') {
    const pinned = engine.pins(m.run, m.pins).length > 0;
    const end = performance.now() + m.seconds * 1000;
    let cursor = m.cursor;
    for (;;) {
      const step = engine.solveStep({ run: m.run, ...(m.plan ? { plan: m.plan } : {}), ...(m.pins ? { pins: m.pins } : {}), budget: m.budget, seed: m.seed, ...(cursor ? { cursor } : {}) });
      cursor = step.cursor;
      const searched = step.converged || performance.now() >= end;
      scope.postMessage({ id: m.id, kind: 'step', step, searched, done: false });
      if (!searched) continue;
      // The readings are the adopted plan's (#206): the plan the search started from, which proposals never replace.
      const adopted = step.cursor.search?.start ?? step.best;
      if (m.loss) lossResolve(engine, m, adopted);
      if (!pinned) return afterSearch(engine, m, adopted);
      // Idle: the pin cost's second search, with the pins lifted, from the best plan found with them.
      const lifted = engine.liftPins(m.run, m.pins ? { pins: m.pins } : {});
      const stop = performance.now() + SOLVE_SECONDS.resolve * 1000;
      let free = step.best;
      let c: SolveCursor | undefined;
      for (;;) {
        const s = engine.solveStep({ run: lifted, plan: step.best, budget: m.budget, seed: m.seed, ...(c ? { cursor: c } : {}) });
        c = s.cursor;
        free = s.best;
        if (s.converged || performance.now() >= stop) break;
      }
      const cost = engine.pinCost({ run: m.run, ...(m.pins ? { pins: m.pins } : {}), plan: step.best, lifted: free, seed: m.seed, budget: EDIT_COST_BUDGET.settled });
      scope.postMessage({ id: m.id, kind: 'pin-cost', cost, done: false });
      return afterSearch(engine, m, adopted);
    }
  }
  if (m.kind === 'idle') {
    // Worth and utility first, then the reserves (they need the likely losses), until both settle or time runs out.
    const end = performance.now() + m.seconds * 1000;
    const common = { run: m.run, plan: m.plan, ...(m.pins ? { pins: m.pins } : {}), budget: m.budget, seed: m.seed };
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
    const common = { run: m.run, ...(m.pins ? { pins: m.pins } : {}), budget: m.budget, seed: m.seed, ...(m.solve ? { solve: m.solve } : {}), ...(m.noRobin ? { noRobin: true } : {}) };
    let cursor = m.cursor;
    for (;;) {
      const step = engine.robinAlternatives({ ...common, ...(cursor ? { cursor } : {}) });
      cursor = step.cursor;
      const done = step.converged || performance.now() >= end;
      scope.postMessage({ id: m.id, kind: 'robin', step, done });
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
    const without = engine.worthChance(m.run, m.plan, m.unit, { ...options, ...(m.pins ? { pins: m.pins } : {}) });
    return void scope.postMessage({ id: m.id, kind: 'why', chance: without, base: engine.flawlessChance(m.run, { ...options, plan: m.plan }), done: true });
  }
  if (m.kind === 'edits') return unitEdits(engine, m);
  if (m.kind === 'checks') return checks(engine, m);
  if (m.kind === 'all-edits') return allEdits(engine, m);
  if (m.kind === 'one-pin-cost') {
    // One pin's own cost (#200, on request, #204): a search with it lifted from the adopted plan, then its cost.
    const pins = m.pins ? { pins: m.pins } : {};
    const plan = m.plan ?? engine.adoptedPlan(m.run, { ...pins });
    const lifted = engine.liftPins(m.run, { ...pins, lift: m.lift });
    const stop = performance.now() + SOLVE_SECONDS.resolve * 1000;
    let free = plan;
    let c: SolveCursor | undefined;
    for (;;) {
      const s = engine.solveStep({ run: lifted, plan, budget: m.budget, seed: m.seed, ...(c ? { cursor: c } : {}) });
      c = s.cursor;
      free = s.best;
      if (s.converged || performance.now() >= stop) break;
    }
    const cost = engine.pinCost({ run: m.run, ...pins, lift: m.lift, plan, lifted: free, seed: m.seed, budget: EDIT_COST_BUDGET.settled });
    return void scope.postMessage({ id: m.id, kind: 'pin-cost', cost, done: true });
  }
  for (const [i, budget] of m.budgets.entries())
    scope.postMessage({ id: m.id, kind: 'cost', cost: engine.editCost({ run: m.run, plan: m.plan, edited: m.edited, seed: m.seed, budget }), done: i === m.budgets.length - 1 });
};

/**
 * The in-play checks (#209): each open rule's stakes on the adopted plan, one re-run under its other reading (a rule the
 * model doesn't read has none, at once), the rules the model reads first; then the setup checks those stakes call for,
 * each one's edit costed at each budget in turn.
 */
function checks(engine: Engine, m: Extract<SolveRequest, { kind: 'checks' }>) {
  const open = engine.openRules(m.rules).filter((s) => s.state === 'open').map((s) => s.rule);
  const order = [...open.filter((r) => !r.assumption), ...open.filter((r) => r.assumption)];
  const stakes: RuleStake[] = [];
  for (const r of order) {
    const stake = engine.ruleStakes(m.run, m.plan, r.id, { seed: m.seed });
    stakes.push(stake);
    scope.postMessage({ id: m.id, kind: 'stake', stake, done: false });
  }
  const setup = engine.setupChecks(m.run, m.plan, { rules: m.rules, stakes, seed: m.seed });
  const costed = setup.filter((c) => c.edit);
  scope.postMessage({ id: m.id, kind: 'setup', checks: setup, done: !costed.length || !m.budgets.length });
  const settled = new Set<string>();
  if (!costed.length || !m.budgets.length) return;
  for (const budget of m.budgets)
    for (const c of costed) {
      if (settled.has(c.rule)) continue;
      const cost = engine.editCost({ run: m.run, plan: m.plan, edited: c.edit!.plan, seed: m.seed, budget });
      if (cost.settled) settled.add(c.rule);
      scope.postMessage({ id: m.id, kind: 'setup-cost', rule: c.rule, cost, done: false });
    }
  scope.postMessage({ id: m.id, kind: 'setup', checks: setup, done: true });
}

/** The order a unit's edits are costed in (#203): the likeliest choices first; a build skill costs nothing to read. */
const COST_ORDER: readonly UnitEdit['kind'][] = ['keep', 'marriage', 'class', 'pass', 'lineup', 'pair', 'robin', 'priority', 'place', 'seal', 'item', 'build', 'side-goal'];

/**
 * A unit's edits (#203): listed at once, then each costed at each budget in turn (every edit provisional first, then
 * each settled), skipping those already settled; the list again, marked done, when every cost is in.
 */
function unitEdits(engine: Engine, m: Extract<SolveRequest, { kind: 'edits' }>) {
  const edits = engine.unitEdits(m.run, m.plan, m.unit, { ...(m.pins ? { pins: m.pins } : {}), seed: m.seed });
  const views = edits.map(({ kind, key, label, pins }) => ({ kind, key, label, pins }));
  scope.postMessage({ id: m.id, kind: 'edits', edits: views, done: false });
  const order = [...edits].sort((a, b) => COST_ORDER.indexOf(a.kind) - COST_ORDER.indexOf(b.kind));
  const plans = new Map<string, Plan>();
  const settled = new Set<string>();
  for (const budget of m.budgets)
    for (const e of order) {
      if (settled.has(e.key)) continue;
      let edited = plans.get(e.key);
      if (!edited) plans.set(e.key, (edited = e.make()));
      const cost = engine.editCost({ run: m.run, plan: m.plan, edited, pins: e.play, seed: m.seed, budget });
      if (cost.settled) settled.add(e.key);
      scope.postMessage({ id: m.id, kind: 'edit-cost', key: e.key, cost, done: false });
    }
  scope.postMessage({ id: m.id, kind: 'edits', edits: views, done: true });
}

/**
 * The inbox's "anything else" (#204): every edit the player can make, listed at once; then each of `keys` costed at
 * each budget in turn (all provisional first, then each settled), each with its edited plan (a plan edit adopts it).
 */
function allEdits(engine: Engine, m: Extract<SolveRequest, { kind: 'all-edits' }>) {
  const pins = m.pins ? { pins: m.pins } : {};
  const plan = m.plan ?? engine.adoptedPlan(m.run, { ...pins });
  const edits = engine.editChoices(m.run, plan, { ...pins, seed: m.seed, ...(m.riskiest ? { riskiest: m.riskiest } : {}) });
  const asked = m.keys.flatMap((k) => edits.filter((e) => e.key === k));
  const last = asked.length && m.budgets.length ? asked.length * m.budgets.length : 0;
  scope.postMessage({ id: m.id, kind: 'edits', edits: edits.map(({ kind, key, label, pins }) => ({ kind, key, label, pins })), done: !last });
  const plans = new Map<string, Plan>();
  const settled = new Set<string>();
  for (const budget of m.budgets)
    for (const e of asked) {
      if (settled.has(e.key)) continue;
      let edited = plans.get(e.key);
      if (!edited) plans.set(e.key, (edited = e.make()));
      const cost = engine.editCost({ run: m.run, plan, edited, pins: e.play, seed: m.seed, budget });
      if (cost.settled) settled.add(e.key);
      scope.postMessage({ id: m.id, kind: 'edit-cost', key: e.key, cost, edited, done: false });
    }
  if (last) scope.postMessage({ id: m.id, kind: 'edits', edits: edits.map(({ kind, key, label, pins }) => ({ kind, key, label, pins })), done: true });
}

/**
 * The loss item's re-solve (#208): the search again from the loss item's proposal (the plan for the army that's left),
 * for the re-solve's time budget; its best plan and chance are posted for the player to accept.
 */
function lossResolve(engine: Engine, m: Extract<SolveRequest, { kind: 'solve' }>, adopted: Plan) {
  const item = engine.lossItem(m.run, adopted, { ...(m.pins ? { pins: m.pins } : {}) });
  if (!item) return;
  const stop = performance.now() + SOLVE_SECONDS.resolve * 1000;
  let c: SolveCursor | undefined;
  let best = item.plan;
  let chance: { chance: number; margin: number } | undefined;
  for (;;) {
    const s = engine.solveStep({ run: m.run, plan: item.plan, ...(m.pins ? { pins: m.pins } : {}), budget: m.budget, seed: m.seed, ...(c ? { cursor: c } : {}) });
    c = s.cursor;
    best = s.best;
    if (s.chance) chance = { chance: s.chance.chance, margin: s.chance.margin };
    if (s.converged || performance.now() >= stop) break;
  }
  if (chance) scope.postMessage({ id: m.id, kind: 'loss', plan: best, ...chance, done: false });
}

/** Once the search (and pin cost) is done: the readings, then, when asked, What it cost (#208), the last reply. */
function afterSearch(engine: Engine, m: Extract<SolveRequest, { kind: 'solve' }>, adopted: Plan) {
  readings(engine, m, adopted, !m.cost);
  if (!m.cost) return;
  const cost = engine.whatItCost(m.run, adopted, { seed: m.seed, ...(m.pins ? { pins: m.pins } : {}) });
  scope.postMessage({ id: m.id, kind: 'what-it-cost', cost, done: true });
}

/**
 * The best plan's readings (#197), posted as they firm up: the first pass from its EXP forecast (a unit below 80% reads
 * "at risk?"), then each pending milestone's suggested changes on `SUGGEST_RUNS` runs, until `READING_SECONDS` run out.
 */
function readings(engine: Engine, m: { readonly id: number; readonly run: Run; readonly seed: number }, plan: Plan, last = true) {
  const options = { seed: m.seed };
  const forecast = engine.expForecast(m.run, plan, options);
  if (!forecast.maps.length) return void scope.postMessage({ id: m.id, kind: 'readings', readings: undefined, done: last });
  let read = engine.readings(m.run, plan, { ...options, forecast });
  const suggestions: Record<string, readonly SuggestedChange[]> = {};
  const end = performance.now() + READING_SECONDS * 1000;
  for (const id of read.pending) {
    scope.postMessage({ id: m.id, kind: 'readings', readings: read, done: false });
    if (performance.now() >= end) break;
    suggestions[id] = engine.suggestedChanges(m.run, plan, id, { ...options, runs: SUGGEST_RUNS });
    read = engine.readings(m.run, plan, { ...options, forecast, suggestions, stats: read.stats });
  }
  scope.postMessage({ id: m.id, kind: 'readings', readings: read, done: last });
}
