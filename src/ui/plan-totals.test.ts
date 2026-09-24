import { describe, expect, it } from 'vitest';
import { shownDelta, shownTotal } from './plan-totals';

describe('plan totals as shown', () => {
  it('rounds a total the way the header shows it', () => {
    expect(shownTotal(837.4)).toBe(837);
    expect(shownTotal(824.5)).toBe(825);
  });

  it('takes a delta between the rounded totals, not the raw ones', () => {
    expect(shownDelta(837.4, 824.5)).toBe(-12);
    expect(shownDelta(837.4, 836.8)).toBe(0);
    expect(shownDelta(836.6, 837.4)).toBe(0);
    expect(shownDelta(824.5, 837.4)).toBe(12);
  });

  it.each([
    [0.5, 1.49],
    [100.49, 100.5],
    [812.25, 812.75],
    [1000.1, 999.9],
  ])('always equals the shown after minus the shown before (%d → %d)', (before, after) => {
    expect(shownDelta(before, after)).toBe(shownTotal(after) - shownTotal(before));
  });
});
