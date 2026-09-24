import { stateOf, type PlayContext, type Roster, type RosterUnit } from '../engine';
import type { PlanPrefs } from './plan-prefs';
import { DEFAULT_PREFS } from './scoring-prefs';

/**
 * What the guide's checklist can tick, read from stored state only (never the DOM): the roster, the plan preferences
 * and their act flags, and the play context.
 */
export type GuideFacts = {
  /** The play context is no longer the default. */
  readonly contextChosen: boolean;
  readonly deployEdited: boolean;
  readonly prioritiesSet: boolean;
  /** Suggest roles ran. */
  readonly rolesSuggested: boolean;
  /** Robin is locked: every run fact is set (by the Plan's Lock or in Run facts), so there is no Robin left to pick. */
  readonly robinLocked: boolean;
  readonly unitBenched: boolean;
  /** The run's marriage plan is adopted. */
  readonly planAdopted: boolean;
  /** A unit is dead or missed. */
  readonly unitLost: boolean;
  /** A marriage really happened (✓ Married), not only a pin. */
  readonly marriageRecorded: boolean;
};

export function guideFacts(roster: Roster, { acts }: PlanPrefs, context: PlayContext): GuideFacts {
  const { gender, asset, flaw } = roster.run;
  const states = (Object.keys(roster.states) as RosterUnit[]).map((u) => stateOf(roster, u));
  return {
    contextChosen: context !== DEFAULT_PREFS.context,
    deployEdited: acts.deployEditedAt !== undefined,
    prioritiesSet: acts.prioritiesSetAt !== undefined,
    rolesSuggested: acts.suggestedAt !== undefined,
    robinLocked: !!gender && !!asset && !!flaw,
    unitBenched: states.includes('benched'),
    planAdopted: roster.savedPlan !== null,
    unitLost: states.includes('dead') || states.includes('missed'),
    marriageRecorded: Object.values(roster.spouses).some((s) => s?.bond === 'married'),
  };
}
