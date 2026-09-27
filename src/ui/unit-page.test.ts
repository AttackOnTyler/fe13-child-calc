import { describe, expect, it } from 'vitest';
import { UNIT_OPINIONS } from '../curated/unit-opinion';
import { opinionDisagrees, tierLean } from './unit-page';

describe('unit opinion beside the unit’s worth (#212; spec #175, user story 101)', () => {
  it('reads a source’s tier by its leading letter', () => {
    expect(tierLean('S (support lord)')).toBe('high');
    expect(tierLean('A / S father')).toBe('high');
    expect(tierLean('B / niche')).toBeUndefined();
    expect(tierLean('C combat / A father')).toBe('low');
    expect(tierLean('F without grinding')).toBe('low');
    expect(tierLean(undefined)).toBeUndefined();
  });

  it('strongly disagrees only when a high tier meets a worth under 1 point, or a low one a worth of 5 or more', () => {
    expect(opinionDisagrees('S', 0.4)).toBe(true);
    expect(opinionDisagrees('S', 3)).toBe(false);
    expect(opinionDisagrees('C', 6)).toBe(true);
    expect(opinionDisagrees('C', 2)).toBe(false);
    expect(opinionDisagrees('B / A pair-up', 0)).toBe(false);
    expect(opinionDisagrees(undefined, 0)).toBe(false);
  });

  it('can read every curated tier', () => {
    for (const o of UNIT_OPINIONS) if (o.tier && !o.tier.startsWith('B')) expect(tierLean(o.tier), `${o.unit}: ${o.tier}`).toBeDefined();
  });
});
