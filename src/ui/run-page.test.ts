import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, createEngine, runFromRoster, withRun, type Route } from '../engine';
import { heldText, mapOrderReadout, parseHeldText, parseSupportsText, supportsText } from './run-page';

describe('the map order readout (#179)', () => {
  const engine = createEngine();
  const run = (route: Route, ...maps: string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(withRun(EMPTY_ROSTER, { route, difficulty: 'lunatic' })));

  it('lists the Full route’s maps still to play, marking the plan’s choices and the endpoint', () => {
    const r = mapOrderReadout(engine, run('full-route', 'premonition', 'prologue', 'chapter-1'));
    expect(r.title).toBe('Map order: Full route, to Apotheosis (secret route), deploying 20');
    expect(r.rows.slice(0, 2)).toEqual(['Chapter 2: Shepherds', 'Chapter 3: Warrior Realm']);
    expect(r.rows).toContain('Paralogue 5: Scion of Legend (the plan places it)');
    expect(r.rows).toContain('Infinite Regalia (optional)');
    expect(r.rows.slice(-2)).toEqual(['Apotheosis', 'Apotheosis (secret route) (endpoint)']);
  });

  it('ends the Main story at Endgame, and says when the endpoint is recorded', () => {
    const r = mapOrderReadout(engine, run('main-story'));
    expect(r.title).toBe('Map order: Main story, to Endgame, deploying 16');
    expect(r.rows[0]).toBe('Premonition: Invisible Ties');
    expect(r.rows.at(-1)).toBe('Endgame: Grima (endpoint)');
    const all = engine.mapOrder(run('main-story')).steps.map((s) => s.map);
    expect(mapOrderReadout(engine, run('main-story', ...all)).rows).toEqual([]);
  });
});

describe('the chapter log’s short text fields', () => {
  it('round-trip inventory with uses and forges', () => {
    const items = [
      { item: 'Iron Sword', uses: 40 },
      { item: 'Steel Sword', uses: 30, forge: { name: 'Kiri', mt: 2, hit: 10, crit: 0 } },
      { item: 'Falchion', uses: null },
    ];
    expect(heldText(items)).toBe('Iron Sword 40; Steel Sword 30 [Kiri +2/+10/+0]; Falchion');
    expect(parseHeldText(heldText(items))).toEqual(items);
  });

  it('round-trip supports, dropping anything that isn’t a rank', () => {
    const s = [{ partner: 'sumia' as const, rank: 'A' as const }];
    expect(parseSupportsText(supportsText(s))).toEqual(s);
    expect(parseSupportsText('sumia Z; lissa C')).toEqual([{ partner: 'lissa', rank: 'C' }]);
  });
});
