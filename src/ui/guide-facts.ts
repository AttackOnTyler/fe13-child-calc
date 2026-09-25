import { stateOf, type Couple, type PlayContext, type Roster, type RosterUnit, type UnitState } from '../engine';
import { dismissLoss, type GuidePrefs } from './guide-prefs';
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
  /** Robin is locked: every run fact is set (by the Plan's Lock or in Run facts), so there is no Robin left to pick. */
  readonly robinLocked: boolean;
  readonly unitBenched: boolean;
  /** The run's marriage plan is adopted. */
  readonly planAdopted: boolean;
  /**
   * The adopted plan still holds: none of its couples has lost a partner (dead or missed) short of a marriage, and every
   * real marriage is one of its couples. A loss unsets it until the re-plan is adopted; a bench, a what-if, doesn't.
   */
  readonly adoptedPlanHolds: boolean;
  /** A unit is dead or missed. */
  readonly unitLost: boolean;
  /** A marriage really happened (✓ Married), not only a pin. */
  readonly marriageRecorded: boolean;
};

/** Hard losses: gone for good. */
const LOST: readonly UnitState[] = ['dead', 'missed'];

/**
 * The real marriages (✓ Married) the adopted plan doesn't hold, each couple once; none without an adopted plan. The
 * Adopt tick and the loss prompt both read it: a marriage the plan made is progress, not a loss.
 */
export function offPlanMarriages({ savedPlan, spouses }: Roster): Couple[] {
  if (!savedPlan) return [];
  const planned = new Set(savedPlan.marriages.flatMap(([a, b]) => [`${a}+${b}`, `${b}+${a}`]));
  const seen = new Set<RosterUnit>();
  return (Object.keys(spouses) as RosterUnit[]).flatMap((u): Couple[] => {
    const s = spouses[u];
    if (s?.bond !== 'married' || seen.has(u)) return [];
    seen.add(u).add(s.partner);
    return planned.has(`${u}+${s.partner}`) ? [] : [[u, s.partner]];
  });
}

/** The adopted plan still holds: no couple of it has lost a partner short of a marriage, and no real marriage is off it. */
function adoptedPlanHolds(roster: Roster): boolean {
  const { savedPlan, spouses } = roster;
  if (!savedPlan) return false;
  const lost = (u: RosterUnit) => LOST.includes(stateOf(roster, u));
  const married = (a: RosterUnit, b: RosterUnit) => spouses[a]?.partner === b && spouses[a]?.bond === 'married';
  return savedPlan.marriages.every(([a, b]) => married(a, b) || !(lost(a) || lost(b))) && offPlanMarriages(roster).length === 0;
}

export function guideFacts(roster: Roster, { acts }: PlanPrefs, context: PlayContext): GuideFacts {
  const { gender, asset, flaw } = roster.run;
  const states = (Object.keys(roster.states) as RosterUnit[]).map((u) => stateOf(roster, u));
  return {
    contextChosen: context !== DEFAULT_PREFS.context,
    deployEdited: acts.deployEditedAt !== undefined,
    prioritiesSet: acts.prioritiesSetAt !== undefined,
    robinLocked: !!gender && !!asset && !!flaw,
    unitBenched: states.includes('benched'),
    planAdopted: roster.savedPlan !== null,
    adoptedPlanHolds: adoptedPlanHolds(roster),
    unitLost: states.some((s) => LOST.includes(s)),
    marriageRecorded: Object.values(roster.spouses).some((s) => s?.bond === 'married'),
  };
}

/** Each loss the roster records, as a stable event key: `dead:<unit>`, `missed:<unit>`, or `married:<a>+<b>` off the plan. */
function currentLosses(roster: Roster): string[] {
  const lost = (Object.keys(roster.states) as RosterUnit[]).flatMap((u) => {
    const s = stateOf(roster, u);
    return LOST.includes(s) ? [`${s}:${u}`] : [];
  });
  return [...lost, ...offPlanMarriages(roster).map((c) => `married:${[...c].sort().join('+')}`)];
}

/** The loss prompt can show: the dock is open or on its pill, in Fresh run or Explore. */
const promptable = ({ dock, journey }: GuidePrefs): boolean => dock !== 'closed' && journey !== 'loss';

/**
 * The loss prompt: the new losses to offer After a loss for, or none while it can't show. A dead or missed unit, or a
 * real marriage off the adopted plan, is new until the prompt is taken or dismissed, or it is settled.
 */
export function lossPrompt(roster: Roster, prefs: GuidePrefs): string[] {
  return promptable(prefs) ? currentLosses(roster).filter((e) => !prefs.lossEvents.includes(e)) : [];
}

/** Notes every loss the roster records as seen: those already saved when the page loads aren't new. */
export const noteLosses = (roster: Roster, prefs: GuidePrefs): GuidePrefs => dismissLoss(prefs, currentLosses(roster));

/**
 * Losses recorded while the prompt can't show (dock closed, or already on After a loss) are noted as seen, so they
 * don't prompt later. The same prefs come back when nothing changes.
 */
export const settleLosses = (roster: Roster, prefs: GuidePrefs): GuidePrefs => (promptable(prefs) ? prefs : noteLosses(roster, prefs));
