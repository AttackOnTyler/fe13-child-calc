import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPEED,
  EMPTY_ROSTER,
  createEngine,
  parseRoster,
  resolveAssumptions,
  rosterUnits,
  withRun,
  withSpouse,
  withState,
  type Roster,
  type ScoreSettings,
} from './index';

const engine = createEngine();
const result = (key: string) => engine.result(key)!;
const blocking = (key: string, roster: Roster) => engine.blocking(result(key), roster);

describe('blocked pairings: unit states', () => {
  it('blocks nothing on an empty roster', () => {
    for (const r of engine.pairings()) expect(engine.blocking(r, EMPTY_ROSTER)).toMatchObject({ status: 'open', hard: [], soft: [] });
  });

  it('hard-blocks every pairing that needs a dead or missed unit', () => {
    const dead = withState(EMPTY_ROSTER, 'vaike', 'dead');
    expect(blocking('owain|vaike', dead)).toMatchObject({ status: 'hard', hard: ['Vaike is dead'] });
    expect(blocking('lucina|sumia', dead).status).toBe('open');
    const missed = withState(EMPTY_ROSTER, 'lonqu', 'missed');
    expect(blocking('inigo|lonqu', missed)).toMatchObject({ status: 'hard', hard: ["Lon'qu was missed"] });
  });

  it('hard-blocks a missed or dead child, and a second-gen partner’s parents', () => {
    expect(blocking('lucina|sumia', withState(EMPTY_ROSTER, 'lucina', 'missed')).status).toBe('hard');
    // Morgan (M) × Owain ← Vaike needs Lissa × Vaike to happen first.
    expect(blocking('morgan-m|robin:spd/hp|owain<vaike', withState(EMPTY_ROSTER, 'lissa', 'dead')).hard).toEqual(['Lissa is dead']);
  });

  it('soft-blocks a pairing through a benched unit', () => {
    expect(blocking('owain|vaike', withState(EMPTY_ROSTER, 'vaike', 'benched'))).toMatchObject({
      status: 'soft',
      hard: [],
      soft: ['Vaike is benched'],
    });
  });

  it('prunes nothing for a unit not yet recruited', () => {
    expect(blocking('owain|vaike', withState(EMPTY_ROSTER, 'vaike', 'not-recruited'))).toMatchObject({ status: 'open', hard: [], soft: [] });
  });
});

describe('blocked pairings: marriages and pins', () => {
  const married = withSpouse(EMPTY_ROSTER, 'lissa', 'vaike', 'married');
  const pinned = withSpouse(EMPTY_ROSTER, 'lissa', 'vaike', 'pinned');

  it('marks a pairing whose marriage happened as married', () => {
    expect(blocking('owain|vaike', married)).toMatchObject({ status: 'married', hard: [], soft: [] });
  });

  it('hard-blocks a pairing through a unit married to someone else', () => {
    expect(blocking('owain|frederick', married)).toMatchObject({ status: 'hard', hard: ['Lissa is married to Vaike'] });
    expect(blocking('kjelle|vaike', married)).toMatchObject({ status: 'hard', hard: ['Vaike is married to Lissa'] });
  });

  it('marks a pinned pairing as planned, and soft-blocks what contradicts the pin', () => {
    expect(blocking('owain|vaike', pinned)).toMatchObject({ status: 'planned', hard: [], soft: [] });
    expect(blocking('owain|frederick', pinned)).toMatchObject({ status: 'soft', hard: [], soft: ['Lissa is planned with Vaike'] });
    expect(blocking('kjelle|vaike', pinned)).toMatchObject({ status: 'soft', soft: ['Vaike is planned with Lissa'] });
  });

  it('keeps one spouse per unit: a new spouse replaces the old one on both sides', () => {
    const moved = withSpouse(married, 'lissa', 'frederick', 'pinned');
    expect(moved.spouses.lissa).toEqual({ partner: 'frederick', bond: 'pinned' });
    expect(moved.spouses.frederick).toEqual({ partner: 'lissa', bond: 'pinned' });
    expect(moved.spouses.vaike).toBeUndefined();
    expect(withSpouse(moved, 'lissa', null).spouses).toEqual({});
  });

  it('voids a pin through a dead, missed or benched unit, freeing the partner', () => {
    for (const state of ['dead', 'missed', 'benched'] as const) {
      const roster = withState(pinned, 'vaike', state);
      // Lissa is free again: marrying someone else contradicts nothing.
      expect(blocking('owain|frederick', roster)).toMatchObject({ status: 'open', hard: [], soft: [] });
      // The pinned pairing itself is blocked by Vaike's state, not planned.
      expect(blocking('owain|vaike', roster).status).toBe(state === 'benched' ? 'soft' : 'hard');
    }
  });

  it('hard-blocks a married second-gen partner’s other options', () => {
    const roster = withSpouse(EMPTY_ROSTER, 'robin', 'lucina', 'married');
    expect(blocking('morgan-f|robin:spd/hp|lucina<olivia', roster).status).toBe('open');
    expect(blocking('morgan-f|robin:spd/hp|sumia', roster).hard).toEqual(['Robin is married to Lucina']);
  });
});

