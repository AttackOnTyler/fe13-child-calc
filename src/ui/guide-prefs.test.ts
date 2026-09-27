import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ROSTER } from '../engine';
import { DEFAULT_GUIDE_PREFS, closeWelcome, hasSavedRun, loadGuidePrefs, parseGuidePrefs, saveGuidePrefs, welcomeShows, type GuidePrefs } from './guide-prefs';
import { clearRoster, saveRoster } from './roster-store';

const seen: GuidePrefs = { seen: true };
/** What `guide:v1` held before #213: the journey, the dock and the loss prompt's events. */
const old = { seen: true, journey: 'loss', dock: 'pill', lossEvents: ['dead:frederick'] };

describe('guide preferences', () => {
  it('keep only seen (#213)', () => {
    expect(DEFAULT_GUIDE_PREFS).toEqual({ seen: false });
    expect(parseGuidePrefs(JSON.parse(JSON.stringify(seen)))).toEqual(seen);
  });

  it('read an old save as its seen alone, ignoring the retired journey, dock and loss events', () => {
    expect(parseGuidePrefs(old)).toEqual({ seen: true });
    expect(parseGuidePrefs({ journey: 'fresh', dock: 'open' })).toEqual({ seen: false });
  });

  it('fall back to unseen when missing or corrupt', () => {
    expect(parseGuidePrefs(null)).toEqual(DEFAULT_GUIDE_PREFS);
    expect(parseGuidePrefs('junk')).toEqual(DEFAULT_GUIDE_PREFS);
    expect(parseGuidePrefs([true])).toEqual(DEFAULT_GUIDE_PREFS);
    expect(parseGuidePrefs({ seen: 'yes' })).toEqual(DEFAULT_GUIDE_PREFS);
  });

  it('show the welcome box by itself only before it was seen and with no saved run', () => {
    expect(welcomeShows(DEFAULT_GUIDE_PREFS, false)).toBe(true);
    expect(welcomeShows(DEFAULT_GUIDE_PREFS, true)).toBe(false);
    expect(welcomeShows(seen, false)).toBe(false);
  });

  it('mark the welcome box seen on any answer', () => {
    expect(closeWelcome(DEFAULT_GUIDE_PREFS)).toEqual(seen);
    expect(closeWelcome(seen)).toBe(seen);
  });

  describe('in storage', () => {
    let store: Map<string, string>;
    beforeEach(() => {
      store = new Map<string, string>();
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('read back as saved, and survive Clear all', () => {
      expect(loadGuidePrefs()).toEqual(DEFAULT_GUIDE_PREFS);
      saveGuidePrefs(seen);
      saveRoster({ ...EMPTY_ROSTER, run: { ...EMPTY_ROSTER.run, gender: 'M' } });
      clearRoster();
      expect(loadGuidePrefs()).toEqual(seen);
    });

    it('migrate an old save: its seen is kept, and the next save drops the retired fields', () => {
      localStorage.setItem('fe13-child-calc:guide:v1', JSON.stringify(old));
      const loaded = loadGuidePrefs();
      expect(loaded).toEqual({ seen: true });
      saveGuidePrefs(loaded);
      expect(JSON.parse(store.get('fe13-child-calc:guide:v1')!)).toEqual({ seen: true });
    });

    it('save only seen, even when handed more', () => {
      saveGuidePrefs({ ...seen, dock: 'open' } as GuidePrefs);
      expect(JSON.parse(store.get('fe13-child-calc:guide:v1')!)).toEqual({ seen: true });
    });

    it('count nothing but a saved run as a saved run', () => {
      expect(hasSavedRun()).toBe(false);
      saveGuidePrefs(seen);
      expect(hasSavedRun()).toBe(false);
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
      expect(() => saveGuidePrefs(seen)).not.toThrow();
      expect(hasSavedRun()).toBe(false);
    });
  });
});
