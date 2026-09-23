import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEED, createEngine, type ChildId, type PresetId, type ScoreSettings, type SpeedSettings } from './index';

const engine = createEngine();
const preset = (id: PresetId) => engine.presets().find((p) => p.id === id)!;
const group = (child: ChildId, key: string) => engine.groups(child).find((g) => g.key === key)!;
const lucinaRobin = group('lucina', 'robin');

const settings = (id: PresetId, over: Partial<ScoreSettings> = {}, speed: Partial<SpeedSettings> = {}): ScoreSettings => ({
  weights: preset(id).weights,
  mixed: preset(id).mixed,
  basis: 'caps-lb',
  classMode: 'auto',
  dlc: false,
  role: preset(id).role ?? 'lead',
  supportRank: 'A',
  ...over,
  speed: { ...DEFAULT_SPEED, ...speed },
});

const bestCell = (s: ScoreSettings, g = lucinaRobin) => engine.score(s).heatmap(g)!.best;

/**
 * A child's Robin row shows the asset/flaw that child wants (#28, reframed with the user): Robin's +Spd is +4 Spd at
 * Spd→T 16 (64) against +4 attack at 6 (24), so a child short of target + margin wants +Spd, and one past it wants
 * its attack stat. Robin's own best asset/flaw is a different question, so the ticket's "on every setting" fixtures
 * narrow to hand-worked settings on each side of the knee.
 */
describe('which asset/flaw Lucina wants from Robin (F)', () => {
  it('+Mag −Str under Magical lead once her Speed clears target + margin (defaults: Sage, Spd 74 > 68)', () => {
    expect(bestCell(settings('magical-lead'))).toMatchObject({ asset: 'mag', flaw: 'str' });
    expect(bestCell(settings('magical-lead', { basis: 'growths' }))).toMatchObject({ asset: 'mag', flaw: 'str' });
  });

  it('+Str −Def under Physical lead when +Str leaves her Speed exactly at target + margin (Caps+LB, Pair-up 0)', () => {
    // −Mag or −Skl would cost Spd (−1) inside the band at 16; −Def costs Def 3 + Lck 1 + Res 1 at weight 1.
    expect(bestCell(settings('physical-lead', {}, { pairUp: 0 }))).toMatchObject({ asset: 'str', flaw: 'def' });
  });

  it('+Spd when she’s short of target + margin (Magical lead on Caps, Pair-up 0: Sage Spd 58 < 68)', () => {
    expect(bestCell(settings('magical-lead', { basis: 'caps' }, { pairUp: 0 }))).toMatchObject({ asset: 'spd' });
  });

  it('+Spd under Physical lead on Caps with Pair-up 0 (Assassin Spd 62 < 68), not the ticket’s +Str −Def', () => {
    expect(bestCell(settings('physical-lead', { basis: 'caps' }, { pairUp: 0 }))).toMatchObject({ asset: 'spd', flaw: 'def' });
  });

  it('+Spd −Mag under Physical lead at defaults: +Spd lets General reach target + margin (Spd 68)', () => {
    expect(bestCell(settings('physical-lead'))).toMatchObject({ asset: 'spd', flaw: 'mag', label: '+Spd −Mag' });
  });
});

describe('asset × flaw heatmap', () => {
  const scoring = engine.score(settings('physical-lead'));
  const map = scoring.heatmap(lucinaRobin)!;

  it('has one cell per asset/flaw: 8 assets × 7 flaws, asset-major in stat order', () => {
    expect(map.cells).toHaveLength(56);
    expect(map.cells.every((c) => c.asset !== c.flaw)).toBe(true);
    expect(map.cells.slice(0, 7).map((c) => c.flaw)).toEqual(['str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']);
    expect(map.cells.slice(0, 7).every((c) => c.asset === 'hp')).toBe(true);
    expect(new Set(map.cells.map((c) => c.key))).toEqual(new Set(lucinaRobin.results.map((r) => r.key)));
  });

  it('gives each cell its unrounded score, and marks the group’s best', () => {
    for (const c of map.cells) expect(c.scaled).toBe(scoring.get(c.key).scaled);
    expect(map.best.key).toBe(scoring.groupBest(lucinaRobin).best.key);
    expect(map.cells.some((c) => c.scaled !== undefined && !Number.isInteger(c.scaled))).toBe(true);
  });

  it('places each cell within this parent’s own spread: 0 at its worst combo, 1 at its best', () => {
    const scaled = map.cells.map((c) => c.scaled!);
    expect(map.spread).toEqual({ lo: Math.min(...scaled), hi: Math.max(...scaled) });
    expect(map.best.position).toBe(1);
    expect(Math.min(...map.cells.map((c) => c.position!))).toBe(0);
  });

  it('covers the fixed Robin’s asset/flaw for each of Morgan’s partner groups', () => {
    const olivia = group('morgan-f', 'olivia');
    const m = scoring.heatmap(olivia)!;
    expect(m.cells).toHaveLength(56);
    const cell = m.cells.find((c) => c.asset === 'spd' && c.flaw === 'hp')!;
    expect(cell.key).toBe('morgan-f|robin:spd/hp|olivia');
  });

  it('has no heatmap for a single-pairing group', () => {
    expect(scoring.heatmap(group('lucina', 'sumia'))).toBeUndefined();
  });

  it('leaves positions undefined when nothing in the group has a score (Rallybot / Dancer)', () => {
    const m = engine.score(settings('rallybot')).heatmap(lucinaRobin)!;
    expect(m.spread).toBeUndefined();
    expect(m.cells.every((c) => c.scaled === undefined && c.position === undefined)).toBe(true);
  });
});
