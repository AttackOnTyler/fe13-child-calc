import { describe, expect, it } from 'vitest';
import { CHAPTER_DIFFICULTIES, createEngine, foesOf, type Wave } from './index';

const engine = createEngine();
const turnsOf = (ws: readonly Wave[]) => ws.map((w) => w.turns);
const groupsOf = (w: Wave) => w.groups.map((g) => `${g.count} ${g.class}${g.items.length ? ` (${g.items.map((i) => `${i.name}${i.drop ? ' drop' : ''}`).join(', ')})` : ''}`);

describe('reinforcement waves (#178)', () => {
  it('reads a story map’s waves per difficulty: Chapter 5’s Hard-only turn and difficulty weapons', () => {
    const normal = engine.mapWaves('chapter-5', 'normal').waves;
    expect(turnsOf(normal)).toEqual([[3], [5]]);
    expect(groupsOf(normal[0]!)).toEqual(['1 Barbarian (Hand Axe drop)', '1 Myrmidon']);
    expect(normal[0]!.groups[0]!.note).toBe('On Lunatic, this Barbarian is equipped with a Short Axe alongside the drop');
    expect(groupsOf(normal[1]!)).toEqual(['1 Dark Mage', '1 Myrmidon', '1 Barbarian (Iron Axe)']);

    const lunatic = engine.mapWaves('chapter-5', 'lunatic').waves;
    expect(turnsOf(lunatic)).toEqual([[3], [4], [5]]);
    expect(groupsOf(lunatic[0]!)).toEqual(['1 Barbarian (Steel Axe)', '1 Barbarian (Hand Axe drop)', '1 Myrmidon']);
    expect(groupsOf(lunatic[1]!)).toEqual(['2 Wyvern Rider']);
    expect(groupsOf(lunatic[2]!)).toEqual(['1 Dark Mage', '1 Myrmidon', '1 Barbarian (Steel Axe)', '2 Wyvern Rider']);
    expect(lunatic[1]!.groups[0]!.from).toBe('the northwest forts');
  });

  it('takes the turn and count each difficulty gives', () => {
    expect(turnsOf(engine.mapWaves('chapter-10', 'normal').waves)).toEqual([[6], [8], [9], [10]]);
    expect(turnsOf(engine.mapWaves('chapter-10', 'hard').waves)).toEqual([[6], [7], [8], [8]]);
    expect(turnsOf(engine.mapWaves('chapter-10', 'lunatic').waves)).toEqual([[5], [6], [6], [7]]);
    expect(groupsOf(engine.mapWaves('chapter-9', 'normal').waves[0]!).slice(0, 2)).toEqual(['2 Wyvern Rider (Steel Axe)', '2 Wyvern Rider (Hand Axe)']);
    expect(groupsOf(engine.mapWaves('chapter-9', 'lunatic').waves[0]!).slice(0, 2)).toEqual(['3 Wyvern Rider (Silver Axe)', '3 Wyvern Rider (Short Axe)']);
    expect(turnsOf(engine.mapWaves('hot-spring-scramble', 'normal').waves)).toEqual([[3, 5], [4], [6]]);
    const c21 = engine.mapWaves('chapter-21', 'normal').waves[0]!;
    expect(c21.turns).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(groupsOf(c21)).toEqual(['1 Sorcerer (Mire)']);
    expect(groupsOf(engine.mapWaves('chapter-21', 'lunatic').waves[0]!)).toEqual(['2 Sorcerer (Mire)']);
  });

  it('keeps a paralogue’s conditional wave with its condition, and its Lunatic-only turn off Normal', () => {
    const normal = engine.mapWaves('paralogue-10', 'normal').waves;
    expect(turnsOf(normal)).toEqual([[2], [4], []]);
    const talk = normal[2]!;
    expect(talk.condition).toBe('On the turn after Severa speaks with Holland');
    expect(groupsOf(talk)).toEqual(['1 Sage (Arcthunder)', '1 Sage (Arcfire)', '1 Assassin', '1 Berserker (Tomahawk)']);
    expect(turnsOf(engine.mapWaves('paralogue-10', 'lunatic').waves)).toEqual([[2], [3], [4], []]);
    expect(groupsOf(engine.mapWaves('paralogue-10', 'hard').waves[2]!)).toEqual(['1 Sage (Thoron)', '1 Sage (Bolganone)', '1 Assassin', '1 Berserker (Tomahawk)']);
  });

  it('represents Chapter 23’s returning Validar and Chapter 11’s halt as a conditional wave and a note', () => {
    const c23 = engine.mapWaves('chapter-23', 'lunatic').waves;
    const validar = c23.find((w) => w.condition === 'After Validar is defeated once')!;
    expect(validar.turns).toEqual([]);
    expect(validar.groups).toMatchObject([{ count: 1, name: 'Validar', boss: true, from: 'south of the easternmost stairs' }]);
    expect(validar.groups[0]!.foe?.boss).toBe(true);
    expect(engine.mapWaves('chapter-11', 'normal').notes).toEqual(['All reinforcements are halted when Gangrel is defeated.']);
  });

  it('reads named arrivals from the map’s own tables, marked when the enemy table already lists them', () => {
    const [turn1] = engine.mapWaves('lost-bloodlines-1', 'normal').waves;
    expect(turn1!.turns).toEqual([1]);
    expect(turn1!.groups.map((g) => `${g.name} (${g.class})`).slice(0, 2)).toEqual(['Ethlyn (Valkyrie)', 'Quan (Paladin)']);
    expect(turn1!.groups.every((g) => g.inEnemyTable && g.foe)).toBe(true);
  });

  it('keeps Endgame’s unlimited reinforcements: every turn from 2, four a turn (eight on Lunatic), like the starting foes', () => {
    const [normal] = engine.mapWaves('endgame', 'normal').waves;
    expect(normal!.everyTurnFrom).toBe(2);
    expect(normal!.perTurn).toBe(4);
    expect(engine.mapWaves('endgame', 'lunatic').waves[0]!.perTurn).toBe(8);
    expect(normal!.groups.length).toBeGreaterThan(0);
    expect(normal!.groups.every((g) => g.foe)).toBe(true);
    const fp3 = engine.mapWaves('the-future-past-3', 'hard').waves[0]!;
    expect(fp3.everyTurnFrom).toBe(2);
    expect(fp3.perTurn).toBeNull();
    expect(fp3.groups.map((g) => g.class)).toContain('Griffon Rider');
    expect(fp3.groups.find((g) => g.class === 'General')).toMatchObject({ items: [{ name: 'Brave Lance' }], from: 'the stairs' });
  });

  it('reads Apotheosis’s waves from its enemy tabs: each after the one before, on its route', () => {
    const { waves } = engine.mapWaves('apotheosis', 'lunatic');
    expect(waves.map((w) => w.label)).toEqual(['Wave 2 (Monks)', 'Wave 2 (Pegasus)', 'Wave 3', 'Wave 4 (Fliers)', 'Wave 4 (Riders)', 'Wave 5', 'Secret wave 1', 'Secret wave 2', 'Secret wave 3', 'Secret wave 4', 'Secret wave 5']);
    expect(waves.map((w) => w.condition)).toEqual([
      'Normal route, after Wave 1 (one of two versions, the player’s choice)',
      'Normal route, after Wave 1 (one of two versions, the player’s choice)',
      'Normal route, after Wave 2',
      'Normal route, after Wave 3 (one of two versions, the player’s choice)',
      'Normal route, after Wave 3 (one of two versions, the player’s choice)',
      'Normal route, after Wave 4',
      'Secret route, after Wave 1',
      'Secret route, after Secret wave 1',
      'Secret route, after Secret wave 2',
      'Secret route, after Secret wave 3',
      'Secret route, after Secret wave 4',
    ]);
    expect(waves.every((w) => w.turns.length === 0)).toBe(true);
    // Wave 2 (Monks): FEW's 10 foes, with their own stats.
    expect(waves[0]!.groups.reduce((n, g) => n + g.count, 0)).toBe(10);
    expect(waves[0]!.groups[0]!.foe).toMatchObject({ className: 'War Monk', count: 1, stats: { hp: 80, str: 65 } });
  });

  it('gives each wave group a foe the map solver can fight: the map’s own group of that class, with the wave’s weapon and count', () => {
    const chapter9 = engine.maps().find((m) => m.id === 'chapter-9')!;
    const rider = foesOf(chapter9, 'lunatic').find((f) => f.className === 'Wyvern Rider')!;
    const g = engine.mapWaves('chapter-9', 'lunatic').waves[0]!.groups[0]!;
    expect(g.foe).toMatchObject({ className: 'Wyvern Rider', count: 3, boss: false, stats: rider.stats, weapon: { name: 'Silver Axe' } });
  });

  it('parses every map’s reinforcement text on every difficulty, or flags the line with its text kept', () => {
    const unparsed = new Set<string>();
    for (const m of engine.maps()) {
      for (const d of CHAPTER_DIFFICULTIES) {
        const w = engine.mapWaves(m.id, d);
        for (const u of w.unparsed) unparsed.add(`${m.id}: ${u}`);
        for (const wave of w.waves) {
          expect(wave.turns.length > 0 || wave.everyTurnFrom !== undefined || !!wave.condition, `${m.id} ${d} ${wave.label}`).toBe(true);
          for (const g of wave.groups) expect(g.count, `${m.id} ${d} ${wave.label}`).toBeGreaterThan(0);
        }
      }
    }
    expect([...unparsed]).toEqual([]);
  });
});
