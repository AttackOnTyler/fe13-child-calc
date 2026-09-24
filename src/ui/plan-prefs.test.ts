import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ROSTER, createEngine, quotasFor } from '../engine';
import {
  DEFAULT_PLAN_PREFS,
  editQuota,
  loadPlanPrefs,
  parsePlanPrefs,
  resetPlanPrefs,
  savePlanPrefs,
  userOverrides,
  withPlanPreset,
  withPriority,
  withQuotas,
  withSuggestedPresets,
} from './plan-prefs';
import { clearRoster, loadRoster, saveRoster } from './roster-store';

const engine = createEngine();

describe('plan preferences', () => {
  it('sets and resets a child’s plan preset', () => {
    const set = withPlanPreset(DEFAULT_PLAN_PREFS, 'kjelle', 'lancekiller');
    expect(set.overrides).toEqual({ kjelle: 'lancekiller' });
    expect(withPlanPreset(set, 'kjelle', null).overrides).toEqual({});
    expect(withPriority(set, 'kjelle', 3)).toEqual({
      priorities: { kjelle: 3 },
      overrides: { kjelle: 'lancekiller' },
      suggested: [],
      quotas: {},
      acts: { prioritiesSetAt: expect.any(Number) },
    });
  });

  it('writes Suggest roles picks as suggested overrides, replacing earlier ones and leaving the user’s alone', () => {
    const user = withPlanPreset(DEFAULT_PLAN_PREFS, 'kjelle', 'lancekiller');
    const first = withSuggestedPresets(user, { lucina: 'battery', owain: 'rallybot' });
    expect(first.overrides).toEqual({ kjelle: 'lancekiller', lucina: 'battery', owain: 'rallybot' });
    expect(first.suggested).toEqual(['lucina', 'owain']);
    expect(userOverrides(first)).toEqual({ kjelle: 'lancekiller' });
    // A new run drops the earlier picks it doesn't repeat.
    const second = withSuggestedPresets(first, { owain: 'battery' });
    expect(second.overrides).toEqual({ kjelle: 'lancekiller', owain: 'battery' });
    expect(second.suggested).toEqual(['owain']);
    // ↺ resets a pick; picking a preset by hand makes it the user's.
    expect(withPlanPreset(second, 'owain', null)).toMatchObject({ overrides: { kjelle: 'lancekiller' }, suggested: [] });
    const mine = withPlanPreset(second, 'owain', 'tank');
    expect(mine.suggested).toEqual([]);
    expect(userOverrides(mine)).toEqual({ kjelle: 'lancekiller', owain: 'tank' });
  });

  it('edits a play context’s quotas, keeping min ≤ max, and resets them', () => {
    const apo = quotasFor('apotheosis');
    expect(editQuota(apo, 'cap', 18).cap).toBe(18);
    expect(editQuota(apo, 'cap', -3).cap).toBe(0);
    expect(editQuota(apo, 'lead', 5, 'min').roles.lead).toEqual({ min: 5, max: 6 });
    // Raising min past max drags max along, and lowering max below min drags min.
    expect(editQuota(apo, 'lead', 8, 'min').roles.lead).toEqual({ min: 8, max: 8 });
    expect(editQuota(apo, 'staff', 1, 'max').roles.staff).toEqual({ min: 1, max: 1 });
    const edited = withQuotas(DEFAULT_PLAN_PREFS, 'apotheosis', editQuota(apo, 'cap', 18));
    expect(edited.quotas.apotheosis?.cap).toBe(18);
    expect(edited.quotas['main-story']).toBeUndefined();
    expect(withQuotas(edited, 'apotheosis', null).quotas).toEqual({});
  });

  it('drops unknown children, presets and priorities when read back', () => {
    expect(
      parsePlanPrefs({ priorities: { lucina: 2, nobody: 1, owain: 7 }, overrides: { kjelle: 'rallybot', lucina: 'nope', nobody: 'tank' } }, engine),
    ).toEqual({ priorities: { lucina: 2 }, overrides: { kjelle: 'rallybot' }, suggested: [], quotas: {}, acts: {} });
    // Saved before overrides, quotas and act flags existed.
    expect(parsePlanPrefs({ priorities: { lucina: 2 } }, engine)).toEqual({ priorities: { lucina: 2 }, overrides: {}, suggested: [], quotas: {}, acts: {} });
    expect(parsePlanPrefs({ acts: { suggestedAt: 5, prioritiesSetAt: -1, deployEditedAt: 'x', nope: 3 } }, engine).acts).toEqual({ suggestedAt: 5 });
    expect(parsePlanPrefs({ acts: [1] }, engine).acts).toEqual({});
    const good = { ...quotasFor('apotheosis'), cap: 18 };
    const bad = { ...quotasFor('apotheosis'), roles: { ...quotasFor('apotheosis').roles, lead: { min: 7, max: 2 } } };
    expect(parsePlanPrefs({ quotas: { apotheosis: good, 'main-story': bad, nowhere: good, all: 'x' } }, engine).quotas).toEqual({ apotheosis: good });
    expect(parsePlanPrefs('junk', engine)).toEqual(DEFAULT_PLAN_PREFS);
    // A suggested marker needs an override to mark.
    expect(parsePlanPrefs({ overrides: { lucina: 'battery' }, suggested: ['lucina', 'owain', 'nobody', 3] }, engine).suggested).toEqual(['lucina']);
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
      const quotas = { ...quotasFor('main-story'), cap: 12 };
      const prefs = withSuggestedPresets(
        withQuotas(withPriority(withPlanPreset(DEFAULT_PLAN_PREFS, 'kjelle', 'lancekiller'), 'lucina', 3), 'main-story', quotas),
        { owain: 'battery' },
      );
      expect(prefs.acts).toEqual({ prioritiesSetAt: expect.any(Number), suggestedAt: expect.any(Number) });
      savePlanPrefs(prefs);
      saveRoster({ ...EMPTY_ROSTER, run: { gender: 'M', asset: null, flaw: null } });
      clearRoster();
      expect(loadRoster()).toEqual(EMPTY_ROSTER);
      expect(loadPlanPrefs(engine)).toEqual(prefs);
      savePlanPrefs(resetPlanPrefs(prefs));
      // Reset keeps the act flags: they record what the user did, for the guide.
      expect(loadPlanPrefs(engine)).toEqual({ ...DEFAULT_PLAN_PREFS, acts: prefs.acts });
    });
  });
});
