import { describe, expect, it } from 'vitest';
import { buildSortKey, createEngine, describeSource, type BuildMatch, type ChildResult } from './index';

const engine = createEngine();

const get = (key: string): ChildResult => {
  const r = engine.result(key);
  if (!r) throw new Error(`No pairing ${key}`);
  return r;
};
const ALL = { context: 'all', dlc: false } as const;

/** Each slot as `Skill — source` or `✕ reason`. */
const lines = (m: BuildMatch) => m.slots.map((s) => (s.skill ? `${s.skill.name} — ${describeSource(s.source!)}` : `✕ ${s.reason}`));

// Lucina: Lord / Cavalier / Archer plus Sumia's Pegasus Knight, Knight, Priest; Aether always from Chrom (#3, #4).
describe('matching a build template', () => {
  it('fills Sumia!Lucina’s Galeforce proc archer 5/5 and says where each skill comes from', () => {
    const m = engine.buildMatch(get('lucina|sumia'), 'B01', ALL);
    expect(m.tier).toBe(5);
    expect(lines(m)).toEqual([
      // Sumia's one pick goes to the skill that costs the most class levels to learn (Dark Flier Lv 15).
      'Galeforce — inherit from Sumia (must be Sumia’s last equipped)',
      'Bowfaire — Sniper Lv 15 ⟳',
      'Luna — Great Knight Lv 5 ⟳',
      'Aether — fixed from Chrom',
      'Speed +2 — Pegasus Knight Lv 1 ⟳',
    ]);
    expect(m.reclassCost).toBe(3);
    expect(m.reclassClasses).toEqual(['Sniper', 'Great Knight', 'Pegasus Knight']);
  });
});

describe('one inherited skill per parent', () => {
  it('never uses two skills inherited from the same parent', () => {
    const sample = engine.pairings().filter((r) => !r.pairing.fixedRobin || r.key.startsWith('morgan-f|robin:spd/def|'));
    for (const r of sample) {
      for (const m of engine.builds(r, { context: 'all', dlc: true })) {
        const sides = m.slots.flatMap((s) => (s.source?.kind === 'parent' ? [s.source.side] : []));
        expect(new Set(sides).size, `${r.key} ${m.template.id}`).toBe(sides.length);
      }
    }
  });

  // Owain is male: Falcon Knight (Rally Speed) and Dark Flier (Rally Movement) are female-only, so only Lissa has them.
  it('leaves a slot empty when its only parent already passes another skill, and says so', () => {
    const m = engine.buildMatch(get('owain|vaike'), 'B20', ALL);
    expect(m.slots.map((s) => s.skill?.name)).toEqual(['Rally Magic', 'Rally Speed', undefined, undefined, undefined]);
    expect(m.slots[1]!.source).toMatchObject({ kind: 'parent', parent: 'Lissa' });
    expect(m.slots[2]!.reason).toBe('only Lissa can pass it, and Lissa passes Rally Speed instead');
    expect(m.tier).toBe(2);
  });
});

describe('ranking builds', () => {
  it('ranks by tier, then quality, then first preferences, then reclass cost, and hides anything below 3/5', () => {
    for (const key of ['lucina|sumia', 'owain|vaike', 'noire|gaius', 'morgan-f|robin:spd/def|lucina<sumia']) {
      for (const [context, dlc] of (['all', 'apotheosis', 'main-story', 'full-route'] as const).flatMap((c) => [[c, false], [c, true]] as const)) {
        const builds = engine.builds(get(key), { context, dlc });
        expect(builds.length, key).toBeGreaterThan(0);
        builds.forEach((b, i) => {
          expect(b.tier).toBeGreaterThanOrEqual(3);
          const next = builds[i + 1];
          if (!next) return;
          const order = [b.tier - next.tier, b.quality - next.quality, next.preferenceMisses - b.preferenceMisses, next.reclassCost - b.reclassCost];
          expect(order.find((d) => d !== 0) ?? 0, `${key} ${context}: ${b.template.id} before ${next.template.id}`).toBeGreaterThanOrEqual(0);
        });
      }
    }
  });

  // soly (S3) names DLC Galegirl as the "all DLCs allowed" Sumia!Lucina set.
  it('puts DLC Galegirl first for Sumia!Lucina in Apotheosis', () => {
    const [best] = engine.builds(get('lucina|sumia'), { context: 'apotheosis', dlc: false });
    expect(best!.template.id).toBe('B05');
    expect(best!.tier).toBe(5);
    // Galeforce 5 + Aether 5 + Luna 5 + Dual Strike+ 4 + Limit Breaker 5 in Apotheosis.
    expect(best!.quality).toBe(24);
  });

  it('only shows templates for the play context', () => {
    const ids = (context: 'main-story' | 'apotheosis') => engine.builds(get('lucina|sumia'), { context, dlc: false }).map((b) => b.template.id);
    expect(ids('main-story')).not.toContain('B05');
    expect(engine.buildTemplates('main-story').map((t) => t.id)).not.toContain('B05');
    expect(engine.buildTemplates('all')).toHaveLength(23);
  });

  it('gives each template its role’s preset', () => {
    const b12 = engine.buildTemplates('all').find((t) => t.id === 'B12')!;
    expect(b12).toMatchObject({ preset: 'tank', presetName: 'Tank (main story)', confidence: 'Wide' });
  });
});

