/** Awakening's hit roll: two random numbers averaged (true hit), research #281. */
import { describe, expect, it } from 'vitest';
import { trueHit } from './exchange';

describe('true hit (#281)', () => {
  it('matches a brute force over every pair of random numbers', () => {
    for (const h of [0, 1, 10, 30, 49, 50, 51, 70, 90, 99, 100]) {
      let n = 0;
      for (let a = 0; a < 100; a++) for (let b = 0; b < 100; b++) if ((a + b) / 2 < h) n++;
      expect(trueHit(h)).toBeCloseTo(n / 10000, 10);
    }
  });

  it('reads the research’s examples: 70 → 82.3%, 90 → 98.1%, 30 → 18.3%, 50 → 50.5%', () => {
    expect(trueHit(70)).toBeCloseTo(0.823, 3);
    expect(trueHit(90)).toBeCloseTo(0.981, 3);
    expect(trueHit(30)).toBeCloseTo(0.183, 3);
    expect(trueHit(50)).toBeCloseTo(0.505, 3);
  });
});
