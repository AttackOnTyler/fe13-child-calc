import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ROSTER } from '../engine';
import {
  DEFAULT_GUIDE_PREFS,
  closeWelcome,
  collapseDock,
  dismissLoss,
  hasSavedRun,
  loadGuidePrefs,
  parseGuidePrefs,
  pickJourney,
  reopenGuide,
  saveGuidePrefs,
  takeLoss,
  welcomeShows,
  type GuidePrefs,
} from './guide-prefs';
import { DEFAULT_PLAN_PREFS, savePlanPrefs } from './plan-prefs';
import { clearRoster, saveRoster } from './roster-store';

const used: GuidePrefs = { seen: true, journey: 'loss', dock: 'pill', lossEvents: ['dead:frederick', 'married:lonqu+cordelia'] };

describe('guide preferences', () => {
  it('read back as saved', () => {
    expect(parseGuidePrefs(JSON.parse(JSON.stringify(used)))).toEqual(used);
  });

  it('fall back to the defaults, field by field, when missing or corrupt', () => {
    expect(DEFAULT_GUIDE_PREFS).toEqual({ seen: false, journey: null, dock: 'closed', lossEvents: [] });
    expect(parseGuidePrefs(null)).toEqual(DEFAULT_GUIDE_PREFS);
    expect(parseGuidePrefs('junk')).toEqual(DEFAULT_GUIDE_PREFS);
    expect(parseGuidePrefs({ seen: 'yes', journey: 'tour', dock: 'floating', lossEvents: 'dead:frederick' })).toEqual(DEFAULT_GUIDE_PREFS);
    expect(parseGuidePrefs({ seen: true, journey: 'explore' })).toEqual({ ...DEFAULT_GUIDE_PREFS, seen: true, journey: 'explore' });
    // Loss events keep only strings, once each.
    expect(parseGuidePrefs({ lossEvents: ['dead:frederick', 3, 'dead:frederick', null] }).lossEvents).toEqual(['dead:frederick']);
  });

  it('show the welcome box by itself only before it was seen and with no saved run', () => {
    expect(welcomeShows(DEFAULT_GUIDE_PREFS, false)).toBe(true);
    expect(welcomeShows(DEFAULT_GUIDE_PREFS, true)).toBe(false);
    expect(welcomeShows({ ...DEFAULT_GUIDE_PREFS, seen: true }, false)).toBe(false);
  });

  describe('in storage', () => {
    beforeEach(() => {
      const store = new Map<string, string>();
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('read back as saved, and survive Clear all', () => {
      expect(loadGuidePrefs()).toEqual(DEFAULT_GUIDE_PREFS);
      saveGuidePrefs(used);
      saveRoster({ ...EMPTY_ROSTER, run: { ...EMPTY_ROSTER.run, gender: 'M' } });
      clearRoster();
      expect(loadGuidePrefs()).toEqual(used);
    });

    it('count a saved roster or plan preferences as a saved run', () => {
      expect(hasSavedRun()).toBe(false);
      saveGuidePrefs(used);
      expect(hasSavedRun()).toBe(false);
      savePlanPrefs(DEFAULT_PLAN_PREFS);
      expect(hasSavedRun()).toBe(true);
    });

    it('count a saved roster as a saved run', () => {
      saveRoster(EMPTY_ROSTER);
      expect(hasSavedRun()).toBe(true);
    });

    it('give the defaults when storage is corrupt or blocked', () => {
      localStorage.setItem('fe13-child-calc:guide:v1', '{not json');
      expect(loadGuidePrefs()).toEqual(DEFAULT_GUIDE_PREFS);
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      });
      expect(loadGuidePrefs()).toEqual(DEFAULT_GUIDE_PREFS);
      expect(() => saveGuidePrefs(used)).not.toThrow();
      expect(hasSavedRun()).toBe(false);
    });
  });
});

describe('guide choices', () => {
  it('picking a journey marks the welcome box seen and opens the dock on it', () => {
    expect(pickJourney(DEFAULT_GUIDE_PREFS, 'fresh')).toEqual({ ...DEFAULT_GUIDE_PREFS, seen: true, journey: 'fresh', dock: 'open' });
    expect(pickJourney(used, 'fresh').lossEvents).toEqual(used.lossEvents);
  });

  it('closing the welcome box marks it seen and picks nothing', () => {
    expect(closeWelcome(DEFAULT_GUIDE_PREFS)).toEqual({ ...DEFAULT_GUIDE_PREFS, seen: true });
  });

  it('? Guide reopens the dock on the last journey, or the welcome box if none was ever picked', () => {
    expect(reopenGuide(DEFAULT_GUIDE_PREFS)).toBe('welcome');
    expect(reopenGuide({ ...used, dock: 'closed' })).toEqual({ ...used, dock: 'open' });
  });

  it('taking the loss prompt switches the dock to After a loss and notes its events; dismissing only notes them', () => {
    const onFresh: GuidePrefs = { ...used, journey: 'fresh', dock: 'pill' };
    expect(takeLoss(onFresh, ['dead:gregor'])).toEqual({ ...onFresh, journey: 'loss', dock: 'open', lossEvents: [...used.lossEvents, 'dead:gregor'] });
    expect(dismissLoss(onFresh, ['dead:gregor', 'dead:frederick'])).toEqual({ ...onFresh, lossEvents: [...used.lossEvents, 'dead:gregor'] });
  });

  it('on a phone an open dock collapses to its pill; a pill or a closed dock stays as it is', () => {
    expect(collapseDock({ ...used, dock: 'open' })).toEqual({ ...used, dock: 'pill' });
    const pill: GuidePrefs = { ...used, dock: 'pill' };
    expect(collapseDock(pill)).toBe(pill);
    const closed: GuidePrefs = { ...used, dock: 'closed' };
    expect(collapseDock(closed)).toBe(closed);
  });
});
