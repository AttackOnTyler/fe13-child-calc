import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, createEngine, runFromRoster, withRun, type MapOrderStep, type Route } from './index';

const engine = createEngine();
const facts = (route: Route | null) => withRun(EMPTY_ROSTER, { gender: 'M', asset: 'mag', flaw: 'str', difficulty: 'lunatic', route });
const played = (route: Route | null, ...maps: string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts(route)));
const keys = (steps: readonly MapOrderStep[]) => steps.map((s) => s.key);
const children = Array.from({ length: 12 }, (_, i) => `paralogue-${i + 5}`);

describe('the map order (#179)', () => {
  it('follows the user’s Full route order, ending at Apotheosis on its secret route', () => {
    const o = engine.mapOrder(played('full-route'));
    const k = keys(o.steps);
    expect(k.slice(0, 11)).toEqual(['premonition', 'prologue', 'chapter-1', 'chapter-2', 'chapter-3', 'paralogue-1', 'chapter-4', 'champions-of-yore-1', 'champions-of-yore-2', 'chapter-5', 'paralogue-2']);
    expect(k.slice(-8)).toEqual(['the-future-past-1', 'the-future-past-2', 'the-future-past-3', 'endgame', 'paralogue-23', 'infinite-regalia', 'apotheosis', 'apotheosis-secret']);
    // Every map once, but the two grind maps it leaves out; Apotheosis twice.
    const every = engine.maps().map((m) => m.id).filter((m) => m !== 'the-golden-gaffe' && m !== 'exponential-growth');
    expect(o.steps.map((s) => s.map).sort()).toEqual([...every, 'apotheosis'].sort());
    expect(o.steps.at(-1)).toMatchObject({ map: 'apotheosis', secret: true });
    expect(o.endpoint).toMatchObject({ key: 'apotheosis-secret', map: 'apotheosis', deploy: 20 });
  });

  it('marks the child paralogues as movable and Infinite Regalia as optional', () => {
    for (const route of ['full-route', 'main-story'] as const) {
      const steps = engine.mapOrder(played(route)).steps;
      expect(steps.filter((s) => s.movable).map((s) => s.key).sort()).toEqual([...children].sort());
    }
    const full = engine.mapOrder(played('full-route')).steps;
    expect(full.filter((s) => s.optional).map((s) => s.key)).toEqual(['infinite-regalia']);
    expect(full.filter((s) => /^paralogue-(1[89]|2[0-3])$/.test(s.key)).every((s) => !s.movable && !s.optional)).toBe(true);
  });

  it('builds the Main story from the story, each paralogue before the next chapter, ending at Endgame', () => {
    const o = engine.mapOrder(played('main-story'));
    const k = keys(o.steps);
    expect(k.slice(0, 8)).toEqual(['premonition', 'prologue', 'chapter-1', 'chapter-2', 'chapter-3', 'paralogue-1', 'chapter-4', 'chapter-5']);
    expect(k.slice(k.indexOf('chapter-13'), k.indexOf('chapter-14') + 1)).toEqual(['chapter-13', ...children, 'chapter-14']);
    expect(k.indexOf('paralogue-17')).toBe(k.indexOf('chapter-18') + 1);
    expect(k.some((m) => /^paralogue-(1[89]|2[0-3])$/.test(m))).toBe(false);
    expect(o.steps.every((s) => engine.maps().find((m) => m.id === s.map)!.kind !== 'xenologue')).toBe(true);
    expect(k.at(-1)).toBe('endgame');
    expect(o.endpoint).toMatchObject({ key: 'endgame', deploy: 16 });
  });

  it('reads an unset route as the Main story, like the next-map offers', () => {
    expect(engine.mapOrder(played(null)).endpoint.key).toBe('endgame');
  });

  it('starts after the latest recorded map, skipping logged skirmishes', () => {
    const run = addEntry(played('full-route', 'premonition', 'prologue', 'chapter-1'), 'other', 9, 'A skirmish');
    expect(keys(engine.mapOrder(run).steps).slice(0, 3)).toEqual(['chapter-2', 'chapter-3', 'paralogue-1']);
  });

  it('leaves out maps already played ahead of the order, and drops fixed maps skipped behind it', () => {
    const run = played('main-story', 'premonition', 'prologue', 'chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 'chapter-5', 'chapter-6', 'paralogue-3');
    const k = keys(engine.mapOrder(run).steps);
    expect(k.slice(0, 2)).toEqual(['chapter-7', 'chapter-8']);
    expect(k).not.toContain('paralogue-3');
    expect(k).not.toContain('paralogue-1');
  });

  it('keeps its place when a xenologue is played far ahead of it', () => {
    const run = played('full-route', 'premonition', 'prologue', 'chapter-1', 'chapter-2', 'chapter-3', 'the-future-past-1');
    const k = keys(engine.mapOrder(run).steps);
    expect(k.slice(0, 2)).toEqual(['paralogue-1', 'chapter-4']);
    expect(k).not.toContain('the-future-past-1');
  });

  it('keeps a child paralogue skipped behind the latest map: the plan can still place it', () => {
    const story = ['premonition', 'prologue', ...Array.from({ length: 14 }, (_, i) => `chapter-${i + 1}`)];
    const run = played('main-story', ...story.slice(0, 15), 'paralogue-6', 'chapter-14');
    const k = keys(engine.mapOrder(run).steps);
    expect(k.slice(0, 12)).toEqual([...children.filter((c) => c !== 'paralogue-6'), 'chapter-15']);
  });

  it('counts Apotheosis twice on the Full route: its normal route, then the secret one', () => {
    const before = keys(engine.mapOrder(played('full-route')).steps).slice(0, -2);
    const once = played('full-route', ...before, 'apotheosis');
    expect(keys(engine.mapOrder(once).steps)).toEqual(['apotheosis-secret']);
    const done = addEntry(once, 'apotheosis', 99);
    expect(engine.mapOrder(done).steps).toEqual([]);
    expect(engine.mapOrder(done).endpoint.key).toBe('apotheosis-secret');
  });
});
