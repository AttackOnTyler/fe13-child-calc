/**
 * The anytime solve's stepping call (#198; spec #175, Engine interfaces): given the adopted plan (or none: the seed),
 * the recorded run, the pins and a budget in evaluations, it returns the best plan found so far, the proposals and
 * whether the search has converged. The Web Worker (#199) loops it against a time budget; it holds no logic.
 *
 * Deterministic: the same run, plan, pins, budget, seed and cursor give the same step. An evaluation is one flawless
 * chance of one plan over `runs` simulated runs (its time grows with how far those runs get).
 *
 * The local search (#199) spends the budget on single edits; until then a step evaluates the plan it starts from and
 * has nothing left to try, so it proposes nothing and has converged. What already happened is the starting state:
 * the evaluation reads the log first (a recorded marriage stands whatever the plan lists), never a pin.
 */
import type { DeploymentRole } from '../../curated/deployment';
import type { FlawlessChance } from '../flawless';
import type { RosterUnit } from '../roster';
import type { Run } from '../run';
import type { Plan, PlanPin, PlanProposal, SolveCursor } from './plan';

export type SolveStepInput = {
  readonly run: Run;
  /** The adopted plan to improve on; absent: the seed. */
  readonly plan?: Plan;
  /** Hard constraints: the seed and every edit keep them. */
  readonly pins?: readonly PlanPin[];
  /** How many evaluations this step may spend: 0 returns the plan it starts from, unevaluated. */
  readonly budget: number;
  /** Every chance is seeded: edits are compared on the same runs. */
  readonly seed: number;
  /** Simulated runs per evaluation; `FLAWLESS_RUNS` by default. */
  readonly runs?: number;
  /** The cursor the previous step returned, passed back unchanged; absent on a first step. */
  readonly cursor?: SolveCursor;
  /** Each unit's deployment role for the greedy lineups (until #212). */
  readonly roleOf?: (u: RosterUnit) => DeploymentRole;
};

export type SolveStep = {
  /** The best plan found so far. */
  readonly best: Plan;
  /** Its flawless chance, when this step worked it out. */
  readonly chance: FlawlessChance | undefined;
  /** Improvements on the adopted plan, best first: offered, never applied. */
  readonly proposals: readonly PlanProposal[];
  /** No single edit is left to try. */
  readonly converged: boolean;
  /** Evaluations this step spent (never more than the budget). */
  readonly evaluations: number;
  /** Pass it to the next step. */
  readonly cursor: SolveCursor;
};

export function solveStep(input: SolveStepInput, seed: () => Plan, evaluate: (plan: Plan) => FlawlessChance): SolveStep {
  const best = input.plan ?? seed();
  const spent = input.cursor?.evaluations ?? 0;
  if (Math.floor(input.budget) < 1) return { best, chance: undefined, proposals: [], converged: false, evaluations: 0, cursor: { evaluations: spent } };
  return { best, chance: evaluate(best), proposals: [], converged: true, evaluations: 1, cursor: { evaluations: spent + 1 } };
}
