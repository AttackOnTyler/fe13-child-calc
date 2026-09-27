import { describe, expect, it } from 'vitest';
import { CHILD_UNITS } from '../game-data/children';
import { CHILD_JOIN_DATA } from '../game-data/join';
import { createEngine, resolveAssumptions } from './index';

const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });

// SF forums topic 33434 (Remnant Sage): Chrom and Sumia right after Chapter 13, and the Lucina who joined.
const chrom = { stats: stats(52, 27, 7, 27, 31, 27, 23, 14), class: 'great-lord', gender: 'M' } as const;
const sumia = { stats: stats(46, 24, 16, 37, 37, 30, 10, 25), class: 'dark-flier', gender: 'F' } as const;

describe('a child’s join data (#155)', () => {
  it('has every child’s absolute bases, at level 10', () => {
    expect(Object.keys(CHILD_JOIN_DATA).sort()).toEqual(Object.keys(CHILD_UNITS).sort());
    for (const d of Object.values(CHILD_JOIN_DATA)) expect(d.level).toBe(10);
    expect(CHILD_JOIN_DATA.lucina.absoluteBases).toEqual(stats(12, 5, 1, 8, 4, 13, 3, 3));
    expect(CHILD_JOIN_DATA.cynthia.absoluteBases).toEqual(stats(7, 5, 2, 4, 10, 17, 6, 6));
    expect(CHILD_JOIN_DATA['morgan-f'].absoluteBases).toEqual(CHILD_JOIN_DATA['morgan-m'].absoluteBases);
  });
});

describe('a child’s join stats (#155)', () => {
  const engine = createEngine();

  it('gives the in-game Lucina from SF forums 33434: 38/18/7/25/25/23/13/11', () => {
    const r = engine.childJoinStats({ child: 'lucina', parents: [chrom, sumia] });
    expect(r).toMatchObject({ class: 'lord', level: 10, stats: stats(38, 18, 7, 25, 25, 23, 13, 11) });
    expect(r.assumptionsUsed).toEqual([]);
  });

  it('floors: rounding to nearest would give HP 39, Str 19 and Spd 26', () => {
    const r = engine.childJoinStats({ child: 'lucina', parents: [sumia, chrom] });
    expect([r.stats.hp, r.stats.str, r.stats.spd]).toEqual([38, 18, 25]);
  });

  it('reads each parent’s current class base: reclassing is neutral', () => {
    // Chrom as a Lord (M) with every stat lower by Great Lord − Lord gives the same Lucina.
    const lord = { stats: stats(47, 23, 7, 25, 29, 27, 20, 11), class: 'lord', gender: 'M' } as const;
    expect(engine.childJoinStats({ child: 'lucina', parents: [lord, sumia] }).stats).toEqual(stats(38, 18, 7, 25, 25, 23, 13, 11));
  });

  it('counts the Maiden’s side as 0, on an assumption', () => {
    const r = engine.childJoinStats({ child: 'lucina', parents: [chrom, 'maiden'] });
    // floor(((52 − 23) + 0 + 12) / 3) + 16 = 29.
    expect(r.stats.hp).toBe(29);
    expect(r.assumptionsUsed).toContain('maiden-join-stats');
  });

  it('starts Morgan in the class it is given, and needs one', () => {
    const robin = { stats: stats(40, 15, 20, 20, 20, 15, 12, 12), class: 'tactician', gender: 'M' } as const;
    const r = engine.childJoinStats({ child: 'morgan-f', parents: [robin, sumia], startClass: 'pegasus-knight' });
    expect(r.class).toBe('pegasus-knight');
    // Spd: floor(((20 − 5) + (37 − 10) + 6) / 3) + 8 = 24.
    expect(r.stats.spd).toBe(24);
    expect(() => engine.childJoinStats({ child: 'morgan-f', parents: [robin, sumia] })).toThrow();
  });

  it('floors a negative sum by default; truncation toward zero is the alternative', () => {
    // Parents below their class base in HP: (16 − 23) + (17 − 19) + 7 = −2, so floor −1, toward zero 0.
    const low = [
      { stats: stats(16, 10, 0, 7, 9, 0, 10, 3), class: 'great-lord', gender: 'M' },
      { stats: stats(17, 5, 6, 8, 10, 0, 5, 9), class: 'dark-flier', gender: 'F' },
    ] as const;
    const floored = engine.childJoinStats({ child: 'cynthia', parents: low });
    expect(floored.stats.hp).toBe(16 - 1);
    expect(floored.assumptionsUsed).toContain('child-join-rounding');
    const truncated = createEngine(resolveAssumptions({ 'child-join-rounding': 'toward-zero' })).childJoinStats({ child: 'cynthia', parents: low });
    expect(truncated.stats.hp).toBe(16);
  });

  it('leaves stats past the start class’s caps by default; clamping is the alternative', () => {
    const huge = { stats: stats(80, 43, 30, 46, 46, 45, 43, 40), class: 'great-lord', gender: 'M' } as const;
    const r = engine.childJoinStats({ child: 'lucina', parents: [huge, huge] });
    const caps = engine.classMaxStats('lord', 'F');
    expect(r.stats.spd).toBeGreaterThan(caps.spd);
    expect(r.assumptionsUsed).toContain('child-join-cap');
    const clamped = createEngine(resolveAssumptions({ 'child-join-cap': 'start-class-caps' })).childJoinStats({ child: 'lucina', parents: [huge, huge] });
    expect(clamped.stats.spd).toBe(caps.spd);
    // With the child's modifiers, the cap is the class max plus the modifier.
    const withMods = createEngine(resolveAssumptions({ 'child-join-cap': 'start-class-caps' })).childJoinStats({
      child: 'lucina',
      parents: [huge, huge],
      modifiers: { str: 0, mag: 0, skl: 0, spd: 2, lck: 0, def: 0, res: 0 },
    });
    expect(withMods.stats.spd).toBe(caps.spd + 2);
  });
});