describe('blocked pairings: a parent dying after the marriage', () => {
  const widowed = withState(withSpouse(EMPTY_ROSTER, 'lissa', 'vaike', 'married'), 'vaike', 'dead');

  it('leaves the child recruitable by default, as an assumption', () => {
    const b = blocking('owain|vaike', widowed);
    expect(b).toMatchObject({ status: 'married', hard: [], soft: [] });
    expect(b.notes).toEqual(['Vaike died after marrying: the child still comes ⚠']);
  });

  it('hard-blocks the child when the assumption is overridden', () => {
    const strict = createEngine(resolveAssumptions({ 'child-after-parent-death': false }));
    expect(strict.blocking(strict.result('owain|vaike')!, widowed)).toMatchObject({ status: 'hard', hard: ['Vaike is dead'] });
    expect(strict.assumptions().find((a) => a.id === 'child-after-parent-death')).toMatchObject({ isDefault: false });
  });

  it('never unblocks a dead parent who didn’t marry', () => {
    expect(blocking('owain|frederick', withState(EMPTY_ROSTER, 'frederick', 'dead')).status).toBe('hard');
  });

  it('ignores a bench on a parent who is already married', () => {
    const benched = withState(withSpouse(EMPTY_ROSTER, 'lissa', 'vaike', 'married'), 'vaike', 'benched');
    expect(blocking('owain|vaike', benched)).toMatchObject({ status: 'married', soft: [] });
  });
});

describe('run facts', () => {
  const labels = (child: Parameters<typeof engine.groups>[0], run: Roster['run']) => engine.groups(child, { run }).map((g) => g.label);

  it('remove the other Robin and the other Morgan entirely', () => {
    const run = { gender: 'M', asset: null, flaw: null } as const;
    expect(labels('kjelle', run)).toContain('Robin (M)');
    expect(labels('lucina', run)).not.toContain('Robin (F)');
    expect(engine.groups('morgan-m', { run })).toEqual([]);
    expect(engine.groups('morgan-f', { run }).length).toBe(engine.groups('morgan-f').length);
  });

  it('remove Robin’s other asset/flaws, leaving one pairing per Robin group', () => {
    const run = { gender: 'M', asset: 'spd', flaw: 'def' } as const;
    const [robin] = engine.groups('kjelle', { run }).filter((g) => g.label === 'Robin (M)');
    expect(robin!.results.map((r) => r.key)).toEqual(['kjelle|robin:spd/def']);
    for (const g of engine.groups('morgan-f', { run })) expect(g.results.map((r) => engine.robinLabel(r.pairing))).toEqual(['+Spd −Def']);
  });

  it('apply to the leaderboard', () => {
    const sc = engine.score(settings);
    const run = { gender: 'F', asset: 'mag', flaw: 'lck' } as const;
    const board = sc.leaderboard({ robin: 'all', sort: 'score', filter: { run } });
    expect(board.some((e) => e.child === 'Morgan (F)')).toBe(false);
    expect(board.filter((e) => e.robin).every((e) => e.robin === '+Mag −Lck')).toBe(true);
  });
});

const settings: ScoreSettings = {
  weights: engine.presets().find((p) => p.id === 'physical-lead')!.weights,
  mixed: false,
  basis: 'caps-lb',
  classMode: 'auto',
  dlc: false,
  role: 'lead',
  supportRank: 'A',
  speed: DEFAULT_SPEED,
};

describe('roster on the leaderboard', () => {
  const sc = engine.score(settings);
  const roster = withState(withSpouse(EMPTY_ROSTER, 'lissa', 'vaike', 'married'), 'frederick', 'benched');

  it('never changes a score', () => {
    const before = new Map(sc.leaderboard({ robin: 'all', sort: 'score' }).map((e) => [e.result.key, e.score.raw]));
    const after = engine.score(settings).leaderboard({ robin: 'all', sort: 'score', roster });
    expect(after).toHaveLength(before.size);
    for (const e of after) expect(e.score.raw).toBe(before.get(e.result.key));
  });

  it('sorts hard-blocked cards last and marks each entry', () => {
    const board = sc.leaderboard({ robin: 'best', sort: 'score', roster });
    const firstHard = board.findIndex((e) => e.blocking?.status === 'hard');
    expect(firstHard).toBeGreaterThan(0);
    expect(board.slice(firstHard).every((e) => e.blocking?.status === 'hard')).toBe(true);
    expect(board.find((e) => e.result.key === 'owain|vaike')!.blocking!.status).toBe('married');
    expect(board.find((e) => e.result.key === 'owain|frederick')!.blocking!.status).toBe('hard');
    expect(board.find((e) => e.result.key === 'cynthia|frederick')!.blocking!.soft).toEqual(['Frederick is benched']);
  });

  it('can hide hard-blocked pairings', () => {
    const board = sc.leaderboard({ robin: 'best', sort: 'score', roster, hideBlocked: true });
    expect(board.length).toBeGreaterThan(0);
    expect(board.some((e) => e.blocking?.status === 'hard')).toBe(false);
    expect(board.some((e) => e.blocking?.status === 'soft')).toBe(true);
  });
});

