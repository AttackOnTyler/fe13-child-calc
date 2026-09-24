import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEED, STATS, createEngine, type ClassId, type PresetId, type ScoreSettings, type Stat } from './index';

const engine = createEngine();
const preset = (id: PresetId) => engine.presets().find((p) => p.id === id)!;

/**
 * Settings for a curated preset: Caps + LB, Auto class, no DLC, and no Speed buffs with no target (Spd linear at
 * its to-target weight on the cap) unless overridden. The Spd curve has its own tests.
 */
const settings = (id: PresetId, over: Partial<ScoreSettings> = {}): ScoreSettings => ({
  weights: preset(id).weights,
  mixed: preset(id).mixed,
  basis: 'caps-lb',
  classMode: 'auto',
  dlc: false,
  speed: { ...DEFAULT_SPEED, rally: 0, tonic: false, pairUp: 0, target: null },
  role: preset(id).role ?? 'lead',
  supportRank: 'A',
  ...over,
});

const FINAL_TIERS = new Set(['advanced', 'special']);
const classInfo = (id: ClassId) => engine.classes().find((c) => c.id === id)!;

describe('presets', () => {
  it('lists the 13 curated presets plus Rallybot / Dancer, which has no weights', () => {
    const presets = engine.presets();
    expect(presets).toHaveLength(14);
    expect(presets.filter((p) => p.weights).map((p) => p.name)).toHaveLength(13);
    expect(preset('rallybot')).toMatchObject({ name: 'Rallybot / Dancer', weights: null, role: null });
  });

  it('carries each preset’s scoring role and Mixed flag', () => {
    expect(preset('battery')).toMatchObject({ role: 'support', mixed: true });
    expect(preset('physical-lead')).toMatchObject({ role: 'lead', mixed: false });
    expect(engine.presets().filter((p) => p.mixed).map((p) => p.id)).toEqual(['mixed-lead', 'battery', 'crisis-crit']);
  });

  it('seeds Physical lead from the spec table', () => {
    expect(preset('physical-lead').weights).toEqual({ hp: 1, str: 6, mag: 0, skl: 2, spd: 16, spdBeyond: 1, lck: 0, def: 1, res: 1 });
  });
});

describe('scoring', () => {
  it('min-max scales raw values over every pairing to integers 0–100', () => {
    const scoring = engine.score(settings('physical-lead'));
    const scores = engine.pairings().map((r) => scoring.get(r.key).score!);
    expect(scores.every((s) => Number.isInteger(s) && s >= 0 && s <= 100)).toBe(true);
    expect(Math.min(...scores)).toBe(0);
    expect(Math.max(...scores)).toBe(100);
  });

  it('scores the weighted sum of effective caps in the row’s class', () => {
    const r = engine.result('lucina|sumia')!;
    const s = engine.score(settings('physical-lead', { classMode: 'sniper' })).get(r.key);
    const caps = engine.effectiveCaps(r, 'sniper', true)!;
    const w = preset('physical-lead').weights!;
    expect(s.values).toEqual(caps);
    expect(s.raw).toBe(STATS.reduce((sum, st) => sum + w[st] * caps[st], 0));
  });

  it('leaves scores unchanged by filtering', () => {
    const scoring = engine.score(settings('magical-lead'));
    const before = new Map(engine.pairings().map((r) => [r.key, scoring.get(r.key).score]));
    const filters = [{ parent: 'sum' }, { secondGen: false }, { parent: 'robin', secondGen: false }];
    for (const filter of filters) {
      for (const child of engine.children()) {
        const shown = engine.groups(child.id, filter).flatMap((g) => g.results);
        for (const r of shown) expect(scoring.get(r.key).score).toBe(before.get(r.key));
      }
    }
    // Re-scoring after browsing filtered groups gives the same numbers.
    const again = engine.score(settings('magical-lead'));
    expect(engine.pairings().every((r) => again.get(r.key).score === before.get(r.key))).toBe(true);
  });

  it('filters groups by parent name and hides second-gen partners', () => {
    expect(engine.groups('lucina', { parent: 'SU' }).map((g) => g.label)).toEqual(['Sully', 'Sumia']);
    const morgan = engine.groups('morgan-f', { secondGen: false }).map((g) => g.label);
    expect(morgan.some((l) => l.includes('←'))).toBe(false);
    expect(morgan).toContain('Tharja');
    expect(engine.groups('morgan-f', { parent: 'lucina ← su' }).map((g) => g.label)).toEqual(['Lucina ← Sully', 'Lucina ← Sumia']);
  });
});

