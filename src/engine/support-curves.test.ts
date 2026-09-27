import { describe, expect, it } from 'vitest';
import { ROBIN_SUPPORTS, S_SUPPORTS } from '../game-data/supports';
import type { UnitId } from '../game-data/units';
import { createEngine } from './index';

const engine = createEngine();

describe('support curves per pair (#177)', () => {
  it('gives a slow pair 4/8/13/18 and 8 maps to S', () => {
    // research/support-growth §5: Lon'qu × Cordelia, 3 points a map, one rank a map at most.
    expect(engine.supportCurve('lonqu', 'cordelia')).toEqual({
      curve: 'slow',
      thresholds: { C: 4, B: 8, A: 13, S: 18 },
      mapsTo: { C: 2, B: 4, A: 6, S: 8 },
      mapsToS: 8,
    });
  });

  it('gives a fast pair 2/6/10/14 and 7 maps to S, either way round', () => {
    const fast = engine.supportCurve('miriel', 'stahl');
    expect(fast).toEqual({
      curve: 'fast',
      thresholds: { C: 2, B: 6, A: 10, S: 14 },
      mapsTo: { C: 1, B: 3, A: 5, S: 7 },
      mapsToS: 7,
    });
    expect(engine.supportCurve('stahl', 'miriel')).toEqual(fast);
  });

  it('gives a medium pair 3/7/11/16 and 7 maps to S', () => {
    expect(engine.supportCurve('sully', 'chrom')).toMatchObject({ curve: 'medium', thresholds: { C: 3, B: 7, A: 11, S: 16 }, mapsToS: 7 });
  });

  it('gives a non-romantic pair 3/8/15, A at most and no S', () => {
    expect(engine.supportCurve('chrom', 'frederick')).toEqual({
      curve: 'non-romantic',
      thresholds: { C: 3, B: 8, A: 15 },
      mapsTo: { C: 1, B: 3, A: 6 },
      mapsToS: undefined,
    });
  });

  it('knows child romances and Robin by gender: slow with the other gender, non-romantic with the same', () => {
    expect(engine.supportCurve('owain', 'kjelle')?.curve).toBe('fast');
    expect(engine.supportCurve('owain', 'lucina')?.curve).toBe('slow');
    expect(engine.supportCurve('robin-m', 'tharja')?.curve).toBe('slow');
    expect(engine.supportCurve('robin-f', 'tharja')?.curve).toBe('non-romantic');
    expect(engine.supportCurve('robin-f', 'chrom')?.curve).toBe('slow');
  });

  it('has no curve for a pair that can’t support', () => {
    expect(engine.supportCurve('chrom', 'olivia')?.curve).toBe('slow');
    expect(engine.supportCurve('lonqu', 'sumia')).toBeUndefined();
    expect(engine.supportCurve('walhart', 'chrom')).toBeUndefined();
  });

  it('covers every pair in the game data: 194 slow, 11 medium, 17 fast, 94 non-romantic', () => {
    // research/support-growth §2.1, §8: Fire Editor units.xml, with Robin (M) and Robin (F) counted apart.
    const pairs = engine.supportPairs();
    const count = (curve: string) => pairs.filter((p) => p.curve === curve).length;
    expect([count('slow'), count('medium'), count('fast'), count('non-romantic')]).toEqual([194, 11, 17, 94]);
    const keys = pairs.map((p) => [p.a, p.b].sort().join('+'));
    expect(new Set(keys).size).toBe(316);
    for (const p of pairs) expect(engine.supportCurve(p.a, p.b)?.curve).toBe(p.curve);
  });

  it('gives every S-support partner in the marriage data, Robin’s included, a romantic curve', () => {
    for (const [woman, men] of Object.entries(S_SUPPORTS) as [UnitId, readonly UnitId[]][])
      for (const man of men) expect(engine.supportCurve(woman, man)?.curve, `${woman} × ${man}`).toMatch(/slow|medium|fast/);
    for (const p of ROBIN_SUPPORTS.M) expect(engine.supportCurve('robin-m', p)?.curve, p).toBe('slow');
    for (const p of ROBIN_SUPPORTS.F) expect(engine.supportCurve('robin-f', p)?.curve, p).toBe('slow');
  });

  it('gives each first-gen woman her fast and medium husbands from the research', () => {
    // research/support-growth §2.2.
    const table = {
      lissa: ['vaike', ['frederick']], sully: ['kellam', ['chrom', 'stahl']], miriel: ['stahl', ['kellam']], sumia: ['chrom', []],
      maribelle: ['frederick', ['chrom']], panne: ['ricken', ['libra']], cordelia: ['libra', ['gaius']], nowi: ['gregor', ['vaike']],
      tharja: ['gaius', ['henry']], olivia: ['henry', ['gregor']], cherche: ['virion', ['ricken']],
    } as const;
    for (const [woman, [fast, medium]] of Object.entries(table) as [UnitId, readonly [UnitId, readonly UnitId[]]][]) {
      const men = S_SUPPORTS[woman]!;
      expect(men.filter((m) => engine.supportCurve(woman, m)?.curve === 'fast'), woman).toEqual([fast]);
      expect(men.filter((m) => engine.supportCurve(woman, m)?.curve === 'medium'), woman).toEqual(expect.arrayContaining([...medium]));
      expect(men.filter((m) => engine.supportCurve(woman, m)?.curve === 'medium').length, woman).toBe(medium.length);
    }
  });
});