describe('DLC skills', () => {
  const lb = (m: { slots: readonly { options: readonly { id: string }[] }[] }) => m.slots.findIndex((s) => s.options[0]!.id === 'limit-breaker');

  it('drops a DLC template a tier when DLC is off, and says why', () => {
    const m = engine.buildMatch(get('lucina|sumia'), 'B05', { context: 'all', dlc: false });
    expect(m.tier).toBe(4);
    expect(m.slots[lb(m)]!.reason).toBe('DLC: turn on DLC, or pick Apotheosis or Full route');
  });

  it('reaches Limit Breaker through the DLC toggle, or in Apotheosis and Full route whatever the toggle', () => {
    for (const [context, dlc] of [['all', true], ['apotheosis', false], ['full-route', false]] as const) {
      const m = engine.buildMatch(get('lucina|sumia'), 'B05', { context, dlc });
      expect(m.tier, context).toBe(5);
      expect(m.slots[lb(m)]!.source).toEqual({ kind: 'book' });
    }
    expect(engine.buildMatch(get('lucina|sumia'), 'B05', { context: 'main-story', dlc: false }).tier).toBe(4);
  });
});

describe('unreachable slots', () => {
  // The Maiden passes no class and no skill, so Lucina keeps Lord / Cavalier / Archer and only Chrom's Aether.
  it('says why Maiden!Lucina can’t get Galeforce', () => {
    const m = engine.buildMatch(get('lucina|maiden'), 'B01', ALL);
    expect(m.slots[0]!.reason).toBe('Dark Flier isn’t reachable for Lucina, and neither parent can pass it');
  });

  it('gives a reason per skill for an unfilled preference group', () => {
    // Crisis-mode crit's second slot: Vengeance (Sorcerer) or Astra (Swordmaster); neither Chrom nor the Maiden passes one.
    const m = engine.buildMatch(get('lucina|maiden'), 'B10', ALL);
    expect(m.slots[1]!.reason).toBe(
      'Vengeance: Sorcerer isn’t reachable for Lucina, and neither parent can pass it; ' +
        'Astra: Swordmaster isn’t reachable for Lucina, and neither parent can pass it',
    );
  });
});

describe('the Best build column', () => {
  it('sorts pairings by their best build as the ranking does, with no build last', () => {
    const best = engine.pairings('lucina').map((r) => engine.builds(r, ALL)[0]);
    const byKey = [...best].sort((a, b) => buildSortKey(b) - buildSortKey(a));
    for (let i = 0; i + 1 < byKey.length; i++) {
      const [a, b] = [byKey[i], byKey[i + 1]];
      if (!b) continue;
      expect(a, 'a pairing without a build sorts last').toBeDefined();
      const order = [a!.tier - b.tier, a!.quality - b.quality, b.preferenceMisses - a!.preferenceMisses, b.reclassCost - a!.reclassCost];
      expect(order.find((d) => d !== 0) ?? 0).toBeGreaterThanOrEqual(0);
    }
    expect(buildSortKey(undefined)).toBeLessThan(Math.min(...best.map(buildSortKey).filter((k) => k >= 0)));
  });
});

describe('the template filter', () => {
  it('shows the filtered template’s match, and nothing for a pairing below 3/5', () => {
    expect(engine.bestBuild(get('lucina|sumia'), ALL, 'B01')).toMatchObject({ tier: 5, template: { id: 'B01' } });
    // Owain × Vaike reaches only Rally Magic and one of Lissa's rallies of the female rallybot (see above).
    expect(engine.bestBuild(get('owain|vaike'), ALL, 'B20')).toBeUndefined();
    expect(engine.bestBuild(get('lucina|sumia'), ALL)).toEqual(engine.builds(get('lucina|sumia'), ALL)[0]);
  });
});
