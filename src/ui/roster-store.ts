import { EMPTY_RUN, parseRoster, parseRun, rosterOf, runFromRoster, withRoster, type Roster, type Run } from '../engine';

/**
 * Run state: one run (#116) persists in localStorage apart from the preferences, so Clear all never touches scoring.
 * The roster is the run's view (unit states and spouses from the latest chapter-log entry). A roster saved before the
 * chapter log existed migrates into a run's first entry the first time it's read.
 */
const KEY = 'fe13-child-calc:run:v1';
const OLD_ROSTER_KEY = 'fe13-child-calc:roster:v1';

export function loadRun(): Run {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) return parseRun(JSON.parse(raw));
    const old = localStorage.getItem(OLD_ROSTER_KEY);
    return old !== null ? runFromRoster(parseRoster(JSON.parse(old))) : EMPTY_RUN;
  } catch {
    return EMPTY_RUN;
  }
}

export function saveRun(run: Run): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(run));
    localStorage.removeItem(OLD_ROSTER_KEY);
  } catch {
    // Storage unavailable: the run still applies for this session.
  }
}

export const loadRoster = (): Roster => rosterOf(loadRun());

/** Whether a run (or a roster from before the chapter log) is saved at all; false when storage is blocked. */
export function hasSavedRoster(): boolean {
  try {
    return localStorage.getItem(KEY) !== null || localStorage.getItem(OLD_ROSTER_KEY) !== null;
  } catch {
    return false;
  }
}

/** Writes a roster edit into the saved run's latest entry. */
export const saveRoster = (roster: Roster): void => saveRun(withRoster(loadRun(), roster));

export function clearRoster(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_ROSTER_KEY);
  } catch {
    // Nothing saved to clear.
  }
}