describe('the Roster page’s units', () => {
  const unit = (id: string, run: Roster['run'] = EMPTY_ROSTER.run) => rosterUnits(run).find((u) => u.id === id);

  it('lists Robin and the one Morgan only once Robin’s gender is set', () => {
    expect(unit('robin')).toBeUndefined();
    expect(unit('morgan-f')).toMatchObject({ kind: 'child' });
    const run = { gender: 'F', asset: null, flaw: null } as const;
    expect(unit('robin', run)).toMatchObject({ name: 'Robin (F)', gender: 'F', kind: 'robin' });
    expect(unit('morgan-m', run)).toBeDefined();
    expect(unit('morgan-f', run)).toBeUndefined();
  });

  it('offers each unit the spouses it can S-support, Robin included once set', () => {
    expect(unit('sumia')!.partners).toEqual(['chrom', 'frederick', 'gaius', 'henry']);
    expect(unit('sumia', { gender: 'M', asset: null, flaw: null })!.partners).toContain('robin');
    expect(unit('chrom')!.partners).toEqual(['sully', 'sumia', 'maribelle', 'olivia', 'maiden']);
    expect(unit('maiden')).toBeUndefined();
  });

  it('marks Robin-only units, and children who can marry Robin', () => {
    const run = { gender: 'M', asset: null, flaw: null } as const;
    expect(unit('tiki', run)).toMatchObject({ robinOnly: true, partners: ['robin'] });
    expect(unit('sully', run)!.robinOnly).toBe(false);
    expect(unit('lucina', run)).toMatchObject({ kind: 'child', partners: ['robin'] });
    expect(unit('owain', run)!.partners).toEqual([]);
  });
});

describe('saved roster', () => {
  it('round-trips through JSON', () => {
    const roster = withState(withSpouse({ ...EMPTY_ROSTER, run: { gender: 'M', asset: 'spd', flaw: 'def' } }, 'robin', 'lucina', 'married'), 'vaike', 'dead');
    expect(parseRoster(JSON.parse(JSON.stringify(roster)))).toEqual(roster);
  });

  it('drops anything stale or corrupt', () => {
    expect(parseRoster(null)).toEqual(EMPTY_ROSTER);
    expect(parseRoster('nope')).toEqual(EMPTY_ROSTER);
    const parsed = parseRoster({
      run: { gender: 'X', asset: 'spd', flaw: 'spd' },
      states: { vaike: 'dead', nobody: 'dead', lissa: 'asleep' },
      spouses: {
        lissa: { partner: 'vaike', bond: 'married' },
        vaike: { partner: 'lissa', bond: 'married' },
        // One-sided, and not a possible marriage.
        sumia: { partner: 'vaike', bond: 'pinned' },
        chrom: { partner: 'lissa', bond: 'pinned' },
        lissa2: { partner: 'chrom', bond: 'pinned' },
      },
    });
    expect(parsed.run).toEqual({ gender: null, asset: 'spd', flaw: null });
    expect(parsed.states).toEqual({ vaike: 'dead' });
    expect(parsed.spouses).toEqual({ lissa: { partner: 'vaike', bond: 'married' }, vaike: { partner: 'lissa', bond: 'married' } });
  });
});

describe('changing the run facts', () => {
  it('drops marriages that can’t exist in the new run, and a flaw equal to the new asset', () => {
    const start = withSpouse({ ...EMPTY_ROSTER, run: { gender: 'M', asset: null, flaw: 'spd' } }, 'robin', 'sumia', 'married');
    const flipped = withRun(start, { gender: 'F', asset: 'spd' });
    expect(flipped.run).toEqual({ gender: 'F', asset: 'spd', flaw: null });
    expect(flipped.spouses).toEqual({});
  });

  it('never lets Robin or Chrom be lost: their deaths are a Game Over', () => {
    const units = rosterUnits({ gender: 'M', asset: null, flaw: null });
    expect(units.filter((u) => !u.canBeLost).map((u) => u.id)).toEqual(['robin', 'chrom']);
  });
});
