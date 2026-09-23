import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPEED,
  createEngine,
  resolveAssumptions,
  type PresetId,
  type ScoreSettings,
  type SpeedSettings,
  type Weights,
} from './index';

const engine = createEngine();
const preset = (id: PresetId) => engine.presets().find((p) => p.id === id)!;
const ZERO: Weights = { hp: 0, str: 0, mag: 0, skl: 0, spd: 0, spdBeyond: 0, lck: 0, def: 0, res: 0 };

const settings = (over: Partial<ScoreSettings> = {}, speed: Partial<SpeedSettings> = {}): ScoreSettings => ({
  weights: preset('physical-lead').weights,
  mixed: false,
  basis: 'caps-lb',
  classMode: 'auto',
  dlc: false,
  role: 'lead',
  supportRank: 'A',
  ...over,
  speed: { ...DEFAULT_SPEED, ...speed },
});

describe('Speed total', () => {
  it('Sumia!Lucina as Sniper: 45 + 8 Rally + 2 Tonic + 8 Pair-up = 63, clearing 60 by 3 (soly §3.11)', () => {
    const s = engine.score(settings({ basis: 'caps', classMode: 'sniper' })).get('lucina|sumia');
    expect(s.speed).toEqual({ total: 63, cleared: 60, over: 3 });
  });

  it('includes Limit Breaker unless the basis is Caps; Growths uses Caps + LB', () => {
    const at = (basis: ScoreSettings['basis']) =>
      engine.score(settings({ basis, classMode: 'sniper' })).get('lucina|sumia').speed?.total;
    expect(at('caps-lb')).toBe(73);
    expect(at('growths')).toBe(73);
    expect(at('caps')).toBe(63);
  });

  it('adds each buff: Rally, Tonic and Pair-up', () => {
    const total = (speed: Partial<SpeedSettings>) =>
      engine.score(settings({ basis: 'caps', classMode: 'sniper' }, speed)).get('lucina|sumia').speed!.total;
    expect(total({ rally: 0, tonic: false, pairUp: 0 })).toBe(45);
    expect(total({ rally: 10, tonic: false, pairUp: 0 })).toBe(55);
    expect(total({ rally: 0, tonic: true, pairUp: 0 })).toBe(47);
    expect(total({ rally: 0, tonic: false, pairUp: 3 })).toBe(48);
  });

  it('clears no breakpoint below the lowest, and reads the breakpoint list from the assumptions', () => {
    const low = engine.score(settings({ basis: 'caps', classMode: 'sniper' }, { rally: 0, tonic: false, pairUp: 0 })).get('lucina|sumia');
    expect(low.speed).toEqual({ total: 45, cleared: undefined, over: undefined });
    const custom = createEngine(resolveAssumptions({ 'spd-breakpoints': [40, 62] }));
    const s = custom.score(settings({ basis: 'caps', classMode: 'sniper' })).get('lucina|sumia');
    expect(s.speed).toEqual({ total: 63, cleared: 62, over: 1 });
  });

  it('has no Speed when the child can’t reach the pinned class', () => {
    expect(engine.score(settings({ classMode: 'general' })).get('lucina|maribelle').speed).toBeUndefined();
  });
});

