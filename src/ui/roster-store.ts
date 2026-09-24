import { EMPTY_ROSTER, parseRoster, type Roster } from '../engine';

/** Run state: the roster persists in localStorage apart from the preferences, so Clear all never touches scoring. */
const KEY = 'fe13-child-calc:roster:v1';

export function loadRoster(): Roster {
  try {
    return parseRoster(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return EMPTY_ROSTER;
  }
}

/** Whether a roster is saved at all; false when storage is blocked. */
export function hasSavedRoster(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function saveRoster(roster: Roster): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(roster));
  } catch {
    // Storage unavailable: the roster still applies for this session.
  }
}

export function clearRoster(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing saved to clear.
  }
}
