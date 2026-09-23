import { describe, expect, it } from 'vitest';
import { createEngine, DEFAULT_ASSUMPTIONS } from './index';
import { INHERITANCE_FIXTURES } from './fixtures';

const engine = createEngine();

describe('pairing enumeration (non-Robin)', () => {
  it('lists Lucina’s mothers: Chrom’s S-support partners plus the Maiden', () => {
    const mothers = engine.pairings('lucina').map((r) => engine.parentName(r.pairing.variableParent));
    expect(mothers.sort()).toEqual(['Maiden', 'Maribelle', 'Olivia', 'Sully', 'Sumia']);
  });

  it('respects Sumia’s restricted list for Cynthia', () => {
    const fathers = engine.pairings('cynthia').map((r) => engine.parentName(r.pairing.variableParent));
    expect(fathers.sort()).toEqual(['Chrom', 'Frederick', 'Gaius', 'Henry']);
  });

  it('lets Chrom father Brady, Kjelle and Inigo but not Owain', () => {
    const hasChrom = (child: Parameters<typeof engine.pairings>[0]) =>
      engine.pairings(child).some((r) => r.pairing.variableParent.id === 'chrom');
    expect(hasChrom('brady')).toBe(true);
    expect(hasChrom('kjelle')).toBe(true);
    expect(hasChrom('inigo')).toBe(true);
    expect(hasChrom('owain')).toBe(false);
  });

  it('gives a general mother the twelve general fathers', () => {
    expect(engine.pairings('severa')).toHaveLength(12);
    expect(engine.pairings('owain')).toHaveLength(12);
  });

  it('never involves Robin-only units and has no Morgan pairings yet', () => {
    const robinOnly = ['sayri', 'flavia', 'anna', 'tiki', 'emmeryn', 'aversa', 'basilio', 'gangrel', 'walhart', 'yenfay', 'priam'];
    for (const r of engine.pairings()) {
      expect(robinOnly).not.toContain(r.pairing.variableParent.id);
    }
    expect(engine.pairings('morgan-m')).toHaveLength(0);
    expect(engine.pairings('morgan-f')).toHaveLength(0);
  });

  it('enumerates 132 pairings with unique keys', () => {
    // Lucina 5 + (Sully, Maribelle, Olivia) 13 each + Sumia 4 + seven general mothers × 12.
    const all = engine.pairings();
    expect(all).toHaveLength(5 + 3 * 13 + 4 + 7 * 12);
    expect(new Set(all.map((r) => r.key)).size).toBe(all.length);
  });

  it('keeps keys stable across engine instances and resolves them', () => {
    const again = createEngine();
    expect(again.pairings().map((r) => r.key)).toEqual(engine.pairings().map((r) => r.key));
    expect(engine.result('lucina|sumia')?.pairing).toEqual({ child: 'lucina', variableParent: { kind: 'unit', id: 'sumia' } });
    expect(engine.result('nope|nobody')).toBeUndefined();
  });

  it('lists every child for the rail, with Morgan’s pairing count at zero', () => {
    const rail = engine.children();
    expect(rail).toHaveLength(14);
    expect(rail.find((c) => c.id === 'lucina')).toMatchObject({ name: 'Lucina', fixedParentName: 'Chrom', pairingCount: 5 });
    expect(rail.find((c) => c.id === 'morgan-f')?.pairingCount).toBe(0);
  });
});

describe('inheritance fixtures (published values)', () => {
  it.each(INHERITANCE_FIXTURES)('$id $label', (fx) => {
    const r = engine.result(fx.key);
    expect(r).toBeDefined();
    const totals = Object.fromEntries(
      Object.entries(r!.growths).map(([s, g]) => [s, g + fx.classGrowths[s as keyof typeof fx.classGrowths]]),
    );
    expect(totals).toEqual(fx.expectedGrowths);
    expect(r!.modifiers).toEqual(fx.expectedModifiers);
  });

  it('guards against the SF Maribelle!Lucina Lck typo (+3); the right value is +5', () => {
    expect(engine.result('lucina|maribelle')?.modifiers.lck).toBe(5);
  });
});

describe('assumptions', () => {
  it('flags the Maiden pairing as resting on unknown growths, and nothing else', () => {
    const flagged = engine.pairings().filter((r) => r.assumptionsUsed.length > 0);
    expect(flagged.map((r) => r.key)).toEqual(['lucina|maiden']);
    expect(flagged[0]!.assumptionsUsed).toEqual(['maiden-growths']);
  });

  it('takes the Maiden’s growths from the assumptions passed in, changing only her pairing', () => {
    const maidenGrowths = { hp: 30, str: 30, mag: 30, skl: 30, spd: 30, lck: 30, def: 30, res: 30 };
    const other = createEngine({ ...DEFAULT_ASSUMPTIONS, maidenGrowths });
    // Lucina 45 + Chrom 40 + Maiden 30 = 115 → 38 Spd.
    expect(other.result('lucina|maiden')?.growths.spd).toBe(38);
    const changed = other.pairings().filter((r) => r.growths.spd !== engine.result(r.key)?.growths.spd);
    expect(changed.map((r) => r.key)).toEqual(['lucina|maiden']);
  });

  it('keeps the Maiden’s published modifiers: Lucina+Maiden = Chrom + 1', () => {
    expect(engine.result('lucina|maiden')?.modifiers).toEqual({ str: 2, mag: 1, skl: 2, spd: 2, lck: 2, def: 0, res: 0 });
  });
});

describe('self-test', () => {
  it('runs every fixture and passes', () => {
    const report = engine.selfTest();
    expect(report.cases.map((c) => c.id)).toEqual(INHERITANCE_FIXTURES.map((f) => f.id));
    expect(report.passed).toBe(true);
    expect(report.cases.every((c) => c.passed && c.mismatches.length === 0)).toBe(true);
  });
});
