/** Holding back on the Lunatic Prologue (#248: attempt 1's T2, `docs/play-log/p02-prologue.md` P02-T2). */
import { describe, expect, it } from 'vitest';
import { withPieces, type Board } from './board';
import { holdBack } from './hold-back';
import { prologueBoard } from './prologue-fixture';

/** Attempt 1 at the start of T2: the pair at (2,12), Lissa (2,14), Robin (3,14); four foes within reach of the army. */
function t2(): Board {
  const b = prologueBoard({ frederick: [2, 12], lissa: [2, 14], robin: [3, 14] }, { frederick: 'chrom' });
  const moved: Record<string, [number, number, number]> = {
    '1,8': [2, 11, 6], // the Barbarian Frederick left at 6 HP
    '9,12': [4, 12, 26], // a Myrmidon
    '7,9': [5, 12, 30], // a Barbarian
    '10,6': [8, 9, 23], // the Elwind Mage
  };
  const enemies = b.enemies.flatMap((e) => {
    const k = `${e.at[0]},${e.at[1]}`;
    if (k === '4,10') return []; // died on EP1's counter
    const m = moved[k];
    return [m ? { ...e, at: [m[0], m[1]] as const, hp: m[2], awake: true } : e];
  });
  return withPieces(b, b.players, enemies);
}

describe('holding back (#248)', () => {
  it('on attempt 1’s T2, no formation keeps Chrom (separated), Robin and Lissa all out of reach', () => {
    const r = holdBack(t2(), ['chrom', 'robin', 'lissa']);
    expect(r.feasible).toBe(false);
    expect(r.threats.length).toBeGreaterThan(0);
    // Chrom alone can be held back only by Frederick carrying him away from the fight first (to be set down at the
    // map's west edge), which leaves the others to the Myrmidon and the Barbarians.
    const alone = holdBack(t2(), ['chrom']);
    expect(alone.feasible).toBe(true);
    expect(holdBack(t2(), ['robin', 'lissa']).feasible).toBe(false);
  });

  it('on turn 1, before the south closes in, Robin and Lissa can hold back', () => {
    const r = holdBack(prologueBoard({}, { frederick: 'chrom' }), ['robin', 'lissa']);
    expect(r.feasible).toBe(true);
    expect(Object.keys(r.tiles).sort()).toEqual(['lissa', 'robin']);
  });
});
