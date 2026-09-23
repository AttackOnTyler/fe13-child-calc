import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEED, createEngine, type PresetId, type ScoreSettings } from './index';

const engine = createEngine();
const preset = (id: PresetId) => engine.presets().find((p) => p.id === id)!;

const settings = (id: PresetId, over: Partial<ScoreSettings> = {}): ScoreSettings => ({
  weights: preset(id).weights,
  mixed: preset(id).mixed,
  basis: 'caps-lb',
  classMode: 'auto',
  dlc: false,
  role: preset(id).role ?? 'lead',
  supportRank: 'A',
  speed: DEFAULT_SPEED,
  ...over,
});

const children = engine.children().map((c) => c.id);
const allGroups = children.flatMap((c) => engine.groups(c));
const robinGroups = allGroups.filter((g) => g.results.length > 1);
const scoring = engine.score(settings('physical-lead'));

describe('All children leaderboard', () => {
  it('ranks every pairing of every child by score in Robin mode all', () => {
    const board = scoring.leaderboard({ robin: 'all', sort: 'score' });
    expect(board).toHaveLength(engine.pairings().length);
    expect(new Set(board.map((e) => e.result.pairing.child))).toEqual(new Set(children));
    const raws = board.map((e) => e.score.raw!);
    expect(raws).toEqual([...raws].sort((a, b) => b - a));
    expect(board.map((e) => e.rank)).toEqual(board.map((_, i) => i + 1));
    expect(board[0]!.score.key).toBe(board[0]!.result.key);
  });

  it('shows each Robin group once, as its best asset/flaw, in Robin mode best', () => {
    const board = scoring.leaderboard({ robin: 'best', sort: 'score' });
    expect(board).toHaveLength(allGroups.length);
    const keys = new Set(board.map((e) => e.result.key));
    for (const g of robinGroups) expect(keys).toContain(scoring.groupBest(g).best.key);
  });

  it('shows each Robin group once, as the picked asset/flaw, in Robin mode pick', () => {
    const board = scoring.leaderboard({ robin: { asset: 'spd', flaw: 'def' }, sort: 'score' });
    expect(board).toHaveLength(allGroups.length);
    const robins = board.filter((e) => e.robin !== undefined);
    expect(robins).toHaveLength(robinGroups.length);
    expect(robins.every((e) => e.robin === '+Spd −Def')).toBe(true);
    expect(board.map((e) => e.result.key)).toContain('morgan-f|robin:spd/def|olivia');
  });

  it('labels each entry with its child, its variable parent and Robin’s asset/flaw', () => {
    const board = scoring.leaderboard({ robin: 'all', sort: 'score' });
    const byKey = (k: string) => board.find((e) => e.result.key === k)!;
    expect(byKey('lucina|sumia')).toMatchObject({ child: 'Lucina', parent: 'Sumia', robin: undefined });
    expect(byKey('kjelle|robin:spd/def')).toMatchObject({ child: 'Kjelle', parent: 'Robin (M)', robin: '+Spd −Def' });
    expect(byKey('morgan-f|robin:spd/hp|lucina<sumia')).toMatchObject({ parent: 'Lucina ← Sumia', robin: '+Spd −HP' });
  });

  it('sorts by Speed total, breaking ties by score', () => {
    const board = scoring.leaderboard({ robin: 'best', sort: 'speed' });
    for (let i = 1; i < board.length; i++) {
      const [a, b] = [board[i - 1]!.score, board[i]!.score];
      expect(a.speed!.total).toBeGreaterThanOrEqual(b.speed!.total);
      if (a.speed!.total === b.speed!.total) expect(a.raw!).toBeGreaterThanOrEqual(b.raw!);
    }
  });

  it('sorts by the Spd pair-up bonus in the Support role', () => {
    const board = engine.score(settings('battery')).leaderboard({ robin: 'best', sort: 'speed' });
    const spd = board.map((e) => e.score.values!.spd);
    expect(spd).toEqual([...spd].sort((a, b) => b - a));
  });

  it('puts pairings that can’t reach the pinned class last', () => {
    const board = engine.score(settings('physical-lead', { classMode: 'dread-fighter' })).leaderboard({ robin: 'best', sort: 'score' });
    const firstDead = board.findIndex((e) => !e.score.class);
    expect(firstDead).toBeGreaterThan(0);
    expect(board.slice(firstDead).every((e) => !e.score.class)).toBe(true);
  });

  it('narrows by the table filter without changing scores', () => {
    const all = scoring.leaderboard({ robin: 'best', sort: 'score' });
    const board = scoring.leaderboard({ robin: 'best', sort: 'score', filter: { parent: 'vaike', secondGen: false } });
    expect(board.length).toBeGreaterThan(0);
    expect(board.every((e) => e.parent === 'Vaike')).toBe(true);
    expect(board.map((e) => e.rank)).toEqual(board.map((_, i) => i + 1));
    for (const e of board) expect(e.score).toBe(all.find((a) => a.result.key === e.result.key)!.score);
  });

  it('keeps table order without weights (Rallybot / Dancer)', () => {
    const rallybot = engine.score(settings('rallybot'));
    const board = rallybot.leaderboard({ robin: 'best', sort: 'score' });
    expect(board.map((e) => e.result.key)).toEqual(allGroups.map((g) => rallybot.groupBest(g).best.key));
  });
});
