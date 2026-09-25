import { describe, expect, it } from 'vitest';
import { createEngine } from './index';

const engine = createEngine();
const apo = { context: 'apotheosis', dlc: false } as const;

describe('a first-gen unit’s page', () => {
  it('draws Lon’qu’s class tree: Myrmidon, Thief and Wyvern Rider lines, Dread Fighter as DLC', () => {
    const p = engine.unitPage('lonqu', apo);
    expect(p.tree.lines.map((l) => [l.base.name, l.promotions.map((c) => c.name)])).toEqual([
      ['Myrmidon', ['Swordmaster', 'Assassin']],
      ['Thief', ['Assassin', 'Trickster']],
      ['Wyvern Rider', ['Wyvern Lord', 'Griffon Rider']],
    ]);
    expect(p.tree.dlc.map((c) => c.name)).toEqual(['Dread Fighter']);
    expect(p.tree.lines[0]!.base.join).toBe(true);
    expect(p.join).toMatchObject({ chapterLabel: 'Chapter 4', joinClassName: 'Myrmidon', level: 4 });
    // Avoid +10 is a Myrmidon skill he also starts with.
    expect(p.tree.lines[0]!.base.skills.find((s) => s.skill.id === 'avoid-plus-10')).toMatchObject({ level: 1, starting: true, inheritable: true });
  });

  it('keeps Walhart’s Conquest, which no class teaches, as a starting skill the builds can use', () => {
    const p = engine.unitPage('walhart', apo);
    expect(p.tree.startingOnly.map((s) => s.id)).toEqual(['conquest']);
    const card = engine.unitSkillCard('walhart', 'conquest', apo);
    expect(card.sources).toEqual([{ kind: 'start' }]);
  });

  it('matches builds against the unit’s own reach, with tier and reclass cost', () => {
    const p = engine.unitPage('lonqu', apo);
    expect(p.builds.length).toBeGreaterThan(0);
    expect(p.chips.bestTier).toBe(p.builds[0]!.tier);
    for (const b of p.builds) expect(b.reclassCost).toBe(b.reclassClasses.length);
    // Apotheosis reaches DLC: Dread Fighter counts there, not in the main story.
    expect(p.chips.classes).toBe(9);
    expect(engine.unitPage('lonqu', { context: 'main-story', dlc: false }).chips.classes).toBe(8);
  });

  it('shows Gaius’s daughter classes with the Galedad conversion', () => {
    const { asParent } = engine.unitPage('gaius', apo);
    expect(asParent.daughter!.classes.map((c) => c.name)).toEqual(['Thief', 'Pegasus Knight', 'Myrmidon']);
    expect(asParent.conversions).toEqual([{ from: 'Fighter', to: 'Pegasus Knight' }]);
    expect(asParent.children.find((c) => c.child === 'cynthia')).toMatchObject({ as: 'variable', keys: ['cynthia|gaius'] });
  });

  it('lists first-gen units in roster order, SpotPass last', () => {
    const units = engine.pageUnits();
    expect(units).toHaveLength(35);
    expect(units[0]!.id).toBe('chrom');
    expect(units.slice(-6).every((u) => u.spotPass)).toBe(true);
    expect(units.slice(0, -6).some((u) => u.spotPass)).toBe(false);
  });

  it('builds a page for every unit, in its join class', () => {
    for (const { id } of engine.pageUnits()) {
      const p = engine.unitPage(id, apo);
      const classes = [...p.tree.lines.flatMap((l) => [l.base, ...l.promotions]), ...p.tree.dlc];
      expect(classes.some((c) => c.join)).toBe(true);
    }
  });
});