describe('Spd curve (Lead)', () => {
  const onlySpd: Weights = { ...ZERO, spd: 16, spdBeyond: 1 };
  const raw = (over: Partial<ScoreSettings>, speed: Partial<SpeedSettings>) =>
    engine.score(settings({ weights: onlySpd, classMode: 'sniper', basis: 'caps', ...over }, speed)).get('lucina|sumia');

  it('scores points up to T + m at wT and points beyond at wB', () => {
    // S = 63, T + m = 62: 62 × 16 + 1 × 1.
    expect(raw({}, { target: 60, margin: 2 }).raw).toBe(62 * 16 + 1);
    // S = 63, T + m = 68: all to target.
    expect(raw({}, { target: 66, margin: 2 }).raw).toBe(63 * 16);
    // S = 63, T + m = 55: 55 × 16 + 8 × 1.
    expect(raw({}, { target: 55, margin: 0 }).raw).toBe(55 * 16 + 8);
  });

  it('“none” makes Spd linear at wT', () => {
    expect(raw({}, { target: null }).raw).toBe(63 * 16);
    expect(raw({}, { target: null, rally: 10 }).raw).toBe(65 * 16);
  });

  it('on Growths, the to-target term uses the cap-derived total and Spd growth is weighted at wB', () => {
    const r = engine.result('lucina|sumia')!;
    const growth = r.growths.spd + engine.classGrowths('sniper', 'F').spd;
    // Caps + LB total = 73; T + m = 68.
    expect(raw({ basis: 'growths' }, { target: 66, margin: 2 }).raw).toBe(68 * 16 + growth);
    expect(raw({ basis: 'growths' }, { target: null }).raw).toBe(73 * 16 + growth);
  });

  it('adds to the other stats’ weighted sum', () => {
    const w = preset('physical-lead').weights!;
    const r = engine.result('lucina|sumia')!;
    const caps = engine.effectiveCaps(r, 'sniper', true)!;
    const s = engine.score(settings({ classMode: 'sniper' }, { target: 66, margin: 2 })).get(r.key);
    const others = (['hp', 'str', 'mag', 'skl', 'lck', 'def', 'res'] as const).reduce((sum, st) => sum + w[st] * caps[st], 0);
    // S = 73 > 68.
    expect(s.raw).toBe(others + w.spd * 68 + w.spdBeyond * 5);
  });

  it('lets a lower target shift Auto picks away from Spd', () => {
    const picks = (target: number | null) => {
      const scoring = engine.score(settings({}, { target }));
      return engine.pairings().map((r) => scoring.get(r.key).class);
    };
    expect(picks(55)).not.toEqual(picks(null));
  });
});

describe('target breakpoint default', () => {
  it('is 66 for Apotheosis, Full route and All, and the ⚠ assumed 60 for Main story', () => {
    for (const ctx of ['apotheosis', 'full-route', 'all'] as const) {
      expect(engine.defaultTargetBreakpoint(ctx)).toEqual({ value: 66, assumption: undefined });
    }
    expect(engine.defaultTargetBreakpoint('main-story')).toEqual({ value: 60, assumption: 'main-story-target-breakpoint' });
  });

  it('follows an override of the Main story target', () => {
    const e = createEngine(resolveAssumptions({ 'main-story-target-breakpoint': 55 }));
    expect(e.defaultTargetBreakpoint('main-story').value).toBe(55);
  });
});

describe('DLC reachability by play context', () => {
  it('reaches DLC in Apotheosis and the Full route only', () => {
    expect(['apotheosis', 'main-story', 'full-route', 'all'].map((c) => engine.contextReachesDlc(c as never))).toEqual([true, false, true, false]);
  });
});

describe('breakpoint assumptions', () => {
  it('registers the breakpoint list and the Main story target', () => {
    const byId = new Map(engine.assumptions().map((a) => [a.id, a]));
    expect(byId.get('spd-breakpoints')).toMatchObject({ current: '55/60/66/69/75', isDefault: true });
    expect(byId.get('main-story-target-breakpoint')).toMatchObject({ current: '60', isDefault: true });
    // Neither feeds a pairing's result, so the panel names what they feed instead of a pairing count.
    expect(byId.get('spd-breakpoints')?.affects).toBeTruthy();
    expect(byId.get('main-story-target-breakpoint')?.affects).toBeTruthy();
    expect(engine.breakpoints()).toEqual([55, 60, 66, 69, 75]);
  });

  it('rejects a breakpoint list that isn’t ascending positive integers', () => {
    for (const bad of [[], [60, 55], [60, 60], [0], ['60'], [60.5]]) {
      expect(resolveAssumptions({ 'spd-breakpoints': bad })['spd-breakpoints']).toEqual([55, 60, 66, 69, 75]);
    }
  });
});

