import { describe, expect, it } from 'vitest';
import { createEngine, resolveAssumptions } from '../engine';
import { DEFAULT_PREFS, basisOf, dlcReachable, roleOf, speedSettings, targetOf, withPreset, type ScoringPrefs } from './scoring-prefs';

const engine = createEngine();
const prefs = (over: Partial<ScoringPrefs>): ScoringPrefs => ({ ...DEFAULT_PREFS, ...over });

describe('target breakpoint', () => {
  it('follows the play context until the user sets one', () => {
    expect(targetOf(prefs({ context: 'all' }), engine)).toBe(66);
    expect(targetOf(prefs({ context: 'main-story' }), engine)).toBe(60);
    expect(targetOf(prefs({ context: 'apotheosis' }), engine)).toBe(66);
  });

  it('keeps a user-set target (or none) whatever the context', () => {
    for (const context of ['all', 'main-story', 'apotheosis', 'full-route'] as const) {
      expect(targetOf(prefs({ context, target: 69 }), engine)).toBe(69);
      expect(targetOf(prefs({ context, target: null }), engine)).toBeNull();
    }
  });

  it('reads the Main story default from the assumptions', () => {
    const e = createEngine(resolveAssumptions({ 'main-story-target-breakpoint': 55 }));
    expect(targetOf(prefs({ context: 'main-story' }), e)).toBe(55);
  });
});

describe('speed settings', () => {
  it('defaults to Rally +8, Tonic on, Pair-up +8, margin +2', () => {
    expect(speedSettings(DEFAULT_PREFS, engine)).toEqual({ rally: 8, tonic: true, pairUp: 8, target: 66, margin: 2 });
  });
});

describe('DLC reachability', () => {
  it('comes from the toggle or a context that reaches DLC', () => {
    expect(dlcReachable(prefs({ context: 'all' }), engine)).toBe(false);
    expect(dlcReachable(prefs({ context: 'main-story' }), engine)).toBe(false);
    expect(dlcReachable(prefs({ context: 'apotheosis' }), engine)).toBe(true);
    expect(dlcReachable(prefs({ context: 'full-route' }), engine)).toBe(true);
    expect(dlcReachable(prefs({ context: 'all', dlc: true }), engine)).toBe(true);
  });
});

describe('scoring role', () => {
  const preset = (id: string) => engine.presets().find((p) => p.id === id)!;

  it('follows the preset: Battery scores in Support, the rest in Lead', () => {
    expect(roleOf(withPreset(DEFAULT_PREFS, 'battery'), preset('battery'))).toBe('support');
    expect(roleOf(withPreset(DEFAULT_PREFS, 'physical-lead'), preset('physical-lead'))).toBe('lead');
  });

  it('can be overridden globally, and choosing a preset goes back to the preset’s role', () => {
    const battery = withPreset(DEFAULT_PREFS, 'battery');
    expect(roleOf({ ...battery, role: 'lead' }, preset('battery'))).toBe('lead');
    expect(roleOf(prefs({ role: 'support' }), preset('physical-lead'))).toBe('support');
    const back = withPreset({ ...battery, role: 'lead' }, 'battery');
    expect(roleOf(back, preset('battery'))).toBe('support');
  });

  it('defaults the support rank to A/S', () => {
    expect(DEFAULT_PREFS.supportRank).toBe('A');
  });
});

describe('score basis by role', () => {
  it('keeps Growths in Lead and falls back to Caps+LB in Support without losing the choice', () => {
    const growths = prefs({ basis: 'growths' });
    expect(basisOf(growths, 'lead', engine)).toBe('growths');
    expect(basisOf(growths, 'support', engine)).toBe('caps-lb');
    expect(basisOf(prefs({ basis: 'caps' }), 'support', engine)).toBe('caps');
  });
});
