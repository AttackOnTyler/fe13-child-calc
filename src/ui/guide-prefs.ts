import { hasSavedRoster } from './roster-store';

/**
 * The guide's own preferences, under their own key: Clear all never touches them, so clearing a run doesn't replay
 * the welcome. Only `seen` is kept (#213): the journeys, the checklist dock and the loss prompt retired, and the fields
 * they saved (`journey`, `dock`, `lossEvents`) are ignored when read and dropped at the next save.
 */
export type GuidePrefs = {
  /** The welcome box was answered or closed, so it no longer shows by itself. */
  readonly seen: boolean;
};

export const DEFAULT_GUIDE_PREFS: GuidePrefs = { seen: false };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Guide preferences as saved; a missing or broken `seen` falls back to unseen, and any other field is ignored. */
export function parseGuidePrefs(raw: unknown): GuidePrefs {
  if (!isObject(raw)) return DEFAULT_GUIDE_PREFS;
  return { seen: typeof raw.seen === 'boolean' ? raw.seen : DEFAULT_GUIDE_PREFS.seen };
}

/** The welcome box shows by itself only to a new visitor: never seen, and nothing saved from an earlier visit. */
export const welcomeShows = (prefs: GuidePrefs, savedRun: boolean): boolean => !prefs.seen && !savedRun;

/** Any answer to the welcome box (Plan a run, Just explore, or its ✕): seen, so it doesn't show by itself again. */
export const closeWelcome = (prefs: GuidePrefs): GuidePrefs => (prefs.seen ? prefs : { ...prefs, seen: true });

/** Whether an earlier visit saved a run. */
export const hasSavedRun = (): boolean => hasSavedRoster();

const KEY = 'fe13-child-calc:guide:v1';

export function loadGuidePrefs(): GuidePrefs {
  try {
    return parseGuidePrefs(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return DEFAULT_GUIDE_PREFS;
  }
}

export function saveGuidePrefs(prefs: GuidePrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ seen: prefs.seen }));
  } catch {
    // Storage unavailable: the guide still works for this session.
  }
}
