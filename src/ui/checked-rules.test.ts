import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ROSTER, EMPTY_RUN, addEntry, resolveAssumptions, runFromRoster, withRun } from '../engine';
import {
  EMPTY_CHECKED_RULES,
  loadCheckedRules,
  overridesOf,
  parseCheckedRules,
  ruleEvidence,
  saveCheckedRules,
  withOverrides,
  type CheckedRules,
} from './checked-rules';
import { clearRoster, saveRoster } from './roster-store';

/**
 * Checked rules are global (#205): hand answers, checked rules and model mismatches outlive the run and Clear all, keep
 * their evidence (run and map), and migrate `assumption-overrides:v1`.
 */
const OLD = 'fe13-child-calc:assumption-overrides:v1';
const KEY = 'fe13-child-calc:checked-rules:v1';

const rules: CheckedRules = {
  answers: {
    'tome-miss-use': { value: 'no-use', how: 'hand', evidence: { run: 'Normal Classic, Main story', map: 'chapter-3' }, at: 5 },
    'army-spread': { value: [1, 2, 3], how: 'check', evidence: { run: 'Normal Classic, Main story', map: 'chapter-4' } },
  },
  mismatches: [{ rule: 'support-past-threshold', evidence: [{ run: 'Normal Classic, Main story', map: 'chapter-5' }], at: 7 }],
};

describe('checked rules (#205)', () => {
  it('read back as saved; junk is dropped', () => {
    expect(parseCheckedRules(JSON.parse(JSON.stringify(rules)))).toEqual(rules);
    expect(parseCheckedRules('junk')).toEqual(EMPTY_CHECKED_RULES);
    expect(parseCheckedRules({ answers: { a: { how: 'hand' }, b: { value: 1, how: 'guess' }, c: { value: 1, how: 'hand', evidence: 'x' } }, mismatches: [{ evidence: [] }] })).toEqual({
      answers: { c: { value: 1, how: 'hand' } },
      mismatches: [],
    });
  });

  it('keep the unexpected observations and each mismatch’s value (#209)', () => {
    const seen: CheckedRules = {
      ...rules,
      mismatches: [{ ...rules.mismatches[0]!, value: 22 }],
      unexpected: [{ rule: 'tome-miss-use', value: 2, evidence: { map: 'chapter-6' }, at: 3 }, { rule: 'booster-at-cap', value: true }],
    };
    expect(parseCheckedRules(JSON.parse(JSON.stringify(seen)))).toEqual(seen);
    expect(parseCheckedRules({ answers: {}, mismatches: [], unexpected: [{ rule: 'x' }, { value: 1 }, 'junk'] })).toEqual({ answers: {}, mismatches: [] });
  });

  it('give the model its overrides, and keep an unchanged answer’s evidence when the overrides change', () => {
    expect(overridesOf(rules)).toEqual({ 'tome-miss-use': 'no-use', 'army-spread': [1, 2, 3] });
    const evidence = { run: 'Hard Casual, Full route', map: 'chapter-9' };
    const next = withOverrides(rules, { 'army-spread': [1, 2, 3], 'paralogue-renown': 100 }, evidence, 9);
    expect(next.answers).toEqual({ 'army-spread': rules.answers['army-spread'], 'paralogue-renown': { value: 100, how: 'hand', evidence, at: 9 } });
    expect(next.mismatches).toEqual(rules.mismatches);
  });

  it('take their evidence from the run: its Run facts and latest recorded map', () => {
    const run = addEntry(runFromRoster(withRun(EMPTY_ROSTER, { difficulty: 'lunatic-plus', mode: 'classic', route: 'full-route' })), 'prologue', 1);
    expect(ruleEvidence(run)).toEqual({ run: 'Lunatic+ Classic, Full route', map: 'prologue' });
    expect(ruleEvidence(EMPTY_RUN)).toBeUndefined();
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

    it('migrate assumption-overrides:v1 once, as hand answers', () => {
      const old = { 'tome-miss-use': 'no-use', 'paralogue-renown': 100 };
      store.set(OLD, JSON.stringify(old));
      const loaded = loadCheckedRules();
      expect(loaded).toEqual({ answers: { 'tome-miss-use': { value: 'no-use', how: 'hand' }, 'paralogue-renown': { value: 100, how: 'hand' } }, mismatches: [] });
      expect(resolveAssumptions(overridesOf(loaded))).toEqual(resolveAssumptions(old));
      expect(JSON.parse(store.get(KEY)!)).toEqual(loaded);
      // Once: a later answer isn't undone by the old overrides.
      saveCheckedRules(EMPTY_CHECKED_RULES);
      expect(loadCheckedRules()).toEqual(EMPTY_CHECKED_RULES);
      expect(store.get(OLD)).toBe(JSON.stringify(old));
    });

    it('survive Clear all', () => {
      saveCheckedRules(rules);
      saveRoster({ ...EMPTY_ROSTER, run: { ...EMPTY_ROSTER.run, gender: 'M' } });
      clearRoster();
      expect(loadCheckedRules()).toEqual(rules);
    });

    it('give none when storage is corrupt or blocked', () => {
      store.set(KEY, '{not json');
      expect(loadCheckedRules()).toEqual(EMPTY_CHECKED_RULES);
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      });
      expect(loadCheckedRules()).toEqual(EMPTY_CHECKED_RULES);
      expect(() => saveCheckedRules(rules)).not.toThrow();
    });
  });
});
