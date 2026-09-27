import { describe, expect, it } from 'vitest';
import { chanceText } from './chance';

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
