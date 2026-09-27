import { stateOf, type PlayContext, type Roster, type RosterUnit, type UnitState } from '../engine';
import { dismissLoss, type GuidePrefs } from './guide-prefs';
import { DEFAULT_PREFS } from './scoring-prefs';

/**
 * What the guide's checklist can tick, read from stored state only (never the DOM): the roster and the play context.
 * The Plan page's facts (Deploy edited, priorities set, a child benched, the plan adopted) went with it (#212).
 */
export type GuideFacts = {
  /** The run's difficulty and route are set in Run facts (#108). */
  readonly runSetUp: boolean;
  /** The play context is no longer the default. */
  readonly contextChosen: boolean;
  /** Robin is locked: every run fact is set (by the Robin Lock or in Run facts), so there is no Robin left to pick. */
  readonly robinLocked: boolean;
  /** A unit is dead or missed. */
  readonly unitLost: boolean;
  /** A marriage really happened (✓ Married). */
  readonly marriageRecorded: boolean;
};

/** Hard losses: gone for good. */
const LOST: readonly UnitState[] = ['dead', 'missed'];

export function guideFacts(roster: Roster, context: PlayContext): GuideFacts {
  const { gender, asset, flaw } = roster.run;
  const units = Object.keys(roster.states) as RosterUnit[];
  const states = units.map((u) => stateOf(roster, u));
  return {
    runSetUp: !!roster.run.difficulty && !!roster.run.route,
    contextChosen: context !== DEFAULT_PREFS.context,
    robinLocked: !!gender && !!asset && !!flaw,
    unitLost: states.some((s) => LOST.includes(s)),
    marriageRecorded: Object.values(roster.spouses).some((s) => s?.bond === 'married'),
  };
}

/** Each loss the roster records, as a stable event key: `dead:<unit>` or `missed:<unit>`. */
function currentLosses(roster: Roster): string[] {
  return (Object.keys(roster.states) as RosterUnit[]).flatMap((u) => {
    const s = stateOf(roster, u);
    return LOST.includes(s) ? [`${s}:${u}`] : [];
  });
}

/** The loss prompt can show: the dock is open or on its pill, in Fresh run or Explore. */
const promptable = ({ dock, journey }: GuidePrefs): boolean => dock !== 'closed' && journey !== 'loss';

/**
 * The loss prompt: the new losses to offer After a loss for, or none while it can't show. A dead or missed unit is new
 * until the prompt is taken or dismissed, or it is settled. (A marriage off the plan is the inbox's loss item, #208.)
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
