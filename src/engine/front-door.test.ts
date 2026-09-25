import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEED, EMPTY_ROSTER, createEngine, withRun, type ChildId, type PresetId, type ScoreSettings } from './index';

const engine = createEngine();
const preset = (id: PresetId) => engine.presets().find((p) => p.id === id)!;
const settings = (id: PresetId): ScoreSettings => ({
  weights: preset(id).weights,
  mixed: preset(id).mixed,
  basis: 'caps-lb',
  classMode: 'auto',
  dlc: false,
  role: preset(id).role ?? 'lead',
  supportRank: 'A',
  speed: DEFAULT_SPEED,
});
const robin = withRun(EMPTY_ROSTER, { gender: 'M', asset: 'mag', flaw: 'str' });

/** The pairing table's ranking: each parent group by its best pairing's raw score. */
const tableTop = (child: ChildId, s: ScoreSettings) => {
  const sc = engine.score(s);
  return engine
    .groups(child, { run: robin.run })
    .map((g) => ({ label: g.label, raw: sc.get(sc.groupBest(g).best.key).raw ?? -Infinity }))
    .sort((a, b) => b.raw - a.raw)
    .slice(0, 5)
    .map((g) => g.label);
};

describe('a child’s front door', () => {
  it.each(['physical-lead', 'magical-lead'] as const)('ranks its top 5 as the pairing table does (%s)', (p) => {
    for (const child of ['lucina', 'owain', 'cynthia'] as const) {
      const door = engine.frontDoor(child, robin, settings(p), 'all');
      expect(door.top.map((t) => t.label)).toEqual(tableTop(child, settings(p)));
    }
  });

  it('shows what every pairing gets: Chrom’s Aether and classes for Lucina', () => {
    const door = engine.frontDoor('lucina', robin, settings('physical-lead'), 'all');
    expect(door).toMatchObject({ fixedParent: 'Chrom', startClass: 'Lord', defaultClasses: ['Lord', 'Cavalier', 'Archer'] });
    expect(door.fixedPasses.skill?.id).toBe('aether');
    expect(door.parentCount).toBe(engine.groups('lucina', { run: robin.run }).length);
  });

  it('keeps Morgan waiting on Robin: no pairings until Robin is set', () => {
    const waiting = engine.frontDoor('morgan-f', EMPTY_ROSTER, settings('physical-lead'), 'all');
    expect(waiting).toMatchObject({ waitsOnRobin: true, top: [], parentCount: 0, robin: { kind: 'robins-child' } });
    expect(engine.frontDoor('morgan-f', robin, settings('physical-lead'), 'all').top.length).toBeGreaterThan(0);
  });

  it('says whether the child can marry Robin, and the best Morgan once Robin is set', () => {
    expect(engine.frontDoor('lucina', EMPTY_ROSTER, settings('physical-lead'), 'all').robin).toMatchObject({ kind: 'yes', robinSet: false, morgan: undefined });
    const set = engine.frontDoor('lucina', robin, settings('physical-lead'), 'all').robin;
    expect(set.kind === 'yes' && set.morgan?.label.startsWith('Morgan (F) ← ')).toBe(true);
    expect(engine.frontDoor('owain', robin, settings('physical-lead'), 'all').robin).toEqual({ kind: 'no' });
  });
});
