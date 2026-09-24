import { stateOf, type PlayContext, type Roster, type RosterUnit, type UnitState } from '../engine';
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
  /**
   * The adopted plan still holds: none of its couples has lost a partner (dead or missed) short of a marriage, and every
   * real marriage is one of its couples. A loss unsets it until the re-plan is adopted; a bench, a what-if, doesn't.
   */
  readonly planCurrent: boolean;
  /** A unit is dead or missed. */
  readonly unitLost: boolean;
  /** A marriage really happened (✓ Married), not only a pin. */
  readonly marriageRecorded: boolean;
};

/** Hard losses: gone for good. */
const LOST: readonly UnitState[] = ['dead', 'missed'];

function planCurrent(roster: Roster): boolean {
  const { savedPlan, spouses } = roster;
  if (!savedPlan) return false;
  const lost = (u: RosterUnit) => LOST.includes(stateOf(roster, u));
  const married = (a: RosterUnit, b: RosterUnit) => spouses[a]?.partner === b && spouses[a]?.bond === 'married';
  const saved = new Set(savedPlan.marriages.flatMap(([a, b]) => [`${a}+${b}`, `${b}+${a}`]));
  return (
    savedPlan.marriages.every(([a, b]) => married(a, b) || !(lost(a) || lost(b))) &&
    (Object.keys(spouses) as RosterUnit[]).every((u) => spouses[u]?.bond !== 'married' || saved.has(`${u}+${spouses[u]!.partner}`))
  );
}

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
    planCurrent: planCurrent(roster),
    unitLost: states.some((s) => LOST.includes(s)),
    marriageRecorded: Object.values(roster.spouses).some((s) => s?.bond === 'married'),
  };
}
