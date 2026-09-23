import { MOD_STATS, STATS, STAT_LABELS } from '../game-data/stats';
import type { InheritanceFixture } from './fixtures';
import type { ChildResult, SelfTestCase, SelfTestReport } from './types';

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function checkFixture(fx: InheritanceFixture, r: ChildResult | undefined): SelfTestCase {
  if (!r) return { id: fx.id, label: fx.label, passed: false, mismatches: [`pairing ${fx.key} not enumerated`] };
  const mismatches: string[] = [];
  for (const s of STATS) {
    const got = r.growths[s] + fx.classGrowths[s];
    if (got !== fx.expectedGrowths[s]) mismatches.push(`${STAT_LABELS[s]} growth: expected ${fx.expectedGrowths[s]}, got ${got}`);
  }
  for (const s of MOD_STATS) {
    const got = r.modifiers[s];
    if (got !== fx.expectedModifiers[s]) {
      mismatches.push(`${STAT_LABELS[s]} modifier: expected ${signed(fx.expectedModifiers[s])}, got ${signed(got)}`);
    }
  }
  return { id: fx.id, label: fx.label, passed: mismatches.length === 0, mismatches };
}

export function runSelfTest(
  fixtures: readonly InheritanceFixture[],
  lookup: (key: string) => ChildResult | undefined,
): SelfTestReport {
  const cases = fixtures.map((fx) => checkFixture(fx, lookup(fx.key)));
  return { passed: cases.every((c) => c.passed), cases };
}