describe('Auto class', () => {
  it('picks the highest-scoring final-tier class per row, never Villager, ties by data order', () => {
    const s = settings('physical-lead');
    const scoring = engine.score(s);
    const classOrder = engine.classes().map((c) => c.id);
    for (const key of ['lucina|sumia', 'inigo|donnel', 'morgan-f|robin:mag/str|tharja', 'nah|donnel']) {
      const r = engine.result(key)!;
      const picked = scoring.get(key);
      expect(picked.auto).toBe(true);
      const candidates = engine
        .reachableClasses(r)
        .filter((c) => FINAL_TIERS.has(classInfo(c).tier) && c !== 'villager' && !classInfo(c).dlc);
      const raws = candidates.map((c) => engine.score({ ...s, classMode: c }).get(key).raw!);
      const best = Math.max(...raws);
      expect(picked.class, key).toBe(candidates[raws.indexOf(best)]);
      expect(picked.raw).toBe(best);
      expect(classOrder.indexOf(picked.class!)).toBeGreaterThanOrEqual(0);
    }
  });

  it('never picks a base class or Villager', () => {
    for (const id of ['physical-lead', 'staffbot', 'tank'] as const) {
      const scoring = engine.score(settings(id));
      for (const r of engine.pairings()) {
        const c = scoring.get(r.key).class!;
        expect(c).not.toBe('villager');
        expect(classInfo(c).tier).not.toBe('base');
      }
    }
  });

  it('considers DLC classes only when DLC is reachable', () => {
    const presetIds = engine.presets().filter((p) => p.weights).map((p) => p.id);
    const dlcPicks = (dlc: boolean) =>
      presetIds.flatMap((id) => {
        const scoring = engine.score(settings(id, { dlc }));
        return engine.pairings().filter((r) => classInfo(scoring.get(r.key).class!).dlc);
      }).length;
    expect(dlcPicks(false)).toBe(0);
    expect(dlcPicks(true)).toBeGreaterThan(0);
  });

  it('with a pinned class, scores reachable rows in it and greys out the rest', () => {
    const scoring = engine.score(settings('physical-lead', { classMode: 'general' }));
    const sumia = scoring.get('lucina|sumia');
    expect(sumia).toMatchObject({ class: 'general', auto: false });
    expect(sumia.score).toBeTypeOf('number');
    const unreachable = scoring.get('lucina|maribelle'); // Maribelle passes no Knight
    expect(unreachable.class).toBeUndefined();
    expect(unreachable.score).toBeUndefined();
    expect(unreachable.raw).toBeUndefined();
  });

  it('lets a pinned class be any class, DLC included, whatever the DLC toggle', () => {
    const scoring = engine.score(settings('physical-lead', { classMode: 'dread-fighter' }));
    expect(scoring.get('inigo|donnel').class).toBe('dread-fighter');
    expect(scoring.get('inigo|donnel').score).toBeTypeOf('number');
    // A pinned base class works too.
    expect(engine.score(settings('physical-lead', { classMode: 'cavalier' })).get('lucina|sumia').class).toBe('cavalier');
  });
});

describe('Mixed', () => {
  it('scores max(Str, Mag) under the attack weight and tags it S or M', () => {
    const s = settings('mixed-lead', { classMode: 'sage' });
    const scoring = engine.score(s);
    const w = preset('mixed-lead').weights!;
    const r = engine.result('lucina|sumia')!;
    const caps = engine.effectiveCaps(r, 'sage', true)!;
    const plain = (['hp', 'skl', 'spd', 'lck', 'def', 'res'] as Stat[]).reduce((sum, st) => sum + w[st] * caps[st], 0);
    expect(scoring.get(r.key).raw).toBe(plain + Math.max(w.str, w.mag) * Math.max(caps.str, caps.mag));
    expect(scoring.get(r.key).attack).toBe('M'); // Sage: Mag 46 over Str 30
    expect(engine.score({ ...s, classMode: 'berserker' }).get('inigo|donnel').attack).toBe('S');
  });

  it('tags nothing without the flag', () => {
    const scoring = engine.score(settings('physical-lead'));
    expect(engine.pairings().some((r) => scoring.get(r.key).attack)).toBe(false);
  });

  it('ignores the off-stat, scoring less than the same weights counting both', () => {
    const mixed = engine.score(settings('mixed-lead', { classMode: 'sage' })).get('lucina|sumia').raw!;
    const both = engine.score(settings('mixed-lead', { classMode: 'sage', mixed: false })).get('lucina|sumia').raw!;
    expect(mixed).toBeLessThan(both);
  });
});

