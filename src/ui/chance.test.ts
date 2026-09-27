import { describe, expect, it } from 'vitest';
import { chanceText, chanceWithMargin, differenceText, killText, marginText, pointsText, riskText, signedPoints, stressText } from './chance';

describe('chance wording (#181; spec #175’s Why panel wording)', () => {
  it('reads a chance in percent, one decimal', () => {
    expect(chanceText(0.42)).toBe('42.0%');
    expect(chanceText(0.5)).toBe('50.0%');
  });

  it('adds how often a unit is lost at 90% or more', () => {
    expect(chanceText(0.996)).toBe('99.6% (loses a unit about 1 run in 250)');
    expect(chanceText(0.9)).toBe('90.0% (loses a unit about 1 run in 10)');
    expect(chanceText(0.8999)).toBe('90.0%');
  });

  it('adds how often a run is flawless at 10% or less', () => {
    expect(chanceText(0.004)).toBe('0.4% (flawless about 1 run in 250)');
    expect(chanceText(0.1)).toBe('10.0% (flawless about 1 run in 10)');
  });

  it('caps at over 99.9% and under 0.1%, and keeps a certain 100% or 0%', () => {
    expect(chanceText(0.9995)).toBe('over 99.9%');
    expect(chanceText(0.0004)).toBe('under 0.1%');
    expect(chanceText(1)).toBe('100%');
    expect(chanceText(0)).toBe('0%');
  });

  it('groups large run counts', () => {
    expect(chanceText(0.998)).toBe('99.8% (loses a unit about 1 run in 500)');
    expect(chanceText(0.0012)).toBe('0.1% (flawless about 1 run in 833)');
    expect(chanceText(0.99895)).toBe('99.9% (loses a unit about 1 run in 952)');
  });
});

describe('difference wording (#199)', () => {
  it('reads a close call as the spec words it', () => {
    expect(differenceText(-0.002, 0.003, true)).toBe('no measurable difference (−0.2 ±0.3)');
    expect(differenceText(0, 0, true)).toBe('no measurable difference (0.0 ±0.0)');
  });

  it('reads a gain in signed points with its paired ±', () => {
    expect(differenceText(0.012, 0.004)).toBe('+1.2 ±0.4');
    expect(differenceText(-0.05, 0.01)).toBe('−5.0 ±1.0');
  });
});

describe('a fight’s kill chance (#210)', () => {
  it('always adds how often it kills someone', () => {
    expect(killText(0.121)).toBe('12.1% (kills someone about 1 run in 8)');
    expect(killText(0.5)).toBe('50.0% (kills someone about 1 run in 2)');
    expect(killText(0.0028)).toBe('0.3% (kills someone about 1 run in 357)');
  });

  it('caps like any chance', () => {
    expect(killText(0.0004)).toBe('under 0.1%');
    expect(killText(0.9995)).toBe('over 99.9%');
    expect(killText(1)).toBe('100%');
    expect(killText(0)).toBe('0%');
  });
});

describe('a stress-test range (#211)', () => {
  it('reads how low the chance could go under a blind spot’s bad case, as the spec words it', () => {
    expect(stressText(0.42, 0.318, 'two attackers reach each exposed pair')).toBe('as low as 31.8% if two attackers reach each exposed pair');
    // No lower than the headline (the plan does as well or better under it): no range.
    expect(stressText(0.42, 0.43, 'Rally reaches no pair')).toBeUndefined();
    expect(stressText(0.42, 0.4199, 'Rally reaches no pair')).toBeUndefined();
  });
});

describe('points of chance', () => {
  it('reads a worth, a difference and a ± the same way everywhere', () => {
    expect(pointsText(0.015)).toBe('1.5');
    expect(signedPoints(0.012)).toBe('+1.2');
    expect(signedPoints(-0.034)).toBe('−3.4');
    expect(signedPoints(0.0002)).toBe('0.0');
    expect(marginText(0.008)).toBe('±0.8');
    expect(marginText(Number.NaN)).toBe('±?');
    expect(chanceWithMargin({ chance: 0.42, margin: 0.05 })).toBe('42.0% ±5.0');
  });

  it('reads a threat as plain percent, floored at under 0.1%', () => {
    expect(riskText(0.004)).toBe('0.4%');
    expect(riskText(0.0004)).toBe('under 0.1%');
    expect(riskText(0)).toBe('0%');
  });
});
