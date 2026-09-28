/**
 * The guide's welcome as data (#213; spec #175, Pages, storage and migration: the guide). A new visitor picks one of two
 * starts: Plan a run (Run facts, then the inbox's Robin card: two steps, ticked from `guideFacts`) or Just explore (the
 * Table view). The journeys (Fresh run, After a loss, Explore) and their checklist dock retired with the planning they
 * walked through; everything past the first steps is a Going deeper question.
 *
 * Copy interpolates the labels module, so a rename there reaches the guide.
 */
import type { GuideTarget } from './guide';
import type { DeeperId } from './guide-deeper';
import type { GuideFacts } from './guide-facts';
import { LABELS } from './labels';
import { CONTEXT_LABELS } from './scoring-prefs';

/** The views a welcome step lives on; a click switches to it. */
export type GuideView = 'roster' | 'run' | 'table';

export type StartStep = {
  readonly view: GuideView;
  readonly target: GuideTarget;
  readonly title: string;
  /** The one thing to take away, with glossary definitions where a term first appears. */
  readonly takeaway: string;
  /** Where the control is, e.g. "Roster › Run facts". */
  readonly where: string;
  /** The fact that ticks the step. */
  readonly tick: keyof GuideFacts;
  /** Going deeper entries the step links to with “↳ <question>”. */
  readonly deeper?: readonly DeeperId[];
};

export const VIEW_NAMES: Readonly<Record<GuideView, string>> = { roster: LABELS.roster, run: 'Run', table: 'Table' };

const { roster, runFacts, lock } = LABELS;

/** Plan a run: Run facts, then the inbox's Robin card. */
export const PLAN_A_RUN = {
  title: 'Plan a run',
  ask: 'I’m starting a run: set it up, choose Robin, and let the planner work out who marries whom.',
  steps: [
    {
      view: 'roster',
      target: 'run-facts',
      where: `${roster} › ${runFacts}`,
      title: `Set up your run in ${runFacts}`,
      takeaway:
        `Your run’s difficulty (Normal to Lunatic+), mode (Classic: the fallen stay dead; Casual: they come back) and route: ` +
        `${CONTEXT_LABELS['main-story']}, or ${CONTEXT_LABELS['full-route']} (the non-grind DLC woven into the campaign, ending at Apotheosis). ` +
        `Robin’s gender, asset and flaw are ${runFacts} too: set them if you already know your Robin, or leave them open for the Robin card to compare.`,
      tick: 'runSetUp',
    },
    {
      view: 'run',
      target: 'robin-card',
      where: 'Run › inbox › Robin card',
      title: 'Choose your Robin on the inbox’s Robin card',
      takeaway:
        `The Run view opens on its inbox, “Before the run: what needs you”. Its Robin card compares Robins by flawless chance, and at 0% by how far runs get (Compare Robins solves them in the background); ` +
        `Choose takes a Robin’s whole wishlist as your plan, and ${lock} Robin and start writes that Robin into ${runFacts}, locking only Robin (before you choose, it takes the search’s best). ` +
        'The rest of the inbox lists what else needs you before the Prologue.',
      tick: 'robinLocked',
      deeper: ['inbox-before', 'wishlist'],
    },
  ] satisfies readonly StartStep[] as readonly StartStep[],
} as const;

/** Just explore: the Table view, no run needed. */
export const JUST_EXPLORE = {
  title: 'Just explore',
  ask: 'Browse every child’s pairings, the units and the maps. No run needed.',
  view: 'table',
  target: 'child-table',
} as const satisfies { title: string; ask: string; view: GuideView; target: GuideTarget };

/** Whether a step is done. */
export const stepDone = (step: StartStep, facts: GuideFacts): boolean => facts[step.tick];

/** Done steps out of all of them. */
export function startProgress(steps: readonly StartStep[], facts: GuideFacts): { done: number; of: number } {
  return { done: steps.filter((s) => stepDone(s, facts)).length, of: steps.length };
}
