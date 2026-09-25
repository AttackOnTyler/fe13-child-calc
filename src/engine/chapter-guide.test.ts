import { describe, expect, it } from 'vitest';
import { SOURCES } from '../curated/sources';
import { CHILD_UNITS } from '../game-data/children';
import { JOIN_DATA } from '../game-data/join';
import { CHAPTER_GUIDE, createEngine } from './index';

const engine = createEngine();
const maps = engine.maps();
const order = (id: string) => maps.find((m) => m.id === id)!.order;
/** Where a unit joins: its join data, or the map whose recruits name it (children). */
const joinOrder = (unit: string): number => {
  if (unit in JOIN_DATA) return order(JOIN_DATA[unit as keyof typeof JOIN_DATA].chapter);
  const name = CHILD_UNITS[unit as keyof typeof CHILD_UNITS]?.name;
  const m = maps.find((x) => x.recruits.some((r) => r.unit === name));
  if (!m) throw new Error(`No join for ${unit}`);
  return m.order;
};

describe('the chapter guide (curated)', () => {
  it('holds the 74 verified entries, citing the registry', () => {
    expect(CHAPTER_GUIDE).toHaveLength(74);
    for (const e of CHAPTER_GUIDE) {
      expect(SOURCES[e.source], e.id).toBeDefined();
      expect(e.citation.title, e.id).toBeTruthy();
    }
  });

  it('names real maps and difficulties, and only units available by then', () => {
    const bad = CHAPTER_GUIDE.flatMap((e) => [
      ...(maps.some((m) => m.id === e.map) ? [] : [`${e.id}: no map ${e.map}`]),
      ...(['normal', 'hard', 'lunatic', 'lunatic-plus'].includes(e.difficulty) ? [] : [`${e.id}: ${e.difficulty}`]),
      ...e.units.filter((u) => joinOrder(u) > order(e.map)).map((u) => `${e.id}: ${u} isn’t there yet`),
    ]);
    expect(bad).toEqual([]);
  });

  it('holds no chapter-data facts (stat figures) and none of the terrain-dependent entries', () => {
    for (const e of CHAPTER_GUIDE) expect(e.tactic, e.id).not.toMatch(/\b\d+\s*(HP|Str|Mag|Skl|Spd|Lck|Def|Res)\b/);
    const held = ['12.S2', '13.S1', '14.S2', '16.S2', '24.S1', '25.S1', '4.S1', '21.S3', '22.S'];
    expect(CHAPTER_GUIDE.filter((e) => held.includes(e.id))).toEqual([]);
  });

  it('reaches a map by source', () => {
    const g = engine.chapterGuide('chapter-5');
    expect(g).toHaveLength(1);
    expect(g[0]!.source).toMatchObject({ id: 'S10', name: 'Ellery' });
    expect(g[0]!.entries.map((e) => e.id)).toEqual(['5.S1', '5.S2', '5.S3', '5.S4']);
    expect(engine.chapterGuide('chapter-22')).toEqual([]);
  });
});
