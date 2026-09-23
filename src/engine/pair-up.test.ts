import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEED, createEngine, type PresetId, type ScoreSettings, type Weights } from './index';

const engine = createEngine();
const preset = (id: PresetId) => engine.presets().find((p) => p.id === id)!;
const ZERO: Weights = { hp: 0, str: 0, mag: 0, skl: 0, spd: 0, spdBeyond: 0, lck: 0, def: 0, res: 0 };

/** Support role on Caps, rank A, pinned class unless overridden. */
const settings = (over: Partial<ScoreSettings> = {}): ScoreSettings => ({
  weights: preset('battery').weights,
  mixed: true,
  basis: 'caps',
  classMode: 'auto',
  dlc: false,
  speed: DEFAULT_SPEED,
  role: 'support',
  supportRank: 'A',
  ...over,
});

describe('pair-up bonus (Support role)', () => {
  it('Sumia!Lucina as Sniper at A: every Caps value is 30+ (+3), plus Sniper’s Str 3 / Skl 3 / Def 2, each +2 for rank', () => {
    // Caps: Str 41, Mag 31, Skl 52, Spd 45, Lck 47, Def 38, Res 32 (Sniper max + F1 modifiers).
    const s = engine.score(settings({ classMode: 'sniper' })).get('lucina|sumia');
    expect(s.values).toEqual({ hp: 0, str: 3 + 3 + 2, mag: 3, skl: 3 + 3 + 2, spd: 3, lck: 3, def: 3 + 2 + 2, res: 3 });
  });

  it('Sumia!Lucina as Falcon Knight at C: Spd and Res get the class bonus + 1', () => {
    const s = engine.score(settings({ classMode: 'falcon-knight', supportRank: 'C' })).get('lucina|sumia');
    expect(s.values).toEqual({ hp: 0, str: 3, mag: 3, skl: 3, spd: 3 + 4 + 1, lck: 3, def: 3, res: 3 + 4 + 1 });
  });

  it('Maribelle!Lucina as Cavalier on Caps: 20s give +2, and the rank bonus follows the rank', () => {
    // Caps: Str 25, Mag 23, Skl 28, Spd 27, Lck 35, Def 23, Res 28 (Cavalier max + F2 modifiers).
    const at = (supportRank: ScoreSettings['supportRank']) =>
      engine.score(settings({ classMode: 'cavalier', supportRank })).get('lucina|maribelle').values;
    expect(at('none')).toEqual({ hp: 0, str: 2 + 2, mag: 2, skl: 2 + 1, spd: 2 + 1, lck: 3, def: 2 + 2, res: 2 });
    expect(at('B')).toEqual({ hp: 0, str: 2 + 2 + 1, mag: 2, skl: 2 + 1 + 1, spd: 2 + 1 + 1, lck: 3, def: 2 + 2 + 1, res: 2 });
    expect(at('S')).toEqual(at('A'));
    expect(at('C')).toEqual(at('B'));
  });

  it('reads the tier from Caps + LB on that basis', () => {
    // Every Caps + LB value is 30+.
    const s = engine.score(settings({ classMode: 'cavalier', basis: 'caps-lb', supportRank: 'none' })).get('lucina|maribelle');
    expect(s.values).toEqual({ hp: 0, str: 3 + 2, mag: 3, skl: 3 + 1, spd: 3 + 1, lck: 3, def: 3 + 2, res: 3 });
  });

  it('scores each bonus point linearly, Spd at the to-target weight, Mixed on max(Str, Mag)', () => {
    // Battery: Str/Mag/Skl 4, Spd→T 12, Def/Res 2. Bonus as Sniper at A: Str 8, Mag 3, Skl 8, Spd 3, Def 7, Res 3.
    const s = engine.score(settings({ classMode: 'sniper' })).get('lucina|sumia');
    expect(s.raw).toBe(4 * 8 + 4 * 8 + 12 * 3 + 2 * 7 + 2 * 3);
    expect(s.attack).toBe('S');
  });

  it('ignores Spd beyond, the target breakpoint and the Speed buffs', () => {
    const raw = (over: Partial<ScoreSettings>) => engine.score(settings({ classMode: 'sniper', ...over })).get('lucina|sumia').raw;
    const base = raw({});
    expect(raw({ weights: { ...preset('battery').weights!, spdBeyond: 10 } })).toBe(base);
    expect(raw({ speed: { ...DEFAULT_SPEED, target: 55, margin: 0, rally: 0, pairUp: 0 } })).toBe(base);
  });

  it('shows no Speed total: the Speed cell reads the Spd pair-up bonus from the values', () => {
    const s = engine.score(settings({ classMode: 'sniper' })).get('lucina|sumia');
    expect(s.speed).toBeUndefined();
    expect(s.values?.spd).toBe(3);
  });

  it('picks the Auto class by pair-up bonus and scales it 0–100', () => {
    const scoring = engine.score(settings({ weights: { ...ZERO, spd: 1 } }));
    const scores = engine.pairings().map((r) => scoring.get(r.key).score!);
    expect(Math.min(...scores)).toBe(0);
    expect(Math.max(...scores)).toBe(100);
    // Only Spd weighs: Sumia!Lucina's biggest final-tier Spd bonus is Great Lord / Falcon Knight's +4, +3 tier, +2 rank.
    const s = scoring.get('lucina|sumia');
    expect(s).toMatchObject({ auto: true, raw: 4 + 3 + 2 });
    expect(['great-lord', 'falcon-knight']).toContain(s.class);
  });

  it('lists weighted stats without HP, which gives no pair-up bonus', () => {
    expect(engine.score(settings({ weights: { ...ZERO, hp: 5, def: 1 }, mixed: false })).weightedStats).toEqual(['def']);
  });
});

describe('Pair-up Spd helper', () => {
  it('is raw-Spd tier + class Spd bonus + rank bonus on the class bonus', () => {
    expect(engine.pairUpSpd('swordmaster', 'S', 30)).toBe(10);
    expect(engine.pairUpSpd('sniper', 'A', 30)).toBe(3); // no class Spd bonus, so no rank bonus
    expect(engine.pairUpSpd('falcon-knight', 'B', 25)).toBe(4 + 1 + 2);
    expect(engine.pairUpSpd('hero', 'A', 9)).toBe(3 + 2);
    expect(engine.pairUpSpd('hero', 'none', 30)).toBe(3 + 3);
  });
});

describe('Growths basis in the Support role', () => {
  it('is not offered in the Support role', () => {
    expect(engine.scoreBases('lead')).toEqual(['caps-lb', 'caps', 'growths']);
    expect(engine.scoreBases('support')).toEqual(['caps-lb', 'caps']);
  });

  it('can’t be scored', () => {
    expect(() => engine.score(settings({ basis: 'growths' }))).toThrow(/Growths/);
  });
});

describe('Lead role', () => {
  it('still scores effective caps with the Speed total', () => {
    const s = engine.score(settings({ role: 'lead', classMode: 'sniper' })).get('lucina|sumia');
    expect(s.values).toEqual(engine.effectiveCaps(engine.result('lucina|sumia')!, 'sniper', false));
    expect(s.speed?.total).toBe(63);
  });
});
