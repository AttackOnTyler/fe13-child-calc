import type { Roster } from '../engine';

/**
 * What the guide can tick, read from stored state only (never the DOM): the roster's Run facts. #213 retired the
 * journeys, and with them the facts only their steps read (the play context chosen, a unit lost, a marriage recorded)
 * and the loss prompt; the welcome's Plan a run ticks its two steps from these.
 */
export type GuideFacts = {
  /** The run's difficulty and route are set in Run facts (#108). */
  readonly runSetUp: boolean;
  /** Robin is locked: every run fact is set (by the Robin Lock or in Run facts), so there is no Robin left to pick. */
  readonly robinLocked: boolean;
};

export function guideFacts(roster: Roster): GuideFacts {
  const { gender, asset, flaw, difficulty, route } = roster.run;
  return { runSetUp: !!difficulty && !!route, robinLocked: !!gender && !!asset && !!flaw };
}
