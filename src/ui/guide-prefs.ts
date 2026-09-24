import { hasSavedPlanPrefs } from './plan-prefs';
import { hasSavedRoster } from './roster-store';

/** A guide journey: Plan a fresh run, Re-plan after a loss, or Just look around. */
export type Journey = 'fresh' | 'loss' | 'explore';

/** The checklist dock: open, collapsed to its progress pill, or closed. */
export type DockState = 'open' | 'pill' | 'closed';

/**
 * The guide's own preferences, under their own key: Clear all never touches them, so clearing a run doesn't replay
 * onboarding.
 */
export type GuidePrefs = {
  /** The welcome box was answered or closed, so it no longer shows by itself. */
  readonly seen: boolean;
  /** The last journey picked; null if none ever was. */
  readonly journey: Journey | null;
  readonly dock: DockState;
  /** The loss events already prompted or dismissed, so the loss prompt doesn't come back for them. */
  readonly lossEvents: readonly string[];
};

export const DEFAULT_GUIDE_PREFS: GuidePrefs = { seen: false, journey: null, dock: 'closed', lossEvents: [] };

const JOURNEYS: readonly Journey[] = ['fresh', 'loss', 'explore'];
const DOCK_STATES: readonly DockState[] = ['open', 'pill', 'closed'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Guide preferences as saved; each missing or broken field falls back to its default. */
export function parseGuidePrefs(raw: unknown): GuidePrefs {
  if (!isObject(raw)) return DEFAULT_GUIDE_PREFS;
  const d = DEFAULT_GUIDE_PREFS;
  return {
    seen: typeof raw.seen === 'boolean' ? raw.seen : d.seen,
    journey: JOURNEYS.includes(raw.journey as Journey) ? (raw.journey as Journey) : d.journey,
    dock: DOCK_STATES.includes(raw.dock as DockState) ? (raw.dock as DockState) : d.dock,
    lossEvents: (Array.isArray(raw.lossEvents) ? raw.lossEvents : []).filter(
      (e, i, all): e is string => typeof e === 'string' && all.indexOf(e) === i,
    ),
  };
}

/** The welcome box shows by itself only to a new visitor: never seen, and nothing saved from an earlier visit. */
export const welcomeShows = (prefs: GuidePrefs, savedRun: boolean): boolean => !prefs.seen && !savedRun;

/** Whether an earlier visit saved a roster or plan preferences. */
export const hasSavedRun = (): boolean => hasSavedRoster() || hasSavedPlanPrefs();

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
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable: the guide still works for this session.
  }
}
