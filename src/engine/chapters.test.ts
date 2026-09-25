import { describe, expect, it } from 'vitest';
import { CHILD_UNITS } from '../game-data/children';
import { FIRST_GEN_UNITS } from '../game-data/units';
import { CHAPTER_DIFFICULTIES, createEngine } from './index';

const engine = createEngine();
const maps = engine.maps();
const byId = new Map(maps.map((m) => [m.id, m]));
const names = new Set<string>(['Robin', 'Morgan', ...Object.values(FIRST_GEN_UNITS).map((u) => u.name), ...Object.values(CHILD_UNITS).map((u) => u.name)]);
const MAP_ID = /^(premonition|prologue|endgame|chapter-\d+|paralogue-\d+|[a-z0-9-]+)$/;

describe('chapter data (consistency)', () => {
  it('has Premonition, the Prologue and Chapters 1–6 in order', () => {
    expect(maps.filter((m) => m.kind === 'story').slice(0, 8).map((m) => m.id)).toEqual(['premonition', 'prologue', 'chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 'chapter-5', 'chapter-6']);
  });

  it('gives every map its conditions, enemies and boss on Normal, Hard and Lunatic, cited by oldid', () => {
    for (const m of maps) {
      expect(m.source.oldid, m.id).toBeGreaterThan(0);
      for (const d of CHAPTER_DIFFICULTIES) {
        expect(m.conditions[d]?.victory, `${m.id} ${d}`).toBeTruthy();
        expect(m.conditions[d]?.deploy, `${m.id} ${d}`).toBeTruthy();
        expect(m.enemies[d]?.length, `${m.id} ${d}`).toBeGreaterThan(0);
        expect(m.bosses[d]?.every((b) => b.name), `${m.id} ${d}`).toBe(true);
      }
    }
  });

  it('prints the Lunatic+ pool the rule gives: four skills before Chapter 3, all seven from it', () => {
    for (const m of maps.filter((x) => x.lunaticPlusPool.length)) expect([...m.lunaticPlusPool].sort(), m.id).toEqual([...engine.lunaticPlusPool(m)].sort());
    expect(engine.lunaticPlusPool(byId.get('chapter-2')!)).not.toContain('Counter');
    expect(engine.lunaticPlusPool(byId.get('chapter-3')!)).toContain('Pavise+');
  });

  it('recruits only known units, and names only well-formed maps it unlocks', () => {
    for (const m of maps) {
      for (const r of m.recruits) expect(names.has(r.unit), `${m.id}: ${r.unit}`).toBe(true);
      for (const u of m.unlocks) expect(u, m.id).toMatch(MAP_ID);
    }
    expect(byId.get('chapter-3')!.recruits.map((r) => r.unit)).toEqual(['Sumia', 'Kellam']);
  });

  it('keeps FEW’s facts: Chapter 5’s Hard-only reinforcements, Chapter 1’s shop and Orton’s drop', () => {
    const c5 = byId.get('chapter-5')!;
    expect(c5.reinforcements).toContain('Turn 4 (Hard/Lunatic only)');
    expect(c5.bosses.lunatic![0]).toMatchObject({ name: 'Orton', class: 'Wyvern Rider', level: '9', skills: ['Tantivy'] });
    expect(c5.bosses.lunatic![0]!.items).toContainEqual({ name: 'Bullion (M)', drop: true });
    expect(byId.get('chapter-1')!.shop).toMatchObject({ opensAfter: 'chapter 3', location: 'West of Ylisstol' });
  });

  it('records disagreements against loaded maps', () => {
    for (const d of engine.chapterDisagreements()) expect(byId.has(d.map), d.id).toBe(true);
  });
});

describe('Chapters 7–12 (#110)', () => {
  it('are loaded in order after Chapter 6', () => {
    const ids = maps.filter((m) => m.kind === 'story').map((m) => m.id);
    expect(ids.slice(ids.indexOf('chapter-6') + 1, ids.indexOf('chapter-6') + 7)).toEqual(['chapter-7', 'chapter-8', 'chapter-9', 'chapter-10', 'chapter-11', 'chapter-12']);
  });

  it('use FEW’s Short Spear for Campari on Hard (C6)', () => {
    expect(byId.get('chapter-9')!.bosses.hard![0]).toMatchObject({ name: 'Campari' });
    expect(byId.get('chapter-9')!.bosses.hard![0]!.items.map((i) => i.name)).toContain('Short Spear');
  });

  it('defeat Mustafa to clear Chapter 10, and recruit Olivia and Cherche', () => {
    expect(byId.get('chapter-10')!.conditions.normal!.victory).toMatch(/Mustafa/);
    expect(byId.get('chapter-11')!.recruits.map((r) => r.unit)).toEqual(['Olivia']);
    expect(byId.get('chapter-12')!.recruits.map((r) => r.unit)).toEqual(['Cherche']);
  });
});

describe('Chapters 13–19 (#111)', () => {
  it('recruit Henry and Lucina in Chapter 13 and Say’ri in Chapter 15, and end on Walhart', () => {
    expect(byId.get('chapter-13')!.recruits.map((r) => r.unit)).toEqual(['Henry', 'Lucina']);
    expect(byId.get('chapter-15')!.recruits.map((r) => r.unit)).toEqual(["Say'ri"]);
    expect(byId.get('chapter-19')!.conditions.lunatic!.victory).toMatch(/Walhart/);
    expect(byId.get('chapter-13')!.unlocks).toEqual(['chapter-14', ...Array.from({ length: 12 }, (_, i) => `paralogue-${i + 5}`)]);
  });
});

describe('Chapters 20–25 and the Endgame (#112)', () => {
  it('end the story at the Endgame, after Chapter 25, which unlocks the SpotPass paralogues', () => {
    const ids = maps.map((m) => m.id);
    expect(ids.indexOf('endgame')).toBeGreaterThan(ids.indexOf('chapter-25'));
    expect(byId.get('chapter-25')!.unlocks).toEqual(['endgame', ...Array.from({ length: 6 }, (_, i) => `paralogue-${i + 18}`)]);
    expect(byId.get('endgame')!.conditions.lunatic!.victory).toMatch(/Grima/);
  });

  it('list Chapter 22’s twelve Deadlords as bosses, from FEW’s enemy table', () => {
    expect(byId.get('chapter-22')!.bosses.lunatic!.filter((b) => b.name && b.name !== 'Aversa')).toHaveLength(12);
  });

  it('recruit Basilio and Flavia in Chapter 23', () => {
    expect(byId.get('chapter-23')!.recruits.map((r) => r.unit)).toEqual(['Basilio', 'Flavia']);
  });
});

describe('Paralogues 1–23 (#113)', () => {
  it('sit just after the chapter that unlocks them', () => {
    const ids = maps.map((m) => m.id);
    expect(ids.slice(ids.indexOf('chapter-3') + 1, ids.indexOf('chapter-3') + 3)).toEqual(['paralogue-1', 'chapter-4']);
    expect(ids.slice(ids.indexOf('chapter-13') + 1, ids.indexOf('chapter-13') + 13)).toEqual(Array.from({ length: 12 }, (_, i) => `paralogue-${i + 5}`));
  });

  it('recruit each child in its paralogue, and keep Paralogue 13’s two factions', () => {
    expect(byId.get('paralogue-5')!.recruits.map((r) => r.unit)).toEqual(['Owain']);
    expect(byId.get('paralogue-23')!.recruits.map((r) => r.unit)).toEqual(['Priam']);
    expect(new Set(byId.get('paralogue-13')!.enemies.lunatic!.map((g) => g.faction))).toEqual(new Set(['Stonewall Knights', 'Riders of Dawn']));
  });

  it('use FEW’s monotone Hard stats where SF’s aren’t (C2–C4)', () => {
    expect(byId.get('paralogue-9')!.bosses.hard!.find((b) => b.name === 'Ruger')!.stats.lck).toBe('17');
  });
});