describe('score basis', () => {
  it('Caps drops Limit Breaker’s +10', () => {
    const r = engine.result('lucina|sumia')!;
    const s = engine.score(settings('physical-lead', { basis: 'caps', classMode: 'sniper' })).get(r.key);
    expect(s.values).toEqual(engine.effectiveCaps(r, 'sniper', false));
  });

  it('Growths scores the inherited growth plus the class growth', () => {
    const r = engine.result('lucina|sumia')!;
    const s = engine.score(settings('physical-lead', { basis: 'growths', classMode: 'sniper' })).get(r.key);
    const cls = engine.classGrowths('sniper', 'F');
    for (const st of STATS) expect(s.values![st]).toBe(r.growths[st] + cls[st]);
  });

  it('changes both the scores and the Auto class', () => {
    const byBasis = (basis: ScoreSettings['basis']) => {
      const scoring = engine.score(settings('magical-lead', { basis }));
      return engine.pairings().map((r) => scoring.get(r.key));
    };
    const lb = byBasis('caps-lb');
    const growths = byBasis('growths');
    expect(lb.some((s, i) => s.score !== growths[i]!.score)).toBe(true);
    expect(lb.some((s, i) => s.class !== growths[i]!.class)).toBe(true);
  });
});

describe('no preset (Rallybot / Dancer)', () => {
  it('gives no score and shows the start class, or the pinned one', () => {
    const scoring = engine.score(settings('rallybot'));
    expect(scoring.get('lucina|sumia')).toMatchObject({ class: 'lord', auto: false, score: undefined, raw: undefined });
    expect(engine.score(settings('rallybot', { classMode: 'sniper' })).get('lucina|sumia').class).toBe('sniper');
  });
});

describe('best per child', () => {
  it('is the highest score among the child’s pairings', () => {
    const scoring = engine.score(settings('physical-lead'));
    const best = scoring.best('lucina')!;
    const all = engine.pairings('lucina').map((r) => scoring.get(r.key).score ?? -1);
    expect(best.score).toBe(Math.max(...all));
  });
});

describe('performance', () => {
  // About 100 ms locally; the budget is 200 ms because CI runners vary (they have taken 109–133 ms).
  it('rescores every pairing within 200 ms', () => {
    engine.score(settings('mixed-lead')); // warm-up
    const runs = [1, 2, 3].map(() => {
      const t0 = performance.now();
      engine.score(settings('mixed-lead', { dlc: true }));
      return performance.now() - t0;
    });
    expect(Math.min(...runs)).toBeLessThan(200);
  });
});

describe('groups and weighted stats', () => {
  it('shows a Robin group through its highest-scoring asset/flaw, with the group’s score range', () => {
    const scoring = engine.score(settings('physical-lead'));
    const robin = engine.groups('lucina').find((g) => g.results.length > 1)!;
    const { best, range } = scoring.groupBest(robin);
    const scores = robin.results.map((r) => scoring.get(r.key).score!);
    expect(scoring.get(best.key).score).toBe(Math.max(...scores));
    expect(range).toEqual({ lo: Math.min(...scores), hi: Math.max(...scores) });
  });

  it('keeps the first pairing and no range when nothing in the group has a score', () => {
    const scoring = engine.score(settings('rallybot'));
    const robin = engine.groups('lucina').find((g) => g.results.length > 1)!;
    expect(scoring.groupBest(robin)).toEqual({ best: robin.results[0], range: undefined });
  });

  it('lists the stats that carry weight, with Str and Mag both under Mixed', () => {
    expect(engine.score(settings('physical-lead')).weightedStats).toEqual(['hp', 'str', 'skl', 'spd', 'def', 'res']);
    expect(engine.score(settings('crisis-crit')).weightedStats).toEqual(['hp', 'str', 'mag', 'skl', 'spd']);
    expect(engine.score(settings('staffbot', { mixed: true })).weightedStats).toEqual(['str', 'mag']);
    expect(engine.score(settings('rallybot')).weightedStats).toEqual([]);
  });
});
