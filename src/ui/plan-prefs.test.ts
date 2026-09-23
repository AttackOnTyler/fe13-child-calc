import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ROSTER, createEngine } from '../engine';
import { DEFAULT_PLAN_PREFS, loadPlanPrefs, parsePlanPrefs, savePlanPrefs, withPlanPreset, withPriority } from './plan-prefs';
import { clearRoster, loadRoster, saveRoster } from './roster-store';

const engine = createEngine();

describe('plan preferences', () => {
  it('sets and resets a child’s plan preset', () => {
    const set = withPlanPreset(DEFAULT_PLAN_PREFS, 'kjelle', 'lancekiller');
    expect(set.overrides).toEqual({ kjelle: 'lancekiller' });
    expect(withPlanPreset(set, 'kjelle', null).overrides).toEqual({});
    expect(withPriority(set, 'kjelle', 3)).toEqual({ priorities: { kjelle: 3 }, overrides: { kjelle: 'lancekiller' } });
  });

  it('drops unknown children, presets and priorities when read back', () => {
    expect(
      parsePlanPrefs({ priorities: { lucina: 2, nobody: 1, owain: 7 }, overrides: { kjelle: 'rallybot', lucina: 'nope', nobody: 'tank' } }, engine),
    ).toEqual({ priorities: { lucina: 2 }, overrides: { kjelle: 'rallybot' } });
    // Saved before overrides existed.
    expect(parsePlanPrefs({ priorities: { lucina: 2 } }, engine)).toEqual({ priorities: { lucina: 2 }, overrides: {} });
    expect(parsePlanPrefs('junk', engine)).toEqual(DEFAULT_PLAN_PREFS);
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

    it('survive Clear all, and Reset plan preferences clears them', () => {
      const prefs = withPriority(withPlanPreset(DEFAULT_PLAN_PREFS, 'kjelle', 'lancekiller'), 'lucina', 3);
      savePlanPrefs(prefs);
      saveRoster({ ...EMPTY_ROSTER, run: { gender: 'M', asset: null, flaw: null } });
      clearRoster();
      expect(loadRoster()).toEqual(EMPTY_ROSTER);
      expect(loadPlanPrefs(engine)).toEqual(prefs);
      savePlanPrefs(DEFAULT_PLAN_PREFS);
      expect(loadPlanPrefs(engine)).toEqual(DEFAULT_PLAN_PREFS);
    });
  });
});
