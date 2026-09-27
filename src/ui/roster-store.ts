import { EMPTY_RUN, migrateRun, parseRun, rosterOf, withRoster, type Roster, type Run } from '../engine';

/**
 * Run state: one run, `run:v2` (#205), persists in localStorage apart from the preferences and the checked rules, so
 * Clear all never touches them. The roster is the run's view (unit states and spouses from the latest entry).
 *
 * The first read with no `run:v2` migrates once (`migrateRun`) from `run:v1` with `plan:v1`, or from a roster saved
 * before the chapter log, and saves the result with its migration note. `run:v1` and `plan:v1` stay untouched: `run:v1`
 * as a backup for one release, `plan:v1` for today's Plan page until #212 retires it.
 */
const KEY = 'fe13-child-calc:run:v2';
const V1_KEY = 'fe13-child-calc:run:v1';
const PLAN_V1_KEY = 'fe13-child-calc:plan:v1';
const OLD_ROSTER_KEY = 'fe13-child-calc:roster:v1';

const readJson = (key: string): unknown => {
  const raw = localStorage.getItem(key);
  return raw === null ? undefined : JSON.parse(raw);
};

/** The run:v1 to migrate: as saved, or a roster from before the chapter log as its first entry. */
function savedV1(): unknown {
  const v1 = readJson(V1_KEY);
  if (v1 !== undefined) return v1;
  const roster = readJson(OLD_ROSTER_KEY);
  return roster === undefined ? undefined : { version: 1, roster };
}

export function loadRun(): Run {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) return parseRun(JSON.parse(raw));
    const v1 = savedV1();
    if (v1 === undefined) return EMPTY_RUN;
    let plan: unknown;
    try {
      plan = readJson(PLAN_V1_KEY);
    } catch {
      // Corrupt plan preferences: nothing of them to list.
    }
    const run = migrateRun(v1, plan);
    saveRun(run);
    return run;
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

/** Whether a run (`run:v2`, or one still to migrate) is saved at all; false when storage is blocked. */
export function hasSavedRoster(): boolean {
  try {
    return [KEY, V1_KEY, OLD_ROSTER_KEY].some((k) => localStorage.getItem(k) !== null);
  } catch {
    return false;
  }
}

/** Writes a roster edit into the saved run's latest entry. */
export const saveRoster = (roster: Roster): void => saveRun(withRoster(loadRun(), roster));

/**
 * Clear all: `run:v2` is wiped (saved empty, so `run:v1` is never migrated again). Preferences and checked rules stay.
 */
export function clearRoster(): void {
  saveRun(EMPTY_RUN);
}
