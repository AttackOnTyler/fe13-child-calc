import { MOD_STATS, STATS, STAT_LABELS } from '../game-data/stats';
import type { ClassSetFixture } from './class-set-fixtures';
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

/** One case per child: each row's class set must match (order doesn't matter). */
function checkClassSets(fx: ClassSetFixture, lookup: (key: string) => ChildResult | undefined): SelfTestCase {
  const mismatches = fx.rows.flatMap(([key, expected]): string[] => {
    const r = lookup(key);
    if (!r) return [`pairing ${key} not enumerated`];
    const missing = expected.filter((c) => !r.classSet.includes(c));
    const extra = r.classSet.filter((c) => !expected.includes(c));
    if (missing.length === 0 && extra.length === 0) return [];
    return [`${key}: ${[missing.length ? `missing ${missing.join(', ')}` : '', extra.length ? `extra ${extra.join(', ')}` : ''].filter(Boolean).join('; ')}`];
  });
  return { id: fx.id, label: fx.label, passed: mismatches.length === 0, mismatches };
}

export function runSelfTest(
  fixtures: readonly InheritanceFixture[],
  classSets: readonly ClassSetFixture[],
  lookup: (key: string) => ChildResult | undefined,
): SelfTestReport {
  const cases = [...fixtures.map((fx) => checkFixture(fx, lookup(fx.key))), ...classSets.map((fx) => checkClassSets(fx, lookup))];
  return { passed: cases.every((c) => c.passed), cases };
}
